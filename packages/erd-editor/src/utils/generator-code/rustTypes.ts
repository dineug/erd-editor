import { Database } from '@/constants/schema';
import { PrimitiveType } from '@/constants/sql/dataType';

import {
  ColumnScalar,
  columnScalar,
  getColumnType,
  isMySQLFamily,
  MONEY_TYPES,
  POSTGRES_OBJECT_ID_TYPES,
} from './columnTypes';
import { baseTypeName, findDataTypeHint } from './utils';

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

// sqlx has no chrono type for a time with its offset, nor any for an interval.
const RUST_SCALARS: Readonly<Record<ColumnScalar, RustScalar>> = {
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
  decimal: 'decimal',
  string: 'string',
  bytes: 'bytes',
  uuid: 'uuid',
  json: 'json',
  date: 'date',
  time: 'time',
  timeTz: 'string',
  dateTime: 'dateTime',
  dateTimeUtc: 'dateTimeUtc',
  dateTimeOffset: 'dateTimeOffset',
  interval: 'string',
};

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

/**
 * Where rust.ts reads a vendor list entry by another category than the list,
 * so its output, which sqlx 0.9 was measured on, holds for the names its rules
 * by name leave to the category.
 */
const rustPrimitiveTypes = new Map<number, ReadonlyMap<string, PrimitiveType>>([
  [
    Database.MSSQL,
    new Map<string, PrimitiveType>([
      ['binary', 'lob'],
      ['bit', 'int'],
      ['money', 'double'],
      ['numeric', 'float'],
      ['smallmoney', 'float'],
    ]),
  ],
  [
    Database.Oracle,
    new Map<string, PrimitiveType>([
      ['date', 'date'],
      ['raw', 'lob'],
      ['real', 'float'],
    ]),
  ],
  [
    Database.PostgreSQL,
    new Map<string, PrimitiveType>([
      ['bit', 'int'],
      ['bit varying', 'int'],
      ['money', 'double'],
      ['pg_lsn', 'int'],
      ['varbit', 'int'],
    ]),
  ],
  // sqlx 0.9 read a SQLite TIMESTAMP column into a String.
  [
    Database.SQLite,
    new Map<string, PrimitiveType>([
      ['bool', 'string'],
      ['time', 'string'],
      ['timestamp', 'string'],
    ]),
  ],
]);

const UNSIGNED = /(^|[^0-9a-z_])unsigned([^0-9a-z_]|$)/;
const ZEROFILL = /(^|[^0-9a-z_])zerofill([^0-9a-z_]|$)/;
const WHITESPACE = /\s+/g;

/**
 * The shared column classifier with the choices sqlx makes for Rust on top: an
 * Oracle, Snowflake or SQLite integer keeps the width its name declares, and a
 * MySQL SIGNED stays in the name, which keeps it from every rule by name.
 */
export function getRustColumnType(
  dataType: string,
  database: number
): RustColumnType {
  const column = getColumnType(dataType, database);
  const { element, args, arrayDepth, isUnsigned } = column;
  const base = isMySQLFamily(database)
    ? baseTypeName(element)
        .replace(UNSIGNED, '$1$2')
        .replace(ZEROFILL, '$1$2')
        .replace(WHITESPACE, ' ')
        .trim()
    : column.base;
  // columnScalar, not the column's own scalar: Rust keeps the declared width,
  // an i32 for Oracle's and SQLite's INTEGER, which hold 64 bits.
  const scalar = rustScalar(
    columnScalar(element, base, args, database, isUnsigned, rustPrimitiveType),
    base,
    database,
    column.isSemiStructured
  );
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

function rustScalar(
  scalar: ColumnScalar,
  base: string,
  database: number,
  isSemiStructured: boolean
): RustScalar {
  // sqlx sends MariaDB's UUID as its 36 characters, and rust.ts reads the
  // PostgreSQL system identifiers and the Snowflake and Databricks
  // semi-structured values as text.
  if (
    (database === Database.MariaDB && base === 'uuid') ||
    (database === Database.PostgreSQL && POSTGRES_OBJECT_ID_TYPES.has(base)) ||
    isSemiStructured
  ) {
    return 'string';
  }
  return RUST_SCALARS[scalar];
}

function rustPrimitiveType(dataType: string, database: number): PrimitiveType {
  const hint = findDataTypeHint(dataType, database);

  if (!hint) {
    return 'string';
  }
  return (
    rustPrimitiveTypes.get(database)?.get(hint.name.toLowerCase()) ??
    hint.primitiveType
  );
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

  if (MONEY_TYPES.has(base)) {
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
