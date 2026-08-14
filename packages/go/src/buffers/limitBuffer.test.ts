import { describe, expect, it } from 'vitest';

import { LimitBuffer } from '@/buffers/limitBuffer';

const drain = <T>(buffer: LimitBuffer<T>): Array<T> => {
  const values: Array<T> = [];
  while (!buffer.isEmpty()) {
    values.push(buffer.take() as T);
  }
  return values;
};

describe('LimitBuffer', () => {
  describe('unbounded (default config)', () => {
    it('starts empty', () => {
      const buffer = new LimitBuffer<number>();
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.take()).toBeUndefined();
    });

    it('is FIFO and keeps every value when limit is -1', () => {
      const buffer = new LimitBuffer<number>();
      buffer.put(1);
      buffer.put(2);
      buffer.put(3);

      expect(buffer.isEmpty()).toBe(false);
      expect(drain(buffer)).toEqual([1, 2, 3]);
      expect(buffer.isEmpty()).toBe(true);
    });

    it('behaves the same when an explicit limit of -1 is given', () => {
      const buffer = new LimitBuffer<number>({ limit: -1 });
      buffer.put(1);
      buffer.put(2);
      expect(drain(buffer)).toEqual([1, 2]);
    });

    it('ignores undefined config properties and falls back to defaults', () => {
      const buffer = new LimitBuffer<number>({
        limit: undefined,
        leading: undefined,
      });
      buffer.put(1);
      buffer.put(2);
      buffer.put(3);
      expect(drain(buffer)).toEqual([1, 2, 3]);
    });

    it('accepts undefined as a stored value', () => {
      const buffer = new LimitBuffer<number | undefined>();
      buffer.put(undefined);
      expect(buffer.isEmpty()).toBe(false);
      expect(buffer.take()).toBeUndefined();
      expect(buffer.isEmpty()).toBe(true);
    });
  });

  describe('limit with neither leading nor trailing', () => {
    it('drops the newest value once the limit is exceeded', () => {
      const buffer = new LimitBuffer<number>({ limit: 2 });
      buffer.put(1);
      buffer.put(2);
      buffer.put(3);
      buffer.put(4);

      expect(drain(buffer)).toEqual([1, 2]);
    });

    it('keeps everything while the size is still at the limit', () => {
      const buffer = new LimitBuffer<number>({ limit: 3 });
      buffer.put(1);
      buffer.put(2);
      buffer.put(3);

      expect(drain(buffer)).toEqual([1, 2, 3]);
    });
  });

  describe('trailing', () => {
    it('drops the newest value, keeping the oldest ones', () => {
      const buffer = new LimitBuffer<number>({ limit: 2, trailing: true });
      buffer.put(1);
      buffer.put(2);
      buffer.put(3);

      expect(drain(buffer)).toEqual([1, 2]);
    });

    it('wins over leading when both are enabled', () => {
      const buffer = new LimitBuffer<number>({
        limit: 1,
        leading: true,
        trailing: true,
      });
      buffer.put(1);
      buffer.put(2);
      buffer.put(3);

      expect(drain(buffer)).toEqual([1]);
    });
  });

  describe('leading', () => {
    it('drops the oldest value, keeping the newest ones', () => {
      const buffer = new LimitBuffer<number>({ limit: 2, leading: true });
      buffer.put(1);
      buffer.put(2);
      buffer.put(3);
      buffer.put(4);

      expect(drain(buffer)).toEqual([3, 4]);
    });

    it('keeps only the latest value with limit 1', () => {
      const buffer = new LimitBuffer<string>({ limit: 1, leading: true });
      buffer.put('a');
      buffer.put('b');
      buffer.put('c');

      expect(drain(buffer)).toEqual(['c']);
    });
  });

  describe('degenerate limits', () => {
    it('discards every value when limit is 0', () => {
      const buffer = new LimitBuffer<number>({ limit: 0 });
      buffer.put(1);
      buffer.put(2);

      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.take()).toBeUndefined();
    });

    it('discards every value for negative limits other than -1', () => {
      const buffer = new LimitBuffer<number>({ limit: -2, leading: true });
      buffer.put(1);

      expect(buffer.isEmpty()).toBe(true);
    });
  });

  describe('flush', () => {
    it('returns everything and empties the buffer', () => {
      const buffer = new LimitBuffer<number>();
      buffer.put(1);
      buffer.put(2);

      expect(buffer.flush()).toEqual([1, 2]);
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.flush()).toEqual([]);
    });

    it('returns a detached array that no longer tracks the buffer', () => {
      const buffer = new LimitBuffer<number>();
      buffer.put(1);
      const flushed = buffer.flush();
      buffer.put(2);

      expect(flushed).toEqual([1]);
      expect(buffer.take()).toBe(2);
    });
  });

  describe('drop', () => {
    it('removes the first matching value and reports true', () => {
      const buffer = new LimitBuffer<number>();
      buffer.put(1);
      buffer.put(2);
      buffer.put(3);
      buffer.put(2);

      expect(buffer.drop(value => value === 2)).toBe(true);
      expect(drain(buffer)).toEqual([1, 3, 2]);
    });

    it('reports false and keeps the queue intact when nothing matches', () => {
      const buffer = new LimitBuffer<number>();
      buffer.put(1);
      buffer.put(2);

      expect(buffer.drop(value => value === 99)).toBe(false);
      expect(drain(buffer)).toEqual([1, 2]);
    });

    it('reports false on an empty buffer', () => {
      const buffer = new LimitBuffer<number>();
      expect(buffer.drop(() => true)).toBe(false);
    });

    it('can drop the head and the tail', () => {
      const buffer = new LimitBuffer<number>();
      buffer.put(1);
      buffer.put(2);
      buffer.put(3);

      expect(buffer.drop(value => value === 1)).toBe(true);
      expect(buffer.drop(value => value === 3)).toBe(true);
      expect(drain(buffer)).toEqual([2]);
    });

    it('passes each queued value to the predicate until it matches', () => {
      const buffer = new LimitBuffer<number>();
      buffer.put(10);
      buffer.put(20);
      buffer.put(30);

      const seen: Array<number> = [];
      buffer.drop(value => {
        seen.push(value);
        return value === 20;
      });

      expect(seen).toEqual([10, 20]);
    });
  });

  describe('config isolation', () => {
    it('does not share state between instances', () => {
      const a = new LimitBuffer<number>({ limit: 1, leading: true });
      const b = new LimitBuffer<number>();

      a.put(1);
      a.put(2);
      b.put(1);
      b.put(2);

      expect(drain(a)).toEqual([2]);
      expect(drain(b)).toEqual([1, 2]);
    });

    it('is not affected by later mutation of the config object', () => {
      const config = { limit: -1 };
      const buffer = new LimitBuffer<number>(config);
      config.limit = 1;

      buffer.put(1);
      buffer.put(2);

      expect(drain(buffer)).toEqual([1, 2]);
    });
  });
});
