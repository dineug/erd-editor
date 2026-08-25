import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  FormatTableOptions,
  hasNRelationship,
  hasOneRelationship,
} from './utils';

const BARE_DATA_TYPE = /^[A-Za-z_][0-9A-Za-z_]*(\([0-9]+(,[0-9]+)*\))?$/;
const NUMERIC_LITERAL = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const KEYWORD_LITERAL = /^(true|false|null)$/i;
const QUOTED_LITERAL = /^'([^']|'')*'$/;
const ESCAPED_QUOTE = /''/g;
const NAME_ESCAPE = /["\\\n\r]/g;
const NOTE_ESCAPE = /['\\\n\r]/g;
const ESCAPE_MAP: Record<string, string> = {
  '\n': '\\n',
  '\r': '\\r',
};

type RelationshipPoint = Relationship['start'];

type Endpoint = {
  table: string;
  columns: string[];
};

type DBMLContext = {
  tableNames: Map<string, string>;
  columnIds: Set<string>;
};

export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const stringBuffer: string[] = [''];
  const context = createDBMLContext(state);

  query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .forEach(table => {
      if (!context.tableNames.has(table.id)) {
        return;
      }

      formatDBMLTable(state, { buffer: stringBuffer, table }, context);
      stringBuffer.push('');
    });

  const relationships = formatRelationships(state, context);

  if (relationships.length !== 0) {
    relationships.forEach(line => stringBuffer.push(line));
    stringBuffer.push('');
  }

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  formatDBMLTable(state, { buffer, table }, createDBMLContext(state));
}

function formatDBMLTable(
  state: RootState,
  { buffer, table }: FormatTableOptions,
  context: DBMLContext
) {
  const { collections } = state;
  const name = context.tableNames.get(table.id);

  if (name === undefined) {
    return;
  }

  buffer.push(`Table ${quoteName(name)} {`);

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      if (!context.columnIds.has(column.id)) {
        return;
      }

      buffer.push(`  ${formatColumn(column)}`);
    });

  if (table.comment.trim() !== '') {
    buffer.push('');
    buffer.push(`  Note: ${quoteNote(table.comment)}`);
  }

  const indexes = formatIndexes(state, table, context);

  if (indexes.length !== 0) {
    buffer.push('');
    buffer.push('  Indexes {');
    indexes.forEach(line => buffer.push(line));
    buffer.push('  }');
  }

  buffer.push('}');
}

function formatColumn(column: Column): string {
  const settings: string[] = [];

  if (bHas(column.options, ColumnOption.primaryKey)) {
    settings.push('pk');
  }
  if (bHas(column.options, ColumnOption.autoIncrement)) {
    settings.push('increment');
  }
  if (bHas(column.options, ColumnOption.unique)) {
    settings.push('unique');
  }
  if (bHas(column.options, ColumnOption.notNull)) {
    settings.push('not null');
  }
  if (column.default.trim() !== '') {
    settings.push(`default: ${formatDefault(column.default)}`);
  }
  if (column.comment.trim() !== '') {
    settings.push(`note: ${quoteNote(column.comment)}`);
  }

  return `${quoteName(column.name)} ${formatDataType(column.dataType)}${
    settings.length === 0 ? '' : ` [${settings.join(', ')}]`
  }`;
}

function formatIndexes(
  { doc: { indexIds }, collections }: RootState,
  table: Table,
  context: DBMLContext
): string[] {
  const columnCollection = query(collections).collection('tableColumnEntities');
  const indexColumnCollection = query(collections).collection(
    'indexColumnEntities'
  );
  const buffer: string[] = [];

  query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .filter(index => index.tableId === table.id)
    .forEach(index => {
      const names: string[] = [];

      indexColumnCollection
        .selectByIds(index.indexColumnIds)
        .forEach(indexColumn => {
          const column = columnCollection.selectById(indexColumn.columnId);

          if (
            !column ||
            column.tableId !== table.id ||
            !context.columnIds.has(column.id)
          ) {
            return;
          }

          names.push(quoteName(column.name));
        });

      if (names.length === 0) {
        return;
      }

      const settings: string[] = [];

      if (index.name.trim() !== '') {
        settings.push(`name: ${quoteName(index.name)}`);
      }
      if (index.unique) {
        settings.push('unique');
      }

      buffer.push(
        `    (${names.join(', ')})${
          settings.length === 0 ? '' : ` [${settings.join(', ')}]`
        }`
      );
    });

  return buffer;
}

function formatRelationships(
  { doc: { relationshipIds }, collections }: RootState,
  context: DBMLContext
): string[] {
  const columnCollection = query(collections).collection('tableColumnEntities');
  const buffer: string[] = [];
  const used = new Set<string>();

  const resolveEndpoint = (point: RelationshipPoint): Endpoint | null => {
    const table = context.tableNames.get(point.tableId);

    if (table === undefined || point.columnIds.length === 0) {
      return null;
    }

    const columns: string[] = [];

    for (const columnId of point.columnIds) {
      const column = columnCollection.selectById(columnId);

      if (
        !column ||
        column.tableId !== point.tableId ||
        !context.columnIds.has(column.id)
      ) {
        return null;
      }

      columns.push(column.name);
    }

    return { table, columns };
  };

  query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .forEach(relationship => {
      const operator = relationshipOperator(relationship);
      const start = resolveEndpoint(relationship.start);
      const end = resolveEndpoint(relationship.end);

      if (
        operator === '' ||
        start === null ||
        end === null ||
        start.columns.length !== end.columns.length
      ) {
        return;
      }

      const startText = formatEndpoint(start);
      const endText = formatEndpoint(end);
      const key = [startText, endText].sort().join(' ');

      if (used.has(key)) {
        return;
      }
      used.add(key);

      buffer.push(`Ref: ${startText} ${operator} ${endText}`);
    });

  return buffer;
}

function createDBMLContext(state: RootState): DBMLContext {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const context: DBMLContext = {
    tableNames: new Map<string, string>(),
    columnIds: new Set<string>(),
  };
  const columnCollection = query(collections).collection('tableColumnEntities');
  const usedTableNames = new Set<string>();

  query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .forEach(table => {
      const usedColumnNames = new Set<string>();
      let count = 0;

      columnCollection.selectByIds(table.columnIds).forEach(column => {
        if (column.dataType.trim() === '' || usedColumnNames.has(column.name)) {
          return;
        }

        usedColumnNames.add(column.name);
        context.columnIds.add(column.id);
        count += 1;
      });

      if (count === 0) {
        return;
      }

      context.tableNames.set(table.id, uniqueName(usedTableNames, table.name));
    });

  return context;
}

function formatEndpoint({ table, columns }: Endpoint): string {
  const names = columns.map(quoteName);

  return `${quoteName(table)}.${
    names.length === 1 ? names[0] : `(${names.join(', ')})`
  }`;
}

function relationshipOperator(relationship: Relationship): string {
  if (hasNRelationship(relationship.relationshipType)) {
    return '<';
  }

  if (hasOneRelationship(relationship.relationshipType)) {
    return '-';
  }

  return '';
}

function formatDataType(dataType: string): string {
  const value = dataType.trim();

  return BARE_DATA_TYPE.test(value) ? value : quoteName(value);
}

function formatDefault(value: string): string {
  const trimmed = value.trim();

  if (NUMERIC_LITERAL.test(trimmed)) {
    return trimmed;
  }

  if (KEYWORD_LITERAL.test(trimmed)) {
    return trimmed.toLocaleLowerCase();
  }

  if (QUOTED_LITERAL.test(trimmed)) {
    return quoteNote(trimmed.slice(1, -1).replace(ESCAPED_QUOTE, "'"));
  }

  if (trimmed.includes('`')) {
    return quoteNote(trimmed);
  }

  return `\`${trimmed}\``;
}

function quoteName(value: string): string {
  return `"${escapeValue(value, NAME_ESCAPE)}"`;
}

function quoteNote(value: string): string {
  return `'${escapeValue(value, NOTE_ESCAPE)}'`;
}

function escapeValue(value: string, pattern: RegExp): string {
  return value.replace(pattern, char => ESCAPE_MAP[char] ?? `\\${char}`);
}

function uniqueName(used: Set<string>, name: string): string {
  let result = name;
  let index = 2;

  while (used.has(result)) {
    result = `${name}${index}`;
    index += 1;
  }

  used.add(result);
  return result;
}
