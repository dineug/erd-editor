import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { channel } from '@/channel';
import { debounce } from '@/operators/debounce';

// setImmediate is provided by the Node test runtime; the DOM/ES2020 libs do not declare it.
declare function setImmediate(callback: () => void): void;

const flushMicrotasks = () =>
  new Promise<void>(resolve => setImmediate(resolve));

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call the callback before the wait time elapses', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    debounce(ch, callback, 100);
    await flushMicrotasks();

    ch.put(1);
    await flushMicrotasks();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    await flushMicrotasks();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1);
  });

  it('emits only the last value of a burst', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    debounce(ch, callback, 100);
    await flushMicrotasks();

    ch.put(1);
    await flushMicrotasks();
    vi.advanceTimersByTime(50);

    ch.put(2);
    await flushMicrotasks();
    vi.advanceTimersByTime(50);
    expect(callback).not.toHaveBeenCalled();

    ch.put(3);
    await flushMicrotasks();
    vi.advanceTimersByTime(100);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(3);
  });

  it('emits once per settled window', async () => {
    const ch = channel<string>();
    const callback = vi.fn();
    debounce(ch, callback, 10);
    await flushMicrotasks();

    ch.put('a');
    await flushMicrotasks();
    vi.advanceTimersByTime(10);
    await flushMicrotasks();

    ch.put('b');
    await flushMicrotasks();
    vi.advanceTimersByTime(10);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'a');
    expect(callback).toHaveBeenNthCalledWith(2, 'b');
  });

  it('keeps only one pending timer while values keep arriving', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    debounce(ch, callback, 100);
    await flushMicrotasks();

    ch.put(1);
    ch.put(2);
    ch.put(3);
    await flushMicrotasks();

    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(3);
  });

  it('drains values that were buffered before the loop started', async () => {
    const ch = channel<number>();
    const callback = vi.fn();

    ch.put(10);
    debounce(ch, callback, 20);
    await flushMicrotasks();

    vi.advanceTimersByTime(20);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(10);
  });

  it('supports async callbacks', async () => {
    const ch = channel<number>();
    const seen: Array<number> = [];
    const callback = vi.fn(async (value: number) => {
      seen.push(value);
    });
    debounce(ch, callback, 5);
    await flushMicrotasks();

    ch.put(7);
    await flushMicrotasks();
    vi.advanceTimersByTime(5);
    await flushMicrotasks();

    expect(seen).toEqual([7]);
  });
});
