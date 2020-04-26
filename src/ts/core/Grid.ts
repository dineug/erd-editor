import { Store } from "./Store";
import { ColumnOption } from "./store/Table";
import { orderByNameASC } from "./helper/TableHelper";

export type SimpleOption = "PK" | "NN" | "UQ" | "AI";
export interface GridData {
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

export function createGridData(store: Store): GridData[] {
  const rows: GridData[] = [];
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
