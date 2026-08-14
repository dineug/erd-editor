import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { race } from '@/operators/race';

// setImmediate is provided by the Node test runtime; the DOM/ES2020 libs do not declare it.
declare function setImmediate(callback: () => void): void;

describe('race', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves synchronously with the first non promise entry', async () => {
    await expect(race({ a: 1, b: 2 })).resolves.toEqual({ a: 1 });
  });

  it('wraps falsy values without treating them as pending', async () => {
    await expect(race({ a: null, b: 'later' })).resolves.toEqual({ a: null });
  });

  it('lets a plain value win over a pending promise declared first', async () => {
    const pending = new Promise(() => {});

    await expect(race({ pending, now: 'x' })).resolves.toEqual({ now: 'x' });
  });

  it('resolves with the fastest promise keyed by its record key', async () => {
    const slow = new Promise(resolve => setTimeout(() => resolve('slow'), 50));
    const fast = new Promise(resolve => setTimeout(() => resolve('fast'), 10));
    const promise = race({ slow, fast });

    vi.advanceTimersByTime(10);

    await expect(promise).resolves.toEqual({ fast: 'fast' });
  });

  it('ignores every settlement after the first one', async () => {
    const first = new Promise(resolve => setTimeout(() => resolve(1), 10));
    const second = new Promise(resolve => setTimeout(() => resolve(2), 20));
    const onResolved = vi.fn();

    race({ first, second }).then(onResolved);

    vi.advanceTimersByTime(50);
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith({ first: 1 });
  });

  it('supports thenables that are not real promises', async () => {
    const thenable = {
      then: (resolve: (value: string) => void) => {
        setTimeout(() => resolve('thenable'), 5);
      },
    };
    const promise = race({ thenable, pending: new Promise(() => {}) });

    vi.advanceTimersByTime(5);

    await expect(promise).resolves.toEqual({ thenable: 'thenable' });
  });

  it('rejects when a real promise rejects first', async () => {
    const error = new Error('boom');
    const promise = race({
      failing: Promise.reject(error),
      pending: new Promise(() => {}),
    });

    await expect(promise).rejects.toBe(error);
  });

  it('is not rejected by a late rejection once it has resolved', async () => {
    const winner = new Promise(resolve => setTimeout(() => resolve('win'), 10));
    const loser = new Promise((__resolve, reject) =>
      setTimeout(() => reject(new Error('late')), 20)
    );
    const promise = race({ winner, loser });

    vi.advanceTimersByTime(50);

    await expect(promise).resolves.toEqual({ winner: 'win' });
  });

  it('never settles for an empty record', async () => {
    const promise = race({});

    await expect(
      Promise.race([promise, Promise.resolve('pending')])
    ).resolves.toBe('pending');
  });
});
