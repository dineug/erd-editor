// @vitest-environment node

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  colorMemo,
  colorTable,
  play,
  renameTable,
  resizeMemo,
  setColumnNotNull,
  sortTables,
} from '@/__test-utils__/peerScenarios';
import { createSeedValue, SEED } from '@/__test-utils__/peerSeed';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';

const flushes = vi.hoisted(() => ({ order: [] as string[] }));

// Records which store closes its stream buffers when, the one thing a flush
// orders; each store still flushes as it would.
vi.mock('@/engine/rx-store', async importOriginal => {
  const actual = await importOriginal<typeof import('@/engine/rx-store')>();

  return {
    ...actual,
    createRxStore: (...args: Parameters<typeof actual.createRxStore>) => {
      const store = actual.createRxStore(...args);
      return Object.freeze({
        ...store,
        flushStreamBuffers: () => {
          flushes.order.push('history');
          store.flushStreamBuffers();
        },
      });
    },
  };
});

vi.mock('@/engine/shared-store', async importOriginal => {
  const actual = await importOriginal<typeof import('@/engine/shared-store')>();

  return {
    ...actual,
    createSharedStore: (
      ...args: Parameters<typeof actual.createSharedStore>
    ) => {
      const store = actual.createSharedStore(...args);
      return Object.freeze({
        ...store,
        flushStreamBuffers: () => {
          flushes.order.push('outbound');
          store.flushStreamBuffers();
        },
      });
    },
  };
});

let peer: PeerStore;
let sent: string[][];

beforeEach(() => {
  vi.useFakeTimers();
  peer = createPeerStore({ nickname: 'agent' });
  peer.setInitialValue(createSeedValue());
  sent = [];
  peer.subscribe(actions => sent.push(actions.map(({ type }) => type)));
  flushes.order = [];
});

afterEach(() => {
  peer.destroy();
  vi.useRealTimers();
});

describe('one dispatch is one outbound batch and one undo entry (AC-E9′, AC-P1)', () => {
  it('sends a plain edit as one batch with one entry', () => {
    const report = play(peer, renameTable(SEED.users, 'members'));

    expect(report.batches).toBe(1);
    expect(report.historyEntries).toBe(1);
  });

  it('closes each color change on return, with no timer advanced', () => {
    const first = play(peer, colorTable(SEED.users, '#111111'));
    const second = play(peer, colorTable(SEED.users, '#222222'));

    const colorBatches = sent.filter(types =>
      types.includes('table.changeColor')
    );

    expect([first.batches, second.batches]).toEqual([1, 1]);
    expect([first.historyEntries, second.historyEntries]).toEqual([1, 1]);
    expect(colorBatches).toHaveLength(2);
  });

  it('closes each memo color change on return with one entry, with no timer advanced', () => {
    const reports = ['#111111', '#222222'].map(color =>
      play(peer, colorMemo(SEED.memo, color))
    );

    expect(reports.map(({ batches }) => batches)).toEqual([1, 1]);
    expect(reports.map(({ historyEntries }) => historyEntries)).toEqual([1, 1]);
    expect(sent.filter(types => types.includes('memo.changeColor'))).toEqual([
      ['memo.changeColor'],
      ['memo.changeColor'],
    ]);
  });

  it('sends a lone resize as one batch that makes no entry, with no timer advanced', () => {
    const report = play(peer, resizeMemo(SEED.memo, 300, 200));

    expect(report).toMatchObject({ batches: 1, historyEntries: 0 });
    expect(sent.filter(types => types.includes('memo.resize'))).toEqual([
      ['memo.resize'],
    ]);
  });

  it('sends two resizes as two batches that make no entry, never merging them', () => {
    const reports = [300, 400].map(width =>
      play(peer, resizeMemo(SEED.memo, width, 200))
    );

    expect(reports.map(({ batches }) => batches)).toEqual([1, 1]);
    expect(reports.map(({ historyEntries }) => historyEntries)).toEqual([0, 0]);
    expect(sent.filter(types => types.includes('memo.resize'))).toHaveLength(2);
    expect(peer.state.collections.memoEntities[SEED.memo].ui.width).toBe(400);
  });

  it('sends nothing and records nothing for a flag already set', () => {
    const report = play(peer, setColumnNotNull(SEED.users, SEED.userId, true));

    expect(report.batches).toBe(0);
    expect(report.historyEntries).toBe(0);
    expect(report.actions).toEqual([]);
  });

  it('does not count the focus it sends between dispatches that move the focus', async () => {
    const reports = [];
    for (const [tableId, value] of [
      [SEED.users, 'a'],
      [SEED.orders, 'b'],
      [SEED.users, 'c'],
    ]) {
      reports.push(play(peer, renameTable(tableId, value)));
      await Promise.resolve();
      vi.advanceTimersByTime(150);
    }

    const presence = sent.filter(types =>
      types.includes('editor.sharedFocusTracker')
    );

    expect(reports.map(({ batches }) => batches)).toEqual([1, 1, 1]);
    expect(presence.length).toBeGreaterThanOrEqual(3);
    expect(
      presence.every(types => types.every(type => !type.startsWith('table.')))
    ).toBe(true);
  });

  it('sends a sort as one batch of placements with one entry, never a replayed sort', () => {
    const report = play(peer, sortTables());
    const layout = sent.filter(types => types.includes('table.moveTo'));

    expect(report).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(report.actions.map(({ payload }) => payload.id).sort()).toEqual(
      [SEED.empty, SEED.orders, SEED.users].sort()
    );
    expect(layout).toEqual([Array(3).fill('table.moveTo')]);
    expect(sent.some(types => types.includes('table.sort'))).toBe(false);
  });

  it('sends nothing for a sort of a document with no table', () => {
    peer.setInitialValue('');

    const report = play(peer, sortTables());

    expect(report).toMatchObject({
      batches: 0,
      historyEntries: 0,
      actions: [],
    });
  });
});

describe('closing the stream buffers (D15)', () => {
  it('closes the history before the outbound pipe after a stream dispatch', () => {
    play(peer, colorTable(SEED.users, '#111111'));

    expect(flushes.order).toEqual(['history', 'outbound']);
  });

  it('leaves the buffers alone after a dispatch with no stream action', () => {
    play(peer, renameTable(SEED.users, 'members'));

    expect(flushes.order).toEqual([]);
  });

  it('closes them in the same order on an undo, whose color streams again', () => {
    play(peer, colorTable(SEED.users, '#111111'));
    flushes.order = [];

    peer.undo();

    expect(flushes.order).toEqual(['history', 'outbound']);
  });

  it('flushes on demand in the same order, sending nothing when nothing is held', () => {
    const before = sent.length;

    peer.flushStreamBuffers();
    peer.flushStreamBuffers();

    expect(flushes.order).toEqual([
      'history',
      'outbound',
      'history',
      'outbound',
    ]);
    expect(sent).toHaveLength(before);
  });

  it('flushes nothing once destroyed', () => {
    peer.destroy();

    peer.flushStreamBuffers();

    expect(flushes.order).toEqual([]);
  });
});
