import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  ColumnScalar,
  ColumnType,
  getColumnType,
  POSTGRES_OBJECT_ID_TYPES,
} from './columnTypes';
import { FormatTableOptions, getNameCase, splitLines } from './utils';

/**
 * Date, Data, Decimal and UUID need Foundation, and an unused import draws no
 * warning, so the text and the one-table view open on it whatever they hold.
 */
export const SWIFT_HEADER: readonly string[] = ['', 'import Foundation'];

export const INDENT = '    ';

/**
 * A nonisolated struct keeps its conformances usable off the main actor in a
 * module whose default isolation is MainActor, as new Xcode app targets set.
 */
export const STRUCT_HEAD = 'nonisolated struct';

export const CONFORMANCES = 'Codable, Hashable, Sendable';

/** The words the Swift lexer reserves, which a name takes only in backticks. */
export const SWIFT_KEYWORDS: ReadonlySet<string> = new Set([
  'Any',
  'Self',
  '_',
  'as',
  'associatedtype',
  'break',
  'case',
  'catch',
  'class',
  'continue',
  'default',
  'defer',
  'deinit',
  'do',
  'else',
  'enum',
  'extension',
  'fallthrough',
  'false',
  'fileprivate',
  'for',
  'func',
  'guard',
  'if',
  'import',
  'in',
  'init',
  'inout',
  'internal',
  'is',
  'let',
  'nil',
  'operator',
  'precedencegroup',
  'private',
  'protocol',
  'public',
  'repeat',
  'rethrows',
  'return',
  'self',
  'static',
  'struct',
  'subscript',
  'super',
  'switch',
  'throw',
  'throws',
  'true',
  'try',
  'typealias',
  'var',
  'where',
  'while',
]);

// A member named Type or Protocol would clash with the metatype it names.
const MEMBER_KEYWORDS = new Set(['Protocol', 'Type']);

/**
 * The types and protocols the output writes unqualified: a struct of one of
 * these names breaks the conformances or silently retypes every such field.
 */
export const TYPE_NAMES: ReadonlySet<string> = new Set([
  'Bool',
  'Codable',
  'CodingKey',
  'Data',
  'Date',
  'Decimal',
  'Double',
  'Float',
  'Hashable',
  'Int16',
  'Int32',
  'Int64',
  'Int8',
  'Sendable',
  'String',
  'UInt16',
  'UInt32',
  'UInt64',
  'UInt8',
  'UUID',
]);

const CODING_KEYS = 'CodingKeys';

/**
 * The coding keys take the first name, and a RawValue case shadows the raw
 * type String gives them, in backticks too, so a property takes neither.
 */
const RESERVED_KEYS: ReadonlySet<string> = new Set([CODING_KEYS, 'RawValue']);

/**
 * Foundation has no time of day, interval or any-value type, so those and JSON
 * are the text as stored; every date and timestamp is an instant.
 */
const SWIFT_SCALARS: Readonly<Record<ColumnScalar, string>> = {
  bool: 'Bool',
  i8: 'Int8',
  i16: 'Int16',
  i32: 'Int32',
  i64: 'Int64',
  u8: 'UInt8',
  u16: 'UInt16',
  u32: 'UInt32',
  u64: 'UInt64',
  f32: 'Float',
  f64: 'Double',
  decimal: 'Decimal',
  string: 'String',
  bytes: 'Data',
  uuid: 'UUID',
  json: 'String',
  date: 'Date',
  time: 'String',
  timeTz: 'String',
  dateTime: 'Date',
  dateTimeUtc: 'Date',
  dateTimeOffset: 'Date',
  interval: 'String',
};

const NUL = String.fromCharCode(0);

type Property = {
  name: string;
  key: string;
  type: string;
  column: Column;
};

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

  const buffer = [...SWIFT_HEADER];

  tables.forEach(table => {
    buffer.push('');
    formatTable(state, { buffer, table });
  });
  buffer.push('');

  return buffer.join('\n');
}

/** One table's struct under the import, which a file of its own needs. */
export function createTableCode(state: RootState, table: Table): string {
  const buffer = [...SWIFT_HEADER, ''];

  formatTable(state, { buffer, table });
  buffer.push('');

  return buffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const {
    settings: { tableNameCase, columnNameCase, database },
    collections,
  } = state;
  const structName = toStructName(getNameCase(table.name, tableNameCase));
  const head = `${STRUCT_HEAD} ${structName}: ${CONFORMANCES}`;
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  formatComment(buffer, '', table.comment);

  if (columns.length === 0) {
    buffer.push(`${head} {}`);
    return;
  }

  const properties = columns.map(column =>
    toProperty(column, columnNameCase, database)
  );

  buffer.push(`${head} {`);
  properties.forEach(({ name, type, column }) => {
    formatComment(buffer, INDENT, column.comment);
    buffer.push(`${INDENT}var ${name}: ${type}`);
  });
  formatCodingKeys(buffer, properties);
  buffer.push('}');
}

function toProperty(
  column: Column,
  columnNameCase: number,
  database: number
): Property {
  const key = toPropertyKey(getNameCase(column.name, columnNameCase));
  const type = swiftType(column.dataType, database);
  // A primary key takes no NULL, its flag set or not, as rust.ts reads it.
  const isNullable =
    !bHas(column.options, ColumnOption.primaryKey) &&
    !bHas(column.options, ColumnOption.notNull);

  return {
    name: toPropertyName(key),
    key,
    type: isNullable ? `${type}?` : type,
    column,
  };
}

/**
 * The coding keys, written only where a property's name is not its column's,
 * so that Codable reads and writes every column under its own name.
 */
function formatCodingKeys(buffer: string[], properties: Property[]) {
  if (properties.every(({ key, column }) => key === column.name)) {
    return;
  }

  buffer.push('');
  buffer.push(`${INDENT}enum ${CODING_KEYS}: String, CodingKey {`);
  properties.forEach(({ name, key, column }) => {
    buffer.push(
      key === column.name
        ? `${INDENT}${INDENT}case ${name}`
        : `${INDENT}${INDENT}case ${name} = ${toStringLiteral(column.name)}`
    );
  });
  buffer.push(`${INDENT}}`);
}

/** A column's Swift type, one array a PostgreSQL dimension, without its optional. */
export function swiftType(dataType: string, database: number): string {
  const columnType = getColumnType(dataType, database);
  let type = swiftScalar(columnType, database);

  for (let depth = 0; depth < columnType.arrayDepth; depth++) {
    type = `[${type}]`;
  }
  return type;
}

/**
 * MariaDB sends its UUID as 36 characters, which MySQLNIO reads into a UUID
 * only as 16 bytes; PostgreSQL writes money, oid, xid, cid and xid8 as text
 * in its JSON, and PostgresNIO reads none of them into a number.
 */
function swiftScalar(
  { scalar, base, isMoney }: ColumnType,
  database: number
): string {
  if (database === Database.MariaDB && scalar === 'uuid') {
    return 'String';
  }
  if (
    database === Database.PostgreSQL &&
    (isMoney || POSTGRES_OBJECT_ID_TYPES.has(base))
  ) {
    return 'String';
  }
  return SWIFT_SCALARS[scalar];
}

/** A type name gets an underscore after it, and a keyword backticks. */
export function toStructName(name: string): string {
  if (TYPE_NAMES.has(name)) {
    return `${name}_`;
  }
  return SWIFT_KEYWORDS.has(name) ? `\`${name}\`` : name;
}

/** A property's coding key, an underscore after a name the keys reserve. */
export function toPropertyKey(name: string): string {
  return RESERVED_KEYS.has(name) ? `${name}_` : name;
}

export function toPropertyName(key: string): string {
  return SWIFT_KEYWORDS.has(key) || MEMBER_KEYWORDS.has(key)
    ? `\`${key}\``
    : key;
}

/**
 * A Swift string literal: a quote and a backslash, which would also open an
 * interpolation, get a backslash, and every C0 control and DEL an escape.
 */
export function toStringLiteral(value: string): string {
  let literal = '"';

  for (const character of value) {
    const code = character.charCodeAt(0);

    if (character === '"' || character === '\\') {
      literal += `\\${character}`;
    } else if (code < 0x20 || code === 0x7f) {
      literal += escapeCodePoint(character);
    } else {
      literal += character;
    }
  }
  return `${literal}"`;
}

/**
 * A comment as documentation lines, split at every line terminator, since a
 * lone CR ends a line comment; a NUL, which Swift warns about, is an escape.
 */
export function formatComment(
  buffer: string[],
  indent: string,
  comment: string
) {
  const lines = splitLines(comment.replaceAll(NUL, escapeCodePoint(NUL))).map(
    line => line.trimEnd()
  );

  while (lines[0] === '') {
    lines.shift();
  }
  while (lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.forEach(line =>
    buffer.push(line === '' ? `${indent}///` : `${indent}/// ${line}`)
  );
}

function escapeCodePoint(character: string): string {
  return `\\u{${character.charCodeAt(0).toString(16).toUpperCase()}}`;
}
