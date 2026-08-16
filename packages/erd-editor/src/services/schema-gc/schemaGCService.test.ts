import { describe, expect, it } from 'vite-plus/test';

import { SchemaGCService } from '@/services/schema-gc/schemaGCService';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const old = now - 5 * DAY;
const fresh = now - 1 * DAY;

const meta = (updateAt: number) => ({ updateAt, createAt: updateAt });

const table = (id: string, updateAt: number) => ({
  id,
  name: id,
  comment: '',
  columnIds: [],
  seqColumnIds: [],
  ui: { x: 0, y: 0, zIndex: 2, widthName: 60, widthComment: 60, color: '' },
  meta: meta(updateAt),
});

const column = (id: string, tableId: string, updateAt: number) => ({
  id,
  tableId,
  name: id,
  comment: '',
  dataType: '',
  default: '',
  options: 0,
  ui: {
    keys: 0,
    widthName: 60,
    widthComment: 60,
    widthDataType: 60,
    widthDefault: 60,
  },
  meta: meta(updateAt),
});

const relationship = (
  id: string,
  startTableId: string,
  endTableId: string,
  updateAt: number
) => ({
  id,
  identification: false,
  relationshipType: 8,
  startRelationshipType: 2,
  start: {
    tableId: startTableId,
    columnIds: [],
    x: 0,
    y: 0,
    direction: 4,
  },
  end: {
    tableId: endTableId,
    columnIds: [],
    x: 0,
    y: 0,
    direction: 4,
  },
  meta: meta(updateAt),
});

const index = (id: string, tableId: string, updateAt: number) => ({
  id,
  name: id,
  tableId,
  indexColumnIds: [],
  seqIndexColumnIds: [],
  unique: false,
  meta: meta(updateAt),
});

const indexColumn = (id: string, indexId: string, updateAt: number) => ({
  id,
  indexId,
  columnId: '',
  orderType: 1,
  meta: meta(updateAt),
});

const memo = (id: string, updateAt: number) => ({
  id,
  value: id,
  ui: { x: 0, y: 0, zIndex: 2, width: 116, height: 100, color: '' },
  meta: meta(updateAt),
});

const toEntities = (list: Array<{ id: string }>) =>
  list.reduce<Record<string, any>>((acc, entity) => {
    acc[entity.id] = entity;
    return acc;
  }, {});

function createSource() {
  return JSON.stringify({
    version: '3.0.0',
    doc: {
      tableIds: ['t-doc'],
      relationshipIds: ['r-doc'],
      indexIds: ['i-doc'],
      memoIds: ['m-doc'],
    },
    collections: {
      tableEntities: toEntities([
        table('t-doc', old),
        table('t-old', old),
        table('t-new', fresh),
      ]),
      tableColumnEntities: toEntities([
        column('c-doc', 't-doc', old),
        column('c-old', 't-old', old),
        column('c-new', 't-new', fresh),
        column('c-orphan-old', 't-missing', old),
        column('c-orphan-new', 't-missing', fresh),
      ]),
      relationshipEntities: toEntities([
        relationship('r-doc', 't-doc', 't-doc', old),
        relationship('r-old', 't-doc', 't-doc', old),
        relationship('r-cascade', 't-old', 't-doc', fresh),
        relationship('r-keep', 't-doc', 't-new', fresh),
      ]),
      indexEntities: toEntities([
        index('i-doc', 't-doc', old),
        index('i-old', 't-doc', old),
        index('i-cascade', 't-old', fresh),
        index('i-keep', 't-doc', fresh),
      ]),
      indexColumnEntities: toEntities([
        indexColumn('ic-old', 'i-old', fresh),
        indexColumn('ic-cascade', 'i-cascade', fresh),
        indexColumn('ic-keep', 'i-keep', fresh),
        indexColumn('ic-orphan-old', 'i-missing', old),
        indexColumn('ic-orphan-new', 'i-missing', fresh),
      ]),
      memoEntities: toEntities([
        memo('m-doc', old),
        memo('m-old', old),
        memo('m-new', fresh),
      ]),
    },
  });
}

const sorted = (ids: string[]) => [...ids].sort();

describe('SchemaGCService', () => {
  it('collects nothing for an empty schema', async () => {
    const result = await new SchemaGCService().run(JSON.stringify({}));

    expect(result).toEqual({
      tableIds: [],
      tableColumnIds: [],
      relationshipIds: [],
      indexIds: [],
      indexColumnIds: [],
      memoIds: [],
    });
  });

  it('garbage collects entities older than 3 days that the doc no longer references', async () => {
    const result = await new SchemaGCService().run(createSource());

    expect(sorted(result.tableIds)).toEqual(['t-old']);
    expect(sorted(result.memoIds)).toEqual(['m-old']);
  });

  it('cascades table removal into columns, relationships and indexes', async () => {
    const result = await new SchemaGCService().run(createSource());

    expect(sorted(result.relationshipIds)).toEqual(['r-cascade', 'r-old']);
    expect(sorted(result.indexIds)).toEqual(['i-cascade', 'i-old']);
    expect(result.tableColumnIds).toContain('c-old');
    expect(result.indexColumnIds).toContain('ic-cascade');
  });

  it('collects index columns whose index was collected', async () => {
    const result = await new SchemaGCService().run(createSource());

    expect(sorted(result.indexColumnIds)).toEqual([
      'ic-cascade',
      'ic-old',
      'ic-orphan-old',
    ]);
  });

  it('collects orphaned columns only when they are also older than 3 days', async () => {
    const result = await new SchemaGCService().run(createSource());

    expect(sorted(result.tableColumnIds)).toEqual(['c-old', 'c-orphan-old']);
    expect(result.tableColumnIds).not.toContain('c-orphan-new');
    expect(result.indexColumnIds).not.toContain('ic-orphan-new');
  });

  it('keeps entities that are still referenced by the doc even when they are old', async () => {
    const result = await new SchemaGCService().run(createSource());

    expect(result.tableIds).not.toContain('t-doc');
    expect(result.relationshipIds).not.toContain('r-doc');
    expect(result.indexIds).not.toContain('i-doc');
    expect(result.memoIds).not.toContain('m-doc');
  });

  it('keeps recent entities that are not referenced by the doc', async () => {
    const result = await new SchemaGCService().run(createSource());

    expect(result.tableIds).not.toContain('t-new');
    expect(result.relationshipIds).not.toContain('r-keep');
    expect(result.indexIds).not.toContain('i-keep');
    expect(result.indexColumnIds).not.toContain('ic-keep');
    expect(result.memoIds).not.toContain('m-new');
  });

  it('is deterministic across runs on the same source', async () => {
    const service = new SchemaGCService();
    const first = await service.run(createSource());
    const second = await service.run(createSource());

    expect(second).toEqual(first);
  });

  it('does not collect an entity that is exactly 3 days old', async () => {
    const source = JSON.stringify({
      version: '3.0.0',
      collections: {
        memoEntities: toEntities([
          memo('m-3days', Date.now() - 3 * DAY),
          memo('m-4days', Date.now() - 4 * DAY),
        ]),
      },
    });

    const result = await new SchemaGCService().run(source);

    expect(result.memoIds).toEqual(['m-4days']);
  });

  it('rejects when the source is not valid JSON', async () => {
    await expect(new SchemaGCService().run('not json')).rejects.toThrow();
  });
});
