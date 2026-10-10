import {
  createEngineContext,
  createPeerStore,
  defaultToWidth,
  getTablesGroupRect,
  type PeerStore,
  TABLE_GROUP_MIN_HEIGHT,
  TABLE_GROUP_MIN_WIDTH,
} from '@dineug/erd-editor/peer.js';
import { compositionActionsFlat } from '@dineug/r-html';
import { afterAll, afterEach, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { toolByName } from '@/tools/registry';
import { runTool } from '@/tools/run';
import { toAgentSnapshot } from '@/tools/snapshot';

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

const seeded = () => {
  const peer = createSeededPeer();
  peers.push(peer);
  return peer;
};

const groupOf = (peer: PeerStore, id: string) =>
  toAgentSnapshot(peer.state).tableGroups.find(group => group.id === id);

const groupIdOf = (peer: PeerStore, tableId: string) =>
  toAgentSnapshot(peer.state).tables.find(({ id }) => id === tableId)?.groupId;

const tableAt = (peer: PeerStore, tableId: string) => {
  const { x, y } = peer.state.collections.tableEntities[tableId].ui;
  return { x, y };
};

function refusal(call: () => unknown): ToolError {
  try {
    call();
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('the call was not refused');
}

describe('erd_add_table_group', () => {
  it('wraps the tables named, each leaving its group, named and colored in one undo entry', () => {
    const peer = seeded();

    const run = runTool(peer, 'erd_add_table_group', {
      name: 'core',
      color: '#22c55e',
      tableIds: [SEED.users, SEED.orders],
    });

    const [id] = run.createdIds;
    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(run.mismatch).toBeUndefined();
    expect(groupOf(peer, id)).toMatchObject({
      name: 'core',
      color: '#22c55e',
      tableIds: [SEED.users, SEED.orders],
    });
    expect(groupOf(peer, SEED.group)?.tableIds).toEqual([]);

    peer.undo();
    expect(groupOf(peer, id)).toBeUndefined();
    expect(groupIdOf(peer, SEED.users)).toBe(SEED.group);
    expect(groupIdOf(peer, SEED.orders)).toBe('');
  });

  it('takes in the tables in no group whose centre lies in a rect, as a drawn group does', () => {
    const peer = seeded();

    const run = runTool(peer, 'erd_add_table_group', {
      name: '',
      x: 0,
      y: 0,
      width: 1200,
      height: 1000,
    });

    const [id] = run.createdIds;
    expect(groupOf(peer, id)).toEqual({
      id,
      name: '',
      color: '',
      x: 0,
      y: 0,
      width: 1200,
      height: 1000,
      tableIds: [SEED.orders, SEED.empty],
    });
    expect(groupIdOf(peer, SEED.users)).toBe(SEED.group);
  });

  it('refuses a rect beside tableIds, a rect short of a side and one smaller than a group', () => {
    const peer = seeded();
    const add = (args: Record<string, unknown>) =>
      refusal(() => runTool(peer, 'erd_add_table_group', args));

    const both = add({ name: 'a', tableIds: [SEED.orders], x: 0, width: 300 });
    expect(both.code).toBe(ToolErrorCode.invalidArgs);
    expect(both.message).toContain(
      'pass tableIds or a rect (x, y, width, height), not both; x, width came with tableIds'
    );
    expect(add({ name: 'a', x: 0, y: 0, width: 300 }).message).toContain(
      'pass tableIds, or x, y, width and height together for a rect'
    );
    expect(
      add({
        name: 'a',
        x: 0,
        y: 0,
        width: TABLE_GROUP_MIN_WIDTH - 1,
        height: 400,
      }).message
    ).toContain(
      `width must be at least ${TABLE_GROUP_MIN_WIDTH} and height at least ${TABLE_GROUP_MIN_HEIGHT}`
    );
    expect(add({ name: 'a', tableIds: ['gone'] })).toMatchObject({
      code: ToolErrorCode.notFound,
    });
    expect(add({ name: 'a', tableIds: [] }).code).toBe(
      ToolErrorCode.invalidArgs
    );
    expect(peer.state.doc.tableGroupIds).toEqual([SEED.group]);
  });
});

describe('erd_remove_table_group', () => {
  it('removes the group and leaves its tables where they are, in no group, until an undo', () => {
    const peer = seeded();
    const before = tableAt(peer, SEED.users);

    runTool(peer, 'erd_remove_table_group', { groupId: SEED.group });

    expect(peer.state.doc.tableGroupIds).toEqual([]);
    expect(groupIdOf(peer, SEED.users)).toBe('');
    expect(tableAt(peer, SEED.users)).toEqual(before);

    peer.undo();
    expect(groupOf(peer, SEED.group)?.tableIds).toEqual([SEED.users]);
  });

  it('refuses a removed group, which an LWW tombstone still records', () => {
    const peer = seeded();
    runTool(peer, 'erd_remove_table_group', { groupId: SEED.group });

    for (const [name, args] of [
      ['erd_remove_table_group', {}],
      ['erd_change_table_group_name', { value: 'x' }],
      ['erd_change_table_group_color', { color: '#000000' }],
      ['erd_move_table_group', { x: 0, y: 0 }],
      ['erd_resize_table_group', { width: 400, height: 400 }],
    ] as const) {
      const error = refusal(() =>
        runTool(peer, name, { groupId: SEED.group, ...args })
      );
      expect(error.code, name).toBe(ToolErrorCode.notFound);
      expect(error.message, name).toContain(
        `groupId ${SEED.group} names no live table group`
      );
    }
  });
});

describe('erd_change_table_group_name and erd_change_table_group_color', () => {
  it('rename and recolor the group, each undone on its own', () => {
    const peer = seeded();

    runTool(peer, 'erd_change_table_group_name', {
      groupId: SEED.group,
      value: 'members',
    });
    runTool(peer, 'erd_change_table_group_color', {
      groupId: SEED.group,
      color: '#a855f7',
    });

    expect(groupOf(peer, SEED.group)).toMatchObject({
      name: 'members',
      color: '#a855f7',
    });

    peer.undo();
    expect(groupOf(peer, SEED.group)).toMatchObject({
      name: 'members',
      color: '',
    });
    peer.undo();
    expect(groupOf(peer, SEED.group)?.name).toBe('accounts');
  });
});

describe('erd_move_table_group', () => {
  it('moves the group to the point and its tables by the same step, in one undo entry', () => {
    const peer = seeded();
    const users = tableAt(peer, SEED.users);
    const orders = tableAt(peer, SEED.orders);

    const run = runTool(peer, 'erd_move_table_group', {
      groupId: SEED.group,
      x: 160,
      y: 140,
    });

    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(groupOf(peer, SEED.group)).toMatchObject({ x: 160, y: 140 });
    expect(tableAt(peer, SEED.users)).toEqual({
      x: users.x + 120,
      y: users.y + 120,
    });
    expect(tableAt(peer, SEED.orders)).toEqual(orders);

    peer.undo();
    expect(groupOf(peer, SEED.group)).toMatchObject({ x: 40, y: 20 });
    expect(tableAt(peer, SEED.users)).toEqual(users);
  });

  it('sends nothing for the point the group holds, and keeps no undo entry for a short step', () => {
    const peer = seeded();

    expect(
      runTool(peer, 'erd_move_table_group', {
        groupId: SEED.group,
        x: 40,
        y: 20,
      })
    ).toMatchObject({ batches: 0, historyEntries: 0 });

    const short = runTool(peer, 'erd_move_table_group', {
      groupId: SEED.group,
      x: 45,
      y: 20,
    });
    expect(short).toMatchObject({ batches: 1, historyEntries: 0 });
    expect(short.mismatch).toBeUndefined();
    expect(groupOf(peer, SEED.group)).toMatchObject({ x: 45, y: 20 });
  });
});

describe('erd_resize_table_group', () => {
  it('writes the rect, the stored corner kept where x and y are left out, undone to the rect before', () => {
    const peer = seeded();

    const run = runTool(peer, 'erd_resize_table_group', {
      groupId: SEED.group,
      width: 600,
      height: 400,
    });

    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(groupOf(peer, SEED.group)).toMatchObject({
      x: 40,
      y: 20,
      width: 600,
      height: 400,
    });
    expect(
      runTool(peer, 'erd_resize_table_group', {
        groupId: SEED.group,
        x: 40,
        y: 20,
        width: 600,
        height: 400,
      })
    ).toMatchObject({ batches: 0, historyEntries: 0 });

    peer.undo();
    expect(groupOf(peer, SEED.group)).toMatchObject({
      width: 560,
      height: 300,
    });
  });

  it('refuses a rect smaller than a group or than its tables with their padding, naming the box', () => {
    const peer = seeded();
    const box = getTablesGroupRect(peer.state, [SEED.users])!;
    const resize = (args: Record<string, unknown>) =>
      refusal(() =>
        runTool(peer, 'erd_resize_table_group', {
          groupId: SEED.group,
          ...args,
        })
      );

    expect(
      resize({ width: 400, height: TABLE_GROUP_MIN_HEIGHT - 1 }).message
    ).toContain(
      `width must be at least ${TABLE_GROUP_MIN_WIDTH} and height at least ${TABLE_GROUP_MIN_HEIGHT}`
    );
    const tight = resize({ x: box.x + 10, width: 800, height: 800 });
    expect(tight.code).toBe(ToolErrorCode.invalidArgs);
    expect(tight.message).toContain(
      `the rect must hold the group's tables with their padding: x at most ${Math.floor(box.x)}, y at most ${Math.floor(box.y)}, x + width at least ${Math.ceil(box.x + box.width)} and y + height at least ${Math.ceil(box.y + box.height)}`
    );
    expect(resize({ width: 200, height: 200 }).message).toContain(
      "the rect must hold the group's tables"
    );

    const fits = runTool(peer, 'erd_resize_table_group', {
      groupId: SEED.group,
      x: Math.floor(box.x),
      y: Math.floor(box.y),
      width: Math.ceil(box.x + box.width) - Math.floor(box.x),
      height: Math.ceil(box.y + box.height) - Math.floor(box.y),
    });
    expect(fits.batches).toBe(1);
  });

  it('lets a group without tables shrink to the least a group takes', () => {
    const peer = seeded();
    runTool(peer, 'erd_set_table_group', {
      tableIds: [SEED.users],
      groupId: null,
    });

    runTool(peer, 'erd_resize_table_group', {
      groupId: SEED.group,
      width: TABLE_GROUP_MIN_WIDTH,
      height: TABLE_GROUP_MIN_HEIGHT,
    });

    expect(groupOf(peer, SEED.group)).toMatchObject({
      width: TABLE_GROUP_MIN_WIDTH,
      height: TABLE_GROUP_MIN_HEIGHT,
    });
  });
});

describe('erd_set_table_group', () => {
  it('puts tables in the group and takes them out with null or an empty id, each undone', () => {
    const peer = seeded();

    runTool(peer, 'erd_set_table_group', {
      tableIds: [SEED.orders, SEED.empty],
      groupId: SEED.group,
    });
    expect(groupOf(peer, SEED.group)?.tableIds).toEqual([
      SEED.users,
      SEED.orders,
      SEED.empty,
    ]);

    runTool(peer, 'erd_set_table_group', {
      tableIds: [SEED.users],
      groupId: null,
    });
    runTool(peer, 'erd_set_table_group', {
      tableIds: [SEED.orders],
      groupId: '',
    });
    expect(groupOf(peer, SEED.group)?.tableIds).toEqual([SEED.empty]);

    peer.undo();
    peer.undo();
    expect(groupOf(peer, SEED.group)?.tableIds).toEqual([
      SEED.users,
      SEED.orders,
      SEED.empty,
    ]);
    peer.undo();
    expect(groupOf(peer, SEED.group)?.tableIds).toEqual([SEED.users]);
  });

  it('sends nothing for tables already where they go', () => {
    const peer = seeded();

    expect(
      runTool(peer, 'erd_set_table_group', {
        tableIds: [SEED.users],
        groupId: SEED.group,
      })
    ).toMatchObject({ batches: 0, historyEntries: 0 });
    expect(
      runTool(peer, 'erd_set_table_group', {
        tableIds: [SEED.orders],
        groupId: null,
      })
    ).toMatchObject({ batches: 0, historyEntries: 0 });
  });

  it('refuses a group that is not live and a groupId that is no id', () => {
    const peer = seeded();
    const set = (groupId: unknown) =>
      refusal(() =>
        runTool(peer, 'erd_set_table_group', {
          tableIds: [SEED.orders],
          groupId,
        })
      );

    expect(set('gone')).toMatchObject({ code: ToolErrorCode.notFound });
    expect(set(7)).toMatchObject({
      code: ToolErrorCode.invalidArgs,
      message: expect.stringContaining(
        'groupId must be a table group id, or null for none'
      ),
    });
    expect(
      refusal(() =>
        runTool(peer, 'erd_set_table_group', { tableIds: [SEED.orders] })
      ).message
    ).toContain('groupId is required');
  });
});

describe('the generators the group tools add read the state defensively', () => {
  const context = createEngineContext({ toWidth: defaultToWidth });
  const empty = createPeerStore({ nickname: 'agent', presence: false });
  empty.setInitialValue('');

  afterAll(() => empty.destroy());

  const emitOnEmpty = (name: string, args: Record<string, unknown>) =>
    compositionActionsFlat(empty.state, context, [
      ...toolByName.get(name)!.toActions(args),
    ]);

  it('recolors from an empty previous color, and moves and resizes nothing, when the group is gone', () => {
    expect(
      emitOnEmpty('erd_change_table_group_color', {
        groupId: 'gone',
        color: '#010203',
      }).map(({ payload }) => payload)
    ).toEqual([{ id: 'gone', color: '#010203', prevColor: '' }]);
    expect(
      emitOnEmpty('erd_move_table_group', { groupId: 'gone', x: 1, y: 1 })
    ).toEqual([]);
    expect(
      emitOnEmpty('erd_resize_table_group', {
        groupId: 'gone',
        width: 400,
        height: 400,
      })
    ).toEqual([]);
    expect(
      toolByName.get('erd_resize_table_group')!.refine!(
        { groupId: 'gone', width: 1, height: 1 },
        empty.state
      )
    ).toBeUndefined();
  });
});
