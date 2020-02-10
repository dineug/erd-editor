import StoreManagement from "@/store/StoreManagement";
import { Column, Table } from "@/store/table";
import { Relationship, RelationshipType } from "@/store/relationship";
import { getPrimitiveType, getNameCase } from "../GeneratorCodeHelper";
import { Database } from "@/data/DataType";
import { getData } from "@/ts/util";
import { Case } from "@/ts/GeneratorCode";

const typescriptType: { [key: string]: string } = {
  int: "Int",
  long: "Int",
  float: "Float",
  double: "Float",
  decimal: "Float",
  boolean: "Boolean",
  string: "String",
  lob: "String",
  date: "String",
  dateTime: "String",
  time: "String"
};

class graphql {
  public toCode(store: StoreManagement): string {
    const stringBuffer: string[] = [];
    const tables = store.tableStore.state.tables;
    const relationships = store.relationshipStore.state.relationships;
    const database = store.canvasStore.state.database;
    const tableCase = store.canvasStore.state.tableCase;
    const columnCase = store.canvasStore.state.columnCase;

    tables.forEach(table => {
      this.formatTable(
        table,
        stringBuffer,
        database,
        relationships,
        tables,
        tableCase,
        columnCase
      );
      stringBuffer.push("");
    });

    return stringBuffer.join("\n");
  }

  private formatTable(
    table: Table,
    buffer: string[],
    database: Database,
    relationships: Relationship[],
    tables: Table[],
    tableCase: Case,
    columnCase: Case
  ) {
    const tableName = getNameCase(table.name, tableCase);
    if (table.comment.trim() !== "") {
      buffer.push(`# ${table.comment}`);
    }
    buffer.push(`type ${tableName} {`);
    table.columns.forEach(column => {
      this.formatColumn(column, buffer, database, columnCase);
    });
    this.formatRelation(
      table,
      buffer,
      relationships,
      tables,
      tableCase,
      columnCase
    );
    buffer.push(`}`);
  }

  private formatColumn(
    column: Column,
    buffer: string[],
    database: Database,
    columnCase: Case
  ) {
    const columnName = getNameCase(column.name, columnCase);
    if (column.comment.trim() !== "") {
      buffer.push(`  # ${column.comment}`);
    }
    let idType = column.option.primaryKey || column.ui.fk;
    if (idType) {
      buffer.push(`  ${columnName}: ID${column.option.notNull ? "!" : ""}`);
    } else {
      const primitiveType = getPrimitiveType(column.dataType, database);
      buffer.push(
        `  ${columnName}: ${typescriptType[primitiveType]}${
          column.option.notNull ? "!" : ""
        }`
      );
    }
  }

  private formatRelation(
    table: Table,
    buffer: string[],
    relationships: Relationship[],
    tables: Table[],
    tableCase: Case,
    columnCase: Case
  ) {
    relationships
      .filter(relationship => relationship.end.tableId === table.id)
      .forEach(relationship => {
        const startTable = getData(tables, relationship.start.tableId);
        if (startTable) {
          const typeName = getNameCase(startTable.name, tableCase);
          const fieldName = getNameCase(startTable.name, columnCase);
          if (startTable.comment.trim() !== "") {
            buffer.push(`  # ${startTable.comment}`);
          }
          buffer.push(`  ${fieldName}: ${typeName}`);
        }
      });
    relationships
      .filter(relationship => relationship.start.tableId === table.id)
      .forEach(relationship => {
        const endTable = getData(tables, relationship.end.tableId);
        if (endTable) {
          const typeName = getNameCase(endTable.name, tableCase);
          const fieldName = getNameCase(endTable.name, columnCase);
          if (endTable.comment.trim() !== "") {
            buffer.push(`  # ${endTable.comment}`);
          }
          if (relationship.relationshipType === RelationshipType.ZeroOne) {
            buffer.push(`  ${fieldName}: ${typeName}`);
          } else if (
            relationship.relationshipType === RelationshipType.ZeroOneN
          ) {
            buffer.push(
              `  ${getNameCase(
                `${fieldName}List`,
                columnCase
              )}: [${typeName}!]!`
            );
          }
        }
      });
  }
}

export default new graphql();
