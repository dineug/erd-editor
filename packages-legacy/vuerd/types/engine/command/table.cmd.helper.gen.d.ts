import { Helper } from '../../core/helper';
import { Store } from '../store';
import { drawStartAddRelationship$ } from './editor.cmd.helper';
import { CommandType } from './index';

export declare function addTable$(
  store: Store,
  active?: boolean
): Generator<
  | CommandType<'table.selectEnd'>
  | CommandType<'memo.selectEnd'>
  | CommandType<'table.add'>
  | CommandType<'editor.focusTable'>
>;

export declare function selectTable$(
  store: Store,
  ctrlKey: boolean,
  tableId: string
): Generator<
  | CommandType<'table.select'>
  | CommandType<'memo.selectEnd'>
  | CommandType<'editor.focusTable'>
  | CommandType<'editor.drawEndRelationship'>
  | CommandType<'relationship.add'>
  | CommandType<'column.addCustom'>
  | ReturnType<typeof drawStartAddRelationship$>
>;

export declare function selectEndTable$(): Generator<
  CommandType<'table.selectEnd'> | CommandType<'editor.focusTableEnd'>
>;

export declare function addTableDefault$(
  tableId: string,
  helper: Helper
): Generator<CommandType<'column.load'>>;
