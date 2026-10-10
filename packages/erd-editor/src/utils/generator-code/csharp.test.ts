import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { MSSQLTypes } from '@/constants/sql/dataType/MSSQL';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/csharp';

type ColumnInput = {
  name: string;
  dataType?: string;
  comment?: string;
  options?: number;
};

type TableInput = {
  id: string;
  name: string;
  comment?: string;
  columns?: ColumnInput[];
};

type VendorCase = [
  vendor: string,
  database: number,
  dataType: string,
  expected: string,
];

function createState(): RootState {
  return {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;
}

function addTable(
  state: RootState,
  { id, name, comment = '', columns = [] }: TableInput
): Table {
  const entities = columns.map((column, index) =>
    createColumn({
      id: `${id}-c${index}`,
      tableId: id,
      name: column.name,
      dataType: column.dataType ?? '',
      comment: column.comment ?? '',
      options: column.options ?? 0,
    })
  );
  const table = createTable({
    id,
    name,
    comment,
    columnIds: entities.map(column => column.id),
  });

  state.collections.tableEntities[table.id] = table;
  entities.forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });
  state.doc.tableIds.push(table.id);

  return table;
}

function formatTableLines(
  database: number,
  input: Omit<TableInput, 'id'>
): string[] {
  const state = createState();
  state.settings.database = database;
  const table = addTable(state, { id: 't', ...input });
  const buffer: string[] = [];

  formatTable(state, { buffer, table });

  return buffer;
}

function propertyLine(database: number, dataType: string): string {
  return formatTableLines(database, {
    name: 'types',
    columns: [{ name: 'value', dataType }],
  })[1];
}

const MSSQL_TYPES: Array<[string, string]> = [
  ['bigint', 'long'],
  ['binary varying', 'byte[]'],
  ['binary', 'byte[]'],
  ['bit', 'bool'],
  ['char varying', 'string'],
  ['char', 'string'],
  ['character varying', 'string'],
  ['character', 'string'],
  ['date', 'DateTime'],
  ['datetime', 'DateTime'],
  ['datetime2', 'DateTime'],
  ['datetimeoffset', 'DateTimeOffset'],
  ['dec', 'decimal'],
  ['decimal', 'decimal'],
  ['double precision', 'double'],
  ['float', 'double'],
  ['geography', 'string'],
  ['geometry', 'string'],
  ['hierarchyid', 'string'],
  ['image', 'byte[]'],
  ['int', 'int'],
  ['integer', 'int'],
  ['json', 'string'],
  ['money', 'decimal'],
  ['national char varying', 'string'],
  ['national char', 'string'],
  ['national character varying', 'string'],
  ['national character', 'string'],
  ['national text', 'string'],
  ['nchar', 'string'],
  ['ntext', 'string'],
  ['numeric', 'decimal'],
  ['nvarchar', 'string'],
  ['real', 'float'],
  ['rowversion', 'byte[]'],
  ['smalldatetime', 'DateTime'],
  ['smallint', 'short'],
  ['smallmoney', 'decimal'],
  ['sql_variant', 'object'],
  ['text', 'string'],
  ['time', 'TimeSpan'],
  ['timestamp', 'byte[]'],
  ['tinyint', 'byte'],
  ['uniqueidentifier', 'Guid'],
  ['varbinary', 'byte[]'],
  ['varchar', 'string'],
  ['vector', 'string'],
  ['xml', 'string'],
];

const VENDOR_TYPES: VendorCase[] = [
  ['PostgreSQL', Database.PostgreSQL, 'bytea', 'byte[]'],
  ['PostgreSQL', Database.PostgreSQL, 'uuid', 'Guid'],
  ['PostgreSQL', Database.PostgreSQL, 'timestamptz', 'DateTimeOffset'],
  [
    'PostgreSQL',
    Database.PostgreSQL,
    'timestamp(3) with time zone',
    'DateTimeOffset',
  ],
  [
    'PostgreSQL',
    Database.PostgreSQL,
    'timestamp without time zone',
    'DateTime',
  ],
  ['PostgreSQL', Database.PostgreSQL, 'timestamp', 'DateTime'],
  ['PostgreSQL', Database.PostgreSQL, 'smallint', 'short'],
  ['PostgreSQL', Database.PostgreSQL, 'integer', 'int'],
  ['PostgreSQL', Database.PostgreSQL, 'bigint', 'long'],
  ['PostgreSQL', Database.PostgreSQL, 'numeric(10, 2)', 'decimal'],
  ['PostgreSQL', Database.PostgreSQL, 'real', 'float'],
  ['PostgreSQL', Database.PostgreSQL, 'double precision', 'double'],
  ['PostgreSQL', Database.PostgreSQL, 'boolean', 'bool'],
  ['PostgreSQL', Database.PostgreSQL, 'date', 'DateTime'],
  ['PostgreSQL', Database.PostgreSQL, 'time', 'TimeSpan'],
  ['PostgreSQL', Database.PostgreSQL, 'time without time zone', 'TimeSpan'],
  ['PostgreSQL', Database.PostgreSQL, 'interval day to second', 'TimeSpan'],
  ['PostgreSQL', Database.PostgreSQL, 'jsonb', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'xml', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'text', 'string'],
  ['MySQL', Database.MySQL, 'BLOB', 'byte[]'],
  ['MySQL', Database.MySQL, 'TINYBLOB', 'byte[]'],
  ['MySQL', Database.MySQL, 'MEDIUMBLOB', 'byte[]'],
  ['MySQL', Database.MySQL, 'LONGBLOB', 'byte[]'],
  ['MySQL', Database.MySQL, 'BINARY(16)', 'byte[]'],
  ['MySQL', Database.MySQL, 'VARBINARY(255)', 'byte[]'],
  ['MySQL', Database.MySQL, 'LONG VARBINARY', 'byte[]'],
  ['MySQL', Database.MySQL, 'CHAR(16) BYTE', 'byte[]'],
  ['MySQL', Database.MySQL, 'SMALLINT', 'short'],
  ['MySQL', Database.MySQL, 'INT', 'int'],
  ['MySQL', Database.MySQL, 'BIGINT', 'long'],
  ['MySQL', Database.MySQL, 'DECIMAL(10,2)', 'decimal'],
  ['MySQL', Database.MySQL, 'FLOAT', 'float'],
  ['MySQL', Database.MySQL, 'DOUBLE', 'double'],
  ['MySQL', Database.MySQL, 'BOOLEAN', 'bool'],
  ['MySQL', Database.MySQL, 'DATETIME(6)', 'DateTime'],
  ['MySQL', Database.MySQL, 'JSON', 'string'],
  ['MySQL', Database.MySQL, 'GEOMETRY', 'string'],
  ['MySQL', Database.MySQL, 'LONGTEXT', 'string'],
  ['Oracle', Database.Oracle, 'RAW(16)', 'byte[]'],
  ['Oracle', Database.Oracle, 'LONG RAW', 'byte[]'],
  ['Oracle', Database.Oracle, 'BLOB', 'byte[]'],
  ['Oracle', Database.Oracle, 'BFILE', 'byte[]'],
  ['Oracle', Database.Oracle, 'TIMESTAMP(6) WITH TIME ZONE', 'DateTimeOffset'],
  ['Oracle', Database.Oracle, 'TIMESTAMP', 'DateTime'],
  ['Oracle', Database.Oracle, 'DATE', 'DateTime'],
  ['Oracle', Database.Oracle, 'NUMBER', 'long'],
  ['Oracle', Database.Oracle, 'INTERVAL DAY(2) TO SECOND(6)', 'TimeSpan'],
  ['Oracle', Database.Oracle, 'CLOB', 'string'],
  ['Oracle', Database.Oracle, 'XMLType', 'string'],
  ['SQLite', Database.SQLite, 'BLOB', 'byte[]'],
  ['SQLite', Database.SQLite, 'INTEGER', 'long'],
  ['SQLite', Database.SQLite, 'REAL', 'double'],
  ['SQLite', Database.SQLite, 'NUMERIC', 'decimal'],
  ['SQLite', Database.SQLite, 'BOOLEAN', 'bool'],
  ['SQLite', Database.SQLite, 'DATETIME', 'DateTime'],
  ['SQLite', Database.SQLite, 'TEXT', 'string'],
  ['Snowflake', Database.Snowflake, 'BINARY', 'byte[]'],
  ['Snowflake', Database.Snowflake, 'VARBINARY', 'byte[]'],
  ['Snowflake', Database.Snowflake, 'UUID', 'Guid'],
  ['Snowflake', Database.Snowflake, 'TIMESTAMP_TZ(9)', 'DateTimeOffset'],
  ['Snowflake', Database.Snowflake, 'TIMESTAMPTZ', 'DateTimeOffset'],
  [
    'Snowflake',
    Database.Snowflake,
    'TIMESTAMP WITH TIME ZONE',
    'DateTimeOffset',
  ],
  ['Snowflake', Database.Snowflake, 'TIMESTAMP_NTZ', 'DateTime'],
  ['Snowflake', Database.Snowflake, 'NUMBER(38, 0)', 'long'],
  ['Snowflake', Database.Snowflake, 'VARIANT', 'string'],
  ['Snowflake', Database.Snowflake, 'GEOGRAPHY', 'string'],
  ['Snowflake', Database.Snowflake, 'TIME', 'TimeSpan'],
  ['MariaDB', Database.MariaDB, 'UUID', 'Guid'],
  ['MariaDB', Database.MariaDB, 'RAW(16)', 'byte[]'],
  ['MariaDB', Database.MariaDB, 'CHAR BYTE', 'byte[]'],
  ['Databricks', Database.Databricks, 'BINARY', 'byte[]'],
  ['Databricks', Database.Databricks, 'SMALLINT', 'short'],
];

const OUTSIDE_MSSQL_TYPES: VendorCase[] = [
  ['MySQL', Database.MySQL, 'TIMESTAMP', 'DateTime'],
  ['PostgreSQL', Database.PostgreSQL, 'timestamp(6)', 'DateTime'],
  ['MySQL', Database.MySQL, 'TINYINT', 'int'],
  ['MySQL', Database.MySQL, 'BIT(1)', 'int'],
  ['PostgreSQL', Database.PostgreSQL, 'rowversion', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'sql_variant', 'string'],
];

const NAMES_OF_OTHER_DATABASES: VendorCase[] = [
  ['PostgreSQL', Database.PostgreSQL, 'uniqueidentifier', 'Guid'],
  ['MySQL', Database.MySQL, 'datetimeoffset', 'DateTimeOffset'],
  ['SQLite', Database.SQLite, 'image', 'byte[]'],
  ['MySQL', Database.MySQL, 'bytea', 'byte[]'],
];

const OTHER_TWO_BYTE_INTEGERS: VendorCase[] = [
  ['PostgreSQL', Database.PostgreSQL, 'int2', 'int'],
  ['PostgreSQL', Database.PostgreSQL, 'serial2', 'int'],
  ['PostgreSQL', Database.PostgreSQL, 'smallserial', 'int'],
  ['MySQL', Database.MySQL, 'INT2', 'int'],
  ['MariaDB', Database.MariaDB, 'INT2', 'int'],
  ['SQLite', Database.SQLite, 'INT2', 'long'],
  ['Databricks', Database.Databricks, 'SHORT', 'int'],
];

const SIXTY_FOUR_BIT_INTEGERS: VendorCase[] = [
  ['Oracle', Database.Oracle, 'INT', 'long'],
  ['Oracle', Database.Oracle, 'INTEGER', 'long'],
  ['Oracle', Database.Oracle, 'NUMBER(10)', 'long'],
  ['Oracle', Database.Oracle, 'NUMBER(10,0)', 'long'],
  ['Oracle', Database.Oracle, 'SMALLINT', 'long'],
  ['Snowflake', Database.Snowflake, 'INT', 'long'],
  ['Snowflake', Database.Snowflake, 'INTEGER', 'long'],
  ['Snowflake', Database.Snowflake, 'TINYINT', 'long'],
  ['Snowflake', Database.Snowflake, 'BYTEINT', 'long'],
  ['Snowflake', Database.Snowflake, 'SMALLINT', 'long'],
  ['SQLite', Database.SQLite, 'INT', 'long'],
  ['SQLite', Database.SQLite, 'TINYINT', 'long'],
  ['SQLite', Database.SQLite, 'MEDIUMINT', 'long'],
  ['SQLite', Database.SQLite, 'SMALLINT', 'long'],
];

const UNSIGNED_INTEGERS: VendorCase[] = [
  ['MySQL', Database.MySQL, 'TINYINT UNSIGNED', 'byte'],
  ['MySQL', Database.MySQL, 'TINYINT(3) UNSIGNED', 'byte'],
  ['MySQL', Database.MySQL, 'SMALLINT UNSIGNED', 'ushort'],
  ['MySQL', Database.MySQL, 'SMALLINT(5) UNSIGNED ZEROFILL', 'ushort'],
  ['MySQL', Database.MySQL, 'MEDIUMINT UNSIGNED', 'uint'],
  ['MySQL', Database.MySQL, 'INT UNSIGNED', 'uint'],
  ['MySQL', Database.MySQL, 'INT(10) UNSIGNED', 'uint'],
  ['MySQL', Database.MySQL, 'INT(11) ZEROFILL', 'uint'],
  ['MySQL', Database.MySQL, 'BIGINT UNSIGNED', 'ulong'],
  ['MySQL', Database.MySQL, 'SERIAL', 'ulong'],
  ['MariaDB', Database.MariaDB, 'int unsigned', 'uint'],
  ['MariaDB', Database.MariaDB, 'BIGINT(20) UNSIGNED', 'ulong'],
  ['MariaDB', Database.MariaDB, 'INT1 UNSIGNED', 'byte'],
];

const SIGNED_OR_NOT_AN_INTEGER: VendorCase[] = [
  ['MySQL', Database.MySQL, 'TINYINT', 'int'],
  ['MySQL', Database.MySQL, 'MEDIUMINT', 'int'],
  ['MySQL', Database.MySQL, 'YEAR', 'int'],
  ['MySQL', Database.MySQL, 'SMALLINT SIGNED', 'short'],
  ['MySQL', Database.MySQL, 'SMALLINT(6) SIGNED', 'short'],
  ['MariaDB', Database.MariaDB, 'smallint signed', 'short'],
  ['MySQL', Database.MySQL, 'INT SIGNED', 'int'],
  ['MySQL', Database.MySQL, 'BIGINT SIGNED', 'long'],
  ['MySQL', Database.MySQL, 'DECIMAL(10,2) UNSIGNED', 'decimal'],
  ['MySQL', Database.MySQL, 'DOUBLE UNSIGNED', 'double'],
  ['PostgreSQL', Database.PostgreSQL, 'INT UNSIGNED', 'int'],
];

const FIXED_OUTSIDE_SQL_SERVER: VendorCase[] = [
  ['PostgreSQL', Database.PostgreSQL, 'money', 'decimal'],
  ['MySQL', Database.MySQL, 'money', 'decimal'],
  ['PostgreSQL', Database.PostgreSQL, 'bit(8)', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'bit varying(8)', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'varbit', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'pg_lsn', 'ulong'],
  ['MySQL', Database.MySQL, 'pg_lsn', 'string'],
  ['MySQL', Database.MySQL, 'FLOAT(24)', 'float'],
  ['MySQL', Database.MySQL, 'FLOAT(25)', 'double'],
  ['MySQL', Database.MySQL, 'FLOAT(53)', 'double'],
  ['MariaDB', Database.MariaDB, 'FLOAT(53)', 'double'],
  ['PostgreSQL', Database.PostgreSQL, 'float(24)', 'float'],
  ['PostgreSQL', Database.PostgreSQL, 'float(53)', 'double'],
  ['Oracle', Database.Oracle, 'NUMBER(10,2)', 'decimal'],
  ['Oracle', Database.Oracle, 'NUMBER(*,2)', 'decimal'],
  ['Snowflake', Database.Snowflake, 'NUMBER(38,2)', 'decimal'],
];

const POSTGRES_SYSTEM_IDS: VendorCase[] = [
  ['PostgreSQL', Database.PostgreSQL, 'oid', 'uint'],
  ['PostgreSQL', Database.PostgreSQL, 'cid', 'uint'],
  ['PostgreSQL', Database.PostgreSQL, 'xid', 'uint'],
  ['PostgreSQL', Database.PostgreSQL, 'xid8', 'ulong'],
  ['PostgreSQL', Database.PostgreSQL, 'OID', 'uint'],
  ['PostgreSQL', Database.PostgreSQL, 'regtype', 'uint'],
  ['PostgreSQL', Database.PostgreSQL, 'regconfig', 'uint'],
  ['PostgreSQL', Database.PostgreSQL, 'REGTYPE', 'uint'],
  ['MySQL', Database.MySQL, 'oid', 'string'],
  ['MySQL', Database.MySQL, 'regtype', 'string'],
];

const UNREADABLE_POSTGRES_IDS: VendorCase[] = [
  ['PostgreSQL', Database.PostgreSQL, 'regclass', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'regproc', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'regrole', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'regnamespace', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'regoper', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'regoperator', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'regprocedure', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'regcollation', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'regdictionary', 'string'],
];

const READ_OTHERWISE_BY_DRIVERS: VendorCase[] = [
  ['MySQL', Database.MySQL, 'CHAR(36)', 'string'],
  ['MariaDB', Database.MariaDB, 'char(36)', 'string'],
  ['MySQL', Database.MySQL, 'TINYINT(1)', 'int'],
  ['MariaDB', Database.MariaDB, 'tinyint(1)', 'int'],
  ['Oracle', Database.Oracle, 'INTERVAL YEAR(2) TO MONTH', 'TimeSpan'],
  ['SQLite', Database.SQLite, 'TIME', 'TimeSpan'],
];

const ZONED_TIMES: VendorCase[] = [
  ['PostgreSQL', Database.PostgreSQL, 'timetz', 'DateTimeOffset'],
  ['PostgreSQL', Database.PostgreSQL, 'timetz(3)', 'DateTimeOffset'],
  ['PostgreSQL', Database.PostgreSQL, 'time with time zone', 'DateTimeOffset'],
  [
    'PostgreSQL',
    Database.PostgreSQL,
    'TIME(6) WITH TIME ZONE',
    'DateTimeOffset',
  ],
];

const MYSQL_BIT_FIELDS: VendorCase[] = [
  ['MySQL', Database.MySQL, 'BIT(2)', 'ulong'],
  ['MySQL', Database.MySQL, 'BIT(8)', 'ulong'],
  ['MySQL', Database.MySQL, 'BIT(64)', 'ulong'],
  ['MariaDB', Database.MariaDB, 'bit(32)', 'ulong'],
];

const MYSQL_ONE_BIT: VendorCase[] = [
  ['MySQL', Database.MySQL, 'BIT', 'int'],
  ['MariaDB', Database.MariaDB, 'bit(1)', 'int'],
];

const MARIADB_NUMBERS: VendorCase[] = [
  ['MariaDB', Database.MariaDB, 'NUMBER', 'double'],
  ['MariaDB', Database.MariaDB, 'number', 'double'],
  ['MariaDB', Database.MariaDB, 'NUMBER(10)', 'decimal'],
  ['MariaDB', Database.MariaDB, 'NUMBER(10,2)', 'decimal'],
];

function byVendor(rows: VendorCase[]) {
  return rows.map(([vendor, database, dataType, expected]) => ({
    vendor,
    database,
    dataType,
    expected,
  }));
}

describe('generator-code/csharp', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits classes sorted by name with table and column comments', () => {
    const state = createState();

    addTable(state, {
      id: 't-users',
      name: 'users',
      comment: 'user table',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'user id',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        },
        { name: 'nick_name', dataType: 'VARCHAR(50)' },
      ],
    });
    addTable(state, {
      id: 't-posts',
      name: 'posts',
      columns: [{ name: 'id', dataType: 'BIGINT' }],
    });

    expect(createCode(state)).toBe(
      [
        '',
        'public class Posts {',
        '  public long? Id { get; set; }',
        '}',
        '',
        '// user table',
        'public class Users {',
        '  // user id',
        '  public int Id { get; set; }',
        '  public string? NickName { get; set; }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('maps every primitive type to a C# type', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-types',
      name: 'types',
      columns: [
        { name: 'intCol', dataType: 'INT' },
        { name: 'longCol', dataType: 'BIGINT' },
        { name: 'floatCol', dataType: 'FLOAT' },
        { name: 'doubleCol', dataType: 'DOUBLE' },
        { name: 'decimalCol', dataType: 'DECIMAL(10, 2)' },
        { name: 'booleanCol', dataType: 'BOOLEAN' },
        { name: 'stringCol', dataType: 'VARCHAR(10)' },
        { name: 'lobCol', dataType: 'TEXT' },
        { name: 'dateCol', dataType: 'DATE' },
        { name: 'timeCol', dataType: 'TIME' },
        { name: 'unknownCol', dataType: 'NOT_A_TYPE' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'public class Types {',
      '  public int? IntCol { get; set; }',
      '  public long? LongCol { get; set; }',
      '  public float? FloatCol { get; set; }',
      '  public double? DoubleCol { get; set; }',
      '  public decimal? DecimalCol { get; set; }',
      '  public bool? BooleanCol { get; set; }',
      '  public string? StringCol { get; set; }',
      '  public string? LobCol { get; set; }',
      '  public DateTime? DateCol { get; set; }',
      '  public TimeSpan? TimeCol { get; set; }',
      '  public string? UnknownCol { get; set; }',
      '}',
    ]);
  });

  it('maps the dateTime primitive type to DateTime', () => {
    expect(propertyLine(Database.Oracle, 'TIMESTAMP')).toBe(
      '  public DateTime? Value { get; set; }'
    );
  });

  describe('SQL Server', () => {
    it('lists every type the SQL Server data type hints hold', () => {
      expect(MSSQL_TYPES).toHaveLength(48);
      expect(MSSQL_TYPES.map(([name]) => name).sort()).toEqual(
        MSSQLTypes.map(({ name }) => name).sort()
      );
    });

    it.each(MSSQL_TYPES)('maps %s to %s', (dataType, expected) => {
      expect(propertyLine(Database.MSSQL, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    });

    it.each([
      ['VARBINARY(MAX)', 'byte[]'],
      ['NVARCHAR(MAX)', 'string'],
      ['DATETIMEOFFSET(7)', 'DateTimeOffset'],
      ['DATETIME2(7)', 'DateTime'],
      ['TIME(7)', 'TimeSpan'],
      ['NUMERIC(18, 2)', 'decimal'],
      ['Binary  Varying(50)', 'byte[]'],
      ['ROWVERSION', 'byte[]'],
      ['VECTOR(1536)', 'string'],
    ])(
      'reads %s by its name without arguments, case or extra spaces',
      (dataType, expected) => {
        expect(propertyLine(Database.MSSQL, dataType)).toBe(
          `  public ${expected}? Value { get; set; }`
        );
      }
    );

    it.each([
      ['float(1)', 'float'],
      ['float(24)', 'float'],
      ['FLOAT( 24 )', 'float'],
      ['float(25)', 'double'],
      ['float(53)', 'double'],
      ['float', 'double'],
      ['float(0)', 'double'],
      ['float(n)', 'double'],
    ])('maps %s to %s by its precision', (dataType, expected) => {
      expect(propertyLine(Database.MSSQL, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    });
  });

  it.each(byVendor(VENDOR_TYPES))(
    'maps the $vendor type $dataType to $expected',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(OUTSIDE_MSSQL_TYPES))(
    'keeps the SQL Server reading of a name out of $vendor: $dataType stays $expected',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(NAMES_OF_OTHER_DATABASES))(
    'maps $dataType to $expected under $vendor too, a name read the same under every database',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(OTHER_TWO_BYTE_INTEGERS))(
    'maps only smallint to short: the $vendor type $dataType stays $expected',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(SIXTY_FOUR_BIT_INTEGERS))(
    'maps the $vendor type $dataType to $expected, the 64 bits it stores whatever its name declares',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(UNSIGNED_INTEGERS))(
    'maps the $vendor type $dataType to $expected, the unsigned type of its width',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(SIGNED_OR_NOT_AN_INTEGER))(
    'keeps the $vendor type $dataType as $expected, no unsigned integer',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(FIXED_OUTSIDE_SQL_SERVER))(
    'maps the $vendor type $dataType to $expected',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(POSTGRES_SYSTEM_IDS))(
    'maps the $vendor type $dataType to $expected, the unsigned type Npgsql reads',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(UNREADABLE_POSTGRES_IDS))(
    'keeps the $vendor type $dataType as $expected: Npgsql reads it neither as a string nor as a uint',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(READ_OTHERWISE_BY_DRIVERS))(
    'writes the $vendor type $dataType as $expected, which its driver or Dapper reads otherwise by default',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(ZONED_TIMES))(
    'maps the $vendor time of day with an offset $dataType to $expected, as Npgsql reads it',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(MYSQL_BIT_FIELDS))(
    'maps the $vendor bit field $dataType to $expected, the 64 bits MySqlConnector reads',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(MYSQL_ONE_BIT))(
    'keeps the $vendor one-bit field $dataType as $expected',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  it.each(byVendor(MARIADB_NUMBERS))(
    'maps the $vendor type $dataType to $expected, what its Oracle mode stores',
    ({ database, dataType, expected }) => {
      expect(propertyLine(database, dataType)).toBe(
        `  public ${expected}? Value { get; set; }`
      );
    }
  );

  describe('PostgreSQL arrays', () => {
    it.each([
      ['int[]', 'int[]'],
      ['integer ARRAY', 'int[]'],
      ['integer ARRAY[4]', 'int[]'],
      ['int[3]', 'int[]'],
      ['smallint[]', 'short[]'],
      ['bigint[]', 'long[]'],
      ['oid[]', 'uint[]'],
      ['xid8[]', 'ulong[]'],
      ['regtype[]', 'uint[]'],
      ['timetz[]', 'DateTimeOffset[]'],
      ['interval[]', 'TimeSpan[]'],
      ['numeric(10,2)[]', 'decimal[]'],
      ['money[]', 'decimal[]'],
      ['text[]', 'string[]'],
      ['"mood"[]', 'string[]'],
      ['uuid[]', 'Guid[]'],
      ['bytea[]', 'byte[][]'],
      ['int[][]', 'int[,]'],
      ['text[][]', 'string[,]'],
      ['bytea[][]', 'byte[,][]'],
      ['timestamptz[][][]', 'DateTimeOffset[,,]'],
    ])(
      'maps %s to %s, one rank a dimension in one rectangular array',
      (dataType, expected) => {
        expect(propertyLine(Database.PostgreSQL, dataType)).toBe(
          `  public ${expected}? Value { get; set; }`
        );
      }
    );

    it('writes a NOT NULL array as a reference type', () => {
      expect(
        formatTableLines(Database.PostgreSQL, {
          name: 'scores',
          columns: [
            { name: 'id', dataType: 'int', options: ColumnOption.primaryKey },
            {
              name: 'points',
              dataType: 'int[]',
              options: ColumnOption.notNull,
            },
            {
              name: 'grid',
              dataType: 'int[][]',
              options: ColumnOption.notNull,
            },
            { name: 'tags', dataType: 'text[]' },
          ],
        })
      ).toEqual([
        'public class Scores {',
        '  public int Id { get; set; }',
        '  public int[] Points { get; set; } = null!;',
        '  public int[,] Grid { get; set; } = null!;',
        '  public string[]? Tags { get; set; }',
        '}',
      ]);
    });

    it.each([
      ['MySQL', Database.MySQL],
      ['SQL Server', Database.MSSQL],
    ])(
      'reads no array outside PostgreSQL: int[] under %s stays int',
      (_, database) => {
        expect(propertyLine(database, 'int[]')).toBe(
          '  public int? Value { get; set; }'
        );
      }
    );
  });

  it('writes a NOT NULL unsigned integer as a value type', () => {
    expect(
      formatTableLines(Database.MySQL, {
        name: 'orders',
        columns: [
          {
            name: 'id',
            dataType: 'BIGINT UNSIGNED',
            options: ColumnOption.primaryKey,
          },
          {
            name: 'quantity',
            dataType: 'INT UNSIGNED',
            options: ColumnOption.notNull,
          },
          { name: 'rank', dataType: 'TINYINT UNSIGNED' },
        ],
      })
    ).toEqual([
      'public class Orders {',
      '  public ulong Id { get; set; }',
      '  public uint Quantity { get; set; }',
      '  public byte? Rank { get; set; }',
      '}',
    ]);
  });

  it('writes nullable reference types the way dotnet ef dbcontext scaffold does', () => {
    expect(
      formatTableLines(Database.MSSQL, {
        name: 'members',
        columns: [
          { name: 'id', dataType: 'int', options: ColumnOption.notNull },
          { name: 'age', dataType: 'int' },
          {
            name: 'token',
            dataType: 'uniqueidentifier',
            options: ColumnOption.notNull,
          },
          { name: 'external_id', dataType: 'uniqueidentifier' },
          { name: 'created_at', dataType: 'datetime2' },
          {
            name: 'name',
            dataType: 'nvarchar(50)',
            options: ColumnOption.notNull,
          },
          { name: 'nick_name', dataType: 'nvarchar(50)' },
          {
            name: 'version',
            dataType: 'rowversion',
            options: ColumnOption.notNull,
          },
          { name: 'photo', dataType: 'varbinary(max)' },
          {
            name: 'payload',
            dataType: 'sql_variant',
            options: ColumnOption.notNull,
          },
          { name: 'extra', dataType: 'sql_variant' },
        ],
      })
    ).toEqual([
      'public class Members {',
      '  public int Id { get; set; }',
      '  public int? Age { get; set; }',
      '  public Guid Token { get; set; }',
      '  public Guid? ExternalId { get; set; }',
      '  public DateTime? CreatedAt { get; set; }',
      '  public string Name { get; set; } = null!;',
      '  public string? NickName { get; set; }',
      '  public byte[] Version { get; set; } = null!;',
      '  public byte[]? Photo { get; set; }',
      '  public object Payload { get; set; } = null!;',
      '  public object? Extra { get; set; }',
      '}',
    ]);
  });

  it('reads a primary key as not null even without the not null flag', () => {
    expect(
      formatTableLines(Database.PostgreSQL, {
        name: 'codes',
        columns: [
          { name: 'id', dataType: 'uuid', options: ColumnOption.primaryKey },
          { name: 'code', dataType: 'text', options: ColumnOption.primaryKey },
        ],
      })
    ).toEqual([
      'public class Codes {',
      '  public Guid Id { get; set; }',
      '  public string Code { get; set; } = null!;',
      '}',
    ]);
  });

  it('writes a comment with line breaks as one line comment per line', () => {
    expect(
      formatTableLines(Database.MySQL, {
        name: 'notes',
        comment: 'first line\nsecond line',
        columns: [
          {
            name: 'body',
            dataType: 'TEXT',
            comment: 'a\r\nb\rc\u0085d\u2028e\u2029f',
          },
          { name: 'title', dataType: 'VARCHAR(20)', comment: 'top\n\nbottom' },
        ],
      })
    ).toEqual([
      '// first line',
      '// second line',
      'public class Notes {',
      '  // a',
      '  // b',
      '  // c',
      '  // d',
      '  // e',
      '  // f',
      '  public string? Body { get; set; }',
      '  // top',
      '  //',
      '  // bottom',
      '  public string? Title { get; set; }',
      '}',
    ]);
  });

  it('drops the blank lines around a comment and the trailing spaces of each line', () => {
    expect(
      formatTableLines(Database.MySQL, {
        name: 'notes',
        comment: '\r\n \nfirst line  \n\t\nsecond line\n',
        columns: [{ name: 'id', dataType: 'INT', comment: 'user id \n' }],
      })
    ).toEqual([
      '// first line',
      '//',
      '// second line',
      'public class Notes {',
      '  // user id',
      '  public int? Id { get; set; }',
      '}',
    ]);
  });

  it('writes a comment without Array.prototype.at, which the chrome91 browser floor lacks', () => {
    const at = Object.getOwnPropertyDescriptor(Array.prototype, 'at')!;
    let lines: string[];

    Reflect.deleteProperty(Array.prototype, 'at');
    try {
      lines = formatTableLines(Database.MySQL, {
        name: 'notes',
        comment: 'first line\n',
        columns: [{ name: 'id', dataType: 'INT', comment: 'user id\n\n' }],
      });
    } finally {
      Object.defineProperty(Array.prototype, 'at', at);
    }

    expect(lines).toEqual([
      '// first line',
      'public class Notes {',
      '  // user id',
      '  public int? Id { get; set; }',
      '}',
    ]);
  });

  it('writes no comment line for a blank comment', () => {
    expect(
      formatTableLines(Database.MySQL, {
        name: 'blank',
        comment: ' \n ',
        columns: [{ name: 'id', dataType: 'INT', comment: '\n' }],
      })
    ).toEqual(['public class Blank {', '  public int? Id { get; set; }', '}']);
  });

  it('applies the configured table and column name cases before upper casing the property', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.snakeCase;
    const table = addTable(state, {
      id: 't-user-profile',
      name: 'UserProfile',
      columns: [{ name: 'userId', dataType: 'INT' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'public class user_profile {',
      '  public int? User_id { get; set; }',
      '}',
    ]);
  });

  describe('C# keywords', () => {
    function classLine(name: string, tableNameCase: number): string {
      const state = createState();
      state.settings.tableNameCase = tableNameCase;
      const table = addTable(state, { id: 't', name });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      return buffer[0];
    }

    it.each([
      ['class', NameCase.none, 'public class @class {'],
      ['event', NameCase.camelCase, 'public class @event {'],
      ['object', NameCase.snakeCase, 'public class @object {'],
      ['string', NameCase.none, 'public class @string {'],
      ['while', NameCase.none, 'public class @while {'],
      ['file', NameCase.none, 'public class @file {'],
      ['required', NameCase.none, 'public class @required {'],
      ['scoped', NameCase.none, 'public class @scoped {'],
      ['extension', NameCase.none, 'public class @extension {'],
      ['record', NameCase.none, 'public class @record {'],
    ])(
      'writes the table %s, a name C# refuses for a class, after @',
      (name, tableNameCase, expected) => {
        expect(classLine(name, tableNameCase)).toBe(expected);
      }
    );

    it.each([
      ['class', NameCase.pascalCase, 'public class Class {'],
      ['Class', NameCase.none, 'public class Class {'],
      ['user', NameCase.none, 'public class user {'],
      ['var', NameCase.none, 'public class var {'],
      ['@class', NameCase.none, 'public class @class {'],
    ])(
      'writes the table %s as is where C# takes it for a class',
      (name, tableNameCase, expected) => {
        expect(classLine(name, tableNameCase)).toBe(expected);
      }
    );

    it('writes a property after @ only where its name stays a keyword', () => {
      const state = createState();
      state.settings.tableNameCase = NameCase.none;
      state.settings.columnNameCase = NameCase.none;
      const table = addTable(state, {
        id: 't',
        name: '__arglist',
        columns: [
          { name: 'class', dataType: 'INT' },
          { name: '__makeref', dataType: 'INT' },
        ],
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        'public class @__arglist {',
        '  public int? Class { get; set; }',
        '  public int? @__makeref { get; set; }',
        '}',
      ]);
    });
  });

  describe('a property named like its class', () => {
    const column = (name: string) =>
      `  [global::System.ComponentModel.DataAnnotations.Schema.Column(${name})]`;

    function namedLines(
      tableName: string,
      columnNames: string[],
      nameCase?: number
    ): string[] {
      const state = createState();
      if (nameCase !== undefined) {
        state.settings.tableNameCase = nameCase;
        state.settings.columnNameCase = nameCase;
      }
      const table = addTable(state, {
        id: 't',
        name: tableName,
        columns: columnNames.map(name => ({ name, dataType: 'INT' })),
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      return buffer;
    }

    it('renames it as dotnet ef dbcontext scaffold does, the column name in a Column attribute after its comment', () => {
      expect(
        formatTableLines(Database.MySQL, {
          name: 'country',
          columns: [
            {
              name: 'country_id',
              dataType: 'SMALLINT UNSIGNED',
              options: ColumnOption.primaryKey | ColumnOption.notNull,
            },
            {
              name: 'country',
              dataType: 'VARCHAR(50)',
              comment: 'the name',
              options: ColumnOption.notNull,
            },
            {
              name: 'last_update',
              dataType: 'TIMESTAMP',
              options: ColumnOption.notNull,
            },
          ],
        })
      ).toEqual([
        'public class Country {',
        '  public ushort CountryId { get; set; }',
        '  // the name',
        column('"country"'),
        '  public string Country1 { get; set; } = null!;',
        '  public DateTime LastUpdate { get; set; }',
        '}',
      ]);
    });

    it('numbers it past every name the class holds, a renamed one included', () => {
      expect(
        namedLines('country', ['country1', 'country', 'Country2', 'Country'])
      ).toEqual([
        'public class Country {',
        '  public int? Country1 { get; set; }',
        column('"country"'),
        '  public int? Country3 { get; set; }',
        '  public int? Country2 { get; set; }',
        column('"Country"'),
        '  public int? Country4 { get; set; }',
        '}',
      ]);
    });

    it.each([
      [
        'an @',
        '__arglist',
        '__arglist',
        'public class @__arglist {',
        '__arglist1',
      ],
      [
        'a formatting character',
        'Cou\u00adntry',
        'Country',
        'public class Cou\u00adntry {',
        'Country1',
      ],
    ])(
      'compares the names as C# does, %s aside',
      (_, tableName, columnName, classLine, propertyName) => {
        expect(namedLines(tableName, [columnName], NameCase.none)).toEqual([
          classLine,
          column(`"${columnName}"`),
          `  public int? ${propertyName} { get; set; }`,
          '}',
        ]);
      }
    );

    it('keeps a name that differs from its class in case alone', () => {
      expect(namedLines('country', ['country'], NameCase.none)).toEqual([
        'public class country {',
        '  public int? Country { get; set; }',
        '}',
      ]);
    });

    it('writes the column name as a C# string literal, escaping what JSON leaves and C# ends a line at', () => {
      expect(
        namedLines('user_profile', [
          'user"profile',
          'user\\profile',
          'user\u0085profile',
          'user\u2028profile',
        ])
      ).toEqual([
        'public class UserProfile {',
        column('"user\\"profile"'),
        '  public int? UserProfile1 { get; set; }',
        column('"user\\\\profile"'),
        '  public int? UserProfile2 { get; set; }',
        column('"user\\u0085profile"'),
        '  public int? UserProfile3 { get; set; }',
        column('"user\\u2028profile"'),
        '  public int? UserProfile4 { get; set; }',
        '}',
      ]);
    });
  });

  it('renders an empty property name for a column without a name', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-empty',
      name: '',
      columns: [{ name: '', dataType: 'VARCHAR(10)' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'public class  {',
      '  public string?  { get; set; }',
      '}',
    ]);
  });
});
