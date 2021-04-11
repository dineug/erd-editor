import { CommandType } from '../index';
import { Store } from '../../store';
import {
  ColumnType,
  TextFilterCode,
  OperatorType,
  FocusFilterType,
} from '../../store/editor/filter.state';
import { MoveKey } from '../../store/editor.state';

export * from './filter.cmd.helper.gen';

export declare function filterActive(): CommandType<'editor.filter.active'>;

export declare function filterActiveEnd(): CommandType<'editor.filter.activeEnd'>;

export declare function addFilter(): CommandType<'editor.filter.add'>;

export declare function removeFilter(
  filterIds: string[]
): CommandType<'editor.filter.remove'>;

export declare function changeFilterColumnType(
  filterId: string,
  columnType: ColumnType
): CommandType<'editor.filter.changeColumnType'>;

export declare function changeFilterCode(
  filterId: string,
  filterCode: TextFilterCode
): CommandType<'editor.filter.changeFilterCode'>;

export declare function changeFilterValue(
  filterId: string,
  value: string
): CommandType<'editor.filter.changeValue'>;

export declare function moveFilter(
  filterIds: string[],
  targetFilterId: string
): CommandType<'editor.filter.move'>;

export declare function changeFilterOperatorType(
  operatorType: OperatorType
): CommandType<'editor.filter.changeOperatorType'>;

export declare function filterFocus(
  focusType?: 'operatorType'
): CommandType<'editor.filter.focus'>;

export declare function focusFilter(
  filterId: string,
  focusType: FocusFilterType,
  ctrlKey: boolean,
  shiftKey: boolean
): CommandType<'editor.filter.focusFilter'>;

export declare function focusFilterEnd(): CommandType<'editor.filter.focusEnd'>;

export declare function focusMoveFilter(
  moveKey: MoveKey,
  shiftKey: boolean
): CommandType<'editor.filter.focusMove'>;

export declare function editFilter(): CommandType<'editor.filter.edit'>;

export declare function editFilterEnd(): CommandType<'editor.filter.editEnd'>;

export declare function selectAllFilter(): CommandType<'editor.filter.selectAll'>;

export declare function draggableFilter(
  store: Store,
  filterId: string,
  ctrlKey: boolean
): CommandType<'editor.filter.draggable'>;

export declare function draggableFilterEnd(): CommandType<'editor.filter.draggableEnd'>;
