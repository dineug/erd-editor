import { query } from '@dineug/erd-editor-schema';
import { uuid25 } from '@dineug/uuid';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';

import { SchemaSQLHeader, SchemaSQLStatements } from './options';
import {
  autoName,
  CreateSchemaOptions,
  FormatColumnOptions,
  FormatIndexOptions,
  formatNames,
  formatReferentialActions,
  FormatRelationOptions,
  formatSize,
  formatSpace,
  FormatTableOptions,
  ifNotExists,
  Name,
  primaryKey,
  primaryKeyColumns,
  referentialActionSupport,
  toForeignKeyPairs,
  toOrderName,
  toSchemaEntities,
  uniqueColumns,
  WrittenObjects,
} from './utils';

// Databricks SQL quotes identifiers with backticks only -- "x" and 'x' are
// string literals there -- so settings.bracketType cannot be honoured.
const BRACKET = '`';

// Spark SQL escapes a quote inside a string literal with a backslash, and so
// the backslash itself; all but its newest releases end the literal at the
// doubled quote other vendors read.
function toSparkStringLiteral(value: string): string {
  return `'${value.replace(/[\\']/g, '\\$&')}'`;
}

// Keys are never enforced. RELY is what lets the optimizer act on the
// declaration, which is the only reason to export one at all.
const CONSTRAINT_OPTIONS = 'NOT ENFORCED RELY';

const ACTION_SUPPORT = referentialActionSupport(Database.Databricks);

// Databricks makes an identity column of BIGINT alone, so an autoIncrement
// column of any other type is written without one.
function takesIdentity(column: Column): boolean {
  return (
    bHas(column.options, ColumnOption.autoIncrement) &&
    column.dataType.trim().toUpperCase() === 'BIGINT'
  );
}

export function createSchema(
  state: RootState,
  tableIds?: readonly string[],
  { statements, written }: CreateSchemaOptions = {
    statements: SchemaSQLStatements.create,
  }
): string {
  const fkNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const { tables, relationships, indexes } = toSchemaEntities(state, tableIds);

  tables.forEach(table => {
    written?.tables.push(table);
    formatTable(state, { table, buffer: stringBuffer, statements });
    stringBuffer.push('');

    formatUnique(state, { table, buffer: stringBuffer });
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
    });
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table, statements }: FormatTableOptions
) {
  const { collections } = state;
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  buffer.push(
    `CREATE TABLE${ifNotExists(statements)} ${BRACKET}${table.name}${BRACKET}`
  );
  buffer.push(`(`);
  const pk = primaryKey(columns);
  const spaceSize = formatSize(columns);

  columns.forEach((column, i) => {
    formatColumn(state, {
      column,
      isComma: pk || columns.length !== i + 1,
      spaceSize,
      buffer,
    });
  });

  if (pk) {
    const pkColumns = primaryKeyColumns(columns);
    buffer.push(
      `  CONSTRAINT ${BRACKET}PK_${table.name}${BRACKET} PRIMARY KEY (${formatNames(
        pkColumns,
        BRACKET
      )}) ${CONSTRAINT_OPTIONS}`
    );
  }

  buffer.push(`)`);

  if (table.comment.trim() === '') {
    buffer.push(`USING DELTA;`);
  } else {
    buffer.push(`USING DELTA`);
    buffer.push(`COMMENT ${toSparkStringLiteral(table.comment)};`);
  }

  const withoutIdentity = columns.filter(
    column =>
      bHas(column.options, ColumnOption.autoIncrement) && !takesIdentity(column)
  );
  if (withoutIdentity.length !== 0) {
    buffer.push('');
    withoutIdentity.forEach(column => {
      buffer.push(
        `-- Databricks takes IDENTITY only on BIGINT, so ${BRACKET}${table.name}${BRACKET}.${BRACKET}${column.name}${BRACKET} is written without it.`
      );
    });
  }
}

/**
 * A comment per column the diagram marks unique, after the table: UNIQUE is not
 * one of the constraints Databricks accepts, so it is reported, never dropped.
 */
export function formatUnique(
  { collections }: RootState,
  { buffer, table }: FormatTableOptions
) {
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  uniqueColumns(columns).forEach(column => {
    buffer.push(
      `-- Databricks does not support UNIQUE constraints: ${BRACKET}${table.name}${BRACKET}.${BRACKET}${column.name}${BRACKET}`
    );
    buffer.push('');
  });
}

function formatColumn(
  _: RootState,
  { buffer, column, isComma, spaceSize }: FormatColumnOptions
) {
  const stringBuffer: string[] = [];

  stringBuffer.push(
    `  ${BRACKET}${column.name}${BRACKET}` +
      formatSpace(spaceSize.name - column.name.length)
  );
  stringBuffer.push(
    `${column.dataType}` +
      formatSpace(spaceSize.dataType - column.dataType.length)
  );

  // Databricks has no bare NULL marker, so a nullable column contributes
  // padding only -- the trailing run is trimmed off below. A key column has
  // to be NOT NULL whether or not the diagram says so.
  const notNull =
    bHas(column.options, ColumnOption.notNull) ||
    bHas(column.options, ColumnOption.primaryKey);
  stringBuffer.push(notNull ? 'NOT NULL' : '        ');

  if (takesIdentity(column)) {
    stringBuffer.push(`GENERATED ALWAYS AS IDENTITY`);
  } else if (
    !bHas(column.options, ColumnOption.autoIncrement) &&
    column.default.trim() !== ''
  ) {
    stringBuffer.push(`DEFAULT ${column.default}`);
  }
  if (column.comment.trim() !== '') {
    stringBuffer.push(`COMMENT ${toSparkStringLiteral(column.comment)}`);
  }

  buffer.push(stringBuffer.join(' ').trimEnd() + `${isComma ? ',' : ''}`);
}

function formatRelation(
  state: RootState,
  { buffer, relationship, fkNames, statements }: FormatRelationOptions
): boolean {
  const columns = toForeignKeyPairs(state, relationship);
  if (!columns) return false;

  const { startTable, endTable } = columns;
  let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
  fkName = autoName(fkNames, '', fkName);
  fkNames.push({
    id: uuid25(),
    name: fkName,
  });
  const alterTable = `ALTER TABLE ${BRACKET}${endTable.name}${BRACKET}`;

  // A constraint has no IF NOT EXISTS, so a run again drops it and adds it back.
  if (statements === SchemaSQLStatements.ifNotExists) {
    buffer.push(
      `${alterTable} DROP CONSTRAINT IF EXISTS ${BRACKET}${fkName}${BRACKET};`
    );
  }
  buffer.push(alterTable);

  buffer.push(`  ADD CONSTRAINT ${BRACKET}${fkName}${BRACKET}`);

  buffer.push(`    FOREIGN KEY (${formatNames(columns.end, BRACKET)})`);
  buffer.push(
    [
      `    REFERENCES ${BRACKET}${startTable.name}${BRACKET} (${formatNames(
        columns.start,
        BRACKET
      )})`,
      ...formatReferentialActions(relationship, ACTION_SUPPORT),
      `${CONSTRAINT_OPTIONS};`,
    ].join(' ')
  );
  return true;
}

export function formatIndex(
  { collections }: RootState,
  { buffer, index, indexNames }: FormatIndexOptions
) {
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
          name: `${BRACKET}${column.name}${BRACKET} ${toOrderName(
            indexColumn.orderType
          )}`,
        };
      }
      return null;
    })
    .filter(columnName => columnName !== null) as { name: string }[];

  if (columnNames.length === 0) return;

  let indexName = index.name;
  if (index.name.trim() === '') {
    indexName = `IDX_${table.name}`;
    indexName = autoName(indexNames, '', indexName);
    indexNames.push({
      id: uuid25(),
      name: indexName,
    });
  }

  // There is no CREATE INDEX in Databricks. The index is emitted as the
  // clustering it maps onto, commented out: CLUSTER BY takes one key set per
  // table and drops the per-column sort, so it cannot be applied blindly.
  buffer.push(
    `-- Databricks has no secondary indexes. ${BRACKET}${indexName}${BRACKET} on ${BRACKET}${table.name}${BRACKET} (${formatNames(columnNames)})`
  );
  buffer.push(
    `-- ALTER TABLE ${BRACKET}${table.name}${BRACKET} CLUSTER BY (${formatNames(
      query(collections)
        .collection('indexColumnEntities')
        .selectByIds(index.indexColumnIds)
        .map(indexColumn =>
          query(collections)
            .collection('tableColumnEntities')
            .selectById(indexColumn.columnId)
        )
        .filter(column => column !== undefined) as { name: string }[],
      BRACKET
    )});`
  );
}

/** USE SCHEMA, after CREATE SCHEMA IF NOT EXISTS for createAndUse. */
export function formatHeader(
  _: RootState,
  header: Exclude<SchemaSQLHeader, 'none'>,
  name: string
): string {
  const schema = `${BRACKET}${name}${BRACKET}`;
  const use = `USE SCHEMA ${schema};`;

  return header === SchemaSQLHeader.createAndUse
    ? `CREATE SCHEMA IF NOT EXISTS ${schema};\n${use}`
    : use;
}

/** Each table written dropped, its foreign keys with it. */
export function formatDropBlock(
  _: RootState,
  { tables }: WrittenObjects
): string {
  return tables
    .map(({ name }) => `DROP TABLE IF EXISTS ${BRACKET}${name}${BRACKET};`)
    .join('\n');
}
