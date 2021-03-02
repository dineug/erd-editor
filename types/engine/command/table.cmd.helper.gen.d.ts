import { Store } from '../store';
import { CommandType } from './index';
import { drawStartAddRelationship$ } from './editor.cmd.helper';

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
