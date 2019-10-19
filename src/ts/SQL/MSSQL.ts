import StoreManagement from "@/store/StoreManagement";
import { Table, Column } from "@/store/table";
import { Relationship } from "@/store/relationship";
import { getData, autoName, uuid } from "@/ts/util";
import {
  formatNames,
  formatSize,
  formatSpace,
  primaryKey,
  primaryKeyColumns,
  unique,
  uniqueColumns,
  MaxLength,
  Name,
  KeyColumn
} from "../SQLHelper";

class MSSQL {
  private fkNames: Name[] = [];

  public toDDL(store: StoreManagement): string {
    this.fkNames = [];
    const stringBuffer: string[] = [];
    const tables = store.tableStore.state.tables;
    const relationships = store.relationshipStore.state.relationships;
    const canvas = store.canvasStore.state;

    stringBuffer.push(`DROP DATABASE [${canvas.databaseName}]\nGO`);
    stringBuffer.push("");
    stringBuffer.push(`CREATE DATABASE [${canvas.databaseName}]\nGO`);
    stringBuffer.push("");
    stringBuffer.push(`USE [${canvas.databaseName}]\nGO`);
    stringBuffer.push("");

    tables.forEach(table => {
      this.formatTable(canvas.databaseName, table, stringBuffer);
      stringBuffer.push("");
      // unique
      if (unique(table.columns)) {
        const uqColumns = uniqueColumns(table.columns);
        uqColumns.forEach(column => {
          stringBuffer.push(
            `ALTER TABLE [${canvas.databaseName}].[${table.name}]`
          );
          stringBuffer.push(
            `\tADD CONSTRAINT [UQ_${column.name}] UNIQUE ([${column.name}])\nGO`
          );
          stringBuffer.push("");
        });
      }
      this.formatComment(canvas.databaseName, table, stringBuffer);
    });
    relationships.forEach(relationship => {
      this.formatRelation(
        canvas.databaseName,
        tables,
        relationship,
        stringBuffer
      );
      stringBuffer.push("");
    });

    return stringBuffer.join("\n");
  }

  private formatTable(name: string, table: Table, buffer: string[]) {
    buffer.push(`CREATE TABLE [${name}].[${table.name}]`);
    buffer.push(`(`);
    const pk = primaryKey(table.columns);
    const spaceSize = formatSize(table.columns);

    table.columns.forEach((column, i) => {
      if (pk) {
        this.formatColumn(column, true, spaceSize, buffer);
      } else {
        this.formatColumn(
          column,
          table.columns.length !== i + 1,
          spaceSize,
          buffer
        );
      }
    });
    // PK
    if (pk) {
      const pkColumns = primaryKeyColumns(table.columns);
      buffer.push(
        `\tCONSTRAINT [PK_${table.name}] PRIMARY KEY (${formatNames(
          pkColumns,
          "[",
          "]"
        )})`
      );
    }
    buffer.push(`)\nGO`);
  }

  private formatColumn(
    column: Column,
    isComma: boolean,
    spaceSize: MaxLength,
    buffer: string[]
  ) {
    const stringBuffer: string[] = [];
    stringBuffer.push(
      `\t[${column.name}]` + formatSpace(spaceSize.name - column.name.length)
    );
    stringBuffer.push(
      `[${column.dataType}]` +
        formatSpace(spaceSize.dataType - column.dataType.length)
    );
    if (column.option.notNull) {
      stringBuffer.push(`NOT NULL`);
    }
    if (column.option.autoIncrement) {
      stringBuffer.push(`IDENTITY`);
    } else {
      if (column.default.trim() !== "") {
        stringBuffer.push(`DEFAULT ${column.default}`);
      }
    }
    buffer.push(stringBuffer.join(" ") + `${isComma ? "," : ""}`);
  }

  private formatComment(name: string, table: Table, buffer: string[]) {
    if (table.comment.trim() !== "") {
      buffer.push(`EXECUTE sys.sp_addextendedproperty 'MS_Description',`);
      buffer.push(
        `\t'${table.comment}', 'user', dbo, 'table', '${name}.${table.name}'\nGO`
      );
      buffer.push("");
    }
    table.columns.forEach(column => {
      if (column.comment.trim() !== "") {
        buffer.push(`EXECUTE sp_addextendedproperty 'MS_Description',`);
        buffer.push(
          `\t'${column.comment}', 'user', dbo, 'table', '${name}.${table.name}', 'column', '${table.name}'\nGO`
        );
        buffer.push("");
      }
    });
  }

  private formatRelation(
    name: string,
    tables: Table[],
    relationship: Relationship,
    buffer: string[]
  ) {
    const startTable = getData(tables, relationship.start.tableId);
    const endTable = getData(tables, relationship.end.tableId);

    if (startTable && endTable) {
      buffer.push(`ALTER TABLE [${name}].[${endTable.name}]`);

      // FK
      let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
      fkName = autoName(this.fkNames, "", fkName);
      this.fkNames.push({
        id: uuid(),
        name: fkName
      });

      buffer.push(`\tADD CONSTRAINT [${fkName}]`);

      // key
      const columns: KeyColumn = {
        start: [],
        end: []
      };
      relationship.end.columnIds.forEach(columnId => {
        const column = getData(endTable.columns, columnId);
        if (column) {
          columns.end.push(column);
        }
      });
      relationship.start.columnIds.forEach(columnId => {
        const column = getData(startTable.columns, columnId);
        if (column) {
          columns.start.push(column);
        }
      });

      buffer.push(`\t\tFOREIGN KEY (${formatNames(columns.end, "[", "]")})`);
      buffer.push(
        `\t\tREFERENCES [${name}].[${startTable.name}] (${formatNames(
          columns.start,
          "[",
          "]"
        )})\nGO`
      );
    }
  }
}

export default new MSSQL();
