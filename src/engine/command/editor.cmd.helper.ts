import { Store } from '@@types/engine/store';
import { ColumnType } from '@@types/engine/store/canvas.state';
import { TableType, MoveKey } from '@@types/engine/store/editor.state';
import { RelationshipType } from '@@types/engine/store/relationship.state';
import { createCommand } from './helper';

export * from './editor.cmd.helper.gen';

export const hasUndoRedo = (hasUndo: boolean, hasRedo: boolean) =>
  createCommand('editor.hasUndoRedo', { hasUndo, hasRedo });

export const focusTable = (tableId: string, focusType?: TableType) =>
  createCommand('editor.focusTable', { tableId, focusType });

export const focusColumn = (
  tableId: string,
  columnId: string,
  focusType: ColumnType,
  ctrlKey = false,
  shiftKey = false
) =>
  createCommand('editor.focusColumn', {
    tableId,
    columnId,
    focusType,
    ctrlKey,
    shiftKey,
  });

export const focusTableEnd = () => createCommand('editor.focusTableEnd', null);

export const focusMoveTable = (moveKey: MoveKey, shiftKey: boolean) =>
  createCommand('editor.focusMoveTable', { moveKey, shiftKey });

export const editTable = () => createCommand('editor.editTable', null);

export const editTableEnd = () => createCommand('editor.editTableEnd', null);

export const selectAllColumn = () =>
  createCommand('editor.selectAllColumn', null);

export const drawStartRelationship = (relationshipType: RelationshipType) =>
  createCommand('editor.drawStartRelationship', { relationshipType });

export const drawStartAddRelationship = (tableId: string) =>
  createCommand('editor.drawStartAddRelationship', { tableId });

export const drawEndRelationship = () =>
  createCommand('editor.drawEndRelationship', null);

export const drawRelationship = (x: number, y: number) =>
  createCommand('editor.drawRelationship', { x, y });

export const draggableColumn = (
  { editorState: { focusTable } }: Store,
  tableId: string,
  columnId: string,
  ctrlKey: boolean
) =>
  createCommand('editor.draggableColumn', {
    tableId,
    columnIds:
      ctrlKey && focusTable ? [...focusTable.selectColumnIds] : [columnId],
  });

export const draggableColumnEnd = () =>
  createCommand('editor.draggableColumnEnd', null);

export const loadJson = (value: string) =>
  createCommand('editor.loadJson', { value });

export const clear = () => createCommand('editor.clear', null);

export const changeViewport = (width: number, height: number) =>
  createCommand('editor.changeViewport', { width, height });
