import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  actionType,
  actionVersion,
  createQuietState,
  drainJoinQueue,
  dropRecipient,
  filterJoinQueue,
  hasChangeAction,
  JOIN_QUIET_CAP_MS,
  maxVersion,
  noteChange,
  noteSave,
  REPLICA_DEBOUNCE_MS,
  waitForQuiet,
} from '@/joinWindow';

const add = (version?: number, type = 'table.add') =>
  version === undefined
    ? { type, payload: {} }
    : { type, payload: {}, version };

/** A view double: the quiet state reads nothing of one but its identity. */
const view = (name: string) => ({ name });

/** Lets a settled Deferred wake the effect awaiting it. */
async function microtasks(): Promise<void> {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('action fields', () => {
  it('reads a finite numeric version and a string type, nothing else', () => {
    expect(actionVersion({ version: 4 })).toBe(4);
    expect(actionVersion({ version: '4' })).toBeUndefined();
    expect(actionVersion({ version: Number.NaN })).toBeUndefined();
    expect(actionVersion([4])).toBeUndefined();
    expect(actionVersion(null)).toBeUndefined();
    expect(actionType({ type: 'memo.add' })).toBe('memo.add');
    expect(actionType({ type: 3 })).toBe('unknown');
  });

  it('takes the highest version, skipping the version-less compressed stream actions', () => {
    expect(maxVersion(3, [add(7), add(), add(5)])).toBe(7);
    expect(maxVersion(9, [add(2), { type: 'table.move' }])).toBe(9);
    expect(maxVersion(0, [])).toBe(0);
  });

  it('counts anything but presence and the LWW handshake as a change', () => {
    expect(
      hasChangeAction([
        { type: 'editor.getLWW' },
        { type: 'editor.mergeLWW' },
        { type: 'editor.sharedFocusTracker' },
      ])
    ).toBe(false);
    expect(hasChangeAction([{ type: 'editor.getLWW' }, add(1)])).toBe(true);
    expect(hasChangeAction([{ payload: {} }])).toBe(true);
    expect(hasChangeAction([])).toBe(false);
  });
});

describe('quiet state', () => {
  it('resolves true at once with no change pending', async () => {
    const state = createQuietState<{ name: string }>();
    noteSave(state, view('only'), 0);

    await expect(Effect.runPromise(waitForQuiet(state))).resolves.toBe(true);
    expect(state.pending).toBe(false);
  });

  it('wakes on the last save of the views the change reached, not on another view', async () => {
    vi.useFakeTimers();
    const [first, second, other] = [view('first'), view('second'), view('x')];
    const state = createQuietState<{ name: string }>();
    noteChange(state, 'webview', 0, [first, second]);
    let woken: boolean | undefined;
    void Effect.runPromise(waitForQuiet(state)).then(
      settled => (woken = settled)
    );

    noteSave(state, other, 0);
    await microtasks();
    expect(woken).toBeUndefined();
    expect(state.awaiting).toEqual(new Set([first, second]));

    noteSave(state, first, 0);
    await microtasks();
    expect(woken).toBeUndefined();

    noteSave(state, second, 0);
    await microtasks();
    expect(woken).toBe(true);
    expect(state.settled).toBeNull();
  });

  it('awaits the views of the newest change when another lands mid-wait, owing it a save of its own', async () => {
    vi.useFakeTimers();
    const [first, second] = [view('first'), view('second')];
    const state = createQuietState<{ name: string }>();
    noteChange(state, 'webview', 0, [first, second]);
    let woken: boolean | undefined;
    void Effect.runPromise(waitForQuiet(state)).then(
      settled => (woken = settled)
    );

    noteSave(state, first, 0);
    noteChange(state, 'webview', 0, [first, second]);
    expect(state.saves).toBe(0);

    noteSave(state, first, 0);
    await microtasks();
    expect(woken).toBeUndefined();

    noteSave(state, second, 0);
    await microtasks();
    expect(woken).toBe(true);
  });

  it('ignores a save sent before its replica could hold the latest peer batch', () => {
    const only = view('only');
    const state = createQuietState<{ name: string }>();
    noteChange(state, 'peer', 1_000, [only]);

    noteSave(state, only, 1_000 + REPLICA_DEBOUNCE_MS - 1);
    expect(state.pending).toBe(true);
    noteSave(state, only, 1_000 + REPLICA_DEBOUNCE_MS);
    expect(state.pending).toBe(false);
  });

  it('keeps the bound of a peer batch through a later relay, which sets none of its own', () => {
    const only = view('only');
    const state = createQuietState<{ name: string }>();
    noteChange(state, 'peer', 1_000, [only]);
    noteChange(state, 'webview', 1_100, [only]);

    noteSave(state, only, 1_150);
    expect(state.pending).toBe(true);
    noteSave(state, only, 1_000 + REPLICA_DEBOUNCE_MS);
    expect(state.pending).toBe(false);

    noteChange(state, 'webview', 5_000, [only]);
    noteSave(state, only, 5_000);
    expect(state.pending).toBe(false);
  });

  it('expects one save even with no ready view, and resolves false at the cap', async () => {
    vi.useFakeTimers();
    const state = createQuietState<{ name: string }>();
    noteChange(state, 'webview', 0, []);
    let woken: boolean | undefined;
    void Effect.runPromise(waitForQuiet(state)).then(
      settled => (woken = settled)
    );

    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS - 1);
    expect(woken).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(woken).toBe(false);
    expect(state.pending).toBe(true);

    noteSave(state, view('late'), 0);
    expect(state.pending).toBe(false);
  });

  it('settles when the view still owing a save closes after the other saved', async () => {
    vi.useFakeTimers();
    const [first, second] = [view('first'), view('second')];
    const state = createQuietState<{ name: string }>();
    noteChange(state, 'webview', 0, [first, second]);
    let woken: boolean | undefined;
    void Effect.runPromise(waitForQuiet(state)).then(
      settled => (woken = settled)
    );

    noteSave(state, second, 0);
    await microtasks();
    expect(woken).toBeUndefined();

    dropRecipient(state, first);
    await microtasks();
    expect(woken).toBe(true);
    expect(state.settled).toBeNull();
    dropRecipient(state, first);
    expect(state.pending).toBe(false);
  });

  it('keeps waiting when every view owing a save closes without one, then takes a later save', async () => {
    vi.useFakeTimers();
    const [first, second] = [view('first'), view('second')];
    const state = createQuietState<{ name: string }>();
    noteChange(state, 'webview', 0, [first, second]);
    let woken: boolean | undefined;
    void Effect.runPromise(waitForQuiet(state)).then(
      settled => (woken = settled)
    );

    dropRecipient(state, first);
    dropRecipient(state, second);
    await microtasks();
    expect(woken).toBeUndefined();
    expect(state.pending).toBe(true);

    noteSave(state, view('reopened'), 0);
    await microtasks();
    expect(woken).toBe(true);
  });
});

describe('filterJoinQueue', () => {
  it('drops what the snapshot holds and what has no version, counting by source and type', () => {
    const { batches, dropped, droppedCount } = filterJoinQueue(
      [
        { source: 'webview', actions: [add(3), add(5), add(6)] },
        {
          source: 'peer',
          actions: [add(undefined, 'table.move'), add(2, 'memo.add')],
        },
        { source: 'webview', actions: [add(undefined, 'table.move')] },
        { source: 'peer', actions: [add(9, 'memo.add')] },
      ],
      5
    );

    expect(batches).toEqual([
      { source: 'webview', actions: [add(6)] },
      { source: 'peer', actions: [add(9, 'memo.add')] },
    ]);
    expect(dropped).toEqual({
      webview: { 'table.add': 2, 'table.move': 1 },
      peer: { 'table.move': 1, 'memo.add': 1 },
    });
    expect(droppedCount).toBe(5);
  });

  it('keeps everything newer than the snapshot', () => {
    expect(filterJoinQueue([{ source: 'peer', actions: [add(1)] }], 0)).toEqual(
      {
        batches: [{ source: 'peer', actions: [add(1)] }],
        dropped: {},
        droppedCount: 0,
      }
    );
  });
});

describe('drainJoinQueue', () => {
  it('filters the captured batches, logs the drop, and hands on the later ones whole', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const later = { source: 'peer' as const, actions: [add(1)] };

    const delivered = drainJoinQueue(
      [
        { source: 'webview', actions: [add(4), add(6)] },
        { source: 'peer', actions: [add(undefined, 'table.move')] },
        later,
      ],
      2,
      5,
      '/ws/a.erd'
    );

    expect(delivered).toEqual([
      { source: 'webview', actions: [add(6)] },
      later,
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'dropped 2 queued actions joining /ws/a.erd: versioned at most 5, or unversioned',
      { webview: { 'table.add': 1 }, peer: { 'table.move': 1 } }
    );
    warn.mockRestore();
  });

  it('logs nothing when the snapshot holds none of the queue', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(
      drainJoinQueue([{ source: 'peer', actions: [add(8)] }], 1, 5, '/ws/a.erd')
    ).toEqual([{ source: 'peer', actions: [add(8)] }]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
