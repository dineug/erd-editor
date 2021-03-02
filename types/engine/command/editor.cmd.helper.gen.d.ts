import { CommandType } from './index';
import { Store } from '../store';
import { MoveKey } from '../store/editor.state';
import { RelationshipType } from '../store/relationship.state';
import { addColumn$ } from './column.cmd.helper';

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
