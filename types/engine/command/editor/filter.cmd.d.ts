import {
  ColumnType,
  TextFilterCode,
  OperatorType,
  Draggable,
} from '../../store/editor/filter.state';
import { MoveKey } from '../../store/editor.state';

export interface AddFilter {
  id: string;
}

export interface RemoveFilter {
  filterIds: string[];
}

export interface ChangeFilterColumnType {
  filterId: string;
  columnType: ColumnType;
}

export interface changeFilterCode {
  filterId: string;
  filterCode: TextFilterCode;
}

export interface ChangeFilterValue {
  filterId: string;
  value: string;
}

export interface MoveFilter {
  filterIds: string[];
  targetFilterId: string;
}

export interface ChangeOperatorType {
  operatorType: OperatorType;
}

export interface Focus {
  focusType?: 'operatorType';
}

export interface FocusFilter {
  filterId: string;
  focusType: ColumnType;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface FocusMove {
  moveKey: MoveKey;
  shiftKey: boolean;
}

export interface FilterCommandMap {
  'editor.filter.active': null;
  'editor.filter.activeEnd': null;
}

/**
 * editor.filter.add
 * editor.filter.remove
 * editor.filter.changeColumnType
 * editor.filter.changeFilterCode
 * editor.filter.changeValue
 * editor.filter.move
 *
 * editor.filter.changeOperatorType
 *
 * editor.filter.focus
 * editor.filter.focusFilter
 * editor.filter.focusEnd - null
 * editor.filter.focusMove
 * editor.filter.edit - null
 * editor.filter.editEnd - null
 * editor.filter.selectAll - null
 *
 * editor.filter.draggable
 * editor.filter.draggableEnd - null
 */
