// @vitest-environment node

import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createSeedValue,
  createUserStore,
  SEED,
  type SeededStore,
} from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { changeTableNameAction } from '@/engine/modules/table/atom.actions';

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

function latePeer(snapshot: string): AgentPeer {
  const peer = createAgentPeer({ nickname: 'agent', presence: false });
  cleanups.push(peer.destroy);
  peer.setInitialValue(snapshot);
  return peer;
}

const nameOf = (user: SeededStore) =>
  user.rxStore.state.collections.tableEntities[SEED.users].name;

const rename = (peer: AgentPeer) =>
  peer.runTool('erd_change_table_name', {
    tableId: SEED.users,
    value: 'renamed_by_agent',
  });

describe('a late peer edits past the versions it never saw (AC-E6)', () => {
  it('is outvoted without a clock hint, which is what both paths fix', async () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    peer.subscribe(actions => user.sharedStore.dispatchSync(actions));

    await rename(peer);

    expect(version).toBeGreaterThan(3);
    expect(nameOf(user)).toBe('users_v5');
  });

  it('lands through the snapshot version handed to mergeClock', async () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    // One way only, so no mergeLWW answer can reach the peer.
    peer.subscribe(actions => user.sharedStore.dispatchSync(actions));

    peer.mergeClock(version);
    const run = await rename(peer);

    expect(run.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });

  it('lands through the mergeLWW answer to its first subscription', async () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    user.sharedStore.subscribe(actions => peer.dispatch(actions));
    peer.subscribe(actions => user.sharedStore.dispatchSync(actions));

    expect(peer.state.lww[SEED.users]).toBeDefined();
    const run = await rename(peer);

    expect(run.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });

  it('asks again for the first subscriber a headless call came before', async () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    await peer.runTool('erd_add_column', { tableId: SEED.empty });

    user.sharedStore.subscribe(actions => peer.dispatch(actions));
    const handshake: string[] = [];
    peer.subscribe(actions => {
      handshake.push(...actions.map(({ type }) => type));
      user.sharedStore.dispatchSync(actions);
    });
    const run = await rename(peer);

    expect(handshake[0]).toBe('editor.getLWW');
    expect(run.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });
});
