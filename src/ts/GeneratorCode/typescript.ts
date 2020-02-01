import StoreManagement from "@/store/StoreManagement";
import { Table, Column } from "@/store/table";
import { getPrimitiveType, getNameCase } from "../GeneratorCodeHelper";
import { Case } from "@/ts/GeneratorCode";
import { Database } from "@/data/DataType";
import { camelCase, pascalCase, snakeCase } from "change-case";

const typescriptType: { [key: string]: string } = {
  int: "number",
  float: "number",
  boolean: "boolean",
  string: "string",
  date: "string",
  dateTime: "string",
  time: "string"
};

class typescript {
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
    buffer.push(`export interface ${tableName} {`);
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
    buffer.push(`  ${columnName}: ${typescriptType[primitiveType]};`);
  }
}

export default new typescript();
