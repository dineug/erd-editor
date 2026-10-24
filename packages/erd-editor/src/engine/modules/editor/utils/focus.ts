import { query } from '@dineug/erd-editor-schema';

import { ActionMap, ActionType } from '@/engine/modules/editor/actions';
import { FocusType, MoveKey } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { arrayHas } from '@/utils/arrayHas';
import { isHighLevelTable } from '@/utils/validation';

import {
  getColumnFocusTypes,
  getTableFocusTypes,
  toShownFocusType,
} from './nameView';
import { appendSelectColumns } from './selectRangeColumn';

type Payload = ActionMap[typeof ActionType.focusMoveTable];

/** The focus types a table's own fields take, whichever view lays them out. */
const TableFocusTypes: FocusType[] = [
  FocusType.tableName,
  FocusType.tableLogicalName,
  FocusType.tableComment,
];

function getColumnTypes({ settings }: RootState): FocusType[] {
  return getColumnFocusTypes(settings);
}

/**
 * Where the focus stands among the cells given: its own cell, or the one the
 * name view draws in its place, so a focus taken in another view walks on
 * from where the reader sees it.
 */
function indexOfFocus(
  { settings }: RootState,
  types: FocusType[],
  focusType: FocusType
): number {
  return types.indexOf(
    toShownFocusType(settings, types, focusType) ?? focusType
  );
}

export function isColumns({ collections, editor: { focusTable } }: RootState) {
  if (!focusTable) return false;
  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  return Boolean(table?.columnIds.length);
}

export function isLastColumn(state: RootState) {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return true;

  const columnTypes = getColumnTypes(state);
  const index = indexOfFocus(state, columnTypes, focusTable.focusType);
  return index === columnTypes.length - 1;
}

function isFirstColumn(state: RootState) {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return true;

  const columnTypes = getColumnTypes(state);
  const index = indexOfFocus(state, columnTypes, focusTable.focusType);
  return index === 0;
}

export function isLastRowColumn({
  collections,
  editor: { focusTable },
}: RootState) {
  if (!focusTable?.columnId) {
    return true;
  }

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return true;

  const index = table.columnIds.indexOf(focusTable.columnId);
  return index === table.columnIds.length - 1;
}

function isFirstRowColumn({ collections, editor: { focusTable } }: RootState) {
  if (!focusTable?.columnId) {
    return true;
  }

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return true;

  const index = table.columnIds.indexOf(focusTable.columnId);
  return index === 0;
}

function getLastColumnType(state: RootState): FocusType {
  const columnTypes = getColumnTypes(state);
  return columnTypes[columnTypes.length - 1];
}

/**
 * The cell a row's focus starts on, the first the view lays out: the one a
 * new column takes, the logical name in the view of both under the default order.
 */
export function getFirstColumnType(state: RootState): FocusType {
  const columnTypes = getColumnTypes(state);
  return columnTypes[0];
}

function getNextRightColumnType(state: RootState): FocusType {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return FocusType.columnName;

  const columnTypes = getColumnTypes(state);
  const index = indexOfFocus(state, columnTypes, focusTable.focusType);
  return isLastColumn(state) ? columnTypes[0] : columnTypes[index + 1];
}

function getNextLeftColumnType(state: RootState): FocusType {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return FocusType.columnName;

  const columnTypes = getColumnTypes(state);
  const index = indexOfFocus(state, columnTypes, focusTable.focusType);
  return isFirstColumn(state)
    ? columnTypes[columnTypes.length - 1]
    : columnTypes[index - 1];
}

export function getRemoveFirstColumnId(state: RootState, columnIds: string[]) {
  const {
    collections,
    editor: { focusTable },
  } = state;
  if (!focusTable?.columnId) return null;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return null;

  const columnIndex = table.columnIds.indexOf(focusTable.columnId);
  if (columnIndex <= 0) return null;

  let columnId = null;
  for (let i = columnIndex; i >= 0; i--) {
    const currentColumnId = table.columnIds[i];

    if (!columnIds.includes(currentColumnId)) {
      columnId = currentColumnId;
      break;
    }
  }

  return columnId;
}

/**
 * The columns a command on the focused column reaches: the selection still in
 * the table when the focused column is one of two or more of it, else that
 * column alone. A column removed by a peer, an agent or an undo stays selected.
 */
export function getFocusedColumnIds({
  editor: { focusTable },
  collections,
}: RootState): string[] {
  if (!focusTable?.columnId) return [];

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return [];

  const { columnId } = focusTable;
  const selected = focusTable.selectColumnIds.filter(arrayHas(table.columnIds));

  return selected.length > 1 && selected.includes(columnId)
    ? selected
    : [columnId];
}

export type RemovableColumns = {
  tableId: string;
  columnIds: string[];
};

/**
 * The columns Delete removes: those selected and still in the focused table
 * while it is the one table, memo or group selected and the zoom draws its
 * rows. Null otherwise, where the selected tables, memos and groups go instead.
 */
export function getRemovableColumns({
  doc: { tableIds, memoIds, tableGroupIds },
  editor: { focusTable, selectedMap },
  settings: { zoomLevel },
  collections,
}: RootState): RemovableColumns | null {
  if (!focusTable?.selectColumnIds.length || isHighLevelTable(zoomLevel)) {
    return null;
  }

  // A table, memo, group or column a peer, an agent or an undo removes stays selected.
  const selectedIds = Object.keys(selectedMap).filter(
    arrayHas([...tableIds, ...memoIds, ...tableGroupIds])
  );
  if (selectedIds.length !== 1 || selectedIds[0] !== focusTable.tableId) {
    return null;
  }

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return null;

  const columnIds = focusTable.selectColumnIds.filter(
    arrayHas(table.columnIds)
  );

  return columnIds.length ? { tableId: focusTable.tableId, columnIds } : null;
}

function getTableTypes({ settings }: RootState): FocusType[] {
  return getTableFocusTypes(settings);
}

/** The header cell a focus leaving the rows forwards lands on, the first the view lays out. */
function getFirstTableType(state: RootState): FocusType {
  return getTableTypes(state)[0];
}

/** The header cell a focus leaving the rows backwards lands on, the last the view lays out. */
function getLastTableType(state: RootState): FocusType {
  const tableTypes = getTableTypes(state);
  return tableTypes[tableTypes.length - 1];
}

export function isLastTable(state: RootState) {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return true;

  const tableTypes = getTableTypes(state);
  const index = indexOfFocus(state, tableTypes, focusTable.focusType);
  return index === tableTypes.length - 1;
}

function isFirstTable(state: RootState) {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return true;

  const tableTypes = getTableTypes(state);
  const index = indexOfFocus(state, tableTypes, focusTable.focusType);
  return index === 0;
}

export const isTableFocusType = arrayHas<FocusType>(TableFocusTypes);

function getNextRightTableType(state: RootState): FocusType {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return FocusType.tableName;

  const tableTypes = getTableTypes(state);
  const index = indexOfFocus(state, tableTypes, focusTable.focusType);
  return isLastTable(state) ? tableTypes[0] : tableTypes[index + 1];
}

function getNextLeftTableType(state: RootState): FocusType {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return FocusType.tableName;

  const tableTypes = getTableTypes(state);
  const index = indexOfFocus(state, tableTypes, focusTable.focusType);
  return isFirstTable(state)
    ? tableTypes[tableTypes.length - 1]
    : tableTypes[index - 1];
}

export function arrowUp(state: RootState, payload: Payload) {
  const {
    collections,
    editor: { focusTable },
  } = state;
  if (!focusTable) return;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return;

  if (isTableFocusType(focusTable.focusType)) {
    if (isColumns(state)) {
      const columnId = table.columnIds[table.columnIds.length - 1];

      focusTable.focusType = getLastColumnType(state);
      focusTable.columnId = columnId;
      focusTable.prevSelectColumnId = columnId;
      focusTable.selectColumnIds = [columnId];
    }
  } else {
    if (isFirstRowColumn(state)) {
      focusTable.focusType = getFirstTableType(state);
      focusTable.columnId = null;
      focusTable.prevSelectColumnId = null;
      focusTable.selectColumnIds = [];
    } else if (focusTable.columnId) {
      const index = table.columnIds.indexOf(focusTable.columnId);
      const columnId = table.columnIds[index - 1];

      focusTable.columnId = columnId;
      focusTable.prevSelectColumnId = columnId;
      if (payload.shiftKey && payload.moveKey !== MoveKey.Tab) {
        focusTable.selectColumnIds = appendSelectColumns(
          focusTable.selectColumnIds,
          columnId
        );
      } else {
        focusTable.selectColumnIds = [columnId];
      }
    }
  }
}

export function arrowDown(state: RootState, payload: Payload) {
  const {
    collections,
    editor: { focusTable },
  } = state;
  if (!focusTable) return;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return;

  if (isTableFocusType(focusTable.focusType)) {
    if (isColumns(state)) {
      const columnId = table.columnIds[0];

      focusTable.focusType = getFirstColumnType(state);
      focusTable.columnId = columnId;
      focusTable.prevSelectColumnId = columnId;
      focusTable.selectColumnIds = [columnId];
    }
  } else {
    if (isLastRowColumn(state)) {
      focusTable.focusType = getFirstTableType(state);
      focusTable.columnId = null;
      focusTable.prevSelectColumnId = null;
      focusTable.selectColumnIds = [];
    } else if (focusTable.columnId) {
      const index = table.columnIds.indexOf(focusTable.columnId);
      const columnId = table.columnIds[index + 1];

      focusTable.columnId = columnId;
      focusTable.prevSelectColumnId = columnId;
      if (payload.shiftKey && payload.moveKey !== MoveKey.Tab) {
        focusTable.selectColumnIds = appendSelectColumns(
          focusTable.selectColumnIds,
          columnId
        );
      } else {
        focusTable.selectColumnIds = [columnId];
      }
    }
  }
}

export function arrowLeft(state: RootState, payload: Payload) {
  const {
    collections,
    editor: { focusTable },
  } = state;
  if (!focusTable) return;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return;

  if (isTableFocusType(focusTable.focusType)) {
    if (isFirstTable(state)) {
      if (isColumns(state)) {
        const columnId = table.columnIds[table.columnIds.length - 1];

        focusTable.focusType = getLastColumnType(state);
        focusTable.columnId = columnId;
        focusTable.prevSelectColumnId = columnId;
        focusTable.selectColumnIds = [columnId];
      } else {
        focusTable.focusType = getNextLeftTableType(state);
      }
    } else {
      focusTable.focusType = getNextLeftTableType(state);
    }
  } else {
    if (isFirstColumn(state)) {
      if (isFirstRowColumn(state)) {
        focusTable.focusType = getLastTableType(state);
        focusTable.columnId = null;
        focusTable.prevSelectColumnId = null;
        focusTable.selectColumnIds = [];
      } else if (focusTable.columnId) {
        const index = table.columnIds.indexOf(focusTable.columnId);
        const columnId = table.columnIds[index - 1];

        focusTable.focusType = getLastColumnType(state);
        focusTable.columnId = columnId;
        focusTable.prevSelectColumnId = columnId;
        if (payload.shiftKey && payload.moveKey !== MoveKey.Tab) {
          focusTable.selectColumnIds = appendSelectColumns(
            focusTable.selectColumnIds,
            columnId
          );
        } else {
          focusTable.selectColumnIds = [columnId];
        }
      }
    } else {
      focusTable.focusType = getNextLeftColumnType(state);
      if (!payload.shiftKey && focusTable.columnId) {
        focusTable.prevSelectColumnId = focusTable.columnId;
        focusTable.selectColumnIds = [focusTable.columnId];
      }
    }
  }
}

export function arrowRight(state: RootState, payload: Payload) {
  const {
    collections,
    editor: { focusTable },
  } = state;
  if (!focusTable) return;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return;

  if (isTableFocusType(focusTable.focusType)) {
    if (isLastTable(state)) {
      if (isColumns(state)) {
        const columnId = table.columnIds[0];

        focusTable.focusType = getFirstColumnType(state);
        focusTable.columnId = columnId;
        focusTable.prevSelectColumnId = columnId;
        focusTable.selectColumnIds = [columnId];
      } else {
        focusTable.focusType = getNextRightTableType(state);
      }
    } else {
      focusTable.focusType = getNextRightTableType(state);
    }
  } else {
    if (isLastColumn(state)) {
      if (isLastRowColumn(state)) {
        focusTable.focusType = getFirstTableType(state);
        focusTable.columnId = null;
        focusTable.prevSelectColumnId = null;
        focusTable.selectColumnIds = [];
      } else if (focusTable.columnId) {
        const index = table.columnIds.indexOf(focusTable.columnId);
        const columnId = table.columnIds[index + 1];

        focusTable.focusType = getFirstColumnType(state);
        focusTable.columnId = columnId;
        focusTable.prevSelectColumnId = columnId;
        if (payload.shiftKey && payload.moveKey !== MoveKey.Tab) {
          focusTable.selectColumnIds = appendSelectColumns(
            focusTable.selectColumnIds,
            columnId
          );
        } else {
          focusTable.selectColumnIds = [columnId];
        }
      }
    } else {
      focusTable.focusType = getNextRightColumnType(state);
      if (!payload.shiftKey && focusTable.columnId) {
        focusTable.prevSelectColumnId = focusTable.columnId;
        focusTable.selectColumnIds = [focusTable.columnId];
      }
    }
  }
}
