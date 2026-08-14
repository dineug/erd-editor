import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { channel } from '@/channel';
import { throttle } from '@/operators/throttle';

// setImmediate is provided by the Node test runtime; the DOM/ES2020 libs do not declare it.
declare function setImmediate(callback: () => void): void;

const flushMicrotasks = () =>
  new Promise<void>(resolve => setImmediate(resolve));

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the callback on the leading edge by default', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    throttle(ch, callback, 100);
    await flushMicrotasks();

    ch.put(1);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1);
  });

  it('drops values received inside the window and skips the trailing edge by default', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    throttle(ch, callback, 100);
    await flushMicrotasks();

    ch.put(1);
    await flushMicrotasks();
    ch.put(2);
    ch.put(3);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(1);

    ch.put(4);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(4);
  });

  it('keeps throttling until the window has fully elapsed', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    throttle(ch, callback, 100);
    await flushMicrotasks();

    ch.put(1);
    await flushMicrotasks();

    vi.advanceTimersByTime(99);
    ch.put(2);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await flushMicrotasks();
    ch.put(3);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(3);
  });

  it('emits the last value on the trailing edge when leading is disabled', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    throttle(ch, callback, 100, { leading: false, trailing: true });
    await flushMicrotasks();

    ch.put(1);
    await flushMicrotasks();
    expect(callback).not.toHaveBeenCalled();

    ch.put(2);
    await flushMicrotasks();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);

    ch.put(3);
    await flushMicrotasks();
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(3);
  });

  it('emits both edges when leading and trailing values differ', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    throttle(ch, callback, 100, { leading: true, trailing: true });
    await flushMicrotasks();

    ch.put(1);
    await flushMicrotasks();
    ch.put(2);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 1);
    expect(callback).toHaveBeenNthCalledWith(2, 2);
  });

  it('skips the trailing edge when it would repeat the leading value', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    throttle(ch, callback, 100, { leading: true, trailing: true });
    await flushMicrotasks();

    ch.put(1);
    await flushMicrotasks();

    vi.advanceTimersByTime(100);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1);
  });

  it('never calls the callback when both edges are disabled', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    throttle(ch, callback, 100, { leading: false, trailing: false });
    await flushMicrotasks();

    ch.put(1);
    ch.put(2);
    await flushMicrotasks();
    vi.advanceTimersByTime(100);
    await flushMicrotasks();

    ch.put(3);
    await flushMicrotasks();
    vi.advanceTimersByTime(100);
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });

  it('starts a new window after the previous one has been reset', async () => {
    const ch = channel<number>();
    const callback = vi.fn();
    throttle(ch, callback, 50);
    await flushMicrotasks();

    for (const value of [1, 2, 3]) {
      ch.put(value);
      await flushMicrotasks();
      vi.advanceTimersByTime(50);
      await flushMicrotasks();
    }

    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenNthCalledWith(1, 1);
    expect(callback).toHaveBeenNthCalledWith(2, 2);
    expect(callback).toHaveBeenNthCalledWith(3, 3);
  });
});
