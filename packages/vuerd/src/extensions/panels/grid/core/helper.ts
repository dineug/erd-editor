import { Store } from '@@types/engine/store';
import { ColumnOption } from '@@types/engine/store/table.state';
import { Filter, OperatorType } from '@@types/engine/store/editor/filter.state';
import { orderByNameASC } from '@/engine/store/helper/table.helper';

export type SimpleOption = 'PK' | 'NN' | 'UQ' | 'AI';
export interface GridRow {
  tableId: string;
  columnId: string;
  tableName: string;
  tableComment: string;
  option: string;
  name: string;
  dataType: string;
  default: string;
  comment: string;
}

export function createGridData(store: Store): GridRow[] {
  const rows: GridRow[] = [];
  const tables = orderByNameASC(store.tableState.tables);

  tables.forEach(table =>
    table.columns.forEach(column =>
      rows.push({
        tableId: table.id,
        columnId: column.id,
        tableName: table.name,
        tableComment: table.comment,
        option: columnOptionToSimpleKeyToString(column.option),
        name: column.name,
        dataType: column.dataType,
        default: column.default,
        comment: column.comment,
      })
    )
  );

  return rows;
}

export function columnOptionToSimpleKeyToString(option: ColumnOption): string {
  const keys: string[] = [];
  if (option.primaryKey) {
    keys.push('PK');
  }
  if (option.notNull) {
    keys.push('NN');
  }
  if (option.unique) {
    keys.push('UQ');
  }
  if (option.autoIncrement) {
    keys.push('AI');
  }
  return keys.join(',');
}

export function changeColumnOptionList(
  oldValue: string,
  newValue: string
): SimpleOption[] {
  const changeSimpleOptions: SimpleOption[] = [];
  const oldSimpleOptions: SimpleOption[] = oldValue.split(
    ','
  ) as SimpleOption[];
  const newSimpleOptions: SimpleOption[] = newValue.split(
    ','
  ) as SimpleOption[];

  oldSimpleOptions.forEach(oldValue => {
    if (newSimpleOptions.includes(oldValue)) return;
    changeSimpleOptions.push(oldValue);
  });
  newSimpleOptions.forEach(newValue => {
    if (oldSimpleOptions.includes(newValue)) return;
    changeSimpleOptions.push(newValue);
  });

  return changeSimpleOptions;
}

export function currentColumnOptionList(
  columnOption: ColumnOption
): SimpleOption[] {
  const currentSimpleOptions: SimpleOption[] = [];
  if (columnOption.primaryKey) {
    currentSimpleOptions.push('PK');
  }
  if (columnOption.notNull) {
    currentSimpleOptions.push('NN');
  }
  if (columnOption.unique) {
    currentSimpleOptions.push('UQ');
  }
  if (columnOption.autoIncrement) {
    currentSimpleOptions.push('AI');
  }
  return currentSimpleOptions;
}

export function filterGridData(store: Store): GridRow[] {
  const { filters, operatorType } = store.editorState.filterState;
  const rows = createGridData(store);
  const activeFilterStateList = filters.filter(filter => filter.value !== '');

  return activeFilterStateList.length
    ? rows.filter(row => filterMatch(row, activeFilterStateList, operatorType))
    : rows;
}

const filterMatch = (
  row: GridRow,
  filters: Filter[],
  operatorType: OperatorType
): boolean =>
  operatorType === 'OR'
    ? filters.some(filter => filterValueMatch(row[filter.columnType], filter))
    : !filters.some(
        filter => !filterValueMatch(row[filter.columnType], filter)
      );

function filterValueMatch(value: string, filter: Filter): boolean {
  let result = false;
  switch (filter.filterCode) {
    case 'eq':
      result = value === filter.value;
      break;
    case 'ne':
      result = value !== filter.value;
      break;
    case 'contain':
      result = value.indexOf(filter.value) !== -1;
      break;
    case 'start':
      result = value.indexOf(filter.value) === 0;
      break;
    case 'end':
      const lastIndex = value.lastIndexOf(filter.value);
      result = value.length === lastIndex + filter.value.length;
      break;
  }
  return result;
}
