import { CommandType } from './index';
import { Store } from '../store';
import { ColumnType } from '../store/canvas.state';
import { TableType, MoveKey } from '../store/editor.state';
import { RelationshipType } from '../store/relationship.state';

export * from './editor.cmd.helper.gen';

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
