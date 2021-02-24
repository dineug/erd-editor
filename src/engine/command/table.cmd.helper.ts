import { Point } from '@@types/engine/store/relationship.helper';
import { Store } from '@@types/engine/store';
import { PureTable } from '@@types/engine/store/table.state';
import { Helper } from '@@types/core/helper';
import { createCommand } from './helper';
import { SIZE_MIN_WIDTH } from '@/core/layout';
import { uuid } from '@/core/helper';
import { nextZIndex, nextPoint } from '@/engine/store/helper';

export * from './table.cmd.helper.gen';

export function addTable(store: Store) {
  const { tableState, memoState } = store;
  const point = nextPoint(store);
  return createCommand('table.add', {
    id: uuid(),
    ui: {
      active: true,
      left: point.x,
      top: point.y,
      zIndex: nextZIndex(tableState.tables, memoState.memos),
    },
  });
}

export const moveTable = (
  {
    tableState: { tables },
    memoState: { memos },
    canvasState: { zoomLevel },
  }: Store,
  ctrlKey: boolean,
  movementX: number,
  movementY: number,
  tableId: string
) =>
  createCommand('table.move', {
    movementX: movementX / zoomLevel,
    movementY: movementY / zoomLevel,
    tableIds: ctrlKey
      ? tables.filter(table => table.ui.active).map(table => table.id)
      : [tableId],
    memoIds: ctrlKey
      ? memos.filter(memo => memo.ui.active).map(memo => memo.id)
      : [],
  });

export const removeTable = (
  { tableState: { tables } }: Store,
  tableId?: string
) =>
  createCommand('table.remove', {
    tableIds: tableId
      ? [tableId]
      : tables.filter(table => table.ui.active).map(table => table.id),
  });

export const selectTable = (
  { tableState: { tables }, memoState: { memos } }: Store,
  ctrlKey: boolean,
  tableId: string
) =>
  createCommand('table.select', {
    ctrlKey,
    tableId,
    zIndex: nextZIndex(tables, memos),
  });

export const selectEndTable = () => createCommand('table.selectEnd', null);

export const selectAllTable = () => createCommand('table.selectAll', null);

export const selectOnlyTable = (
  { tableState: { tables }, memoState: { memos } }: Store,
  tableId: string
) =>
  createCommand('table.selectOnly', {
    tableId,
    zIndex: nextZIndex(tables, memos),
  });

export function changeTableName(
  helper: Helper,
  tableId: string,
  value: string
) {
  const width = helper.getTextWidth(value);
  return createCommand('table.changeName', {
    tableId,
    value,
    width: width < SIZE_MIN_WIDTH ? SIZE_MIN_WIDTH : width,
  });
}

export function changeTableComment(
  helper: Helper,
  tableId: string,
  value: string
) {
  const width = helper.getTextWidth(value);
  return createCommand('table.changeComment', {
    tableId,
    value,
    width: width < SIZE_MIN_WIDTH ? SIZE_MIN_WIDTH : width,
  });
}

export const dragSelectTable = (min: Point, max: Point) =>
  createCommand('table.dragSelect', {
    min,
    max,
  });

export const sortTable = () => createCommand('table.sort', null);

export const loadTable = (table: PureTable) =>
  createCommand('table.load', table);
