import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/typescript';

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

const NN = ColumnOption.notNull;

function createState(database?: number): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;

  if (database !== undefined) {
    state.settings.database = database;
  }
  return state;
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

function format(state: RootState, table: Table): string[] {
  const buffer: string[] = [];

  formatTable(state, { buffer, table });
  return buffer;
}

/** One table of NOT NULL columns of the given types, keyed c0, c1, ... */
function typesOf(database: number, dataTypes: string[]): string[] {
  const state = createState(database);
  const table = addTable(state, {
    id: 't',
    name: 't',
    columns: dataTypes.map((dataType, index) => ({
      name: `c${index}`,
      dataType,
      options: NN,
    })),
  });

  return format(state, table)
    .slice(1, -1)
    .map(line => line.replace(/^ {2}c\d+: /, '').replace(/;$/, ''));
}

describe('generator-code/typescript', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits interfaces sorted by name with comments and nullable unions', () => {
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
          options: ColumnOption.primaryKey | NN,
        },
        { name: 'nick_name', dataType: 'VARCHAR(50)' },
      ],
    });
    addTable(state, {
      id: 't-posts',
      name: 'posts',
      columns: [{ name: 'id', dataType: 'BIGINT', options: NN }],
    });

    expect(createCode(state)).toBe(
      [
        '',
        'export interface Posts {',
        '  id: number;',
        '}',
        '',
        '// user table',
        'export interface Users {',
        '  // user id',
        '  id: number;',
        '  nickName: string | null;',
        '}',
        '',
      ].join('\n')
    );
  });

  it('writes the type z.infer gives the Zod schema of each MySQL column', () => {
    expect(
      typesOf(Database.MySQL, [
        'INT',
        'BIGINT',
        'BIGINT UNSIGNED',
        'FLOAT',
        'DOUBLE',
        'DECIMAL(10, 2)',
        'BOOLEAN',
        'BIT(1)',
        'BIT',
        'BIT(8)',
        'TINYINT(1)',
        'VARCHAR(10)',
        'TEXT',
        'DATE',
        'TIME',
        'DATETIME',
        'TIMESTAMP',
        'BLOB',
        'JSON',
        "ENUM('sad','ok','happy')",
        "SET('r','w')",
        'NOT_A_TYPE',
      ])
    ).toEqual([
      'number',
      'number',
      'number',
      'number',
      'number',
      'string',
      'boolean',
      'boolean',
      'boolean',
      'number',
      'number',
      'string',
      'string',
      'string',
      'string',
      'string',
      'string',
      'string',
      'unknown',
      '"sad" | "ok" | "happy"',
      'string',
      'string',
    ]);
  });

  it('follows the JSON shape on the other databases', () => {
    expect(
      typesOf(Database.MariaDB, ['BIT', 'bit(1)', 'BIT(8)', 'TINYINT(1)'])
    ).toEqual(['boolean', 'boolean', 'number', 'number']);
    expect(
      typesOf(Database.PostgreSQL, [
        'numeric(10,2)',
        'money',
        'jsonb',
        'uuid',
        'bytea',
        'bit(3)',
        'pg_lsn',
        'xid',
        'xid8',
        'oid',
        'timestamptz',
        'interval',
      ])
    ).toEqual([
      'string',
      'string',
      'unknown',
      'string',
      'string',
      'string',
      'string',
      'string',
      'string',
      'number',
      'string',
      'string',
    ]);
    expect(
      typesOf(Database.SQLite, ['DECIMAL(10,2)', 'NUMERIC', 'JSON'])
    ).toEqual(['number', 'number', 'unknown']);
    expect(
      typesOf(Database.MSSQL, [
        'bit',
        'money',
        'uniqueidentifier',
        'datetimeoffset',
        'varbinary(16)',
      ])
    ).toEqual(['boolean', 'string', 'string', 'string', 'string']);
    expect(
      typesOf(Database.Snowflake, ['VARIANT', 'NUMBER(10,2)', 'NUMBER'])
    ).toEqual(['unknown', 'string', 'number']);
    expect(typesOf(Database.Databricks, ['VOID', 'STRUCT<a:INT>'])).toEqual([
      'null',
      'unknown',
    ]);
  });

  it('writes one array type for each PostgreSQL array dimension', () => {
    expect(
      typesOf(Database.PostgreSQL, [
        'int[]',
        'text[][]',
        'integer ARRAY',
        'numeric(10,2)[]',
        'jsonb[]',
        "enum('a','b')[]",
        "enum('only')[]",
        '"mood"[]',
      ])
    ).toEqual([
      'number[]',
      'string[][]',
      'number[]',
      'string[]',
      'unknown[]',
      '("a" | "b")[]',
      '"only"[]',
      'string[]',
    ]);
  });

  it('adds no null union where the type holds null already', () => {
    const state = createState(Database.PostgreSQL);
    const table = addTable(state, {
      id: 't-nullable',
      name: 'nullable',
      columns: [
        { name: 'data', dataType: 'jsonb' },
        { name: 'list', dataType: 'jsonb[]' },
        { name: 'tags', dataType: 'text[]' },
        { name: 'mood', dataType: "enum('sad','ok')" },
      ],
    });

    expect(format(state, table)).toEqual([
      'export interface Nullable {',
      '  data: unknown;',
      '  list: unknown[] | null;',
      '  tags: string[] | null;',
      '  mood: "sad" | "ok" | null;',
      '}',
    ]);

    const databricks = createState(Database.Databricks);
    const voidTable = addTable(databricks, {
      id: 't-void',
      name: 'nothing',
      columns: [{ name: 'v', dataType: 'VOID' }],
    });

    expect(format(databricks, voidTable)).toEqual([
      'export interface Nothing {',
      '  v: null;',
      '}',
    ]);
  });

  it('reads a primary key as NOT NULL with its NN flag set or not', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-keys',
      name: 'keys',
      columns: [
        { name: 'id', dataType: 'INT', options: ColumnOption.primaryKey },
        { name: 'flag', dataType: 'BOOLEAN', comment: 'a flag' },
      ],
    });

    expect(format(state, table)).toEqual([
      'export interface Keys {',
      '  id: number;',
      '  // a flag',
      '  flag: boolean | null;',
      '}',
    ]);
  });

  it('writes enum members as JSON string literals', () => {
    expect(
      typesOf(Database.MySQL, [
        "ENUM('it''s','a\\\\b','say \"hi\"')",
        "ENUM('a ','a','b')",
      ])
    ).toEqual(['"it\'s" | "a\\\\b" | "say \\"hi\\""', '"a" | "b"']);
  });

  it('writes a comment as one line comment per line, at every line terminator', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-comments',
      name: 'comments',
      comment: '\n\nfirst\r\nsecond\rthird fourth fifth  \n\nlast\n',
      columns: [
        { name: 'a', dataType: 'INT', comment: 'one\ntwo', options: NN },
        { name: 'b', dataType: 'INT', comment: ' \n\t', options: NN },
      ],
    });

    expect(format(state, table)).toEqual([
      '// first',
      '// second',
      '// third',
      '// fourth',
      '// fifth',
      '//',
      '// last',
      'export interface Comments {',
      '  // one',
      '  // two',
      '  a: number;',
      '  b: number;',
      '}',
    ]);
  });

  it('puts a backslash before the at sign of a comment line TypeScript would read as a directive', () => {
    const state = createState();

    addTable(state, {
      id: 't-directives',
      name: 'directives',
      comment: '@TS-NOCHECK\n  @ts-expect-error nope\nsee @ts-ignore',
      columns: [{ name: 'a', dataType: 'INT', comment: '@ts-ignore' }],
    });

    expect(createCode(state)).toBe(
      [
        '',
        '// \\@TS-NOCHECK',
        '//   \\@ts-expect-error nope',
        '// see @ts-ignore',
        'export interface Directives {',
        '  // \\@ts-ignore',
        '  a: number | null;',
        '}',
        '',
      ].join('\n')
    );
  });

  it('puts an underscore after an interface name an ES module refuses', () => {
    const state = createState();

    state.settings.tableNameCase = NameCase.none;
    ['class', 'string', 'let', 'await', 'type', 'as'].forEach(name =>
      addTable(state, { id: `t-${name}`, name })
    );

    expect(createCode(state)).toBe(
      [
        '',
        'export interface as {',
        '}',
        '',
        'export interface await_ {',
        '}',
        '',
        'export interface class_ {',
        '}',
        '',
        'export interface let_ {',
        '}',
        '',
        'export interface string_ {',
        '}',
        '',
        'export interface type {',
        '}',
        '',
      ].join('\n')
    );
  });

  it('quotes a key that is no identifier and writes other names as is', () => {
    const state = createState();

    state.settings.tableNameCase = NameCase.none;
    state.settings.columnNameCase = NameCase.none;
    const table = addTable(state, {
      id: 't-names',
      name: '3d models',
      columns: [
        { name: 'first name', dataType: 'INT', options: NN },
        { name: '2fa_enabled', dataType: 'BOOLEAN', options: NN },
        { name: '', dataType: 'INT', options: NN },
        { name: 'class', dataType: 'INT', options: NN },
        { name: 'ñandú', dataType: 'INT', options: NN },
        { name: '__proto__', dataType: 'INT', options: NN },
      ],
    });

    expect(format(state, table)).toEqual([
      'export interface 3d models {',
      '  "first name": number;',
      '  "2fa_enabled": boolean;',
      '  "": number;',
      '  class: number;',
      '  ñandú: number;',
      '  __proto__: number;',
      '}',
    ]);
  });

  it('applies the configured table and column name cases', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.pascalCase;
    const table = addTable(state, {
      id: 't-user-profile',
      name: 'UserProfile',
      columns: [{ name: 'user_id', dataType: 'INT', options: NN }],
    });

    expect(format(state, table)).toEqual([
      'export interface user_profile {',
      '  UserId: number;',
      '}',
    ]);
  });
});
