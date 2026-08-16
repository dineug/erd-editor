import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { asap, safeCallback } from '@/fn';

describe('safeCallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('invokes the callback with the given arguments and returns its value', () => {
    const callback = vi.fn((a: number, b: number) => a + b);

    expect(safeCallback(callback, 1, 2)).toBe(3);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, 2);
  });

  it('returns undefined when no callback is given', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(safeCallback(undefined)).toBeUndefined();
    expect(safeCallback()).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
  });

  it('swallows a thrown error and logs it to console.error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('boom');
    const callback = () => {
      throw boom;
    };

    expect(safeCallback(callback)).toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(boom);
  });

  it('does not catch an asynchronous rejection from an async callback', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const callback = async () => {
      throw new Error('async boom');
    };

    const result = safeCallback(callback);

    await expect(result).rejects.toThrow('async boom');
    expect(error).not.toHaveBeenCalled();
  });

  it('forwards falsy return values untouched', () => {
    expect(safeCallback(() => 0)).toBe(0);
    expect(safeCallback(() => null)).toBeNull();
    expect(safeCallback(() => false)).toBe(false);
  });
});

describe('asap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('uses the native queueMicrotask when available', () => {
    expect(asap).toBe(queueMicrotask);
  });

  it('schedules the callback on the microtask queue', async () => {
    const order: string[] = [];

    asap(() => order.push('microtask'));
    order.push('sync');

    await Promise.resolve();
    expect(order).toEqual(['sync', 'microtask']);
  });

  it('falls back to a promise based scheduler when queueMicrotask is missing', async () => {
    vi.stubGlobal('queueMicrotask', undefined);
    vi.resetModules();

    const { asap: fallbackAsap } = await import('@/fn');
    expect(fallbackAsap).not.toBe(queueMicrotask);

    const order: string[] = [];
    fallbackAsap(() => order.push('fallback'));
    order.push('sync');

    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['sync', 'fallback']);
  });
});
