import { State } from '@@types/engine/store';
import {
  HasUndoRedo,
  FocusTable,
  FocusColumn,
  FocusMoveTable,
} from '@@types/engine/command/editor.cmd';
import {
  DrawStartRelationship,
  DrawStartAddRelationship,
  DrawRelationship,
  DraggableColumn,
} from '@@types/engine/command/editor.cmd';
import { getData } from '@/core/helper';
import {
  appendSelectColumns,
  selectRangeColumns,
  appendSelectRangeColumns,
} from './helper/editor.helper';
import {
  arrowUp,
  arrowRight,
  arrowDown,
  arrowLeft,
} from './helper/editor.focus.helper';

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
    editorState.focusTable.prevSelectColumnId = null;
    editorState.focusTable.selectColumnIds = [];
  } else if (data.focusType) {
    const table = getData(tables, data.tableId);
    if (!table) return;

    editorState.focusTable = {
      table,
      focusType: data.focusType,
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
      edit: false,
    };
  } else if (editorState.focusTable?.table.id !== data.tableId) {
    const table = getData(tables, data.tableId);
    if (!table) return;

    editorState.focusTable = {
      table,
      focusType: 'tableName',
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
      edit: false,
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
      focusTable.selectColumnIds = [data.columnId];
    }

    focusTable.prevSelectColumnId = data.columnId;
  } else {
    const table = getData(tables, data.tableId);
    if (!table) return;

    editorState.focusTable = {
      table,
      focusType: data.focusType,
      columnId: data.columnId,
      prevSelectColumnId: data.columnId,
      selectColumnIds: [data.columnId],
      edit: false,
    };
  }
}

export function executeFocusTableEnd({ editorState }: State) {
  editorState.focusTable = null;
}

export function executeFocusMoveTable(state: State, data: FocusMoveTable) {
  const { editorState } = state;
  if (!editorState.focusTable) return;
  editorState.focusTable.edit = false;

  switch (data.moveKey) {
    case 'ArrowUp':
      arrowUp(state, data);
      break;
    case 'ArrowDown':
      arrowDown(state, data);
      break;
    case 'ArrowLeft':
      arrowLeft(state, data);
      break;
    case 'ArrowRight':
      arrowRight(state, data);
      break;
    case 'Tab':
      data.shiftKey ? arrowLeft(state, data) : arrowRight(state, data);
      break;
  }
}

export function executeEditTable({ editorState: { focusTable } }: State) {
  if (!focusTable) return;
  focusTable.edit = true;
}

export function executeEditTableEnd({ editorState: { focusTable } }: State) {
  if (!focusTable) return;
  focusTable.edit = false;
}

export function executeSelectAllColumn({ editorState: { focusTable } }: State) {
  if (!focusTable) return;
  focusTable.selectColumnIds = focusTable.table.columns.map(
    column => column.id
  );
}

export function executeDrawStartRelationship(
  { editorState }: State,
  data: DrawStartRelationship
) {
  editorState.drawRelationship = {
    relationshipType: data.relationshipType,
    start: null,
    end: {
      x: 0,
      y: 0,
    },
  };
}

export function executeDrawStartAddRelationship(
  { tableState: { tables }, editorState: { drawRelationship } }: State,
  data: DrawStartAddRelationship
) {
  if (!drawRelationship) return;

  const table = getData(tables, data.tableId);
  if (!table) return;

  drawRelationship.start = {
    table,
    x: table.ui.left,
    y: table.ui.top,
  };
}

export function executeDrawEndRelationship({ editorState }: State) {
  editorState.drawRelationship = null;
}

export function executeDrawRelationship(
  {
    editorState: { drawRelationship },
    canvasState: { scrollLeft, scrollTop },
  }: State,
  data: DrawRelationship
) {
  if (!drawRelationship?.start) return;

  drawRelationship.end.x = data.x - scrollLeft;
  drawRelationship.end.y = data.y - scrollTop;
}

export function executeDraggableColumn(
  { editorState }: State,
  data: DraggableColumn
) {
  editorState.draggableColumn = data;
}

export const executeEditorCommandMap = {
  'editor.hasUndoRedo': executeHasUndoRedo,
  'editor.focusTable': executeFocusTable,
  'editor.focusColumn': executeFocusColumn,
  'editor.focusTableEnd': executeFocusTableEnd,
  'editor.focusMoveTable': executeFocusMoveTable,
  'editor.editTable': executeEditTable,
  'editor.editTableEnd': executeEditTableEnd,
  'editor.selectAllColumn': executeSelectAllColumn,
  'editor.drawStartRelationship': executeDrawStartRelationship,
  'editor.drawStartAddRelationship': executeDrawStartAddRelationship,
  'editor.drawEndRelationship': executeDrawEndRelationship,
  'editor.drawRelationship': executeDrawRelationship,
  'editor.draggableColumn': executeDraggableColumn,
};
