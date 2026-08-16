import { describe, expect, it } from 'vite-plus/test';

import {
  createAndMergeIndexEntities,
  createIndex,
} from '@/v3/parser/index.entity';

describe('createIndex', () => {
  it('creates an index with defaults', () => {
    const index = createIndex();

    expect(index).toMatchObject({
      id: '',
      name: '',
      tableId: '',
      indexColumnIds: [],
      seqIndexColumnIds: [],
      unique: false,
    });
    expect(index.meta.createAt).toBe(index.meta.updateAt);
  });
});

describe('createAndMergeIndexEntities', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string', 'nope'],
    ['array', []],
  ])('returns an empty record for a non-object source (%s)', (_l, source) => {
    expect(createAndMergeIndexEntities(source as any)).toEqual({});
  });

  it('skips falsy entries and entries without an id', () => {
    expect(
      createAndMergeIndexEntities({
        a: null as any,
        b: { name: 'no-id' },
      })
    ).toEqual({});
  });

  it('merges every field', () => {
    const entities = createAndMergeIndexEntities({
      key: {
        id: 'i1',
        name: 'idx_users',
        tableId: 't1',
        unique: true,
        indexColumnIds: ['ic1'],
        seqIndexColumnIds: ['ic1', 'ic2'],
        meta: { updateAt: 5, createAt: 6 },
      },
    });

    expect(entities.i1).toEqual({
      id: 'i1',
      name: 'idx_users',
      tableId: 't1',
      unique: true,
      indexColumnIds: ['ic1'],
      seqIndexColumnIds: ['ic1', 'ic2'],
      meta: { updateAt: 5, createAt: 6 },
    });
  });

  it('ignores wrongly typed values', () => {
    const entities = createAndMergeIndexEntities({
      key: {
        id: 'i1',
        name: 1 as any,
        unique: 'true' as any,
        indexColumnIds: 'ic1' as any,
        seqIndexColumnIds: ['ic1'],
      },
    });

    const index = entities.i1;
    expect(index.name).toBe('');
    expect(index.unique).toBe(false);
    expect(index.indexColumnIds).toEqual([]);
    expect(index.seqIndexColumnIds).toEqual(['ic1']);
  });

  it('accepts an explicit false for unique', () => {
    const entities = createAndMergeIndexEntities({
      key: { id: 'i1', unique: false },
    });

    expect(entities.i1.unique).toBe(false);
  });

  it('merges several indexes', () => {
    const entities = createAndMergeIndexEntities({
      a: { id: 'a' },
      b: { id: 'b' },
    });

    expect(Object.keys(entities).sort()).toEqual(['a', 'b']);
  });
});
