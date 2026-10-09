import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, Database } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  FormatColumnOptions,
  FormatTableOptions,
  getNameCase,
  getPrimitiveType,
} from './utils';

/**
 * PHP takes declare(strict_types=1) only as the first statement, so the text
 * opens on the tag with nothing before it, not even the blank line the other
 * languages open with.
 */
export const PHP_HEADER: readonly string[] = [
  '<?php',
  '',
  'declare(strict_types=1);',
];

export const INDENT = '    ';

const convertTypeMap: PrimitiveTypeMap = {
  int: 'int',
  long: 'int',
  float: 'float',
  double: 'float',
  decimal: 'string',
  boolean: 'bool',
  string: 'string',
  lob: 'string',
  date: '\\DateTimeImmutable',
  dateTime: '\\DateTimeImmutable',
  time: 'string',
};

// A money amount keeps its digits in a string as a decimal does, and a pg_lsn
// is two hex numbers and a slash, though the shared tables file them as numbers.
const stringTypes = new Set(['money', 'pg_lsn', 'smallmoney']);

// SQL Server alone: bit is a flag there, and the shared tables file numeric
// under float.
const mssqlTypes = new Map([
  ['bit', 'bool'],
  ['numeric', 'string'],
]);

/** PostgreSQL's bit strings, which pdo_pgsql reads as text such as 1010. */
export const POSTGRES_BIT_TYPES: ReadonlySet<string> = new Set([
  'bit',
  'bit varying',
  'varbit',
]);

/**
 * Every name PHP 8.1 to 8.4 refuses for a class in any letter case, and the
 * lone underscore 8.4 deprecates.
 */
const RESERVED_CLASS_NAMES = new Set([
  '_',
  '__class__',
  '__dir__',
  '__file__',
  '__function__',
  '__halt_compiler',
  '__line__',
  '__method__',
  '__namespace__',
  '__property__',
  '__trait__',
  'abstract',
  'and',
  'array',
  'as',
  'bool',
  'break',
  'callable',
  'case',
  'catch',
  'class',
  'clone',
  'const',
  'continue',
  'declare',
  'default',
  'die',
  'do',
  'echo',
  'else',
  'elseif',
  'empty',
  'enddeclare',
  'endfor',
  'endforeach',
  'endif',
  'endswitch',
  'endwhile',
  'eval',
  'exit',
  'extends',
  'false',
  'final',
  'finally',
  'float',
  'fn',
  'for',
  'foreach',
  'function',
  'global',
  'goto',
  'if',
  'implements',
  'include',
  'include_once',
  'instanceof',
  'insteadof',
  'int',
  'interface',
  'isset',
  'iterable',
  'list',
  'match',
  'mixed',
  'namespace',
  'never',
  'new',
  'null',
  'object',
  'or',
  'parent',
  'print',
  'private',
  'protected',
  'public',
  'readonly',
  'require',
  'require_once',
  'return',
  'self',
  'static',
  'string',
  'switch',
  'throw',
  'trait',
  'true',
  'try',
  'unset',
  'use',
  'var',
  'void',
  'while',
  'xor',
  'yield',
]);

const ARGUMENTS = /\([^)]*\)/g;
const WHITESPACE = /\s+/g;
const LINE_BREAK = /\r\n|\r|\n/;
const COMMENT_END = /\*\//g;
const POSTGRES_ARRAY = /(\[\s*\d*\s*\]|\barray)\s*$/i;
const NUMBER_ARGUMENTS = /^\s*number\s*\(\s*(\*|\d+)\s*,\s*(\d+)\s*\)\s*$/i;

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

  const buffer = [...PHP_HEADER];

  tables.forEach(table => {
    buffer.push('');
    formatTable(state, { buffer, table });
  });
  buffer.push('');

  return buffer.join('\n');
}

/** One table's class under the header, which a file of its own needs. */
export function createTableCode(state: RootState, table: Table): string {
  const buffer = [...PHP_HEADER, ''];

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
  const className = toClassName(getNameCase(table.name, tableNameCase));
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  formatDocComment(buffer, '', table.comment);

  if (columns.length === 0) {
    buffer.push(`class ${className} {}`);
    return;
  }

  buffer.push(`class ${className}`);
  buffer.push('{');
  columns.forEach(column => {
    formatColumn(state, { buffer, column });
  });
  buffer.push('}');
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions
) {
  const name = getNameCase(column.name, columnNameCase);
  const type = getColumnType(column.dataType, database);
  // A primary key takes no NULL, its flag set or not, as typeorm.ts reads it.
  const isNullable =
    !bHas(column.options, ColumnOption.primaryKey) &&
    !bHas(column.options, ColumnOption.notNull);

  formatDocComment(buffer, INDENT, column.comment);
  buffer.push(
    isNullable
      ? `${INDENT}public ?${type} $${name} = null;`
      : `${INDENT}public ${type} $${name};`
  );
}

function getColumnType(dataType: string, database: number): string {
  const base = baseTypeName(dataType);

  if (
    stringTypes.has(base) ||
    isPostgresArray(dataType, database) ||
    (database === Database.PostgreSQL && POSTGRES_BIT_TYPES.has(base)) ||
    fractionalNumber(dataType, database) !== null
  ) {
    return 'string';
  }
  if (database === Database.MSSQL) {
    const mssqlType = mssqlTypes.get(base);

    if (mssqlType) {
      return mssqlType;
    }
  }

  return convertTypeMap[getPrimitiveType(dataType, database)];
}

/** A PostgreSQL array type, which pdo_pgsql reads as a text literal such as {1,2}. */
export function isPostgresArray(dataType: string, database: number): boolean {
  return database === Database.PostgreSQL && POSTGRES_ARRAY.test(dataType);
}

/**
 * The precision and scale of an Oracle or Snowflake NUMBER with a scale, which
 * the shared tables file under long with every other NUMBER; a star is 38.
 */
export function fractionalNumber(
  dataType: string,
  database: number
): [precision: number, scale: number] | null {
  if (database !== Database.Oracle && database !== Database.Snowflake) {
    return null;
  }

  const matched = NUMBER_ARGUMENTS.exec(dataType);

  if (!matched) {
    return null;
  }

  const [, precision, scale] = matched;

  if (Number(scale) === 0) {
    return null;
  }
  return [precision === '*' ? 38 : Number(precision), Number(scale)];
}

/** The type name in lower case, with its argument lists and extra spaces gone. */
export function baseTypeName(dataType: string): string {
  return dataType
    .toLowerCase()
    .replace(ARGUMENTS, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}

/**
 * A name PHP refuses for a class, in any letter case, gets an underscore
 * after it, as nikic/PHP-Parser names its List_ and Match_ nodes.
 */
export function toClassName(name: string): string {
  return RESERVED_CLASS_NAMES.has(name.toLowerCase()) ? `${name}_` : name;
}

/**
 * A comment as a doc block, one line or several: a line comment would end at
 * a ?> in the text and leave PHP, where a block runs on to its close, which a
 * star and a slash in the text would write early.
 */
export function formatDocComment(
  buffer: string[],
  indent: string,
  comment: string
) {
  const lines = comment
    .replace(COMMENT_END, '*\\/')
    .split(LINE_BREAK)
    .map(line => line.trimEnd());

  while (lines[0] === '') {
    lines.shift();
  }
  while (lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (lines.length === 0) {
    return;
  }
  if (lines.length === 1) {
    buffer.push(`${indent}/** ${lines[0].trim()} */`);
    return;
  }

  buffer.push(`${indent}/**`);
  lines.forEach(line =>
    buffer.push(line === '' ? `${indent} *` : `${indent} * ${line}`)
  );
  buffer.push(`${indent} */`);
}
