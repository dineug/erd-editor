import { Store } from '../store';
import { ColumnType } from '../store/canvas.state';
import { MoveKey, TableType } from '../store/editor.state';
import { RelationshipType } from '../store/relationship.state';
import { CommandType } from './index';

export * from './editor.cmd.helper.gen';
export * from './editor/filter.cmd.helper';

export declare function hasUndoRedo(
  hasUndo: boolean,
  hasRedo: boolean
): CommandType<'editor.hasUndoRedo'>;

export declare function focusTable(
  tableId: string,
  focusType: TableType
): CommandType<'editor.focusTable'>;

export declare function focusColumn(
  tableId: string,
  columnId: string,
  focusType: ColumnType,
  ctrlKey: boolean,
  shiftKey: boolean
): CommandType<'editor.focusColumn'>;

export declare function focusTableEnd(): CommandType<'editor.focusTableEnd'>;

export declare function focusMoveTable(
  moveKey: MoveKey,
  shiftKey: boolean
): CommandType<'editor.focusMoveTable'>;

export declare function editTable(): CommandType<'editor.editTable'>;

export declare function editTableEnd(): CommandType<'editor.editTableEnd'>;

export declare function selectAllColumn(): CommandType<'editor.selectAllColumn'>;

export declare function drawStartRelationship(
  relationshipType: RelationshipType
): CommandType<'editor.drawStartRelationship'>;

export declare function drawStartAddRelationship(
  tableId: string
): CommandType<'editor.drawStartAddRelationship'>;

export declare function drawEndRelationship(): CommandType<'editor.drawEndRelationship'>;

export declare function drawRelationship(
  x: number,
  y: number
): CommandType<'editor.drawRelationship'>;

export declare function draggableColumn(
  store: Store,
  tableId: string,
  columnId: string,
  ctrlKey: boolean
): CommandType<'editor.draggableColumn'>;

export declare function draggableColumnEnd(): CommandType<'editor.draggableColumnEnd'>;

export declare function loadJson(value: string): CommandType<'editor.loadJson'>;

export declare function initLoadJson(
  value: string
): CommandType<'editor.initLoadJson'>;

export declare function clear(): CommandType<'editor.clear'>;

export declare function initClear(): CommandType<'editor.initClear'>;

export declare function changeViewport(
  width: number,
  height: number
): CommandType<'editor.changeViewport'>;

export declare function copyColumn(
  tableId: string,
  columnIds: string[]
): CommandType<'editor.copyColumn'>;

export declare function findActive(): CommandType<'editor.findActive'>;

export declare function findActiveEnd(): CommandType<'editor.findActiveEnd'>;

export declare function readonlyEditor(
  readonly: boolean
): CommandType<'editor.readonly'>;
