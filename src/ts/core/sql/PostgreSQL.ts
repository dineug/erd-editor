import { Store } from "../Store";
import { Table, Column } from "../store/Table";
import { Relationship } from "../store/Relationship";
import { getData, uuid, autoName } from "../Helper";
import {
  formatNames,
  formatSize,
  formatSpace,
  primaryKey,
  primaryKeyColumns,
  MaxLength,
  Name,
  KeyColumn,
} from "../helper/SQLHelper";

export function createDDL(store: Store): string {
  const fkNames: Name[] = [];
  const stringBuffer: string[] = [""];
  const tables = [...store.tableState.tables].sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    if (nameA < nameB) {
      return -1;
    } else if (nameA > nameB) {
      return 1;
    }
    return 0;
  });
  const relationships = store.relationshipState.relationships;

  tables.forEach((table) => {
    formatTable(table, stringBuffer);
    stringBuffer.push("");
    formatComment(table, stringBuffer);
  });
  relationships.forEach((relationship) => {
    formatRelation(tables, relationship, stringBuffer, fkNames);
    stringBuffer.push("");
  });

  return stringBuffer.join("\n");
}

function formatTable(table: Table, buffer: string[]) {
  buffer.push(`CREATE TABLE "${table.name}"`);
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
    buffer.push(`  PRIMARY KEY (${formatNames(pkColumns, '"')})`);
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
    `  "${column.name}"` + formatSpace(spaceSize.name - column.name.length)
  );
  stringBuffer.push(
    `${column.dataType}` +
      formatSpace(spaceSize.dataType - column.dataType.length)
  );
  if (column.option.notNull) {
    stringBuffer.push(`NOT NULL`);
  }
  if (column.option.unique) {
    stringBuffer.push(`UNIQUE`);
  } else {
    if (column.default.trim() !== "") {
      stringBuffer.push(`DEFAULT ${column.default}`);
    }
  }
  buffer.push(stringBuffer.join(" ") + `${isComma ? "," : ""}`);
}

function formatComment(table: Table, buffer: string[]) {
  if (table.comment.trim() !== "") {
    buffer.push(`COMMENT ON TABLE "${table.name}" IS '${table.comment}';`);
    buffer.push("");
  }
  table.columns.forEach((column) => {
    if (column.comment.trim() !== "") {
      buffer.push(
        `COMMENT ON COLUMN "${table.name}"."${column.name}" IS '${column.comment}';`
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
    buffer.push(`ALTER TABLE "${endTable.name}"`);

    // FK 중복 처리
    let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
    fkName = autoName(fkNames, "", fkName);
    fkNames.push({
      id: uuid(),
      name: fkName,
    });

    buffer.push(`  ADD CONSTRAINT "${fkName}"`);

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

    buffer.push(`    FOREIGN KEY (${formatNames(columns.end, '"')})`);
    buffer.push(
      `    REFERENCES "${startTable.name}" (${formatNames(
        columns.start,
        '"'
      )});`
    );
  }
}
