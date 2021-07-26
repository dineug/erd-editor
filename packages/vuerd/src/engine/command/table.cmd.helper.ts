import { uuid } from '@/core/helper';
import { SIZE_MIN_WIDTH } from '@/core/layout';
import { nextPoint, nextZIndex } from '@/engine/store/helper';
import { Helper } from '@@types/core/helper';
import { Store } from '@@types/engine/store';
import { Point } from '@@types/engine/store/relationship.state';
import { PureTable } from '@@types/engine/store/table.state';

import { ColumnModel } from '../store/models/column.model';
import { loadColumn } from './column.cmd.helper';
import { createCommand } from './helper';

export * from './table.cmd.helper.gen';

export function addTable(store: Store, active = true) {
  const { tableState, memoState } = store;
  const point = nextPoint(store);
  return createCommand('table.add', {
    id: uuid(),
    ui: {
      active,
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

export const hideTable = (tableId: string) =>
  createCommand('table.hide', { tableId });

export const showTable = (tableId: string) =>
  createCommand('table.show', { tableId });

export const addTableDefault = (tableId: string, helper: Helper) => {
  const idCol = new ColumnModel({
    addColumn: { tableId: tableId, id: uuid() },
  });
  idCol.name = 'id';
  idCol.dataType = 'INT';
  idCol.option.autoIncrement = true;
  idCol.option.primaryKey = true;
  idCol.ui.pk = true;

  const createdAt = new ColumnModel({
    addColumn: { tableId, id: uuid() },
  });
  createdAt.name = 'created_at';
  createdAt.dataType = 'timestamp';
  createdAt.ui.widthName = helper.getTextWidth('created_at');

  const updatedAt = new ColumnModel({
    addColumn: { tableId, id: uuid() },
  });
  updatedAt.name = 'updated_at';
  updatedAt.dataType = 'timestamp';
  createdAt.ui.widthName = helper.getTextWidth('updated_at');
  createdAt.ui.widthDataType = helper.getTextWidth('timestamp');

  return loadColumn(tableId, [updatedAt, createdAt, idCol], []);
};
