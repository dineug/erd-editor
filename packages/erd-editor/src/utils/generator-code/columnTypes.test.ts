import { describe, expect, it } from 'vite-plus/test';

import { underTurkishLocale } from '@/__test-utils__/locale';
import { Database } from '@/constants/schema';
import {
  ColumnScalar,
  columnScalar,
  enumMembers,
  getColumnType,
  isMySQLFamily,
  isUnsigned,
  splitPostgresArray,
  typeArguments,
} from '@/utils/generator-code/columnTypes';

const {
  Databricks,
  MariaDB,
  MSSQL,
  MySQL,
  Oracle,
  PostgreSQL,
  SQLite,
  Snowflake,
} = Database;

const SCALARS: Array<
  [database: number, dataType: string, scalar: ColumnScalar]
> = [
  [MySQL, 'TINYINT', 'i8'],
  [MySQL, 'TINYINT(1)', 'i8'],
  [MySQL, 'SMALLINT', 'i16'],
  [MySQL, 'MEDIUMINT', 'i32'],
  [MySQL, 'INT', 'i32'],
  [MySQL, 'BIGINT', 'i64'],
  [MySQL, 'TINYINT UNSIGNED', 'u8'],
  [MySQL, 'SMALLINT(5) UNSIGNED ZEROFILL', 'u16'],
  [MySQL, 'INT UNSIGNED', 'u32'],
  [MySQL, 'INT(11) ZEROFILL', 'u32'],
  [MySQL, 'BIGINT(20) UNSIGNED', 'u64'],
  [MySQL, 'SERIAL', 'u64'],
  [MySQL, 'SMALLINT SIGNED', 'i16'],
  [MySQL, 'TINYINT SIGNED', 'i8'],
  [MySQL, 'FLOAT(53) SIGNED', 'f64'],
  [MySQL, 'BIT', 'bool'],
  [MySQL, 'BIT(1)', 'bool'],
  [MySQL, 'BIT(8)', 'u64'],
  [MySQL, 'YEAR', 'u16'],
  [MySQL, 'FLOAT', 'f32'],
  [MySQL, 'FLOAT(24)', 'f32'],
  [MySQL, 'FLOAT(25)', 'f64'],
  [MySQL, 'DOUBLE', 'f64'],
  [MySQL, 'DECIMAL(10,2) UNSIGNED', 'decimal'],
  [MySQL, 'TIMESTAMP(3)', 'dateTimeUtc'],
  [MySQL, 'DATETIME(6)', 'dateTime'],
  [MySQL, 'TIME', 'time'],
  [MySQL, 'JSON', 'json'],
  [MySQL, 'BINARY(16)', 'bytes'],
  [MySQL, 'CHAR(16) BYTE', 'bytes'],
  [MySQL, "ENUM('a','b')", 'string'],
  [MariaDB, 'UUID', 'uuid'],
  [MariaDB, 'NUMBER', 'f64'],
  [MariaDB, 'NUMBER(10,2)', 'decimal'],
  [MariaDB, 'INET6', 'string'],
  [PostgreSQL, 'smallserial', 'i16'],
  [PostgreSQL, 'bigserial', 'i64'],
  [PostgreSQL, 'oid', 'u32'],
  [PostgreSQL, 'xid', 'u32'],
  [PostgreSQL, 'cid', 'u32'],
  [PostgreSQL, 'xid8', 'u64'],
  [PostgreSQL, 'float(24)', 'f32'],
  [PostgreSQL, 'float(25)', 'f64'],
  [PostgreSQL, 'money', 'decimal'],
  [PostgreSQL, 'bit(8)', 'string'],
  [PostgreSQL, 'varbit', 'string'],
  [PostgreSQL, 'pg_lsn', 'string'],
  [PostgreSQL, 'timetz', 'timeTz'],
  [PostgreSQL, 'time with time zone', 'timeTz'],
  [PostgreSQL, 'time(6)', 'time'],
  [PostgreSQL, 'timestamptz(3)', 'dateTimeOffset'],
  [PostgreSQL, 'timestamp without time zone', 'dateTime'],
  [PostgreSQL, 'interval day to second(3)', 'interval'],
  [PostgreSQL, 'uuid', 'uuid'],
  [PostgreSQL, 'jsonb', 'json'],
  [PostgreSQL, 'bytea', 'bytes'],
  [MSSQL, 'bit', 'bool'],
  [MSSQL, 'tinyint', 'u8'],
  [MSSQL, 'numeric(18,4)', 'decimal'],
  [MSSQL, 'smallmoney', 'decimal'],
  [MSSQL, 'float(24)', 'f32'],
  [MSSQL, 'float', 'f64'],
  [MSSQL, 'rowversion', 'bytes'],
  [MSSQL, 'timestamp', 'bytes'],
  [MSSQL, 'uniqueidentifier', 'uuid'],
  [MSSQL, 'datetimeoffset(7)', 'dateTimeOffset'],
  [MSSQL, 'json', 'json'],
  [Oracle, 'DATE', 'dateTime'],
  [Oracle, 'REAL', 'f64'],
  [Oracle, 'BINARY_FLOAT', 'f32'],
  [Oracle, 'NUMBER', 'i64'],
  [Oracle, 'NUMBER(10)', 'i64'],
  [Oracle, 'NUMBER(10,2)', 'decimal'],
  [Oracle, 'NUMBER(*,2)', 'decimal'],
  [Oracle, 'INT', 'i64'],
  [Oracle, 'INTEGER', 'i64'],
  [Oracle, 'SMALLINT', 'i64'],
  [Oracle, 'TIMESTAMP(6) WITH LOCAL TIME ZONE', 'dateTimeUtc'],
  [Oracle, 'TIMESTAMP(6) WITH TIME ZONE', 'dateTimeOffset'],
  [Oracle, 'INTERVAL YEAR(2) TO MONTH', 'interval'],
  [Oracle, 'RAW(16)', 'bytes'],
  [SQLite, 'BOOL', 'bool'],
  [SQLite, 'TIME', 'time'],
  [SQLite, 'TIMESTAMP', 'dateTime'],
  [SQLite, 'INTEGER', 'i64'],
  [SQLite, 'INT', 'i64'],
  [SQLite, 'MEDIUMINT', 'i64'],
  [SQLite, 'SMALLINT', 'i64'],
  [SQLite, 'INT2', 'i64'],
  [SQLite, 'TINYINT', 'i64'],
  [SQLite, 'UNSIGNED BIG INT', 'i64'],
  [Snowflake, 'BYTEINT', 'i64'],
  [Snowflake, 'TINYINT', 'i64'],
  [Snowflake, 'SMALLINT', 'i64'],
  [Snowflake, 'INT', 'i64'],
  [Snowflake, 'INTEGER', 'i64'],
  [Snowflake, 'NUMBER(38,0)', 'i64'],
  [Snowflake, 'NUMBER(38,2)', 'decimal'],
  [Snowflake, 'TIMESTAMP_LTZ(9)', 'dateTimeUtc'],
  [Snowflake, 'TIMESTAMP_TZ', 'dateTimeOffset'],
  [Snowflake, 'TIMESTAMP', 'dateTime'],
  [Snowflake, 'VARIANT', 'json'],
  [Snowflake, 'OBJECT(city VARCHAR)', 'json'],
  [Snowflake, 'UUID', 'uuid'],
  [Databricks, 'BYTE', 'i8'],
  [Databricks, 'SHORT', 'i16'],
  [Databricks, 'LONG', 'i64'],
  [Databricks, 'TIMESTAMP', 'dateTimeUtc'],
  [Databricks, 'TIMESTAMP_NTZ', 'dateTime'],
  [Databricks, 'ARRAY<INT>', 'json'],
  [Databricks, 'STRUCT<a:INT>', 'json'],
  [Databricks, 'INTERVAL DAY TO SECOND', 'interval'],
  [Databricks, 'VOID', 'string'],
];

describe('column types', () => {
  it.each(SCALARS)('reads %i %j as %s', (database, dataType, scalar) => {
    expect(getColumnType(dataType, database).scalar).toBe(scalar);
  });

  it('reads a MySQL name with an I under a Turkish default locale too', () => {
    underTurkishLocale(() => {
      expect(getColumnType('INT UNSIGNED', MySQL).scalar).toBe('u32');
      expect(getColumnType('TINYINT', MySQL).scalar).toBe('i8');
      expect(getColumnType('BIT(8)', MySQL).scalar).toBe('u64');
    });
  });

  it('keeps the element, its base name and its numeric arguments', () => {
    expect(getColumnType('varchar(20)[]', PostgreSQL)).toMatchObject({
      scalar: 'string',
      element: 'varchar(20)',
      base: 'varchar',
      args: [20],
      arrayDepth: 1,
    });
    expect(getColumnType('INT(11) UNSIGNED ZEROFILL', MySQL)).toMatchObject({
      base: 'int',
      args: [11],
      isUnsigned: true,
    });
    expect(getColumnType('INT SIGNED', MariaDB).base).toBe('int');
    expect(getColumnType('int UNSIGNED', PostgreSQL)).toMatchObject({
      scalar: 'i32',
      base: 'int unsigned',
      isUnsigned: false,
    });
  });

  it('counts the array dimensions PostgreSQL declares, every spelling', () => {
    expect(getColumnType('int[][]', PostgreSQL)).toMatchObject({
      scalar: 'i32',
      arrayDepth: 2,
    });
    expect(getColumnType('integer ARRAY[4]', PostgreSQL).arrayDepth).toBe(1);
    expect(getColumnType('int[3]', PostgreSQL).arrayDepth).toBe(1);
    expect(getColumnType('int[]', MySQL).arrayDepth).toBe(0);
  });

  it('gives an integer its width, MySQL MEDIUMINT its 24 bits', () => {
    expect(getColumnType('MEDIUMINT UNSIGNED', MySQL)).toMatchObject({
      scalar: 'u32',
      bits: 24,
    });
    expect(getColumnType('INT3', MariaDB).bits).toBe(24);
    expect(getColumnType('MEDIUMINT', SQLite).bits).toBe(64);
    expect(getColumnType('SMALLINT', PostgreSQL).bits).toBe(16);
    expect(getColumnType('SERIAL', MySQL).bits).toBe(64);
    expect(getColumnType('DOUBLE', MySQL).bits).toBeNull();
  });

  it('widens every integer Oracle, Snowflake and SQLite store in 64 bits', () => {
    expect(getColumnType('SMALLINT', Oracle)).toMatchObject({
      scalar: 'i64',
      bits: 64,
    });
    expect(getColumnType('TINYINT', SQLite).bits).toBe(64);
    expect(getColumnType('SMALLINT', MySQL).scalar).toBe('i16');
    expect(getColumnType('TINYINT', Databricks).scalar).toBe('i8');
    expect(getColumnType('NUMBER(10,2)', Oracle).scalar).toBe('decimal');
    expect(getColumnType('BOOLEAN', SQLite).scalar).toBe('bool');
  });

  it('tells whether the vendor list names the type', () => {
    expect(getColumnType('int4', PostgreSQL).isListed).toBe(true);
    expect(getColumnType('"my enum"[]', PostgreSQL)).toMatchObject({
      scalar: 'string',
      arrayDepth: 1,
      isListed: false,
    });
    expect(getColumnType('', MySQL).isListed).toBe(false);
  });

  it('reads the declared length of a character type alone', () => {
    expect(getColumnType('VARCHAR(255)', MySQL).length).toBe(255);
    expect(getColumnType('char(10)', PostgreSQL).length).toBe(10);
    expect(getColumnType('nvarchar(100)', MSSQL).length).toBe(100);
    expect(getColumnType('VARCHAR2(100 BYTE)', Oracle).length).toBe(100);
    expect(getColumnType('NVARCHAR2(50 CHAR)', Oracle).length).toBe(50);
    expect(getColumnType('STRING(100)', Snowflake).length).toBe(100);
    expect(getColumnType('TEXT(50)', Snowflake).length).toBe(50);
    expect(getColumnType('TEXT(50)', MySQL).length).toBeNull();
    expect(getColumnType('nvarchar(max)', MSSQL).length).toBeNull();
    expect(getColumnType('VARBINARY(16)', MySQL).length).toBeNull();
    expect(getColumnType('varchar', PostgreSQL).length).toBeNull();
  });

  it('reads a decimal or NUMBER precision and scale as declared', () => {
    expect(getColumnType('numeric(10,2)', PostgreSQL)).toMatchObject({
      precision: 10,
      scale: 2,
    });
    expect(getColumnType('NUMBER(*,2)', Oracle)).toMatchObject({
      scalar: 'decimal',
      precision: 38,
      scale: 2,
    });
    expect(getColumnType('NUMBER(10)', Oracle)).toMatchObject({
      scalar: 'i64',
      precision: 10,
      scale: null,
    });
    expect(getColumnType('NUMBER(10,-2)', Oracle).scale).toBe(-2);
    expect(getColumnType('NUMBER', Oracle)).toMatchObject({
      precision: null,
      scale: null,
    });
    expect(getColumnType('DECIMAL(10,2) UNSIGNED', MySQL).precision).toBe(10);
    expect(getColumnType('FLOAT(10,2)', MySQL).precision).toBeNull();
  });

  it('marks the types a database reads its own way', () => {
    expect(getColumnType('bigserial', PostgreSQL).isSerial).toBe(true);
    expect(getColumnType('SERIAL', MariaDB).isSerial).toBe(true);
    expect(getColumnType('serial', SQLite).isSerial).toBe(false);
    expect(getColumnType('money', PostgreSQL).isMoney).toBe(true);
    expect(getColumnType('smallmoney', MSSQL).isMoney).toBe(true);
    expect(getColumnType('uniqueidentifier', MSSQL).isGuid).toBe(true);
    expect(getColumnType('uuid', PostgreSQL).isGuid).toBe(false);
    expect(getColumnType('rowversion', MSSQL).isRowVersion).toBe(true);
    expect(getColumnType('timestamp', MySQL).isRowVersion).toBe(false);
    expect(getColumnType('MAP<STRING,INT>', Databricks).isSemiStructured).toBe(
      true
    );
    expect(getColumnType('ARRAY', PostgreSQL).isSemiStructured).toBe(false);
    expect(getColumnType('bit varying(8)', PostgreSQL).isBitString).toBe(true);
    expect(getColumnType('BIT(8)', MySQL).isBitString).toBe(false);
    expect(getColumnType('REAL', Oracle).isFloat).toBe(true);
  });

  it('marks the integers node-postgres hands over as text', () => {
    expect(getColumnType('xid', PostgreSQL)).toMatchObject({
      scalar: 'u32',
      isTextInteger: true,
    });
    expect(getColumnType('cid', PostgreSQL).isTextInteger).toBe(true);
    expect(getColumnType('xid8[]', PostgreSQL).isTextInteger).toBe(true);
    expect(getColumnType('oid', PostgreSQL).isTextInteger).toBe(false);
    expect(getColumnType('xid', MySQL).isTextInteger).toBe(false);
  });

  it('marks the type that holds nothing but NULL', () => {
    expect(getColumnType('VOID', Databricks)).toMatchObject({
      scalar: 'string',
      isNullOnly: true,
    });
    expect(getColumnType('void', PostgreSQL).isNullOnly).toBe(false);
    expect(getColumnType('STRING', Databricks).isNullOnly).toBe(false);
  });

  it('tells an interval by the fields it holds', () => {
    expect(getColumnType('interval', PostgreSQL).interval).toBe('mixed');
    expect(getColumnType('interval(3)', PostgreSQL).interval).toBe('mixed');
    expect(getColumnType('interval year to month', PostgreSQL).interval).toBe(
      'yearMonth'
    );
    expect(getColumnType('interval month', PostgreSQL).interval).toBe(
      'yearMonth'
    );
    expect(getColumnType('INTERVAL DAY(2) TO SECOND(6)', Oracle).interval).toBe(
      'dayTime'
    );
    expect(getColumnType('INTERVAL HOUR', Databricks).interval).toBe('dayTime');
    expect(getColumnType('time', PostgreSQL).interval).toBeNull();
  });

  it('names the network types MariaDB and PostgreSQL have', () => {
    expect(getColumnType('INET4', MariaDB).network).toBe('ipv4');
    expect(getColumnType('INET6', MariaDB).network).toBe('ipv6');
    expect(getColumnType('inet', PostgreSQL).network).toBe('inet');
    expect(getColumnType('cidr', PostgreSQL).network).toBe('cidr');
    expect(getColumnType('macaddr8', PostgreSQL).network).toBe('macaddr8');
    expect(getColumnType('INET4', MySQL).network).toBeNull();
    expect(getColumnType('inet', MSSQL).network).toBeNull();
  });

  it('reads the members of an ENUM and of a SET', () => {
    expect(getColumnType("ENUM('a','b')", MySQL)).toMatchObject({
      scalar: 'string',
      enumMembers: ['a', 'b'],
      setMembers: null,
    });
    expect(getColumnType("SET('r','w')", MySQL)).toMatchObject({
      enumMembers: null,
      setMembers: ['r', 'w'],
    });
    expect(getColumnType("enum('draft')", PostgreSQL).enumMembers).toEqual([
      'draft',
    ]);
    expect(getColumnType('ENUM', MySQL).enumMembers).toBeNull();
    expect(getColumnType('VARCHAR(5)', MySQL).enumMembers).toBeNull();
  });
});

describe('enumMembers', () => {
  it.each<[dataType: string, members: string[] | null]>([
    ["ENUM('a','b')", ['a', 'b']],
    ["enum ( 'a' , 'b' )", ['a', 'b']],
    ['ENUM("a","b")', ['a', 'b']],
    ["ENUM('it''s','x')", ["it's", 'x']],
    ['ENUM("say ""hi""")', ['say "hi"']],
    ["ENUM('a\\'b')", ["a'b"]],
    ["ENUM('a\\\\b')", ['a\\b']],
    ["ENUM('a\\nb','\\Z','\\0')", ['a\nb', '\x1a', '\0']],
    ["ENUM('50\\%','a\\_b')", ['50\\%', 'a\\_b']],
    ["ENUM('a)b','c')", ['a)b', 'c']],
    ["ENUM('')", ['']],
    ["SET('r','w')", ['r', 'w']],
    ['ENUM()', null],
    ['ENUM(a,b)', null],
    ["ENUM('a", null],
    ["ENUM('a\\", null],
    ["VARCHAR('a')", null],
  ])('reads %j as %j', (dataType, members) => {
    expect(enumMembers(dataType)).toEqual(members);
  });
});

describe('isUnsigned', () => {
  it('is true for UNSIGNED, ZEROFILL and SERIAL on MySQL and MariaDB alone', () => {
    expect(isUnsigned('INT UNSIGNED', MySQL)).toBe(true);
    expect(isUnsigned('int(11) zerofill', MariaDB)).toBe(true);
    expect(isUnsigned('SERIAL', MySQL)).toBe(true);
    expect(isUnsigned('DECIMAL(10,2) UNSIGNED', MySQL)).toBe(true);
    expect(isUnsigned('INT SIGNED', MySQL)).toBe(false);
    expect(isUnsigned('INT', MySQL)).toBe(false);
    expect(isUnsigned('INT UNSIGNED', PostgreSQL)).toBe(false);
    expect(isUnsigned('UNSIGNED BIG INT', SQLite)).toBe(false);
  });
});

describe('splitPostgresArray', () => {
  it('takes one dimension a bracket pair or the ARRAY keyword', () => {
    expect(splitPostgresArray('int[]', PostgreSQL)).toEqual(['int', 1]);
    expect(splitPostgresArray('int[3][ ]', PostgreSQL)).toEqual(['int', 2]);
    expect(splitPostgresArray('integer array', PostgreSQL)).toEqual([
      'integer',
      1,
    ]);
    expect(splitPostgresArray('text', PostgreSQL)).toEqual(['text', 0]);
    expect(splitPostgresArray('int[]', MSSQL)).toEqual(['int[]', 0]);
  });
});

describe('typeArguments', () => {
  it('keeps the first argument list only where every argument is a number', () => {
    expect(typeArguments('numeric( 10 , 2 )')).toEqual([10, 2]);
    expect(typeArguments('VARCHAR2(4000 CHAR)')).toEqual([]);
    expect(typeArguments('nvarchar(max)')).toEqual([]);
    expect(typeArguments('text')).toEqual([]);
  });
});

describe('isMySQLFamily', () => {
  it('is true for MySQL and MariaDB alone', () => {
    expect(isMySQLFamily(MySQL)).toBe(true);
    expect(isMySQLFamily(MariaDB)).toBe(true);
    expect(isMySQLFamily(PostgreSQL)).toBe(false);
  });
});

describe('columnScalar', () => {
  it('reads a type no rule names by the category it is given', () => {
    expect(columnScalar('INT', 'int', [], MySQL, false, () => 'long')).toBe(
      'i64'
    );
    expect(columnScalar('INT', 'int', [], MySQL, false)).toBe('i32');
  });

  it('keeps the width the name declares, where the column stores 64 bits', () => {
    expect(columnScalar('INTEGER', 'integer', [], SQLite, false)).toBe('i32');
    expect(columnScalar('TINYINT', 'tinyint', [], SQLite, false)).toBe('i8');
    expect(columnScalar('SMALLINT', 'smallint', [], Oracle, false)).toBe('i32');
    expect(columnScalar('TINYINT', 'tinyint', [], Snowflake, false)).toBe(
      'i32'
    );
  });
});
