import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  actionVersion,
  createQuietState,
  dropRecipient,
  JOIN_QUIET_CAP_MS,
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
// NaN, which JSON cannot hold, stays here.
describe('action fields', () => {
  it('reads NaN as no version', () => {
    expect(actionVersion({ version: Number.NaN })).toBeUndefined();
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
