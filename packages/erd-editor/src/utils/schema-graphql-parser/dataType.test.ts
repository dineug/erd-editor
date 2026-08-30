import { describe, expect, it } from 'vite-plus/test';

import { Database, DatabaseList } from '@/constants/schema';
import { DatabaseHintMap, PrimitiveType } from '@/constants/sql/dataType';
import { getPrimitiveType } from '@/utils/generator-code/utils';

import { enumCommentSuffix, resolveDataType } from './dataType';
import { GraphQLModel } from './types';

function createModel(model: Partial<GraphQLModel> = {}): GraphQLModel {
  return {
    tables: [],
    enums: {},
    customScalars: [],
    unions: {},
    skipped: [],
    ...model,
  };
}

const EMPTY_MODEL = createModel();

const DATABASE_NAMES: Record<number, string> = {
  [Database.MariaDB]: 'MariaDB',
  [Database.MSSQL]: 'MSSQL',
  [Database.MySQL]: 'MySQL',
  [Database.Oracle]: 'Oracle',
  [Database.PostgreSQL]: 'PostgreSQL',
  [Database.SQLite]: 'SQLite',
  [Database.Databricks]: 'Databricks',
  [Database.Snowflake]: 'Snowflake',
};

const STRING_TYPES: Record<number, string> = {
  [Database.MariaDB]: 'VARCHAR(255)',
  [Database.MSSQL]: 'varchar(255)',
  [Database.MySQL]: 'VARCHAR(255)',
  [Database.Oracle]: 'VARCHAR2(255)',
  [Database.PostgreSQL]: 'varchar(255)',
  [Database.SQLite]: 'TEXT',
  [Database.Databricks]: 'STRING',
  [Database.Snowflake]: 'VARCHAR(255)',
};

/** One built-in and one representative of every custom-scalar family. */
const EXPECTED: Record<number, Record<string, string>> = {
  [Database.MariaDB]: {
    ID: 'VARCHAR(255)',
    Int: 'INT',
    Float: 'DOUBLE',
    Boolean: 'BOOLEAN',
    String: 'VARCHAR(255)',
    Short: 'SMALLINT',
    BigInt: 'BIGINT',
    Decimal: 'DECIMAL',
    Date: 'DATE',
    Time: 'TIME',
    DateTime: 'DATETIME',
    timestamptz: 'TIMESTAMP',
    Duration: 'VARCHAR(255)',
    JSON: 'JSON',
    UUID: 'UUID',
    Bytes: 'BLOB',
    EmailAddress: 'VARCHAR(255)',
  },
  [Database.MSSQL]: {
    ID: 'varchar(255)',
    Int: 'int',
    Float: 'float',
    Boolean: 'bit',
    String: 'varchar(255)',
    Short: 'smallint',
    BigInt: 'bigint',
    Decimal: 'decimal',
    Date: 'date',
    Time: 'time',
    DateTime: 'datetime2',
    timestamptz: 'datetimeoffset',
    Duration: 'varchar(255)',
    JSON: 'json',
    UUID: 'uniqueidentifier',
    Bytes: 'varbinary(max)',
    EmailAddress: 'varchar(255)',
  },
  [Database.MySQL]: {
    ID: 'VARCHAR(255)',
    Int: 'INT',
    Float: 'DOUBLE',
    Boolean: 'BOOLEAN',
    String: 'VARCHAR(255)',
    Short: 'SMALLINT',
    BigInt: 'BIGINT',
    Decimal: 'DECIMAL',
    Date: 'DATE',
    Time: 'TIME',
    DateTime: 'DATETIME',
    timestamptz: 'TIMESTAMP',
    Duration: 'VARCHAR(255)',
    JSON: 'JSON',
    UUID: 'CHAR(36)',
    Bytes: 'BLOB',
    EmailAddress: 'VARCHAR(255)',
  },
  [Database.Oracle]: {
    ID: 'VARCHAR2(255)',
    Int: 'INTEGER',
    Float: 'BINARY_DOUBLE',
    Boolean: 'BOOLEAN',
    String: 'VARCHAR2(255)',
    Short: 'SMALLINT',
    BigInt: 'NUMBER(19)',
    Decimal: 'DECIMAL',
    Date: 'DATE',
    Time: 'VARCHAR2(255)',
    DateTime: 'TIMESTAMP',
    timestamptz: 'TIMESTAMP WITH TIME ZONE',
    Duration: 'INTERVAL DAY TO SECOND',
    JSON: 'JSON',
    UUID: 'VARCHAR2(36)',
    Bytes: 'BLOB',
    EmailAddress: 'VARCHAR2(255)',
  },
  [Database.PostgreSQL]: {
    ID: 'varchar(255)',
    Int: 'integer',
    Float: 'double precision',
    Boolean: 'boolean',
    String: 'varchar(255)',
    Short: 'smallint',
    BigInt: 'bigint',
    Decimal: 'numeric',
    Date: 'date',
    Time: 'time',
    DateTime: 'timestamp',
    timestamptz: 'timestamptz',
    Duration: 'interval',
    JSON: 'jsonb',
    UUID: 'uuid',
    Bytes: 'bytea',
    EmailAddress: 'varchar(255)',
  },
  [Database.SQLite]: {
    ID: 'TEXT',
    Int: 'INTEGER',
    Float: 'REAL',
    Boolean: 'BOOLEAN',
    String: 'TEXT',
    Short: 'SMALLINT',
    BigInt: 'BIGINT',
    Decimal: 'DECIMAL',
    Date: 'DATE',
    Time: 'TEXT',
    DateTime: 'DATETIME',
    timestamptz: 'DATETIME',
    Duration: 'TEXT',
    JSON: 'TEXT',
    UUID: 'TEXT',
    Bytes: 'BLOB',
    EmailAddress: 'TEXT',
  },
  [Database.Databricks]: {
    ID: 'STRING',
    Int: 'INT',
    Float: 'DOUBLE',
    Boolean: 'BOOLEAN',
    String: 'STRING',
    Short: 'SMALLINT',
    BigInt: 'BIGINT',
    Decimal: 'DECIMAL',
    Date: 'DATE',
    Time: 'STRING',
    DateTime: 'TIMESTAMP',
    timestamptz: 'TIMESTAMP',
    Duration: 'INTERVAL DAY TO SECOND',
    JSON: 'VARIANT',
    UUID: 'STRING',
    Bytes: 'BINARY',
    EmailAddress: 'STRING',
  },
  [Database.Snowflake]: {
    ID: 'VARCHAR(255)',
    Int: 'INT',
    Float: 'FLOAT',
    Boolean: 'BOOLEAN',
    String: 'VARCHAR(255)',
    Short: 'SMALLINT',
    BigInt: 'BIGINT',
    Decimal: 'DECIMAL',
    Date: 'DATE',
    Time: 'TIME',
    DateTime: 'TIMESTAMP_NTZ',
    timestamptz: 'TIMESTAMP_TZ',
    Duration: 'VARCHAR(255)',
    JSON: 'VARIANT',
    UUID: 'UUID',
    Bytes: 'BINARY',
    EmailAddress: 'VARCHAR(255)',
  },
};

/** Mirrors every key of the module's scalar table. */
const SCALAR_NAMES = [
  'ID',
  'String',
  'Boolean',
  'Int',
  'Float',
  'PositiveInt',
  'NonNegativeInt',
  'UnsignedInt',
  'Short',
  'smallint',
  'PositiveFloat',
  'NonNegativeFloat',
  'BigInt',
  'BigInteger',
  'Long',
  'int8',
  'SafeInt',
  'Decimal',
  'BigDecimal',
  'numeric',
  'money',
  'DateTime',
  'DateTimeISO',
  'LocalDateTime',
  'Timestamp',
  'timestamptz',
  'Date',
  'LocalDate',
  'Time',
  'LocalTime',
  'timetz',
  'Duration',
  'ISO8601Duration',
  'interval',
  'JSON',
  'jsonb',
  'JSONObject',
  'UUID',
  'GUID',
  'Byte',
  'Bytes',
  'bytea',
  'Binary',
  'Email',
  'EmailAddress',
  'URL',
  'URI',
  'Void',
];

/** The name a hint list would carry, with any (...) argument list dropped. */
function toHintName(dataType: string): string {
  return dataType
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase();
}

describe('resolveDataType', () => {
  for (const database of DatabaseList) {
    describe(DATABASE_NAMES[database], () => {
      it.each(Object.entries(EXPECTED[database]))(
        'maps %s to %s',
        (named, dataType) => {
          expect(resolveDataType(named, database, EMPTY_MODEL)).toBe(dataType);
        }
      );

      it('matches a custom scalar case-insensitively', () => {
        const expected = EXPECTED[database].DateTime;

        expect(resolveDataType('datetime', database, EMPTY_MODEL)).toBe(
          expected
        );
        expect(resolveDataType('DATETIME', database, EMPTY_MODEL)).toBe(
          expected
        );
      });

      it('falls back to the string type for a union', () => {
        const model = createModel({
          unions: { SearchResult: ['User', 'Post'] },
        });

        expect(resolveDataType('SearchResult', database, model)).toBe(
          STRING_TYPES[database]
        );
      });

      it('falls back to the string type for an unknown name', () => {
        expect(resolveDataType('Profile', database, EMPTY_MODEL)).toBe(
          STRING_TYPES[database]
        );
      });

      it('falls back to the string type for a declared scalar with no row', () => {
        const model = createModel({ customScalars: ['Cursor'] });

        expect(resolveDataType('Cursor', database, model)).toBe(
          STRING_TYPES[database]
        );
      });

      it('falls back to the string type for a type named after Object.prototype', () => {
        expect(resolveDataType('constructor', database, EMPTY_MODEL)).toBe(
          STRING_TYPES[database]
        );
        expect(resolveDataType('toString', database, EMPTY_MODEL)).toBe(
          STRING_TYPES[database]
        );
      });
    });
  }

  it('returns an empty string for a database outside the hint map', () => {
    expect(resolveDataType('String', 0, EMPTY_MODEL)).toBe('');
  });
});

describe('resolveDataType enum', () => {
  const model = createModel({ enums: { Role: ['ADMIN', 'USER'] } });

  it.each([Database.MySQL, Database.MariaDB])(
    'spells the members into the column type on %i',
    database => {
      expect(resolveDataType('Role', database, model)).toBe(
        "ENUM('ADMIN','USER')"
      );
    }
  );

  it.each([
    Database.MSSQL,
    Database.Oracle,
    Database.PostgreSQL,
    Database.SQLite,
    Database.Databricks,
    Database.Snowflake,
  ])('falls back to the string type on %i', database => {
    expect(resolveDataType('Role', database, model)).toBe(
      STRING_TYPES[database]
    );
  });

  it('doubles a single quote inside a member name', () => {
    const quoted = createModel({ enums: { Tone: ["O'HARA", 'PLAIN'] } });

    expect(resolveDataType('Tone', Database.MySQL, quoted)).toBe(
      "ENUM('O''HARA','PLAIN')"
    );
  });

  it('falls back to the string type when the enum has no members', () => {
    const empty = createModel({ enums: { Role: [] } });

    for (const database of DatabaseList) {
      expect(resolveDataType('Role', database, empty)).toBe(
        STRING_TYPES[database]
      );
    }
  });

  it('wins over a scalar row of the same name', () => {
    const shadowed = createModel({ enums: { Date: ['TODAY', 'TOMORROW'] } });

    expect(resolveDataType('Date', Database.MySQL, shadowed)).toBe(
      "ENUM('TODAY','TOMORROW')"
    );
    expect(resolveDataType('Date', Database.PostgreSQL, shadowed)).toBe(
      STRING_TYPES[Database.PostgreSQL]
    );
  });
});

describe('enumCommentSuffix', () => {
  const model = createModel({
    enums: { Role: ['ADMIN', 'USER'] },
    unions: { SearchResult: ['User', 'Post'] },
  });

  it('lists the enum members when no database is given', () => {
    expect(enumCommentSuffix('Role', model)).toBe(' Role: ADMIN | USER');
  });

  it.each([Database.MySQL, Database.MariaDB])(
    'is empty on %i, where the column type already holds the members',
    database => {
      expect(enumCommentSuffix('Role', model, database)).toBe('');
    }
  );

  it.each([
    Database.MSSQL,
    Database.Oracle,
    Database.PostgreSQL,
    Database.SQLite,
    Database.Databricks,
    Database.Snowflake,
  ])('lists the enum members on %i', database => {
    expect(enumCommentSuffix('Role', model, database)).toBe(
      ' Role: ADMIN | USER'
    );
  });

  it('lists the union members on every dialect', () => {
    expect(enumCommentSuffix('SearchResult', model)).toBe(
      ' SearchResult: User | Post'
    );

    for (const database of DatabaseList) {
      expect(enumCommentSuffix('SearchResult', model, database)).toBe(
        ' SearchResult: User | Post'
      );
    }
  });

  it('is empty for a scalar, an unknown name and an empty enum', () => {
    expect(enumCommentSuffix('DateTime', model)).toBe('');
    expect(enumCommentSuffix('Profile', model)).toBe('');
    expect(enumCommentSuffix('constructor', model)).toBe('');
    expect(
      enumCommentSuffix('Role', createModel({ enums: { Role: [] } }))
    ).toBe('');
  });
});

describe('hint list coverage', () => {
  it.each(DatabaseList)(
    'emits only names listed in the %i hint list',
    database => {
      const hintNames = new Set(
        DatabaseHintMap[database].map(hint => hint.name.toLowerCase())
      );
      const model = createModel({
        enums: { Role: ['ADMIN', 'USER'] },
        unions: { SearchResult: ['User', 'Post'] },
      });
      const emitted = [
        ...SCALAR_NAMES.map(named => resolveDataType(named, database, model)),
        resolveDataType('Role', database, model),
        resolveDataType('SearchResult', database, model),
        resolveDataType('Unknown', database, model),
      ];

      for (const dataType of emitted) {
        expect(hintNames).toContain(toHintName(dataType));
      }
    }
  );

  it.each(DatabaseList)(
    'keeps the numeric and temporal primitives on %i',
    database => {
      const primitiveOf = (named: string) =>
        getPrimitiveType(
          resolveDataType(named, database, EMPTY_MODEL),
          database
        );

      expect(primitiveOf('Int')).toBe(PrimitiveType.int);
      expect(primitiveOf('Short')).toBe(PrimitiveType.int);
      expect(primitiveOf('BigInt')).toBe(PrimitiveType.long);
      expect(primitiveOf('Float')).toBe(PrimitiveType.double);
      expect(primitiveOf('Decimal')).toBe(PrimitiveType.decimal);
      expect(primitiveOf('Date')).toBe(PrimitiveType.date);
      expect(primitiveOf('DateTime')).toBe(PrimitiveType.dateTime);
      expect(primitiveOf('timestamptz')).toBe(PrimitiveType.dateTime);
      expect(primitiveOf('String')).toBe(PrimitiveType.string);
      expect(primitiveOf('UUID')).toBe(PrimitiveType.string);
    }
  );

  it('resolves an ENUM column back to the string primitive', () => {
    const model = createModel({ enums: { Role: ['ADMIN', 'USER'] } });

    for (const database of [Database.MySQL, Database.MariaDB]) {
      expect(
        getPrimitiveType(resolveDataType('Role', database, model), database)
      ).toBe(PrimitiveType.string);
    }
  });
});
