import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';

import {
  addRelationshipAction,
  changeRelationshipColumnsAction,
} from '@/engine/modules/relationship/atom.actions';
import { toForeignKeyActions } from '@/engine/modules/relationship/fkColumns';
import { RootState } from '@/engine/state';

import { toAlignTypeActions } from './alignTypes';
import { CURRENT_KEY_ID, findColumnKey } from './candidateKeys';
import { getLiveTable, MapColumnsDraft, MappingRow } from './mapping';
import { getDraftEnds } from './validate';

/**
 * The rows in the order the key lists its columns now, a primary key's in
 * table order, so the two lists pair by place as the key is declared; the
 * stored mapping kept as it is keeps its own order.
 */
function orderRows(
  state: RootState,
  draft: MapColumnsDraft,
  startTableId: string
): MappingRow[] {
  const startTable = getLiveTable(state, startTableId);
  const key =
    startTable && draft.keyId !== null && draft.keyId !== CURRENT_KEY_ID
      ? findColumnKey(state, startTable, draft.keyId)
      : undefined;
  if (!key) return draft.rows;

  return key.columnIds.flatMap(columnId =>
    draft.rows.filter(({ parentColumnId }) => parentColumnId === columnId)
  );
}

/**
 * The one batch a confirmed mapping writes, for a draft validateMapping passes:
 * the new foreign key columns its New rows add, the data type changes the sync
 * makes, then the relationship it adds or the columns it changes.
 */
export function toMapColumnsActions(
  state: RootState,
  draft: MapColumnsDraft,
  createId: () => string
): AnyAction[] {
  const ends = getDraftEnds(state, draft);
  const startTable = ends && getLiveTable(state, ends.startTableId);
  const endTable = ends && getLiveTable(state, ends.endTableId);
  if (!ends || !startTable || !endTable) return [];

  const columns = query(state.collections).collection('tableColumnEntities');
  const rows = orderRows(state, draft, startTable.id);
  const newParents = rows.flatMap(({ parentColumnId, pick }) => {
    const parent =
      pick?.kind === 'new' && parentColumnId !== null
        ? columns.selectById(parentColumnId)
        : undefined;
    return parent ? [parent] : [];
  });
  const newColumnIds = newParents.map(() => createId());
  const newIdOf = new Map(
    newParents.map(({ id }, index) => [id, newColumnIds[index]])
  );
  const startColumnIds = rows.map(({ parentColumnId }) => parentColumnId ?? '');
  const endColumnIds = rows.map(({ parentColumnId, pick }) =>
    pick?.kind === 'existing'
      ? pick.columnId
      : (newIdOf.get(parentColumnId ?? '') ?? '')
  );
  // Each action gets lists of its own, which no reducer or history entry shares.
  const toEnds = () => ({
    start: { tableId: startTable.id, columnIds: [...startColumnIds] },
    end: { tableId: endTable.id, columnIds: [...endColumnIds] },
  });

  return [
    ...toForeignKeyActions(newParents, endTable.id, newColumnIds, {
      startTableName: startTable.name,
      endColumnNames: columns
        .selectByIds(endTable.columnIds)
        .map(({ name }) => name),
      database: state.settings.database,
    }),
    ...toAlignTypeActions(state, {
      relationshipId: ends.relationship?.id,
      ...toEnds(),
      newColumnIds,
    }),
    draft.mode === 'create'
      ? addRelationshipAction({
          id: createId(),
          relationshipType: draft.relationshipType,
          ...toEnds(),
        })
      : changeRelationshipColumnsAction({
          id: draft.relationshipId,
          ...toEnds(),
        }),
  ];
}
