import StoreManagement from "@/store/StoreManagement";
import { Column, Table } from "@/store/table";
import { Relationship, RelationshipType } from "@/store/relationship";
import { getPrimitiveType, getNameCase } from "../GeneratorCodeHelper";
import { Database } from "@/data/DataType";
import { getData } from "@/ts/util";
import { Case } from "@/ts/GeneratorCode";
import { camelCase, pascalCase, snakeCase } from "change-case";

const typescriptType: { [key: string]: string } = {
  int: "Int",
  float: "Float",
  boolean: "Boolean",
  string: "String",
  date: "String",
  dateTime: "String",
  time: "String"
  // ID
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
    const currentRelationships = relationships.filter(
      relationship => relationship.start.tableId === table.id
    );
    if (table.comment.trim() !== "") {
      buffer.push(`# ${table.comment}`);
    }
    buffer.push(`type ${tableName} {`);
    table.columns.forEach(column => {
      this.formatColumn(column, buffer, database, columnCase);
    });
    currentRelationships.forEach(relationships => {
      const endTable = getData(tables, relationships.end.tableId);
      if (endTable) {
        const typeName = getNameCase(endTable.name, tableCase);
        const fieldName = getNameCase(endTable.name, columnCase);
        if (endTable.comment.trim() !== "") {
          buffer.push(`# ${endTable.comment}`);
        }
        if (relationships.relationshipType === RelationshipType.ZeroOne) {
          buffer.push(`  ${fieldName}: ${typeName}`);
        } else if (
          relationships.relationshipType === RelationshipType.ZeroOneN
        ) {
          const fieldNameList = getNameCase(`${fieldName}List`, columnCase);
          buffer.push(`  ${fieldNameList}: [${typeName}]`);
        }
      }
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
    if (column.comment.trim() !== "") {
      buffer.push(`  # ${column.comment}`);
    }
    let idType = column.option.primaryKey || column.ui.fk;
    if (idType) {
      buffer.push(`  ${columnName}: ID`);
    } else {
      const primitiveType = getPrimitiveType(column.dataType, database);
      buffer.push(`  ${columnName}: ${typescriptType[primitiveType]}`);
    }
  }
}

export default new graphql();
