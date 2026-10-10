import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  getJsonShape,
  isNullableColumn,
  JsonShape,
  JsonShapeKind,
  toTypeScriptPropertyKey,
  toTypeScriptTypeName,
} from './jsonShape';
import { FormatTableOptions, getNameCase, splitLines } from './utils';

const IMPORT_LINE = 'import * as z from "zod";';
const INDENT = '  ';
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const UINT32_MAX = 4294967295;

const SCHEMAS: Readonly<
  Record<Exclude<JsonShapeKind, 'integer' | 'string' | 'enum'>, string>
> = {
  boolean: 'z.boolean()',
  number: 'z.number()',
  uuid: 'z.uuid()',
  guid: 'z.guid()',
  date: 'z.iso.date()',
  time: 'z.iso.time()',
  naiveDateTime: 'z.iso.datetime({ local: true })',
  offsetDateTime: 'z.iso.datetime({ offset: true })',
  base64: 'z.base64()',
  json: 'z.json()',
  ipv4: 'z.ipv4()',
  ipv6: 'z.ipv6()',
  null: 'z.null()',
};

// A type alias may not take the alias keyword as its name, nor the name of
// the namespace the schemas are imported under.
const ZOD_RESERVED_TYPE_NAMES = new Set(['as', 'z']);

/** Every table's row schema and its inferred type, under one import line. */
export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);

  if (tables.length === 0) {
    return '';
  }

  const buffer = ['', IMPORT_LINE];

  tables.forEach(table => {
    buffer.push('');
    formatTable(state, { buffer, table });
  });
  buffer.push('');

  return buffer.join('\n');
}

/** One table under the import line, so its file compiles on its own. */
export function createTableCode(state: RootState, table: Table): string {
  const buffer = ['', IMPORT_LINE, ''];

  formatTable(state, { buffer, table });
  buffer.push('');

  return buffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const {
    settings: { tableNameCase },
    collections,
  } = state;
  const typeName = toZodTypeName(getNameCase(table.name, tableNameCase));
  const schemaName = `${typeName}Schema`;
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  formatComment(buffer, '', table.comment);

  if (columns.length === 0) {
    buffer.push(`export const ${schemaName} = z.object({});`);
  } else {
    buffer.push(`export const ${schemaName} = z.object({`);
    columns.forEach(column => formatColumn(state, buffer, column));
    buffer.push('});');
  }
  buffer.push(`export type ${typeName} = z.infer<typeof ${schemaName}>;`);
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  buffer: string[],
  column: Column
) {
  const key = getNameCase(column.name, columnNameCase);
  const schema = toZodSchema(getJsonShape(column.dataType, database));

  formatComment(buffer, INDENT, column.comment);
  buffer.push(
    `${INDENT}${toZodPropertyKey(key)}: ${schema}${
      isNullableColumn(column) ? '.nullable()' : ''
    },`
  );
}

/** A value's Zod schema, one z.array around it for each array dimension. */
export function toZodSchema(shape: JsonShape): string {
  let schema = elementSchema(shape);

  for (let depth = 0; depth < shape.arrayDepth; depth++) {
    schema = `z.array(${schema})`;
  }
  return schema;
}

/**
 * A name a type alias may not take, z included, gets an underscore after it;
 * any other name, one that is no identifier or a repeated one included, is
 * written as is.
 */
export function toZodTypeName(name: string): string {
  return ZOD_RESERVED_TYPE_NAMES.has(name)
    ? `${name}_`
    : toTypeScriptTypeName(name);
}

/**
 * A property key as an object literal writes it; __proto__ is computed, since
 * written plainly or quoted it would set the object's prototype instead.
 */
export function toZodPropertyKey(name: string): string {
  return name === '__proto__' ? '["__proto__"]' : toTypeScriptPropertyKey(name);
}

/** A comment as line comments, one for each of its lines. */
export function formatComment(
  buffer: string[],
  indent: string,
  comment: string
) {
  const lines = splitLines(comment).map(line => line.trimEnd());

  while (lines.length > 0 && lines[0] === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.forEach(line =>
    buffer.push(line === '' ? `${indent}//` : `${indent}// ${line}`)
  );
}

function elementSchema(shape: JsonShape): string {
  switch (shape.kind) {
    case 'integer':
      return integerSchema(shape);
    case 'string':
      return shape.maxLength === null
        ? 'z.string()'
        : `z.string().max(${shape.maxLength})`;
    case 'enum':
      return `z.enum([${shape.members.map(member => JSON.stringify(member)).join(', ')}])`;
  }
  return SCHEMAS[shape.kind];
}

function integerSchema({ minimum, maximum }: JsonShape): string {
  if (minimum === INT32_MIN && maximum === INT32_MAX) {
    return 'z.int32()';
  }
  if (minimum === 0 && maximum === UINT32_MAX) {
    return 'z.uint32()';
  }
  return `z.int()${minimum === null ? '' : `.min(${minimum})`}${
    maximum === null ? '' : `.max(${maximum})`
  }`;
}
