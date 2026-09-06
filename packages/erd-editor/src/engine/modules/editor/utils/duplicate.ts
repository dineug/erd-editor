import { AnyAction } from '@dineug/r-html';
import { nanoid } from 'nanoid';

import { ColumnOption } from '@/constants/schema';
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
import { bHas } from '@/utils/bit';
import {
  ClipboardColumn,
  ClipboardIndex,
  ClipboardMemo,
  ClipboardRelationship,
  ClipboardTable,
  PlacementPoint,
} from '@/utils/table-clipboard';

export type CreateEntityInput = {
  tables: ClipboardTable[];
  columns: ClipboardColumn[];
  memos: ClipboardMemo[];
  relationships: ClipboardRelationship[];
  indexes: ClipboardIndex[];
};

export type CreateEntityActions = {
  actions: AnyAction[];
  tableIds: string[];
  memoIds: string[];
};

// changeColor/memo.resize are in pushStreamHistoryMap and would land as a
// second, debounced history command, so colour and size ride the add payload.
export function toCreateEntityActions(
  { tables, columns, memos, relationships, indexes }: CreateEntityInput,
  placement: Map<string, PlacementPoint>
): CreateEntityActions {
  const actions: AnyAction[] = [];
  const tableIds: string[] = [];
  const memoIds: string[] = [];
  const columnBySourceId = new Map(
    columns.map(column => [column.sourceId, column])
  );
  const tableIdBySourceId = new Map<string, string>();
  const columnIdBySourceId = new Map<string, string>();

  for (const table of tables) {
    const point = placement.get(table.sourceId);
    if (!point) continue;

    const tableId = nanoid();
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
      }),
      changeTableNameAction({ id: tableId, value: table.name }),
      changeTableCommentAction({ id: tableId, value: table.comment })
    );

    for (const sourceColumnId of table.columnIds) {
      const column = columnBySourceId.get(sourceColumnId);
      if (!column) continue;

      const payload = { id: nanoid(), tableId };
      columnIdBySourceId.set(sourceColumnId, payload.id);

      actions.push(
        addColumnAction(payload),
        changeColumnNameAction({ ...payload, value: column.name }),
        changeColumnDataTypeAction({ ...payload, value: column.dataType }),
        changeColumnDefaultAction({ ...payload, value: column.default }),
        changeColumnCommentAction({ ...payload, value: column.comment }),
        changeColumnPrimaryKeyAction({
          ...payload,
          value: bHas(column.options, ColumnOption.primaryKey),
        }),
        changeColumnNotNullAction({
          ...payload,
          value: bHas(column.options, ColumnOption.notNull),
        }),
        changeColumnUniqueAction({
          ...payload,
          value: bHas(column.options, ColumnOption.unique),
        }),
        changeColumnAutoIncrementAction({
          ...payload,
          value: bHas(column.options, ColumnOption.autoIncrement),
        })
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
        id: nanoid(),
        relationshipType: relationship.relationshipType,
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

    const indexId = nanoid();

    actions.push(
      addIndexAction({ id: indexId, tableId }),
      changeIndexNameAction({ id: indexId, tableId, value: index.name }),
      changeIndexUniqueAction({ id: indexId, tableId, value: index.unique })
    );

    index.indexColumns.forEach(({ orderType }, i) => {
      const id = nanoid();
      const columnId = columnIds[i];

      actions.push(
        addIndexColumnAction({ id, indexId, tableId, columnId }),
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

    const memoId = nanoid();
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
      }),
      changeMemoValueAction({ id: memoId, value: memo.value })
    );
  }

  return { actions, tableIds, memoIds };
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
