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

class Oracle {
  private fkNames: Name[] = [];
  private aiNames: Name[] = [];
  private trgNames: Name[] = [];

  public toDDL(store: StoreManagement): string {
    this.fkNames = [];
    this.aiNames = [];
    this.trgNames = [];
    const stringBuffer: string[] = [];
    const tables = store.tableStore.state.tables;
    const relationships = store.relationshipStore.state.relationships;
    const canvas = store.canvasStore.state;

    tables.forEach(table => {
      this.formatTable(canvas.databaseName, table, stringBuffer);
      stringBuffer.push("");
      // unique
      if (unique(table.columns)) {
        const uqColumns = uniqueColumns(table.columns);
        uqColumns.forEach(column => {
          stringBuffer.push(`ALTER TABLE ${canvas.databaseName}.${table.name}`);
          stringBuffer.push(
            `  ADD CONSTRAINT UQ_${column.name} UNIQUE (${column.name});`
          );
          stringBuffer.push("");
        });
      }
      // Sequence
      table.columns.forEach(column => {
        if (column.option.autoIncrement) {
          let aiName = `SEQ_${table.name}`;
          aiName = autoName(this.aiNames, "", aiName);
          this.aiNames.push({
            id: uuid(),
            name: aiName
          });

          stringBuffer.push(`CREATE SEQUENCE ${canvas.databaseName}.${aiName}`);
          stringBuffer.push(`START WITH 1`);
          stringBuffer.push(`INCREMENT BY 1;`);
          stringBuffer.push("");

          let trgName = `SEQ_TRG_${table.name}`;
          trgName = autoName(this.aiNames, "", trgName);
          this.trgNames.push({
            id: uuid(),
            name: trgName
          });
          stringBuffer.push(
            `CREATE OR REPLACE TRIGGER ${canvas.databaseName}.${trgName}`
          );
          stringBuffer.push(
            `BEFORE INSERT ON ${canvas.databaseName}.${table.name}`
          );
          stringBuffer.push(`REFERENCING NEW AS NEW FOR EACH ROW`);
          stringBuffer.push(`BEGIN`);
          stringBuffer.push(
            `  SELECT ${canvas.databaseName}.${aiName}.NEXTVAL`
          );
          stringBuffer.push(`  INTO: NEW.${column.name}`);
          stringBuffer.push(`  FROM DUAL;`);
          stringBuffer.push(`END;`);
          stringBuffer.push("");
        }
      });
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
    buffer.push(`CREATE TABLE ${name}.${table.name}`);
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
        `  CONSTRAINT PK_${table.name} PRIMARY KEY (${formatNames(pkColumns)})`
      );
    }
    buffer.push(`);`);
  }

  private formatColumn(
    column: Column,
    isComma: boolean,
    spaceSize: MaxLength,
    buffer: string[]
  ) {
    const stringBuffer: string[] = [];
    stringBuffer.push(
      `  ${column.name}` + formatSpace(spaceSize.name - column.name.length)
    );
    stringBuffer.push(
      `${column.dataType}` +
        formatSpace(spaceSize.dataType - column.dataType.length)
    );
    if (column.option.notNull) {
      stringBuffer.push(`NOT NULL`);
    }
    if (column.default.trim() !== "") {
      stringBuffer.push(`DEFAULT ${column.default}`);
    }
    buffer.push(stringBuffer.join(" ") + `${isComma ? "," : ""}`);
  }

  private formatComment(name: string, table: Table, buffer: string[]) {
    if (table.comment.trim() !== "") {
      buffer.push(
        `COMMENT ON TABLE ${name}.${table.name} IS '${table.comment}';`
      );
      buffer.push("");
    }
    table.columns.forEach(column => {
      if (column.comment.trim() !== "") {
        buffer.push(
          `COMMENT ON COLUMN ${name}.${table.name}.${column.name} IS '${column.comment}';`
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
      buffer.push(`ALTER TABLE ${name}.${endTable.name}`);

      // FK
      let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
      fkName = autoName(this.fkNames, "", fkName);
      this.fkNames.push({
        id: uuid(),
        name: fkName
      });

      buffer.push(`  ADD CONSTRAINT ${fkName}`);

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

      buffer.push(`    FOREIGN KEY (${formatNames(columns.end)})`);
      buffer.push(
        `    REFERENCES ${name}.${startTable.name} (${formatNames(
          columns.start
        )});`
      );
    }
  }
}

export default new Oracle();
