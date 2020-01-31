import StoreManagement from "@/store/StoreManagement";
import { Table, Column } from "@/store/table";
import { getPrimitiveType } from "../GeneratorCodeHelper";
import { Database } from "@/data/DataType";

const typescriptType: { [key: string]: string } = {
  int: "Long",
  float: "Double",
  boolean: "boolean",
  string: "String",
  date: "LocalDate",
  dateTime: "LocalDateTime",
  time: "LocalTime"
};

class kotlin {
  public toCode(store: StoreManagement): string {
    const stringBuffer: string[] = [];
    const tables = store.tableStore.state.tables;
    const database = store.canvasStore.state.database;

    tables.forEach(table => {
      this.formatTable(table, stringBuffer, database);
      stringBuffer.push("");
    });

    return stringBuffer.join("\n");
  }

  private formatTable(table: Table, buffer: string[], database: Database) {
    if (table.comment.trim() !== "") {
      buffer.push(`// ${table.comment}`);
    }
    buffer.push(`class ${table.name} {`);
    table.columns.forEach(column => {
      this.formatColumn(column, buffer, database);
    });
    buffer.push(`}`);
  }

  private formatColumn(column: Column, buffer: string[], database: Database) {
    const primitiveType = getPrimitiveType(column.dataType, database);
    if (column.comment.trim() !== "") {
      buffer.push(`  // ${column.comment}`);
    }
    buffer.push(
      `  var ${column.name}: ${typescriptType[primitiveType]}? = null`
    );
  }
}

export default new kotlin();
