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

const VENDOR_TYPES: Array<[string, number, string, string]> = [
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
  ['PostgreSQL', Database.PostgreSQL, 'time with time zone', 'TimeSpan'],
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
  ['Oracle', Database.Oracle, 'SMALLINT', 'short'],
  ['Oracle', Database.Oracle, 'INTERVAL DAY(2) TO SECOND(6)', 'TimeSpan'],
  ['Oracle', Database.Oracle, 'CLOB', 'string'],
  ['Oracle', Database.Oracle, 'XMLType', 'string'],
  ['SQLite', Database.SQLite, 'BLOB', 'byte[]'],
  ['SQLite', Database.SQLite, 'SMALLINT', 'short'],
  ['SQLite', Database.SQLite, 'INTEGER', 'int'],
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
  ['Snowflake', Database.Snowflake, 'SMALLINT', 'short'],
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

const OUTSIDE_MSSQL_TYPES: Array<[string, number, string, string]> = [
  ['MySQL', Database.MySQL, 'TIMESTAMP', 'DateTime'],
  ['PostgreSQL', Database.PostgreSQL, 'timestamp(6)', 'DateTime'],
  ['MySQL', Database.MySQL, 'TINYINT', 'int'],
  ['MySQL', Database.MySQL, 'BIT(1)', 'int'],
  ['PostgreSQL', Database.PostgreSQL, 'rowversion', 'string'],
  ['PostgreSQL', Database.PostgreSQL, 'sql_variant', 'string'],
];

const NAMES_OF_OTHER_DATABASES: Array<[string, number, string, string]> = [
  ['PostgreSQL', Database.PostgreSQL, 'uniqueidentifier', 'Guid'],
  ['MySQL', Database.MySQL, 'datetimeoffset', 'DateTimeOffset'],
  ['SQLite', Database.SQLite, 'image', 'byte[]'],
  ['MySQL', Database.MySQL, 'bytea', 'byte[]'],
];

const OTHER_TWO_BYTE_INTEGERS: Array<[string, number, string, string]> = [
  ['PostgreSQL', Database.PostgreSQL, 'int2', 'int'],
  ['PostgreSQL', Database.PostgreSQL, 'serial2', 'int'],
  ['PostgreSQL', Database.PostgreSQL, 'smallserial', 'int'],
  ['MySQL', Database.MySQL, 'INT2', 'int'],
  ['MariaDB', Database.MariaDB, 'INT2', 'int'],
  ['SQLite', Database.SQLite, 'INT2', 'int'],
  ['Databricks', Database.Databricks, 'SHORT', 'int'],
];

function byVendor(rows: Array<[string, number, string, string]>) {
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
