import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { buildSchema, validateSchema } from 'graphql';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  Database,
  DatabaseList,
  NameCase,
  RelationshipType,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/graphql';
import { schemaGraphQLParserToSchemaJson } from '@/utils/schema-graphql-parser';
import { resolveDataType } from '@/utils/schema-graphql-parser/dataType';

type ColumnInput = {
  name: string;
  dataType?: string;
  comment?: string;
  options?: number;
  keys?: number;
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
      ui: { keys: column.keys ?? 0 },
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

function addRelationship(
  state: RootState,
  id: string,
  startTableId: string,
  endTableId: string,
  relationshipType: number = RelationshipType.ZeroN,
  endColumnIds: string[] = []
) {
  const relationship = createRelationship({
    id,
    relationshipType,
    start: { tableId: startTableId },
    end: { tableId: endTableId, columnIds: endColumnIds },
  });
  state.collections.relationshipEntities[relationship.id] = relationship;
  state.doc.relationshipIds.push(relationship.id);
  return relationship;
}

// Every case is handed to the real parser as well as compared to an expected
// string. buildSchema covers the validation rules -- duplicate type and field
// names -- that parse alone would let through.
function expectValidSDL(code: string) {
  expect(() => buildSchema(code)).not.toThrow();
}

// validateSchema holds what a server checks before it starts, the __ prefix
// GraphQL reserves among them; a generated document defines no Query type.
function expectServableSDL(code: string) {
  expectValidSDL(code);
  const errors = validateSchema(buildSchema(code))
    .map(error => error.message)
    .filter(message => message !== 'Query root type must be provided.');
  expect(errors).toEqual([]);
}

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

/** The type the generator writes for one column, checked as a servable schema. */
function fieldType(database: number, dataType: string, options = 0): string {
  const state = createState();
  state.settings.database = database;
  addTable(state, {
    id: 't-a',
    name: 'a',
    columns: [{ name: 'value', dataType, options }],
  });

  const code = createCode(state);

  expectServableSDL(code);
  return /\n {2}value: (.+)\n/.exec(code)?.[1] ?? '';
}

function importedRelationshipCount(code: string): number {
  return JSON.parse(schemaGraphQLParserToSchemaJson(code, ctx)).doc
    .relationshipIds.length;
}

const PRIMARY_KEY: ColumnInput = {
  name: 'id',
  dataType: 'INT',
  options: ColumnOption.primaryKey | ColumnOption.notNull,
  keys: ColumnUIKey.primaryKey,
};

function foreignKey(name: string): ColumnInput {
  return {
    name,
    dataType: 'INT',
    options: ColumnOption.notNull,
    keys: ColumnUIKey.foreignKey,
  };
}

/** A user and an order table, each holding its given columns after its id. */
function createOrderState(
  columns: ColumnInput[],
  userColumns: ColumnInput[] = []
): RootState {
  const state = createState();
  addTable(state, {
    id: 't-user',
    name: 'user',
    columns: [PRIMARY_KEY, ...userColumns],
  });
  addTable(state, {
    id: 't-order',
    name: 'order',
    columns: [PRIMARY_KEY, ...columns],
  });
  return state;
}

/** An employee table holding the given columns after its id. */
function createEmployeeState(columns: ColumnInput[]): RootState {
  const state = createState();
  addTable(state, {
    id: 't-employee',
    name: 'employee',
    columns: [PRIMARY_KEY, ...columns],
  });
  return state;
}

function relateUserToOrder(
  state: RootState,
  relationshipType: number,
  endColumnIds: string[]
) {
  const id = `r-${state.doc.relationshipIds.length + 1}`;
  addRelationship(
    state,
    id,
    't-user',
    't-order',
    relationshipType,
    endColumnIds
  );
}

function relateEmployeeToItself(
  state: RootState,
  relationshipType: number,
  endColumnIds: string[]
) {
  const id = `r-${state.doc.relationshipIds.length + 1}`;
  addRelationship(
    state,
    id,
    't-employee',
    't-employee',
    relationshipType,
    endColumnIds
  );
}

describe('generator-code/graphql', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits types sorted by name with comments, ID fields and relation fields', () => {
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
          keys: ColumnUIKey.primaryKey,
        },
        {
          name: 'email',
          dataType: 'VARCHAR(255)',
          options: ColumnOption.notNull,
        },
        { name: 'age', dataType: 'INT' },
      ],
    });
    addTable(state, {
      id: 't-posts',
      name: 'posts',
      columns: [
        {
          name: 'id',
          dataType: 'BIGINT',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
          keys: ColumnUIKey.primaryKey,
        },
        {
          name: 'user_id',
          dataType: 'INT',
          options: ColumnOption.notNull,
          keys: ColumnUIKey.foreignKey,
        },
        {
          name: 'title',
          dataType: 'VARCHAR(100)',
          comment: 'post title',
        },
      ],
    });
    addRelationship(state, 'r-1', 't-users', 't-posts');

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Posts {',
        '  id: ID!',
        '  """post title"""',
        '  title: String',
        '  """user table"""',
        '  users: Users',
        '}',
        '',
        '"""user table"""',
        'type Users {',
        '  """user id"""',
        '  id: ID!',
        '  email: String!',
        '  age: Int',
        '  postsList: [Posts!]!',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('renders a foreign key that is also a primary key as a nullable ID', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-a',
      name: 'a',
      columns: [
        {
          name: 'user_id',
          dataType: 'INT',
          keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['type A {', '  userId: ID', '}']);
  });

  it('maps each column type to a scalar and declares the custom ones it uses', () => {
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
        { name: 'dateTimeCol', dataType: 'DATETIME' },
        { name: 'timeCol', dataType: 'TIME' },
        { name: 'jsonCol', dataType: 'JSON' },
        { name: 'blobCol', dataType: 'BLOB' },
        { name: 'unknownCol', dataType: 'NOT_A_TYPE' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'scalar BigInt',
      'scalar Byte',
      'scalar Date',
      'scalar DateTime',
      'scalar Decimal',
      'scalar JSON',
      '',
      'type Types {',
      '  intCol: Int',
      '  longCol: BigInt',
      '  floatCol: Float',
      '  doubleCol: Float',
      '  decimalCol: Decimal',
      '  booleanCol: Boolean',
      '  stringCol: String',
      '  lobCol: String',
      '  dateCol: Date',
      '  dateTimeCol: DateTime',
      '  timeCol: String',
      '  jsonCol: JSON',
      '  blobCol: Byte',
      '  unknownCol: String',
      '}',
    ]);
    expectServableSDL(buffer.join('\n'));
  });

  it('declares each custom scalar once, before the types, only where a field uses it', () => {
    const state = createState();
    state.settings.database = Database.PostgreSQL;
    addTable(state, {
      id: 't-a',
      name: 'a',
      columns: [
        { name: 'views', dataType: 'bigint' },
        { name: 'data', dataType: 'jsonb' },
      ],
    });
    addTable(state, {
      id: 't-b',
      name: 'b',
      columns: [
        { name: 'total', dataType: 'bigint' },
        { name: 'b_id', dataType: 'bytea', keys: ColumnUIKey.foreignKey },
      ],
    });

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'scalar BigInt',
        'scalar JSON',
        '',
        'type A {',
        '  views: BigInt',
        '  data: JSON',
        '}',
        '',
        'type B {',
        '  total: BigInt',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('declares only the scalars of its own fields in the one-table view', () => {
    const state = createState();
    state.settings.database = Database.PostgreSQL;
    const table = addTable(state, {
      id: 't-a',
      name: 'a',
      columns: [{ name: 'views', dataType: 'bigint' }],
    });
    addTable(state, {
      id: 't-b',
      name: 'b',
      columns: [{ name: 'data', dataType: 'jsonb' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'scalar BigInt',
      '',
      'type A {',
      '  views: BigInt',
      '}',
    ]);
  });

  it('declares no scalar where every field takes a built-in one', () => {
    const state = createState();
    addTable(state, {
      id: 't-a',
      name: 'a',
      columns: [{ name: 'name', dataType: 'VARCHAR(10)' }],
    });

    expect(createCode(state)).toBe(
      ['', 'type A {', '  name: String', '}', ''].join('\n')
    );
  });

  it.each<[string, number, string, string]>([
    ['a PostgreSQL bigint', Database.PostgreSQL, 'bigint', 'BigInt'],
    ['a PostgreSQL int8', Database.PostgreSQL, 'int8', 'BigInt'],
    ['a PostgreSQL bigserial', Database.PostgreSQL, 'bigserial', 'BigInt'],
    ['a PostgreSQL oid', Database.PostgreSQL, 'oid', 'BigInt'],
    ['a PostgreSQL xid', Database.PostgreSQL, 'xid', 'BigInt'],
    ['a PostgreSQL serial', Database.PostgreSQL, 'serial', 'Int'],
    ['a MySQL INT UNSIGNED', Database.MySQL, 'INT UNSIGNED', 'BigInt'],
    ['a MySQL BIGINT UNSIGNED', Database.MySQL, 'BIGINT UNSIGNED', 'BigInt'],
    ['a MySQL SERIAL', Database.MySQL, 'SERIAL', 'BigInt'],
    ['a MySQL MEDIUMINT UNSIGNED', Database.MySQL, 'MEDIUMINT UNSIGNED', 'Int'],
    ['a MySQL SMALLINT UNSIGNED', Database.MySQL, 'SMALLINT UNSIGNED', 'Int'],
    ['a MySQL YEAR', Database.MySQL, 'YEAR', 'Int'],
    ['a MariaDB INT UNSIGNED', Database.MariaDB, 'INT UNSIGNED', 'BigInt'],
    ['a SQL Server bigint', Database.MSSQL, 'bigint', 'BigInt'],
    ['a SQL Server tinyint', Database.MSSQL, 'tinyint', 'Int'],
    ['a SQLite INTEGER', Database.SQLite, 'INTEGER', 'BigInt'],
    ['a Databricks LONG', Database.Databricks, 'LONG', 'BigInt'],
    ['a Databricks INT', Database.Databricks, 'INT', 'Int'],
    ['an Oracle INTEGER', Database.Oracle, 'INTEGER', 'BigInt'],
    ['an Oracle NUMBER(9)', Database.Oracle, 'NUMBER(9)', 'Int'],
    ['an Oracle NUMBER(5,0)', Database.Oracle, 'NUMBER(5,0)', 'Int'],
    ['an Oracle NUMBER(10)', Database.Oracle, 'NUMBER(10)', 'BigInt'],
    ['an Oracle NUMBER(*,0)', Database.Oracle, 'NUMBER(*,0)', 'BigInt'],
    ['an Oracle NUMBER(7,-2)', Database.Oracle, 'NUMBER(7,-2)', 'Int'],
    ['an Oracle NUMBER(8,-2)', Database.Oracle, 'NUMBER(8,-2)', 'BigInt'],
    ['an Oracle NUMBER(9,-2)', Database.Oracle, 'NUMBER(9,-2)', 'BigInt'],
    ['an Oracle NUMBER(5,-5)', Database.Oracle, 'NUMBER(5,-5)', 'BigInt'],
    ['an Oracle NUMBER(10,2)', Database.Oracle, 'NUMBER(10,2)', 'Decimal'],
    ['an Oracle bare NUMBER', Database.Oracle, 'NUMBER', 'Decimal'],
    ['an Oracle NUMBER(*)', Database.Oracle, 'NUMBER(*)', 'Decimal'],
    ['a Snowflake INT', Database.Snowflake, 'INT', 'BigInt'],
    ['a Snowflake bare NUMBER', Database.Snowflake, 'NUMBER', 'BigInt'],
    ['a Snowflake NUMBER(9,0)', Database.Snowflake, 'NUMBER(9,0)', 'Int'],
    ['a Snowflake NUMBER(38,2)', Database.Snowflake, 'NUMBER(38,2)', 'Decimal'],
    ['a Snowflake NUMBER(38,0)', Database.Snowflake, 'NUMBER(38,0)', 'BigInt'],
    ['a Snowflake bare DECIMAL', Database.Snowflake, 'DECIMAL', 'Decimal'],
    ['a Snowflake bare NUMERIC', Database.Snowflake, 'NUMERIC', 'Decimal'],
    ['a Snowflake bare DEC', Database.Snowflake, 'DEC', 'Decimal'],
    ['a PostgreSQL numeric', Database.PostgreSQL, 'numeric(10,2)', 'Decimal'],
    ['a PostgreSQL dec(5,1)', Database.PostgreSQL, 'dec(5,1)', 'Decimal'],
    ['a PostgreSQL bare DEC', Database.PostgreSQL, 'DEC', 'Decimal'],
    ['a PostgreSQL dec(5,1)[]', Database.PostgreSQL, 'dec(5,1)[]', '[Decimal]'],
    ['a PostgreSQL money', Database.PostgreSQL, 'money', 'String'],
    ['a SQL Server money', Database.MSSQL, 'money', 'Decimal'],
    ['a SQL Server numeric', Database.MSSQL, 'numeric(18,4)', 'Decimal'],
    [
      'a MySQL DECIMAL UNSIGNED',
      Database.MySQL,
      'DECIMAL(10,2) UNSIGNED',
      'Decimal',
    ],
    ['a SQLite DECIMAL', Database.SQLite, 'DECIMAL', 'Decimal'],
    ['a SQLite DEC', Database.SQLite, 'DEC', 'Decimal'],
    ['a SQLite DEC(10,2)', Database.SQLite, 'DEC(10,2)', 'Decimal'],
    ['a PostgreSQL timestamp', Database.PostgreSQL, 'timestamp', 'DateTime'],
    [
      'a PostgreSQL timestamptz',
      Database.PostgreSQL,
      'timestamptz(3)',
      'DateTime',
    ],
    ['a PostgreSQL date', Database.PostgreSQL, 'date', 'Date'],
    ['a PostgreSQL time', Database.PostgreSQL, 'time', 'String'],
    ['a PostgreSQL timetz', Database.PostgreSQL, 'timetz', 'String'],
    ['a PostgreSQL interval', Database.PostgreSQL, 'interval', 'String'],
    ['a MySQL TIMESTAMP', Database.MySQL, 'TIMESTAMP', 'DateTime'],
    ['a SQL Server smalldatetime', Database.MSSQL, 'smalldatetime', 'DateTime'],
    [
      'a SQL Server datetimeoffset',
      Database.MSSQL,
      'datetimeoffset',
      'DateTime',
    ],
    ['a SQL Server time', Database.MSSQL, 'time', 'String'],
    ['an Oracle DATE', Database.Oracle, 'DATE', 'DateTime'],
    [
      'an Oracle interval',
      Database.Oracle,
      'INTERVAL DAY(2) TO SECOND(6)',
      'String',
    ],
    [
      'a Snowflake TIMESTAMP_LTZ',
      Database.Snowflake,
      'TIMESTAMP_LTZ',
      'DateTime',
    ],
    ['a PostgreSQL json', Database.PostgreSQL, 'json', 'JSON'],
    ['a PostgreSQL jsonb', Database.PostgreSQL, 'jsonb', 'JSON'],
    ['an Oracle JSON', Database.Oracle, 'JSON', 'JSON'],
    ['a SQL Server json', Database.MSSQL, 'json', 'JSON'],
    ['a Snowflake VARIANT', Database.Snowflake, 'VARIANT', 'JSON'],
    ['a Databricks STRUCT', Database.Databricks, 'STRUCT<a:INT>', 'JSON'],
    ['a PostgreSQL bytea', Database.PostgreSQL, 'bytea', 'Byte'],
    ['a MySQL VARBINARY', Database.MySQL, 'VARBINARY(16)', 'Byte'],
    ['a SQL Server rowversion', Database.MSSQL, 'rowversion', 'Byte'],
    ['an Oracle RAW', Database.Oracle, 'RAW(16)', 'Byte'],
    ['a PostgreSQL bit string', Database.PostgreSQL, 'bit(3)', 'String'],
    ['a PostgreSQL varbit', Database.PostgreSQL, 'varbit', 'String'],
    ['a PostgreSQL pg_lsn', Database.PostgreSQL, 'pg_lsn', 'String'],
    ['a SQL Server bit', Database.MSSQL, 'bit', 'Boolean'],
    ['a MySQL BIT(1)', Database.MySQL, 'BIT(1)', 'Int'],
    ['a MySQL BIT', Database.MySQL, 'BIT', 'Int'],
    ['a MariaDB BIT(1)', Database.MariaDB, 'BIT(1)', 'Int'],
    ['a MySQL TINYINT(1)', Database.MySQL, 'TINYINT(1)', 'Int'],
    ['a MySQL BIT(64)', Database.MySQL, 'BIT(64)', 'BigInt'],
    ['a MySQL BOOLEAN', Database.MySQL, 'BOOLEAN', 'Boolean'],
    ['a PostgreSQL uuid', Database.PostgreSQL, 'uuid', 'String'],
    [
      'a SQL Server uniqueidentifier',
      Database.MSSQL,
      'uniqueidentifier',
      'String',
    ],
    ['a PostgreSQL int[]', Database.PostgreSQL, 'int[]', '[Int]'],
    [
      'a PostgreSQL integer ARRAY',
      Database.PostgreSQL,
      'integer ARRAY',
      '[Int]',
    ],
    ['a PostgreSQL int[][]', Database.PostgreSQL, 'int[][]', '[[Int]]'],
    ['a PostgreSQL bigint[]', Database.PostgreSQL, 'bigint[]', '[BigInt]'],
    [
      'a PostgreSQL timestamptz[]',
      Database.PostgreSQL,
      'timestamptz[]',
      '[DateTime]',
    ],
    [
      'an array of a type no list names',
      Database.PostgreSQL,
      '"mood"[]',
      'String',
    ],
    ['a PostgreSQL bit(8)[]', Database.PostgreSQL, 'bit(8)[]', 'String'],
    ['a PostgreSQL xid[]', Database.PostgreSQL, 'xid[]', 'String'],
    ['a PostgreSQL int4range[]', Database.PostgreSQL, 'int4range[]', 'String'],
    ['a PostgreSQL numrange[]', Database.PostgreSQL, 'numrange[]', '[String]'],
    ['a PostgreSQL money[]', Database.PostgreSQL, 'money[]', '[String]'],
    ['a PostgreSQL name[][]', Database.PostgreSQL, 'name[][]', 'String'],
    [
      'a PostgreSQL character varying(20)[]',
      Database.PostgreSQL,
      'character varying(20)[]',
      '[String]',
    ],
    [
      'a PostgreSQL timestamp(3) with time zone[]',
      Database.PostgreSQL,
      'timestamp(3) with time zone[]',
      '[DateTime]',
    ],
    ['a PostgreSQL nchar(2)[]', Database.PostgreSQL, 'nchar(2)[]', '[String]'],
    [
      'a PostgreSQL interval day to second(3)[]',
      Database.PostgreSQL,
      'interval day to second(3)[]',
      '[String]',
    ],
  ])('writes %s on database %i', (_, database, dataType, expected) => {
    expect(fieldType(database, dataType)).toBe(expected);
  });

  it('writes a NOT NULL array with the list non-null and its items nullable', () => {
    expect(
      fieldType(Database.PostgreSQL, 'int[][]', ColumnOption.notNull)
    ).toBe('[[Int]]!');
  });

  it('makes a primary key without the NN flag non-null', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-a',
      name: 'a',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          options: ColumnOption.primaryKey,
          keys: ColumnUIKey.primaryKey,
        },
        { name: 'code', dataType: 'INT', options: ColumnOption.primaryKey },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['type A {', '  id: ID!', '  code: ID!', '}']);
  });

  it.each([
    ['string', NameCase.pascalCase, 'String2'],
    ['int', NameCase.pascalCase, 'Int2'],
    ['ID', NameCase.none, 'ID2'],
    ['big_int', NameCase.pascalCase, 'BigInt2'],
    ['date_time', NameCase.pascalCase, 'DateTime2'],
    ['JSON', NameCase.none, 'JSON2'],
  ])(
    'numbers a table %s whose type name a scalar of the output takes',
    (name, tableNameCase, expected) => {
      const state = createState();
      state.settings.database = Database.PostgreSQL;
      state.settings.tableNameCase = tableNameCase;
      addTable(state, {
        id: 't-a',
        name: 'a',
        columns: [
          { name: 'views', dataType: 'bigint' },
          { name: 'at', dataType: 'timestamp' },
          { name: 'data', dataType: 'jsonb' },
        ],
      });
      addTable(state, {
        id: 't-b',
        name,
        columns: [{ name: 'x', dataType: 'integer' }],
      });

      const code = createCode(state);

      expect(code).toContain(`type ${expected} {`);
      expectServableSDL(code);
    }
  );

  it('keeps a table named after a custom scalar the output does not declare', () => {
    const state = createState();
    addTable(state, {
      id: 't-a',
      name: 'date',
      columns: [{ name: 'x', dataType: 'INT' }],
    });

    const code = createCode(state);

    expect(code).toBe(['', 'type Date {', '  x: Int', '}', ''].join('\n'));
    expectServableSDL(code);
  });

  it('collapses the leading underscores GraphQL reserves to one', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.none;
    state.settings.columnNameCase = NameCase.none;
    addTable(state, {
      id: 't-a',
      name: '__type',
      columns: [
        { name: '__typename', dataType: 'INT' },
        { name: '___schema', dataType: 'INT' },
      ],
    });

    const code = createCode(state);

    expect(code).toBe(
      ['', 'type _type {', '  _typename: Int', '  _schema: Int', '}', ''].join(
        '\n'
      )
    );
    expectServableSDL(code);
  });

  it('renders a one-to-one relationship as a single field on both sides', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a' });
    addTable(state, { id: 't-b', name: 'b' });
    addRelationship(state, 'r-1', 't-a', 't-b', RelationshipType.ZeroOne);

    expect(createCode(state)).toBe(
      ['', 'type A {', '  b: B', '}', '', 'type B {', '  a: A', '}', ''].join(
        '\n'
      )
    );
  });

  it('pushes the related table comment before each relation field', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a', comment: 'a table' });
    addTable(state, { id: 't-b', name: 'b', comment: 'b table' });
    addRelationship(state, 'r-1', 't-a', 't-b', RelationshipType.OneN);

    expect(createCode(state)).toBe(
      [
        '',
        '"""a table"""',
        'type A {',
        '  """b table"""',
        '  bList: [B!]!',
        '}',
        '',
        '"""b table"""',
        'type B {',
        '  """a table"""',
        '  a: A',
        '}',
        '',
      ].join('\n')
    );
  });

  it('numbers the fields of two relationships between one pair that no foreign key names', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a', comment: 'a table' });
    addTable(state, { id: 't-b', name: 'b', comment: 'b table' });
    addRelationship(state, 'r-1', 't-a', 't-b', RelationshipType.OneOnly);
    addRelationship(state, 'r-2', 't-a', 't-b', RelationshipType.ZeroOne);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        '"""a table"""',
        'type A {',
        '  """b table"""',
        '  b: B',
        '  """b table"""',
        '  b2: B',
        '}',
        '',
        '"""b table"""',
        'type B {',
        '  """a table"""',
        '  a: A',
        '  """a table"""',
        '  a2: A',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('skips the end side field for an unsupported relationship type', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a' });
    addTable(state, { id: 't-b', name: 'b' });
    addRelationship(state, 'r-1', 't-a', 't-b', 0);

    const code = createCode(state);

    expect(code).toBe(
      ['', 'type A', '', 'type B {', '  a: A', '}', ''].join('\n')
    );
    expectValidSDL(code);
  });

  it('ignores relationships pointing at a missing table', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a' });
    addTable(state, { id: 't-b', name: 'b' });
    addRelationship(state, 'r-1', 'ghost', 't-b');
    addRelationship(state, 'r-2', 't-a', 'ghost');

    const code = createCode(state);

    expect(code).toBe(['', 'type A', '', 'type B', ''].join('\n'));
    expectValidSDL(code);
  });

  it('omits the braces of a type whose every column is a foreign key', () => {
    const state = createState();
    addTable(state, {
      id: 't-a',
      name: 'a',
      comment: 'a table',
      columns: [
        { name: 'b_id', dataType: 'INT', keys: ColumnUIKey.foreignKey },
      ],
    });

    const code = createCode(state);

    expect(code).toBe(['', '"""a table"""', 'type A', ''].join('\n'));
    expectValidSDL(code);
  });

  it('writes a table with no field as a type a server refuses', () => {
    const state = createState();
    const table = addTable(state, { id: 't-a', name: 'a' });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['type A']);
    expect(
      validateSchema(buildSchema(buffer.join('\n'))).map(error => error.message)
    ).toContain('Type A must define one or more fields.');
  });

  it('names the child side of a self relationship with no foreign key after its parent', () => {
    const state = createState();
    addTable(state, {
      id: 't-users',
      name: 'users',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          options: ColumnOption.primaryKey,
          keys: ColumnUIKey.primaryKey,
        },
      ],
    });
    addRelationship(
      state,
      'r-1',
      't-users',
      't-users',
      RelationshipType.ZeroOne
    );

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Users {',
        '  id: ID!',
        '  parentUsers: Users',
        '  users: Users',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('keeps both relationships of a pair that runs each way', () => {
    const state = createState();
    addTable(state, { id: 't-users', name: 'users' });
    addTable(state, { id: 't-profiles', name: 'profiles' });
    addRelationship(
      state,
      'r-1',
      't-users',
      't-profiles',
      RelationshipType.ZeroOne
    );
    addRelationship(
      state,
      'r-2',
      't-profiles',
      't-users',
      RelationshipType.OneOnly
    );

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Profiles {',
        '  users: Users',
        '  users2: Users',
        '}',
        '',
        'type Users {',
        '  profiles: Profiles',
        '  profiles2: Profiles',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('numbers a relation field that collides with a column name', () => {
    const state = createState();
    addTable(state, { id: 't-user', name: 'user' });
    addTable(state, {
      id: 't-post',
      name: 'post',
      columns: [{ name: 'user', dataType: 'VARCHAR(10)', comment: 'author' }],
    });
    addRelationship(state, 'r-1', 't-user', 't-post', RelationshipType.ZeroN);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Post {',
        '  """author"""',
        '  user: String',
        '  user2: User',
        '}',
        '',
        'type User {',
        '  postList: [Post!]!',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('drops the second relation field two tables outside one pair fold onto', () => {
    const state = createState();
    addTable(state, { id: 't-post', name: 'post' });
    addTable(state, { id: 't-1', name: 'user_profile' });
    addTable(state, { id: 't-2', name: 'UserProfile' });
    addRelationship(state, 'r-1', 't-1', 't-post');
    addRelationship(state, 'r-2', 't-2', 't-post');

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Post {',
        '  userProfile: UserProfile',
        '}',
        '',
        'type UserProfile {',
        '  postList: [Post!]!',
        '}',
        '',
        'type UserProfile2 {',
        '  postList: [Post!]!',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('drops a column whose name is already taken by another column', () => {
    const state = createState();
    addTable(state, {
      id: 't-user',
      name: 'user',
      columns: [
        { name: 'name', dataType: 'VARCHAR(10)' },
        { name: 'name', dataType: 'INT', comment: 'shadowed' },
        { name: 'user_id', dataType: 'INT' },
        { name: 'userId', dataType: 'INT' },
      ],
    });

    const code = createCode(state);

    expect(code).toBe(
      ['', 'type User {', '  name: String', '  userId: Int', '}', ''].join('\n')
    );
    expectValidSDL(code);
  });

  it('wraps a multi-line comment in a block string', () => {
    const state = createState();
    addTable(state, {
      id: 't-users',
      name: 'users',
      comment: 'line one\n\nline two',
      columns: [{ name: 'id', dataType: 'INT', comment: 'PK\nauto' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        '"""',
        'line one',
        '',
        'line two',
        '"""',
        'type Users {',
        '  """',
        '  PK',
        '  auto',
        '  """',
        '  id: Int',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('escapes a comment that would close its own block string', () => {
    const state = createState();
    addTable(state, {
      id: 't-notes',
      name: 'notes',
      comment: 'has """ inside',
      columns: [{ name: 'id', dataType: 'INT', comment: 'ends with "' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        '"""has \\""" inside"""',
        'type Notes {',
        '  """',
        '  ends with "',
        '  """',
        '  id: Int',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('writes a lone surrogate half of a comment or a name as U+FFFD', () => {
    const state = createState();
    addTable(state, {
      id: 't-notes',
      name: 'notes',
      comment: 'high \ud800, low \udc00, pair \ud83d\ude00',
      columns: [{ name: '\udfff', dataType: 'INT' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        '"""high \ufffd, low \ufffd, pair \ud83d\ude00"""',
        'type Notes {',
        '  """\ufffd"""',
        '  _: Int',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('replaces the characters a GraphQL name cannot hold', () => {
    const state = createState();
    addTable(state, {
      id: 't-order',
      name: '주문',
      comment: '주문 내역',
    });
    addTable(state, {
      id: 't-member',
      name: '회원',
      comment: '회원 정보',
      columns: [{ name: '이름', dataType: 'VARCHAR(10)' }],
    });
    addRelationship(
      state,
      'r-1',
      't-member',
      't-order',
      RelationshipType.ZeroN
    );

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        '"""주문 - 주문 내역"""',
        'type _ {',
        '  """회원 - 회원 정보"""',
        '  _: _2',
        '}',
        '',
        '"""회원 - 회원 정보"""',
        'type _2 {',
        '  """이름"""',
        '  _: String',
        '  """주문 - 주문 내역"""',
        '  _list: [_!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('prefixes a name that starts with a digit', () => {
    const state = createState();
    addTable(state, {
      id: 't-token',
      name: '2fa_token',
      columns: [{ name: '2step', dataType: 'INT' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      ['', 'type _2FaToken {', '  _2Step: Int', '}', ''].join('\n')
    );
    expectValidSDL(code);
  });

  it('falls back to a placeholder for an empty name', () => {
    const state = createState();
    addTable(state, {
      id: 't-new',
      name: '',
      columns: [{ name: '', dataType: 'INT' }],
    });

    const code = createCode(state);

    expect(code).toBe(['', 'type _ {', '  _: Int', '}', ''].join('\n'));
    expectValidSDL(code);
  });

  it('replaces the spaces a name keeps under NameCase.none', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.none;
    state.settings.columnNameCase = NameCase.none;
    addTable(state, {
      id: 't-user',
      name: 'user table',
      columns: [{ name: 'first name', dataType: 'VARCHAR(10)' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      ['', 'type user_table {', '  first_name: String', '}', ''].join('\n')
    );
    expectValidSDL(code);
  });

  it('suffixes a type name two tables fold onto', () => {
    const state = createState();
    addTable(state, {
      id: 't-1',
      name: 'user_profile',
      columns: [{ name: 'id', dataType: 'INT' }],
    });
    addTable(state, {
      id: 't-2',
      name: 'UserProfile',
      columns: [{ name: 'code', dataType: 'INT' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type UserProfile {',
        '  id: Int',
        '}',
        '',
        'type UserProfile2 {',
        '  code: Int',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('gives a relation field the same type name the document assigned', () => {
    const state = createState();
    addTable(state, { id: 't-1', name: 'user_profile' });
    addTable(state, { id: 't-2', name: 'UserProfile' });
    addRelationship(state, 'r-1', 't-1', 't-2', RelationshipType.ZeroOne);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type UserProfile {',
        '  userProfile: UserProfile2',
        '}',
        '',
        'type UserProfile2 {',
        '  userProfile: UserProfile',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('applies the configured table and column name cases', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.pascalCase;
    const table = addTable(state, {
      id: 't-user-profile',
      name: 'UserProfile',
      columns: [
        {
          name: 'user_id',
          dataType: 'INT',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['type user_profile {', '  UserId: ID!', '}']);
  });

  it('names two relationships to one table after their foreign keys', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.OneN, ['t-order-c2']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  buyer: User',
        '  seller: User',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderListByBuyer: [Order!]!',
        '  orderListBySeller: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('keeps the table name for a lone relationship whatever its foreign key', () => {
    const state = createOrderState([foreignKey('buyer_id')]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  user: User',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderList: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('names only the relationships of a shared pair after their foreign keys', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
      foreignKey('owner_id'),
    ]);
    addTable(state, { id: 't-shop', name: 'shop', columns: [PRIMARY_KEY] });
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
    addRelationship(state, 'r-3', 't-shop', 't-order', RelationshipType.ZeroN, [
      't-order-c3',
    ]);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  buyer: User',
        '  seller: User',
        '  shop: Shop',
        '}',
        '',
        'type Shop {',
        '  id: ID!',
        '  orderList: [Order!]!',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderListByBuyer: [Order!]!',
        '  orderListBySeller: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('leaves List out of the parent field on a one side', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroOne, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.OneOnly, ['t-order-c2']);

    const code = createCode(state);

    expect(code).toContain(['  buyer: User', '  seller: User'].join('\n'));
    expect(code).toContain(
      ['  orderByBuyer: Order', '  orderBySeller: Order'].join('\n')
    );
    expectServableSDL(code);
  });

  it('drops a last word id in any case, split as foreign key names split', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('sellerId'),
      foreignKey('OwnerID'),
      foreignKey('vip회원ID'),
      foreignKey('order_item_id'),
    ]);
    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(column =>
      relateUserToOrder(state, RelationshipType.ZeroN, [`t-order-${column}`])
    );

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  buyer: User',
        '  seller: User',
        '  owner: User',
        '  vip__: User',
        '  orderItem: User',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderListByBuyer: [Order!]!',
        '  orderListBySeller: [Order!]!',
        '  orderListByOwner: [Order!]!',
        '  orderListByVip__: [Order!]!',
        '  orderListByOrderItem: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it.each([
    ['no id word', [foreignKey('buyer')], ['t-order-c2']],
    ['a last word ids', [foreignKey('buyer_ids')], ['t-order-c2']],
    ['an id with a digit', [foreignKey('buyer_id2')], ['t-order-c2']],
    ['id as the only word', [foreignKey('Id')], ['t-order-c2']],
    ['a name in one case', [foreignKey('BUYERID')], ['t-order-c2']],
    ['an id a case break splits', [foreignKey('buyer_iD')], ['t-order-c2']],
    ['no letter before id', [foreignKey('2Id')], ['t-order-c2']],
    ['an empty name', [foreignKey('')], ['t-order-c2']],
    [
      'a stem the case transform empties',
      [foreignKey('\u0301_id')],
      ['t-order-c2'],
    ],
    ['a stem in a non-ASCII script', [foreignKey('회원ID')], ['t-order-c2']],
    [
      'a composite key',
      [foreignKey('buyer_id'), foreignKey('buyer_no')],
      ['t-order-c2', 't-order-c3'],
    ],
    ['a missing column', [], ['ghost']],
  ])(
    'falls back to the table name for a foreign key with %s',
    (_, columns, endColumnIds) => {
      const state = createOrderState([foreignKey('seller_id'), ...columns]);
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
      relateUserToOrder(state, RelationshipType.ZeroN, endColumnIds);

      const code = createCode(state);

      expect(code).toBe(
        [
          '',
          'type Order {',
          '  id: ID!',
          '  seller: User',
          '  user: User',
          '}',
          '',
          'type User {',
          '  id: ID!',
          '  orderListBySeller: [Order!]!',
          '  orderList: [Order!]!',
          '}',
          '',
        ].join('\n')
      );
      expectServableSDL(code);
    }
  );

  it.each([
    [
      'a mixed-script stem',
      '회원No_id',
      NameCase.camelCase,
      '  orderList: [Order!]!',
    ],
    [
      'a mixed-script stem under snake case',
      '회원_no_id',
      NameCase.snakeCase,
      '  order_list: [Order!]!',
    ],
    [
      'a stem opening with two underscores',
      '__buyer_id',
      NameCase.none,
      '  orderList: [Order!]!',
    ],
  ])(
    'falls back to the table name for %s a Name would open with __',
    (_, column, columnNameCase, parentField) => {
      const state = createOrderState([
        foreignKey('seller_id'),
        foreignKey(column),
      ]);
      state.settings.columnNameCase = columnNameCase;
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);

      const code = createCode(state);

      expect(code).toContain(['  user: User', '}'].join('\n'));
      expect(code).toContain([parentField, '}'].join('\n'));
      expectServableSDL(code);
    }
  );

  it('numbers the table name each fallback field takes', () => {
    const state = createOrderState([foreignKey('buyer'), foreignKey('seller')]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);

    const code = createCode(state);

    expect(code).toContain(['  user: User', '  user2: User'].join('\n'));
    expect(code).toContain(
      ['  orderList: [Order!]!', '  orderList2: [Order!]!'].join('\n')
    );
    expectServableSDL(code);
  });

  it('falls back to the table name for the user_id_2 a second relationship draws', () => {
    const state = createOrderState([
      foreignKey('user_id'),
      foreignKey('user_id_2'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  user: User',
        '  user2: User',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderListByUser: [Order!]!',
        '  orderList: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('numbers a foreign key name that collides with a column name', () => {
    const state = createOrderState([
      { name: 'buyer', dataType: 'VARCHAR(10)' },
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);

    const code = createCode(state);

    expect(code).toContain(
      [
        'type Order {',
        '  id: ID!',
        '  buyer: String',
        '  buyer2: User',
        '  seller: User',
        '}',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('names a self relationship after its foreign key on both sides', () => {
    const state = createEmployeeState([foreignKey('manager_id')]);
    relateEmployeeToItself(state, RelationshipType.ZeroN, ['t-employee-c1']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Employee {',
        '  id: ID!',
        '  manager: Employee',
        '  employeeListByManager: [Employee!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('keeps the table name on the parent side of a self relationship with no id word', () => {
    const state = createEmployeeState([foreignKey('boss')]);
    relateEmployeeToItself(state, RelationshipType.ZeroN, ['t-employee-c1']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Employee {',
        '  id: ID!',
        '  parentEmployee: Employee',
        '  employeeList: [Employee!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it.each([
    [
      'snake case',
      NameCase.snakeCase,
      ['  buyer: User', '  order_list_by_buyer: [Order!]!'],
    ],
    [
      'pascal case',
      NameCase.pascalCase,
      ['  Buyer: User', '  OrderListByBuyer: [Order!]!'],
    ],
    [
      'no name case',
      NameCase.none,
      ['  buyer: User', '  orderList_by_buyer: [Order!]!'],
    ],
  ])(
    'applies the column name case to both foreign key names under %s',
    (_, columnNameCase, [childField, parentField]) => {
      const state = createOrderState([
        foreignKey('buyer_id'),
        foreignKey('seller_id'),
      ]);
      state.settings.columnNameCase = columnNameCase;
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);

      const code = createCode(state);

      expect(code).toContain(childField);
      expect(code).toContain(parentField);
      expectServableSDL(code);
    }
  );

  it('names relation fields the same way in the standalone formatTable', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
    const buffer: string[] = [];

    formatTable(state, {
      buffer,
      table: state.collections.tableEntities['t-order'],
    });

    expect(buffer).toEqual([
      'type Order {',
      '  id: ID!',
      '  buyer: User',
      '  seller: User',
      '}',
    ]);
  });
});

// Where numbering leaves two names alike the importer cannot pair them, so the
// second table pins what imports back with more; the first keeps every count.
describe('generator-code/graphql round trip through schema-graphql-parser', () => {
  it.each<[string, () => RootState]>([
    [
      'a 1:N pair',
      () => {
        const state = createOrderState([foreignKey('user_id')]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        return state;
      },
    ],
    [
      'a 1:1 pair',
      () => {
        const state = createOrderState([foreignKey('user_id')]);
        relateUserToOrder(state, RelationshipType.OneOnly, ['t-order-c1']);
        return state;
      },
    ],
    [
      'a relation field numbered past a column',
      () => {
        const state = createOrderState([
          { name: 'user', dataType: 'VARCHAR(10)' },
          foreignKey('user_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'a self relationship on manager_id',
      () => {
        const state = createEmployeeState([foreignKey('manager_id')]);
        relateEmployeeToItself(state, RelationshipType.ZeroN, [
          't-employee-c1',
        ]);
        return state;
      },
    ],
    [
      'a self relationship on boss',
      () => {
        const state = createEmployeeState([foreignKey('boss')]);
        relateEmployeeToItself(state, RelationshipType.ZeroOne, [
          't-employee-c1',
        ]);
        return state;
      },
    ],
    [
      'two foreign keys to one table',
      () => {
        const state = createOrderState([
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.OneN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'two foreign keys to one table on a one side',
      () => {
        const state = createOrderState([
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroOne, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.OneOnly, ['t-order-c2']);
        return state;
      },
    ],
    [
      'a pair three relationships join, one of them back the other way',
      () => {
        const state = createOrderState([
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.OneN, ['t-order-c2']);
        addRelationship(
          state,
          'r-3',
          't-order',
          't-user',
          RelationshipType.ZeroOne
        );
        return state;
      },
    ],
    [
      'a foreign key name numbered past a column',
      () => {
        const state = createOrderState([
          { name: 'buyer', dataType: 'VARCHAR(10)' },
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        return state;
      },
    ],
    [
      'a table name fallback ahead of a foreign key name',
      () => {
        const state = createOrderState([
          foreignKey('buyer'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'the user_id_2 a second relationship draws',
      () => {
        const state = createOrderState([
          foreignKey('user_id'),
          foreignKey('user_id_2'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'two self relationships',
      () => {
        const state = createEmployeeState([
          foreignKey('manager_id'),
          foreignKey('mentor_id'),
        ]);
        relateEmployeeToItself(state, RelationshipType.ZeroN, [
          't-employee-c1',
        ]);
        relateEmployeeToItself(state, RelationshipType.ZeroOne, [
          't-employee-c2',
        ]);
        return state;
      },
    ],
    [
      'a self relationship fallback ahead of a foreign key name',
      () => {
        const state = createEmployeeState([
          foreignKey('mentor'),
          foreignKey('manager_id'),
        ]);
        relateEmployeeToItself(state, RelationshipType.ZeroN, [
          't-employee-c1',
        ]);
        relateEmployeeToItself(state, RelationshipType.ZeroN, [
          't-employee-c2',
        ]);
        return state;
      },
    ],
    [
      'two foreign key names each numbered past a column',
      () => {
        const state = createOrderState([
          { name: 'buyer', dataType: 'VARCHAR(10)' },
          { name: 'seller', dataType: 'VARCHAR(10)' },
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c4']);
        return state;
      },
    ],
    [
      'a foreign key name numbered past a column beside a table name fallback',
      () => {
        const state = createOrderState([
          { name: 'buyer', dataType: 'INT' },
          foreignKey('buyer_id'),
          foreignKey('owner'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        return state;
      },
    ],
    [
      'a foreign key name and the user_id_2 fallback numbered past a column',
      () => {
        const state = createOrderState([
          { name: 'user', dataType: 'INT' },
          foreignKey('user_id'),
          foreignKey('user_id_2'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        return state;
      },
    ],
    [
      'a parent field numbered past a column beside a table name fallback',
      () => {
        const state = createOrderState(
          [foreignKey('buyer_id'), foreignKey('owner')],
          [{ name: 'orderListByBuyer', dataType: 'VARCHAR(10)' }]
        );
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'a foreign key name holding another after by',
      () => {
        const state = createOrderState([
          foreignKey('user_id'),
          foreignKey('created_by_user_id'),
          foreignKey('owner'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        return state;
      },
    ],
  ])('imports %s back with as many relationships', (_, createDocument) => {
    const state = createDocument();

    const code = createCode(state);

    expect(importedRelationshipCount(code)).toBe(
      state.doc.relationshipIds.length
    );
    expectServableSDL(code);
  });

  it.each<[string, () => RootState]>([
    [
      'two relationships of one pair that no foreign key names',
      () => {
        const state = createOrderState([
          foreignKey('buyer'),
          foreignKey('seller'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'two foreign keys giving one name on a one and a many side',
      () => {
        const state = createOrderState([
          foreignKey('buyer_id'),
          foreignKey('BuyerID'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroOne, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'a foreign key stem ending in a digit that numbering repeats',
      () => {
        const state = createOrderState(
          [foreignKey('buyer_id'), foreignKey('buyer2_id')],
          [{ name: 'orderListByBuyer', dataType: 'VARCHAR(10)' }]
        );
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroOne, ['t-order-c2']);
        return state;
      },
    ],
  ])(
    'imports %s back with twice as many relationships',
    (_, createDocument) => {
      const state = createDocument();

      const code = createCode(state);

      expect(importedRelationshipCount(code)).toBe(
        state.doc.relationshipIds.length * 2
      );
      expectServableSDL(code);
    }
  );
});

const SCALAR_FIELDS: Record<string, string> = {
  int: 'Int',
  float: 'Float',
  boolean: 'Boolean',
  string: 'String',
  bigInt: 'BigInt',
  decimal: 'Decimal',
  dateTime: 'DateTime',
  date: 'Date',
  json: 'JSON',
  byte: 'Byte',
  ints: '[Int]',
  grid: '[[BigInt]]',
};

/** What a database writes back where it has no column type for a scalar. */
const WRITTEN_BACK: Record<number, Record<string, string>> = {
  [Database.Oracle]: { Int: 'BigInt', Date: 'DateTime' },
  [Database.Snowflake]: { Int: 'BigInt' },
  [Database.SQLite]: { Int: 'BigInt', JSON: 'String' },
};

function importState(code: string, database: number): RootState {
  const json = schemaGraphQLParserToSchemaJson(code, ctx, schema => {
    schema.settings.database = database;
    return schema;
  });
  return { ...schemaV3Parser(JSON.parse(json)), editor: {} as any, lww: {} };
}

function fieldTypes(code: string): Record<string, string> {
  return Object.fromEntries(
    [...code.matchAll(/^ {2}(\w+): (.+)$/gm)].map(([, name, type]) => [
      name,
      type,
    ])
  );
}

function columnTypes(state: RootState): Record<string, string> {
  return Object.fromEntries(
    Object.values(state.collections.tableColumnEntities).map(column => [
      column.name,
      column.dataType,
    ])
  );
}

/**
 * A list comes back as its item: the importer types the column by the item
 * and notes the list in its comment, on PostgreSQL too.
 */
function writtenBack(type: string, database: number): string {
  const item = type.replace(/[[\]]/g, '');

  return WRITTEN_BACK[database]?.[item] ?? item;
}

describe('generator-code/graphql scalars through schema-graphql-parser', () => {
  it.each(DatabaseList)(
    'writes back on database %i each scalar it imported',
    database => {
      const sdl = [
        'scalar BigInt',
        'scalar Byte',
        'scalar Date',
        'scalar DateTime',
        'scalar Decimal',
        'scalar JSON',
        'type Row {',
        '  id: ID!',
        ...Object.entries(SCALAR_FIELDS).map(
          ([name, type]) => `  ${name}: ${type}!`
        ),
        '}',
      ].join('\n');

      const code = createCode(importState(sdl, database));

      expect(fieldTypes(code)).toEqual({
        id: 'ID!',
        ...Object.fromEntries(
          Object.entries(SCALAR_FIELDS).map(([name, type]) => [
            name,
            `${writtenBack(type, database)}!`,
          ])
        ),
      });
      expectServableSDL(code);
    }
  );

  it.each(DatabaseList)(
    'imports on database %i the column type each scalar was written from',
    database => {
      const model = {
        tables: [],
        enums: {},
        customScalars: [],
        unions: {},
        skipped: [],
      };
      const columns = Object.entries(SCALAR_FIELDS)
        .filter(
          ([, type]) =>
            !type.startsWith('[') || database === Database.PostgreSQL
        )
        .map(([name, type]) => ({
          name,
          dataType: `${resolveDataType(type.replace(/[[\]]/g, ''), database, model)}${'[]'.repeat(type.split('[').length - 1)}`,
          options: ColumnOption.notNull,
        }));
      const state = createState();
      state.settings.database = database;
      addTable(state, { id: 't-row', name: 'row', columns });

      const imported = importState(createCode(state), database);

      const expected = Object.fromEntries(
        columns.map(({ name, dataType }) => {
          const type = SCALAR_FIELDS[name];
          const back = writtenBack(type, database);
          return [
            name,
            back === type ? dataType : resolveDataType(back, database, model),
          ];
        })
      );
      expect(columnTypes(imported)).toEqual(expected);
    }
  );
});

/** A decimal column of two places, as each database spells one. */
const PRICE_TYPES: Record<number, string> = {
  [Database.MariaDB]: 'DECIMAL(10,2)',
  [Database.MSSQL]: 'decimal(10,2)',
  [Database.MySQL]: 'DECIMAL(10,2)',
  [Database.Oracle]: 'NUMBER(10,2)',
  [Database.PostgreSQL]: 'numeric(10,2)',
  [Database.SQLite]: 'DECIMAL(10,2)',
  [Database.Databricks]: 'DECIMAL(10,2)',
  [Database.Snowflake]: 'NUMBER(10,2)',
};

/**
 * The column a Decimal field imports as: a bare DECIMAL holds no fraction but
 * on PostgreSQL and SQLite, so the others read it with 18 places.
 */
const DECIMAL_READ_BACK: Record<number, string> = {
  [Database.MariaDB]: 'DECIMAL(38,18)',
  [Database.MSSQL]: 'decimal(38,18)',
  [Database.MySQL]: 'DECIMAL(38,18)',
  [Database.Oracle]: 'DECIMAL(38,18)',
  [Database.PostgreSQL]: 'numeric',
  [Database.SQLite]: 'DECIMAL',
  [Database.Databricks]: 'DECIMAL(38,18)',
  [Database.Snowflake]: 'DECIMAL(38,18)',
};

describe('generator-code/graphql decimals through schema-graphql-parser', () => {
  it.each(DatabaseList)(
    'imports a decimal column on database %i as one that keeps its fraction',
    database => {
      const state = createState();
      state.settings.database = database;
      addTable(state, {
        id: 't-product',
        name: 'product',
        columns: [
          {
            name: 'price',
            dataType: PRICE_TYPES[database],
            options: ColumnOption.notNull,
          },
        ],
      });

      const code = createCode(state);
      const imported = importState(code, database);

      expect(fieldTypes(code)).toEqual({ price: 'Decimal!' });
      expect(columnTypes(imported)).toEqual({
        price: DECIMAL_READ_BACK[database],
      });
      expect(fieldTypes(createCode(imported))).toEqual({ price: 'Decimal!' });
    }
  );
});

const KEY_OPTIONS = ColumnOption.primaryKey | ColumnOption.notNull;

/** The fields of one type in a document, by field name. */
function typeFields(code: string, typeName: string): Record<string, string> {
  const block = new RegExp(`^type ${typeName} \\{\\n([^}]*)\\n\\}`, 'm').exec(
    code
  );
  return fieldTypes(block?.[1] ?? '');
}

describe('generator-code/graphql keys and relation names through schema-graphql-parser', () => {
  it('imports a composite key keyed on its first ID field alone', () => {
    const state = createState();
    addTable(state, { id: 't-film', name: 'film', columns: [PRIMARY_KEY] });
    addTable(state, {
      id: 't-cast',
      name: 'cast',
      columns: [
        {
          name: 'actor_id',
          dataType: 'INT',
          options: KEY_OPTIONS,
          keys: ColumnUIKey.primaryKey,
        },
        {
          name: 'role_code',
          dataType: 'INT',
          options: KEY_OPTIONS,
          keys: ColumnUIKey.primaryKey,
        },
        {
          name: 'film_id',
          dataType: 'INT',
          options: KEY_OPTIONS,
          keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey,
        },
      ],
    });
    addRelationship(state, 'r-film', 't-film', 't-cast', undefined, [
      't-cast-c2',
    ]);

    const code = createCode(state);
    const back = createCode(importState(code, state.settings.database));

    expect(typeFields(code, 'Cast')).toEqual({
      actorId: 'ID!',
      roleCode: 'ID!',
      filmId: 'ID!',
      film: 'Film',
    });
    expect(typeFields(back, 'Cast')).toEqual({
      actorId: 'ID!',
      roleCode: 'String!',
      film: 'Film',
    });
  });

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'language_id',
      { language: 'Language', originalLanguage: 'Language' },
      { languageLanguage: 'Language', originalLanguageLanguage: 'Language' },
    ],
    [
      'id',
      { language: 'Language', originalLanguage: 'Language' },
      { language: 'Language', originalLanguage: 'Language' },
    ],
  ])(
    'names the relation fields a foreign key named after the column the importer adds, the parent key %s',
    (keyName, written, writtenBack) => {
      const state = createState();
      addTable(state, {
        id: 't-language',
        name: 'language',
        columns: [{ ...PRIMARY_KEY, name: keyName }],
      });
      addTable(state, {
        id: 't-film',
        name: 'film',
        columns: [
          PRIMARY_KEY,
          foreignKey('language_id'),
          { ...foreignKey('original_language_id'), options: 0 },
        ],
      });
      addRelationship(state, 'r-1', 't-language', 't-film', undefined, [
        't-film-c1',
      ]);
      addRelationship(state, 'r-2', 't-language', 't-film', undefined, [
        't-film-c2',
      ]);

      const code = createCode(state);
      const imported = importState(code, state.settings.database);

      expect(typeFields(code, 'Film')).toEqual({ id: 'ID!', ...written });
      expect(typeFields(createCode(imported), 'Film')).toEqual({
        id: 'ID!',
        ...writtenBack,
      });
      expect(imported.doc.relationshipIds).toHaveLength(2);
    }
  );
});
