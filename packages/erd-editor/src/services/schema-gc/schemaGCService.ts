import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { arrayHas } from '@dineug/shared';
import { uniq } from 'lodash-es';
import { DateTime } from 'luxon';

import type { GCIds } from '@/services/schema-gc';
import { query } from '@/utils/collection/query';

const GC_DAYS = 30;

export class SchemaGCService {
  async run(source: string): Promise<GCIds> {
    const json = JSON.parse(source);
    const {
      doc: { tableIds, memoIds, indexIds, relationshipIds },
      collections,
    } = schemaV3Parser(json);

    const hasTableIds = arrayHas(tableIds);
    const hasMemoIds = arrayHas(memoIds);
    const hasIndexIds = arrayHas(indexIds);
    const hasRelationshipIds = arrayHas(relationshipIds);
    const isGC = createIsGC(DateTime.now());

    const gcIds: GCIds = {
      tableIds: [
        ...query(collections)
          .collection('tableEntities')
          .selectAll()
          .filter(isGC(hasTableIds))
          .map(({ id }) => id),
      ],
      tableColumnIds: [],
      relationshipIds: [
        ...query(collections)
          .collection('relationshipEntities')
          .selectAll()
          .filter(isGC(hasRelationshipIds))
          .map(({ id }) => id),
      ],
      indexIds: [
        ...query(collections)
          .collection('indexEntities')
          .selectAll()
          .filter(isGC(hasIndexIds))
          .map(({ id }) => id),
      ],
      indexColumnIds: [],
      memoIds: [
        ...query(collections)
          .collection('memoEntities')
          .selectAll()
          .filter(isGC(hasMemoIds))
          .map(({ id }) => id),
      ],
    };

    const hasGCTableIds = arrayHas(gcIds.tableIds);
    const hasGCRelationshipIds = arrayHas(gcIds.relationshipIds);
    let hasGCIndexIds = arrayHas(gcIds.indexIds);

    gcIds.tableColumnIds.push(
      ...query(collections)
        .collection('tableColumnEntities')
        .selectAll()
        .filter(({ tableId }) => hasGCTableIds(tableId))
        .map(({ id }) => id)
    );

    gcIds.relationshipIds.push(
      ...query(collections)
        .collection('relationshipEntities')
        .selectAll()
        .filter(
          ({ id, start, end }) =>
            !hasGCRelationshipIds(id) &&
            (hasGCTableIds(start.tableId) || hasGCTableIds(end.tableId))
        )
        .map(({ id }) => id)
    );

    gcIds.indexIds.push(
      ...query(collections)
        .collection('indexEntities')
        .selectAll()
        .filter(
          ({ id, tableId }) => !hasGCIndexIds(id) && hasGCTableIds(tableId)
        )
        .map(({ id }) => id)
    );

    hasGCIndexIds = arrayHas(gcIds.indexIds);

    gcIds.indexColumnIds.push(
      ...query(collections)
        .collection('indexColumnEntities')
        .selectAll()
        .filter(({ indexId }) => hasGCIndexIds(indexId))
        .map(({ id }) => id)
    );

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
