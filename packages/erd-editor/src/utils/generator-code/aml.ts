import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { autoName, Name, orderByNameASC } from '@/utils/schema-sql/utils';

import {
  FormatTableOptions,
  hasNRelationship,
  hasOneRelationship,
} from './utils';

const BARE_IDENTIFIER = /^[A-Za-z_][0-9A-Za-z_]*$/;
const AML_KEYWORD =
  /^(as|check|false|fk|index|namespace|null|nullable|pk|rel|true|type|unique)$/i;
const NUMERIC_LITERAL = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const KEYWORD_LITERAL = /^(true|false|null)$/i;
const QUOTED_LITERAL = /^'([^']|'')*'$/;
const ESCAPED_QUOTE = /''/g;
const IDENTIFIER_ESCAPE = /["\\]/g;
const HAS_LINE_TERMINATOR = /[\n\r]/;
const LINE_TERMINATOR = /\r\n|[\n\r]/g;
const HASH = /#/g;

type RelationshipPoint = Relationship['start'];

type Endpoint = {
  table: string;
  columns: string[];
};

type AMLContext = {
  tableNames: Map<string, string>;
  columnNames: Map<string, string>;
  inlineRelations: Map<string, string>;
  relationLines: string[];
};

export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const stringBuffer: string[] = [''];
  const context = createAMLContext(state);

  query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .forEach(table => {
      formatAMLTable(state, { buffer: stringBuffer, table }, context);
      stringBuffer.push('');
    });

  if (context.relationLines.length !== 0) {
    context.relationLines.forEach(line => stringBuffer.push(line));
    stringBuffer.push('');
  }

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  formatAMLTable(state, { buffer, table }, createAMLContext(state));
}

function formatAMLTable(
  state: RootState,
  { buffer, table }: FormatTableOptions,
  context: AMLContext
) {
  const { collections } = state;
  const name = context.tableNames.get(table.id);

  if (name === undefined) {
    return;
  }

  buffer.push(`${quoteIdentifier(name)}${formatDoc(table.comment, '')}`);

  const indexes = formatIndexes(state, table, context, name);

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      const columnName = context.columnNames.get(column.id);

      if (columnName === undefined) {
        return;
      }

      buffer.push(
        `  ${formatAttribute(
          column,
          columnName,
          indexes.get(column.id) ?? '',
          context.inlineRelations.get(column.id) ?? ''
        )}`
      );
    });
}

function formatAttribute(
  column: Column,
  name: string,
  indexes: string,
  relations: string
): string {
  const dataType = formatDataType(column.dataType);
  const defaultValue = dataType === '' ? '' : formatDefault(column.default);
  const nullable = bHas(column.options, ColumnOption.notNull)
    ? ''
    : ' nullable';
  const primaryKey = bHas(column.options, ColumnOption.primaryKey) ? ' pk' : '';
  const props = bHas(column.options, ColumnOption.autoIncrement)
    ? ' {autoIncrement}'
    : '';

  return `${quoteIdentifier(
    name
  )}${dataType}${defaultValue}${nullable}${primaryKey}${indexes}${relations}${props}${formatDoc(
    column.comment,
    '  '
  )}`;
}

function formatIndexes(
  { doc: { indexIds }, collections }: RootState,
  table: Table,
  context: AMLContext,
  tableName: string
): Map<string, string> {
  const columnCollection = query(collections).collection('tableColumnEntities');
  const indexColumnCollection = query(collections).collection(
    'indexColumnEntities'
  );
  const result = new Map<string, string>();
  const names: Name[] = [];

  const append = (columnId: string, value: string) =>
    result.set(columnId, `${result.get(columnId) ?? ''}${value}`);

  columnCollection.selectByIds(table.columnIds).forEach(column => {
    if (
      context.columnNames.has(column.id) &&
      bHas(column.options, ColumnOption.unique)
    ) {
      append(column.id, ' unique');
    }
  });

  query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .filter(index => index.tableId === table.id)
    .forEach((index, position) => {
      const columnIds: string[] = [];

      indexColumnCollection
        .selectByIds(index.indexColumnIds)
        .forEach(indexColumn => {
          const column = columnCollection.selectById(indexColumn.columnId);

          if (
            !column ||
            column.tableId !== table.id ||
            !context.columnNames.has(column.id)
          ) {
            return;
          }

          columnIds.push(column.id);
        });

      if (columnIds.length === 0) {
        return;
      }

      const wanted =
        index.name.trim() === ''
          ? columnIds.length === 1
            ? ''
            : `${tableName}_idx_${position + 1}`
          : index.name.trim();
      const name = wanted === '' ? '' : autoName(names, index.id, wanted);
      names.push({ id: index.id, name });

      const constraint = ` ${index.unique ? 'unique' : 'index'}${
        name === '' ? '' : `=${quoteIdentifier(name)}`
      }`;

      columnIds.forEach(columnId => append(columnId, constraint));
    });

  return result;
}

function createAMLContext(state: RootState): AMLContext {
  const {
    doc: { tableIds, relationshipIds },
    collections,
  } = state;
  const context: AMLContext = {
    tableNames: new Map<string, string>(),
    columnNames: new Map<string, string>(),
    inlineRelations: new Map<string, string>(),
    relationLines: [],
  };
  const columnCollection = query(collections).collection('tableColumnEntities');
  const usedTableNames = new Set<string>();

  query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .forEach(table => {
      const usedColumnNames = new Set<string>();

      columnCollection.selectByIds(table.columnIds).forEach(column => {
        if (usedColumnNames.has(column.name)) {
          return;
        }

        usedColumnNames.add(column.name);
        context.columnNames.set(column.id, column.name);
      });

      context.tableNames.set(table.id, uniqueName(usedTableNames, table.name));
    });

  const resolveEndpoint = (point: RelationshipPoint): Endpoint | null => {
    const table = context.tableNames.get(point.tableId);

    if (table === undefined || point.columnIds.length === 0) {
      return null;
    }

    const columns: string[] = [];

    for (const columnId of point.columnIds) {
      const column = columnCollection.selectById(columnId);
      const name = context.columnNames.get(columnId);

      if (!column || column.tableId !== point.tableId || name === undefined) {
        return null;
      }

      columns.push(name);
    }

    return { table, columns };
  };

  const used = new Set<string>();

  query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .forEach(relationship => {
      const arrow = relationshipArrow(relationship);
      const parent = resolveEndpoint(relationship.start);
      const child = resolveEndpoint(relationship.end);

      if (
        arrow === '' ||
        parent === null ||
        child === null ||
        parent.columns.length !== child.columns.length
      ) {
        return;
      }

      const parentText = formatEndpoint(parent);
      const childText = formatEndpoint(child);
      const key = [parentText, childText].sort().join(' ');

      if (used.has(key)) {
        return;
      }
      used.add(key);

      if (child.columns.length === 1) {
        const [columnId] = relationship.end.columnIds;

        context.inlineRelations.set(
          columnId,
          `${
            context.inlineRelations.get(columnId) ?? ''
          } ${arrow} ${parentText}`
        );
        return;
      }

      context.relationLines.push(`rel ${childText} ${arrow} ${parentText}`);
    });

  return context;
}

function formatEndpoint({ table, columns }: Endpoint): string {
  return `${quoteIdentifier(table)}(${columns
    .map(quoteIdentifier)
    .join(', ')})`;
}

function relationshipArrow(relationship: Relationship): string {
  if (hasNRelationship(relationship.relationshipType)) {
    return '->';
  }

  if (hasOneRelationship(relationship.relationshipType)) {
    return '--';
  }

  return '';
}

function formatDataType(dataType: string): string {
  const value = dataType.trim();

  return value === '' ? '' : ` ${quoteIdentifier(value)}`;
}

function formatDefault(value: string): string {
  const trimmed = value.trim();

  return trimmed === '' ? '' : `=${formatValue(trimmed)}`;
}

function formatValue(value: string): string {
  if (NUMERIC_LITERAL.test(value)) {
    return value;
  }

  if (KEYWORD_LITERAL.test(value)) {
    return value.toLocaleLowerCase();
  }

  if (QUOTED_LITERAL.test(value)) {
    return quoteIdentifier(value.slice(1, -1).replace(ESCAPED_QUOTE, "'"));
  }

  if (value.includes('`')) {
    return quoteIdentifier(value);
  }

  return `\`${value}\``;
}

function formatDoc(comment: string, indent: string): string {
  const value = comment.trim();

  if (value === '') {
    return '';
  }

  if (HAS_LINE_TERMINATOR.test(value) && !value.includes('|||')) {
    return ` |||\n${value
      .split(LINE_TERMINATOR)
      .map(line => `${indent}  ${line}\n`)
      .join('')}${indent}|||`;
  }

  return ` | ${value.replace(LINE_TERMINATOR, ' ').replace(HASH, '\\#')}`;
}

function quoteIdentifier(value: string): string {
  return BARE_IDENTIFIER.test(value) && !AML_KEYWORD.test(value)
    ? value
    : `"${escapeIdentifier(value)}"`;
}

function escapeIdentifier(value: string): string {
  return value
    .replace(IDENTIFIER_ESCAPE, char => `\\${char}`)
    .replace(LINE_TERMINATOR, '\\n');
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
