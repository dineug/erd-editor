import ts from '@typescript/typescript6';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database } from '@/constants/schema';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  getJsonShape,
  isNullableColumn,
  JsonShape,
  JsonShapeKind,
  toTypeScriptPropertyKey,
  toTypeScriptTypeName,
} from '@/utils/generator-code/jsonShape';

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

const KINDS: Array<[database: number, dataType: string, kind: JsonShapeKind]> =
  [
    [PostgreSQL, 'boolean', 'boolean'],
    [MySQL, 'BOOLEAN', 'boolean'],
    [MySQL, 'BIT(1)', 'boolean'],
    [MSSQL, 'bit', 'boolean'],
    [SQLite, 'BOOL', 'boolean'],
    [PostgreSQL, 'integer', 'integer'],
    [PostgreSQL, 'oid', 'integer'],
    [MySQL, 'BIT(8)', 'integer'],
    [PostgreSQL, 'real', 'number'],
    [MySQL, 'DOUBLE', 'number'],
    [MariaDB, 'NUMBER', 'number'],
    [SQLite, 'DECIMAL(10,2)', 'number'],
    [SQLite, 'NUMERIC', 'number'],
    [PostgreSQL, 'numeric(10,2)', 'string'],
    [PostgreSQL, 'money', 'string'],
    [MSSQL, 'smallmoney', 'string'],
    [Oracle, 'NUMBER(10,2)', 'string'],
    [Snowflake, 'NUMBER(38,2)', 'string'],
    [MySQL, 'DECIMAL(10,2) UNSIGNED', 'string'],
    [PostgreSQL, 'text', 'string'],
    [PostgreSQL, 'xid', 'string'],
    [PostgreSQL, 'cid', 'string'],
    [PostgreSQL, 'xid8', 'string'],
    [PostgreSQL, 'timetz', 'string'],
    [PostgreSQL, 'time with time zone', 'string'],
    [PostgreSQL, 'interval', 'string'],
    [Oracle, 'INTERVAL DAY(2) TO SECOND(6)', 'string'],
    [PostgreSQL, 'bit(8)', 'string'],
    [PostgreSQL, 'varbit', 'string'],
    [PostgreSQL, 'inet', 'string'],
    [PostgreSQL, 'macaddr', 'string'],
    [PostgreSQL, 'pg_lsn', 'string'],
    [MySQL, "SET('r','w')", 'string'],
    [MySQL, 'SET', 'string'],
    [MySQL, 'ENUM', 'string'],
    [Databricks, 'STRING', 'string'],
    [PostgreSQL, 'uuid', 'uuid'],
    [MariaDB, 'UUID', 'uuid'],
    [MSSQL, 'uniqueidentifier', 'guid'],
    [PostgreSQL, 'date', 'date'],
    [MySQL, 'TIME', 'time'],
    [SQLite, 'TIME', 'time'],
    [PostgreSQL, 'timestamp', 'naiveDateTime'],
    [MySQL, 'DATETIME(6)', 'naiveDateTime'],
    [MSSQL, 'datetime2(7)', 'naiveDateTime'],
    [Oracle, 'DATE', 'naiveDateTime'],
    [SQLite, 'TIMESTAMP', 'naiveDateTime'],
    [Snowflake, 'TIMESTAMP_NTZ', 'naiveDateTime'],
    [Databricks, 'TIMESTAMP_NTZ', 'naiveDateTime'],
    [PostgreSQL, 'timestamptz(3)', 'offsetDateTime'],
    [MySQL, 'TIMESTAMP', 'offsetDateTime'],
    [MSSQL, 'datetimeoffset', 'offsetDateTime'],
    [Oracle, 'TIMESTAMP(6) WITH LOCAL TIME ZONE', 'offsetDateTime'],
    [Snowflake, 'TIMESTAMP_TZ(3)', 'offsetDateTime'],
    [Databricks, 'TIMESTAMP', 'offsetDateTime'],
    [PostgreSQL, 'bytea', 'base64'],
    [MySQL, 'CHAR(16) BYTE', 'base64'],
    [MSSQL, 'rowversion', 'base64'],
    [Oracle, 'RAW(16)', 'base64'],
    [PostgreSQL, 'jsonb', 'json'],
    [MySQL, 'JSON', 'json'],
    [Snowflake, 'VARIANT', 'json'],
    [Snowflake, 'OBJECT(city VARCHAR)', 'json'],
    [Databricks, 'STRUCT<a:INT>', 'json'],
    [MySQL, "ENUM('a','b')", 'enum'],
    [PostgreSQL, "enum('draft','published')", 'enum'],
    [MariaDB, 'INET4', 'ipv4'],
    [MariaDB, 'INET6', 'ipv6'],
    [Databricks, 'VOID', 'null'],
  ];

const RANGES: Array<
  [
    database: number,
    dataType: string,
    minimum: number | null,
    maximum: number | null,
  ]
> = [
  [MySQL, 'TINYINT', -128, 127],
  [MySQL, 'TINYINT(1)', -128, 127],
  [MySQL, 'TINYINT UNSIGNED', 0, 255],
  [MySQL, 'SMALLINT', -32768, 32767],
  [MySQL, 'SMALLINT UNSIGNED', 0, 65535],
  [MySQL, 'YEAR', 0, 65535],
  [MySQL, 'MEDIUMINT', -8388608, 8388607],
  [MariaDB, 'MEDIUMINT UNSIGNED', 0, 16777215],
  [MySQL, 'INT', -2147483648, 2147483647],
  [MySQL, 'INT UNSIGNED', 0, 4294967295],
  [MySQL, 'INT(11) ZEROFILL', 0, 4294967295],
  [MySQL, 'BIGINT', null, null],
  [MySQL, 'BIGINT UNSIGNED', 0, null],
  [MySQL, 'SERIAL', 0, null],
  [MySQL, 'BIT(8)', 0, null],
  [PostgreSQL, 'smallserial', -32768, 32767],
  [PostgreSQL, 'serial', -2147483648, 2147483647],
  [PostgreSQL, 'bigserial', null, null],
  [PostgreSQL, 'oid', 0, 4294967295],
  [MSSQL, 'tinyint', 0, 255],
  [Databricks, 'BYTE', -128, 127],
  [Databricks, 'SHORT', -32768, 32767],
  [Databricks, 'LONG', null, null],
  [Oracle, 'NUMBER', null, null],
  [Oracle, 'NUMBER(9)', null, null],
  [Oracle, 'INTEGER', null, null],
  [Oracle, 'SMALLINT', null, null],
  [Snowflake, 'TINYINT', null, null],
  [Snowflake, 'INT', null, null],
  [SQLite, 'INTEGER', null, null],
  [SQLite, 'TINYINT', null, null],
];

function shape(overrides: Partial<JsonShape>): JsonShape {
  return {
    kind: 'string',
    minimum: null,
    maximum: null,
    maxLength: null,
    members: [],
    arrayDepth: 0,
    ...overrides,
  };
}

describe('getJsonShape', () => {
  it.each(KINDS)('reads %i %s as %s', (database, dataType, kind) => {
    expect(getJsonShape(dataType, database).kind).toBe(kind);
  });

  it.each(RANGES)(
    'bounds %i %s from %s to %s',
    (database, dataType, minimum, maximum) => {
      const { kind, ...range } = getJsonShape(dataType, database);

      expect(kind).toBe('integer');
      expect([range.minimum, range.maximum]).toEqual([minimum, maximum]);
    }
  );

  it('leaves every bound off what is no integer', () => {
    expect(getJsonShape('real', PostgreSQL)).toEqual(shape({ kind: 'number' }));
    expect(getJsonShape('xid', PostgreSQL)).toEqual(shape({ kind: 'string' }));
  });

  it("gives a character type's declared length as its greatest", () => {
    expect(getJsonShape('varchar(255)', PostgreSQL).maxLength).toBe(255);
    expect(getJsonShape('char(10)', MySQL).maxLength).toBe(10);
    expect(getJsonShape('bpchar(5)', PostgreSQL).maxLength).toBe(5);
    expect(getJsonShape('nvarchar(100)', MSSQL).maxLength).toBe(100);
    expect(getJsonShape('VARCHAR2(100 BYTE)', Oracle).maxLength).toBe(100);
    expect(getJsonShape('NVARCHAR2(50)', Oracle).maxLength).toBe(50);
    expect(getJsonShape('STRING(100)', Snowflake).maxLength).toBe(100);
    expect(getJsonShape('TEXT(50)', Snowflake).maxLength).toBe(50);
    expect(getJsonShape('VARCHAR(255)', SQLite).maxLength).toBe(255);
  });

  it('gives no length where none is declared or it is no character count', () => {
    expect(getJsonShape('nvarchar(max)', MSSQL).maxLength).toBeNull();
    expect(getJsonShape('text', PostgreSQL).maxLength).toBeNull();
    expect(getJsonShape('varbinary(16)', MSSQL).maxLength).toBeNull();
    expect(getJsonShape('bit(8)', PostgreSQL).maxLength).toBeNull();
    expect(getJsonShape('numeric(10,2)', PostgreSQL).maxLength).toBeNull();
    expect(getJsonShape('TEXT(50)', Databricks).maxLength).toBeNull();
  });

  it("lists an ENUM's members once each, in their order", () => {
    expect(getJsonShape("ENUM('b','a','b')", MySQL)).toEqual(
      shape({ kind: 'enum', members: ['b', 'a'] })
    );
    expect(getJsonShape("ENUM('it''s','a\\'b','')", MariaDB).members).toEqual([
      "it's",
      "a'b",
      '',
    ]);
    expect(getJsonShape("SET('r','w')", MySQL).members).toEqual([]);
  });

  it('drops the spaces MySQL and MariaDB drop from the end of a member', () => {
    expect(getJsonShape("ENUM('a ','b','c  ')", MySQL).members).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(
      getJsonShape("ENUM(' lead','tab\\t','mix \\t ','  ','nb\u00A0')", MariaDB)
        .members
    ).toEqual([' lead', 'tab\t', 'mix \t', '', 'nb\u00A0']);
    expect(getJsonShape("ENUM('a','a ','b')", MySQL).members).toEqual([
      'a',
      'b',
    ]);
  });

  it('keeps the spaces ending a member on any other database', () => {
    expect(getJsonShape("enum('a ','b')", PostgreSQL).members).toEqual([
      'a ',
      'b',
    ]);
  });

  it('wraps a PostgreSQL array once a dimension, listed element or not', () => {
    expect(getJsonShape('int[][]', PostgreSQL)).toEqual(
      shape({
        kind: 'integer',
        minimum: -2147483648,
        maximum: 2147483647,
        arrayDepth: 2,
      })
    );
    expect(getJsonShape('varchar(20)[]', PostgreSQL)).toEqual(
      shape({ maxLength: 20, arrayDepth: 1 })
    );
    expect(getJsonShape('"mood"[]', PostgreSQL)).toEqual(
      shape({ arrayDepth: 1 })
    );
    expect(getJsonShape('integer ARRAY', PostgreSQL).arrayDepth).toBe(1);
    expect(getJsonShape('int[]', MySQL).arrayDepth).toBe(0);
  });
});

describe('isNullableColumn', () => {
  const column = (options: number) =>
    createColumn({ name: 'a', dataType: 'int', options });

  it('takes NULL in a column of neither flag', () => {
    expect(isNullableColumn(column(0))).toBe(true);
    expect(isNullableColumn(column(ColumnOption.autoIncrement))).toBe(true);
  });

  it('takes none in a NOT NULL column or a primary key without the flag', () => {
    expect(isNullableColumn(column(ColumnOption.notNull))).toBe(false);
    expect(isNullableColumn(column(ColumnOption.primaryKey))).toBe(false);
  });
});

describe('toTypeScriptTypeName', () => {
  it.each([
    'class',
    'enum',
    'await',
    'yield',
    'let',
    'static',
    'interface',
    'string',
    'object',
    'unknown',
    'undefined',
    'void',
    'null',
  ])('writes %s with an underscore', name => {
    expect(toTypeScriptTypeName(name)).toBe(`${name}_`);
  });

  it.each([
    'Member',
    'type',
    'from',
    'as',
    'z',
    'intrinsic',
    'Object',
    'String',
    'order items',
    '2fa',
    '회원',
    '',
  ])('writes %j as is', name => {
    expect(toTypeScriptTypeName(name)).toBe(name);
  });
});

describe('toTypeScriptPropertyKey', () => {
  it.each([
    'id',
    'createdAt',
    '$ref',
    '_x',
    'class',
    'default',
    '주소1',
    'a\u200Db',
    'a\u200Cb',
    '\u{31350}',
    'x\u{11F04}',
  ])('writes the identifier name %s bare', name => {
    expect(toTypeScriptPropertyKey(name)).toBe(name);
  });

  it.each([
    '\u{10D4A}',
    '\u{16D40}y',
    'x\u{10D4A}',
    'x\u1C89',
    '\uA7CB',
    'x\u0897',
    '\u{2B73A}',
  ])('quotes %s, a letter newer than TypeScript knows', name => {
    expect(toTypeScriptPropertyKey(name)).toBe(JSON.stringify(name));
  });

  // Planes 4 to 13 are unassigned and planes 15 and 16 private use, so no
  // identifier character lies outside the first four planes and plane 14.
  it.each([0x0, 0x1, 0x2, 0x3, 0xe])(
    'writes a key bare exactly where TypeScript reads an identifier, plane %i',
    plane => {
      const { isIdentifierPart, isIdentifierStart, ScriptTarget } = ts;
      const misread: string[] = [];
      const first = plane * 0x10000;

      for (let codePoint = first; codePoint < first + 0x10000; codePoint++) {
        const character = String.fromCodePoint(codePoint);
        const part = isIdentifierPart(codePoint, ScriptTarget.ESNext);
        const partBare =
          toTypeScriptPropertyKey(`a${character}`) === `a${character}`;

        // What continues no identifier in either reading starts none either.
        if (
          partBare !== part ||
          (part &&
            (toTypeScriptPropertyKey(character) === character) !==
              isIdentifierStart(codePoint, ScriptTarget.ESNext))
        ) {
          misread.push(codePoint.toString(16));
        }
      }
      expect(misread).toEqual([]);
    }
  );

  it.each([
    ['order-no', '"order-no"'],
    ['a b', '"a b"'],
    ['2fa_enabled', '"2fa_enabled"'],
    ['', '""'],
    ['q"t\\b', '"q\\"t\\\\b"'],
    ['__proto__', '__proto__'],
  ])('writes %j as %s', (name, key) => {
    expect(toTypeScriptPropertyKey(name)).toBe(key);
  });
});
