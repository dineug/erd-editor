import { describe, expect, it } from 'vitest';

import * as indexEntityModule from '@/v3/schema/index.entity';
import { Index } from '@/v3/schema/index.entity';

const buildIndex = (id: string, indexColumnIds: string[] = []): Index => ({
  id,
  name: '',
  tableId: 'table-1',
  indexColumnIds,
  seqIndexColumnIds: [...indexColumnIds],
  unique: false,
  meta: { updateAt: 0, createAt: 0 },
});

describe('v3/schema/index.entity', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(indexEntityModule)).toEqual([]);
  });

  it('describes a fully populated unique index', () => {
    const index: Index = {
      id: 'index-1',
      name: 'uq_actor_name',
      tableId: 'table-1',
      indexColumnIds: ['index-column-1'],
      seqIndexColumnIds: ['index-column-1'],
      unique: true,
      meta: { updateAt: 9, createAt: 4 },
    };

    expect(index.unique).toBe(true);
    expect(index.indexColumnIds).toEqual(index.seqIndexColumnIds);
    expect(index.meta.updateAt).toBeGreaterThan(index.meta.createAt);
  });

  it('defaults to a non-unique index with an empty name', () => {
    const index = buildIndex('index-2');

    expect(index.name).toBe('');
    expect(index.unique).toBe(false);
    expect(index.indexColumnIds).toEqual([]);
  });

  it('keeps seqIndexColumnIds after an index column is removed', () => {
    const index = buildIndex('index-3', ['ic1', 'ic2']);
    index.indexColumnIds = index.indexColumnIds.filter(id => id !== 'ic2');

    expect(index.indexColumnIds).toEqual(['ic1']);
    expect(index.seqIndexColumnIds).toEqual(['ic1', 'ic2']);
  });

  it('groups indexes by the table they belong to', () => {
    const other = buildIndex('index-4');
    other.tableId = 'table-2';
    const indexes = [buildIndex('index-3'), other];

    expect(indexes.filter(index => index.tableId === 'table-1')).toHaveLength(
      1
    );
    expect(indexes.filter(index => index.tableId === 'table-3')).toEqual([]);
  });
});
