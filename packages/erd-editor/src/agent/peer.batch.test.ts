// @vitest-environment node

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createSeedValue, SEED } from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { toolByName } from '@/agent/registry';

let peer: AgentPeer;
let sent: string[][];

beforeEach(() => {
  vi.useFakeTimers();
  peer = createAgentPeer({ nickname: 'agent' });
  peer.setInitialValue(createSeedValue());
  sent = [];
  peer.subscribe(actions => sent.push(actions.map(({ type }) => type)));
});

afterEach(() => {
  peer.destroy();
  vi.useRealTimers();
});

describe('one call is one outbound batch and one undo entry (AC-E9′, AC-P1)', () => {
  it('sends a plain edit as one batch with one entry', async () => {
    const run = await peer.runTool('erd_change_table_name', {
      tableId: SEED.users,
      value: 'members',
    });

    expect(run.batches).toBe(1);
    expect(run.historyEntries).toBe(1);
    expect(run.mismatch).toBeUndefined();
  });

  it('closes each color change on return, with no timer advanced', async () => {
    const first = await peer.runTool('erd_change_table_color', {
      tableId: SEED.users,
      color: '#111111',
    });
    const second = await peer.runTool('erd_change_table_color', {
      tableId: SEED.users,
      color: '#222222',
    });

    const colorBatches = sent.filter(types =>
      types.includes('table.changeColor')
    );

    expect([first.batches, second.batches]).toEqual([1, 1]);
    expect([first.historyEntries, second.historyEntries]).toEqual([1, 1]);
    expect(colorBatches).toHaveLength(2);
  });

  it('closes each memo color change on return with one entry, with no timer advanced', async () => {
    const runs = [];
    for (const color of ['#111111', '#222222']) {
      runs.push(
        await peer.runTool('erd_change_memo_color', {
          memoId: SEED.memo,
          color,
        })
      );
    }

    expect(runs.map(({ batches }) => batches)).toEqual([1, 1]);
    expect(runs.map(({ historyEntries }) => historyEntries)).toEqual([1, 1]);
    expect(runs.every(({ mismatch }) => !mismatch)).toBe(true);
    expect(sent.filter(types => types.includes('memo.changeColor'))).toEqual([
      ['memo.changeColor'],
      ['memo.changeColor'],
    ]);
  });

  it('sends a lone resize as one batch that makes no entry, with no timer advanced', async () => {
    const run = await peer.runTool('erd_resize_memo', {
      memoId: SEED.memo,
      width: 300,
      height: 200,
    });

    expect(run).toMatchObject({ batches: 1, historyEntries: 0 });
    expect(run.mismatch).toBeUndefined();
    expect(sent.filter(types => types.includes('memo.resize'))).toEqual([
      ['memo.resize'],
    ]);
  });

  it('sends two resizes as two batches that make no entry, never merging them', async () => {
    const runs = [];
    for (const width of [300, 400]) {
      runs.push(
        await peer.runTool('erd_resize_memo', {
          memoId: SEED.memo,
          width,
          height: 200,
        })
      );
    }

    expect(runs.map(({ batches }) => batches)).toEqual([1, 1]);
    expect(runs.map(({ historyEntries }) => historyEntries)).toEqual([0, 0]);
    expect(sent.filter(types => types.includes('memo.resize'))).toHaveLength(2);
    expect(peer.state.collections.memoEntities[SEED.memo].ui.width).toBe(400);
  });

  it('sends nothing and records nothing for a flag already set, within its declared range', async () => {
    const run = await peer.runTool('erd_set_column_not_null', {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: true,
    });

    expect(run.batches).toBe(0);
    expect(run.historyEntries).toBe(0);
    expect(run.actions).toEqual([]);
    expect(run.mismatch).toBeUndefined();
  });

  it('does not count the focus it sends between calls that move the focus', async () => {
    const runs = [];
    for (const [tableId, value] of [
      [SEED.users, 'a'],
      [SEED.orders, 'b'],
      [SEED.users, 'c'],
    ]) {
      runs.push(
        await peer.runTool('erd_change_table_name', { tableId, value })
      );
      await Promise.resolve();
      vi.advanceTimersByTime(150);
    }

    const presence = sent.filter(types =>
      types.includes('editor.sharedFocusTracker')
    );

    expect(runs.map(({ batches }) => batches)).toEqual([1, 1, 1]);
    expect(presence.length).toBeGreaterThanOrEqual(3);
    expect(
      presence.every(types => types.every(type => !type.startsWith('table.')))
    ).toBe(true);
  });

  it('sends a sort as one batch of placements with one entry, never a replayed sort', async () => {
    const run = await peer.runTool('erd_sort_tables', {});
    const layout = sent.filter(types => types.includes('table.moveTo'));

    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(run.mismatch).toBeUndefined();
    expect(run.actions.map(({ payload }) => payload.id).sort()).toEqual(
      [SEED.empty, SEED.orders, SEED.users].sort()
    );
    expect(layout).toEqual([Array(3).fill('table.moveTo')]);
    expect(sent.some(types => types.includes('table.sort'))).toBe(false);
  });

  it('sends nothing for a sort of a document with no table, within its declared range', async () => {
    peer.setInitialValue('');

    const run = await peer.runTool('erd_sort_tables', {});

    expect(run).toMatchObject({ batches: 0, historyEntries: 0, actions: [] });
    expect(run.mismatch).toBeUndefined();
  });

  it('reports a mismatch when the measured counts leave the declared range', async () => {
    const tool = toolByName.get('erd_change_table_name') as {
      expectedHistory: unknown;
    };
    const declared = tool.expectedHistory;
    tool.expectedHistory = { min: 2, max: 3 };

    try {
      const run = await peer.runTool('erd_change_table_name', {
        tableId: SEED.users,
        value: 'members',
      });

      expect(run.mismatch).toEqual({
        expectedBatches: '1',
        expectedHistory: '2..3',
      });
    } finally {
      tool.expectedHistory = declared;
    }
  });
});
