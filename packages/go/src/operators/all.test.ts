import { afterEach, describe, expect, it, vi } from 'vitest';

import { all } from '@/operators/all';

describe('all', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves an empty array', async () => {
    await expect(all([])).resolves.toEqual([]);
  });

  it('passes plain values through untouched', async () => {
    await expect(all([1, 'a', true, null, undefined])).resolves.toEqual([
      1,
      'a',
      true,
      null,
      undefined,
    ]);
  });

  it('awaits promises and keeps the positional order', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const slow = new Promise(resolve => setTimeout(() => resolve('slow'), 20));
    const promise = all([slow, Promise.resolve('fast'), 'sync']);

    vi.advanceTimersByTime(20);

    await expect(promise).resolves.toEqual(['slow', 'fast', 'sync']);
  });

  it('unwraps thenables', async () => {
    const thenable = {
      then: (resolve: (value: string) => void) => resolve('thenable'),
    };

    await expect(all([thenable])).resolves.toEqual(['thenable']);
  });

  it('runs iterators/generators and resolves with their return value', async () => {
    function* gen(): Generator<any, string, any> {
      const value = yield Promise.resolve(1);
      return `gen:${value}`;
    }

    await expect(all([gen(), Promise.resolve(2)])).resolves.toEqual([
      'gen:1',
      2,
    ]);
  });

  it('does not invoke plain functions, it yields them as values', async () => {
    const fn = vi.fn();

    const [result] = await all([fn]);

    expect(result).toBe(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects with the first rejection reason', async () => {
    const error = new Error('boom');

    await expect(all([Promise.resolve(1), Promise.reject(error)])).rejects.toBe(
      error
    );
  });

  it('rejects when every entry rejects', async () => {
    const first = new Error('first');

    await expect(
      all([Promise.reject(first), Promise.reject(new Error('second'))])
    ).rejects.toBe(first);
  });

  it('resolves nested arrays as plain values', async () => {
    await expect(all([[1, 2], [3]])).resolves.toEqual([[1, 2], [3]]);
  });
});
