import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CANCEL, cancel } from '@/operators/cancel';
import { delay } from '@/operators/delay';

// setImmediate is provided by the Node test runtime; the DOM/ES2020 libs do not declare it.
declare function setImmediate(callback: () => void): void;

const flushMicrotasks = () =>
  new Promise<void>(resolve => setImmediate(resolve));

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays pending until the given time has elapsed', async () => {
    const onResolved = vi.fn();
    delay(100).then(onResolved);

    await flushMicrotasks();
    expect(onResolved).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    await flushMicrotasks();
    expect(onResolved).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('resolves with undefined', async () => {
    const promise = delay(10);
    vi.advanceTimersByTime(10);

    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves on the next timer tick for a zero delay', async () => {
    const onResolved = vi.fn();
    delay(0).then(onResolved);

    await flushMicrotasks();
    expect(onResolved).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('schedules exactly one timer per call', async () => {
    delay(50);
    delay(50);

    expect(vi.getTimerCount()).toBe(2);

    vi.advanceTimersByTime(50);
    await flushMicrotasks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with CANCEL when the returned promise is canceled', async () => {
    const promise = delay(100);
    cancel(promise);

    await expect(promise).rejects.toBe(CANCEL);
  });

  it('does not resolve after being canceled even when the timer fires', async () => {
    const onResolved = vi.fn();
    const onRejected = vi.fn();
    const promise = delay(100);
    promise.then(onResolved, onRejected);

    cancel(promise);
    await flushMicrotasks();
    expect(onRejected).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    expect(onResolved).not.toHaveBeenCalled();
  });
});
