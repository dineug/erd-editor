import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createCode,
  formatTable,
  toScalaName,
} from '@/utils/generator-code/scala';

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

/** The NOT NULL field each data type writes on a database, the last without a comma. */
function notNullFields(
  database: number,
  dataTypes: Array<[dataType: string, scalaType: string]>
) {
  const state = createState();
  state.settings.database = database;
  const table = addTable(state, {
    id: 't-types',
    name: 'types',
    columns: dataTypes.map(([dataType], index) => ({
      name: `c${index}`,
      dataType,
      options: ColumnOption.notNull,
    })),
  });
  const buffer: string[] = [];

  formatTable(state, { buffer, table });

  return {
    actual: buffer.slice(1, -1),
    expected: dataTypes.map(
      ([, scalaType], index) =>
        `  c${index}: ${scalaType}${index < dataTypes.length - 1 ? ',' : ''}`
    ),
  };
}

describe('generator-code/scala', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits case classes sorted by name, with a comma after every field but the last', () => {
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
        'case class Posts(',
        '  id: Option[Long]',
        ')',
        '',
        '// user table',
        'case class Users(',
        '  // user id',
        '  id: Int,',
        '  nickName: Option[String]',
        ')',
        '',
      ].join('\n')
    );
  });

  it('emits an empty parameter list for a table without columns', () => {
    const state = createState();
    const table = addTable(state, { id: 't-empty', name: 'empty' });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['case class Empty(', ')']);
  });

  it('maps every primitive type to a Scala type', () => {
    const { actual, expected } = notNullFields(Database.MySQL, [
      ['INT', 'Int'],
      ['BIGINT', 'Long'],
      ['FLOAT', 'Float'],
      ['DOUBLE', 'Double'],
      ['DECIMAL(10, 2)', 'BigDecimal'],
      ['BOOLEAN', 'Boolean'],
      ['VARCHAR(10)', 'String'],
      ['TEXT', 'String'],
      ['DATE', 'LocalDate'],
      ['TIME', 'LocalTime'],
      ['NOT_A_TYPE', 'String'],
    ]);

    expect(actual).toEqual(expected);
  });

  it('gives integers their width, an unsigned one the next wider type', () => {
    const { actual, expected } = notNullFields(Database.MySQL, [
      ['TINYINT', 'Byte'],
      ['SMALLINT', 'Short'],
      ['TINYINT UNSIGNED', 'Short'],
      ['MEDIUMINT UNSIGNED', 'Int'],
      ['INT UNSIGNED', 'Long'],
      ['BIGINT UNSIGNED', 'Long'],
      ['BIT(1)', 'Boolean'],
      ['BLOB', 'Array[Byte]'],
      ['DATETIME', 'LocalDateTime'],
    ]);

    expect(actual).toEqual(expected);
  });

  it('maps uuid, binaries, zoned times, intervals and arrays on PostgreSQL', () => {
    const { actual, expected } = notNullFields(Database.PostgreSQL, [
      ['uuid', 'UUID'],
      ['bytea', 'Array[Byte]'],
      ['money', 'BigDecimal'],
      ['timetz', 'OffsetTime'],
      ['timestamptz', 'OffsetDateTime'],
      ['interval day to second', 'java.time.Duration'],
      ['interval year to month', 'String'],
      ['int[]', 'List[Int]'],
      ['text[][]', 'List[List[String]]'],
      ['bytea[]', 'List[Array[Byte]]'],
    ]);

    expect(actual).toEqual(expected);
  });

  it('writes Duration with its package, which scala.concurrent.duration shares, and UUID and OffsetDateTime without', () => {
    const state = createState();
    state.settings.database = Database.PostgreSQL;
    const table = addTable(state, {
      id: 't-session',
      name: 'session',
      columns: [
        { name: 'id', dataType: 'uuid', options: ColumnOption.primaryKey },
        { name: 'ttl', dataType: 'interval', options: ColumnOption.notNull },
        { name: 'grace', dataType: 'interval' },
        { name: 'steps', dataType: 'interval[]' },
        { name: 'created_at', dataType: 'timestamptz' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'case class Session(',
      '  id: UUID,',
      '  ttl: java.time.Duration,',
      '  grace: Option[java.time.Duration],',
      '  steps: Option[List[java.time.Duration]],',
      '  createdAt: Option[OffsetDateTime]',
      ')',
    ]);
  });

  it('maps SQL Server, Oracle and Snowflake types through the shared classifier', () => {
    const mssql = notNullFields(Database.MSSQL, [
      ['numeric(10,2)', 'BigDecimal'],
      ['bit', 'Boolean'],
      ['tinyint', 'Short'],
      ['rowversion', 'Array[Byte]'],
    ]);
    const oracle = notNullFields(Database.Oracle, [
      ['NUMBER(10,2)', 'BigDecimal'],
      ['DATE', 'LocalDateTime'],
      ['TIMESTAMP WITH TIME ZONE', 'OffsetDateTime'],
    ]);
    const snowflake = notNullFields(Database.Snowflake, [
      ['INT', 'Long'],
      ['VARIANT', 'String'],
    ]);

    expect(mssql.actual).toEqual(mssql.expected);
    expect(oracle.actual).toEqual(oracle.expected);
    expect(snowflake.actual).toEqual(snowflake.expected);
  });

  it('wraps a nullable column in an Option, but not a primary key', () => {
    const state = createState();
    state.settings.database = Database.PostgreSQL;
    const table = addTable(state, {
      id: 't-member',
      name: 'member',
      columns: [
        { name: 'id', dataType: 'uuid', options: ColumnOption.primaryKey },
        { name: 'avatar', dataType: 'bytea' },
        { name: 'tags', dataType: 'text[]' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'case class Member(',
      '  id: UUID,',
      '  avatar: Option[Array[Byte]],',
      '  tags: Option[List[String]]',
      ')',
    ]);
  });

  it('writes a reserved word in backticks', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.none;
    const table = addTable(state, {
      id: 't-type',
      name: 'type',
      columns: [
        { name: 'using', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'type', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'name', dataType: 'VARCHAR(10)' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'case class `type`(',
      '  `using`: Int,',
      '  `type`: Int,',
      '  name: Option[String]',
      ')',
    ]);
    expect(toScalaName('then')).toBe('`then`');
    expect(toScalaName('open')).toBe('open');
  });

  it('writes a field name ending in an underscore in backticks, so the colon stays apart', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.none;
    state.settings.columnNameCase = NameCase.none;
    const table = addTable(state, {
      id: 't-orders',
      name: 'orders_',
      columns: [
        { name: 'order_', dataType: 'INT', options: ColumnOption.notNull },
        { name: '__', dataType: 'INT' },
        { name: '_a', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'a_b', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'case class orders_(',
      '  `order_`: Int,',
      '  `__`: Option[Int],',
      '  _a: Int,',
      '  a_b: Int',
      ')',
    ]);
  });

  it('writes the bidirectional controls Scala 2.13 refuses in a comment as escapes', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-notes',
      name: 'notes',
      comment: '\u202Bنص\u202C',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'a\u202Ab\u202Ec \u2066d\u2069 e\u200Ff\u061Cg C:\\users',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '// \\u202Bنص\\u202C',
      'case class Notes(',
      '  // a\\u202Ab\\u202Ec \\u2066d\\u2069 e\u200Ff\u061Cg C:\\users',
      '  id: Int',
      ')',
    ]);
  });

  it('writes a comment of several lines as one line comment a line', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-notes',
      name: 'notes',
      comment: 'first\rsecond',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'one\n\ntwo ',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '// first',
      '// second',
      'case class Notes(',
      '  // one',
      '  //',
      '  // two',
      '  id: Int',
      ')',
    ]);
  });

  it('applies the configured table and column name cases', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.pascalCase;
    const table = addTable(state, {
      id: 't-user-profile',
      name: 'UserProfile',
      columns: [
        { name: 'user_id', dataType: 'INT', comment: 'the id' },
        { name: 'user_name', dataType: 'VARCHAR(10)' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'case class user_profile(',
      '  // the id',
      '  UserId: Option[Int],',
      '  UserName: Option[String]',
      ')',
    ]);
  });
});
