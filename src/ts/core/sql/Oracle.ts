import { Store } from "../Store";
import { Table, Column, Index } from "../store/Table";
import { Relationship } from "../store/Relationship";
import { getData, uuid, autoName } from "../Helper";
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
  KeyColumn,
} from "../helper/SQLHelper";
import { orderByNameASC } from "../helper/TableHelper";

export function createDDL(store: Store): string {
  const fkNames: Name[] = [];
  const aiNames: Name[] = [];
  const trgNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [""];
  const tables = orderByNameASC(store.tableState.tables);
  const relationships = store.relationshipState.relationships;
  const indexes = store.tableState.indexes;

  tables.forEach((table) => {
    formatTable(table, stringBuffer);
    stringBuffer.push("");
    // unique
    if (unique(table.columns)) {
      const uqColumns = uniqueColumns(table.columns);
      uqColumns.forEach((column) => {
        stringBuffer.push(`ALTER TABLE ${table.name}`);
        stringBuffer.push(
          `  ADD CONSTRAINT UQ_${column.name} UNIQUE (${column.name});`
        );
        stringBuffer.push("");
      });
    }
    // Sequence
    table.columns.forEach((column) => {
      if (column.option.autoIncrement) {
        let aiName = `SEQ_${table.name}`;
        aiName = autoName(aiNames, "", aiName);
        aiNames.push({
          id: uuid(),
          name: aiName,
        });

        stringBuffer.push(`CREATE SEQUENCE ${aiName}`);
        stringBuffer.push(`START WITH 1`);
        stringBuffer.push(`INCREMENT BY 1;`);
        stringBuffer.push("");

        let trgName = `SEQ_TRG_${table.name}`;
        trgName = autoName(aiNames, "", trgName);
        trgNames.push({
          id: uuid(),
          name: trgName,
        });
        stringBuffer.push(`CREATE OR REPLACE TRIGGER ${trgName}`);
        stringBuffer.push(`BEFORE INSERT ON ${table.name}`);
        stringBuffer.push(`REFERENCING NEW AS NEW FOR EACH ROW`);
        stringBuffer.push(`BEGIN`);
        stringBuffer.push(`  SELECT ${aiName}.NEXTVAL`);
        stringBuffer.push(`  INTO: NEW.${column.name}`);
        stringBuffer.push(`  FROM DUAL;`);
        stringBuffer.push(`END;`);
        stringBuffer.push("");
      }
    });
    formatComment(table, stringBuffer);
  });
  relationships.forEach((relationship) => {
    formatRelation(tables, relationship, stringBuffer, fkNames);
    stringBuffer.push("");
  });

  indexes.forEach((index) => {
    const table = getData(tables, index.tableId);
    if (table) {
      formatIndex(table, index, stringBuffer, indexNames);
      stringBuffer.push("");
    }
  });

  return stringBuffer.join("\n");
}

export function formatTable(table: Table, buffer: string[]) {
  buffer.push(`CREATE TABLE ${table.name}`);
  buffer.push(`(`);
  const pk = primaryKey(table.columns);
  const spaceSize = formatSize(table.columns);

  table.columns.forEach((column, i) => {
    if (pk) {
      formatColumn(column, true, spaceSize, buffer);
    } else {
      formatColumn(column, table.columns.length !== i + 1, spaceSize, buffer);
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

function formatColumn(
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

function formatComment(table: Table, buffer: string[]) {
  if (table.comment.trim() !== "") {
    buffer.push(`COMMENT ON TABLE ${table.name} IS '${table.comment}';`);
    buffer.push("");
  }
  table.columns.forEach((column) => {
    if (column.comment.trim() !== "") {
      buffer.push(
        `COMMENT ON COLUMN ${table.name}.${column.name} IS '${column.comment}';`
      );
      buffer.push("");
    }
  });
}

function formatRelation(
  tables: Table[],
  relationship: Relationship,
  buffer: string[],
  fkNames: Name[]
) {
  const startTable = getData(tables, relationship.start.tableId);
  const endTable = getData(tables, relationship.end.tableId);

  if (startTable && endTable) {
    buffer.push(`ALTER TABLE ${endTable.name}`);

    // FK
    let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
    fkName = autoName(fkNames, "", fkName);
    fkNames.push({
      id: uuid(),
      name: fkName,
    });

    buffer.push(`  ADD CONSTRAINT ${fkName}`);

    // key
    const columns: KeyColumn = {
      start: [],
      end: [],
    };
    relationship.end.columnIds.forEach((columnId) => {
      const column = getData(endTable.columns, columnId);
      if (column) {
        columns.end.push(column);
      }
    });
    relationship.start.columnIds.forEach((columnId) => {
      const column = getData(startTable.columns, columnId);
      if (column) {
        columns.start.push(column);
      }
    });

    buffer.push(`    FOREIGN KEY (${formatNames(columns.end)})`);
    buffer.push(
      `    REFERENCES ${startTable.name} (${formatNames(columns.start)});`
    );
  }
}

export function formatIndex(
  table: Table,
  index: Index,
  buffer: string[],
  indexNames: Name[]
) {
  const columnNames = index.columns
    .map((indexColumn) => {
      const column = getData(table.columns, indexColumn.id);
      if (column) {
        return {
          name: `${column.name} ${indexColumn.orderType}`,
        };
      }
      return null;
    })
    .filter((columnName) => columnName !== null) as { name: string }[];

  if (columnNames.length !== 0) {
    let indexName = index.name;
    if (index.name.trim() === "") {
      indexName = `IDX_${table.name}`;
      indexName = autoName(indexNames, "", indexName);
      indexNames.push({
        id: uuid(),
        name: indexName,
      });
    }

    if (index.unique) {
      buffer.push(`CREATE UNIQUE INDEX ${indexName}`);
    } else {
      buffer.push(`CREATE INDEX ${indexName}`);
    }
    buffer.push(`  ON ${table.name} (${formatNames(columnNames)});`);
  }
}
