import { describe, expect, it, vi } from 'vitest';

import { groupBy } from '@/helpers/array';

describe('helpers/array', () => {
  describe('groupBy', () => {
    it('returns an empty object for an empty list', () => {
      expect(groupBy([], String)).toEqual({});
    });

    it('groups values by the identity key preserving insertion order', () => {
      const list = [
        { type: 'a', id: 1 },
        { type: 'b', id: 2 },
        { type: 'a', id: 3 },
        { type: 'b', id: 4 },
        { type: 'c', id: 5 },
      ];

      const result = groupBy(list, value => value.type);

      expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
      expect(result.a).toEqual([
        { type: 'a', id: 1 },
        { type: 'a', id: 3 },
      ]);
      expect(result.b).toEqual([
        { type: 'b', id: 2 },
        { type: 'b', id: 4 },
      ]);
      expect(result.c).toEqual([{ type: 'c', id: 5 }]);
    });

    it('keeps the original references in the grouped arrays', () => {
      const a = { key: 'x' };
      const b = { key: 'x' };

      const result = groupBy([a, b], value => value.key);

      expect(result.x[0]).toBe(a);
      expect(result.x[1]).toBe(b);
    });

    it('does not mutate the source list', () => {
      const list = [1, 2, 3];
      groupBy(list, value => (value % 2 === 0 ? 'even' : 'odd'));
      expect(list).toEqual([1, 2, 3]);
    });

    it('puts every item in one bucket when identity is constant', () => {
      expect(groupBy([1, 2, 3], () => 'all')).toEqual({ all: [1, 2, 3] });
    });

    it('calls identity twice for the first item of a group and once afterwards', () => {
      const identity = vi.fn((value: string) => value);

      groupBy(['a', 'a', 'b'], identity);

      // 'a' (miss -> 2 calls), 'a' (hit -> 1 call), 'b' (miss -> 2 calls)
      expect(identity).toHaveBeenCalledTimes(5);
    });

    it('coerces non-string identity results into object keys', () => {
      const result = groupBy([1, 2, 3, 4], value =>
        String(value % 2)
      ) as Record<string, number[]>;

      expect(result['1']).toEqual([1, 3]);
      expect(result['0']).toEqual([2, 4]);
    });

    it('inherits prototype keys from the accumulator object literal', () => {
      // `{}` inherits from Object.prototype, so a key such as `toString`
      // resolves truthy on first lookup and `push` is attempted on it.
      expect(() => groupBy(['toString'], value => value)).toThrowError(
        TypeError
      );
    });
  });
});
