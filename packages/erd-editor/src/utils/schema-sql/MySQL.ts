import { query } from '@dineug/erd-editor-schema';
import { uuid25 } from '@dineug/uuid';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Index, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';

import { SchemaSQLHeader, SchemaSQLStatements } from './options';
import {
  autoNameIgnoreCase,
  CreateSchemaOptions,
  FormatColumnOptions,
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
  tableNamePart,
  toForeignKeyPairs,
  toOrderName,
  toSchemaEntities,
  toStringLiteral,
  unique,
  uniqueColumns,
  WrittenObjects,
} from './utils';

const ACTION_SUPPORT = referentialActionSupport(Database.MySQL);

// A foreign key may name a table not created yet, or one about to be dropped,
// while the checks are off; the session gets its own setting back after.
const FOREIGN_KEY_CHECKS_OFF =
  'SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;';
const FOREIGN_KEY_CHECKS_RESTORE =
  'SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;';

export function createSchema(
  state: RootState,
  tableIds?: readonly string[],
  { statements, written }: CreateSchemaOptions = {
    statements: SchemaSQLStatements.create,
  }
): string {
  if (statements === SchemaSQLStatements.ifNotExists) {
    return createInlineSchema(state, tableIds, written);
  }

  const fkNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const { tables, relationships, indexes } = toSchemaEntities(state, tableIds);

  tables.forEach(table => {
    written?.tables.push(table);
    formatTable(state, { table, buffer: stringBuffer });
    stringBuffer.push('');

    formatUnique(state, { table, buffer: stringBuffer });
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

/**
 * The ifNotExists batch: each table holds its unique constraints, indexes and
 * foreign keys, since MySQL has no IF NOT EXISTS for them, named as the create
 * batch names them, between the foreign key checks turned off and back.
 */
function createInlineSchema(
  state: RootState,
  tableIds: readonly string[] | undefined,
  written: WrittenObjects | undefined
): string {
  const {
    settings: { bracketType },
    collections,
  } = state;
  const { tables, relationships, indexes } = toSchemaEntities(state, tableIds);
  if (tables.length === 0) return '';

  const fkNames: Name[] = [];
  const foreignKeys = new Map<string, string[][]>();
  relationships.forEach(relationship => {
    const foreignKey = toForeignKey(state, relationship, fkNames);
    if (!foreignKey) return;

    const [constraint, ...clauses] = foreignKey.lines;
    const held = foreignKeys.get(foreignKey.table.id) ?? [];
    held.push([`  ${constraint}`, ...clauses]);
    foreignKeys.set(foreignKey.table.id, held);
  });

  const indexNames: Name[] = [];
  const tableIndexes = new Map<string, string[][]>();
  indexes.forEach(index => {
    const target = toIndex(state, index, indexNames);
    if (!target) return;

    const held = tableIndexes.get(target.table.id) ?? [];
    held.push([
      `  ${index.unique ? 'UNIQUE ' : ''}INDEX ${target.name} (${target.columns})`,
    ]);
    tableIndexes.set(target.table.id, held);
  });

  const stringBuffer: string[] = ['', FOREIGN_KEY_CHECKS_OFF, ''];
  tables.forEach(table => {
    written?.tables.push(table);
    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);

    writeTable(state, stringBuffer, table, SchemaSQLStatements.ifNotExists, [
      ...uniqueColumns(columns).map(column => [
        `  ${uniqueConstraint(bracketType, table, column)}`,
      ]),
      ...(tableIndexes.get(table.id) ?? []),
      ...(foreignKeys.get(table.id) ?? []),
    ]);
    stringBuffer.push('');
  });
  stringBuffer.push(FOREIGN_KEY_CHECKS_RESTORE, '');

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table, statements }: FormatTableOptions
) {
  writeTable(state, buffer, table, statements, []);
}

// The CREATE TABLE, its columns, its primary key and then the elements handed
// in, each but the last ending with a comma.
function writeTable(
  state: RootState,
  buffer: string[],
  table: Table,
  statements: SchemaSQLStatements | undefined,
  elements: string[][]
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
  const more = elements.length !== 0;

  columns.forEach((column, i) => {
    formatColumn(state, {
      column,
      isComma: pk || more || columns.length !== i + 1,
      spaceSize,
      buffer,
    });
  });
  // PK
  if (pk) {
    const pkColumns = primaryKeyColumns(columns);
    buffer.push(
      `  PRIMARY KEY (${formatNames(pkColumns, bracket)})${more ? ',' : ''}`
    );
  }
  elements.forEach((lines, i) => {
    buffer.push(...lines);
    if (i !== elements.length - 1) buffer[buffer.length - 1] += ',';
  });
  if (table.comment.trim() === '') {
    buffer.push(`);`);
  } else {
    buffer.push(`) COMMENT ${toStringLiteral(table.comment)};`);
  }
}

function uniqueConstraint(
  bracketType: number,
  table: Table,
  column: Column
): string {
  const bracket = getBracket(bracketType);
  return `CONSTRAINT ${bracket}UQ_${tableNamePart(table.name, bracketType)}_${column.name}${bracket} UNIQUE (${bracket}${column.name}${bracket})`;
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
    buffer.push(`  ADD ${uniqueConstraint(bracketType, table, column)};`);
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

  stringBuffer.push(
    `${bHas(column.options, ColumnOption.notNull) ? 'NOT NULL' : 'NULL    '}`
  );

  if (bHas(column.options, ColumnOption.autoIncrement)) {
    stringBuffer.push(`AUTO_INCREMENT`);
  } else {
    if (column.default.trim() !== '') {
      stringBuffer.push(
        `DEFAULT ${formatDefault(column.default, Database.MySQL, column.dataType)}`
      );
    }
  }
  if (column.comment.trim() !== '') {
    stringBuffer.push(`COMMENT ${toStringLiteral(column.comment)}`);
  }
  buffer.push(stringBuffer.join(' ') + `${isComma ? ',' : ''}`);
}

// A relationship's foreign key named in turn, the CONSTRAINT line first, or
// null where it writes none.
function toForeignKey(
  state: RootState,
  relationship: Relationship,
  fkNames: Name[]
): { table: Table; lines: string[] } | null {
  const {
    settings: { bracketType },
  } = state;
  const columns = toForeignKeyPairs(state, relationship);
  if (!columns) return null;

  const { startTable, endTable } = columns;
  const bracket = getBracket(bracketType);

  // FK
  const startName = tableNamePart(startTable.name, bracketType);
  const endName = tableNamePart(endTable.name, bracketType);
  const fkName = autoNameIgnoreCase(fkNames, `FK_${startName}_TO_${endName}`);
  fkNames.push({
    id: uuid25(),
    name: fkName,
  });

  return {
    table: endTable,
    lines: [
      `CONSTRAINT ${bracket}${fkName}${bracket}`,
      `    FOREIGN KEY (${formatNames(columns.end, bracket)})`,
      `    REFERENCES ${bracket}${startTable.name}${bracket} (${formatNames(
        columns.start,
        bracket
      )})`,
      ...formatReferentialActions(relationship, ACTION_SUPPORT).map(
        clause => `    ${clause}`
      ),
    ],
  };
}

function formatRelation(
  state: RootState,
  { buffer, relationship, fkNames }: FormatRelationOptions
): boolean {
  const foreignKey = toForeignKey(state, relationship, fkNames);
  if (!foreignKey) return false;

  const bracket = getBracket(state.settings.bracketType);
  const [constraint, ...clauses] = foreignKey.lines;
  buffer.push(
    `ALTER TABLE ${bracket}${foreignKey.table.name}${bracket}`,
    `  ADD ${constraint}`,
    ...clauses
  );
  buffer[buffer.length - 1] += ';';
  return true;
}

// An index's table, its name, quoted, and its column list, or null where it
// writes nothing; an automatic name is numbered in turn.
function toIndex(
  { settings: { bracketType }, collections }: RootState,
  index: Index,
  indexNames: Name[]
): { table: Table; name: string; columns: string } | null {
  const bracket = getBracket(bracketType);
  const table = query(collections)
    .collection('tableEntities')
    .selectById(index.tableId);
  if (!table) return null;

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

  if (columnNames.length === 0) return null;

  let indexName = index.name;
  if (index.name.trim() === '') {
    const tableName = tableNamePart(table.name, bracketType);
    indexName = autoNameIgnoreCase(indexNames, `IDX_${tableName}`);
    indexNames.push({
      id: uuid25(),
      name: indexName,
    });
  }

  return {
    table,
    name: `${bracket}${indexName}${bracket}`,
    columns: formatNames(columnNames),
  };
}

export function formatIndex(
  state: RootState,
  { buffer, index, indexNames }: FormatIndexOptions
) {
  const target = toIndex(state, index, indexNames);
  if (!target) return;

  const bracket = getBracket(state.settings.bracketType);
  buffer.push(`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${target.name}`);
  buffer.push(
    `  ON ${bracket}${target.table.name}${bracket} (${target.columns});`
  );
}

/** USE, after CREATE DATABASE IF NOT EXISTS for createAndUse; MariaDB's too. */
export function formatHeader(
  { settings: { bracketType } }: RootState,
  header: Exclude<SchemaSQLHeader, 'none'>,
  name: string
): string {
  const bracket = getBracket(bracketType);
  const database = `${bracket}${name}${bracket}`;
  const use = `USE ${database};`;

  return header === SchemaSQLHeader.createAndUse
    ? `CREATE DATABASE IF NOT EXISTS ${database};\n${use}`
    : use;
}

/**
 * Every table written dropped while the foreign key checks are off, so the
 * order does not matter, and the checks back on before the tables are created;
 * MariaDB's too.
 */
export function formatDropBlock(
  { settings: { bracketType } }: RootState,
  { tables }: WrittenObjects
): string {
  if (tables.length === 0) return '';

  const bracket = getBracket(bracketType);
  return [
    FOREIGN_KEY_CHECKS_OFF,
    tables
      .map(table => `DROP TABLE IF EXISTS ${bracket}${table.name}${bracket};`)
      .join('\n'),
    FOREIGN_KEY_CHECKS_RESTORE,
  ].join('\n\n');
}
