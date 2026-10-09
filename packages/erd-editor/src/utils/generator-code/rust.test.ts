import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createCode,
  formatComment,
  formatTable,
  toRustIdentifier,
  toStructName,
} from '@/utils/generator-code/rust';

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
const AI = ColumnOption.autoIncrement;
const DERIVE = '#[derive(Debug, Clone, PartialEq)]';

function createState(database: number = Database.MySQL): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;

  state.settings.database = database;
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

function createMembers(): RootState {
  const state = createState(Database.MySQL);

  addTable(state, {
    id: 'user',
    name: 'user',
    comment: 'Members who sign in',
    columns: [
      {
        name: 'id',
        dataType: 'BIGINT',
        options: PK | AI,
        comment: 'Surrogate key',
      },
      { name: 'created_at', dataType: 'DATETIME', options: NN },
      {
        name: 'nickname',
        dataType: 'VARCHAR(50)',
        comment: 'Shown\nto others',
      },
      { name: 'balance', dataType: 'DECIMAL(10,2)', options: NN },
      { name: 'age', dataType: 'TINYINT UNSIGNED' },
      { name: 'last_seen', dataType: 'TIMESTAMP' },
      { name: 'profile', dataType: 'JSON' },
      { name: 'type', dataType: "ENUM('admin','member')", options: NN },
      { name: 'self', dataType: 'TINYINT(1)' },
    ],
  });
  addTable(state, {
    id: 'audit',
    name: 'audit_log',
    comment: 'Empty on purpose',
  });
  addTable(state, {
    id: 'string',
    name: 'string',
    columns: [{ name: 'value', dataType: 'TEXT', options: NN }],
  });

  return state;
}

const USER = [
  '// Members who sign in',
  DERIVE,
  'pub struct User {',
  '    // Surrogate key',
  '    pub id: i64,',
  '    pub createdAt: chrono::NaiveDateTime,',
  '    // Shown',
  '    // to others',
  '    pub nickname: Option<String>,',
  '    pub balance: rust_decimal::Decimal,',
  '    pub age: Option<u8>,',
  '    pub lastSeen: Option<chrono::DateTime<chrono::Utc>>,',
  '    pub profile: Option<serde_json::Value>,',
  '    pub r#type: String,',
  '    pub self_: Option<i8>,',
  '}',
];

describe('rust generator', () => {
  describe('createCode', () => {
    it('writes nothing for an empty document', () => {
      expect(createCode(createState())).toBe('');
    });

    it('writes each table by name, a blank line before each', () => {
      expect(createCode(createMembers()).split('\n')).toEqual([
        '',
        '// Empty on purpose',
        DERIVE,
        'pub struct AuditLog {}',
        '',
        DERIVE,
        'pub struct String_ {',
        '    pub value: String,',
        '}',
        '',
        ...USER,
        '',
      ]);
    });
  });

  describe('formatTable', () => {
    it('writes one struct as the whole text writes it', () => {
      const state = createMembers();
      const table = state.collections.tableEntities.user;

      expect(tableLines(state, table)).toEqual(USER);
    });

    it('takes a primary key as NOT NULL and an array as a Vec', () => {
      const state = createState(Database.PostgreSQL);
      state.settings.columnNameCase = NameCase.snakeCase;
      const table = addTable(state, {
        id: 'event',
        name: 'event',
        columns: [
          { name: 'id', dataType: 'uuid', options: ColumnOption.primaryKey },
          { name: 'tags', dataType: 'text[]', options: NN },
          { name: 'grid', dataType: 'int[][]' },
          { name: 'opens_at', dataType: 'time with time zone' },
          { name: 'seq', dataType: 'smallserial', options: NN },
        ],
      });

      expect(tableLines(state, table)).toEqual([
        DERIVE,
        'pub struct Event {',
        '    pub id: uuid::Uuid,',
        '    pub tags: Vec<String>,',
        '    pub grid: Option<Vec<Vec<i32>>>,',
        '    pub opens_at: Option<String>,',
        '    pub seq: i16,',
        '}',
      ]);
    });
  });

  describe('names', () => {
    it.each([
      [NameCase.none, NameCase.none, 'user_account', 'createdAt'],
      [NameCase.pascalCase, NameCase.snakeCase, 'UserAccount', 'created_at'],
      [NameCase.camelCase, NameCase.camelCase, 'userAccount', 'createdAt'],
      [NameCase.snakeCase, NameCase.pascalCase, 'user_account', 'CreatedAt'],
    ])(
      'follows table case %i and column case %i',
      (tableNameCase, columnNameCase, struct, field) => {
        const state = createState();
        state.settings.tableNameCase = tableNameCase;
        state.settings.columnNameCase = columnNameCase;
        const table = addTable(state, {
          id: 't',
          name: 'user_account',
          columns: [{ name: 'createdAt', dataType: 'INT', options: NN }],
        });

        expect(tableLines(state, table).slice(1, 3)).toEqual([
          `pub struct ${struct} {`,
          `    pub ${field}: i32,`,
        ]);
      }
    );

    it('writes a keyword of any edition as a raw identifier', () => {
      expect(
        ['type', 'gen', 'async', 'try', 'match'].map(toRustIdentifier)
      ).toEqual(['r#type', 'r#gen', 'r#async', 'r#try', 'r#match']);
      expect(['union', 'macro_rules', 'Type'].map(toRustIdentifier)).toEqual([
        'union',
        'macro_rules',
        'Type',
      ]);
    });

    it('puts an underscore after a name no raw identifier takes', () => {
      expect(
        ['_', 'crate', 'self', 'Self', 'super'].map(toRustIdentifier)
      ).toEqual(['__', 'crate_', 'self_', 'Self_', 'super_']);
    });

    it.each([
      'Option',
      'String',
      'Vec',
      'bool',
      'chrono',
      'f32',
      'f64',
      'i16',
      'i32',
      'i64',
      'i8',
      'rust_decimal',
      'serde_json',
      'u16',
      'u32',
      'u64',
      'u8',
      'uuid',
    ])('suffixes a struct named %s, a type the output writes', name => {
      expect(toStructName(name)).toBe(`${name}_`);
    });

    it('leaves a struct named after any other type as it is', () => {
      expect(
        ['char', 'Decimal', 'Uuid', 'Debug', 'I32'].map(toStructName)
      ).toEqual(['char', 'Decimal', 'Uuid', 'Debug', 'I32']);
      expect(toStructName('self')).toBe('self_');
    });

    it('checks keywords after the name case is applied', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'self',
        columns: [{ name: 'Self', dataType: 'INT', options: NN }],
      });

      expect(tableLines(state, table).slice(1, 3)).toEqual([
        'pub struct Self_ {',
        '    pub self_: i32,',
      ]);
    });

    it('writes a name that is no identifier, or a repeated one, as is', () => {
      const state = createState();
      state.settings.tableNameCase = NameCase.none;
      state.settings.columnNameCase = NameCase.none;
      addTable(state, { id: 'a', name: 'User' });
      addTable(state, {
        id: 'b',
        name: 'user',
        columns: [{ name: '1st', dataType: 'INT', options: NN }],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        DERIVE,
        'pub struct User {}',
        '',
        DERIVE,
        'pub struct user {',
        '    pub 1st: i32,',
        '}',
        '',
      ]);
    });
  });

  describe('comments', () => {
    it('writes line comments, trimmed at their ends and their outer blank lines', () => {
      const buffer: string[] = [];

      formatComment(
        buffer,
        '',
        '\n  Title line   \r\n\r\n    indented code\rlast \u202Eline\n\n'
      );
      expect(buffer).toEqual([
        '//   Title line',
        '//',
        '//     indented code',
        '// last \\u{202E}line',
      ]);
    });

    it('escapes every bidirectional control and keeps a mark', () => {
      const buffer: string[] = [];

      formatComment(buffer, '', '\u202A\u202E\u2066\u2069\u200E');
      expect(buffer).toEqual(['// \\u{202A}\\u{202E}\\u{2066}\\u{2069}\u200E']);
    });

    it('writes no line for a blank comment and indents a column comment', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'note',
        comment: ' \r\n ',
        columns: [
          {
            name: 'body',
            dataType: 'TEXT',
            comment: '  // already a comment\n/// not a doc comment',
          },
        ],
      });

      expect(tableLines(state, table)).toEqual([
        DERIVE,
        'pub struct Note {',
        '    //   // already a comment',
        '    // /// not a doc comment',
        '    pub body: Option<String>,',
        '}',
      ]);
    });
  });
});
