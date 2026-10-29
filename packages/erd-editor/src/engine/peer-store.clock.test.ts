// @vitest-environment node

import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { addColumn, play, renameTable } from '@/__test-utils__/peerScenarios';
import {
  createSeedValue,
  createUserStore,
  SEED,
  type SeededStore,
} from '@/__test-utils__/peerSeed';
import { counterOf, versionOf } from '@/__test-utils__/version';
import { slotOf } from '@/engine/clock';
import { sharedMouseTrackerAction } from '@/engine/modules/editor/atom.actions';
import { changeTableNameAction } from '@/engine/modules/table/atom.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import { Tag } from '@/engine/tag';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
});

/**
 * A session that has run for a while: the user renamed a table several times,
 * so the LWW register for that name holds a version the file does not carry.
 */
function busyUser(): { user: SeededStore; version: number; snapshot: string } {
  const user = createUserStore(createSeedValue());
  cleanups.push(user.destroy);

  for (let i = 1; i <= 5; i++) {
    user.rxStore.dispatchSync(
      changeTableNameAction({ id: SEED.users, value: `users_v${i}` })
    );
  }

  return {
    user,
    version: user.rxStore.context.clock.getVersion(),
    snapshot: toJson(user.rxStore.state),
  };
}

function latePeer(snapshot: string): PeerStore {
  const peer = createPeerStore({ nickname: 'agent', presence: false });
  cleanups.push(peer.destroy);
  peer.setInitialValue(snapshot);
  return peer;
}

const nameOf = (user: SeededStore) =>
  user.rxStore.state.collections.tableEntities[SEED.users].name;

const rename = (peer: PeerStore) =>
  play(peer, renameTable(SEED.users, 'renamed_by_agent'));

describe('a late peer edits past the versions it never saw (AC-E6)', () => {
  it('is outvoted without a clock hint, which is what both paths fix', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    peer.subscribe(actions => user.sharedStore.dispatchSync(actions));

    rename(peer);

    expect(counterOf(version)).toBeGreaterThan(3);
    expect(nameOf(user)).toBe('users_v5');
  });

  it('lands through the snapshot version handed to mergeClock', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    // One way only, so no mergeLWW answer can reach the peer.
    peer.subscribe(actions => user.sharedStore.dispatchSync(actions));

    peer.mergeClock(version);
    const report = rename(peer);

    expect(report.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });

  it('lands through the mergeLWW answer to its first subscription', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    user.sharedStore.subscribe(actions => peer.receive(actions));
    peer.subscribe(actions => user.sharedStore.dispatchSync(actions));

    expect(peer.state.lww[SEED.users]).toBeDefined();
    const report = rename(peer);

    expect(report.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });

  it('asks again for the first subscriber a headless dispatch came before', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    play(peer, addColumn(SEED.empty));

    user.sharedStore.subscribe(actions => peer.receive(actions));
    const handshake: string[] = [];
    peer.subscribe(actions => {
      handshake.push(...actions.map(({ type }) => type));
      user.sharedStore.dispatchSync(actions);
    });
    const report = rename(peer);

    expect(handshake[0]).toBe('editor.getLWW');
    expect(report.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });
});

describe('a peer seeded again', () => {
  it('drops the registers of the document it held and asks the open window for its own again', () => {
    const { user, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    // An add the window never heard, so only this peer holds its register.
    const [columnId] = play(peer, addColumn(SEED.empty)).createdIds;
    user.sharedStore.subscribe(actions => peer.receive(actions));
    const sent: string[] = [];
    peer.subscribe(actions => {
      sent.push(...actions.map(({ type }) => type));
      user.sharedStore.dispatchSync(actions);
    });
    expect(peer.state.lww[columnId]).toBeDefined();
    sent.length = 0;

    peer.setInitialValue(snapshot);

    expect(sent).toEqual(['editor.getLWW']);
    expect(peer.state.lww[columnId]).toBeUndefined();
    expect(peer.state.lww[SEED.users]).toEqual(
      user.rxStore.state.lww[SEED.users]
    );
  });

  it('asks nobody before anything opened its sink', () => {
    const { snapshot } = busyUser();
    const peer = latePeer(snapshot);
    const sent: string[] = [];

    peer.setInitialValue(snapshot);
    peer.subscribe(actions => sent.push(...actions.map(({ type }) => type)));

    expect(sent).toEqual(['editor.getLWW']);
  });
});

describe('a peer’s clock (AC-T5)', () => {
  const versionsOf = ({ actions }: ReturnType<typeof rename>) =>
    new Set(actions.map(({ version }) => version));

  it('takes the greater of the versions mergeClock hands it, and stamps the next counter at its own slot', () => {
    const peer = latePeer(createSeedValue());

    peer.mergeClock(versionOf(5, 123));
    peer.mergeClock(versionOf(2, 999));

    expect(versionsOf(rename(peer))).toEqual(
      new Set([versionOf(6, slotOf(peer.editorId))])
    );
  });

  it('spends no counter on a tracker it receives, whatever version an editor built before the slot stamped it with', () => {
    const peer = latePeer(createSeedValue());

    peer.receive({
      ...sharedMouseTrackerAction({ x: 1, y: 1 }),
      version: versionOf(40, 7),
      tags: Tag.shared,
      meta: { editorId: 'remote', nickname: 'remote' },
    });

    expect(versionsOf(rename(peer))).toEqual(
      new Set([versionOf(1, slotOf(peer.editorId))])
    );
  });
});
