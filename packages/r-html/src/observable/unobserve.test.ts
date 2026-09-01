// The teardown half of the observer contract, kept here rather than in
// index.test.ts because it is one claim: a task already in the queue leaves
// with the observer that queued it, and nothing awaiting that tick hangs.

import { describe, expect, it } from 'vite-plus/test';

import { observable, observer, rawToObservers, unobserve } from '@/observable';
import { cancelTask, nextTick } from '@/observable/scheduler';

const flush = () => nextTick(() => {});

describe('unobserve cancels the task its observer had queued', () => {
  it('never runs the observer a write queued before the unsubscribe', async () => {
    const state = observable({ value: 0 });
    const seen: number[] = [];
    const unsubscribe = observer(() => {
      seen.push(state.value);
    });

    expect(seen).toEqual([0]);

    state.value = 1;
    unsubscribe();
    await flush();

    expect(seen).toEqual([0]);
  });

  it('leaves nothing subscribed where that task would have re-registered it', async () => {
    const raw = { value: 0 };
    const state = observable(raw);
    let runs = 0;
    const unsubscribe = observer(() => {
      state.value;
      runs += 1;
    });

    state.value = 1;
    unsubscribe();
    await flush();

    // A task that ran here would re-run the observer through the tracking
    // path, putting it back in the set the next write reads.
    expect(rawToObservers.get(raw)?.size ?? 0).toBe(0);

    state.value = 2;
    await flush();

    expect(runs).toBe(1);
  });

  it('drops only the observer named, leaving a sibling on the same value', async () => {
    const state = observable({ value: 0 });
    const dropped: number[] = [];
    const kept: number[] = [];
    const unsubscribe = observer(() => {
      dropped.push(state.value);
    });
    observer(() => {
      kept.push(state.value);
    });

    state.value = 1;
    unsubscribe();
    await flush();

    expect(dropped).toEqual([0]);
    expect(kept).toEqual([0, 1]);
  });

  it('takes the unobserve export as well as the unsubscribe it returns', async () => {
    const state = observable({ value: 0 });
    const seen: number[] = [];
    const render = () => {
      seen.push(state.value);
    };

    observer(render);
    state.value = 1;
    unobserve(render);
    await flush();

    expect(seen).toEqual([0]);
  });

  it('lets an observer queue again once it is observed afresh', async () => {
    const state = observable({ value: 0 });
    const seen: number[] = [];
    const render = () => {
      seen.push(state.value);
    };

    const unsubscribe = observer(render);
    state.value = 1;
    unsubscribe();
    await flush();

    observer(render);
    state.value = 2;
    await flush();

    expect(seen).toEqual([0, 1, 2]);
  });
});

describe('cancelTask', () => {
  it('settles the promise the cancelled task had already handed out', async () => {
    let ran = false;
    const promise = nextTick(() => {
      ran = true;
    });

    cancelTask(() => {});
    await flush();
    expect(ran).toBe(true);

    let second = false;
    const fn = () => {
      second = true;
    };
    const pending = nextTick(fn);
    cancelTask(fn);
    await pending;

    expect(second).toBe(false);
    await promise;
  });

  it('leaves the tasks queued either side of it running in order', async () => {
    const order: string[] = [];
    const cancelled = () => order.push('cancelled');

    nextTick(() => order.push('first'));
    nextTick(cancelled);
    const last = nextTick(() => order.push('last'));

    cancelTask(cancelled);
    await last;

    expect(order).toEqual(['first', 'last']);
  });

  it('does nothing for a function that has no task queued', async () => {
    const order: string[] = [];
    const never = () => order.push('never');

    cancelTask(never);
    const queued = nextTick(() => order.push('queued'));
    cancelTask(never);
    await queued;

    expect(order).toEqual(['queued']);
  });
});
