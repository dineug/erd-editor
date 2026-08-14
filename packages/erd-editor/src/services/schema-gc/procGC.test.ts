import {
  type ERDEditorSchemaV3,
  query,
  schemaV3Parser,
} from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vitest';

import type { GCIds } from '@/services/schema-gc';
import { procGC } from '@/services/schema-gc/procGC';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createMemo } from '@/utils/collection/memo.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

const emptyIds = (): GCIds => ({
  tableIds: [],
  tableColumnIds: [],
  relationshipIds: [],
  indexIds: [],
  indexColumnIds: [],
  memoIds: [],
});

function createState(): ERDEditorSchemaV3 {
  const state = schemaV3Parser({});
  const { collections } = state;

  query(collections)
    .collection('tableEntities')
    .setMany([
      createTable({ id: 'table-a', name: 'a' }),
      createTable({ id: 'table-b', name: 'b' }),
    ]);
  query(collections)
    .collection('tableColumnEntities')
    .setMany([
      createColumn({ id: 'column-a', tableId: 'table-a' }),
      createColumn({ id: 'column-b', tableId: 'table-b' }),
    ]);
  query(collections)
    .collection('relationshipEntities')
    .setMany([
      createRelationship({ id: 'relationship-a' }),
      createRelationship({ id: 'relationship-b' }),
    ]);
  query(collections)
    .collection('indexEntities')
    .setMany([
      createIndex({ id: 'index-a', tableId: 'table-a' }),
      createIndex({ id: 'index-b', tableId: 'table-b' }),
    ]);
  query(collections)
    .collection('indexColumnEntities')
    .setMany([
      createIndexColumn({ id: 'index-column-a', indexId: 'index-a' }),
      createIndexColumn({ id: 'index-column-b', indexId: 'index-b' }),
    ]);
  query(collections)
    .collection('memoEntities')
    .setMany([createMemo({ id: 'memo-a' }), createMemo({ id: 'memo-b' })]);

  return state;
}

describe('procGC', () => {
  it('removes exactly the requested entities from every collection', () => {
    const state = createState();

    procGC(state, {
      tableIds: ['table-a'],
      tableColumnIds: ['column-a'],
      relationshipIds: ['relationship-a'],
      indexIds: ['index-a'],
      indexColumnIds: ['index-column-a'],
      memoIds: ['memo-a'],
    });

    const { collections } = state;
    expect(Object.keys(collections.tableEntities)).toEqual(['table-b']);
    expect(Object.keys(collections.tableColumnEntities)).toEqual(['column-b']);
    expect(Object.keys(collections.relationshipEntities)).toEqual([
      'relationship-b',
    ]);
    expect(Object.keys(collections.indexEntities)).toEqual(['index-b']);
    expect(Object.keys(collections.indexColumnEntities)).toEqual([
      'index-column-b',
    ]);
    expect(Object.keys(collections.memoEntities)).toEqual(['memo-b']);
  });

  it('keeps every entity when no id is requested', () => {
    const state = createState();

    procGC(state, emptyIds());

    const { collections } = state;
    expect(Object.keys(collections.tableEntities)).toEqual([
      'table-a',
      'table-b',
    ]);
    expect(Object.keys(collections.tableColumnEntities)).toHaveLength(2);
    expect(Object.keys(collections.relationshipEntities)).toHaveLength(2);
    expect(Object.keys(collections.indexEntities)).toHaveLength(2);
    expect(Object.keys(collections.indexColumnEntities)).toHaveLength(2);
    expect(Object.keys(collections.memoEntities)).toHaveLength(2);
  });

  it('ignores unknown ids instead of throwing', () => {
    const state = createState();

    expect(() =>
      procGC(state, {
        ...emptyIds(),
        tableIds: ['does-not-exist'],
        memoIds: ['nope'],
      })
    ).not.toThrow();

    expect(Object.keys(state.collections.tableEntities)).toHaveLength(2);
    expect(Object.keys(state.collections.memoEntities)).toHaveLength(2);
  });

  it('does not touch doc id lists, only the collections', () => {
    const state = createState();
    state.doc.tableIds = ['table-a', 'table-b'];
    state.doc.memoIds = ['memo-a'];

    procGC(state, {
      ...emptyIds(),
      tableIds: ['table-a'],
      memoIds: ['memo-a'],
    });

    expect(state.doc.tableIds).toEqual(['table-a', 'table-b']);
    expect(state.doc.memoIds).toEqual(['memo-a']);
    expect(state.collections.tableEntities['table-a']).toBeUndefined();
  });

  it('removes all entities of a collection when every id is passed', () => {
    const state = createState();

    procGC(state, {
      ...emptyIds(),
      indexIds: ['index-a', 'index-b'],
      indexColumnIds: ['index-column-a', 'index-column-b'],
    });

    expect(state.collections.indexEntities).toEqual({});
    expect(state.collections.indexColumnEntities).toEqual({});
  });
});
