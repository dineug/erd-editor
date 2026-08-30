import { Database } from '@/constants/schema';

import { GraphQLModel } from './types';

/**
 * Every cell below is a name taken from that dialect's hint list under
 * @/constants/sql/dataType, so getPrimitiveType resolves it back to a
 * primitive the ten code generators understand.
 */

const stringTypes: Record<number, string> = {
  [Database.MariaDB]: 'VARCHAR(255)',
  [Database.MSSQL]: 'varchar(255)',
  [Database.MySQL]: 'VARCHAR(255)',
  [Database.Oracle]: 'VARCHAR2(255)',
  [Database.PostgreSQL]: 'varchar(255)',
  [Database.SQLite]: 'TEXT',
  [Database.Databricks]: 'STRING',
  [Database.Snowflake]: 'VARCHAR(255)',
};

const intTypes: Record<number, string> = {
  [Database.MariaDB]: 'INT',
  [Database.MSSQL]: 'int',
  [Database.MySQL]: 'INT',
  [Database.Oracle]: 'INTEGER',
  [Database.PostgreSQL]: 'integer',
  [Database.SQLite]: 'INTEGER',
  [Database.Databricks]: 'INT',
  [Database.Snowflake]: 'INT',
};

const smallintTypes: Record<number, string> = {
  [Database.MariaDB]: 'SMALLINT',
  [Database.MSSQL]: 'smallint',
  [Database.MySQL]: 'SMALLINT',
  [Database.Oracle]: 'SMALLINT',
  [Database.PostgreSQL]: 'smallint',
  [Database.SQLite]: 'SMALLINT',
  [Database.Databricks]: 'SMALLINT',
  [Database.Snowflake]: 'SMALLINT',
};

const bigintTypes: Record<number, string> = {
  [Database.MariaDB]: 'BIGINT',
  [Database.MSSQL]: 'bigint',
  [Database.MySQL]: 'BIGINT',
  // Oracle.ts has no BIGINT; NUMBER carries the long primitive there.
  [Database.Oracle]: 'NUMBER(19)',
  [Database.PostgreSQL]: 'bigint',
  [Database.SQLite]: 'BIGINT',
  [Database.Databricks]: 'BIGINT',
  [Database.Snowflake]: 'BIGINT',
};

// GraphQL Float is an IEEE 754 double, so every cell is the 64-bit column.
const floatTypes: Record<number, string> = {
  [Database.MariaDB]: 'DOUBLE',
  [Database.MSSQL]: 'float',
  [Database.MySQL]: 'DOUBLE',
  [Database.Oracle]: 'BINARY_DOUBLE',
  [Database.PostgreSQL]: 'double precision',
  [Database.SQLite]: 'REAL',
  [Database.Databricks]: 'DOUBLE',
  [Database.Snowflake]: 'FLOAT',
};

const decimalTypes: Record<number, string> = {
  [Database.MariaDB]: 'DECIMAL',
  [Database.MSSQL]: 'decimal',
  [Database.MySQL]: 'DECIMAL',
  [Database.Oracle]: 'DECIMAL',
  [Database.PostgreSQL]: 'numeric',
  [Database.SQLite]: 'DECIMAL',
  [Database.Databricks]: 'DECIMAL',
  [Database.Snowflake]: 'DECIMAL',
};

const booleanTypes: Record<number, string> = {
  [Database.MariaDB]: 'BOOLEAN',
  // MSSQL.ts has no boolean; bit is the T-SQL stand-in, primitive int.
  [Database.MSSQL]: 'bit',
  [Database.MySQL]: 'BOOLEAN',
  [Database.Oracle]: 'BOOLEAN',
  [Database.PostgreSQL]: 'boolean',
  [Database.SQLite]: 'BOOLEAN',
  [Database.Databricks]: 'BOOLEAN',
  [Database.Snowflake]: 'BOOLEAN',
};

const dateTypes: Record<number, string> = {
  [Database.MariaDB]: 'DATE',
  [Database.MSSQL]: 'date',
  [Database.MySQL]: 'DATE',
  [Database.Oracle]: 'DATE',
  [Database.PostgreSQL]: 'date',
  [Database.SQLite]: 'DATE',
  [Database.Databricks]: 'DATE',
  [Database.Snowflake]: 'DATE',
};

const timeTypes: Record<number, string> = {
  [Database.MariaDB]: 'TIME',
  [Database.MSSQL]: 'time',
  [Database.MySQL]: 'TIME',
  // Oracle.ts, SQLite.ts and Databricks.ts list no time-of-day type.
  [Database.Oracle]: 'VARCHAR2(255)',
  [Database.PostgreSQL]: 'time',
  [Database.SQLite]: 'TEXT',
  [Database.Databricks]: 'STRING',
  [Database.Snowflake]: 'TIME',
};

const dateTimeTypes: Record<number, string> = {
  [Database.MariaDB]: 'DATETIME',
  [Database.MSSQL]: 'datetime2',
  [Database.MySQL]: 'DATETIME',
  [Database.Oracle]: 'TIMESTAMP',
  [Database.PostgreSQL]: 'timestamp',
  [Database.SQLite]: 'DATETIME',
  [Database.Databricks]: 'TIMESTAMP',
  [Database.Snowflake]: 'TIMESTAMP_NTZ',
};

const dateTimeTzTypes: Record<number, string> = {
  // MySQL and MariaDB normalise TIMESTAMP to UTC; DATETIME is the naive one.
  [Database.MariaDB]: 'TIMESTAMP',
  [Database.MSSQL]: 'datetimeoffset',
  [Database.MySQL]: 'TIMESTAMP',
  [Database.Oracle]: 'TIMESTAMP WITH TIME ZONE',
  [Database.PostgreSQL]: 'timestamptz',
  // SQLite.ts and Databricks.ts list no zoned variant.
  [Database.SQLite]: 'DATETIME',
  [Database.Databricks]: 'TIMESTAMP',
  [Database.Snowflake]: 'TIMESTAMP_TZ',
};

const durationTypes: Record<number, string> = {
  // MariaDB.ts, MSSQL.ts, MySQL.ts, SQLite.ts and Snowflake.ts list no interval
  // type, and an ISO-8601 duration such as P3Y6M does not fit MySQL's TIME
  // either.
  [Database.MariaDB]: 'VARCHAR(255)',
  [Database.MSSQL]: 'varchar(255)',
  [Database.MySQL]: 'VARCHAR(255)',
  [Database.Oracle]: 'INTERVAL DAY TO SECOND',
  [Database.PostgreSQL]: 'interval',
  [Database.SQLite]: 'TEXT',
  [Database.Databricks]: 'INTERVAL DAY TO SECOND',
  [Database.Snowflake]: 'VARCHAR(255)',
};

const jsonTypes: Record<number, string> = {
  [Database.MariaDB]: 'JSON',
  [Database.MSSQL]: 'json',
  [Database.MySQL]: 'JSON',
  [Database.Oracle]: 'JSON',
  [Database.PostgreSQL]: 'jsonb',
  // SQLite.ts lists no JSON type; Databricks.ts and Snowflake.ts spell it
  // VARIANT.
  [Database.SQLite]: 'TEXT',
  [Database.Databricks]: 'VARIANT',
  [Database.Snowflake]: 'VARIANT',
};

const uuidTypes: Record<number, string> = {
  [Database.MariaDB]: 'UUID',
  [Database.MSSQL]: 'uniqueidentifier',
  // MySQL.ts, Oracle.ts, SQLite.ts and Databricks.ts list no UUID type; the
  // canonical text form is 36 characters wide. Snowflake.ts lists one.
  [Database.MySQL]: 'CHAR(36)',
  [Database.Oracle]: 'VARCHAR2(36)',
  [Database.PostgreSQL]: 'uuid',
  [Database.SQLite]: 'TEXT',
  [Database.Databricks]: 'STRING',
  [Database.Snowflake]: 'UUID',
};

const bytesTypes: Record<number, string> = {
  [Database.MariaDB]: 'BLOB',
  [Database.MSSQL]: 'varbinary(max)',
  [Database.MySQL]: 'BLOB',
  [Database.Oracle]: 'BLOB',
  [Database.PostgreSQL]: 'bytea',
  [Database.SQLite]: 'BLOB',
  [Database.Databricks]: 'BINARY',
  [Database.Snowflake]: 'BINARY',
};

/**
 * Keys are lowercase because the same scalar reaches us spelled three ways:
 * Prisma writes DateTime, Hasura echoes the PostgreSQL name timestamptz,
 * graphql-scalars writes DateTimeISO.
 */
const scalarTypes: Record<string, Record<number, string>> = {
  // ID serializes as a String, and a Relay or Federation global id is an opaque
  // base64 string, so it is not narrowed to an integer.
  id: stringTypes,
  string: stringTypes,
  boolean: booleanTypes,
  int: intTypes,
  float: floatTypes,

  positiveint: intTypes,
  nonnegativeint: intTypes,
  unsignedint: intTypes,
  short: smallintTypes,
  smallint: smallintTypes,
  positivefloat: floatTypes,
  nonnegativefloat: floatTypes,
  bigint: bigintTypes,
  biginteger: bigintTypes,
  long: bigintTypes,
  int8: bigintTypes,
  // SafeInt is 53-bit, which overflows a 32-bit int column.
  safeint: bigintTypes,
  decimal: decimalTypes,
  bigdecimal: decimalTypes,
  numeric: decimalTypes,
  // Hasura surfaces PostgreSQL money; DECIMAL beats the string fallback on
  // the five dialects with no money column.
  money: decimalTypes,

  datetime: dateTimeTypes,
  datetimeiso: dateTimeTypes,
  localdatetime: dateTimeTypes,
  // graphql-scalars' Timestamp is epoch millis, but timestamp echoed from an
  // introspected SQL schema is the far more common spelling in external SDL.
  timestamp: dateTimeTypes,
  timestamptz: dateTimeTzTypes,
  date: dateTypes,
  localdate: dateTypes,
  time: timeTypes,
  localtime: timeTypes,
  timetz: timeTypes,
  duration: durationTypes,
  iso8601duration: durationTypes,
  interval: durationTypes,

  json: jsonTypes,
  jsonb: jsonTypes,
  jsonobject: jsonTypes,
  uuid: uuidTypes,
  guid: uuidTypes,
  // graphql-java's Byte is an 8-bit integer, but graphql-scalars' Byte and
  // Prisma's Bytes are both binary buffers, which is the usual intent.
  byte: bytesTypes,
  bytes: bytesTypes,
  bytea: bytesTypes,
  binary: bytesTypes,

  email: stringTypes,
  emailaddress: stringTypes,
  url: stringTypes,
  uri: stringTypes,
  void: stringTypes,
};

export function resolveDataType(
  named: string,
  database: number,
  model: GraphQLModel
): string {
  const fallback = stringTypes[database] ?? '';

  const enumMembers = getMembers(model.enums, named);
  if (enumMembers) {
    return enumDataType(enumMembers, database) ?? fallback;
  }

  if (getMembers(model.unions, named)) {
    return fallback;
  }

  // toLowerCase and not toLocaleLowerCase: the latter maps ID to ıd
  // under a Turkish locale, which would miss the key.
  return scalarTypes[named.toLowerCase()]?.[database] ?? fallback;
}

/**
 * Keeps the members where the column type cannot hold them. Pass database to
 * drop it on the dialects whose ENUM(...) column already spells them out.
 */
export function enumCommentSuffix(
  named: string,
  model: GraphQLModel,
  database?: number
): string {
  const enumMembers = getMembers(model.enums, named);
  if (enumMembers) {
    const encoded =
      database !== undefined &&
      enumDataType(enumMembers, database) !== undefined;
    return encoded ? '' : membersSuffix(named, enumMembers);
  }

  // A union column always takes the string fallback, so its members only ever
  // survive in the comment.
  const unionMembers = getMembers(model.unions, named);
  return unionMembers ? membersSuffix(named, unionMembers) : '';
}

/**
 * Only MySQL.ts and MariaDB.ts list ENUM; every other dialect takes the string
 * fallback and leans on enumCommentSuffix to keep the members.
 */
function enumDataType(members: string[], database: number): string | undefined {
  if (database !== Database.MySQL && database !== Database.MariaDB) {
    return undefined;
  }
  return `ENUM(${members.map(member => `'${member.replace(/'/g, "''")}'`).join(',')})`;
}

function membersSuffix(named: string, members: string[]): string {
  return ` ${named}: ${members.join(' | ')}`;
}

/**
 * A GraphQL type may legally be named constructor or toString, so an
 * inherited property has to be told from a real entry.
 */
function getMembers(
  source: Record<string, string[]>,
  named: string
): string[] | undefined {
  const members = source[named];
  return Array.isArray(members) && members.length ? members : undefined;
}
