import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, Database } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

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

const ARGUMENTS = /\([^)]*\)/g;
const WHITESPACE = /\s+/g;
const TYPE_ARGUMENTS = /\(\s*([^)]*)\)/;
const DIGITS = /^[0-9]+$/;
// The characters C# ends a single-line comment at, so each starts a new one.
const NEWLINE = /\r\n|\r|\n|\u0085|\u2028|\u2029/g;

const binaryTypes = new Set([
  'bfile',
  'binary',
  'binary varying',
  'blob',
  'bytea',
  'char byte',
  'image',
  'long raw',
  'long varbinary',
  'longblob',
  'mediumblob',
  'raw',
  'tinyblob',
  'varbinary',
]);

const uuidTypes = new Set(['uniqueidentifier', 'uuid']);

const timestampTzTypes = new Set([
  'datetimeoffset',
  'timestamp with time zone',
  'timestamp_tz',
  'timestamptz',
]);

// SQL Server alone: elsewhere timestamp is a date and time, tinyint is signed
// and bit is a bit field, so there these names keep the shared table's type.
const mssqlTypes = new Map([
  ['bit', 'bool'],
  ['money', 'decimal'],
  ['numeric', 'decimal'],
  ['rowversion', 'byte[]'],
  ['smallmoney', 'decimal'],
  ['sql_variant', 'object'],
  ['timestamp', 'byte[]'],
  ['tinyint', 'byte'],
]);

const MSSQL_SINGLE_PRECISION_MAX = 24;

const referenceTypes = new Set(['byte[]', 'object', 'string']);

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
  const tableName = getNameCase(table.name, tableNameCase);

  formatComment(buffer, '', table.comment);
  buffer.push(`public class ${tableName} {`);

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
  const columnName = getNameCase(column.name, columnNameCase);
  const propertyName =
    columnName.charAt(0).toLocaleUpperCase() + columnName.slice(1);
  const type = getColumnType(column.dataType, database);
  // A primary key takes no NULL, its flag set or not, as typeorm.ts reads it.
  const isNullable =
    !bHas(column.options, ColumnOption.primaryKey) &&
    !bHas(column.options, ColumnOption.notNull);

  formatComment(buffer, '  ', column.comment);

  if (isNullable) {
    buffer.push(`  public ${type}? ${propertyName} { get; set; }`);
  } else if (referenceTypes.has(type)) {
    buffer.push(`  public ${type} ${propertyName} { get; set; } = null!;`);
  } else {
    buffer.push(`  public ${type} ${propertyName} { get; set; }`);
  }
}

function formatComment(buffer: string[], indent: string, comment: string) {
  const lines = comment.split(NEWLINE).map(line => line.trimEnd());

  while (lines.length && lines[0] === '') {
    lines.shift();
  }
  while (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.forEach(line =>
    buffer.push(line === '' ? `${indent}//` : `${indent}// ${line}`)
  );
}

/**
 * The shared vendor tables put types C# tells apart under one category, and a
 * few SQL Server ones under the wrong one (numeric as float, bit as int); other
 * generators read them too, so the names C# needs are decided here first.
 */
function getColumnType(dataType: string, database: number): string {
  const base = dataType
    .toLocaleLowerCase()
    .replace(ARGUMENTS, ' ')
    .replace(WHITESPACE, ' ')
    .trim();

  if (binaryTypes.has(base)) {
    return 'byte[]';
  }
  if (uuidTypes.has(base)) {
    return 'Guid';
  }
  if (timestampTzTypes.has(base)) {
    return 'DateTimeOffset';
  }
  if (base === 'smallint') {
    return 'short';
  }

  if (database === Database.MSSQL) {
    const mssqlType = mssqlTypes.get(base);

    if (mssqlType) {
      return mssqlType;
    }
    if (base === 'float' && isSinglePrecisionFloat(dataType)) {
      return 'float';
    }
  }

  return convertTypeMap[getPrimitiveType(dataType, database)];
}

// SQL Server stores float(1) to float(24) in 4 bytes, and float(25) to
// float(53), the default, in 8.
function isSinglePrecisionFloat(dataType: string): boolean {
  const value = TYPE_ARGUMENTS.exec(dataType)?.[1].trim() ?? '';

  if (!DIGITS.test(value)) {
    return false;
  }

  const precision = Number(value);
  return precision >= 1 && precision <= MSSQL_SINGLE_PRECISION_MAX;
}
