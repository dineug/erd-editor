import {
  ColumnType,
  TextFilterCode,
  OperatorType,
  Draggable,
  FocusFilterType,
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
  focusType: FocusFilterType;
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
  'editor.filter.add': AddFilter;
  'editor.filter.remove': RemoveFilter;
  'editor.filter.changeColumnType': ChangeFilterColumnType;
  'editor.filter.changeFilterCode': changeFilterCode;
  'editor.filter.changeValue': ChangeFilterValue;
  'editor.filter.move': MoveFilter;
  'editor.filter.changeOperatorType': ChangeOperatorType;
  'editor.filter.focus': Focus;
  'editor.filter.focusFilter': FocusFilter;
  'editor.filter.focusEnd': null;
  'editor.filter.focusMove': FocusMove;
  'editor.filter.edit': null;
  'editor.filter.editEnd': null;
  'editor.filter.selectAll': null;
  'editor.filter.draggable': Draggable;
  'editor.filter.draggableEnd': null;
}
