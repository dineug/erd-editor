import { compareByOrder, type Ordered } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { placeOrderKeys } from '@/engine/modules/dictionary/orderKeys';

/** The ids in sheet order once the placement's keys and new rows are in. */
function placed(rows: Ordered[], at: number, count: number) {
  const { keys, rekeyed } = placeOrderKeys(rows, at, count);
  const next = new Map(rows.map(row => [row.id, { ...row }]));
  rekeyed.forEach(({ id, order }) => {
    next.get(id)!.order = order;
  });
  keys.forEach((order, index) =>
    next.set(`new${index}`, { id: `new${index}`, order })
  );
  return {
    ids: [...next.values()].sort(compareByOrder).map(({ id }) => id),
    rekeyed: rekeyed.map(({ id }) => id),
  };
}

const row = (id: string, order: string): Ordered => ({ id, order });

describe('placeOrderKeys', () => {
  it('places rows between two keys, before the first and after the last, keying no other row', () => {
    const rows = [row('a', 'a0'), row('b', 'a1'), row('c', 'a2')];

    expect(placed(rows, 1, 2)).toEqual({
      ids: ['a', 'new0', 'new1', 'b', 'c'],
      rekeyed: [],
    });
    expect(placed(rows, 0, 1).ids).toEqual(['new0', 'a', 'b', 'c']);
    expect(placed(rows, 3, 1).ids).toEqual(['a', 'b', 'c', 'new0']);
    expect(placed([], 0, 3).ids).toEqual(['new0', 'new1', 'new2']);
    expect(placeOrderKeys(rows, 1, 0)).toEqual({ keys: [], rekeyed: [] });
  });

  it('keys again the rows sharing the key below the place, so the rows land between', () => {
    const rows = [
      row('a', 'a0'),
      row('b', 'a1'),
      row('c', 'a1'),
      row('d', 'a1'),
      row('e', 'a2'),
    ];

    expect(placed(rows, 2, 1)).toEqual({
      ids: ['a', 'b', 'new0', 'c', 'd', 'e'],
      rekeyed: ['c', 'd'],
    });
  });

  it('keys the rows with no key that stand before the place, and leaves those after it last', () => {
    // Rows with no key stand last in any sheet.
    const rows = [row('a', 'a0'), row('y', 'b00'), row('x', ''), row('z', '')];

    expect(placed(rows, 3, 1)).toEqual({
      ids: ['a', 'y', 'x', 'new0', 'z'],
      rekeyed: ['x'],
    });
    expect(placed(rows, 4, 1)).toEqual({
      ids: ['a', 'y', 'x', 'z', 'new0'],
      rekeyed: ['x', 'z'],
    });
    expect(placed(rows, 2, 1)).toEqual({
      ids: ['a', 'y', 'new0', 'x', 'z'],
      rekeyed: [],
    });
    expect(placed([row('x', ''), row('y', '')], 0, 1)).toEqual({
      ids: ['new0', 'x', 'y'],
      rekeyed: [],
    });
  });
});
