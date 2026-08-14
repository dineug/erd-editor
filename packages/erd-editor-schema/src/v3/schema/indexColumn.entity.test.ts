import { describe, expect, it } from 'vitest';

import {
  IndexColumn,
  OrderType,
  OrderTypeList,
} from '@/v3/schema/indexColumn.entity';

describe('v3/schema/indexColumn.entity', () => {
  describe('OrderType', () => {
    it('exposes ASC and DESC as distinct single bits', () => {
      expect(OrderType).toEqual({ ASC: 1, DESC: 2 });
      expect(OrderType.ASC & OrderType.DESC).toBe(0);
    });

    it('lists the values in declaration order', () => {
      expect(OrderTypeList).toEqual([1, 2]);
      expect(OrderTypeList).toHaveLength(Object.keys(OrderType).length);
    });

    it('resolves an order flag back to its name', () => {
      const nameOf = (flag: number) =>
        Object.keys(OrderType).find(
          key => OrderType[key as keyof typeof OrderType] === flag
        );

      expect(nameOf(OrderType.ASC)).toBe('ASC');
      expect(nameOf(OrderType.DESC)).toBe('DESC');
      expect(nameOf(0)).toBeUndefined();
    });
  });

  it('describes an index column linked to an index and a table column', () => {
    const indexColumn: IndexColumn = {
      id: 'index-column-1',
      indexId: 'index-1',
      columnId: 'column-1',
      orderType: OrderType.DESC,
      meta: { updateAt: 5, createAt: 3 },
    };

    expect(OrderTypeList).toContain(indexColumn.orderType);
    expect(indexColumn.indexId).not.toBe(indexColumn.columnId);
    expect(indexColumn.meta.updateAt - indexColumn.meta.createAt).toBe(2);
  });

  it('sorts index columns by ascending order flag first', () => {
    const build = (id: string, orderType: number): IndexColumn => ({
      id,
      indexId: 'index-1',
      columnId: `column-${id}`,
      orderType,
      meta: { updateAt: 0, createAt: 0 },
    });
    const columns = [
      build('b', OrderType.DESC),
      build('a', OrderType.ASC),
    ].sort((a, b) => a.orderType - b.orderType);

    expect(columns.map(column => column.id)).toEqual(['a', 'b']);
  });
});
