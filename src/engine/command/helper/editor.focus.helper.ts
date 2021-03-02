import { State } from '@@types/engine/store';
import { FocusMoveTable } from '@@types/engine/command/editor.cmd';
import { ShowKey, ColumnType } from '@@types/engine/store/canvas.state';
import {
  FocusTable,
  FocusType,
  TableType,
} from '@@types/engine/store/editor.state';
import { tableTypes } from '@/engine/store/editor.state';
import { getIndex } from '@/core/helper';
import { appendSelectColumns } from './editor.helper';

function getColumnTypes({
  canvasState: {
    show,
    setting: { columnOrder },
  },
}: State): ColumnType[] {
  const showKeys = Object.keys(show).filter(key => show[key as ShowKey]);
  const match = new RegExp(showKeys.join('|'), 'i');
  return ['columnName', ...columnOrder.filter(key => match.test(key))];
}

export const isColumns = (focusTable: FocusTable) =>
  !!focusTable.table.columns.length;

export function isLastColumn(state: State) {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return true;

  const columnTypes = getColumnTypes(state);
  const index = columnTypes.indexOf(focusTable.focusType as ColumnType);
  return index === columnTypes.length - 1;
}

function isFirstColumn(state: State) {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return true;

  const columnTypes = getColumnTypes(state);
  const index = columnTypes.indexOf(focusTable.focusType as ColumnType);
  return index === 0;
}

export function isLastRowColumn({ table, columnId }: FocusTable) {
  if (!columnId) return true;
  const index = getIndex(table.columns, columnId);
  return index === table.columns.length - 1;
}

function isFirstRowColumn({ table, columnId }: FocusTable) {
  if (!columnId) return true;
  const index = getIndex(table.columns, columnId);
  return index === 0;
}

function getLastColumnType(state: State): FocusType {
  const columnTypes = getColumnTypes(state);
  return columnTypes[columnTypes.length - 1];
}

function getFirstColumnType(state: State): FocusType {
  const columnTypes = getColumnTypes(state);
  return columnTypes[0];
}

function getNextRightColumnType(state: State): FocusType {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return 'columnName';

  const columnTypes = getColumnTypes(state);
  const index = columnTypes.indexOf(focusTable.focusType as ColumnType);
  return isLastColumn(state) ? columnTypes[0] : columnTypes[index + 1];
}

function getNextLeftColumnType(state: State): FocusType {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return 'columnName';

  const columnTypes = getColumnTypes(state);
  const index = columnTypes.indexOf(focusTable.focusType as ColumnType);
  return isFirstColumn(state)
    ? columnTypes[columnTypes.length - 1]
    : columnTypes[index - 1];
}

export function getRemoveFirstColumnId(
  focusTable: FocusTable,
  columnIds: string[]
) {
  if (!focusTable.columnId) return null;

  const columnIndex = getIndex(
    focusTable.table.columns,
    focusTable.columnId as string
  );

  if (columnIndex <= 0) return null;

  let columnId = null;
  for (let i = columnIndex; i >= 0; i--) {
    const column = focusTable.table.columns[i];

    if (!columnIds.includes(column.id)) {
      columnId = column.id;
      break;
    }
  }

  return columnId;
}

function getTableTypes({ canvasState: { show } }: State): TableType[] {
  return show.tableComment ? ['tableName', 'tableComment'] : ['tableName'];
}

export function isLastTable(state: State) {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return true;

  const tableTypes = getTableTypes(state);
  const index = tableTypes.indexOf(focusTable.focusType as TableType);
  return index === tableTypes.length - 1;
}

function isFirstTable(state: State) {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return true;

  const tableTypes = getTableTypes(state);
  const index = tableTypes.indexOf(focusTable.focusType as TableType);
  return index === 0;
}

export const isTableFocusType = (focusType: FocusType) =>
  tableTypes.includes(focusType as any);

function getNextRightTableType(state: State): FocusType {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return 'tableName';

  const tableTypes = getTableTypes(state);
  const index = tableTypes.indexOf(focusTable.focusType as TableType);
  return isLastTable(state) ? tableTypes[0] : tableTypes[index + 1];
}

function getNextLeftTableType(state: State): FocusType {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return 'tableName';

  const tableTypes = getTableTypes(state);
  const index = tableTypes.indexOf(focusTable.focusType as TableType);
  return isFirstTable(state)
    ? tableTypes[tableTypes.length - 1]
    : tableTypes[index - 1];
}

export function arrowUp(state: State, data: FocusMoveTable) {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return;

  if (isTableFocusType(focusTable.focusType)) {
    if (isColumns(focusTable)) {
      const columnId =
        focusTable.table.columns[focusTable.table.columns.length - 1].id;

      focusTable.focusType = getLastColumnType(state);
      focusTable.columnId = columnId;
      focusTable.prevSelectColumnId = columnId;
      focusTable.selectColumnIds = [columnId];
    }
  } else {
    if (isFirstRowColumn(focusTable)) {
      focusTable.focusType = 'tableName';
      focusTable.columnId = null;
      focusTable.prevSelectColumnId = null;
      focusTable.selectColumnIds = [];
    } else if (focusTable.columnId) {
      const index = getIndex(focusTable.table.columns, focusTable.columnId);
      const column = focusTable.table.columns[index - 1];

      focusTable.columnId = column.id;
      focusTable.prevSelectColumnId = column.id;
      if (data.shiftKey && data.moveKey !== 'Tab') {
        focusTable.selectColumnIds = appendSelectColumns(
          focusTable.selectColumnIds,
          column.id
        );
      } else {
        focusTable.selectColumnIds = [column.id];
      }
    }
  }
}

export function arrowDown(state: State, data: FocusMoveTable) {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return;

  if (isTableFocusType(focusTable.focusType)) {
    if (isColumns(focusTable)) {
      const columnId = focusTable.table.columns[0].id;

      focusTable.focusType = getFirstColumnType(state);
      focusTable.columnId = columnId;
      focusTable.prevSelectColumnId = columnId;
      focusTable.selectColumnIds = [columnId];
    }
  } else {
    if (isLastRowColumn(focusTable)) {
      focusTable.focusType = 'tableName';
      focusTable.columnId = null;
      focusTable.prevSelectColumnId = null;
      focusTable.selectColumnIds = [];
    } else if (focusTable.columnId) {
      const index = getIndex(focusTable.table.columns, focusTable.columnId);
      const column = focusTable.table.columns[index + 1];

      focusTable.columnId = column.id;
      focusTable.prevSelectColumnId = column.id;
      if (data.shiftKey && data.moveKey !== 'Tab') {
        focusTable.selectColumnIds = appendSelectColumns(
          focusTable.selectColumnIds,
          column.id
        );
      } else {
        focusTable.selectColumnIds = [column.id];
      }
    }
  }
}

export function arrowRight(state: State, data: FocusMoveTable) {
  const {
    editorState: { focusTable },
  } = state;
  if (!focusTable) return;

  if (isTableFocusType(focusTable.focusType)) {
    if (isLastTable(state)) {
      if (isColumns(focusTable)) {
        const columnId = focusTable.table.columns[0].id;

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
      if (isLastRowColumn(focusTable)) {
        focusTable.focusType = 'tableName';
        focusTable.columnId = null;
        focusTable.prevSelectColumnId = null;
        focusTable.selectColumnIds = [];
      } else if (focusTable.columnId) {
        const index = getIndex(focusTable.table.columns, focusTable.columnId);
        const column = focusTable.table.columns[index + 1];

        focusTable.focusType = getFirstColumnType(state);
        focusTable.columnId = column.id;
        focusTable.prevSelectColumnId = column.id;
        if (data.shiftKey && data.moveKey !== 'Tab') {
          focusTable.selectColumnIds = appendSelectColumns(
            focusTable.selectColumnIds,
            column.id
          );
        } else {
          focusTable.selectColumnIds = [column.id];
        }
      }
    } else {
      focusTable.focusType = getNextRightColumnType(state);
      if (!data.shiftKey && focusTable.columnId) {
        focusTable.prevSelectColumnId = focusTable.columnId;
        focusTable.selectColumnIds = [focusTable.columnId];
      }
    }
  }
}

export function arrowLeft(state: State, data: FocusMoveTable) {
  const {
    editorState: { focusTable },
    canvasState: { show },
  } = state;
  if (!focusTable) return;

  if (isTableFocusType(focusTable.focusType)) {
    if (isFirstTable(state)) {
      if (isColumns(focusTable)) {
        const columnId =
          focusTable.table.columns[focusTable.table.columns.length - 1].id;

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
      if (isFirstRowColumn(focusTable)) {
        focusTable.focusType = show.tableComment ? 'tableComment' : 'tableName';
        focusTable.columnId = null;
        focusTable.prevSelectColumnId = null;
        focusTable.selectColumnIds = [];
      } else if (focusTable.columnId) {
        const index = getIndex(focusTable.table.columns, focusTable.columnId);
        const column = focusTable.table.columns[index - 1];

        focusTable.focusType = getLastColumnType(state);
        focusTable.columnId = column.id;
        focusTable.prevSelectColumnId = column.id;
        if (data.shiftKey && data.moveKey !== 'Tab') {
          focusTable.selectColumnIds = appendSelectColumns(
            focusTable.selectColumnIds,
            column.id
          );
        } else {
          focusTable.selectColumnIds = [column.id];
        }
      }
    } else {
      focusTable.focusType = getNextLeftColumnType(state);
      if (!data.shiftKey && focusTable.columnId) {
        focusTable.prevSelectColumnId = focusTable.columnId;
        focusTable.selectColumnIds = [focusTable.columnId];
      }
    }
  }
}
