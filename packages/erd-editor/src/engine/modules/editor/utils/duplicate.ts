import { AnyAction } from '@dineug/r-html';
import { uuid25 } from '@dineug/uuid';

import { ColumnOption, OrderType } from '@/constants/schema';
import {
  addIndexAction,
  changeIndexNameAction,
  changeIndexUniqueAction,
} from '@/engine/modules/index/atom.actions';
import {
  addIndexColumnAction,
  changeIndexColumnOrderTypeAction,
} from '@/engine/modules/index-column/atom.actions';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableGroupAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  addTableGroupAction,
  changeTableGroupNameAction,
} from '@/engine/modules/table-group/atom.actions';
import { bHas } from '@/utils/bit';
import {
  ClipboardColumn,
  ClipboardIndex,
  ClipboardMemo,
  ClipboardRelationship,
  ClipboardTable,
  PlacementPoint,
} from '@/utils/table-clipboard';

/**
 * A table group a document brings, its rect where it lands and the source ids
 * of the tables it holds, which no clipboard payload carries.
 */
export type CreateEntityTableGroup = {
  sourceId: string;
  name: string;
  color: string;
  tableIds: string[];
  ui: { x: number; y: number; width: number; height: number; zIndex: number };
};

export type CreateEntityInput = {
  tables: ClipboardTable[];
  columns: ClipboardColumn[];
  memos: ClipboardMemo[];
  relationships: ClipboardRelationship[];
  indexes: ClipboardIndex[];
  tableGroups?: CreateEntityTableGroup[];
};

export type CreateEntityActions = {
  actions: AnyAction[];
  tableIds: string[];
  memoIds: string[];
  tableGroupIds: string[];
};

export type CreateEntityOptions = {
  /**
   * Whether a field is set only when it holds something other than what a new
   * entity starts with, an empty text, a flag off or an ascending order, which
   * leaves the same entities in fewer actions.
   */
  valuesOnly?: boolean;
};

// changeColor/memo.resize are in pushStreamHistoryMap and would land as a
// second, debounced history command, so colour and size ride the add payload.
export function toCreateEntityActions(
  {
    tables,
    columns,
    memos,
    relationships,
    indexes,
    tableGroups = [],
  }: CreateEntityInput,
  placement: Map<string, PlacementPoint>,
  { valuesOnly = false }: CreateEntityOptions = {}
): CreateEntityActions {
  const actions: AnyAction[] = [];
  const set = (holds: boolean, action: AnyAction) => {
    (holds || !valuesOnly) && actions.push(action);
  };
  const tableIds: string[] = [];
  const memoIds: string[] = [];
  const tableGroupIds: string[] = [];
  const columnBySourceId = new Map(
    columns.map(column => [column.sourceId, column])
  );
  const tableIdBySourceId = new Map<string, string>();
  const columnIdBySourceId = new Map<string, string>();

  for (const table of tables) {
    const point = placement.get(table.sourceId);
    if (!point) continue;

    const tableId = uuid25();
    tableIds.push(tableId);
    tableIdBySourceId.set(table.sourceId, tableId);

    actions.push(
      addTableAction({
        id: tableId,
        ui: {
          x: point.x,
          y: point.y,
          zIndex: point.zIndex,
          color: table.ui.color,
        },
      })
    );
    set(
      !!table.name,
      changeTableNameAction({ id: tableId, value: table.name })
    );
    set(
      !!table.comment,
      changeTableCommentAction({ id: tableId, value: table.comment })
    );

    for (const sourceColumnId of table.columnIds) {
      const column = columnBySourceId.get(sourceColumnId);
      if (!column) continue;

      const payload = { id: uuid25(), tableId };
      columnIdBySourceId.set(sourceColumnId, payload.id);

      const primaryKey = bHas(column.options, ColumnOption.primaryKey);
      const notNull = bHas(column.options, ColumnOption.notNull);
      const unique = bHas(column.options, ColumnOption.unique);
      const autoIncrement = bHas(column.options, ColumnOption.autoIncrement);

      actions.push(addColumnAction(payload));
      set(
        !!column.name,
        changeColumnNameAction({ ...payload, value: column.name })
      );
      set(
        !!column.dataType,
        changeColumnDataTypeAction({ ...payload, value: column.dataType })
      );
      set(
        !!column.default,
        changeColumnDefaultAction({ ...payload, value: column.default })
      );
      set(
        !!column.comment,
        changeColumnCommentAction({ ...payload, value: column.comment })
      );
      set(
        primaryKey,
        changeColumnPrimaryKeyAction({ ...payload, value: primaryKey })
      );
      set(notNull, changeColumnNotNullAction({ ...payload, value: notNull }));
      set(unique, changeColumnUniqueAction({ ...payload, value: unique }));
      set(
        autoIncrement,
        changeColumnAutoIncrementAction({ ...payload, value: autoIncrement })
      );
    }
  }

  // A relationship spans two tables, so both id maps have to be complete
  // before the first one is resolved. An id that fails to resolve drops the
  // whole relationship or the whole index, never part of one.
  for (const relationship of relationships) {
    const startTableId = tableIdBySourceId.get(relationship.start.tableId);
    const endTableId = tableIdBySourceId.get(relationship.end.tableId);
    if (!startTableId || !endTableId) continue;

    const startColumnIds = toNewColumnIds(
      relationship.start.columnIds,
      columnIdBySourceId
    );
    const endColumnIds = toNewColumnIds(
      relationship.end.columnIds,
      columnIdBySourceId
    );
    if (!startColumnIds || !endColumnIds) continue;

    actions.push(
      addRelationshipAction({
        id: uuid25(),
        relationshipType: relationship.relationshipType,
        onDelete: relationship.onDelete,
        onUpdate: relationship.onUpdate,
        start: { tableId: startTableId, columnIds: startColumnIds },
        end: { tableId: endTableId, columnIds: endColumnIds },
      })
    );
  }

  for (const index of indexes) {
    const tableId = tableIdBySourceId.get(index.tableId);
    if (!tableId) continue;

    const columnIds = toNewColumnIds(
      index.indexColumns.map(({ columnId }) => columnId),
      columnIdBySourceId
    );
    if (!columnIds) continue;

    const indexId = uuid25();

    actions.push(addIndexAction({ id: indexId, tableId }));
    set(
      !!index.name,
      changeIndexNameAction({ id: indexId, tableId, value: index.name })
    );
    set(
      index.unique,
      changeIndexUniqueAction({ id: indexId, tableId, value: index.unique })
    );

    index.indexColumns.forEach(({ orderType }, i) => {
      const id = uuid25();
      const columnId = columnIds[i];

      actions.push(addIndexColumnAction({ id, indexId, tableId, columnId }));
      set(
        orderType !== OrderType.ASC,
        changeIndexColumnOrderTypeAction({
          id,
          indexId,
          columnId,
          value: orderType,
        })
      );
    });
  }

  for (const memo of memos) {
    const point = placement.get(memo.sourceId);
    if (!point) continue;

    const memoId = uuid25();
    memoIds.push(memoId);

    actions.push(
      addMemoAction({
        id: memoId,
        ui: {
          x: point.x,
          y: point.y,
          zIndex: point.zIndex,
          color: memo.ui.color,
          width: memo.ui.width,
          height: memo.ui.height,
        },
      })
    );
    set(!!memo.value, changeMemoValueAction({ id: memoId, value: memo.value }));
  }

  // A group takes new ids for itself and its members alike, and a member the
  // input does not bring is left out of it.
  for (const group of tableGroups) {
    const tableGroupId = uuid25();
    tableGroupIds.push(tableGroupId);

    actions.push(
      addTableGroupAction({
        id: tableGroupId,
        color: group.color,
        ui: { ...group.ui },
      })
    );
    set(
      !!group.name,
      changeTableGroupNameAction({ id: tableGroupId, value: group.name })
    );

    for (const sourceTableId of group.tableIds) {
      const tableId = tableIdBySourceId.get(sourceTableId);
      if (!tableId) continue;

      actions.push(
        changeTableGroupAction({ id: tableId, value: tableGroupId })
      );
    }
  }

  return { actions, tableIds, memoIds, tableGroupIds };
}

/**
 * The two column id arrays of a relationship are paired by position, so one
 * unresolved id drops the whole relationship rather than shifting the pairing.
 */
function toNewColumnIds(
  sourceColumnIds: string[],
  columnIdBySourceId: Map<string, string>
): string[] | null {
  const columnIds: string[] = [];

  for (const sourceColumnId of sourceColumnIds) {
    const columnId = columnIdBySourceId.get(sourceColumnId);
    if (!columnId) return null;

    columnIds.push(columnId);
  }

  return columnIds;
}
