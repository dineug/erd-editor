import { query } from '@dineug/erd-editor-schema';
import { uuid25 } from '@dineug/uuid';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';

import { SchemaSQLHeader, SchemaSQLStatements } from './options';
import {
  autoNameIgnoreCase,
  CreateSchemaOptions,
  FormatColumnOptions,
  FormatCommentOptions,
  formatDefault,
  FormatIndexOptions,
  formatNames,
  formatReferentialActions,
  FormatRelationOptions,
  formatSize,
  formatSpace,
  FormatTableOptions,
  getBracket,
  ifNotExists,
  Name,
  primaryKey,
  primaryKeyColumns,
  referentialActionSupport,
  splitTableName,
  tableNamePart,
  toForeignKeyPairs,
  toOrderName,
  toSchemaEntities,
  toStringLiteral,
  WrittenObjects,
} from './utils';

const ACTION_SUPPORT = referentialActionSupport(Database.PostgreSQL);

// An identity column must be smallint, integer or bigint, by any of the names
// PostgreSQL gives them.
const IDENTITY_TYPES = new Set([
  'INT',
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'INT2',
  'INT4',
  'INT8',
]);

function takesIdentity(column: Column): boolean {
  return (
    bHas(column.options, ColumnOption.autoIncrement) &&
    IDENTITY_TYPES.has(column.dataType.trim().toUpperCase())
  );
}

export function createSchema(
  state: RootState,
  tableIds?: readonly string[],
  { statements, written }: CreateSchemaOptions = {}
): string {
  const fkNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const { tables, relationships, indexes } = toSchemaEntities(state, tableIds);

  tables.forEach(table => {
    written?.tables.push(table);
    formatTable(state, { table, buffer: stringBuffer, statements });
    stringBuffer.push('');
    formatComment(state, { table, buffer: stringBuffer });
  });

  relationships.forEach(relationship => {
    const wrote = formatRelation(state, {
      relationship,
      buffer: stringBuffer,
      fkNames,
      statements,
    });
    if (wrote) stringBuffer.push('');
  });

  indexes.forEach(index => {
    formatIndex(state, {
      index,
      buffer: stringBuffer,
      indexNames,
      statements,
    });
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table, statements }: FormatTableOptions
) {
  const {
    settings: { bracketType },
    collections,
  } = state;
  const bracket = getBracket(bracketType);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  buffer.push(
    `CREATE TABLE${ifNotExists(statements)} ${bracket}${table.name}${bracket}`
  );
  buffer.push(`(`);
  const pk = primaryKey(columns);
  const spaceSize = formatSize(columns);

  columns.forEach((column, i) => {
    if (pk) {
      formatColumn(state, {
        column,
        isComma: true,
        spaceSize,
        buffer,
      });
    } else {
      formatColumn(state, {
        column,
        isComma: columns.length !== i + 1,
        spaceSize,
        buffer,
      });
    }
  });

  if (pk) {
    const pkColumns = primaryKeyColumns(columns);
    buffer.push(`  PRIMARY KEY (${formatNames(pkColumns, bracket)})`);
  }
  buffer.push(`);`);

  const withoutIdentity = columns.filter(
    column =>
      bHas(column.options, ColumnOption.autoIncrement) && !takesIdentity(column)
  );
  if (withoutIdentity.length !== 0) {
    buffer.push('');
    withoutIdentity.forEach(column => {
      buffer.push(
        `-- PostgreSQL takes IDENTITY only on smallint, integer or bigint, so ${bracket}${table.name}${bracket}.${bracket}${column.name}${bracket} is written without it.`
      );
    });
  }
}

function formatColumn(
  { settings: { bracketType } }: RootState,
  { buffer, column, isComma, spaceSize }: FormatColumnOptions
) {
  const bracket = getBracket(bracketType);
  const stringBuffer: string[] = [];

  stringBuffer.push(
    `  ${bracket}${column.name}${bracket}` +
      formatSpace(spaceSize.name - column.name.length)
  );
  stringBuffer.push(
    `${column.dataType}` +
      formatSpace(spaceSize.dataType - column.dataType.length)
  );
  if (bHas(column.options, ColumnOption.notNull)) {
    stringBuffer.push(`NOT NULL`);
  }
  if (bHas(column.options, ColumnOption.autoIncrement)) {
    if (takesIdentity(column)) {
      stringBuffer.push(`GENERATED ALWAYS AS IDENTITY`);
    }
  } else {
    if (column.default.trim() !== '') {
      stringBuffer.push(
        `DEFAULT ${formatDefault(column.default, Database.PostgreSQL)}`
      );
    }
  }
  if (bHas(column.options, ColumnOption.unique)) {
    stringBuffer.push(`UNIQUE`);
  }
  buffer.push(stringBuffer.join(' ') + `${isComma ? ',' : ''}`);
}

function formatComment(
  { settings: { bracketType }, collections }: RootState,
  { buffer, table }: FormatCommentOptions
) {
  const bracket = getBracket(bracketType);

  if (table.comment.trim() !== '') {
    buffer.push(
      `COMMENT ON TABLE ${bracket}${table.name}${bracket} IS ${toStringLiteral(table.comment)};`
    );
    buffer.push('');
  }
  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      if (column.comment.trim() !== '') {
        buffer.push(
          `COMMENT ON COLUMN ${bracket}${table.name}${bracket}.${bracket}${column.name}${bracket} IS ${toStringLiteral(column.comment)};`
        );
        buffer.push('');
      }
    });
}

function formatRelation(
  state: RootState,
  { buffer, relationship, fkNames, statements }: FormatRelationOptions
): boolean {
  const {
    settings: { bracketType },
  } = state;
  const columns = toForeignKeyPairs(state, relationship);
  if (!columns) return false;

  const { startTable, endTable } = columns;
  const bracket = getBracket(bracketType);
  const startName = tableNamePart(startTable.name, bracketType);
  const endName = tableNamePart(endTable.name, bracketType);
  const fkName = autoNameIgnoreCase(fkNames, `FK_${startName}_TO_${endName}`);
  fkNames.push({
    id: uuid25(),
    name: fkName,
  });
  const alterTable = `ALTER TABLE ${bracket}${endTable.name}${bracket}`;

  // A constraint has no IF NOT EXISTS, so a run again drops it and adds it back.
  if (statements === SchemaSQLStatements.ifNotExists) {
    buffer.push(
      `${alterTable} DROP CONSTRAINT IF EXISTS ${bracket}${fkName}${bracket};`
    );
  }
  buffer.push(alterTable);
  buffer.push(`  ADD CONSTRAINT ${bracket}${fkName}${bracket}`);

  buffer.push(`    FOREIGN KEY (${formatNames(columns.end, bracket)})`);
  buffer.push(
    `    REFERENCES ${bracket}${startTable.name}${bracket} (${formatNames(
      columns.start,
      bracket
    )})`,
    ...formatReferentialActions(relationship, ACTION_SUPPORT).map(
      clause => `    ${clause}`
    )
  );
  buffer[buffer.length - 1] += ';';
  return true;
}

export function formatIndex(
  { settings: { bracketType }, collections }: RootState,
  { buffer, index, indexNames, statements }: FormatIndexOptions
) {
  const bracket = getBracket(bracketType);
  const table = query(collections)
    .collection('tableEntities')
    .selectById(index.tableId);
  if (!table) return;

  const columnNames = query(collections)
    .collection('indexColumnEntities')
    .selectByIds(index.indexColumnIds)
    .map(indexColumn => {
      const column = query(collections)
        .collection('tableColumnEntities')
        .selectById(indexColumn.columnId);
      if (column) {
        return {
          name: `${bracket}${column.name}${bracket} ${toOrderName(
            indexColumn.orderType
          )}`,
        };
      }
      return null;
    })
    .filter(columnName => columnName !== null) as { name: string }[];

  if (columnNames.length !== 0) {
    let indexName = index.name;
    if (index.name.trim() === '') {
      const tableName = tableNamePart(table.name, bracketType);
      indexName = autoNameIgnoreCase(indexNames, `IDX_${tableName}`);
      indexNames.push({
        id: uuid25(),
        name: indexName,
      });
    }

    buffer.push(
      `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX${ifNotExists(statements)} ${bracket}${indexName}${bracket}`
    );
    buffer.push(
      `  ON ${bracket}${table.name}${bracket} (${formatNames(columnNames)});`
    );
  }
}

/**
 * CREATE SCHEMA IF NOT EXISTS and a search_path that puts it first, for
 * createAndUse; PostgreSQL has no USE, so use writes nothing.
 */
export function formatHeader(
  { settings: { bracketType } }: RootState,
  header: Exclude<SchemaSQLHeader, 'none'>,
  name: string
): string {
  if (header !== SchemaSQLHeader.createAndUse) return '';

  const bracket = getBracket(bracketType);
  const schema = `${bracket}${name}${bracket}`;
  return `CREATE SCHEMA IF NOT EXISTS ${schema};\nSET search_path TO ${schema}, public;`;
}

/**
 * One DROP TABLE IF EXISTS naming every table written, which refuses to drop a
 * table another one outside it references. Under the createAndUse header a
 * table with no schema of its own is named in that schema, never public's.
 */
export function formatDropBlock(
  { settings: { bracketType } }: RootState,
  { tables }: WrittenObjects,
  header: SchemaSQLHeader,
  name: string
): string {
  if (tables.length === 0) return '';

  const bracket = getBracket(bracketType);
  const prefix =
    header === SchemaSQLHeader.createAndUse
      ? `${bracket}${name}${bracket}.`
      : '';
  const names = tables.map(({ name: tableName }) => {
    const [schema] = splitTableName(tableName, bracketType);
    return `${schema === '' ? prefix : ''}${bracket}${tableName}${bracket}`;
  });

  return `DROP TABLE IF EXISTS ${names.join(', ')};`;
}
