import { Database } from '@/constants/schema';
import { PrimitiveType } from '@/constants/sql/dataType';

import {
  baseTypeName,
  findDataTypeHint,
  fractionalNumber,
  getPrimitiveType,
} from './utils';

/**
 * The value a column's element holds, apart from any driver or library that
 * reads it: integers by width and sign, floats by width, each date and time.
 */
export type ColumnScalar =
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
  | 'timeTz'
  | 'dateTime'
  | 'dateTimeUtc'
  | 'dateTimeOffset'
  | 'interval';

/** The fields an interval holds: years and months, days to seconds, or both. */
export type IntervalFields = 'yearMonth' | 'dayTime' | 'mixed';

/** A network address type, by what it holds. */
export type NetworkType =
  | 'ipv4'
  | 'ipv6'
  | 'inet'
  | 'cidr'
  | 'macaddr'
  | 'macaddr8';

export type ColumnType = {
  scalar: ColumnScalar;
  /** The element's data type as written, a PostgreSQL array's suffix gone. */
  element: string;
  /**
   * The element's type name, lower case, its arguments gone, and on MySQL and
   * MariaDB its UNSIGNED, ZEROFILL and SIGNED too.
   */
  base: string;
  /** The element's arguments when all are numbers: numeric(10,2) gives [10, 2]. */
  args: number[];
  arrayDepth: number;
  /** An integer's width, 24 for MySQL's MEDIUMINT; null for any other scalar. */
  bits: 8 | 16 | 24 | 32 | 64 | null;
  /** Whether the database's vendor list names the element's type. */
  isListed: boolean;
  /** MySQL and MariaDB: UNSIGNED, ZEROFILL or SERIAL in the type. */
  isUnsigned: boolean;
  /** A type that numbers its rows itself: PostgreSQL's serials, MySQL's SERIAL. */
  isSerial: boolean;
  isFloat: boolean;
  /** money or smallmoney, which PostgreSQL prints in the session's currency. */
  isMoney: boolean;
  /** SQL Server's uniqueidentifier, which holds any 16 bytes, not only an RFC UUID. */
  isGuid: boolean;
  /** SQL Server's timestamp and rowversion, eight bytes it writes on every change. */
  isRowVersion: boolean;
  /** A Snowflake or Databricks VARIANT, OBJECT, ARRAY, MAP or STRUCT. */
  isSemiStructured: boolean;
  /** A PostgreSQL bit string, which drivers read as text such as 1010. */
  isBitString: boolean;
  /** PostgreSQL's xid, cid and xid8, integers node-postgres hands over as text. */
  isTextInteger: boolean;
  /** Databricks' VOID, which holds nothing but NULL. */
  isNullOnly: boolean;
  /** A character type's declared length, BYTE or CHAR units alike; else null. */
  length: number | null;
  /** A decimal or NUMBER's declared precision, a star being 38; else null. */
  precision: number | null;
  /** A decimal or NUMBER's declared scale; null where none is written. */
  scale: number | null;
  interval: IntervalFields | null;
  network: NetworkType | null;
  /** An ENUM's members, each read as MySQL reads a string literal. */
  enumMembers: string[] | null;
  /** A SET's members, each read as MySQL reads a string literal. */
  setMembers: string[] | null;
};

/** The binary types, which every database hands over as bytes. */
export const BINARY_TYPES: ReadonlySet<string> = new Set([
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

export const UUID_TYPES: ReadonlySet<string> = new Set([
  'uniqueidentifier',
  'uuid',
]);

export const JSON_TYPES: ReadonlySet<string> = new Set(['json', 'jsonb']);

/** The timestamps that keep their offset, or an instant read with one. */
export const TIMESTAMP_TZ_TYPES: ReadonlySet<string> = new Set([
  'datetimeoffset',
  'timestamp with time zone',
  'timestamp_tz',
  'timestamptz',
]);

/** An instant the database shows in the session's zone, as MySQL's TIMESTAMP. */
export const TIMESTAMP_LTZ_TYPES: ReadonlySet<string> = new Set([
  'timestamp with local time zone',
  'timestamp_ltz',
  'timestampltz',
]);

export const MONEY_TYPES: ReadonlySet<string> = new Set([
  'money',
  'smallmoney',
]);

/** PostgreSQL's bit strings, which its drivers read as text such as 1010. */
export const POSTGRES_BIT_TYPES: ReadonlySet<string> = new Set([
  'bit',
  'bit varying',
  'varbit',
]);

export const POSTGRES_TIME_TZ_TYPES: ReadonlySet<string> = new Set([
  'time with time zone',
  'timetz',
]);

/** PostgreSQL's system identifiers: xid8 is 64 bits, the others 32. */
export const POSTGRES_OBJECT_ID_TYPES: ReadonlySet<string> = new Set([
  'cid',
  'oid',
  'xid',
  'xid8',
]);

// node-postgres parses an oid into a number and these three into no number.
const POSTGRES_TEXT_INTEGER_TYPES = new Set(['cid', 'xid', 'xid8']);

export const POSTGRES_SERIAL_TYPES: ReadonlySet<string> = new Set([
  'bigserial',
  'serial',
  'serial2',
  'serial4',
  'serial8',
  'smallserial',
]);

/** The character types a length argument bounds, in characters or bytes. */
export const CHARACTER_TYPES: ReadonlySet<string> = new Set([
  'bpchar',
  'char',
  'char varying',
  'character',
  'character varying',
  'national char',
  'national char varying',
  'national character',
  'national character varying',
  'national varchar',
  'national varcharacter',
  'native character',
  'nchar',
  'nchar varchar',
  'nchar varcharacter',
  'nchar varying',
  'nvarchar',
  'nvarchar2',
  'varchar',
  'varchar2',
  'varcharacter',
  'varying character',
]);

// Snowflake's STRING(n) and TEXT(n) are its VARCHAR(n) by other names.
const SNOWFLAKE_CHARACTER_TYPES = new Set(['string', 'text']);

const SCALARS: Readonly<Record<PrimitiveType, ColumnScalar>> = {
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

// Oracle stores an integer column as a NUMBER(38), Snowflake as a NUMBER(38,0)
// and SQLite in up to eight bytes, whatever width the type's name declares.
const WIDE_INTEGER_DATABASES = new Set<number>([
  Database.Oracle,
  Database.Snowflake,
  Database.SQLite,
]);

const INTEGER_BITS: Partial<Record<ColumnScalar, 8 | 16 | 32 | 64>> = {
  i8: 8,
  i16: 16,
  i32: 32,
  i64: 64,
  u8: 8,
  u16: 16,
  u32: 32,
  u64: 64,
};

const smallintTypes = new Set([
  'int2',
  'serial2',
  'short',
  'smallint',
  'smallserial',
]);

const tinyintTypes = new Set(['byte', 'int1', 'tinyint']);

const mediumintTypes = new Set(['int3', 'mediumint', 'middleint']);

const unsignedTypes = new Map<string, ColumnScalar>([
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
const mssqlTypes = new Map<string, ColumnScalar>([
  ['bit', 'bool'],
  ['numeric', 'decimal'],
  ['rowversion', 'bytes'],
  ['timestamp', 'bytes'],
  ['tinyint', 'u8'],
]);

const mariadbNetworkTypes = new Map<string, NetworkType>([
  ['inet4', 'ipv4'],
  ['inet6', 'ipv6'],
]);

const postgresNetworkTypes = new Map<string, NetworkType>([
  ['cidr', 'cidr'],
  ['inet', 'inet'],
  ['macaddr', 'macaddr'],
  ['macaddr8', 'macaddr8'],
]);

const INTERVAL = /^interval\b/;
const DAY_TIME_FIELD = /\b(day|hour|minute|second)\b/;
const SEMI_STRUCTURED = /^(array|map|object|struct|variant)(?![0-9a-z_])/;
const UNSIGNED = /(^|[^0-9a-z_])unsigned([^0-9a-z_]|$)/;
const ZEROFILL = /(^|[^0-9a-z_])zerofill([^0-9a-z_]|$)/;
const SIGNED = /(^|[^0-9a-z_])signed([^0-9a-z_]|$)/;
const WHITESPACE = /\s+/g;
const TYPE_ARGUMENTS = /\(\s*([^)]*)\)/;
const DIGITS = /^[0-9]+$/;
const CHARACTER_LENGTH = /^[^(]*\(\s*(\d+)(?:\s+(?:byte|char))?\s*\)/i;
const NUMERIC_ARGUMENTS = /^[^(]*\(\s*(\*|\d+)\s*(?:,\s*(-?\d+)\s*)?\)/;
const ENUM_HEAD = /^\s*enum\s*\(/i;
const SET_HEAD = /^\s*set\s*\(/i;
const MEMBER_SEPARATOR = /[\s,]/;
// PostgreSQL takes integer ARRAY and integer ARRAY[4] as one dimension.
const ARRAY_KEYWORD = /\s+array\s*(?:\[\s*\d*\s*\])?\s*$/i;
const ARRAY_BOUND = /\[\s*\d*\s*\]\s*$/;

const NUMERIC_TYPES = new Set(['dec', 'decimal', 'fixed', 'number', 'numeric']);

const mysqlEscapes = new Map([
  ['0', String.fromCharCode(0)],
  ['b', '\b'],
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
  ['Z', String.fromCharCode(0x1a)],
]);

/**
 * What a column's type holds on a database, read by type name before the
 * vendor lists, which only file each name under one of eleven categories.
 */
export function getColumnType(dataType: string, database: number): ColumnType {
  const [element, arrayDepth] = splitPostgresArray(dataType, database);
  const typeName = baseTypeName(element);
  const isMySQL = isMySQLFamily(database);
  const unsigned = isMySQL && isUnsignedTypeName(typeName);
  const base = isMySQL
    ? typeName
        .replace(UNSIGNED, '$1$2')
        .replace(ZEROFILL, '$1$2')
        .replace(SIGNED, '$1$2')
        .replace(WHITESPACE, ' ')
        .trim()
    : typeName;
  const args = typeArguments(element);
  const scalar = storedScalar(
    columnScalar(element, base, args, database, unsigned),
    database
  );
  const isCharacter =
    scalar === 'string' &&
    (CHARACTER_TYPES.has(base) ||
      (database === Database.Snowflake && SNOWFLAKE_CHARACTER_TYPES.has(base)));
  const [precision, scale] = NUMERIC_TYPES.has(base)
    ? numericArguments(element)
    : [null, null];

  return {
    scalar,
    element,
    base,
    args,
    arrayDepth,
    bits: integerBits(scalar, base, database),
    isListed: findDataTypeHint(element, database) !== undefined,
    isUnsigned: unsigned,
    isSerial:
      (database === Database.PostgreSQL && POSTGRES_SERIAL_TYPES.has(base)) ||
      (isMySQL && base === 'serial'),
    isFloat: scalar === 'f32' || scalar === 'f64',
    isMoney: MONEY_TYPES.has(base),
    isGuid: base === 'uniqueidentifier',
    isRowVersion:
      database === Database.MSSQL &&
      (base === 'rowversion' || base === 'timestamp'),
    isSemiStructured: isSemiStructured(base, database),
    isBitString:
      database === Database.PostgreSQL && POSTGRES_BIT_TYPES.has(base),
    isTextInteger:
      database === Database.PostgreSQL && POSTGRES_TEXT_INTEGER_TYPES.has(base),
    isNullOnly: database === Database.Databricks && base === 'void',
    length: isCharacter ? characterLength(element) : null,
    precision,
    scale,
    interval: scalar === 'interval' ? intervalFields(base) : null,
    network: networkType(base, database),
    enumMembers: ENUM_HEAD.test(element) ? listMembers(element) : null,
    setMembers: SET_HEAD.test(element) ? listMembers(element) : null,
  };
}

/** MySQL and MariaDB: whether UNSIGNED, ZEROFILL or SERIAL makes a type unsigned. */
export function isUnsigned(dataType: string, database: number): boolean {
  return isMySQLFamily(database) && isUnsignedTypeName(baseTypeName(dataType));
}

/**
 * An ENUM's or SET's members, each read as MySQL reads a string literal in
 * either quote; null where the list holds anything else or nothing.
 */
export function enumMembers(dataType: string): string[] | null {
  return ENUM_HEAD.test(dataType) || SET_HEAD.test(dataType)
    ? listMembers(dataType)
    : null;
}

/** A PostgreSQL array's element type and its number of dimensions. */
export function splitPostgresArray(
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

/** A type's first argument list when every argument is a number. */
export function typeArguments(dataType: string): number[] {
  const matched = TYPE_ARGUMENTS.exec(dataType);

  if (!matched) {
    return [];
  }

  const values = matched[1].split(',').map(value => value.trim());
  return values.every(value => DIGITS.test(value)) ? values.map(Number) : [];
}

export function isMySQLFamily(database: number): boolean {
  return database === Database.MySQL || database === Database.MariaDB;
}

/**
 * The scalar a type's base name gives on a database at the width the name
 * declares, by the rules by name and then by the category primitiveOf files
 * the type under; getColumnType widens what Oracle, Snowflake and SQLite store.
 */
export function columnScalar(
  element: string,
  base: string,
  args: number[],
  database: number,
  isUnsigned: boolean,
  primitiveOf: (
    dataType: string,
    database: number
  ) => PrimitiveType = getPrimitiveType
): ColumnScalar {
  if (isMySQLFamily(database)) {
    const unsigned = isUnsigned ? unsignedTypes.get(base) : undefined;

    if (unsigned) {
      return unsigned;
    }
    if (base === 'serial') {
      return 'u64';
    }
    // BIT and BIT(1) hold one bit, which drivers read as a flag.
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
  // MariaDB's Oracle mode stores a NUMBER of no precision as a DOUBLE.
  if (database === Database.MariaDB && base === 'number' && args.length === 0) {
    return 'f64';
  }
  if (database === Database.PostgreSQL) {
    if (POSTGRES_BIT_TYPES.has(base)) {
      return 'string';
    }
    if (POSTGRES_TIME_TZ_TYPES.has(base)) {
      return 'timeTz';
    }
    if (POSTGRES_OBJECT_ID_TYPES.has(base)) {
      return base === 'xid8' ? 'u64' : 'u32';
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
  if (isSemiStructured(base, database)) {
    return 'json';
  }
  if (fractionalNumber(element, database)) {
    return 'decimal';
  }

  if (BINARY_TYPES.has(base)) {
    return 'bytes';
  }
  if (UUID_TYPES.has(base)) {
    return 'uuid';
  }
  if (JSON_TYPES.has(base)) {
    return 'json';
  }
  if (TIMESTAMP_TZ_TYPES.has(base)) {
    return 'dateTimeOffset';
  }
  if (TIMESTAMP_LTZ_TYPES.has(base)) {
    return 'dateTimeUtc';
  }
  if (MONEY_TYPES.has(base)) {
    return 'decimal';
  }
  if (INTERVAL.test(base)) {
    return 'interval';
  }
  if (base === 'pg_lsn') {
    return 'string';
  }
  // Oracle's and Snowflake's SMALLINT and TINYINT name no narrower NUMBER, so
  // their vendor list category gives the declared width.
  if (database !== Database.Oracle && database !== Database.Snowflake) {
    if (smallintTypes.has(base)) {
      return 'i16';
    }
    if (tinyintTypes.has(base)) {
      return 'i8';
    }
  }

  return SCALARS[primitiveOf(element, database)];
}

function storedScalar(scalar: ColumnScalar, database: number): ColumnScalar {
  return WIDE_INTEGER_DATABASES.has(database) &&
    INTEGER_BITS[scalar] !== undefined
    ? 'i64'
    : scalar;
}

function isUnsignedTypeName(typeName: string): boolean {
  return (
    UNSIGNED.test(typeName) || ZEROFILL.test(typeName) || typeName === 'serial'
  );
}

function isSemiStructured(base: string, database: number): boolean {
  return (
    (database === Database.Snowflake || database === Database.Databricks) &&
    SEMI_STRUCTURED.test(base)
  );
}

function integerBits(
  scalar: ColumnScalar,
  base: string,
  database: number
): ColumnType['bits'] {
  const bits = INTEGER_BITS[scalar];

  if (bits === undefined) {
    return null;
  }
  return isMySQLFamily(database) && mediumintTypes.has(base) ? 24 : bits;
}

function characterLength(element: string): number | null {
  const matched = CHARACTER_LENGTH.exec(element);
  return matched ? Number(matched[1]) : null;
}

function numericArguments(
  element: string
): [precision: number | null, scale: number | null] {
  const matched = NUMERIC_ARGUMENTS.exec(element);

  if (!matched) {
    return [null, null];
  }

  const [, precision, scale] = matched;
  return [
    precision === '*' ? 38 : Number(precision),
    scale === undefined ? null : Number(scale),
  ];
}

function intervalFields(base: string): IntervalFields {
  const fields = base.slice('interval'.length).trim();

  if (fields === '') {
    return 'mixed';
  }
  return DAY_TIME_FIELD.test(fields) ? 'dayTime' : 'yearMonth';
}

function networkType(base: string, database: number): NetworkType | null {
  if (database === Database.MariaDB) {
    return mariadbNetworkTypes.get(base) ?? null;
  }
  if (database === Database.PostgreSQL) {
    return postgresNetworkTypes.get(base) ?? null;
  }
  return null;
}

function listMembers(dataType: string): string[] | null {
  const start = dataType.indexOf('(');
  const source = dataType.slice(start + 1, dataType.lastIndexOf(')'));
  const members: string[] = [];
  let index = 0;

  while (index < source.length) {
    if (MEMBER_SEPARATOR.test(source[index])) {
      index += 1;
      continue;
    }

    const quote = source[index];

    if (quote !== "'" && quote !== '"') {
      return null;
    }

    let member = '';
    let closed = false;
    index += 1;

    while (index < source.length && !closed) {
      const char = source[index];

      if (char === '\\' && index + 1 < source.length) {
        member += unescapeMySQL(source[index + 1]);
        index += 2;
      } else if (char !== quote) {
        member += char;
        index += 1;
      } else if (source[index + 1] === quote) {
        member += quote;
        index += 2;
      } else {
        closed = true;
        index += 1;
      }
    }

    if (!closed) {
      return null;
    }
    members.push(member);
  }

  return members.length === 0 ? null : members;
}

// MySQL keeps the backslash of an escaped percent sign or underscore, which a
// LIKE pattern reads, and drops it before any other character it has no
// escape for.
function unescapeMySQL(char: string): string {
  return char === '%' || char === '_'
    ? `\\${char}`
    : (mysqlEscapes.get(char) ?? char);
}
