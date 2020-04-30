import { Store } from "./Store";
import { ColumnOption } from "./store/Table";
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
