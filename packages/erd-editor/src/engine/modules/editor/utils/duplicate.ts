import { AnyAction } from '@dineug/r-html';
import { nanoid } from 'nanoid';

import { ColumnOption } from '@/constants/schema';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
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
  ClipboardMemo,
  ClipboardTable,
  PlacementPoint,
} from '@/utils/table-clipboard';

export type CreateEntityInput = {
  tables: ClipboardTable[];
  columns: ClipboardColumn[];
  memos: ClipboardMemo[];
};

export type CreateEntityActions = {
  actions: AnyAction[];
  tableIds: string[];
  memoIds: string[];
};

// changeColor/memo.resize are in pushStreamHistoryMap and would land as a
// second, debounced history command, so colour and size ride the add payload.
export function toCreateEntityActions(
  { tables, columns, memos }: CreateEntityInput,
  placement: Map<string, PlacementPoint>
): CreateEntityActions {
  const actions: AnyAction[] = [];
  const tableIds: string[] = [];
  const memoIds: string[] = [];
  const columnBySourceId = new Map(
    columns.map(column => [column.sourceId, column])
  );

  for (const table of tables) {
    const point = placement.get(table.sourceId);
    if (!point) continue;

    const tableId = nanoid();
    tableIds.push(tableId);

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
