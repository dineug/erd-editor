import { Database } from '@/constants/schema';
import { PrimitiveType } from '@/constants/sql/dataType';

import { baseTypeName, fractionalNumber, POSTGRES_BIT_TYPES } from './php';
import { getPrimitiveType } from './utils';

/** The Rust value a column's element holds, which each generator spells its own way. */
export type RustScalar =
  | 'bool'
  | 'i8'
  | 'i16'
  | 'i32'
  | 'i64'
  | 'u8'
  | 'u16'
  | 'u32'
  | 'u64'
  | 'f32'
  | 'f64'
  | 'decimal'
  | 'string'
  | 'bytes'
  | 'uuid'
  | 'json'
  | 'date'
  | 'time'
  | 'dateTime'
  | 'dateTimeUtc'
  | 'dateTimeOffset';

/**
 * Each scalar by its full path, so a struct compiles with no use statement
 * and beside a struct of any of these last names.
 */
export const RUST_SCALAR_PATHS: Readonly<Record<RustScalar, string>> = {
  bool: 'bool',
  i8: 'i8',
  i16: 'i16',
  i32: 'i32',
  i64: 'i64',
  u8: 'u8',
  u16: 'u16',
  u32: 'u32',
  u64: 'u64',
  f32: 'f32',
  f64: 'f64',
  decimal: 'rust_decimal::Decimal',
  string: 'String',
  bytes: 'Vec<u8>',
  uuid: 'uuid::Uuid',
  json: 'serde_json::Value',
  date: 'chrono::NaiveDate',
  time: 'chrono::NaiveTime',
  dateTime: 'chrono::NaiveDateTime',
  dateTimeUtc: 'chrono::DateTime<chrono::Utc>',
  dateTimeOffset: 'chrono::DateTime<chrono::FixedOffset>',
};

export type RustColumnType = {
  scalar: RustScalar;
  /** The field type with one Vec a PostgreSQL array dimension, by full paths. */
  rust: string;
  /**
   * The element's type name, lower case, its arguments gone, and on MySQL and
   * MariaDB its UNSIGNED and ZEROFILL too.
   */
  base: string;
  /** The element's arguments when all are numbers: numeric(10,2) gives [10, 2]. */
  args: number[];
  arrayDepth: number;
  /** MySQL and MariaDB: UNSIGNED, ZEROFILL or SERIAL in the type. */
  isUnsigned: boolean;
  isFloat: boolean;
  /**
   * PostgreSQL alone: the type sqlx reads the column through, cast, where it
   * reads the column's own type into no Rust type here; null elsewhere.
   */
  selectAs: string | null;
  /**
   * The element as an entity declares it: a PostgreSQL array of more than one
   * dimension, which neither sqlx nor SeaORM decodes, is a string read as text.
   */
  entityScalar: RustScalar;
};

const convertTypeMap: Record<PrimitiveType, RustScalar> = {
  int: 'i32',
  long: 'i64',
  float: 'f32',
  double: 'f64',
  decimal: 'decimal',
  boolean: 'bool',
  string: 'string',
  lob: 'string',
  date: 'date',
  dateTime: 'dateTime',
  time: 'time',
};

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

const jsonTypes = new Set(['json', 'jsonb']);

const timestampTzTypes = new Set([
  'datetimeoffset',
  'timestamp with time zone',
  'timestamp_tz',
  'timestamptz',
]);

// An instant the database shows in the session's zone, as MySQL's TIMESTAMP.
const timestampLtzTypes = new Set([
  'timestamp with local time zone',
  'timestamp_ltz',
  'timestampltz',
]);

const moneyTypes = new Set(['money', 'smallmoney']);

const smallintTypes = new Set([
  'int2',
  'serial2',
  'short',
  'smallint',
  'smallserial',
]);

const tinyintTypes = new Set(['byte', 'int1', 'tinyint']);

const unsignedTypes = new Map<string, RustScalar>([
  ['bigint', 'u64'],
  ['int', 'u32'],
  ['int1', 'u8'],
  ['int2', 'u16'],
  ['int3', 'u32'],
  ['int4', 'u32'],
  ['int8', 'u64'],
  ['integer', 'u32'],
  ['mediumint', 'u32'],
  ['middleint', 'u32'],
  ['smallint', 'u16'],
  ['tinyint', 'u8'],
]);

const yearTypes = new Set(['sql_tsi_year', 'year']);

// SQL Server alone: timestamp and rowversion are eight bytes there.
const mssqlTypes = new Map<string, RustScalar>([
  ['bit', 'bool'],
  ['numeric', 'decimal'],
  ['rowversion', 'bytes'],
  ['timestamp', 'bytes'],
  ['tinyint', 'u8'],
]);

/** PostgreSQL's character types, which sqlx reads into a String as they are. */
export const POSTGRES_CHARACTER_TYPES: ReadonlySet<string> = new Set([
  'bpchar',
  'char',
  'character',
  'character varying',
  'citext',
  'name',
  'text',
  'varchar',
]);

const postgresTimeTzTypes = new Set(['time with time zone', 'timetz']);

const postgresObjectIdTypes = new Set(['cid', 'oid', 'xid', 'xid8']);

const INTERVAL = /^interval\b/;
const UNSIGNED = /(^|[^0-9a-z_])unsigned([^0-9a-z_]|$)/;
const ZEROFILL = /(^|[^0-9a-z_])zerofill([^0-9a-z_]|$)/;
const WHITESPACE = /\s+/g;
const TYPE_ARGUMENTS = /\(\s*([^)]*)\)/;
const DIGITS = /^[0-9]+$/;
// PostgreSQL takes integer ARRAY and integer ARRAY[4] as one dimension.
const ARRAY_KEYWORD = /\s+array\s*(?:\[\s*\d*\s*\])?\s*$/i;
const ARRAY_BOUND = /\[\s*\d*\s*\]\s*$/;

export function getRustColumnType(
  dataType: string,
  database: number
): RustColumnType {
  const [element, arrayDepth] = splitPostgresArray(dataType, database);
  const typeName = baseTypeName(element);
  const isMySQL = isMySQLFamily(database);
  const isUnsigned =
    isMySQL &&
    (UNSIGNED.test(typeName) ||
      ZEROFILL.test(typeName) ||
      typeName === 'serial');
  const base = isMySQL
    ? typeName
        .replace(UNSIGNED, '$1$2')
        .replace(ZEROFILL, '$1$2')
        .replace(WHITESPACE, ' ')
        .trim()
    : typeName;
  const args = typeArguments(element);
  const scalar = getScalar(element, base, args, database, isUnsigned);
  const isNested = arrayDepth > 1;

  return {
    scalar,
    rust: wrapVec(RUST_SCALAR_PATHS[scalar], arrayDepth),
    base,
    args,
    arrayDepth,
    isUnsigned,
    isFloat: scalar === 'f32' || scalar === 'f64',
    selectAs: isNested
      ? 'text'
      : postgresSelectAs(database, base, scalar, arrayDepth),
    entityScalar: isNested ? 'string' : scalar,
  };
}

/** A type inside one Vec per dimension. */
export function wrapVec(type: string, depth: number): string {
  let wrapped = type;

  for (let i = 0; i < depth; i++) {
    wrapped = `Vec<${wrapped}>`;
  }
  return wrapped;
}

function getScalar(
  element: string,
  base: string,
  args: number[],
  database: number,
  isUnsigned: boolean
): RustScalar {
  if (isMySQLFamily(database)) {
    const unsigned = isUnsigned ? unsignedTypes.get(base) : undefined;

    if (unsigned) {
      return unsigned;
    }
    if (base === 'serial') {
      return 'u64';
    }
    // BIT and BIT(1) hold one bit, which sqlx reads as a bool.
    if (base === 'bit') {
      return args.length === 1 && args[0] > 1 ? 'u64' : 'bool';
    }
    if (yearTypes.has(base)) {
      return 'u16';
    }
    if (base === 'timestamp') {
      return 'dateTimeUtc';
    }
    if (base === 'float' && args.length === 1 && args[0] > 24) {
      return 'f64';
    }
  }
  if (database === Database.MariaDB) {
    // MariaDB sends a UUID as its 36 characters, and in its Oracle mode
    // stores a NUMBER of no precision as a DOUBLE.
    if (base === 'uuid') {
      return 'string';
    }
    if (base === 'number' && args.length === 0) {
      return 'f64';
    }
  }
  if (database === Database.PostgreSQL) {
    if (
      POSTGRES_BIT_TYPES.has(base) ||
      postgresTimeTzTypes.has(base) ||
      postgresObjectIdTypes.has(base)
    ) {
      return 'string';
    }
    if (base === 'float' && args.length === 1 && args[0] <= 24) {
      return 'f32';
    }
  }
  if (database === Database.MSSQL) {
    const mssqlType = mssqlTypes.get(base);

    if (mssqlType) {
      return mssqlType;
    }
    if (base === 'float' && args.length === 1 && args[0] <= 24) {
      return 'f32';
    }
  }
  // Oracle's DATE holds a time of day, and its REAL is a FLOAT(63) NUMBER.
  if (database === Database.Oracle) {
    if (base === 'date') {
      return 'dateTime';
    }
    if (base === 'real') {
      return 'f64';
    }
  }
  if (database === Database.Databricks && base === 'timestamp') {
    return 'dateTimeUtc';
  }
  if (fractionalNumber(element, database)) {
    return 'decimal';
  }

  if (binaryTypes.has(base)) {
    return 'bytes';
  }
  if (uuidTypes.has(base)) {
    return 'uuid';
  }
  if (jsonTypes.has(base)) {
    return 'json';
  }
  if (timestampTzTypes.has(base)) {
    return 'dateTimeOffset';
  }
  if (timestampLtzTypes.has(base)) {
    return 'dateTimeUtc';
  }
  if (moneyTypes.has(base)) {
    return 'decimal';
  }
  if (INTERVAL.test(base) || base === 'pg_lsn') {
    return 'string';
  }
  // Oracle and Snowflake store SMALLINT and TINYINT as a NUMBER(38).
  if (database !== Database.Oracle && database !== Database.Snowflake) {
    if (smallintTypes.has(base)) {
      return 'i16';
    }
    if (tinyintTypes.has(base)) {
      return 'i8';
    }
  }

  return convertTypeMap[getPrimitiveType(element, database)];
}

function postgresSelectAs(
  database: number,
  base: string,
  scalar: RustScalar,
  arrayDepth: number
): string | null {
  if (database !== Database.PostgreSQL) {
    return null;
  }

  const brackets = '[]'.repeat(arrayDepth);

  if (moneyTypes.has(base)) {
    return `numeric${brackets}`;
  }
  // A column of no type names nothing to cast to.
  if (
    scalar === 'string' &&
    base !== '' &&
    !POSTGRES_CHARACTER_TYPES.has(base)
  ) {
    return `text${brackets}`;
  }
  return null;
}

function splitPostgresArray(
  dataType: string,
  database: number
): [element: string, depth: number] {
  if (database !== Database.PostgreSQL) {
    return [dataType, 0];
  }
  if (ARRAY_KEYWORD.test(dataType)) {
    return [dataType.replace(ARRAY_KEYWORD, ''), 1];
  }

  let element = dataType;
  let depth = 0;

  while (ARRAY_BOUND.test(element)) {
    element = element.replace(ARRAY_BOUND, '');
    depth++;
  }
  return [element, depth];
}

function typeArguments(dataType: string): number[] {
  const matched = TYPE_ARGUMENTS.exec(dataType);

  if (!matched) {
    return [];
  }

  const values = matched[1].split(',').map(value => value.trim());
  return values.every(value => DIGITS.test(value)) ? values.map(Number) : [];
}

function isMySQLFamily(database: number): boolean {
  return database === Database.MySQL || database === Database.MariaDB;
}
