import { describe, expect, it, vi } from 'vitest';

import { go } from '@/go';
import { CANCEL, cancel, KILL, kill } from '@/operators';

describe('go', () => {
  describe('plain callbacks', () => {
    it('resolves with the raw return value when the callback is not iterable', async () => {
      await expect(go(() => 42)).resolves.toBe(42);
    });

    it('forwards the extra arguments to the callback', async () => {
      const callback = vi.fn((a: number, b: number) => a + b);

      await expect(go(callback, 1, 2)).resolves.toBe(3);
      expect(callback).toHaveBeenCalledWith(1, 2);
    });

    it('resolves with null because null is not promise-like nor iterable', async () => {
      await expect(go(() => null)).resolves.toBeNull();
    });

    it('rejects when the callback throws synchronously', async () => {
      await expect(
        go(() => {
          throw new Error('sync boom');
        })
      ).rejects.toThrow('sync boom');
    });
  });

  describe('promise callbacks', () => {
    it('awaits a returned promise', async () => {
      await expect(go(async () => 'async value')).resolves.toBe('async value');
    });

    it('awaits a returned thenable', async () => {
      const thenable = {
        then: (resolve: (value: string) => void) => resolve('thenable'),
      };

      await expect(go(() => thenable)).resolves.toBe('thenable');
    });

    it('rejects when the returned promise rejects', async () => {
      await expect(go(() => Promise.reject(new Error('nope')))).rejects.toThrow(
        'nope'
      );
    });
  });

  describe('generator callbacks', () => {
    it('resolves yielded promises and returns the generator return value', async () => {
      const result = await go(function* (): Generator<any, number, any> {
        const a = yield Promise.resolve(1);
        const b = yield Promise.resolve(2);
        return a + b;
      });

      expect(result).toBe(3);
    });

    it('resolves a yielded function by running it through go', async () => {
      const result = await go(function* (): Generator<any, number, any> {
        const value = yield () => 5;
        return value;
      });

      expect(result).toBe(5);
    });

    it('resolves a yielded generator function by running it through go', async () => {
      const result = await go(function* (): Generator<any, number, any> {
        const value = yield function* (): Generator<any, number, any> {
          const inner = yield Promise.resolve(3);
          return inner * 3;
        };
        return value;
      });

      expect(result).toBe(9);
    });

    it('resolves a yielded iterator instance', async () => {
      function* inner(): Generator<any, number, any> {
        const value = yield Promise.resolve(10);
        return value * 2;
      }

      const result = await go(function* (): Generator<any, number, any> {
        const value = yield inner();
        return value;
      });

      expect(result).toBe(20);
    });

    it('resolves a yielded array with Promise.all semantics', async () => {
      const result = await go(function* (): Generator<any, Array<number>, any> {
        const values = yield [1, Promise.resolve(2), 3];
        return values;
      });

      expect(result).toEqual([1, 2, 3]);
    });

    it('resolves a yielded non-operator value to undefined', async () => {
      const result = await go(function* (): Generator<any, unknown, any> {
        const value = yield 42;
        return value;
      });

      expect(result).toBeUndefined();
    });

    it('returns undefined when the generator has no return statement', async () => {
      const result = await go(function* () {
        yield Promise.resolve(1);
      });

      expect(result).toBeUndefined();
    });

    it('rejects when the generator throws before yielding', async () => {
      await expect(
        go(function* () {
          if (Date.now() >= 0) {
            throw new Error('generator boom');
          }
          yield Promise.resolve(1);
        })
      ).rejects.toThrow('generator boom');
    });
  });

  describe('async generator callbacks', () => {
    it('runs an async generator to completion', async () => {
      const result = await go(async function* (): AsyncGenerator<
        any,
        number,
        any
      > {
        const value = yield () => 5;
        return (value as number) + 1;
      });

      expect(result).toBe(6);
    });
  });

  describe('error propagation', () => {
    it('throws the rejection back into the generator so it can recover', async () => {
      const result = await go(function* () {
        try {
          yield Promise.reject(new Error('bad'));
        } catch (error) {
          return `caught:${(error as Error).message}`;
        }
        return 'not reached';
      });

      expect(result).toBe('caught:bad');
    });

    it('rejects when the generator does not catch the injected error', async () => {
      await expect(
        go(function* () {
          yield Promise.reject(new Error('boom'));
        })
      ).rejects.toThrow('boom');
    });

    it('retries the same step when a non-generator iterator fails', async () => {
      const attempt = vi.fn(() => {
        if (attempt.mock.calls.length === 1) {
          throw new Error('first attempt');
        }
        return 'ok';
      });

      const iterator = {
        step: 0,
        next(value?: any) {
          if (this.step === 0) {
            this.step = 1;
            return { done: false, value: attempt };
          }
          return { done: true, value };
        },
      };

      await expect(go(() => iterator as any)).resolves.toBe('ok');
      expect(attempt).toHaveBeenCalledTimes(2);
    });
  });

  describe('kill', () => {
    it('rejects with KILL instead of resuming the generator', async () => {
      await expect(
        go(function* () {
          yield kill();
        })
      ).rejects.toBe(KILL);
    });

    it('cannot be caught inside the generator', async () => {
      const onCatch = vi.fn();

      await expect(
        go(function* () {
          try {
            yield kill();
          } catch (error) {
            onCatch(error);
          }
          return 'survived';
        })
      ).rejects.toBe(KILL);
      expect(onCatch).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('rejects the task with CANCEL', async () => {
      const task = go(function* () {
        yield new Promise(() => {});
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      cancel(task);

      await expect(task).rejects.toBe(CANCEL);
    });

    it('cancels the in-flight child task as well', async () => {
      const child = go(function* () {
        yield new Promise(() => {});
      });
      const parent = go(function* () {
        yield child;
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      cancel(parent);

      await expect(parent).rejects.toBe(CANCEL);
      await expect(child).rejects.toBe(CANCEL);
    });

    it('stops iterating once the pending step settles after cancellation', async () => {
      const steps: Array<string> = [];
      const task = go(function* () {
        yield new Promise(resolve => setTimeout(resolve, 5));
        steps.push('first');
        yield new Promise(resolve => setTimeout(resolve, 5));
        steps.push('second');
        return 'done';
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      cancel(task);

      await expect(task).rejects.toBe(CANCEL);
      await new Promise(resolve => setTimeout(resolve, 40));
      expect(steps).toEqual(['first']);
    });

    it('rejects with CANCEL when a yielded task is cancelled', async () => {
      const child = go(function* () {
        yield new Promise(() => {});
      });
      const parent = go(function* () {
        yield child;
        return 'done';
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      cancel(child);

      await expect(parent).rejects.toBe(CANCEL);
    });
  });
});
