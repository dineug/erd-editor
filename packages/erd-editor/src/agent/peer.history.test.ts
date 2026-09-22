// @vitest-environment node

import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  comparable,
  createSeedValue,
  createSession,
  SEED,
  type Session,
  settle,
} from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { type ActionTool, toolByName } from '@/agent/registry';
import { Database } from '@/constants/schema';
import {
  changeTableColorAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { HISTORY_LIMIT } from '@/engine/rx-store';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  vi.useRealTimers();
});

function seededPeer(): AgentPeer {
  const peer = createAgentPeer({ nickname: 'agent', presence: false });
  cleanups.push(peer.destroy);
  peer.setInitialValue(createSeedValue());
  return peer;
}

function session(): Session {
  const opened = createSession();
  cleanups.push(opened.destroy);
  return opened;
}

const tableName = (peer: AgentPeer, id: string) =>
  peer.state.collections.tableEntities[id].name;

const renameUsers = (peer: AgentPeer, value: string) =>
  peer.runTool('erd_change_table_name', { tableId: SEED.users, value });

/** Sets a flag the seed already holds, a call the engine makes no entry for. */
const setIdNotNull = (peer: AgentPeer) =>
  peer.runTool('erd_set_column_not_null', {
    tableId: SEED.users,
    columnId: SEED.userId,
    value: true,
  });

describe('agent undo reverts the agent’s last call only (AC-E8)', () => {
  it('undoes the last of three calls and leaves the first two', async () => {
    const peer = seededPeer();
    await renameUsers(peer, 'members');
    await peer.runTool('erd_change_table_name', {
      tableId: SEED.orders,
      value: 'purchases',
    });
    const column = await peer.runTool('erd_add_column', {
      tableId: SEED.empty,
    });

    const result = await peer.undo();

    expect(result).toEqual({
      toolName: 'erd_add_column',
      entries: 1,
      skipped: [],
    });
    expect(peer.state.collections.tableEntities[SEED.empty].columnIds).toEqual(
      []
    );
    expect(column.createdIds).toHaveLength(1);
    expect(tableName(peer, SEED.users)).toBe('members');
    expect(tableName(peer, SEED.orders)).toBe('purchases');
  });

  it('propagates the undo while the user store keeps its own history empty', async () => {
    const opened = session();
    await settle();
    const { peer, user } = opened;

    await renameUsers(peer, 'members');
    await peer.runTool('erd_add_column', { tableId: SEED.empty });
    await settle();
    expect(user.rxStore.history.size).toBe(0);

    await peer.undo();
    await settle();

    expect(user.rxStore.history.size).toBe(0);
    expect(
      user.rxStore.state.collections.tableEntities[SEED.empty].columnIds
    ).toEqual([]);
    expect(comparable(peer.value)).toEqual(
      comparable(toJson(user.rxStore.state))
    );
  });

  it('reverts a color at once, flushing the stream action the undo sends', async () => {
    const opened = session();
    await settle();
    vi.useFakeTimers();
    const { peer, user } = opened;
    const colorOf = () =>
      user.rxStore.state.collections.tableEntities[SEED.users].ui.color;

    await peer.runTool('erd_change_table_color', {
      tableId: SEED.users,
      color: '#abcdef',
    });
    await Promise.resolve();
    expect(colorOf()).toBe('#abcdef');

    await peer.undo();
    await Promise.resolve();

    expect(colorOf()).toBe('');
  });

  it('passes over calls the engine made no entry for and names them', async () => {
    const peer = seededPeer();
    await renameUsers(peer, 'members');
    await setIdNotNull(peer);
    const noop = await peer.runTool('erd_set_column_primary_key', {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: true,
    });

    const result = await peer.undo();

    expect(noop.historyEntries).toBe(0);
    expect(result).toEqual({
      toolName: 'erd_change_table_name',
      entries: 1,
      skipped: ['erd_set_column_primary_key', 'erd_set_column_not_null'],
    });
    expect(tableName(peer, SEED.users)).toBe('users');
  });

  it('passes over settings and resizes, which the engine never records', async () => {
    const peer = seededPeer();
    await renameUsers(peer, 'members');
    const database = await peer.runTool('erd_set_database', {
      value: 'PostgreSQL',
    });
    const resize = await peer.runTool('erd_resize_memo', {
      memoId: SEED.memo,
      width: 300,
      height: 200,
    });

    const result = await peer.undo();

    expect([database.historyEntries, resize.historyEntries]).toEqual([0, 0]);
    expect(result).toEqual({
      toolName: 'erd_change_table_name',
      entries: 1,
      skipped: ['erd_resize_memo', 'erd_set_database'],
    });
    expect(tableName(peer, SEED.users)).toBe('users');
    expect(peer.state.settings.database).toBe(Database.PostgreSQL);
  });

  it('reverts every entry a call made with one undo, and redoes them all', async () => {
    const peer = seededPeer();
    const tool = toolByName.get('erd_change_table_name') as {
      toActions: ActionTool['toActions'];
    };
    const declared = tool.toActions;
    // A stream action beside a plain one: the history groups them apart.
    tool.toActions = ({ tableId, value }) => [
      changeTableNameAction({ id: tableId, value }),
      changeTableColorAction({ id: tableId, color: '#123456', prevColor: '' }),
    ];

    try {
      const run = await renameUsers(peer, 'members');
      const colorOf = () =>
        peer.state.collections.tableEntities[SEED.users].ui.color;

      expect(run.historyEntries).toBe(2);
      expect(await peer.undo()).toEqual({
        toolName: 'erd_change_table_name',
        entries: 2,
        skipped: [],
      });
      expect([tableName(peer, SEED.users), colorOf()]).toEqual(['users', '']);

      expect((await peer.redo()).entries).toBe(2);
      expect([tableName(peer, SEED.users), colorOf()]).toEqual([
        'members',
        '#123456',
      ]);
    } finally {
      tool.toActions = declared;
    }
  });

  it('says so when nothing is left to revert', async () => {
    const peer = seededPeer();
    await setIdNotNull(peer);

    expect(await peer.undo()).toEqual({
      toolName: null,
      entries: 0,
      skipped: ['erd_set_column_not_null'],
    });
    expect(await peer.undo()).toEqual({
      toolName: null,
      entries: 0,
      skipped: [],
    });
  });
});

describe('agent redo mirrors undo', () => {
  it('reapplies what the last undo reverted, then has nothing left', async () => {
    const peer = seededPeer();
    await renameUsers(peer, 'members');
    await peer.undo();

    const result = await peer.redo();

    expect(result).toEqual({
      toolName: 'erd_change_table_name',
      entries: 1,
      skipped: [],
    });
    expect(tableName(peer, SEED.users)).toBe('members');
    expect(await peer.redo()).toEqual({
      toolName: null,
      entries: 0,
      skipped: [],
    });
    expect((await peer.undo()).toolName).toBe('erd_change_table_name');
  });

  it('forgets the redo side once a new call makes an entry, as the history does', async () => {
    const peer = seededPeer();
    await renameUsers(peer, 'members');
    await peer.undo();

    await peer.runTool('erd_add_column', { tableId: SEED.empty });

    expect((await peer.redo()).toolName).toBeNull();
    expect(tableName(peer, SEED.users)).toBe('users');
  });

  it('keeps the redo side across a call that made no entry, as the history does', async () => {
    const peer = seededPeer();
    await renameUsers(peer, 'members');
    await peer.undo();

    const noop = await setIdNotNull(peer);
    const result = await peer.redo();

    expect(noop.historyEntries).toBe(0);
    expect(result.toolName).toBe('erd_change_table_name');
    expect(tableName(peer, SEED.users)).toBe('members');
  });
});

describe('a reseed starts the history over', () => {
  it('forgets undo entries, tool records and the redo side', async () => {
    const peer = seededPeer();
    await renameUsers(peer, 'members');
    await peer.runTool('erd_add_column', { tableId: SEED.empty });
    await peer.undo();
    await settle();
    expect(peer.state.editor).toMatchObject({ hasUndo: true, hasRedo: true });

    peer.setInitialValue(createSeedValue());
    await settle();

    expect(peer.state.editor).toMatchObject({ hasUndo: false, hasRedo: false });
    expect(await peer.undo()).toEqual({
      toolName: null,
      entries: 0,
      skipped: [],
    });
    expect(await peer.redo()).toEqual({
      toolName: null,
      entries: 0,
      skipped: [],
    });
    expect(tableName(peer, SEED.users)).toBe('users');
  });
});

describe('the tool records keep to what the history holds', () => {
  const usersX = (peer: AgentPeer) =>
    peer.state.collections.tableEntities[SEED.users].ui.x;

  it('stops naming calls once the history has dropped their entries', async () => {
    const peer = seededPeer();
    for (let x = 0; x <= HISTORY_LIMIT; x++) {
      await peer.runTool('erd_move_table', { tableId: SEED.users, x, y: 0 });
    }

    let reverted = 0;
    while ((await peer.undo()).toolName) {
      reverted++;
    }

    expect(reverted).toBe(HISTORY_LIMIT);
    expect(usersX(peer)).toBe(0);
    expect(await peer.redo()).toMatchObject({ toolName: 'erd_move_table' });
    expect(usersX(peer)).toBe(1);
  });

  it('lets the oldest call with no entry go first, keeping the one that has one', async () => {
    const peer = seededPeer();
    await renameUsers(peer, 'members');
    for (let i = 0; i < HISTORY_LIMIT; i++) {
      await setIdNotNull(peer);
    }

    const result = await peer.undo();

    expect(result.toolName).toBe('erd_change_table_name');
    expect(result.skipped).toHaveLength(HISTORY_LIMIT - 1);
    expect(tableName(peer, SEED.users)).toBe('users');
  });
});
