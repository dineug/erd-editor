import { describe, expect, it, vi } from 'vitest';

import { closePromise } from '@/utils/promise';

describe('closePromise', () => {
  it('returns a pending promise and a resolver', async () => {
    const [promise, close] = closePromise();

    expect(promise).toBeInstanceOf(Promise);
    expect(typeof close).toBe('function');

    const onResolved = vi.fn();
    promise.then(onResolved);

    await Promise.resolve();
    expect(onResolved).not.toHaveBeenCalled();

    close();
    await promise;
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith(undefined);
  });

  it('resolves with undefined', async () => {
    const [promise, close] = closePromise();
    close();

    await expect(promise).resolves.toBeUndefined();
  });

  it('is idempotent when the resolver is called more than once', async () => {
    const [promise, close] = closePromise();

    close();
    close();
    close();

    await expect(promise).resolves.toBeUndefined();
  });

  it('creates an independent promise per call', async () => {
    const [promiseA, closeA] = closePromise();
    const [promiseB, closeB] = closePromise();

    expect(promiseA).not.toBe(promiseB);

    const bResolved = vi.fn();
    promiseB.then(bResolved);

    closeA();
    await promiseA;
    expect(bResolved).not.toHaveBeenCalled();

    closeB();
    await promiseB;
    expect(bResolved).toHaveBeenCalledTimes(1);
  });

  it('starts with a no-op callback that is safe to call before the executor runs', () => {
    // The Promise executor normally runs synchronously, so the initial no-op is
    // never observable. Swap in a constructor that defers it to reach that state.
    const NativePromise = globalThis.Promise;
    let executor: ((resolve: () => void) => void) | undefined;

    function DeferredPromise(this: any, fn: (resolve: () => void) => void) {
      executor = fn;
    }

    globalThis.Promise = DeferredPromise as any;
    let close: () => void;
    try {
      [, close] = closePromise();
    } finally {
      globalThis.Promise = NativePromise;
    }

    expect(typeof executor).toBe('function');
    // The executor never ran, so `close` still points at the no-op.
    expect(close!()).toBeUndefined();

    const resolve = vi.fn();
    executor!(resolve);
    expect(resolve).not.toHaveBeenCalled();

    close!();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('can gate an await until the close callback fires', async () => {
    const [promise, close] = closePromise();
    const order: string[] = [];

    const task = (async () => {
      await promise;
      order.push('after');
    })();

    order.push('before');
    close();
    await task;

    expect(order).toEqual(['before', 'after']);
  });
});
