import { describe, expect, it } from 'vite-plus/test';

import {
  createAndMergeIndexColumnEntities,
  createIndexColumn,
} from '@/v3/parser/indexColumn.entity';
import { OrderType } from '@/v3/schema/indexColumn.entity';

describe('createIndexColumn', () => {
  it('creates an index column with defaults', () => {
    const indexColumn = createIndexColumn();

    expect(indexColumn).toMatchObject({
      id: '',
      indexId: '',
      columnId: '',
      orderType: OrderType.ASC,
    });
    expect(indexColumn.meta.createAt).toBe(indexColumn.meta.updateAt);
  });
});

describe('createAndMergeIndexColumnEntities', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string', 'nope'],
    ['array', []],
  ])('returns an empty record for a non-object source (%s)', (_l, source) => {
    expect(createAndMergeIndexColumnEntities(source as any)).toEqual({});
  });

  it('skips falsy entries and entries without an id', () => {
    expect(
      createAndMergeIndexColumnEntities({
        a: undefined,
        b: { indexId: 'i1' },
      })
    ).toEqual({});
  });

  it('merges every field', () => {
    const entities = createAndMergeIndexColumnEntities({
      key: {
        id: 'ic1',
        indexId: 'i1',
        columnId: 'c1',
        orderType: OrderType.DESC,
        meta: { updateAt: 7, createAt: 8 },
      },
    });

    expect(entities.ic1).toEqual({
      id: 'ic1',
      indexId: 'i1',
      columnId: 'c1',
      orderType: OrderType.DESC,
      meta: { updateAt: 7, createAt: 8 },
    });
  });

  it('falls back to ASC for an unknown orderType', () => {
    const entities = createAndMergeIndexColumnEntities({
      key: { id: 'ic1', orderType: 99 },
    });

    expect(entities.ic1.orderType).toBe(OrderType.ASC);
  });

  it('falls back to ASC for a non-number orderType', () => {
    const entities = createAndMergeIndexColumnEntities({
      key: { id: 'ic1', orderType: '2' as any },
    });

    expect(entities.ic1.orderType).toBe(OrderType.ASC);
  });

  it('ignores wrongly typed string fields', () => {
    const entities = createAndMergeIndexColumnEntities({
      key: { id: 'ic1', indexId: 1 as any, columnId: null as any },
    });

    expect(entities.ic1.indexId).toBe('');
    expect(entities.ic1.columnId).toBe('');
  });

  it('merges several index columns', () => {
    const entities = createAndMergeIndexColumnEntities({
      a: { id: 'a' },
      b: { id: 'b' },
    });

    expect(Object.keys(entities).sort()).toEqual(['a', 'b']);
  });
});
