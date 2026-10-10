import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, Database } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  BINARY_TYPES,
  ColumnScalar,
  ColumnType,
  getColumnType,
  isMySQLFamily,
  MONEY_TYPES,
  POSTGRES_OBJECT_ID_TYPES,
  TIMESTAMP_TZ_TYPES,
  UUID_TYPES,
} from './columnTypes';
import {
  FormatColumnOptions,
  FormatTableOptions,
  getNameCase,
  getPrimitiveType,
} from './utils';

const convertTypeMap: PrimitiveTypeMap = {
  int: 'int',
  long: 'long',
  float: 'float',
  double: 'double',
  decimal: 'decimal',
  boolean: 'bool',
  string: 'string',
  lob: 'string',
  date: 'DateTime',
  dateTime: 'DateTime',
  time: 'TimeSpan',
};

// The characters C# ends a single-line comment at, so each starts a new one.
const NEWLINE = /\r\n|\r|\n|\u0085|\u2028|\u2029/g;

// The unsigned integers at the classifier's width, as MySqlConnector and Npgsql
// read them: MySQL's and MariaDB's UNSIGNED, ZEROFILL, SERIAL and BIT(n) types,
// and PostgreSQL's oid, cid, xid and xid8, which Npgsql refuses as a long.
const unsignedTypes: Partial<Record<ColumnScalar, string>> = {
  u8: 'byte',
  u16: 'ushort',
  u32: 'uint',
  u64: 'ulong',
};

// SQL Server alone: elsewhere timestamp is a date and time and tinyint is
// signed, so there these names keep the shared table's type.
const mssqlTypes = new Map([
  ['rowversion', 'byte[]'],
  ['sql_variant', 'object'],
  ['timestamp', 'byte[]'],
  ['tinyint', 'byte'],
]);

// Npgsql reads a pg_lsn as a ulong and regtype and regconfig, two object ids,
// as a uint, and refuses a string for each.
const postgresTypes = new Map([
  ['pg_lsn', 'ulong'],
  ['regconfig', 'uint'],
  ['regtype', 'uint'],
]);

const vendorTypes = new Map<number, Map<string, string>>([
  [Database.MSSQL, mssqlTypes],
  [Database.PostgreSQL, postgresTypes],
]);

const referenceTypes = new Set(['byte[]', 'object', 'string']);

// The attribute dotnet ef dbcontext scaffold puts on a property it renamed,
// spelled from global:: so it needs no using line and a class named System,
// from a table of that name, cannot hide the namespace it lives in.
const COLUMN_ATTRIBUTE =
  'global::System.ComponentModel.DataAnnotations.Schema.Column';

// Formatting characters, which C# drops from an identifier before comparing.
const FORMAT_CHARACTERS = /\p{Cf}/gu;

// The white space and line breaks C# reads around a name as no part of it; the
// control character U+001A, which Roslyn alone reads so, is left in.
const SURROUNDING_SPACE = /^[\s\u0085]+|[\s\u0085]+$/g;

type Property = {
  name: string;
  isRenamed: boolean;
};

/**
 * C#'s reserved words, Roslyn's four undocumented ones and the contextual
 * keywords it refuses or warns against as a type name, taken only after @.
 */
const CSHARP_KEYWORDS: ReadonlySet<string> = new Set([
  '__arglist',
  '__makeref',
  '__reftype',
  '__refvalue',
  'abstract',
  'as',
  'base',
  'bool',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'checked',
  'class',
  'const',
  'continue',
  'decimal',
  'default',
  'delegate',
  'do',
  'double',
  'else',
  'enum',
  'event',
  'explicit',
  'extension',
  'extern',
  'false',
  'file',
  'finally',
  'fixed',
  'float',
  'for',
  'foreach',
  'goto',
  'if',
  'implicit',
  'in',
  'int',
  'interface',
  'internal',
  'is',
  'lock',
  'long',
  'namespace',
  'new',
  'null',
  'object',
  'operator',
  'out',
  'override',
  'params',
  'private',
  'protected',
  'public',
  'readonly',
  'record',
  'ref',
  'required',
  'return',
  'sbyte',
  'scoped',
  'sealed',
  'short',
  'sizeof',
  'stackalloc',
  'static',
  'string',
  'struct',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'uint',
  'ulong',
  'unchecked',
  'unsafe',
  'ushort',
  'using',
  'virtual',
  'void',
  'volatile',
  'while',
]);

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
    settings: { tableNameCase, columnNameCase },
    collections,
  } = state;
  const className = getNameCase(table.name, tableNameCase);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);
  const properties = toProperties(
    className,
    columns.map(column => {
      const columnName = getNameCase(column.name, columnNameCase);
      return columnName.charAt(0).toUpperCase() + columnName.slice(1);
    })
  );

  formatComment(buffer, '', table.comment);
  buffer.push(`public class ${toIdentifier(className)} {`);

  columns.forEach((column, index) => {
    formatColumn(state, { buffer, column }, properties[index]);
  });

  buffer.push(`}`);
}

/**
 * Property names as dotnet ef dbcontext scaffold writes them: one C# reads as
 * its class's name, which it refuses, takes the first number no other name in
 * the class holds, a renamed one before it included.
 */
function toProperties(className: string, names: string[]): Property[] {
  const owner = identifierText(className);
  const taken = new Set([owner, ...names.map(identifierText)]);

  return names.map(name => {
    if (owner === '' || identifierText(name) !== owner) {
      return { name: toIdentifier(name), isRenamed: false };
    }

    let suffix = 1;
    while (taken.has(`${owner}${suffix}`)) {
      suffix++;
    }
    taken.add(`${owner}${suffix}`);
    return { name: `${owner}${suffix}`, isRenamed: true };
  });
}

/**
 * A name as C# compares identifiers: without a Cf character, the white space
 * and line breaks around it or an @ before it.
 */
function identifierText(name: string): string {
  return name
    .replace(FORMAT_CHARACTERS, '')
    .replace(SURROUNDING_SPACE, '')
    .replace(/^@/, '');
}

function formatColumn(
  { settings: { database } }: RootState,
  { buffer, column }: FormatColumnOptions,
  { name: propertyName, isRenamed }: Property
) {
  const columnType = getColumnType(column.dataType, database);
  const type = arrayType(
    getElementType(columnType, database),
    columnType.arrayDepth
  );
  // A primary key takes no NULL, its flag set or not, as typeorm.ts reads it.
  const isNullable =
    !bHas(column.options, ColumnOption.primaryKey) &&
    !bHas(column.options, ColumnOption.notNull);

  formatComment(buffer, '  ', column.comment);

  if (isRenamed) {
    buffer.push(`  [${COLUMN_ATTRIBUTE}(${toStringLiteral(column.name)})]`);
  }
  if (isNullable) {
    buffer.push(`  public ${type}? ${propertyName} { get; set; }`);
  } else if (columnType.arrayDepth > 0 || referenceTypes.has(type)) {
    buffer.push(`  public ${type} ${propertyName} { get; set; } = null!;`);
  } else {
    buffer.push(`  public ${type} ${propertyName} { get; set; }`);
  }
}

/**
 * A name with an @ before it where C# reads it as a keyword, the white space
 * and line breaks around it kept as they are.
 */
function toIdentifier(name: string): string {
  const word = name.replace(SURROUNDING_SPACE, '');
  return CSHARP_KEYWORDS.has(word) ? name.replace(word, `@${word}`) : name;
}

/**
 * A C# string literal: JSON's escapes are C#'s too, but JSON leaves as they
 * are three characters C# ends a line at, U+0085, U+2028 and U+2029.
 */
function toStringLiteral(value: string): string {
  return JSON.stringify(value).replace(
    NEWLINE,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

function formatComment(buffer: string[], indent: string, comment: string) {
  const lines = comment.split(NEWLINE).map(line => line.trimEnd());

  while (lines[0] === '') {
    lines.shift();
  }
  while (lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.forEach(line =>
    buffer.push(line === '' ? `${indent}//` : `${indent}// ${line}`)
  );
}

/**
 * The shared vendor tables put types C# tells apart under one category, so the
 * names C# needs are decided first, then the widths the shared classifier reads
 * and the table's category; a PostgreSQL array's element goes through the same.
 */
function getElementType(
  { element, base, scalar, isUnsigned }: ColumnType,
  database: number
): string {
  const unsignedType =
    isUnsigned || readsUnsigned(base, database)
      ? unsignedTypes[scalar]
      : undefined;

  if (BINARY_TYPES.has(base)) {
    return 'byte[]';
  }
  if (UUID_TYPES.has(base)) {
    return 'Guid';
  }
  // Npgsql reads a time of day with an offset as a DateTimeOffset alone.
  if (TIMESTAMP_TZ_TYPES.has(base) || scalar === 'timeTz') {
    return 'DateTimeOffset';
  }
  if (MONEY_TYPES.has(base)) {
    return 'decimal';
  }
  if (unsignedType) {
    return unsignedType;
  }
  // Every Oracle, Snowflake and SQLite integer holds 64 bits whatever width its
  // name declares, smallint too, so the width comes before the name.
  if (scalar === 'i64') {
    return 'long';
  }
  if (base === 'smallint') {
    return 'short';
  }
  // A 64-bit float is a double whatever category the vendor table files it
  // under: MariaDB's Oracle mode stores a NUMBER of no precision as a DOUBLE.
  if (scalar === 'f64') {
    return 'double';
  }

  return (
    vendorTypes.get(database)?.get(base) ??
    convertTypeMap[getPrimitiveType(element, database)]
  );
}

/**
 * Types a driver reads as unsigned whatever their name says. A BIT(1) is a flag
 * the classifier reads as bool, which has no unsigned type, so it keeps the
 * vendor table's int.
 */
function readsUnsigned(base: string, database: number): boolean {
  return isMySQLFamily(database)
    ? base === 'bit'
    : database === Database.PostgreSQL && POSTGRES_OBJECT_ID_TYPES.has(base);
}

/**
 * A PostgreSQL array as Npgsql reads it: one rank a dimension, several in one
 * rectangular array, never a jagged one, and before an element's own brackets,
 * so a two-dimension bytea array is byte[,][].
 */
function arrayType(elementType: string, depth: number): string {
  if (depth === 0) {
    return elementType;
  }

  const rank = `[${','.repeat(depth - 1)}]`;
  return elementType.endsWith('[]')
    ? `${elementType.slice(0, -2)}${rank}[]`
    : `${elementType}${rank}`;
}
