import { query, schemaV3Parser } from '@dineug/erd-editor-schema';
import { arrayHas } from '@dineug/shared';
import { uniq } from 'lodash-es';
import { DateTime } from 'luxon';

import type { GCIds } from '@/services/schema-gc';

import { procGC } from './procGC';

const GC_DAYS = 30;
const hasCollectionKey = arrayHas([
  'tableEntities',
  'tableColumnEntities',
  'relationshipEntities',
  'indexEntities',
  'indexColumnEntities',
  'memoEntities',
]);

export class SchemaGCService {
  async run(source: string): Promise<GCIds> {
    const json = JSON.parse(source);
    const state = schemaV3Parser(json);
    const {
      doc: { tableIds, memoIds, indexIds, relationshipIds },
      collections,
      lww,
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

    const gcIds: GCIds = {
      tableIds: [
        ...tableCollection
          .selectAll()
          .filter(isGC(hasTableIds))
          .map(({ id }) => id),
      ],
      tableColumnIds: [],
      relationshipIds: [
        ...relationshipCollection
          .selectAll()
          .filter(isGC(hasRelationshipIds))
          .map(({ id }) => id),
      ],
      indexIds: [
        ...indexCollection
          .selectAll()
          .filter(isGC(hasIndexIds))
          .map(({ id }) => id),
      ],
      indexColumnIds: [],
      memoIds: [
        ...memoCollection
          .selectAll()
          .filter(isGC(hasMemoIds))
          .map(({ id }) => id),
      ],
    };

    const hasGCTableIds = arrayHas(gcIds.tableIds);
    const hasGCRelationshipIds = arrayHas(gcIds.relationshipIds);
    let hasGCIndexIds = arrayHas(gcIds.indexIds);

    gcIds.tableColumnIds.push(
      ...tableColumnCollection
        .selectAll()
        .filter(({ tableId }) => hasGCTableIds(tableId))
        .map(({ id }) => id)
    );

    gcIds.relationshipIds.push(
      ...relationshipCollection
        .selectAll()
        .filter(
          ({ id, start, end }) =>
            !hasGCRelationshipIds(id) &&
            (hasGCTableIds(start.tableId) || hasGCTableIds(end.tableId))
        )
        .map(({ id }) => id)
    );

    gcIds.indexIds.push(
      ...indexCollection
        .selectAll()
        .filter(
          ({ id, tableId }) => !hasGCIndexIds(id) && hasGCTableIds(tableId)
        )
        .map(({ id }) => id)
    );

    hasGCIndexIds = arrayHas(gcIds.indexIds);

    gcIds.indexColumnIds.push(
      ...indexColumnCollection
        .selectAll()
        .filter(({ indexId }) => hasGCIndexIds(indexId))
        .map(({ id }) => id)
    );

    procGC(state, gcIds);

    const hasTableIdsAll = arrayHas(
      tableCollection.selectAll().map(({ id }) => id)
    );
    const hasTableColumnIdsAll = arrayHas(
      tableColumnCollection.selectAll().map(({ id }) => id)
    );
    const hasIndexIdsAll = arrayHas(
      indexCollection.selectAll().map(({ id }) => id)
    );
    const hasIndexColumnIdsAll = arrayHas(
      indexColumnCollection.selectAll().map(({ id }) => id)
    );
    const hasRelationshipIdsAll = arrayHas(
      relationshipCollection.selectAll().map(({ id }) => id)
    );
    const hasMemoIdsAll = arrayHas(
      memoCollection.selectAll().map(({ id }) => id)
    );

    gcIds.tableColumnIds.push(
      ...tableColumnCollection
        .selectAll()
        .filter(
          ({ tableId, id, meta }) =>
            !hasTableIdsAll(tableId) && isGC(() => false)({ id, meta })
        )
        .map(({ id }) => id)
    );

    gcIds.indexColumnIds.push(
      ...indexColumnCollection
        .selectAll()
        .filter(
          ({ indexId, id, meta }) =>
            !hasIndexIdsAll(indexId) && isGC(() => false)({ id, meta })
        )
        .map(({ id }) => id)
    );

    Object.entries(lww).forEach(([id, [key]]) => {
      if (!hasCollectionKey(key)) return;

      switch (key) {
        case 'tableEntities':
          !hasTableIdsAll(id) && gcIds.tableIds.push(id);
          break;
        case 'tableColumnEntities':
          !hasTableColumnIdsAll(id) && gcIds.tableColumnIds.push(id);
          break;
        case 'relationshipEntities':
          !hasRelationshipIdsAll(id) && gcIds.relationshipIds.push(id);
          break;
        case 'indexEntities':
          !hasIndexIdsAll(id) && gcIds.indexIds.push(id);
          break;
        case 'indexColumnEntities':
          !hasIndexColumnIdsAll(id) && gcIds.indexColumnIds.push(id);
          break;
        case 'memoEntities':
          !hasMemoIdsAll(id) && gcIds.memoIds.push(id);
          break;
      }
    });

    return {
      tableIds: uniq(gcIds.tableIds),
      tableColumnIds: uniq(gcIds.tableColumnIds),
      relationshipIds: uniq(gcIds.relationshipIds),
      indexIds: uniq(gcIds.indexIds),
      indexColumnIds: uniq(gcIds.indexColumnIds),
      memoIds: uniq(gcIds.memoIds),
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
