import { Store } from "../Store";
import { Table, Column } from "../store/Table";
import { Database, NameCase } from "../store/Canvas";
import { getPrimitiveType, getNameCase } from "../helper/GeneratorCodeHelper";
import { orderByNameASC } from "../helper/TableHelper";
import { PrimitiveType } from "../DataType";

const typescriptType: { [key: string]: string } = {
  int: "Int",
  long: "Long",
  float: "Float",
  double: "Double",
  decimal: "BigDecimal",
  boolean: "Boolean",
  string: "String",
  lob: "String",
  date: "LocalDate",
  dateTime: "LocalDateTime",
  time: "LocalTime",
};

export function createCode(store: Store): string {
  const stringBuffer: string[] = [""];
  const { database, tableCase, columnCase } = store.canvasState;
  const tables = orderByNameASC(store.tableState.tables);

  tables.forEach((table) => {
    formatTable(table, stringBuffer, database, tableCase, columnCase);
    stringBuffer.push("");
  });

  return stringBuffer.join("\n");
}

function formatTable(
  table: Table,
  buffer: string[],
  database: Database,
  tableCase: NameCase,
  columnCase: NameCase
) {
  const tableName = getNameCase(table.name, tableCase);
  if (table.comment.trim() !== "") {
    buffer.push(`// ${table.comment}`);
  }
  buffer.push(`class ${tableName} {`);
  table.columns.forEach((column) => {
    formatColumn(column, buffer, database, columnCase);
  });
  buffer.push(`}`);
}

function formatColumn(
  column: Column,
  buffer: string[],
  database: Database,
  columnCase: NameCase
) {
  const columnName = getNameCase(column.name, columnCase);
  const primitiveType = getPrimitiveType(column.dataType, database);
  if (column.comment.trim() !== "") {
    buffer.push(`  // ${column.comment}`);
  }
  if (
    column.option.notNull &&
    primitiveType !== "date" &&
    primitiveType !== "dateTime" &&
    primitiveType !== "time"
  ) {
    buffer.push(
      `  var ${columnName}: ${typescriptType[primitiveType]} = ${getDefault(
        primitiveType
      )}`
    );
  } else {
    buffer.push(
      `  var ${columnName}: ${typescriptType[primitiveType]}? = null`
    );
  }
}

function getDefault(primitiveType: PrimitiveType) {
  switch (primitiveType) {
    case "int":
    case "long":
      return 0;
    case "float":
      return "0.0f";
    case "double":
      return "0.0";
    case "boolean":
      return false;
    case "string":
    case "lob":
      return '""';
    case "decimal":
      return "BigDecimal.ZERO";
    case "date":
    case "dateTime":
    case "time":
      return null;
  }
}
