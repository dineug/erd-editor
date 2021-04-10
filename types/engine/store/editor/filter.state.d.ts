export interface FilterState {
  active: boolean;
  filters: Filter[];
  operatorType: OperatorType;
  focus: Focus | null;
  draggable: Draggable | null;
}

export interface Filter {
  id: string;
  columnType: ColumnType;
  filterCode: TextFilterCode;
  value: string;
}

export interface Focus {
  filterId: string | null;
  focusType: FocusType;
  selectFilterIds: string[];
  prevSelectFilterId: string | null;
  edit: boolean;
}

export interface Draggable {
  filterIds: string[];
}

export type OperatorType = 'AND' | 'OR';

export type TextFilterCode = 'eq' | 'ne' | 'contain' | 'start' | 'end';

export type ColumnType =
  | 'tableName'
  | 'tableComment'
  | 'option'
  | 'name'
  | 'dataType'
  | 'default'
  | 'comment';

export type FocusFilterType = 'columnType' | 'filterCode' | 'value';

export type FocusType = FocusFilterType | 'operatorType';
