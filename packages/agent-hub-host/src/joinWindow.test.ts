import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  actionVersion,
  createQuietState,
  dropRecipient,
  filterJoinQueue,
  JOIN_QUIET_CAP_MS,
  maxVersion,
  noteChange,
  noteSave,
  REPLICA_DEBOUNCE_MS,
  waitForQuiet,
} from '@/joinWindow';

/** A view double: the quiet state reads nothing of one but its identity. */
const view = (name: string) => ({ name });

/** Lets a settled Deferred wake the effect awaiting it. */
async function microtasks(): Promise<void> {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

// The action, filter and drain tables are vectors of __fixtures__/conformance.json;
// NaN, which JSON cannot hold, stays here, and so do the versions past 2^31
// below, which pin no rule the hubs do not share, only this one's arithmetic.
describe('action fields', () => {
  it('reads NaN as no version', () => {
    expect(actionVersion({ version: Number.NaN })).toBeUndefined();
  });
});

// An editor stamps its counter times 2^22 plus a slot of its own, so a version
// outgrows a 32-bit integer after 512 counters; the rules compare it as any
// other number, up to the last safe integer.
describe('versions past 2^31', () => {
  const SLOT_BASE = 2 ** 22;
  const at = (counter: number, slot: number) => counter * SLOT_BASE + slot;
  const snapshotVersion = at(600, 17);

  it('keeps what was stamped after the snapshot and drops what it holds', () => {
    const queue = [
      {
        source: 'webview' as const,
        actions: [
          { type: 'table.add', payload: {}, version: snapshotVersion },
          { type: 'table.add', payload: {}, version: at(600, 16) },
          { type: 'table.add', payload: {}, version: at(601, 5) },
        ],
      },
      {
        source: 'peer' as const,
        actions: [
          { type: 'memo.add', payload: {}, version: at(600, 18) },
          {
            type: 'memo.add',
            payload: {},
            version: at(2 ** 31 - 1, SLOT_BASE - 1),
          },
        ],
      },
    ];

    expect(snapshotVersion).toBeGreaterThan(2 ** 31);
    expect(at(2 ** 31 - 1, SLOT_BASE - 1)).toBe(Number.MAX_SAFE_INTEGER);
    expect(filterJoinQueue(queue, snapshotVersion)).toEqual({
      batches: [
        {
          source: 'webview',
          actions: [{ type: 'table.add', payload: {}, version: at(601, 5) }],
        },
        {
          source: 'peer',
          actions: [
            { type: 'memo.add', payload: {}, version: at(600, 18) },
            {
              type: 'memo.add',
              payload: {},
              version: Number.MAX_SAFE_INTEGER,
            },
          ],
        },
      ],
      dropped: { webview: { 'table.add': 2 } },
      droppedCount: 2,
    });
  });

  it('reads and takes the highest of such versions as a snapshot would', () => {
    const actions = [
      { type: 'table.add', version: at(601, 5) },
      { type: 'memo.add', version: at(900, 0) },
    ];

    expect(actionVersion(actions[1])).toBe(at(900, 0));
    expect(maxVersion(snapshotVersion, actions)).toBe(at(900, 0));
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
