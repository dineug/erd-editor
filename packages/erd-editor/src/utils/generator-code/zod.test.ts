import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { getJsonShape } from '@/utils/generator-code/jsonShape';
import {
  createCode,
  createTableCode,
  formatComment,
  formatTable,
  toZodPropertyKey,
  toZodSchema,
  toZodTypeName,
} from '@/utils/generator-code/zod';

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

const PK = ColumnOption.primaryKey | ColumnOption.notNull;
const NN = ColumnOption.notNull;
const IMPORT = 'import * as z from "zod";';

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

function createState(database: number = PostgreSQL): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;

  state.settings.database = database;
  state.settings.tableNameCase = NameCase.pascalCase;
  state.settings.columnNameCase = NameCase.camelCase;
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

function tableLines(state: RootState, table: Table): string[] {
  const buffer: string[] = [];

  formatTable(state, { buffer, table });
  return buffer;
}

function schemaOf(dataType: string, database: number): string {
  return toZodSchema(getJsonShape(dataType, database));
}

function createBlog(): RootState {
  const state = createState(PostgreSQL);

  addTable(state, {
    id: 'member',
    name: 'member',
    comment: 'Registered users',
    columns: [
      { name: 'id', dataType: 'uuid', options: PK },
      {
        name: 'email',
        dataType: 'varchar(255)',
        options: NN,
        comment: 'Login e-mail, unique',
      },
      { name: 'display_name', dataType: 'varchar(50)' },
      { name: 'birth_date', dataType: 'date' },
      { name: 'is_active', dataType: 'boolean', options: NN },
      { name: 'created_at', dataType: 'timestamptz', options: NN },
    ],
  });
  addTable(state, {
    id: 'post',
    name: 'post',
    columns: [
      { name: 'id', dataType: 'bigserial', options: PK },
      { name: 'member_id', dataType: 'uuid', options: NN },
      { name: 'title', dataType: 'varchar(200)', options: NN },
      { name: 'body', dataType: 'text' },
      { name: 'tags', dataType: 'text[]', options: NN },
      { name: 'metadata', dataType: 'jsonb' },
      { name: 'price', dataType: 'numeric(10,2)' },
      { name: 'view_count', dataType: 'integer', options: NN },
      {
        name: 'published_at',
        dataType: 'timestamp',
        comment: 'Local time of the newsroom\nnull while a draft',
      },
    ],
  });
  addTable(state, {
    id: 'attachment',
    name: 'post_attachment',
    columns: [
      { name: 'id', dataType: 'serial', options: ColumnOption.primaryKey },
      { name: 'post_id', dataType: 'bigint', options: NN },
      { name: 'file_name', dataType: 'varchar(255)', options: NN },
      { name: 'content', dataType: 'bytea', options: NN },
      { name: 'size_bytes', dataType: 'bigint', options: NN },
    ],
  });

  return state;
}

describe('createCode', () => {
  it('writes a row schema and its inferred type for each table, by name', () => {
    expect(createCode(createBlog())).toBe(
      [
        '',
        IMPORT,
        '',
        '// Registered users',
        'export const MemberSchema = z.object({',
        '  id: z.uuid(),',
        '  // Login e-mail, unique',
        '  email: z.string().max(255),',
        '  displayName: z.string().max(50).nullable(),',
        '  birthDate: z.iso.date().nullable(),',
        '  isActive: z.boolean(),',
        '  createdAt: z.iso.datetime({ offset: true }),',
        '});',
        'export type Member = z.infer<typeof MemberSchema>;',
        '',
        'export const PostSchema = z.object({',
        '  id: z.int(),',
        '  memberId: z.uuid(),',
        '  title: z.string().max(200),',
        '  body: z.string().nullable(),',
        '  tags: z.array(z.string()),',
        '  metadata: z.json().nullable(),',
        '  price: z.string().nullable(),',
        '  viewCount: z.int32(),',
        '  // Local time of the newsroom',
        '  // null while a draft',
        '  publishedAt: z.iso.datetime({ local: true }).nullable(),',
        '});',
        'export type Post = z.infer<typeof PostSchema>;',
        '',
        'export const PostAttachmentSchema = z.object({',
        '  id: z.int32(),',
        '  postId: z.int(),',
        '  fileName: z.string().max(255),',
        '  content: z.base64(),',
        '  sizeBytes: z.int(),',
        '});',
        'export type PostAttachment = z.infer<typeof PostAttachmentSchema>;',
        '',
      ].join('\n')
    );
  });

  it('writes MySQL ENUM, SET, unsigned and TINYINT(1) by the type', () => {
    const state = createState(MySQL);

    addTable(state, {
      id: 'account',
      name: 'account',
      columns: [
        { name: 'id', dataType: 'INT UNSIGNED', options: PK },
        { name: 'role', dataType: "ENUM('admin','member')", options: NN },
        { name: 'is_verified', dataType: 'TINYINT(1)', options: NN },
        { name: 'flags', dataType: "SET('a','b')" },
        { name: 'score', dataType: 'SMALLINT UNSIGNED' },
        { name: 'joined_on', dataType: 'DATE', options: NN },
        { name: 'updated_at', dataType: 'TIMESTAMP', options: NN },
        { name: 'country', dataType: 'CHAR(2)', options: NN },
      ],
    });

    expect(createCode(state)).toBe(
      [
        '',
        IMPORT,
        '',
        'export const AccountSchema = z.object({',
        '  id: z.uint32(),',
        '  role: z.enum(["admin", "member"]),',
        '  isVerified: z.int().min(-128).max(127),',
        '  flags: z.string().nullable(),',
        '  score: z.int().min(0).max(65535).nullable(),',
        '  joinedOn: z.iso.date(),',
        '  updatedAt: z.iso.datetime({ offset: true }),',
        '  country: z.string().max(2),',
        '});',
        'export type Account = z.infer<typeof AccountSchema>;',
        '',
      ].join('\n')
    );
  });

  it('writes nothing for a document with no table', () => {
    expect(createCode(createState())).toBe('');
  });
});

describe('createTableCode', () => {
  it('writes one table under the import line, so it compiles alone', () => {
    const state = createBlog();
    const table = state.collections.tableEntities.attachment;

    expect(createTableCode(state, table)).toBe(
      [
        '',
        IMPORT,
        '',
        'export const PostAttachmentSchema = z.object({',
        '  id: z.int32(),',
        '  postId: z.int(),',
        '  fileName: z.string().max(255),',
        '  content: z.base64(),',
        '  sizeBytes: z.int(),',
        '});',
        'export type PostAttachment = z.infer<typeof PostAttachmentSchema>;',
        '',
      ].join('\n')
    );
  });
});

describe('formatTable', () => {
  it('writes an empty object for a table with no column', () => {
    const state = createState();
    const table = addTable(state, {
      id: 'audit',
      name: 'audit_log',
      comment: 'Empty on purpose',
    });

    expect(tableLines(state, table)).toEqual([
      '// Empty on purpose',
      'export const AuditLogSchema = z.object({});',
      'export type AuditLog = z.infer<typeof AuditLogSchema>;',
    ]);
  });

  it('adds nullable where neither the NN flag nor a primary key is set', () => {
    const state = createState(MySQL);
    const table = addTable(state, {
      id: 't',
      name: 't',
      columns: [
        { name: 'a', dataType: 'INT', options: ColumnOption.primaryKey },
        { name: 'b', dataType: 'INT', options: NN },
        { name: 'c', dataType: 'INT', options: ColumnOption.autoIncrement },
        { name: 'd', dataType: 'JSON' },
        { name: 'e', dataType: "ENUM('x')" },
      ],
    });

    expect(tableLines(state, table).slice(1, -2)).toEqual([
      '  a: z.int32(),',
      '  b: z.int32(),',
      '  c: z.int32().nullable(),',
      '  d: z.json().nullable(),',
      '  e: z.enum(["x"]).nullable(),',
    ]);
  });

  it('writes a null-only column with nullable too, like every other one', () => {
    const state = createState(Databricks);
    const table = addTable(state, {
      id: 't',
      name: 't',
      columns: [
        { name: 'a', dataType: 'VOID', options: NN },
        { name: 'b', dataType: 'VOID' },
      ],
    });

    expect(tableLines(state, table).slice(1, -2)).toEqual([
      '  a: z.null(),',
      '  b: z.null().nullable(),',
    ]);
  });

  it('repairs only the names a type alias refuses, and quotes keys', () => {
    const state = createState(PostgreSQL);

    state.settings.tableNameCase = NameCase.none;
    state.settings.columnNameCase = NameCase.none;

    const table = addTable(state, {
      id: 'class',
      name: 'class',
      columns: [
        { name: 'class', dataType: 'int', options: NN },
        { name: 'order-no', dataType: 'int', options: NN },
        { name: '__proto__', dataType: 'int', options: NN },
        { name: '', dataType: 'int', options: NN },
        { name: '주소1', dataType: 'text', options: NN },
      ],
    });

    expect(tableLines(state, table)).toEqual([
      'export const class_Schema = z.object({',
      '  class: z.int32(),',
      '  "order-no": z.int32(),',
      '  ["__proto__"]: z.int32(),',
      '  "": z.int32(),',
      '  주소1: z.string(),',
      '});',
      'export type class_ = z.infer<typeof class_Schema>;',
    ]);
  });

  it('writes a repeated name as is, which tsc then reports', () => {
    const state = createState(PostgreSQL);
    const table = addTable(state, {
      id: 'user',
      name: 'user',
      columns: [
        { name: 'user_id', dataType: 'int', options: NN },
        { name: 'userId', dataType: 'int', options: NN },
      ],
    });

    addTable(state, { id: 'User', name: 'User' });

    expect(tableLines(state, table)).toEqual([
      'export const UserSchema = z.object({',
      '  userId: z.int32(),',
      '  userId: z.int32(),',
      '});',
      'export type User = z.infer<typeof UserSchema>;',
    ]);
    expect(createCode(state).match(/export type User =/g)).toHaveLength(2);
  });
});

describe('formatComment', () => {
  function commentLines(comment: string, indent = ''): string[] {
    const buffer: string[] = [];

    formatComment(buffer, indent, comment);
    return buffer;
  }

  it('writes a line comment for each line, at every ECMAScript terminator', () => {
    expect(commentLines('a\r\nb\rc\nd\u2028e\u2029f', '  ')).toEqual([
      '  // a',
      '  // b',
      '  // c',
      '  // d',
      '  // e',
      '  // f',
    ]);
  });

  it('drops blank lines around the text and trailing spaces, keeping inner ones', () => {
    expect(commentLines('\n  \nfirst  \n\n*/ second\n\n')).toEqual([
      '// first',
      '//',
      '// */ second',
    ]);
  });

  it('writes nothing for a blank comment', () => {
    expect(commentLines('')).toEqual([]);
    expect(commentLines(' \n\t')).toEqual([]);
  });

  it('writes a line opening with a TypeScript directive as is', () => {
    expect(commentLines('a\n@ts-expect-error nope\n  @ts-ignore')).toEqual([
      '// a',
      '// @ts-expect-error nope',
      '//   @ts-ignore',
    ]);
  });
});

describe('toZodSchema', () => {
  it.each([
    [PostgreSQL, 'boolean', 'z.boolean()'],
    [MySQL, 'TINYINT', 'z.int().min(-128).max(127)'],
    [MySQL, 'TINYINT UNSIGNED', 'z.int().min(0).max(255)'],
    [MySQL, 'SMALLINT', 'z.int().min(-32768).max(32767)'],
    [MySQL, 'YEAR', 'z.int().min(0).max(65535)'],
    [MySQL, 'MEDIUMINT', 'z.int().min(-8388608).max(8388607)'],
    [MySQL, 'MEDIUMINT UNSIGNED', 'z.int().min(0).max(16777215)'],
    [MySQL, 'INT', 'z.int32()'],
    [MySQL, 'INT UNSIGNED', 'z.uint32()'],
    [MySQL, 'BIGINT', 'z.int()'],
    [MySQL, 'BIGINT UNSIGNED', 'z.int().min(0)'],
    [MySQL, 'SERIAL', 'z.int().min(0)'],
    [PostgreSQL, 'oid', 'z.uint32()'],
    [PostgreSQL, 'xid8', 'z.string()'],
    [Oracle, 'INTEGER', 'z.int()'],
    [Oracle, 'NUMBER(10,2)', 'z.string()'],
    [Snowflake, 'TINYINT', 'z.int()'],
    [SQLite, 'INTEGER', 'z.int()'],
    [SQLite, 'DECIMAL(10,2)', 'z.number()'],
    [PostgreSQL, 'double precision', 'z.number()'],
    [PostgreSQL, 'numeric(10,2)', 'z.string()'],
    [MSSQL, 'nvarchar(100)', 'z.string().max(100)'],
    [MSSQL, 'nvarchar(max)', 'z.string()'],
    [PostgreSQL, 'uuid', 'z.uuid()'],
    [MSSQL, 'uniqueidentifier', 'z.guid()'],
    [PostgreSQL, 'date', 'z.iso.date()'],
    [PostgreSQL, 'time', 'z.iso.time()'],
    [PostgreSQL, 'timetz', 'z.string()'],
    [PostgreSQL, 'interval', 'z.string()'],
    [PostgreSQL, 'timestamp', 'z.iso.datetime({ local: true })'],
    [Oracle, 'DATE', 'z.iso.datetime({ local: true })'],
    [MySQL, 'TIMESTAMP', 'z.iso.datetime({ offset: true })'],
    [PostgreSQL, 'timestamptz', 'z.iso.datetime({ offset: true })'],
    [PostgreSQL, 'bytea', 'z.base64()'],
    [PostgreSQL, 'jsonb', 'z.json()'],
    [Databricks, 'MAP<STRING,INT>', 'z.json()'],
    [MariaDB, 'INET4', 'z.ipv4()'],
    [MariaDB, 'INET6', 'z.ipv6()'],
    [Databricks, 'VOID', 'z.null()'],
    [MySQL, "ENUM('it''s','a\"b','')", 'z.enum(["it\'s", "a\\"b", ""])'],
    [MariaDB, "ENUM('draft ','live')", 'z.enum(["draft", "live"])'],
    [PostgreSQL, "enum('draft ')", 'z.enum(["draft "])'],
    [PostgreSQL, 'int[][]', 'z.array(z.array(z.int32()))'],
    [PostgreSQL, 'varchar(20)[]', 'z.array(z.string().max(20))'],
    [PostgreSQL, "enum('a','b')[]", 'z.array(z.enum(["a", "b"]))'],
  ])('writes %i %s as %s', (database, dataType, schema) => {
    expect(schemaOf(dataType, database)).toBe(schema);
  });
});

describe('toZodTypeName', () => {
  it('adds an underscore to z, as and every name TypeScript refuses', () => {
    expect(toZodTypeName('z')).toBe('z_');
    expect(toZodTypeName('as')).toBe('as_');
    expect(toZodTypeName('string')).toBe('string_');
    expect(toZodTypeName('await')).toBe('await_');
  });

  it('keeps any other name as the name cases give it', () => {
    expect(toZodTypeName('Z')).toBe('Z');
    expect(toZodTypeName('type')).toBe('type');
    expect(toZodTypeName('order items')).toBe('order items');
  });
});

describe('toZodPropertyKey', () => {
  it('computes __proto__ and quotes what is no identifier name', () => {
    expect(toZodPropertyKey('__proto__')).toBe('["__proto__"]');
    expect(toZodPropertyKey('constructor')).toBe('constructor');
    expect(toZodPropertyKey('a b')).toBe('"a b"');
  });
});
