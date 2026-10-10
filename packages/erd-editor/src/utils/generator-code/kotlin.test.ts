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
  toKotlinName,
} from '@/utils/generator-code/kotlin';

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

/** The NOT NULL parameter each data type writes on a database. */
function notNullParameters(
  database: number,
  dataTypes: Array<[dataType: string, kotlinType: string]>
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
      ([, kotlinType], index) => `    val c${index}: ${kotlinType},`
    ),
  };
}

describe('generator-code/kotlin', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits data classes sorted by name with table and column comments', () => {
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
      columns: [
        { name: 'id', dataType: 'BIGINT', options: ColumnOption.notNull },
      ],
    });

    expect(createCode(state)).toBe(
      [
        '',
        'data class Posts(',
        '    val id: Long,',
        ')',
        '',
        '// user table',
        'data class Users(',
        '    // user id',
        '    val id: Int,',
        '    val nickName: String? = null,',
        ')',
        '',
      ].join('\n')
    );
  });

  it('requires every not null parameter, whatever its type', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-types',
      name: 'types',
      columns: [
        { name: 'intCol', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'longCol', dataType: 'BIGINT', options: ColumnOption.notNull },
        { name: 'floatCol', dataType: 'FLOAT', options: ColumnOption.notNull },
        {
          name: 'doubleCol',
          dataType: 'DOUBLE',
          options: ColumnOption.notNull,
        },
        {
          name: 'decimalCol',
          dataType: 'DECIMAL(10, 2)',
          options: ColumnOption.notNull,
        },
        {
          name: 'booleanCol',
          dataType: 'BOOLEAN',
          options: ColumnOption.notNull,
        },
        {
          name: 'stringCol',
          dataType: 'VARCHAR(10)',
          options: ColumnOption.notNull,
        },
        { name: 'lobCol', dataType: 'TEXT', options: ColumnOption.notNull },
        { name: 'dateCol', dataType: 'DATE', options: ColumnOption.notNull },
        { name: 'timeCol', dataType: 'TIME', options: ColumnOption.notNull },
        {
          name: 'unknownCol',
          dataType: 'NOT_A_TYPE',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'data class Types(',
      '    val intCol: Int,',
      '    val longCol: Long,',
      '    val floatCol: Float,',
      '    val doubleCol: Double,',
      '    val decimalCol: BigDecimal,',
      '    val booleanCol: Boolean,',
      '    val stringCol: String,',
      '    val lobCol: String,',
      '    val dateCol: LocalDate,',
      '    val timeCol: LocalTime,',
      '    val unknownCol: String,',
      ')',
    ]);
  });

  it('maps the dateTime primitive type to LocalDateTime', () => {
    const state = createState();
    state.settings.database = Database.Oracle;
    const table = addTable(state, {
      id: 't-ts',
      name: 'ts',
      columns: [
        {
          name: 'created_at',
          dataType: 'TIMESTAMP',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'data class Ts(',
      '    val createdAt: LocalDateTime,',
      ')',
    ]);
  });

  it('defaults a nullable parameter to null and reads a primary key as not null', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-nullable',
      name: 'nullable',
      columns: [
        { name: 'intCol', dataType: 'INT' },
        {
          name: 'stringCol',
          dataType: 'VARCHAR(10)',
          comment: 'a comment',
          options: ColumnOption.primaryKey,
        },
        { name: 'dateCol', dataType: 'DATE' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'data class Nullable(',
      '    val intCol: Int? = null,',
      '    // a comment',
      '    val stringCol: String,',
      '    val dateCol: LocalDate? = null,',
      ')',
    ]);
  });

  it('gives integers their width, an unsigned one the next wider type', () => {
    const { actual, expected } = notNullParameters(Database.MySQL, [
      ['TINYINT', 'Byte'],
      ['SMALLINT', 'Short'],
      ['TINYINT UNSIGNED', 'Short'],
      ['SMALLINT UNSIGNED', 'Int'],
      ['MEDIUMINT UNSIGNED', 'Int'],
      ['INT UNSIGNED', 'Long'],
      ['BIGINT UNSIGNED', 'Long'],
      ['SERIAL', 'Long'],
      ['BIT(1)', 'Boolean'],
      ['BIT(8)', 'Long'],
      ['FLOAT(53)', 'Double'],
      ['BLOB', 'ByteArray'],
      ['JSON', 'String'],
    ]);

    expect(actual).toEqual(expected);
  });

  it('maps uuid, binaries, zoned times, intervals and arrays on PostgreSQL', () => {
    const { actual, expected } = notNullParameters(Database.PostgreSQL, [
      ['uuid', 'UUID'],
      ['bytea', 'ByteArray'],
      ['money', 'BigDecimal'],
      ['timetz', 'OffsetTime'],
      ['timestamptz', 'OffsetDateTime'],
      ['interval', 'Duration'],
      ['interval year to month', 'String'],
      ['int[]', 'List<Int>'],
      ['text[][]', 'List<List<String>>'],
      ['bytea[]', 'List<ByteArray>'],
    ]);

    expect(actual).toEqual(expected);
  });

  it('writes a nullable array as a nullable list', () => {
    const state = createState();
    state.settings.database = Database.PostgreSQL;
    const table = addTable(state, {
      id: 't-tags',
      name: 'tags',
      columns: [{ name: 'tags', dataType: 'varchar(20)[]' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'data class Tags(',
      '    val tags: List<String>? = null,',
      ')',
    ]);
  });

  it('maps SQL Server, Oracle and SQLite types through the shared classifier', () => {
    const mssql = notNullParameters(Database.MSSQL, [
      ['numeric(10,2)', 'BigDecimal'],
      ['bit', 'Boolean'],
      ['tinyint', 'Short'],
      ['uniqueidentifier', 'UUID'],
      ['rowversion', 'ByteArray'],
      ['datetimeoffset', 'OffsetDateTime'],
    ]);
    const oracle = notNullParameters(Database.Oracle, [
      ['NUMBER(10,2)', 'BigDecimal'],
      ['INTEGER', 'Long'],
      ['DATE', 'LocalDateTime'],
      ['INTERVAL DAY TO SECOND', 'Duration'],
    ]);
    const sqlite = notNullParameters(Database.SQLite, [
      ['INTEGER', 'Long'],
      ['BOOL', 'Boolean'],
    ]);

    expect(mssql.actual).toEqual(mssql.expected);
    expect(oracle.actual).toEqual(oracle.expected);
    expect(sqlite.actual).toEqual(sqlite.expected);
  });

  it('writes a table without columns as a class, since a data class needs one', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-empty',
      name: 'empty',
      comment: 'nothing yet',
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['// nothing yet', 'class Empty']);
  });

  it('writes a hard keyword in backticks', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.none;
    const table = addTable(state, {
      id: 't-object',
      name: 'object',
      columns: [
        { name: 'class', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'value', dataType: 'INT' },
        { name: 'in', dataType: 'INT' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'data class `object`(',
      '    val `class`: Int,',
      '    val value: Int? = null,',
      '    val `in`: Int? = null,',
      ')',
    ]);
    expect(toKotlinName('typeof')).toBe('`typeof`');
    expect(toKotlinName('data')).toBe('data');
  });

  it('writes a name of underscores alone in backticks, which Kotlin reserves', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.none;
    state.settings.columnNameCase = NameCase.none;
    const table = addTable(state, {
      id: 't-under',
      name: '__',
      columns: [
        { name: '_', dataType: 'INT', options: ColumnOption.notNull },
        { name: '___', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'order_', dataType: 'INT', options: ColumnOption.notNull },
        { name: '_a', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'data class `__`(',
      '    val `_`: Int,',
      '    val `___`: Int,',
      '    val order_: Int,',
      '    val _a: Int,',
      ')',
    ]);
  });

  it('writes a backslash and u in a comment as is, since Kotlin reads no escape there', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-files',
      name: 'files',
      comment: 'C:\\users \\u000a',
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['// C:\\users \\u000a', 'class Files']);
  });

  it('writes a comment of several lines as one line comment a line', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-notes',
      name: 'notes',
      comment: 'first\r\nsecond',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'one\ntwo three',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '// first',
      '// second',
      'data class Notes(',
      '    // one',
      '    // two',
      '    // three',
      '    val id: Int,',
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
      columns: [{ name: 'user_id', dataType: 'INT' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'data class user_profile(',
      '    val UserId: Int? = null,',
      ')',
    ]);
  });

  it('leaves the name untouched when the name case is none', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.none;
    state.settings.columnNameCase = NameCase.none;
    const table = addTable(state, {
      id: 't-raw',
      name: 'user_profile',
      columns: [{ name: 'user_id', dataType: 'INT' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'data class user_profile(',
      '    val user_id: Int? = null,',
      ')',
    ]);
  });
});
