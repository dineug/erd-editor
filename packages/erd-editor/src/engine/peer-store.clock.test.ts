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
import { changeTableNameAction } from '@/engine/modules/table/atom.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';

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

    expect(version).toBeGreaterThan(3);
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
