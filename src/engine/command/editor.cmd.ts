import { State } from '@@types/engine/store';
import {
  HasUndoRedo,
  FocusTable,
  FocusColumn,
} from '@@types/engine/command/editor.cmd';
import { getData } from '@/core/helper';
import {
  appendSelectColumns,
  selectRangeColumns,
  appendSelectRangeColumns,
} from './editor.helper';

export function executeHasUndoRedo({ editorState }: State, data: HasUndoRedo) {
  editorState.hasUndo = data.hasUndo;
  editorState.hasRedo = data.hasRedo;
}

export function executeFocusTable(
  { editorState, tableState: { tables } }: State,
  data: FocusTable
) {
  if (editorState.focusTable?.table.id === data.tableId && data.focusType) {
    editorState.focusTable.focusType = data.focusType;
    editorState.focusTable.columnId = null;
    editorState.focusTable.selectColumnIds = [];
  } else if (data.focusType) {
    const table = getData(tables, data.tableId);
    if (!table) return;

    editorState.focusTable = {
      table,
      focusType: data.focusType,
      columnId: null,
      selectColumnIds: [],
      prevSelectColumnId: null,
    };
  } else if (editorState.focusTable?.table.id !== data.tableId) {
    const table = getData(tables, data.tableId);
    if (!table) return;

    editorState.focusTable = {
      table,
      focusType: 'tableName',
      columnId: null,
      selectColumnIds: [],
      prevSelectColumnId: null,
    };
  }
}

export function executeFocusColumn(
  { editorState, tableState: { tables } }: State,
  data: FocusColumn
) {
  if (editorState.focusTable?.table.id === data.tableId) {
    const focusTable = editorState.focusTable;
    focusTable.columnId = data.columnId;
    focusTable.focusType = data.focusType;

    if (data.ctrlKey && data.shiftKey) {
      focusTable.selectColumnIds = appendSelectRangeColumns(
        focusTable.table.columns,
        focusTable.selectColumnIds,
        focusTable.prevSelectColumnId,
        focusTable.columnId
      );
    } else if (data.shiftKey) {
      focusTable.selectColumnIds = selectRangeColumns(
        focusTable.table.columns,
        focusTable.prevSelectColumnId,
        focusTable.columnId
      );
    } else if (data.ctrlKey) {
      focusTable.selectColumnIds = appendSelectColumns(
        focusTable.selectColumnIds,
        data.columnId
      );
    } else {
      editorState.focusTable.selectColumnIds = [data.columnId];
    }

    editorState.focusTable.prevSelectColumnId = data.columnId;
  } else {
    const table = getData(tables, data.tableId);
    if (!table) return;

    editorState.focusTable = {
      table,
      focusType: data.focusType,
      columnId: data.columnId,
      selectColumnIds: [data.columnId],
      prevSelectColumnId: data.columnId,
    };
  }
}

export function executeFocusTableEnd({ editorState }: State) {
  editorState.focusTable = null;
}

export const executeEditorCommandMap = {
  'editor.hasUndoRedo': executeHasUndoRedo,
  'editor.focusTable': executeFocusTable,
  'editor.focusColumn': executeFocusColumn,
  'editor.focusTableEnd': executeFocusTableEnd,
};
