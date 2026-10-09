import { describe, expect, it } from 'vite-plus/test';

import { underTurkishLocale } from '@/__test-utils__/locale';
import { Database } from '@/constants/schema';
import {
  getRustColumnType,
  RUST_SCALAR_PATHS,
  wrapVec,
} from '@/utils/generator-code/rustTypes';

const { MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, SQLite, Snowflake } =
  Database;
const { Databricks } = Database;

/**
 * sqlx 0.9 read and wrote back the PostgreSQL, MySQL, MariaDB and SQLite rows,
 * through selectAs where one is given; SQL Server and Oracle follow tiberius and
 * rust-oracle, Snowflake and Databricks their vendors' documentation.
 */
const TYPES: Array<[database: number, dataType: string, rust: string]> = [
  [MySQL, 'INT UNSIGNED', 'u32'],
  [MySQL, 'TINYINT(1) UNSIGNED', 'u8'],
  [MySQL, 'INT(11) UNSIGNED ZEROFILL', 'u32'],
  [MySQL, 'INT ZEROFILL', 'u32'],
  [MySQL, 'MEDIUMINT UNSIGNED', 'u32'],
  [MySQL, 'BIGINT(20) UNSIGNED', 'u64'],
  [MySQL, 'SERIAL', 'u64'],
  [MySQL, 'DECIMAL(10,2) UNSIGNED', 'rust_decimal::Decimal'],
  [MySQL, 'BIT', 'bool'],
  [MySQL, 'BIT(1)', 'bool'],
  [MySQL, 'BIT(8)', 'u64'],
  [MySQL, 'YEAR', 'u16'],
  [MySQL, 'TIMESTAMP(6)', 'chrono::DateTime<chrono::Utc>'],
  [MySQL, 'FLOAT(24)', 'f32'],
  [MySQL, 'FLOAT(53)', 'f64'],
  [MySQL, 'FLOAT(10,2)', 'f32'],
  [MySQL, 'TINYINT(1)', 'i8'],
  [MySQL, 'SMALLINT', 'i16'],
  [MySQL, 'BINARY(16)', 'Vec<u8>'],
  [MySQL, 'JSON', 'serde_json::Value'],
  [MySQL, 'CHAR(36)', 'String'],
  [MySQL, "ENUM('a','b')", 'String'],
  [MySQL, 'DATETIME', 'chrono::NaiveDateTime'],
  [MariaDB, 'UUID', 'String'],
  [MariaDB, 'NUMBER', 'f64'],
  [MariaDB, 'NUMBER(10,2)', 'rust_decimal::Decimal'],
  [MariaDB, 'SQL_TSI_YEAR', 'u16'],
  [MariaDB, 'INET6', 'String'],
  [MariaDB, 'RAW(16)', 'Vec<u8>'],
  [PostgreSQL, 'smallserial', 'i16'],
  [PostgreSQL, 'float(24)', 'f32'],
  [PostgreSQL, 'float(25)', 'f64'],
  [
    PostgreSQL,
    'timestamp(6) with time zone',
    'chrono::DateTime<chrono::FixedOffset>',
  ],
  [PostgreSQL, 'uuid', 'uuid::Uuid'],
  [PostgreSQL, 'bytea', 'Vec<u8>'],
  [PostgreSQL, 'jsonb', 'serde_json::Value'],
  [MSSQL, 'bit', 'bool'],
  [MSSQL, 'tinyint', 'u8'],
  [MSSQL, 'timestamp', 'Vec<u8>'],
  [MSSQL, 'numeric(18,4)', 'rust_decimal::Decimal'],
  [MSSQL, 'float(24)', 'f32'],
  [MSSQL, 'float', 'f64'],
  [MSSQL, 'money', 'rust_decimal::Decimal'],
  [MSSQL, 'smallmoney', 'rust_decimal::Decimal'],
  [MSSQL, 'uniqueidentifier', 'uuid::Uuid'],
  [MSSQL, 'datetimeoffset(7)', 'chrono::DateTime<chrono::FixedOffset>'],
  [Oracle, 'DATE', 'chrono::NaiveDateTime'],
  [Oracle, 'REAL', 'f64'],
  [Oracle, 'NUMBER(10,2)', 'rust_decimal::Decimal'],
  [Oracle, 'NUMBER(*,2)', 'rust_decimal::Decimal'],
  [Oracle, 'NUMBER(10)', 'i64'],
  [Oracle, 'SMALLINT', 'i32'],
  [
    Oracle,
    'TIMESTAMP(6) WITH LOCAL TIME ZONE',
    'chrono::DateTime<chrono::Utc>',
  ],
  [Oracle, 'INTERVAL DAY(2) TO SECOND(6)', 'String'],
  [Oracle, 'BLOB', 'Vec<u8>'],
  [SQLite, 'TINYINT', 'i8'],
  [SQLite, 'INT2', 'i16'],
  [SQLite, 'UNSIGNED BIG INT', 'i64'],
  [SQLite, 'BLOB', 'Vec<u8>'],
  [SQLite, 'TIMESTAMP', 'String'],
  [Snowflake, 'NUMBER(38,0)', 'i64'],
  [Snowflake, 'TINYINT', 'i32'],
  [Snowflake, 'TIMESTAMP_LTZ(9)', 'chrono::DateTime<chrono::Utc>'],
  [Snowflake, 'TIMESTAMP_TZ', 'chrono::DateTime<chrono::FixedOffset>'],
  [Snowflake, 'TIMESTAMP', 'chrono::NaiveDateTime'],
  [Snowflake, 'VARIANT', 'String'],
  [Databricks, 'TIMESTAMP', 'chrono::DateTime<chrono::Utc>'],
  [Databricks, 'TIMESTAMP_NTZ', 'chrono::NaiveDateTime'],
  [Databricks, 'BYTE', 'i8'],
  [Databricks, 'SHORT', 'i16'],
  [Databricks, 'ARRAY<INT>', 'String'],
  [Databricks, 'INTERVAL DAY TO SECOND', 'String'],
];

// No database takes these: UNSIGNED is a word of MySQL's and MariaDB's alone,
// and a column may have no type yet.
const PARSED_TYPES: Array<[database: number, dataType: string, rust: string]> =
  [
    [PostgreSQL, 'int UNSIGNED', 'i32'],
    [MySQL, '', 'String'],
  ];

// The PostgreSQL types sqlx reads into no Rust type here, cast on the way.
const POSTGRES_CASTS: Array<
  [dataType: string, rust: string, selectAs: string | null]
> = [
  ['money', 'rust_decimal::Decimal', 'numeric'],
  ['bit(8)', 'String', 'text'],
  ['timetz', 'String', 'text'],
  ['oid', 'String', 'text'],
  ['inet', 'String', 'text'],
  ['pg_lsn', 'String', 'text'],
  ['"char"', 'String', 'text'],
  ['interval day to second(3)', 'String', 'text'],
  ['mood', 'String', 'text'],
  ['citext', 'String', null],
  ['varchar(255)', 'String', null],
  ['int[]', 'Vec<i32>', null],
  ['integer ARRAY[4]', 'Vec<i32>', null],
  ['text[]', 'Vec<String>', null],
  ['numeric(10,2)[]', 'Vec<rust_decimal::Decimal>', null],
  ['money[]', 'Vec<rust_decimal::Decimal>', 'numeric[]'],
  ['interval[]', 'Vec<String>', 'text[]'],
  ['int[][]', 'Vec<Vec<i32>>', 'text'],
  ['int[3][3]', 'Vec<Vec<i32>>', 'text'],
];

// MySQL names with an I, which Turkish and Azerbaijani lower to a dotless i.
const DOTTED_I_TYPES: Array<[dataType: string, rust: string]> = [
  ['INT UNSIGNED', 'u32'],
  ['TINYINT', 'i8'],
  ['SMALLINT', 'i16'],
  ['BIT(8)', 'u64'],
  ['TIMESTAMP', 'chrono::DateTime<chrono::Utc>'],
  ['BINARY(16)', 'Vec<u8>'],
];

describe('rust types', () => {
  it.each(TYPES)('maps %i %j to %s', (database, dataType, rust) => {
    expect(getRustColumnType(dataType, database).rust).toBe(rust);
    expect(getRustColumnType(dataType, database).selectAs).toBeNull();
  });

  it.each(PARSED_TYPES)(
    'reads %i %j as %s though no database takes it',
    (database, dataType, rust) => {
      expect(getRustColumnType(dataType, database).rust).toBe(rust);
      expect(getRustColumnType(dataType, database).selectAs).toBeNull();
    }
  );

  it.each(POSTGRES_CASTS)(
    'reads PostgreSQL %j as %s through %j',
    (dataType, rust, selectAs) => {
      const type = getRustColumnType(dataType, PostgreSQL);

      expect(type.rust).toBe(rust);
      expect(type.selectAs).toBe(selectAs);
    }
  );

  it.each(DOTTED_I_TYPES)(
    'maps MySQL %j to %s under a Turkish default locale too',
    (dataType, rust) => {
      underTurkishLocale(() => {
        expect(getRustColumnType(dataType, MySQL).rust).toBe(rust);
      });
    }
  );

  it('counts the array dimensions PostgreSQL declares', () => {
    expect(getRustColumnType('int[]', PostgreSQL).arrayDepth).toBe(1);
    expect(getRustColumnType('integer ARRAY[4]', PostgreSQL).arrayDepth).toBe(
      1
    );
    expect(getRustColumnType('int[][]', PostgreSQL).arrayDepth).toBe(2);
    expect(getRustColumnType('int[]', MySQL).arrayDepth).toBe(0);
  });

  it('declares an entity a nested array as one string', () => {
    expect(getRustColumnType('int[][]', PostgreSQL)).toMatchObject({
      scalar: 'i32',
      entityScalar: 'string',
      isFloat: false,
    });
    expect(getRustColumnType('real[]', PostgreSQL)).toMatchObject({
      scalar: 'f32',
      entityScalar: 'f32',
      isFloat: true,
    });
  });

  it('reads UNSIGNED, ZEROFILL and SERIAL off a MySQL type alone', () => {
    expect(getRustColumnType('int(11) unsigned zerofill', MySQL)).toMatchObject(
      { base: 'int', args: [11], isUnsigned: true }
    );
    expect(getRustColumnType('SERIAL', MariaDB).isUnsigned).toBe(true);
    expect(getRustColumnType('INT UNSIGNED', SQLite).isUnsigned).toBe(false);
  });

  it('keeps the arguments only where all are numbers', () => {
    expect(getRustColumnType('numeric(10, 2)', PostgreSQL).args).toEqual([
      10, 2,
    ]);
    expect(getRustColumnType('VARCHAR2(4000 CHAR)', Oracle).args).toEqual([]);
  });

  it('wraps a type in one Vec a dimension', () => {
    expect(wrapVec('i32', 0)).toBe('i32');
    expect(wrapVec('i32', 2)).toBe('Vec<Vec<i32>>');
  });

  it('writes every outside type by its full path', () => {
    expect(RUST_SCALAR_PATHS.decimal).toBe('rust_decimal::Decimal');
    expect(RUST_SCALAR_PATHS.uuid).toBe('uuid::Uuid');
    expect(RUST_SCALAR_PATHS.json).toBe('serde_json::Value');
    expect(RUST_SCALAR_PATHS.dateTimeOffset).toBe(
      'chrono::DateTime<chrono::FixedOffset>'
    );
  });
});
