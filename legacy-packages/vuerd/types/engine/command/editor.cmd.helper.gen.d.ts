import { Store } from '../store';
import { MoveKey } from '../store/editor.state';
import { RelationshipType } from '../store/relationship.state';
import { addColumn$ } from './column.cmd.helper';
import { CommandType } from './index';
import { selectEndTable$ } from './table.cmd.helper.gen';

export declare function focusMoveTable$(
  store: Store,
  moveKey: MoveKey,
  shiftKey: boolean
): Generator<
  CommandType<'editor.focusMoveTable'> | ReturnType<typeof addColumn$>
>;

export declare function drawStartRelationship$(
  store: Store,
  relationshipType: RelationshipType
): Generator<
  | CommandType<'editor.drawStartRelationship'>
  | CommandType<'editor.drawEndRelationship'>
>;

export declare function drawStartAddRelationship$(
  store: Store,
  tableId: string
): Generator<
  | CommandType<'editor.drawStartAddRelationship'>
  | CommandType<'column.addCustom'>
  | CommandType<'editor.focusColumn'>
>;

export declare function loadJson$(
  value: string
): Generator<CommandType<'editor.clear'> | CommandType<'editor.loadJson'>>;

export declare function initLoadJson$(
  value: string
): Generator<
  CommandType<'editor.initClear'> | CommandType<'editor.initLoadJson'>
>;

export declare function pasteColumn$(
  store: Store
): Generator<CommandType<'column.addCustom'>>;

export declare function findActive$(): Generator<
  | CommandType<'editor.findActive'>
  | ReturnType<typeof selectEndTable$>
  | CommandType<'memo.selectEnd'>
>;

export declare function readonlyEditor$(
  readonly: boolean
): Generator<
  | CommandType<'editor.editTableEnd'>
  | CommandType<'editor.drawEndRelationship'>
  | CommandType<'editor.draggableColumnEnd'>
  | CommandType<'editor.readonly'>
>;
