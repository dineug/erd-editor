import { describe, expect, it } from 'vite-plus/test';

import {
  compareByOrder,
  generateOrderKeyBetween,
  generateOrderKeys,
  isOrderKey,
  type Ordered,
  settleOrderKeys,
} from '@/orderKey';

const sorted = (keys: string[]) =>
  [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

describe('order keys', () => {
  it('makes a first key, and keys above and below one', () => {
    expect(generateOrderKeyBetween(null, null)).toBe('a0');
    expect(generateOrderKeyBetween('a0', null)).toBe('a1');
    expect(generateOrderKeyBetween(null, 'a0')).toBe('Zz');
    expect(generateOrderKeyBetween('a0', 'a1')).toBe('a0V');
    expect(generateOrderKeyBetween('az', null)).toBe('b00');
    expect(generateOrderKeyBetween(null, 'b00')).toBe('az');
  });

  it('keeps every key it makes between its bounds, in code unit order, however often it splits one gap', () => {
    let low = 'a0';
    const high = 'a1';
    for (let index = 0; index < 200; index++) {
      const key = generateOrderKeyBetween(low, high);
      expect(isOrderKey(key)).toBe(true);
      expect(low < key && key < high).toBe(true);
      low = key;
    }

    let top = 'a0';
    for (let index = 0; index < 200; index++) {
      const key = generateOrderKeyBetween(null, top);
      expect(key < top).toBe(true);
      top = key;
    }
  });

  it('makes n keys in order between two bounds, after one, before one, or between none', () => {
    for (const [a, b] of [
      [null, null],
      ['a5', null],
      [null, 'a5'],
      ['a5', 'a6'],
      ['a5', 'a5V'],
    ] as const) {
      const keys = generateOrderKeys(a, b, 50);
      expect(keys).toHaveLength(50);
      expect(sorted(keys)).toEqual(keys);
      expect(new Set(keys).size).toBe(50);
      if (a) expect(keys[0] > a).toBe(true);
      if (b) expect(keys[49] < b).toBe(true);
    }
    expect(generateOrderKeys('a0', null, 0)).toEqual([]);
    expect(generateOrderKeys(null, null, 70).slice(60, 64)).toEqual([
      'ay',
      'az',
      'b00',
      'b01',
    ]);
  });

  it('keeps a long run of appended keys short', () => {
    const keys = generateOrderKeys(null, null, 20_000);
    expect(sorted(keys)).toEqual(keys);
    expect(Math.max(...keys.map(key => key.length))).toBeLessThanOrEqual(4);
  });

  it('refuses a key it cannot place by, and bounds out of order', () => {
    for (const key of [
      '',
      'a',
      'a00',
      'b0',
      '0a',
      'a-',
      `A${'0'.repeat(26)}`,
      1,
      null,
    ]) {
      expect(isOrderKey(key)).toBe(false);
    }
    expect(isOrderKey(`A${'0'.repeat(26)}1`)).toBe(true);
    expect(isOrderKey('bad')).toBe(true);
    expect(isOrderKey('Zz')).toBe(true);
    expect(() => generateOrderKeyBetween('a1', 'a0')).toThrow(RangeError);
    expect(() => generateOrderKeyBetween('a1', 'a1')).toThrow(RangeError);
    expect(() => generateOrderKeyBetween('b0', null)).toThrow(RangeError);
    expect(() => generateOrderKeyBetween(null, 'b0')).toThrow(RangeError);
  });

  it('goes below the smallest integer by a fraction', () => {
    const smallest = `A${'0'.repeat(26)}1`;
    const below = generateOrderKeyBetween(null, smallest);
    expect(below < smallest).toBe(true);
    expect(isOrderKey(below)).toBe(true);
  });

  it('goes past the greatest integer by a fraction', () => {
    const greatest = `z${'z'.repeat(26)}`;
    const above = generateOrderKeyBetween(greatest, null);
    expect(above > greatest).toBe(true);
    expect(isOrderKey(above)).toBe(true);
  });
});

describe('compareByOrder', () => {
  it('orders rows by key, those of one key by id, and rows with no key last', () => {
    const rows: Ordered[] = [
      { id: 'c', order: '' },
      { id: 'b', order: 'a1' },
      { id: 'a', order: 'a1' },
      { id: 'd', order: 'a0' },
      { id: 'e', order: 'b0' },
      { id: 'f', order: 'Zz' },
    ];

    expect([...rows].sort(compareByOrder).map(({ id }) => id)).toEqual([
      'f',
      'd',
      'a',
      'b',
      'c',
      'e',
    ]);
  });
});

describe('settleOrderKeys', () => {
  it('keys the rows of a file in their order, the listed ones first', () => {
    const entities: Record<string, Ordered> = {
      x: { id: 'x', order: '' },
      y: { id: 'y', order: '' },
      z: { id: 'z', order: '' },
    };

    settleOrderKeys(entities, ['z', 'x']);
    expect([entities.z, entities.x, entities.y].map(e => e.order)).toEqual([
      'a0',
      'a1',
      'a2',
    ]);
  });

  it('keeps the keys held and keys the rest after the greatest', () => {
    const entities: Record<string, Ordered> = {
      x: { id: 'x', order: 'a5' },
      y: { id: 'y', order: 'b0' },
      z: { id: 'z', order: 'a2' },
    };

    settleOrderKeys(entities, ['x', 'y', 'z']);
    expect(entities.x.order).toBe('a5');
    expect(entities.z.order).toBe('a2');
    expect(entities.y.order).toBe('a6');
  });
});
