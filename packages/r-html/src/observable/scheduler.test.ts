import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  observable,
  observer,
  observerToTriggers,
  type PropName,
  rawToObservers,
  watch,
} from '@/observable';
import { effect, nextTick, watchEffect } from '@/observable/scheduler';

const flush = () => nextTick(() => {});

describe('scheduler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('nextTick', () => {
    it('defers the callback and resolves after it ran', async () => {
      const calls: string[] = [];
      const promise = nextTick(() => calls.push('fn'));

      expect(calls).toEqual([]);

      await promise;

      expect(calls).toEqual(['fn']);
    });

    it('dedupes the same callback within one tick and shares the promise', async () => {
      let runs = 0;
      const fn = () => {
        runs++;
      };

      const first = nextTick(fn);
      const second = nextTick(fn);

      expect(first).toBe(second);

      await first;

      expect(runs).toBe(1);
    });

    it('queues the same callback again after it has been flushed', async () => {
      let runs = 0;
      const fn = () => {
        runs++;
      };

      const first = nextTick(fn);
      await first;
      const second = nextTick(fn);

      expect(second).not.toBe(first);

      await second;

      expect(runs).toBe(2);
    });

    it('runs the queued callbacks in FIFO order', async () => {
      const order: string[] = [];

      nextTick(() => order.push('a'));
      nextTick(() => order.push('b'));
      await nextTick(() => order.push('c'));

      expect(order).toEqual(['a', 'b', 'c']);
    });

    it('drains callbacks queued while the queue is being flushed', async () => {
      const order: string[] = [];

      await nextTick(() => {
        order.push('outer');
        nextTick(() => order.push('inner'));
      });

      expect(order).toEqual(['outer', 'inner']);
    });

    it('waits for an async callback before resolving', async () => {
      const order: string[] = [];

      await nextTick(async () => {
        order.push('start');
        await Promise.resolve();
        await Promise.resolve();
        order.push('end');
      });

      expect(order).toEqual(['start', 'end']);
    });

    it('swallows a throwing callback and still resolves', async () => {
      const error = new Error('boom');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        nextTick(() => {
          throw error;
        })
      ).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledWith(error);
    });
  });

  describe('effect', () => {
    it('does nothing when the raw has no observers', async () => {
      expect(() => effect({ a: 1 }, 'a')).not.toThrow();
      await flush();
    });

    it('does nothing when the observer has no trigger map', async () => {
      const raw = {};
      let runs = 0;
      const fn = () => {
        runs++;
      };
      rawToObservers.set(raw, new Set([fn]));

      effect(raw, 'a');
      await flush();

      expect(runs).toBe(0);
    });

    it('does nothing when the observer has no trigger for that raw', async () => {
      const raw = {};
      const other = {};
      let runs = 0;
      const fn = () => {
        runs++;
      };
      rawToObservers.set(raw, new Set([fn]));
      observerToTriggers.set(fn, new Map([[other, new Set<PropName>(['a'])]]));

      effect(raw, 'a');
      await flush();

      expect(runs).toBe(0);
    });

    it('does nothing when the prop is not part of the trigger set', async () => {
      const raw = {};
      let runs = 0;
      const fn = () => {
        runs++;
      };
      rawToObservers.set(raw, new Set([fn]));
      observerToTriggers.set(fn, new Map([[raw, new Set<PropName>(['b'])]]));

      effect(raw, 'a');
      await flush();

      expect(runs).toBe(0);
    });

    it('re-runs the observer when the prop is part of the trigger set', async () => {
      const raw = {};
      let runs = 0;
      const fn = () => {
        runs++;
      };
      rawToObservers.set(raw, new Set([fn]));
      observerToTriggers.set(fn, new Map([[raw, new Set<PropName>(['b'])]]));

      effect(raw, 'b');
      await flush();

      expect(runs).toBe(1);

      // the observer task calls unobserve() before re-running, so the
      // registration is consumed
      expect(rawToObservers.get(raw)?.has(fn)).toBe(false);
    });

    it('coalesces repeated effects on the same observer into one re-run', async () => {
      const proxy: any = observable({ a: 1, b: 1 });
      let runs = 0;

      observer(() => {
        runs++;
        void proxy.a;
        void proxy.b;
      });

      expect(runs).toBe(1);

      proxy.a = 2;
      proxy.b = 2;
      await flush();

      expect(runs).toBe(2);
    });
  });

  describe('watchEffect', () => {
    it('does nothing when the raw has no proxy', async () => {
      expect(() => watchEffect({ a: 1 }, 'a')).not.toThrow();
      await flush();
    });

    it('does nothing when the proxy has no subject', async () => {
      const raw = { a: 1 };
      observable(raw);

      expect(() => watchEffect(raw, 'a')).not.toThrow();
      await flush();
    });

    it('batches prop names and emits them once per tick', async () => {
      const raw: any = { a: 1, b: 1 };
      const proxy = observable(raw);
      const seen: PropName[] = [];

      watch(proxy).subscribe(p => seen.push(p));

      watchEffect(raw, 'a');
      watchEffect(raw, 'b');
      watchEffect(raw, 'a');

      expect(seen).toEqual([]);

      await flush();

      expect(seen).toEqual(['a', 'b']);
    });

    it('starts a fresh batch after the previous one has been emitted', async () => {
      const raw: any = { a: 1 };
      const proxy = observable(raw);
      const seen: PropName[] = [];

      watch(proxy).subscribe(p => seen.push(p));

      watchEffect(raw, 'a');
      await flush();
      watchEffect(raw, 'a');
      await flush();

      expect(seen).toEqual(['a', 'a']);
    });

    it('notifies every subscriber of the watched proxy', async () => {
      const raw: any = { a: 1 };
      const proxy = observable(raw);
      const first: PropName[] = [];
      const second: PropName[] = [];
      const subject = watch(proxy);

      subject.subscribe(p => first.push(p));
      subject.subscribe(p => second.push(p));

      watchEffect(raw, 'a');
      await flush();

      expect(first).toEqual(['a']);
      expect(second).toEqual(['a']);
    });
  });
});
