import StoreManagement from "@/store/StoreManagement";
import { Table, Column } from "@/store/table";
import { getPrimitiveType } from "../GeneratorCodeHelper";
import { Database } from "@/data/DataType";

const typescriptType: { [key: string]: string } = {
  int: "long",
  float: "double",
  boolean: "bool",
  string: "string",
  date: "DateTime",
  dateTime: "DateTime",
  time: "TimeSpan"
};

class cs {
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
    buffer.push(`public class ${table.name} {`);
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
      `  public ${typescriptType[primitiveType]} ${column.name
        .charAt(0)
        .toLocaleUpperCase() + column.name.slice(1)} { get; set; }`
    );
  }
}

export default new cs();
