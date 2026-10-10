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
    expect(index).not.toHaveProperty('meta');
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
      },
    });

    expect(entities.i1).toEqual({
      id: 'i1',
      name: 'idx_users',
      tableId: 't1',
      unique: true,
      indexColumnIds: ['ic1'],
      seqIndexColumnIds: ['ic1', 'ic2'],
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

  it.each([
    ['missing', undefined],
    ['missing an id the index lists', ['ic2']],
    ['not an array', 'ic1'],
  ])(
    'starts the index column sequence at the list when it is %s',
    (_, seqIndexColumnIds) => {
      const indexColumnIds = ['ic2', 'ic1'];
      const entities = createAndMergeIndexEntities({
        key: {
          id: 'i1',
          indexColumnIds,
          seqIndexColumnIds: seqIndexColumnIds as any,
        },
      });

      expect(entities.i1.seqIndexColumnIds).toEqual(['ic2', 'ic1']);
      expect(entities.i1.seqIndexColumnIds).not.toBe(
        entities.i1.indexColumnIds
      );
    }
  );

  it('keeps an index column sequence that holds every listed column', () => {
    const entities = createAndMergeIndexEntities({
      key: {
        id: 'i1',
        indexColumnIds: ['ic2'],
        seqIndexColumnIds: ['ic1', 'ic2'],
      },
    });

    expect(entities.i1.seqIndexColumnIds).toEqual(['ic1', 'ic2']);
  });

  it('merges several indexes', () => {
    const entities = createAndMergeIndexEntities({
      a: { id: 'a' },
      b: { id: 'b' },
    });

    expect(Object.keys(entities).sort()).toEqual(['a', 'b']);
  });
});
