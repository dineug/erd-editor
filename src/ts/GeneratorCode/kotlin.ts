import StoreManagement from "@/store/StoreManagement";
import { Table, Column } from "@/store/table";
import { getPrimitiveType, getNameCase } from "../GeneratorCodeHelper";
import { Database } from "@/data/DataType";
import { Case } from "@/ts/GeneratorCode";
import { PrimitiveType } from "@/data/DataType";

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
  time: "LocalTime"
};

class kotlin {
  public toCode(store: StoreManagement): string {
    const stringBuffer: string[] = [];
    const tables = store.tableStore.state.tables;
    const database = store.canvasStore.state.database;
    const tableCase = store.canvasStore.state.tableCase;
    const columnCase = store.canvasStore.state.columnCase;

    tables.forEach(table => {
      this.formatTable(table, stringBuffer, database, tableCase, columnCase);
      stringBuffer.push("");
    });

    return stringBuffer.join("\n");
  }

  private formatTable(
    table: Table,
    buffer: string[],
    database: Database,
    tableCase: Case,
    columnCase: Case
  ) {
    const tableName = getNameCase(table.name, tableCase);
    if (table.comment.trim() !== "") {
      buffer.push(`// ${table.comment}`);
    }
    buffer.push(`class ${tableName} {`);
    table.columns.forEach(column => {
      this.formatColumn(column, buffer, database, columnCase);
    });
    buffer.push(`}`);
  }

  private formatColumn(
    column: Column,
    buffer: string[],
    database: Database,
    columnCase: Case
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
        `  var ${columnName}: ${
          typescriptType[primitiveType]
        } = ${this.getDefault(primitiveType)}`
      );
    } else {
      buffer.push(
        `  var ${columnName}: ${typescriptType[primitiveType]}? = null`
      );
    }
  }

  private getDefault(primitiveType: PrimitiveType) {
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
}

export default new kotlin();
