import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  getJsonShape,
  isNullableColumn,
  JsonShape,
  JsonShapeKind,
  toTypeScriptPropertyKey,
  toTypeScriptTypeName,
} from './jsonShape';
import { FormatColumnOptions, FormatTableOptions, getNameCase } from './utils';
import { formatComment } from './zod';

const INDENT = '  ';

const TYPES: Readonly<Record<Exclude<JsonShapeKind, 'enum'>, string>> = {
  boolean: 'boolean',
  integer: 'number',
  number: 'number',
  string: 'string',
  uuid: 'string',
  guid: 'string',
  date: 'string',
  time: 'string',
  naiveDateTime: 'string',
  offsetDateTime: 'string',
  base64: 'string',
  json: 'unknown',
  ipv4: 'string',
  ipv6: 'string',
  null: 'null',
};

// Both already hold null, so a nullable column adds no union to them.
const NULL_HOLDING_TYPES: ReadonlySet<string> = new Set(['unknown', 'null']);

export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const stringBuffer: string[] = [''];
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);

  tables.forEach(table => {
    formatTable(state, {
      buffer: stringBuffer,
      table,
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
    settings: { tableNameCase },
    collections,
  } = state;
  const typeName = toTypeScriptTypeName(getNameCase(table.name, tableNameCase));

  formatComment(buffer, '', table.comment);
  buffer.push(`export interface ${typeName} {`);

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      formatColumn(state, { buffer, column });
    });

  buffer.push(`}`);
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions
) {
  const key = toTypeScriptPropertyKey(getNameCase(column.name, columnNameCase));
  const type = toTypeScriptType(
    getJsonShape(column.dataType, database),
    isNullableColumn(column)
  );

  formatComment(buffer, INDENT, column.comment);
  buffer.push(`${INDENT}${key}: ${type};`);
}

/**
 * A value's type as z.infer reads it from the Zod schema of the same column:
 * an array type for each dimension, its elements never null, and a null union
 * where the column takes NULL.
 */
function toTypeScriptType(shape: JsonShape, nullable: boolean): string {
  const element = elementType(shape);
  const isUnion = shape.kind === 'enum' && shape.members.length > 1;
  const type =
    shape.arrayDepth === 0
      ? element
      : `${isUnion ? `(${element})` : element}${'[]'.repeat(shape.arrayDepth)}`;

  return nullable && !NULL_HOLDING_TYPES.has(type) ? `${type} | null` : type;
}

function elementType({ kind, members }: JsonShape): string {
  return kind === 'enum'
    ? members.map(member => JSON.stringify(member)).join(' | ')
    : TYPES[kind];
}
