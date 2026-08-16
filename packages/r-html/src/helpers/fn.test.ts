import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { asap, safeCallback } from '@/helpers/fn';

describe('helpers/fn', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe('safeCallback', () => {
    it('calls the callback with the given arguments and returns its value', () => {
      const callback = vi.fn((a: number, b: number) => a + b);

      expect(safeCallback(callback, 1, 2)).toBe(3);
      expect(callback).toHaveBeenCalledWith(1, 2);
    });

    it('supports a callback without arguments', () => {
      expect(safeCallback(() => 'ok')).toBe('ok');
    });

    it('returns undefined when no callback is given', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(safeCallback()).toBeUndefined();
      expect(safeCallback(undefined as any, 1)).toBeUndefined();
      expect(error).not.toHaveBeenCalled();
    });

    it('swallows a thrown error, logs it and returns undefined', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const thrown = new Error('boom');

      const result = safeCallback(() => {
        throw thrown;
      });

      expect(result).toBeUndefined();
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(thrown);
    });

    it('does not catch rejections from an async callback', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const promise = safeCallback(async () => {
        throw new Error('async boom');
      });

      await expect(promise).rejects.toThrowError('async boom');
      expect(error).not.toHaveBeenCalled();
    });

    it('forwards falsy return values untouched', () => {
      expect(safeCallback(() => 0)).toBe(0);
      expect(safeCallback(() => null)).toBeNull();
      expect(safeCallback(() => false)).toBe(false);
    });
  });

  describe('asap', () => {
    it('is the platform queueMicrotask when available', () => {
      expect(asap).toBe(queueMicrotask);
    });

    it('defers the callback until after the current synchronous block', async () => {
      const calls: string[] = [];

      asap(() => calls.push('microtask'));
      calls.push('sync');

      expect(calls).toEqual(['sync']);

      await Promise.resolve();
      expect(calls).toEqual(['sync', 'microtask']);
    });

    it('runs queued callbacks in order', async () => {
      const calls: number[] = [];

      asap(() => calls.push(1));
      asap(() => calls.push(2));
      asap(() => calls.push(3));

      await Promise.resolve();
      expect(calls).toEqual([1, 2, 3]);
    });

    it('falls back to a promise based microtask when queueMicrotask is unavailable', async () => {
      vi.resetModules();
      vi.stubGlobal('queueMicrotask', undefined);

      const fn = await import('@/helpers/fn');

      expect(fn.asap).not.toBe(queueMicrotask);
      expect(typeof fn.asap).toBe('function');

      const calls: string[] = [];
      fn.asap(() => calls.push('fallback'));
      expect(calls).toEqual([]);

      await Promise.resolve();
      await Promise.resolve();
      expect(calls).toEqual(['fallback']);
    });
  });
});
