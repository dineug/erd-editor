import { query } from '@dineug/erd-editor-schema';
import { uuid25 } from '@dineug/uuid';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

import { SchemaSQLHeader, SchemaSQLStatements } from './options';
import {
  autoNameIgnoreCase,
  CreateSchemaOptions,
  FormatColumnOptions,
  FormatCommentOptions,
  FormatIndexOptions,
  formatNames,
  formatReferentialActions,
  FormatRelationOptions,
  formatSize,
  formatSpace,
  FormatTableOptions,
  getBracket,
  isDelimitedPart,
  Name,
  primaryKey,
  primaryKeyColumns,
  referentialActionSupport,
  splitNameParts,
  tableNamePart,
  toForeignKeyPairs,
  toOrderName,
  toSchemaEntities,
  toStringLiteral,
  unique,
  uniqueColumns,
  unquoteNamePart,
  WrittenObjects,
} from './utils';

const ACTION_SUPPORT = referentialActionSupport(Database.MSSQL);

// The schema the export assumes where a table's name gives none, the default
// schema of the database owner and of a user created without one.
const DEFAULT_SCHEMA = 'dbo';

export function createSchema(
  state: RootState,
  tableIds?: readonly string[],
  { written }: CreateSchemaOptions = { statements: SchemaSQLStatements.create }
): string {
  const fkNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const { tables, relationships, indexes } = toSchemaEntities(state, tableIds);

  tables.forEach(table => {
    written?.tables.push(table);
    formatTable(state, { table, buffer: stringBuffer });
    stringBuffer.push('');

    formatUnique(state, { table, buffer: stringBuffer });

    formatComment(state, { table, buffer: stringBuffer });
  });

  relationships.forEach(relationship => {
    const wrote = formatRelation(state, {
      relationship,
      buffer: stringBuffer,
      fkNames,
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
  { buffer, table }: FormatTableOptions
) {
  const {
    settings: { bracketType },
    collections,
  } = state;
  const bracket = getBracket(bracketType);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  buffer.push(`CREATE TABLE ${bracket}${table.name}${bracket}`);
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
    const pkName = `PK_${tableNamePart(table.name, bracketType)}`;
    buffer.push(
      `  CONSTRAINT ${bracket}${pkName}${bracket} PRIMARY KEY (${formatNames(pkColumns, bracket)})`
    );
  }
  buffer.push(`)\nGO`);
}

/**
 * One named constraint per column the diagram marks unique, after the table.
 * The whole export and the per-table Schema SQL tab both write it.
 */
export function formatUnique(
  { settings: { bracketType }, collections }: RootState,
  { buffer, table }: FormatTableOptions
) {
  const bracket = getBracket(bracketType);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  if (!unique(columns)) return;

  uniqueColumns(columns).forEach(column => {
    buffer.push(`ALTER TABLE ${bracket}${table.name}${bracket}`);
    buffer.push(
      `  ADD CONSTRAINT ${bracket}UQ_${tableNamePart(table.name, bracketType)}_${column.name}${bracket} UNIQUE (${bracket}${column.name}${bracket})\nGO`
    );
    buffer.push('');
  });
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
    stringBuffer.push(`IDENTITY(1,1)`);
  } else {
    if (column.default.trim() !== '') {
      stringBuffer.push(`DEFAULT ${column.default}`);
    }
  }
  buffer.push(stringBuffer.join(' ') + `${isComma ? ',' : ''}`);
}

// A part SQL Server reads as one name: in one pair of brackets or double
// quotes (isDelimitedPart), or a regular identifier.
const REGULAR_PART = /^[\p{L}_@#][\p{L}\p{N}_@#$]*$/u;

function isOneName(part: string): boolean {
  return isDelimitedPart(part) || REGULAR_PART.test(part);
}

/**
 * The prefix that puts an object in the database an unquoted name gives, its
 * third part from the end; '' quoted, or where that part is no one name, which
 * fails its CREATE TABLE and would open a quote or a bracket before the dot.
 */
function databasePrefix(name: string, bracket: string): string {
  if (bracket) return '';

  const [, , database = ''] = splitNameParts(name).reverse();
  return isOneName(database) ? `${database}.` : '';
}

/**
 * The procedure that adds a table's extended properties and their level 0 and 1
 * arguments. An unquoted name splits at each dot outside brackets or quotes into
 * table, schema and the database whose procedure acts there; quoted, a dbo table.
 */
function formatLevels(
  name: string,
  bracket: string
): { procedure: string; levels: string } {
  const [table, schema = ''] = bracket
    ? [name]
    : splitNameParts(name).reverse();
  const level0 = unquoteNamePart(schema) || DEFAULT_SCHEMA;
  const level1 = bracket ? table : unquoteNamePart(table);

  return {
    procedure: `${databasePrefix(name, bracket)}sys.sp_addextendedproperty`,
    levels: `'schema', ${toStringLiteral(level0)}, 'table', ${toStringLiteral(level1)}`,
  };
}

function formatComment(
  { settings: { bracketType }, collections }: RootState,
  { table, buffer }: FormatCommentOptions
) {
  const { procedure, levels } = formatLevels(
    table.name,
    getBracket(bracketType)
  );

  if (table.comment.trim() !== '') {
    buffer.push(`EXECUTE ${procedure} 'MS_Description',`);
    buffer.push(`  ${toStringLiteral(table.comment)}, ${levels}\nGO`);
    buffer.push('');
  }
  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      if (column.comment.trim() !== '') {
        buffer.push(`EXECUTE ${procedure} 'MS_Description',`);
        buffer.push(
          `  ${toStringLiteral(column.comment)}, ${levels}, 'column', ${toStringLiteral(column.name)}\nGO`
        );
        buffer.push('');
      }
    });
}

function formatRelation(
  state: RootState,
  { buffer, relationship, fkNames }: FormatRelationOptions
): boolean {
  const {
    settings: { bracketType },
  } = state;
  const columns = toForeignKeyPairs(state, relationship);
  if (!columns) return false;

  const { startTable, endTable } = columns;
  const bracket = getBracket(bracketType);
  buffer.push(`ALTER TABLE ${bracket}${endTable.name}${bracket}`);

  // FK
  const startName = tableNamePart(startTable.name, bracketType);
  const endName = tableNamePart(endTable.name, bracketType);
  const fkName = autoNameIgnoreCase(fkNames, `FK_${startName}_TO_${endName}`);
  fkNames.push({
    id: uuid25(),
    name: fkName,
  });

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
  buffer[buffer.length - 1] += '\nGO';
  return true;
}

export function formatIndex(
  { settings: { bracketType }, collections }: RootState,
  { buffer, index, indexNames }: FormatIndexOptions
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

    if (index.unique) {
      buffer.push(`CREATE UNIQUE INDEX ${bracket}${indexName}${bracket}`);
    } else {
      buffer.push(`CREATE INDEX ${bracket}${indexName}${bracket}`);
    }
    buffer.push(
      `  ON ${bracket}${table.name}${bracket} (${formatNames(columnNames)})\nGO`
    );
  }
}

/**
 * USE for use; for createAndUse, CREATE DATABASE first where DB_ID finds none.
 * Each ends its batch with GO.
 */
export function formatHeader(
  { settings: { bracketType } }: RootState,
  header: Exclude<SchemaSQLHeader, 'none'>,
  name: string
): string {
  const bracket = getBracket(bracketType);
  const database = `${bracket}${name}${bracket}`;
  const use = `USE ${database}\nGO`;

  return header === SchemaSQLHeader.createAndUse
    ? `IF DB_ID(N${toStringLiteral(name)}) IS NULL\n  CREATE DATABASE ${database}\nGO\n\n${use}`
    : use;
}

/**
 * One transaction that drops each foreign key a written table holds, found in
 * its own database's catalog, then the tables, all rolled back on an error, so
 * a key held from outside them still refuses; IF EXISTS needs SQL Server 2016.
 */
export function formatDropBlock(
  { settings: { bracketType } }: RootState,
  { tables }: WrittenObjects
): string {
  if (tables.length === 0) return '';

  const bracket = getBracket(bracketType);
  const quote = (name: string) => `${bracket}${name}${bracket}`;
  const selects = tables.flatMap(({ name }) => {
    const database = databasePrefix(name, bracket);
    const objectId = `OBJECT_ID(N${toStringLiteral(quote(name))}, N'U')`;
    const select = [
      `SELECT @sql += N${toStringLiteral(`ALTER TABLE ${quote(name)} DROP CONSTRAINT `)} + QUOTENAME(name) + N';'`,
      `  FROM ${database}sys.foreign_keys`,
      `  WHERE parent_object_id = ${objectId}`,
    ];
    // The catalog of a database that does not exist fails as the SELECT runs,
    // past the CATCH and with the transaction left open, so the SELECT runs
    // only where OBJECT_ID finds its table.
    return database
      ? [`  IF ${objectId} IS NOT NULL`, ...select.map(line => `    ${line}`)]
      : select.map(line => `  ${line}`);
  });
  const lines = [
    'BEGIN TRY',
    '  BEGIN TRANSACTION',
    '',
    "  DECLARE @sql NVARCHAR(MAX) = N''",
    ...selects,
    '  EXECUTE sp_executesql @sql',
    '',
    `  DROP TABLE IF EXISTS ${tables.map(({ name }) => quote(name)).join(', ')}`,
    '',
    '  COMMIT TRANSACTION',
    'END TRY',
    'BEGIN CATCH',
    '  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;',
    '  THROW;',
    'END CATCH',
    'GO',
  ];

  return lines.join('\n');
}
