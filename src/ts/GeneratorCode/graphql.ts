import StoreManagement from "@/store/StoreManagement";
import { Column, Table } from "@/store/table";
import { Relationship, RelationshipType } from "@/store/relationship";
import { getPrimitiveType } from "../GeneratorCodeHelper";
import { Database } from "@/data/DataType";
import { getData } from "@/ts/util";

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

    tables.forEach(table => {
      this.formatTable(table, stringBuffer, database, relationships, tables);
      stringBuffer.push("");
    });

    return stringBuffer.join("\n");
  }

  private formatTable(
    table: Table,
    buffer: string[],
    database: Database,
    relationships: Relationship[],
    tables: Table[]
  ) {
    const currentRelationships = relationships.filter(
      relationship => relationship.start.tableId === table.id
    );
    if (table.comment.trim() !== "") {
      buffer.push(`# ${table.comment}`);
    }
    buffer.push(`type ${table.name} {`);
    table.columns.forEach(column => {
      this.formatColumn(column, buffer, database);
    });
    currentRelationships.forEach(relationships => {
      const endTable = getData(tables, relationships.end.tableId);
      if (endTable) {
        if (endTable.comment.trim() !== "") {
          buffer.push(`# ${endTable.comment}`);
        }
        if (relationships.relationshipType === RelationshipType.ZeroOne) {
          buffer.push(`  ${endTable.name}: ${endTable.name}`);
        } else if (
          relationships.relationshipType === RelationshipType.ZeroOneN
        ) {
          buffer.push(`  ${endTable.name}: [${endTable.name}]`);
        }
      }
    });
    buffer.push(`}`);
  }

  private formatColumn(column: Column, buffer: string[], database: Database) {
    if (column.comment.trim() !== "") {
      buffer.push(`  # ${column.comment}`);
    }
    let idType = column.option.primaryKey || column.ui.fk;
    if (idType) {
      buffer.push(`  ${column.name}: ID`);
    } else {
      const primitiveType = getPrimitiveType(column.dataType, database);
      buffer.push(`  ${column.name}: ${typescriptType[primitiveType]}`);
    }
  }
}

export default new graphql();
