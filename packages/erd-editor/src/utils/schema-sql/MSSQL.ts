import { query } from '@dineug/erd-editor-schema';
import { nanoid } from 'nanoid';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

import {
  autoNameIgnoreCase,
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
  KeyColumn,
  Name,
  orderByNameASC,
  primaryKey,
  primaryKeyColumns,
  referentialActionSupport,
  tableNamePart,
  toOrderName,
  toStringLiteral,
  unique,
  uniqueColumns,
} from './utils';

const ACTION_SUPPORT = referentialActionSupport(Database.MSSQL);

// The schema the export assumes where a table's name gives none, the default
// schema of the database owner and of a user created without one.
const DEFAULT_SCHEMA = 'dbo';

export function createSchema(state: RootState): string {
  const {
    doc: { tableIds, relationshipIds, indexIds },
    collections,
  } = state;
  const fkNames: Name[] = [];
  const indexNames: Name[] = [];
  const stringBuffer: string[] = [''];
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);
  const indexes = query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds);

  tables.forEach(table => {
    formatTable(state, { table, buffer: stringBuffer });
    stringBuffer.push('');

    formatUnique(state, { table, buffer: stringBuffer });

    formatComment(state, { table, buffer: stringBuffer });
  });

  relationships.forEach(relationship => {
    formatRelation(state, {
      relationship,
      buffer: stringBuffer,
      fkNames,
    });
    stringBuffer.push('');
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

// A part of an unquoted name: bracketed or double-quoted runs, whose dots and
// doubled closing characters stay inside them, or any character but a dot.
const NAME_PART = /(?:\[(?:[^\]]|\]\])*\]|"(?:[^"]|"")*"|[^.])*/y;

// A part SQL Server reads as one name: in one pair of brackets or double
// quotes, the closing character doubled inside, or a regular identifier.
const DELIMITED_PART = /^(?:\[((?:[^\]]|\]\])*)\]|"((?:[^"]|"")*)")$/;
const REGULAR_PART = /^[\p{L}_@#][\p{L}\p{N}_@#$]*$/u;

function splitName(name: string): string[] {
  const parts: string[] = [];
  let index = 0;

  do {
    NAME_PART.lastIndex = index;
    const [part] = NAME_PART.exec(name)!;
    parts.push(part);
    index += part.length + 1;
  } while (index <= name.length);

  return parts;
}

/** The name SQL Server reads in a part written in brackets or double quotes. */
function unquotePart(part: string): string {
  const match = DELIMITED_PART.exec(part);
  if (!match) return part;

  const [, bracketed, quoted] = match;
  return bracketed === undefined
    ? quoted.replaceAll('""', '"')
    : bracketed.replaceAll(']]', ']');
}

function isOneName(part: string): boolean {
  return DELIMITED_PART.test(part) || REGULAR_PART.test(part);
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
  const [table, schema = '', database = ''] = bracket
    ? [name]
    : splitName(name).reverse();
  const level0 = unquotePart(schema) || DEFAULT_SCHEMA;
  const level1 = bracket ? table : unquotePart(table);
  // A database part SQL Server reads as no one name fails its CREATE TABLE
  // too, and written before the procedure it could open a quote or bracket
  // that swallows every batch after it, so it is dropped.
  const prefix = isOneName(database) ? `${database}.` : '';

  return {
    procedure: `${prefix}sys.sp_addextendedproperty`,
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
  { settings: { bracketType }, collections }: RootState,
  { buffer, relationship, fkNames }: FormatRelationOptions
) {
  const bracket = getBracket(bracketType);
  const tableCollection = query(collections).collection('tableEntities');
  const columnCollection = query(collections).collection('tableColumnEntities');
  const startTable = tableCollection.selectById(relationship.start.tableId);
  const endTable = tableCollection.selectById(relationship.end.tableId);

  if (startTable && endTable) {
    buffer.push(`ALTER TABLE ${bracket}${endTable.name}${bracket}`);

    // FK
    const startName = tableNamePart(startTable.name, bracketType);
    const endName = tableNamePart(endTable.name, bracketType);
    const fkName = autoNameIgnoreCase(fkNames, `FK_${startName}_TO_${endName}`);
    fkNames.push({
      id: nanoid(),
      name: fkName,
    });

    buffer.push(`  ADD CONSTRAINT ${bracket}${fkName}${bracket}`);

    // key
    const columns: KeyColumn = {
      start: [],
      end: [],
    };
    relationship.end.columnIds.forEach(columnId => {
      const column = columnCollection.selectById(columnId);
      if (column) {
        columns.end.push(column);
      }
    });
    relationship.start.columnIds.forEach(columnId => {
      const column = columnCollection.selectById(columnId);
      if (column) {
        columns.start.push(column);
      }
    });

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
  }
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
        id: nanoid(),
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
