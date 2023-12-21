import { query } from '@dineug/erd-editor-schema';
import { arrayHas } from '@dineug/shared';

import { ColumnType, Show } from '@/constants/schema';
import { ActionMap, ActionType } from '@/engine/modules/editor/actions';
import { FocusType, MoveKey } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

import { appendSelectColumns } from './selectRangeColumn';

type Payload = ActionMap[typeof ActionType.focusMoveTable];

const ColumnTypeToShowType: Record<number, number | true> = {
  [ColumnType.columnName]: true,
  [ColumnType.columnDataType]: Show.columnDataType,
  [ColumnType.columnNotNull]: Show.columnNotNull,
  [ColumnType.columnUnique]: Show.columnUnique,
  [ColumnType.columnAutoIncrement]: Show.columnAutoIncrement,
  [ColumnType.columnDefault]: Show.columnDefault,
  [ColumnType.columnComment]: Show.columnComment,
};
const ColumnTypeToFocusType: Record<number, FocusType> = {
  [ColumnType.columnName]: FocusType.columnName,
  [ColumnType.columnDataType]: FocusType.columnDataType,
  [ColumnType.columnNotNull]: FocusType.columnNotNull,
  [ColumnType.columnUnique]: FocusType.columnUnique,
  [ColumnType.columnAutoIncrement]: FocusType.columnAutoIncrement,
  [ColumnType.columnDefault]: FocusType.columnDefault,
  [ColumnType.columnComment]: FocusType.columnComment,
};
const TableFocusTypes: FocusType[] = [
  FocusType.tableName,
  FocusType.tableComment,
];

function getColumnTypes({
  settings: { show, columnOrder },
}: RootState): FocusType[] {
  return columnOrder
    .filter(key => {
      const showType = ColumnTypeToShowType[key];
      return showType === true ? true : bHas(show, showType);
    })
    .map(key => ColumnTypeToFocusType[key]);
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
  const index = columnTypes.indexOf(focusTable.focusType);
  return index === columnTypes.length - 1;
}

function isFirstColumn(state: RootState) {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return true;

  const columnTypes = getColumnTypes(state);
  const index = columnTypes.indexOf(focusTable.focusType);
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

function getFirstColumnType(state: RootState): FocusType {
  const columnTypes = getColumnTypes(state);
  return columnTypes[0];
}

function getNextRightColumnType(state: RootState): FocusType {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return FocusType.columnName;

  const columnTypes = getColumnTypes(state);
  const index = columnTypes.indexOf(focusTable.focusType);
  return isLastColumn(state) ? columnTypes[0] : columnTypes[index + 1];
}

function getNextLeftColumnType(state: RootState): FocusType {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return FocusType.columnName;

  const columnTypes = getColumnTypes(state);
  const index = columnTypes.indexOf(focusTable.focusType);
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

function getTableTypes({ settings: { show } }: RootState): FocusType[] {
  return bHas(show, Show.tableComment)
    ? TableFocusTypes
    : [FocusType.tableName];
}

export function isLastTable(state: RootState) {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return true;

  const tableTypes = getTableTypes(state);
  const index = tableTypes.indexOf(focusTable.focusType);
  return index === tableTypes.length - 1;
}

function isFirstTable(state: RootState) {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return true;

  const tableTypes = getTableTypes(state);
  const index = tableTypes.indexOf(focusTable.focusType);
  return index === 0;
}

export const isTableFocusType = arrayHas<FocusType>(TableFocusTypes);

function getNextRightTableType(state: RootState): FocusType {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return FocusType.tableName;

  const tableTypes = getTableTypes(state);
  const index = tableTypes.indexOf(focusTable.focusType);
  return isLastTable(state) ? tableTypes[0] : tableTypes[index + 1];
}

function getNextLeftTableType(state: RootState): FocusType {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return FocusType.tableName;

  const tableTypes = getTableTypes(state);
  const index = tableTypes.indexOf(focusTable.focusType);
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
      focusTable.focusType = FocusType.tableName;
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
      focusTable.focusType = FocusType.tableName;
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
        focusTable.focusType = bHas(state.settings.show, Show.tableComment)
          ? FocusType.tableComment
          : FocusType.tableName;
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
        focusTable.focusType = FocusType.tableName;
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
