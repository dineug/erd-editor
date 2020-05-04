import { Store } from "./Store";
import { ColumnOption } from "./store/Table";
import { FilterState, FilterOperatorType } from "./store/Editor";
import { orderByNameASC } from "./helper/TableHelper";

export type SimpleOption = "PK" | "NN" | "UQ" | "AI";
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
  tables.forEach((table) => {
    table.columns.forEach((column) => {
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
      });
    });
  });
  return rows;
}

export function columnOptionToSimpleKeyToString(option: ColumnOption): string {
  const keys: string[] = [];
  if (option.primaryKey) {
    keys.push("PK");
  }
  if (option.notNull) {
    keys.push("NN");
  }
  if (option.unique) {
    keys.push("UQ");
  }
  if (option.autoIncrement) {
    keys.push("AI");
  }
  return keys.join(",");
}

export function changeColumnOptionList(
  oldValue: string,
  newValue: string
): SimpleOption[] {
  const changeSimpleOptions: SimpleOption[] = [];
  const oldSimpleOptions: SimpleOption[] = oldValue.split(",") as Array<
    SimpleOption
  >;
  const newSimpleOptions: SimpleOption[] = newValue.split(",") as Array<
    SimpleOption
  >;
  oldSimpleOptions.forEach((oldValue) => {
    if (!newSimpleOptions.some((newValue) => newValue === oldValue)) {
      changeSimpleOptions.push(oldValue);
    }
  });
  newSimpleOptions.forEach((newValue) => {
    if (!oldSimpleOptions.some((oldValue) => oldValue === newValue)) {
      changeSimpleOptions.push(newValue);
    }
  });
  return changeSimpleOptions;
}

export function currentColumnOptionList(
  columnOption: ColumnOption
): SimpleOption[] {
  const currentSimpleOptions: SimpleOption[] = [];
  if (columnOption.primaryKey) {
    currentSimpleOptions.push("PK");
  }
  if (columnOption.notNull) {
    currentSimpleOptions.push("NN");
  }
  if (columnOption.unique) {
    currentSimpleOptions.push("UQ");
  }
  if (columnOption.autoIncrement) {
    currentSimpleOptions.push("AI");
  }
  return currentSimpleOptions;
}

export function filterGridData(store: Store): GridRow[] {
  const rows = createGridData(store);
  const { filterStateList, filterOperatorType } = store.editorState;
  const activeFilterStateList = filterStateList.filter(
    (filterState) => filterState.value !== ""
  );
  if (activeFilterStateList.length !== 0) {
    return rows.filter((row) =>
      filterMatch(row, activeFilterStateList, filterOperatorType)
    );
  } else {
    return rows;
  }
}

function filterMatch(
  row: GridRow,
  filterStateList: FilterState[],
  filterOperatorType: FilterOperatorType
): boolean {
  let result = false;
  if (filterOperatorType === "OR") {
    result = filterStateList.some((filterState) =>
      filterValueMatch(row[filterState.columnType], filterState)
    );
  } else {
    result = !filterStateList.some(
      (filterState) =>
        !filterValueMatch(row[filterState.columnType], filterState)
    );
  }
  return result;
}

function filterValueMatch(value: string, filterState: FilterState): boolean {
  let result = false;
  switch (filterState.filterCode) {
    case "eq":
      result = value === filterState.value;
      break;
    case "ne":
      result = value !== filterState.value;
      break;
    case "contain":
      result = value.indexOf(filterState.value) !== -1;
      break;
    case "start":
      result = value.indexOf(filterState.value) === 0;
      break;
    case "end":
      const lastIndex = value.lastIndexOf(filterState.value);
      result = value.length === lastIndex + filterState.value.length;
      break;
  }
  return result;
}
