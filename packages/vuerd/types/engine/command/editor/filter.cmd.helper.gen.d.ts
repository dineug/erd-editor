import { Store } from '../../store';
import { MoveKey } from '../../store/editor.state';
import { CommandType } from '../index';

export declare function filterActive$(): Generator<
  CommandType<'editor.filter.active'> | CommandType<'editor.filter.focus'>
>;

export declare function filterActiveEnd$(): Generator<
  CommandType<'editor.filter.activeEnd'> | CommandType<'editor.filter.focusEnd'>
>;

export declare function addFilter$(): Generator<
  CommandType<'editor.filter.add'> | CommandType<'editor.filter.focusFilter'>
>;

export declare function removeFilter$(
  store: Store,
  filterIds: string[]
): Generator<
  | CommandType<'editor.filter.remove'>
  | CommandType<'editor.filter.focus'>
  | CommandType<'editor.filter.focusFilter'>
>;

export declare function focusMoveFilter$(
  store: Store,
  moveKey: MoveKey,
  shiftKey: boolean
): Generator<
  CommandType<'editor.filter.focusMove'> | ReturnType<typeof addFilter$>
>;
