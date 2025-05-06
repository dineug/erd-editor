import { query, schemaV3Parser } from '@dineug/erd-editor-schema';
import { arrayHas } from '@dineug/shared';
import { DateTime } from 'luxon';

import type { GCIds } from '@/services/schema-gc';

import { procGC } from './procGC';

const GC_DAYS = 3;

export class SchemaGCService {
  async run(source: string): Promise<GCIds> {
    const json = JSON.parse(source);
    const state = schemaV3Parser(json);
    const {
      doc: { tableIds, memoIds, indexIds, relationshipIds },
      collections,
    } = state;

    const hasTableIds = arrayHas(tableIds);
    const hasMemoIds = arrayHas(memoIds);
    const hasIndexIds = arrayHas(indexIds);
    const hasRelationshipIds = arrayHas(relationshipIds);
    const isGC = createIsGC(DateTime.now());

    const tableCollection = query(collections).collection('tableEntities');
    const tableColumnCollection = query(collections).collection(
      'tableColumnEntities'
    );
    const indexCollection = query(collections).collection('indexEntities');
    const indexColumnCollection = query(collections).collection(
      'indexColumnEntities'
    );
    const relationshipCollection = query(collections).collection(
      'relationshipEntities'
    );
    const memoCollection = query(collections).collection('memoEntities');

    const gcTableIdsSet = new Set<string>(
      tableCollection
        .selectAll()
        .filter(isGC(hasTableIds))
        .map(({ id }) => id)
    );
    const gcTableColumnIdsSet = new Set<string>();
    const gcRelationshipIdsSet = new Set<string>(
      relationshipCollection
        .selectAll()
        .filter(isGC(hasRelationshipIds))
        .map(({ id }) => id)
    );
    const gcIndexIdsSet = new Set<string>(
      indexCollection
        .selectAll()
        .filter(isGC(hasIndexIds))
        .map(({ id }) => id)
    );
    const gcIndexColumnIdsSet = new Set<string>();
    const gcMemoIdsSet = new Set<string>(
      memoCollection
        .selectAll()
        .filter(isGC(hasMemoIds))
        .map(({ id }) => id)
    );

    tableColumnCollection
      .selectAll()
      .filter(({ tableId }) => gcTableIdsSet.has(tableId))
      .forEach(({ id }) => gcTableColumnIdsSet.add(id));

    relationshipCollection
      .selectAll()
      .filter(
        ({ id, start, end }) =>
          !gcRelationshipIdsSet.has(id) &&
          (gcTableIdsSet.has(start.tableId) || gcTableIdsSet.has(end.tableId))
      )
      .forEach(({ id }) => gcRelationshipIdsSet.add(id));

    indexCollection
      .selectAll()
      .filter(
        ({ id, tableId }) =>
          !gcIndexIdsSet.has(id) && gcTableIdsSet.has(tableId)
      )
      .forEach(({ id }) => gcIndexIdsSet.add(id));

    indexColumnCollection
      .selectAll()
      .filter(({ indexId }) => gcIndexIdsSet.has(indexId))
      .forEach(({ id }) => gcIndexColumnIdsSet.add(id));

    procGC(state, {
      tableIds: [...gcTableIdsSet],
      tableColumnIds: [...gcTableColumnIdsSet],
      relationshipIds: [...gcRelationshipIdsSet],
      indexIds: [...gcIndexIdsSet],
      indexColumnIds: [...gcIndexColumnIdsSet],
      memoIds: [...gcMemoIdsSet],
    });

    const hasTableIdsAll = arrayHas(
      tableCollection.selectAll().map(({ id }) => id)
    );
    const hasIndexIdsAll = arrayHas(
      indexCollection.selectAll().map(({ id }) => id)
    );

    tableColumnCollection
      .selectAll()
      .filter(
        ({ tableId, id, meta }) =>
          !hasTableIdsAll(tableId) && isGC(() => false)({ id, meta })
      )
      .forEach(({ id }) => gcTableColumnIdsSet.add(id));

    indexColumnCollection
      .selectAll()
      .filter(
        ({ indexId, id, meta }) =>
          !hasIndexIdsAll(indexId) && isGC(() => false)({ id, meta })
      )
      .forEach(({ id }) => gcIndexColumnIdsSet.add(id));

    return {
      tableIds: [...gcTableIdsSet],
      tableColumnIds: [...gcTableColumnIdsSet],
      relationshipIds: [...gcRelationshipIdsSet],
      indexIds: [...gcIndexIdsSet],
      indexColumnIds: [...gcIndexColumnIdsSet],
      memoIds: [...gcMemoIdsSet],
    };
  }
}

type EntityType = {
  id: string;
  meta: {
    updateAt: number;
    createAt: number;
  };
};

const createIsGC =
  (now: DateTime) =>
  (has: (value: string) => boolean) =>
  ({ id, meta }: EntityType) => {
    if (has(id)) return false;

    const days = Math.floor(
      now.diff(DateTime.fromMillis(meta.updateAt), 'days').toObject().days ?? 0
    );
    return GC_DAYS < days;
  };
