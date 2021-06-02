import { Store } from '@@types/engine/store';
import { Database } from '@@types/engine/store/canvas.state';
import { orderByNameASC } from '@/engine/store/helper/table.helper';
import { getData, uuid, autoName } from '@/core/helper';

import {
  FormatTableOptions,
  FormatColumnOptions,
  FormatConstraintsOptions,
  FormatRelationOptions,
  FormatIndexOptions,
  KeyColumn,
  formatNames,
} from '@/core/parser/helper';

export function spacing(depth: number): string {
  if (depth) return `    ${spacing(depth - 1)}`;
  else return '';
}

export function createXML(store: Store, database?: Database): string {
  const currentDatabase = database ? database : store.canvasState.database;
  switch (currentDatabase) {
    // case 'MariaDB':
    //     return createDDLMariaDB(store);
    // case 'MSSQL':
    //     return createDDLMSSQL(store);
    // case 'MySQL':
    //     return createDDLMySQL(store);
    // case 'Oracle':
    //     return createDDLOracle(store);
    case 'PostgreSQL':
      return createXMLPostgreSQL(store);
    // case 'SQLite':
    //     return createDDLSQLite(store);
  }
  // todo delete
  return createXMLPostgreSQL(store);
  return 'no database selected';
}

export const createXMLPostgreSQL = ({
  tableState,
  relationshipState,
}: Store) => {
  const stringBuffer: string[] = [''];
  const tables = orderByNameASC(tableState.tables);
  const relationships = relationshipState.relationships;
  const indexes = tableState.indexes;
  const depth = 1;

  // todo pridat niekde ziskanie tychto hodnot
  const author = {
    name: 'test-meno',
    id: '123456',
  };

  stringBuffer.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<databaseChangeLog xmlns="http://www.liquibase.org/xml/ns/dbchangelog" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.0.xsd">`
  );

  stringBuffer.push(
    `${spacing(depth)}<changeSet author="${author.name}" id="${
      author.id
    }" dbms="postgresql">`
  );

  tables.forEach(table => {
    createTable({
      table,
      buffer: stringBuffer,
      depth: depth + 1,
    });
  });

  relationships.forEach(relationship => {
    formatRelation({
      tables,
      relationship,
      buffer: stringBuffer,
      depth: depth + 1,
    });
  });

  indexes.forEach(index => {
    const table = getData(tables, index.tableId);
    if (table)
      formatIndex({
        table,
        index,
        buffer: stringBuffer,
        depth: depth + 1,
      });
  });

  stringBuffer.push(`${spacing(depth)}</changeSet>`);

  // todo zmazat
  console.log(tableState);
  console.log(relationshipState);

  stringBuffer.push(`</databaseChangeLog>`);

  return stringBuffer.join('\n');
};

export function createTable({ table, buffer, depth }: FormatTableOptions) {
  let tableDescription = `${spacing(depth)}<createTable tableName="${
    table.name
  }"`;

  if (table.comment) tableDescription += ` remarks="${table.comment}"`;

  tableDescription += '>';

  buffer.push('', tableDescription);

  table.columns.forEach((column, i) => {
    formatColumn({
      column,
      buffer,
      depth: depth + 1,
    });
  });

  buffer.push(`${spacing(depth)}</createTable>`);
}

/**
 * Formatting of one column
 */
export function formatColumn({ column, buffer, depth }: FormatColumnOptions) {
  let col = `${spacing(depth)}<column name="${column.name}"`;

  if (column.dataType) col += ` type="${column.dataType}"`;
  if (column.option.autoIncrement)
    col += ` autoIncrement="${column.option.autoIncrement}"`;

  if (column.default) col += ` defaultValue="${column.default}"`;
  if (column.comment) col += ` remarks="${column.comment}"`;

  if (
    !column.option.notNull ||
    column.option.primaryKey ||
    column.option.unique
  ) {
    col += '>';
    buffer.push(col);

    formatConstraints({
      constraints: {
        primaryKey: column.option.primaryKey,
        nullable: column.option.notNull,
        unique: column.option.unique,
      },
      buffer,
      depth: depth + 1,
    });

    buffer.push(`${spacing(depth)}</column>`);
  } else {
    col += '/>';
    buffer.push(col);
  }
}

/**
 * Formatting constraints inside one column
 */
export function formatConstraints({
  constraints,
  buffer,
  depth,
}: FormatConstraintsOptions) {
  let constraintDescription = `${spacing(depth)}<constraints`;

  if (constraints.primaryKey)
    constraintDescription += ` primaryKey="${constraints.primaryKey}"`;
  if (constraints.nullable === false)
    constraintDescription += ` nullable="${!constraints.nullable}"`;
  if (constraints.unique)
    constraintDescription += ` unique="${constraints.unique}"`;

  constraintDescription += '/>';
  buffer.push(constraintDescription);
}

function formatRelation({
  tables,
  relationship,
  buffer,
  depth,
}: FormatRelationOptions) {
  const startTable = getData(tables, relationship.start.tableId);
  const endTable = getData(tables, relationship.end.tableId);

  if (startTable && endTable) {
    const columns: KeyColumn = {
      start: [],
      end: [],
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

    buffer.push(
      '',
      `${spacing(depth)}<addForeignKeyConstraint baseColumnNames="${formatNames(
        columns.end
      )}"`,
      `${spacing(depth + 1)}baseTableName="${endTable.name}"`,
      `${spacing(depth + 1)}constraintName="FK_${endTable.name}_TO_${
        startTable.name
      }"`,
      `${spacing(depth + 1)}onDelete="???"`,
      `${spacing(depth + 1)}onUpdate="???"`,
      `${spacing(depth + 1)}referencedColumnNames="${formatNames(
        columns.start
      )}"`,
      `${spacing(depth + 1)}referencedTableName="${startTable.name}"/>`
    );
  }
}

/**
 * Creating index
 */
export function formatIndex({
  table,
  index,
  buffer,
  depth,
}: FormatIndexOptions) {
  // gets real columns, using id
  const colsWithIndex = index.columns
    .map(indexColumn => {
      const column = getData(table.columns, indexColumn.id);
      if (column) {
        return {
          name: `${column.name}`,
          descending: indexColumn.orderType === 'DESC',
        };
      }
      return null;
    })
    .filter(columnName => columnName !== null) as {
    name: string;
    descending: boolean;
  }[];

  if (colsWithIndex.length !== 0) {
    let indexName = index.name;
    if (index.name.trim() === '') {
      indexName = `${table.name}`;
    }

    buffer.push(
      '',
      `${spacing(depth)}<createIndex indexName="${indexName}" tableName="${
        table.name
      }">`
    );

    colsWithIndex.forEach(column => {
      buffer.push(
        `${spacing(depth + 1)}<column name="${column.name}"${
          column.descending ? ` descending="${column.descending}"` : ''
        }/>`
      );
    });

    buffer.push(`${spacing(depth)}</createIndex>`);
  }
}
