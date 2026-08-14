import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  observable,
  observer,
  type PropName,
  rawToObservers,
  rawToProxy,
  unobserve,
  watch,
} from '@/observable';
import { nextTick } from '@/observable/scheduler';

const flush = () => nextTick(() => {});

describe('observable', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('proxy behaviour', () => {
    it('reads and writes through to the raw target', () => {
      const raw = { a: 1, b: 'x' };
      const proxy = observable(raw);

      expect(proxy.a).toBe(1);
      expect(proxy.b).toBe('x');

      proxy.a = 2;

      expect(raw.a).toBe(2);
      expect(proxy.a).toBe(2);
    });

    it('registers the proxy in rawToProxy', () => {
      const raw = { a: 1 };
      const proxy = observable(raw);

      expect(rawToProxy.get(raw)).toBe(proxy);
    });

    it('wraps nested objects lazily and caches the nested proxy', () => {
      const nested = { b: 1 };
      const proxy = observable({ nested });

      expect(rawToProxy.has(nested)).toBe(false);

      const first = proxy.nested;

      expect(first).not.toBe(nested);
      expect(rawToProxy.get(nested)).toBe(first);
      expect(proxy.nested).toBe(first);
    });

    it('wraps nested arrays', () => {
      const proxy = observable({ list: [{ a: 1 }] });

      expect(proxy.list).not.toBe(undefined);
      expect(proxy.list[0].a).toBe(1);
      expect(rawToProxy.has(proxy.list[0])).toBe(false);
    });

    it('does not double wrap a value that is already a proxy', () => {
      const inner = observable({ v: 1 });
      const outer = observable({ inner });

      expect(outer.inner).toBe(inner);
    });

    it('returns raw nested values when shallow is true', () => {
      const nested = { b: 1 };
      const proxy = observable({ nested }, { shallow: true });

      expect(proxy.nested).toBe(nested);
      expect(rawToProxy.has(nested)).toBe(false);
    });

    it('deletes properties through the deleteProperty trap', () => {
      const raw: any = { a: 1 };
      const proxy = observable(raw);

      expect(delete proxy.a).toBe(true);
      expect('a' in raw).toBe(false);
    });
  });

  describe('excluded values', () => {
    it.each([
      ['Node', () => document.createElement('div')],
      ['Map', () => new Map([['a', 1]])],
      ['Set', () => new Set([1])],
      ['WeakMap', () => new WeakMap()],
      ['WeakSet', () => new WeakSet()],
      ['RegExp', () => /abc/],
      ['Date', () => new Date(0)],
      ['Promise', () => Promise.resolve(1)],
      ['frozen object', () => Object.freeze({ a: 1 })],
      ['frozen array', () => Object.freeze([1, 2])],
    ])('returns %s values untouched', (_name, factory) => {
      const value = factory();
      const proxy = observable({ value });

      expect(proxy.value).toBe(value);
    });

    it('does not track excluded values as dependencies', async () => {
      const frozen = Object.freeze({ a: 1 });
      const raw: any = { frozen };
      const proxy = observable(raw);
      let runs = 0;

      observer(() => {
        runs++;
        void proxy.frozen;
      });

      expect(runs).toBe(1);
      expect(rawToObservers.has(raw)).toBe(false);

      proxy.frozen = Object.freeze({ a: 2 });
      await flush();

      expect(runs).toBe(1);
    });
  });

  describe('observer', () => {
    it('runs the callback immediately and re-runs it when a tracked prop changes', async () => {
      const proxy = observable({ a: 1 });
      const seen: number[] = [];

      observer(() => {
        seen.push(proxy.a);
      });

      expect(seen).toEqual([1]);

      proxy.a = 2;
      await flush();

      expect(seen).toEqual([1, 2]);
    });

    it('tracks symbol props', async () => {
      const key = Symbol('key');
      const proxy: any = observable({ [key]: 1 });
      const seen: number[] = [];

      observer(() => {
        seen.push(proxy[key]);
      });

      proxy[key] = 2;
      await flush();

      expect(seen).toEqual([1, 2]);
    });

    it('does not re-run when an untracked prop changes', async () => {
      const proxy: any = observable({ a: 1, b: 1 });
      let runs = 0;

      observer(() => {
        runs++;
        void proxy.a;
      });

      proxy.b = 2;
      await flush();

      expect(runs).toBe(1);
    });

    it('does not re-run when the value is unchanged', async () => {
      const proxy = observable({ a: 1 });
      let runs = 0;

      observer(() => {
        runs++;
        void proxy.a;
      });

      proxy.a = 1;
      await flush();

      expect(runs).toBe(1);
    });

    it('re-runs every observer registered on the same raw', async () => {
      const proxy = observable({ a: 1 });
      let first = 0;
      let second = 0;

      observer(() => {
        first++;
        void proxy.a;
      });
      observer(() => {
        second++;
        void proxy.a;
      });

      proxy.a = 2;
      await flush();

      expect(first).toBe(2);
      expect(second).toBe(2);
    });

    it('tracks several props of the same raw and re-reading a prop is idempotent', async () => {
      const proxy: any = observable({ a: 1, b: 10 });
      const seen: number[] = [];

      observer(() => {
        seen.push(proxy.a + proxy.a + proxy.b);
      });

      expect(seen).toEqual([12]);

      proxy.b = 20;
      await flush();

      expect(seen).toEqual([12, 22]);

      proxy.a = 2;
      await flush();

      expect(seen).toEqual([12, 22, 24]);
    });

    it('tracks nested proxies', async () => {
      const proxy = observable({ nested: { b: 1 } });
      const seen: number[] = [];

      observer(() => {
        seen.push(proxy.nested.b);
      });

      proxy.nested.b = 2;
      await flush();

      expect(seen).toEqual([1, 2]);
    });

    it('re-runs on delete', async () => {
      const proxy: any = observable({ a: 1 });
      const seen: any[] = [];

      observer(() => {
        seen.push(proxy.a);
      });

      delete proxy.a;
      await flush();

      expect(seen).toEqual([1, undefined]);
    });

    it('stops tracking after the returned unsubscribe is called', async () => {
      const proxy = observable({ a: 1 });
      let runs = 0;

      const unsubscribe = observer(() => {
        runs++;
        void proxy.a;
      });

      unsubscribe();
      proxy.a = 2;
      await flush();

      expect(runs).toBe(1);
    });

    it('swallows errors thrown by the observer and logs them', () => {
      const error = new Error('boom');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() =>
        observer(() => {
          throw error;
        })
      ).not.toThrow();
      expect(spy).toHaveBeenCalledWith(error);
    });

    it('does not track reads made outside of an observer', async () => {
      const raw = { a: 1 };
      const proxy = observable(raw);

      void proxy.a;

      expect(rawToObservers.has(raw)).toBe(false);
    });
  });

  describe('unobserve', () => {
    it('removes the observer from every raw it depends on', async () => {
      const rawA = { a: 1 };
      const rawB = { b: 1 };
      const proxyA = observable(rawA);
      const proxyB = observable(rawB);
      let runs = 0;

      const fn = () => {
        runs++;
        void proxyA.a;
        void proxyB.b;
      };
      observer(fn);

      expect(rawToObservers.get(rawA)?.has(fn)).toBe(true);
      expect(rawToObservers.get(rawB)?.has(fn)).toBe(true);

      unobserve(fn);

      expect(rawToObservers.get(rawA)?.has(fn)).toBe(false);
      expect(rawToObservers.get(rawB)?.has(fn)).toBe(false);

      proxyA.a = 2;
      proxyB.b = 2;
      await flush();

      expect(runs).toBe(1);
    });

    it('is a no-op for an observer that never tracked anything', () => {
      expect(() => unobserve(() => {})).not.toThrow();
    });
  });

  describe('array targets', () => {
    it('does not notify on a direct index assignment but does on length changes', async () => {
      const proxy = observable([1, 2, 3]);
      let runs = 0;

      observer(() => {
        runs++;
        void proxy.length;
        void proxy[0];
      });

      expect(runs).toBe(1);

      // NOTE: actual implementation behaviour - index writes on arrays are not
      // notified because `isEffect` only honours `p === 'length'` for arrays.
      proxy[0] = 99;
      await flush();

      expect(proxy[0]).toBe(99);
      expect(runs).toBe(1);

      proxy.push(4);
      await flush();

      expect(runs).toBe(2);
      expect(proxy.length).toBe(4);
    });
  });

  describe('length prop on a plain object', () => {
    it('notifies even when the value does not change', async () => {
      const proxy = observable({ length: 0 });
      let runs = 0;

      observer(() => {
        runs++;
        void proxy.length;
      });

      proxy.length = 0;
      await flush();

      expect(runs).toBe(2);
    });
  });

  describe('watch', () => {
    it('returns a readonly subject that only exposes subscribe', () => {
      const proxy = observable({ a: 1 });
      const subject: any = watch(proxy);

      expect(Object.keys(subject)).toEqual(['subscribe']);
    });

    it('emits the changed prop names in a single batch', async () => {
      const proxy: any = observable({ a: 1, b: 1 });
      const seen: PropName[] = [];

      watch(proxy).subscribe(p => seen.push(p));

      proxy.a = 2;
      proxy.b = 2;
      proxy.a = 3;
      await flush();

      expect(seen).toEqual(['a', 'b']);
    });

    it('emits again on the next batch', async () => {
      const proxy: any = observable({ a: 1 });
      const seen: PropName[] = [];

      watch(proxy).subscribe(p => seen.push(p));

      proxy.a = 2;
      await flush();
      proxy.a = 3;
      await flush();

      expect(seen).toEqual(['a', 'a']);
    });

    it('emits on delete', async () => {
      const proxy: any = observable({ a: 1 });
      const seen: PropName[] = [];

      watch(proxy).subscribe(p => seen.push(p));

      delete proxy.a;
      await flush();

      expect(seen).toEqual(['a']);
    });

    it('reuses the same subject for repeated watch calls', async () => {
      const proxy: any = observable({ a: 1 });
      const first: PropName[] = [];
      const second: PropName[] = [];

      watch(proxy).subscribe(p => first.push(p));
      watch(proxy).subscribe(p => second.push(p));

      proxy.a = 2;
      await flush();

      expect(first).toEqual(['a']);
      expect(second).toEqual(['a']);
    });

    it('stops emitting after unsubscribe', async () => {
      const proxy: any = observable({ a: 1 });
      const seen: PropName[] = [];

      const unsubscribe = watch(proxy).subscribe(p => seen.push(p));

      proxy.a = 2;
      await flush();
      unsubscribe();
      proxy.a = 3;
      await flush();

      expect(seen).toEqual(['a']);
    });

    it('emits length for array pushes', async () => {
      const proxy = observable([1]);
      const seen: PropName[] = [];

      watch(proxy).subscribe(p => seen.push(p));

      proxy.push(2);
      await flush();

      expect(seen).toEqual(['length']);
    });
  });
});
