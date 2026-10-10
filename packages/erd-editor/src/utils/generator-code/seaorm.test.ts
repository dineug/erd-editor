import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { underTurkishLocale } from '@/__test-utils__/locale';
import {
  BracketType,
  ColumnOption,
  Database,
  ReferentialAction,
  RelationshipType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createCode,
  createTableCode,
  derivedColumnName,
  getEntityColumnType,
  rustString,
  stableUpperCamelCase,
} from '@/utils/generator-code/seaorm';

type ColumnInput = [
  name: string,
  dataType: string,
  options?: number,
  comment?: string,
];

type TableInput = {
  id: string;
  name: string;
  comment?: string;
  columns?: ColumnInput[];
};

type RelationshipInput = {
  id: string;
  start: [tableId: string, columnIndexes: number[]];
  end: [tableId: string, columnIndexes: number[]];
  relationshipType?: number;
  onDelete?: number;
  onUpdate?: number;
};

const PK = ColumnOption.primaryKey | ColumnOption.notNull;
const NN = ColumnOption.notNull;
const AI = ColumnOption.autoIncrement;
const UQ = ColumnOption.unique;
const { ZeroOne, ZeroN, OneN } = RelationshipType;
const { cascade, setNull, setDefault, restrict, noAction } = ReferentialAction;

const USE = 'use sea_orm::entity::prelude::*;';
const MODEL = '#[sea_orm::model]';
const DERIVE_EQ = '#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]';
const DERIVE = '#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]';
const IMPL = 'impl ActiveModelBehavior for ActiveModel {}';

function createState(
  database: number = Database.PostgreSQL,
  bracketType: number = BracketType.none
): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;

  state.settings.database = database;
  state.settings.bracketType = bracketType;
  return state;
}

function addTable(
  state: RootState,
  { id, name, comment = '', columns = [] }: TableInput
): Table {
  const entities = columns.map(
    ([columnName, dataType, options = 0, columnComment = ''], index) =>
      createColumn({
        id: `${id}.${index}`,
        tableId: id,
        name: columnName,
        dataType,
        comment: columnComment,
        options,
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
  {
    id,
    start,
    end,
    relationshipType = ZeroN,
    onDelete = ReferentialAction.none,
    onUpdate = ReferentialAction.none,
  }: RelationshipInput
) {
  state.collections.relationshipEntities[id] = createRelationship({
    id,
    relationshipType,
    onDelete,
    onUpdate,
    start: {
      tableId: start[0],
      columnIds: start[1].map(index => `${start[0]}.${index}`),
    },
    end: {
      tableId: end[0],
      columnIds: end[1].map(index => `${end[0]}.${index}`),
    },
  });
  state.doc.relationshipIds.push(id);
}

function addIndex(
  state: RootState,
  id: string,
  tableId: string,
  name: string,
  unique: boolean,
  columnIndexes: number[]
) {
  const indexColumns = columnIndexes.map((columnIndex, index) =>
    createIndexColumn({
      id: `${id}.${index}`,
      indexId: id,
      columnId: `${tableId}.${columnIndex}`,
    })
  );

  state.collections.indexEntities[id] = createIndex({
    id,
    tableId,
    name,
    unique,
    indexColumnIds: indexColumns.map(indexColumn => indexColumn.id),
    seqIndexColumnIds: indexColumns.map(indexColumn => indexColumn.id),
  });
  indexColumns.forEach(indexColumn => {
    state.collections.indexColumnEntities[indexColumn.id] = indexColumn;
  });
  state.doc.indexIds.push(id);
}

/** The document the generator was compiled and run against on four databases. */
function createShop(database: number): RootState {
  const state = createState(database);

  addTable(state, {
    id: 'users',
    name: 'users',
    comment: 'Registered users',
    columns: [
      ['id', 'BIGINT', PK | AI],
      ['email', 'VARCHAR(255)', NN | UQ, 'Login e-mail'],
      ['name', 'VARCHAR(100)', NN],
      ['managerId', 'BIGINT'],
      ['created_at', 'TIMESTAMP', NN],
    ],
  });
  addTable(state, {
    id: 'profiles',
    name: 'profiles',
    columns: [
      ['user_id', 'BIGINT', PK],
      ['bio', 'TEXT'],
    ],
  });
  addTable(state, {
    id: 'posts',
    name: 'posts',
    columns: [
      ['id', 'INT', PK | AI],
      ['author_id', 'BIGINT', NN],
      ['editor_id', 'BIGINT'],
      ['type', 'VARCHAR(20)', NN],
      ['title', 'VARCHAR(200)', NN],
      ['body', 'TEXT'],
      ['rating', 'REAL'],
      ['price', 'DECIMAL(10,2)'],
      ['metadata', 'JSON'],
    ],
  });
  addTable(state, {
    id: 'tags',
    name: 'tags',
    columns: [
      ['id', 'INT', PK | AI],
      ['name', 'VARCHAR(50)', NN | UQ],
    ],
  });
  addTable(state, {
    id: 'post_tags',
    name: 'post_tags',
    columns: [
      ['post_id', 'INT', PK],
      ['tag_id', 'INT', PK],
    ],
  });
  addTable(state, {
    id: 'orders',
    name: 'orders',
    columns: [
      ['tenant_id', 'INT', PK],
      ['order_no', 'INT', PK],
      ['customer_email', 'VARCHAR(255)'],
    ],
  });
  addTable(state, {
    id: 'order_lines',
    name: 'order_lines',
    columns: [
      ['id', 'BIGINT', PK | AI],
      ['tenant_id', 'INT', NN],
      ['order_no', 'INT', NN],
      ['line_no', 'INT', NN],
      ['quantity', 'SMALLINT', NN],
    ],
  });
  addRelationship(state, {
    id: 'manager',
    start: ['users', [0]],
    end: ['users', [3]],
    onDelete: setNull,
  });
  addRelationship(state, {
    id: 'profile',
    start: ['users', [0]],
    end: ['profiles', [0]],
    relationshipType: ZeroOne,
    onDelete: cascade,
  });
  addRelationship(state, {
    id: 'author',
    start: ['users', [0]],
    end: ['posts', [1]],
    relationshipType: OneN,
    onDelete: cascade,
  });
  addRelationship(state, {
    id: 'editor',
    start: ['users', [0]],
    end: ['posts', [2]],
    onDelete: setNull,
  });
  addRelationship(state, {
    id: 'post',
    start: ['posts', [0]],
    end: ['post_tags', [0]],
    onDelete: cascade,
  });
  addRelationship(state, {
    id: 'tag',
    start: ['tags', [0]],
    end: ['post_tags', [1]],
    onDelete: cascade,
  });
  addRelationship(state, {
    id: 'customer',
    start: ['users', [1]],
    end: ['orders', [2]],
    onDelete: setNull,
    onUpdate: cascade,
  });
  addRelationship(state, {
    id: 'lines',
    start: ['orders', [0, 1]],
    end: ['order_lines', [1, 2]],
    relationshipType: OneN,
    onDelete: cascade,
  });
  addIndex(
    state,
    'line',
    'order_lines',
    'UQ_order_lines_line',
    true,
    [1, 2, 3]
  );

  return state;
}

function tableOf(state: RootState, id: string): string[] {
  return createTableCode(state, state.collections.tableEntities[id]).split(
    '\n'
  );
}

/** The struct body of one table's entity, between its braces. */
function bodyOf(state: RootState, id: string): string[] {
  const lines = tableOf(state, id);
  return lines.slice(
    lines.indexOf('pub struct Model {') + 1,
    lines.indexOf('}')
  );
}

/** The lines one column of the given type writes in a table keyed by id. */
function columnOf(
  database: number,
  dataType: string,
  options: number = NN,
  comment = ''
): string[] {
  const state = createState(database);
  addTable(state, {
    id: 't',
    name: 't',
    columns: [
      ['id', 'INT', PK | AI],
      ['v', dataType, options, comment],
    ],
  });
  return bodyOf(state, 't').slice(2);
}

const USERS = [
  '',
  USE,
  '',
  MODEL,
  DERIVE_EQ,
  '#[sea_orm(table_name = "users", comment = "Registered users")]',
  'pub struct Model {',
  '    #[sea_orm(primary_key)]',
  '    pub id: i64,',
  '    #[sea_orm(',
  '        column_type = "String(StringLen::N(255))",',
  '        unique,',
  '        comment = "Login e-mail"',
  '    )]',
  '    pub email: String,',
  '    #[sea_orm(column_type = "String(StringLen::N(100))")]',
  '    pub name: String,',
  '    #[sea_orm(column_name = "managerid")]',
  '    pub manager_id: Option<i64>,',
  '    pub created_at: DateTime,',
  '    #[sea_orm(',
  '        self_ref,',
  '        relation_enum = "Manager",',
  '        relation_reverse = "UsersByManagerList",',
  '        from = "manager_id",',
  '        to = "id",',
  '        on_delete = "SetNull"',
  '    )]',
  '    pub manager: BelongsTo<Option<Entity>>,',
  '    #[sea_orm(',
  '        self_ref,',
  '        relation_enum = "UsersByManagerList",',
  '        relation_reverse = "Manager"',
  '    )]',
  '    pub users_by_manager_list: HasMany<Entity>,',
  '    #[sea_orm(has_one)]',
  '    pub profiles: HasOne<super::profiles::Entity>,',
  '    #[sea_orm(has_many, relation_enum = "PostsByAuthorList", via_rel = "Author")]',
  '    pub posts_by_author_list: HasMany<super::posts::Entity>,',
  '    #[sea_orm(has_many, relation_enum = "PostsByEditorList", via_rel = "Editor")]',
  '    pub posts_by_editor_list: HasMany<super::posts::Entity>,',
  '    #[sea_orm(has_many)]',
  '    pub orders_list: HasMany<super::orders::Entity>,',
  '}',
  '',
  IMPL,
  '',
];

const POSTS = [
  '',
  USE,
  '',
  MODEL,
  DERIVE,
  '#[sea_orm(table_name = "posts")]',
  'pub struct Model {',
  '    #[sea_orm(primary_key)]',
  '    pub id: i32,',
  '    pub author_id: i64,',
  '    pub editor_id: Option<i64>,',
  '    #[sea_orm(column_type = "String(StringLen::N(20))")]',
  '    pub type_: String,',
  '    #[sea_orm(column_type = "String(StringLen::N(200))")]',
  '    pub title: String,',
  '    #[sea_orm(column_type = "Text")]',
  '    pub body: Option<String>,',
  '    pub rating: Option<f32>,',
  '    #[sea_orm(column_type = "Decimal(Some((10, 2)))")]',
  '    pub price: Option<Decimal>,',
  '    pub metadata: Option<Json>,',
  '    #[sea_orm(',
  '        belongs_to,',
  '        relation_enum = "Author",',
  '        from = "author_id",',
  '        to = "id",',
  '        on_delete = "Cascade"',
  '    )]',
  '    pub author: BelongsTo<super::users::Entity>,',
  '    #[sea_orm(',
  '        belongs_to,',
  '        relation_enum = "Editor",',
  '        from = "editor_id",',
  '        to = "id",',
  '        on_delete = "SetNull"',
  '    )]',
  '    pub editor: BelongsTo<Option<super::users::Entity>>,',
  '    #[sea_orm(has_many)]',
  '    pub post_tags_list: HasMany<super::post_tags::Entity>,',
  '}',
  '',
  IMPL,
  '',
];

describe('seaorm generator', () => {
  describe('createCode', () => {
    it('writes nothing for an empty document', () => {
      expect(createCode(createState())).toBe('');
    });

    it('wraps each table, by name, in a module of its entity', () => {
      const lines = createCode(createShop(Database.PostgreSQL)).split('\n');

      expect(lines.filter(line => line.startsWith('pub mod '))).toEqual([
        'pub mod order_lines {',
        'pub mod orders {',
        'pub mod post_tags {',
        'pub mod posts {',
        'pub mod profiles {',
        'pub mod tags {',
        'pub mod users {',
      ]);
      expect(lines.slice(0, 2)).toEqual(['', 'pub mod order_lines {']);
      expect(lines.slice(-3)).toEqual(['    ' + IMPL, '}', '']);
    });

    it('holds in each module what its one-table view writes, indented', () => {
      const state = createShop(Database.PostgreSQL);
      const code = createCode(state);
      const users = USERS.slice(1, -1).map(line => (line ? `    ${line}` : ''));

      expect(code).toContain(['pub mod users {', ...users, '}'].join('\n'));
    });
  });

  describe('createTableCode', () => {
    it('writes the entity a module file holds, as rustfmt lays it out', () => {
      const state = createShop(Database.PostgreSQL);

      expect(tableOf(state, 'users')).toEqual(USERS);
      expect(tableOf(state, 'posts')).toEqual(POSTS);
    });

    it('writes the composite keys, unique key and composite foreign key', () => {
      const state = createShop(Database.PostgreSQL);

      expect(bodyOf(state, 'order_lines')).toEqual([
        '    #[sea_orm(primary_key)]',
        '    pub id: i64,',
        '    #[sea_orm(unique_key = "uq_order_lines_line")]',
        '    pub tenant_id: i32,',
        '    #[sea_orm(unique_key = "uq_order_lines_line")]',
        '    pub order_no: i32,',
        '    #[sea_orm(unique_key = "uq_order_lines_line")]',
        '    pub line_no: i32,',
        '    pub quantity: i16,',
        '    #[sea_orm(',
        '        belongs_to,',
        '        from = "(tenant_id, order_no)",',
        '        to = "(tenant_id, order_no)",',
        '        on_delete = "Cascade"',
        '    )]',
        '    pub orders: BelongsTo<super::orders::Entity>,',
      ]);
      expect(bodyOf(state, 'orders')).toEqual([
        '    #[sea_orm(primary_key, auto_increment = false)]',
        '    pub tenant_id: i32,',
        '    #[sea_orm(primary_key, auto_increment = false)]',
        '    pub order_no: i32,',
        '    #[sea_orm(column_type = "String(StringLen::N(255))")]',
        '    pub customer_email: Option<String>,',
        '    #[sea_orm(',
        '        belongs_to,',
        '        from = "customer_email",',
        '        to = "email",',
        '        on_update = "Cascade",',
        '        on_delete = "SetNull"',
        '    )]',
        '    pub users: BelongsTo<Option<super::users::Entity>>,',
        '    #[sea_orm(has_many)]',
        '    pub order_lines_list: HasMany<super::order_lines::Entity>,',
      ]);
      expect(bodyOf(state, 'post_tags')).toEqual([
        '    #[sea_orm(primary_key, auto_increment = false)]',
        '    pub post_id: i32,',
        '    #[sea_orm(primary_key, auto_increment = false)]',
        '    pub tag_id: i32,',
        '    #[sea_orm(belongs_to, from = "post_id", to = "id", on_delete = "Cascade")]',
        '    pub posts: BelongsTo<super::posts::Entity>,',
        '    #[sea_orm(belongs_to, from = "tag_id", to = "id", on_delete = "Cascade")]',
        '    pub tags: BelongsTo<super::tags::Entity>,',
      ]);
    });

    it('spells MySQL and MariaDB names and types as they store them', () => {
      for (const database of [Database.MySQL, Database.MariaDB]) {
        const state = createShop(database);

        expect(bodyOf(state, 'users').slice(10, 13)).toEqual([
          '    #[sea_orm(column_name = "managerId")]',
          '    pub manager_id: Option<i64>,',
          '    pub created_at: DateTimeUtc,',
        ]);
        expect(bodyOf(state, 'posts')[10]).toBe('    pub rating: Option<f64>,');
      }
    });

    it('writes a SQLite column_type where the affinity differs, and a cast where it may hold a number', () => {
      const state = createShop(Database.SQLite);

      expect(bodyOf(state, 'posts').slice(4, 14)).toEqual([
        '    pub type_: String,',
        '    pub title: String,',
        '    pub body: Option<String>,',
        '    pub rating: Option<f64>,',
        '    #[sea_orm(column_type = "custom(\\"DECIMAL(10,2)\\")", select_as = "REAL")]',
        '    pub price: Option<Decimal>,',
        '    #[sea_orm(column_type = "custom(\\"JSON\\")", select_as = "TEXT")]',
        '    pub metadata: Option<Json>,',
        '    #[sea_orm(',
        '        belongs_to,',
      ]);
      expect(bodyOf(state, 'users').slice(2, 4)).toEqual([
        '    #[sea_orm(unique, comment = "Login e-mail")]',
        '    pub email: String,',
      ]);
      expect(bodyOf(state, 'users').slice(7, 9)).toEqual([
        '    #[sea_orm(column_type = "custom(\\"TIMESTAMP\\")", select_as = "TEXT")]',
        '    pub created_at: String,',
      ]);
    });

    it('writes unique on a key column the database keeps a unique index on', () => {
      const keys = (database: number) => {
        const state = createState(database);
        addTable(state, {
          id: 'a',
          name: 'acct',
          columns: [['id', 'INT', PK | AI | UQ]],
        });
        addTable(state, {
          id: 'b',
          name: 'badge',
          columns: [['id', 'INT', PK | UQ]],
        });
        addTable(state, {
          id: 'c',
          name: 'code',
          columns: [['id', 'integer', PK | UQ]],
        });
        addTable(state, {
          id: 't',
          name: 'tag',
          columns: [['id', 'INT', PK]],
        });
        addIndex(state, 'i', 't', 'UQ_tag_id', true, [0]);
        return ['a', 'b', 'c', 't'].map(id => bodyOf(state, id)[0]);
      };
      const key = '    #[sea_orm(primary_key, auto_increment = false)]';
      const uniqueKey =
        '    #[sea_orm(primary_key, auto_increment = false, unique)]';

      expect(keys(Database.MySQL)).toEqual([
        '    #[sea_orm(primary_key, unique)]',
        uniqueKey,
        uniqueKey,
        uniqueKey,
      ]);
      expect(keys(Database.PostgreSQL)).toEqual([
        '    #[sea_orm(primary_key)]',
        key,
        key,
        uniqueKey,
      ]);
      expect(keys(Database.SQLite)).toEqual([
        '    #[sea_orm(primary_key, unique)]',
        key,
        uniqueKey,
        uniqueKey,
      ]);
    });

    it('writes a table the document does not list, with no relation', () => {
      const state = createShop(Database.PostgreSQL);
      const lost = addTable(state, {
        id: 'lost',
        name: 'users',
        columns: [['id', 'INT', PK]],
      });
      state.doc.tableIds.pop();

      expect(createTableCode(state, lost).split('\n').slice(5, 10)).toEqual([
        '#[sea_orm(table_name = "users")]',
        'pub struct Model {',
        '    #[sea_orm(primary_key, auto_increment = false)]',
        '    pub id: i32,',
        '}',
      ]);
    });

    it('writes a table with no column or no key as it is', () => {
      const state = createState();
      addTable(state, { id: 'e', name: 'empty' });
      addTable(state, {
        id: 'k',
        name: 'keyless',
        columns: [['a', 'INT', NN]],
      });

      expect(tableOf(state, 'e').slice(4, 7)).toEqual([
        DERIVE_EQ,
        '#[sea_orm(table_name = "empty")]',
        'pub struct Model {}',
      ]);
      expect(bodyOf(state, 'k')).toEqual(['    pub a: i32,']);
    });
  });

  describe('names', () => {
    it('names modules in snake case, a keyword or a repeat numbered apart', () => {
      const state = createState();

      [
        'type',
        'self',
        'crate',
        'mod',
        'UserAccount',
        'user_account',
        '2fa tokens',
        '',
        '😀',
      ].forEach((name, index) => addTable(state, { id: `t${index}`, name }));

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line.startsWith('pub mod '))
      ).toEqual([
        'pub mod table {',
        'pub mod table_2fa_tokens {',
        'pub mod crate_ {',
        'pub mod mod_ {',
        'pub mod self_ {',
        'pub mod type_ {',
        'pub mod user_account {',
        'pub mod user_account_2 {',
        'pub mod table_2 {',
      ]);
    });

    it('names fields as DeriveEntityModel reads them, with column_name where it would read another', () => {
      const state = createState();
      addTable(state, {
        id: 't',
        name: 'type',
        columns: [
          ['id', 'INT', PK | AI],
          ['self', 'VARCHAR(10)', NN | UQ],
          ['crate', 'INT'],
          ['Type', 'INT'],
          ['a_1', 'INT'],
          ['a1', 'INT'],
          ['createdAt', 'TIMESTAMPTZ'],
          ['1st', 'INT'],
          ['이름', 'INT'],
          ['"Quoted"', 'INT'],
          ['email address', 'INT'],
          ['', 'INT'],
          ['😀', 'INT'],
          ['x²', 'INT'],
          ['ß', 'INT'],
          ['ss', 'INT'],
        ],
      });

      expect(bodyOf(state, 't').slice(2)).toEqual([
        '    #[sea_orm(column_name = "self", column_type = "String(StringLen::N(10))", unique)]',
        '    pub self_2: String,',
        '    pub crate_: Option<i32>,',
        '    pub type_: Option<i32>,',
        '    pub a_1: Option<i32>,',
        '    #[sea_orm(column_name = "a1")]',
        '    pub a1_2: Option<i32>,',
        '    #[sea_orm(column_name = "createdat")]',
        '    pub created_at: Option<DateTimeWithTimeZone>,',
        '    #[sea_orm(column_name = "1st")]',
        '    pub column_1st: Option<i32>,',
        '    pub 이름: Option<i32>,',
        '    #[sea_orm(column_name = "Quoted")]',
        '    pub quoted: Option<i32>,',
        '    #[sea_orm(column_name = "email address")]',
        '    pub email_address: Option<i32>,',
        '    #[sea_orm(column_name = "")]',
        '    pub column: Option<i32>,',
        '    #[sea_orm(column_name = "😀")]',
        '    pub column_2: Option<i32>,',
        '    #[sea_orm(column_name = "x²")]',
        '    pub x: Option<i32>,',
        '    pub ß: Option<i32>,',
        '    pub ss: Option<i32>,',
      ]);
    });

    it('numbers a key field past column, which PrimaryKey cannot take as a variant', () => {
      const state = createState();
      addTable(state, {
        id: 'd',
        name: 'drafts',
        columns: [
          ['', 'INT', PK | AI],
          ['Column', 'INT'],
        ],
      });
      addTable(state, {
        id: 'c',
        name: 'cells',
        columns: [
          ['column', 'INT', PK],
          ['row', 'INT', PK],
        ],
      });

      expect(bodyOf(state, 'd')).toEqual([
        '    #[sea_orm(column_name = "", primary_key)]',
        '    pub column_2: i32,',
        '    pub column: Option<i32>,',
      ]);
      expect(bodyOf(state, 'c').slice(0, 2)).toEqual([
        '    #[sea_orm(column_name = "column", primary_key, auto_increment = false)]',
        '    pub column_2: i32,',
      ]);
    });

    it('folds an undelimited PostgreSQL name and splits a dotted table name', () => {
      const state = createState(Database.PostgreSQL);
      addTable(state, {
        id: 'a',
        name: 'Sales.Items',
        columns: [['ItemNo', 'INT', PK]],
      });
      addTable(state, { id: 'b', name: '[Sales].[Orders]' });
      addTable(state, { id: 'c', name: 'x.y.Zed' });

      expect(tableOf(state, 'a').slice(5, 9)).toEqual([
        '#[sea_orm(schema_name = "sales", table_name = "items")]',
        'pub struct Model {',
        '    #[sea_orm(column_name = "itemno", primary_key, auto_increment = false)]',
        '    pub item_no: i32,',
      ]);
      expect(tableOf(state, 'b')[5]).toBe(
        '#[sea_orm(schema_name = "Sales", table_name = "Orders")]'
      );
      expect(tableOf(state, 'c')[5]).toBe(
        '#[sea_orm(schema_name = "y", table_name = "zed")]'
      );
    });

    it('keeps the case elsewhere and unquotes a backticked part', () => {
      const state = createState(Database.MySQL);
      addTable(state, {
        id: 'a',
        name: '`Sales`.`Items`',
        columns: [['ItemNo', 'INT', PK | AI]],
      });

      expect(tableOf(state, 'a').slice(5, 9)).toEqual([
        '#[sea_orm(schema_name = "Sales", table_name = "Items")]',
        'pub struct Model {',
        '    #[sea_orm(column_name = "ItemNo", primary_key)]',
        '    pub item_no: i32,',
      ]);
    });

    it('takes a name the document quotes whole, dots and case', () => {
      const state = createState(Database.PostgreSQL, BracketType.doubleQuote);
      addTable(state, {
        id: 'a',
        name: 'Sales.Items',
        columns: [['ItemNo', 'INT', PK | AI]],
      });

      expect(tableOf(state, 'a').slice(5, 9)).toEqual([
        '#[sea_orm(table_name = "Sales.Items")]',
        'pub struct Model {',
        '    #[sea_orm(column_name = "ItemNo", primary_key)]',
        '    pub item_no: i32,',
      ]);
    });

    it('names unique keys from the index, apart from unique fields', () => {
      const state = createState();
      addTable(state, {
        id: 'p',
        name: 'pairs',
        columns: [
          ['id', 'INT', PK | AI],
          ['a', 'INT', NN],
          ['b', 'INT', NN],
          ['c', 'INT', NN],
          ['d', 'INT', NN],
          ['e', 'INT', NN | UQ],
          ['f', 'INT', NN],
        ],
      });
      addIndex(state, 'i1', 'p', 'UQ pairs a-b', true, [1, 2]);
      addIndex(state, 'i2', 'p', 'uq_pairs_a_c', true, [1, 3]);
      addIndex(state, 'i3', 'p', '', true, [3, 4]);
      addIndex(state, 'i4', 'p', 'e', true, [5, 6]);
      addIndex(state, 'i5', 'p', 'plain', false, [6]);
      addIndex(state, 'i6', 'p', 'one', true, [6]);

      expect(bodyOf(state, 'p').slice(2)).toEqual([
        '    #[sea_orm(unique_key = "uq_pairs_a_b")]',
        '    pub a: i32,',
        '    #[sea_orm(unique_key = "uq_pairs_a_b")]',
        '    pub b: i32,',
        '    #[sea_orm(unique_key = "c_d")]',
        '    pub c: i32,',
        '    #[sea_orm(unique_key = "c_d")]',
        '    pub d: i32,',
        '    #[sea_orm(unique, unique_key = "e_2")]',
        '    pub e: i32,',
        '    #[sea_orm(unique, unique_key = "e_2")]',
        '    pub f: i32,',
      ]);
    });

    it('takes a keyword index name with an underscore', () => {
      const state = createState();
      addTable(state, {
        id: 't',
        name: 't',
        columns: [
          ['a', 'INT', PK],
          ['b', 'INT', NN],
        ],
      });
      addIndex(state, 'i', 't', 'type', true, [0, 1]);

      expect(bodyOf(state, 't')[0]).toBe(
        '    #[sea_orm(primary_key, auto_increment = false, unique_key = "type_")]'
      );
    });

    it('folds the underscore a keyword field ends in out of an unnamed key', () => {
      const state = createState();
      addTable(state, {
        id: 'p',
        name: 'products',
        columns: [
          ['id', 'INT', PK | AI],
          ['type', 'VARCHAR(20)', NN],
          ['name', 'VARCHAR(100)', NN],
          ['match', 'INT', NN],
          ['self', 'INT', NN],
        ],
      });
      addIndex(state, 'i1', 'p', '', true, [1, 2]);
      addIndex(state, 'i2', 'p', '', true, [3, 4]);

      expect(bodyOf(state, 'p').slice(2)).toEqual([
        '    #[sea_orm(column_type = "String(StringLen::N(20))", unique_key = "type_name")]',
        '    pub type_: String,',
        '    #[sea_orm(column_type = "String(StringLen::N(100))", unique_key = "type_name")]',
        '    pub name: String,',
        '    #[sea_orm(unique_key = "match_self_2")]',
        '    pub match_: i32,',
        '    #[sea_orm(column_name = "self", unique_key = "match_self_2")]',
        '    pub self_2: i32,',
      ]);
    });

    it('parts words at a character no identifier holds, leaving one underscore', () => {
      const state = createState();
      addTable(state, {
        id: 't',
        name: 'x ½',
        columns: [
          ['id', 'INT', PK | AI],
          ['a ½b', 'INT'],
          ['c', 'INT', NN],
          ['d', 'INT', NN],
        ],
      });
      addIndex(state, 'i', 't', 'k ½m', true, [2, 3]);

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line.startsWith('pub mod '))
      ).toEqual(['pub mod x {']);
      expect(bodyOf(state, 't').slice(2)).toEqual([
        '    #[sea_orm(column_name = "a ½b")]',
        '    pub a_b: Option<i32>,',
        '    #[sea_orm(unique_key = "k_m")]',
        '    pub c: i32,',
        '    #[sea_orm(unique_key = "k_m")]',
        '    pub d: i32,',
      ]);
    });

    it('numbers a composite UNIQUE named id, whose find_by_id would hide the entity one', () => {
      const state = createState();
      addTable(state, {
        id: 't',
        name: 't',
        columns: [
          ['id', 'INT', PK | AI],
          ['a', 'INT', NN],
          ['b', 'INT', NN],
        ],
      });
      addIndex(state, 'i', 't', 'id', true, [1, 2]);

      expect(bodyOf(state, 't').slice(2)).toEqual([
        '    #[sea_orm(unique_key = "id_2")]',
        '    pub a: i32,',
        '    #[sea_orm(unique_key = "id_2")]',
        '    pub b: i32,',
      ]);
    });

    it('falls back where a name opens on what cannot open an identifier', () => {
      const state = createState();
      // U+0345 continues an identifier but cannot open one, while the U+0399
      // it capitalizes to can; ½, which no identifier holds, parts words.
      addTable(state, {
        id: 't',
        name: '\u0345x',
        columns: [
          ['id', 'INT', PK | AI],
          ['\u0345x', 'INT'],
          ['½x', 'INT'],
          ['a', 'INT', NN],
          ['b', 'INT', NN],
        ],
      });
      addIndex(state, 'i', 't', '\u0345key', true, [3, 4]);

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line.startsWith('pub mod '))
      ).toEqual(['pub mod table_\u0345x {']);
      expect(bodyOf(state, 't').slice(2)).toEqual([
        '    #[sea_orm(column_name = "\u0345x")]',
        '    pub column_\u0345x: Option<i32>,',
        '    #[sea_orm(column_name = "½x")]',
        '    pub x: Option<i32>,',
        '    #[sea_orm(unique_key = "unique_\u0345key")]',
        '    pub a: i32,',
        '    #[sea_orm(unique_key = "unique_\u0345key")]',
        '    pub b: i32,',
      ]);
    });

    it('derives the column name and the variant the macros read back', () => {
      expect(derivedColumnName('type_')).toBe('type');
      expect(derivedColumnName('self_2')).toBe('self_2');
      expect(derivedColumnName('created_at')).toBe('created_at');
      expect(stableUpperCamelCase('a_z')).toBe('Az');
      expect(stableUpperCamelCase('ß')).toBe('Ss');
    });
  });

  describe('relations', () => {
    function createEdge(): RootState {
      const state = createState(Database.PostgreSQL);

      addTable(state, {
        id: 'type',
        name: 'type',
        columns: [['id', 'INT', PK | AI]],
      });
      addTable(state, {
        id: 'struct',
        name: 'struct',
        columns: [
          ['id', 'INT', PK | AI],
          ['type_id', 'INT', NN],
        ],
      });
      addTable(state, {
        id: 'match',
        name: 'match',
        columns: [['type_id', 'INT', PK]],
      });
      addTable(state, {
        id: 'people',
        name: 'people',
        columns: [
          ['id', 'BIGINT', PK | AI],
          ['mentor_id', 'BIGINT', UQ],
          ['father_id', 'BIGINT'],
        ],
      });
      addTable(state, {
        id: 'articles',
        name: 'articles',
        columns: [
          ['id', 'INT', PK | AI],
          ['writer_id', 'BIGINT'],
          ['reviewer_id', 'BIGINT', NN],
          ['writer_option', 'INT'],
        ],
      });
      addTable(state, {
        id: 'nodes',
        name: 'nodes',
        columns: [
          ['tree_id', 'INT', PK],
          ['node_no', 'INT', PK],
          ['parent_no', 'INT'],
        ],
      });
      addRelationship(state, {
        id: 'e1',
        start: ['type', [0]],
        end: ['struct', [1]],
        onDelete: cascade,
      });
      addRelationship(state, {
        id: 'e2',
        start: ['type', [0]],
        end: ['match', [0]],
        relationshipType: ZeroOne,
      });
      addRelationship(state, {
        id: 'e3',
        start: ['people', [0]],
        end: ['people', [1]],
        relationshipType: ZeroOne,
        onDelete: setNull,
      });
      addRelationship(state, {
        id: 'e4',
        start: ['people', [0]],
        end: ['people', [2]],
      });
      addRelationship(state, {
        id: 'e5',
        start: ['people', [0]],
        end: ['articles', [1]],
      });
      addRelationship(state, {
        id: 'e6',
        start: ['people', [0]],
        end: ['articles', [2]],
        relationshipType: OneN,
      });
      addRelationship(state, {
        id: 'e7',
        start: ['nodes', [0, 1]],
        end: ['nodes', [0, 2]],
      });
      addRelationship(state, {
        id: 'gone',
        start: ['type', [0]],
        end: ['missing', [0]],
      });

      return state;
    }

    it('writes a keyword relation field as a raw identifier', () => {
      const state = createEdge();

      expect(bodyOf(state, 'type').slice(2)).toEqual([
        '    #[sea_orm(has_many)]',
        '    pub struct_list: HasMany<super::struct_::Entity>,',
        '    #[sea_orm(has_one)]',
        '    pub r#match: HasOne<super::match_::Entity>,',
      ]);
      expect(bodyOf(state, 'match').slice(2)).toEqual([
        '    #[sea_orm(belongs_to, from = "type_id", to = "id")]',
        '    pub r#type: BelongsTo<super::type_::Entity>,',
      ]);
    });

    it('names self relationships by key, a one side as a HasMany', () => {
      expect(bodyOf(createEdge(), 'people').slice(5)).toEqual([
        '    #[sea_orm(',
        '        self_ref,',
        '        relation_enum = "Mentor",',
        '        relation_reverse = "PeopleByMentorList",',
        '        from = "mentor_id",',
        '        to = "id",',
        '        on_delete = "SetNull"',
        '    )]',
        '    pub mentor: BelongsTo<Option<Entity>>,',
        '    #[sea_orm(',
        '        self_ref,',
        '        relation_enum = "Father",',
        '        relation_reverse = "PeopleByFatherList",',
        '        from = "father_id",',
        '        to = "id"',
        '    )]',
        '    pub father: BelongsTo<Option<Entity>>,',
        '    #[sea_orm(',
        '        self_ref,',
        '        relation_enum = "PeopleByMentorList",',
        '        relation_reverse = "Mentor"',
        '    )]',
        '    pub people_by_mentor_list: HasMany<Entity>,',
        '    #[sea_orm(',
        '        self_ref,',
        '        relation_enum = "PeopleByFatherList",',
        '        relation_reverse = "Father"',
        '    )]',
        '    pub people_by_father_list: HasMany<Entity>,',
        '    #[sea_orm(has_many, relation_enum = "ArticlesByWriterList", via_rel = "Writer2")]',
        '    pub articles_by_writer_list: HasMany<super::articles::Entity>,',
        '    #[sea_orm(',
        '        has_many,',
        '        relation_enum = "ArticlesByReviewerList",',
        '        via_rel = "Reviewer"',
        '    )]',
        '    pub articles_by_reviewer_list: HasMany<super::articles::Entity>,',
      ]);
    });

    it('numbers a relation field past a column its setter would repeat', () => {
      expect(bodyOf(createEdge(), 'articles').slice(5)).toEqual([
        '    #[sea_orm(belongs_to, relation_enum = "Writer2", from = "writer_id", to = "id")]',
        '    pub writer_2: BelongsTo<Option<super::people::Entity>>,',
        '    #[sea_orm(',
        '        belongs_to,',
        '        relation_enum = "Reviewer",',
        '        from = "reviewer_id",',
        '        to = "id"',
        '    )]',
        '    pub reviewer: BelongsTo<super::people::Entity>,',
      ]);
    });

    it('numbers a field past the parent key setters the relation code calls', () => {
      const state = createState();
      addTable(state, {
        id: 'p',
        name: 'parent_key',
        columns: [['id', 'INT', PK | AI]],
      });
      addTable(state, {
        id: 'c',
        name: 'child',
        columns: [
          ['id', 'INT', PK | AI],
          ['parent_key', 'INT'],
          ['parent_key_for', 'INT', NN],
          ['parent_key_for_self_rev', 'INT'],
          ['parent_key_for_def', 'INT'],
        ],
      });
      addRelationship(state, { id: 'r', start: ['p', [0]], end: ['c', [2]] });

      expect(bodyOf(state, 'c').slice(2)).toEqual([
        '    #[sea_orm(column_name = "parent_key")]',
        '    pub parent_key_2: Option<i32>,',
        '    #[sea_orm(column_name = "parent_key_for")]',
        '    pub parent_key_for_2: i32,',
        '    #[sea_orm(column_name = "parent_key_for_self_rev")]',
        '    pub parent_key_for_self_rev_2: Option<i32>,',
        '    pub parent_key_for_def: Option<i32>,',
        '    #[sea_orm(belongs_to, from = "parent_key_for_2", to = "id")]',
        '    pub parent_key_3: BelongsTo<super::parent_key::Entity>,',
      ]);
    });

    it('ends a field named by its key in _list, which keeps add_ setters apart', () => {
      const state = createState();
      addTable(state, {
        id: 'b',
        name: 'buyers',
        columns: [['id', 'INT', PK | AI]],
      });
      addTable(state, {
        id: 'o',
        name: 'orders',
        columns: [
          ['id', 'INT', PK | AI],
          ['buyer_id', 'INT', NN],
          ['buyers_id', 'INT'],
        ],
      });
      addRelationship(state, { id: 'r1', start: ['b', [0]], end: ['o', [1]] });
      addRelationship(state, { id: 'r2', start: ['b', [0]], end: ['o', [2]] });

      expect(bodyOf(state, 'b').slice(2)).toEqual([
        '    #[sea_orm(has_many, relation_enum = "OrdersByBuyerList", via_rel = "Buyer")]',
        '    pub orders_by_buyer_list: HasMany<super::orders::Entity>,',
        '    #[sea_orm(has_many, relation_enum = "OrdersByBuyersList", via_rel = "Buyers")]',
        '    pub orders_by_buyers_list: HasMany<super::orders::Entity>,',
      ]);
    });

    it('names a composite self relationship after its parent', () => {
      expect(bodyOf(createEdge(), 'nodes').slice(5)).toEqual([
        '    #[sea_orm(',
        '        self_ref,',
        '        relation_enum = "ParentNodes",',
        '        relation_reverse = "NodesList",',
        '        from = "(tree_id, parent_no)",',
        '        to = "(tree_id, node_no)"',
        '    )]',
        '    pub parent_nodes: BelongsTo<Option<Entity>>,',
        '    #[sea_orm(',
        '        self_ref,',
        '        relation_enum = "NodesList",',
        '        relation_reverse = "ParentNodes"',
        '    )]',
        '    pub nodes_list: HasMany<Entity>,',
      ]);
    });

    it('numbers a variant past Self and a variant taken', () => {
      const state = createState();
      addTable(state, {
        id: 'self',
        name: 'self',
        columns: [['id', 'INT', PK | AI]],
      });
      addTable(state, {
        id: 'crate',
        name: 'crate',
        columns: [
          ['id', 'INT', PK | AI],
          ['self_id', 'INT'],
        ],
      });
      addTable(state, {
        id: 'a1',
        name: 'a_1',
        columns: [['id', 'INT', PK | AI]],
      });
      addTable(state, {
        id: 'a2',
        name: 'a1',
        columns: [['id', 'INT', PK | AI]],
      });
      addTable(state, {
        id: 'c',
        name: 'c',
        columns: [
          ['a', 'INT'],
          ['b', 'INT'],
        ],
      });
      addRelationship(state, {
        id: 'r1',
        start: ['self', [0]],
        end: ['crate', [1]],
        relationshipType: ZeroOne,
      });
      addRelationship(state, { id: 'r2', start: ['a1', [0]], end: ['c', [0]] });
      addRelationship(state, { id: 'r3', start: ['a2', [0]], end: ['c', [1]] });

      expect(bodyOf(state, 'crate').slice(3)).toEqual([
        '    #[sea_orm(belongs_to, relation_enum = "Self2", from = "self_id", to = "id")]',
        '    pub self_: BelongsTo<Option<super::self_::Entity>>,',
      ]);
      expect(bodyOf(state, 'self').slice(2)).toEqual([
        '    #[sea_orm(has_one)]',
        '    pub crate_: HasOne<super::crate_::Entity>,',
      ]);
      expect(bodyOf(state, 'c').slice(2)).toEqual([
        '    #[sea_orm(belongs_to, from = "a", to = "id")]',
        '    pub a_1: BelongsTo<Option<super::a_1::Entity>>,',
        '    #[sea_orm(belongs_to, relation_enum = "A12", from = "b", to = "id")]',
        '    pub a1: BelongsTo<Option<super::a1::Entity>>,',
      ]);
    });

    it('numbers relations whose keys end in no id word after the parent', () => {
      const state = createState();
      addTable(state, {
        id: 'u',
        name: '사용자',
        columns: [['번호', 'BIGINT', PK | AI]],
      });
      addTable(state, {
        id: 'p',
        name: '게시글',
        columns: [
          ['id', 'INT', PK | AI],
          ['작성자_번호', 'BIGINT', NN],
          ['검토자번호', 'BIGINT'],
        ],
      });
      addRelationship(state, {
        id: 'f1',
        start: ['u', [0]],
        end: ['p', [1]],
        relationshipType: OneN,
      });
      addRelationship(state, { id: 'f2', start: ['u', [0]], end: ['p', [2]] });

      expect(bodyOf(state, 'u').slice(2)).toEqual([
        '    #[sea_orm(has_many, relation_enum = "게시글list", via_rel = "사용자")]',
        '    pub 게시글_list: HasMany<super::게시글::Entity>,',
        '    #[sea_orm(has_many, relation_enum = "게시글list2", via_rel = "사용자2")]',
        '    pub 게시글_list_2: HasMany<super::게시글::Entity>,',
      ]);
    });

    it('writes the referential actions the database writes', () => {
      const relation = (database: number) => {
        const state = createState(database);
        addTable(state, {
          id: 'p',
          name: 'p',
          columns: [['id', 'INT', PK | AI]],
        });
        addTable(state, {
          id: 'c',
          name: 'c',
          columns: [
            ['id', 'INT', PK | AI],
            ['p_id', 'INT', NN],
          ],
        });
        addRelationship(state, {
          id: 'r',
          start: ['p', [0]],
          end: ['c', [1]],
          onDelete: setDefault,
          onUpdate: restrict,
        });
        return bodyOf(state, 'c').slice(3).join('\n');
      };

      expect(relation(Database.PostgreSQL)).toContain(
        'on_update = "Restrict",\n        on_delete = "SetDefault"'
      );
      expect(relation(Database.MySQL)).toContain('on_update = "Restrict")]');
      expect(relation(Database.Oracle)).toBe(
        '    #[sea_orm(belongs_to, from = "p_id", to = "id")]\n    pub p: BelongsTo<super::p::Entity>,'
      );
      expect(relation(Database.MSSQL)).toContain('on_delete = "SetDefault"');
      expect(relation(Database.Databricks)).not.toContain('on_');
    });

    it('writes NoAction where the database takes it', () => {
      const state = createState(Database.Snowflake);
      addTable(state, { id: 'p', name: 'p', columns: [['id', 'INT', PK]] });
      addTable(state, { id: 'c', name: 'c', columns: [['p_id', 'INT', PK]] });
      addRelationship(state, {
        id: 'r',
        start: ['p', [0]],
        end: ['c', [0]],
        relationshipType: ZeroOne,
        onDelete: noAction,
      });

      expect(bodyOf(state, 'c')[2]).toBe(
        '    #[sea_orm(belongs_to, from = "p_id", to = "id", on_delete = "NoAction")]'
      );
      expect(bodyOf(state, 'p')[2]).toBe('    #[sea_orm(has_one)]');
    });
  });

  describe('types', () => {
    it.each([
      [
        Database.PostgreSQL,
        'int[]',
        [
          '    #[sea_orm(column_type = "custom(\\"int[]\\")")]',
          '    pub v: Vec<i32>,',
        ],
      ],
      [
        Database.PostgreSQL,
        'INTEGER[][]',
        [
          '    #[sea_orm(',
          '        column_type = "custom(\\"INTEGER[][]\\")",',
          '        select_as = "text",',
          '        save_as = "INTEGER[][]"',
          '    )]',
          '    pub v: String,',
        ],
      ],
      [
        Database.PostgreSQL,
        'mood[]',
        [
          '    #[sea_orm(',
          '        column_type = "custom(\\"mood[]\\")",',
          '        select_as = "text[]",',
          '        save_as = "mood[]"',
          '    )]',
          '    pub v: Vec<String>,',
        ],
      ],
      [
        Database.PostgreSQL,
        'MONEY',
        [
          '    #[sea_orm(column_type = "Money(None)", select_as = "numeric", save_as = "MONEY")]',
          '    pub v: Decimal,',
        ],
      ],
      [
        Database.PostgreSQL,
        'BIT(8)',
        [
          '    #[sea_orm(column_type = "Bit(Some(8))", select_as = "text", save_as = "BIT(8)")]',
          '    pub v: String,',
        ],
      ],
      [
        Database.PostgreSQL,
        'bit varying(16)',
        [
          '    #[sea_orm(',
          '        column_type = "VarBit(16)",',
          '        select_as = "text",',
          '        save_as = "bit varying(16)"',
          '    )]',
          '    pub v: String,',
        ],
      ],
      [
        Database.PostgreSQL,
        'INTERVAL',
        [
          '    #[sea_orm(',
          '        column_type = "Interval(None, None)",',
          '        select_as = "text",',
          '        save_as = "INTERVAL"',
          '    )]',
          '    pub v: String,',
        ],
      ],
      [
        Database.PostgreSQL,
        'JSONB',
        ['    #[sea_orm(column_type = "JsonBinary")]', '    pub v: Json,'],
      ],
      [
        Database.PostgreSQL,
        'numeric(10)',
        [
          '    #[sea_orm(column_type = "Decimal(Some((10, 0)))")]',
          '    pub v: Decimal,',
        ],
      ],
      // The PostgreSQL and SQLite lists gained dec, which now reads as a
      // decimal, no longer as text (an owner decision of 2026-10-10).
      [
        Database.PostgreSQL,
        'dec',
        [
          '    #[sea_orm(column_type = "custom(\\"dec\\")")]',
          '    pub v: Decimal,',
        ],
      ],
      [
        Database.PostgreSQL,
        'DEC(10,2)',
        [
          '    #[sea_orm(column_type = "Decimal(Some((10, 2)))")]',
          '    pub v: Decimal,',
        ],
      ],
      [
        Database.PostgreSQL,
        'char(2)',
        ['    #[sea_orm(column_type = "Char(Some(2))")]', '    pub v: String,'],
      ],
      [
        Database.PostgreSQL,
        'character',
        ['    #[sea_orm(column_type = "Char(None)")]', '    pub v: String,'],
      ],
      [
        Database.PostgreSQL,
        'citext',
        [
          '    #[sea_orm(column_type = "custom(\\"citext\\")")]',
          '    pub v: String,',
        ],
      ],
      [Database.PostgreSQL, 'float(24)', ['    pub v: f32,']],
      [
        Database.PostgreSQL,
        'timestamptz',
        ['    pub v: DateTimeWithTimeZone,'],
      ],
      [Database.PostgreSQL, 'uuid', ['    pub v: Uuid,']],
      [Database.PostgreSQL, 'date', ['    pub v: Date,']],
      [Database.PostgreSQL, 'time', ['    pub v: Time,']],
      [Database.PostgreSQL, 'bytea', ['    pub v: Vec<u8>,']],
      [Database.PostgreSQL, 'boolean', ['    pub v: bool,']],
      [Database.PostgreSQL, '', ['    pub v: String,']],
      [Database.MySQL, 'INT(11) UNSIGNED', ['    pub v: u32,']],
      [
        Database.MySQL,
        'INT(11) UNSIGNED ZEROFILL',
        [
          '    #[sea_orm(column_type = "custom(\\"INT(11) UNSIGNED ZEROFILL\\")")]',
          '    pub v: u32,',
        ],
      ],
      [
        Database.MySQL,
        'DECIMAL(10,2) UNSIGNED',
        [
          '    #[sea_orm(column_type = "custom(\\"DECIMAL(10,2) UNSIGNED\\")")]',
          '    pub v: Decimal,',
        ],
      ],
      [
        Database.MySQL,
        'MEDIUMINT',
        [
          '    #[sea_orm(column_type = "custom(\\"MEDIUMINT\\")")]',
          '    pub v: i32,',
        ],
      ],
      [Database.MySQL, 'FLOAT(53)', ['    pub v: f64,']],
      [
        Database.MySQL,
        'DECIMAL(8)',
        [
          '    #[sea_orm(column_type = "Decimal(Some((8, 0)))")]',
          '    pub v: Decimal,',
        ],
      ],
      [
        Database.MySQL,
        'CHAR(3)',
        ['    #[sea_orm(column_type = "Char(Some(3))")]', '    pub v: String,'],
      ],
      [
        Database.MySQL,
        'CHAR',
        ['    #[sea_orm(column_type = "Char(None)")]', '    pub v: String,'],
      ],
      [
        Database.MySQL,
        'BINARY(16)',
        ['    #[sea_orm(column_type = "Binary(16)")]', '    pub v: Vec<u8>,'],
      ],
      [
        Database.MySQL,
        'BINARY',
        ['    #[sea_orm(column_type = "Binary(1)")]', '    pub v: Vec<u8>,'],
      ],
      [
        Database.MySQL,
        'VARBINARY(64)',
        [
          '    #[sea_orm(column_type = "VarBinary(StringLen::N(64))")]',
          '    pub v: Vec<u8>,',
        ],
      ],
      [
        Database.MySQL,
        'BLOB',
        ['    #[sea_orm(column_type = "Blob")]', '    pub v: Vec<u8>,'],
      ],
      [
        Database.MySQL,
        'YEAR',
        ['    #[sea_orm(column_type = "Year")]', '    pub v: u16,'],
      ],
      [
        Database.MySQL,
        'BIT',
        ['    #[sea_orm(column_type = "Bit(None)")]', '    pub v: bool,'],
      ],
      [
        Database.MySQL,
        'BIT(8)',
        ['    #[sea_orm(column_type = "Bit(Some(8))")]', '    pub v: u64,'],
      ],
      [Database.MySQL, 'BOOLEAN', ['    pub v: bool,']],
      [
        Database.MySQL,
        "ENUM('a','b')",
        [
          '    #[sea_orm(column_type = "custom(\\"ENUM(\'a\',\'b\')\\")")]',
          '    pub v: String,',
        ],
      ],
      [
        Database.MariaDB,
        'UUID',
        [
          '    #[sea_orm(column_type = "custom(\\"UUID\\")")]',
          '    pub v: String,',
        ],
      ],
      [Database.SQLite, 'INTEGER', ['    pub v: i32,']],
      [
        Database.SQLite,
        'UUID',
        [
          '    #[sea_orm(column_type = "custom(\\"UUID\\")")]',
          '    pub v: Uuid,',
        ],
      ],
      [
        Database.SQLite,
        'NUMERIC',
        [
          '    #[sea_orm(column_type = "custom(\\"NUMERIC\\")", select_as = "REAL")]',
          '    pub v: Decimal,',
        ],
      ],
      [
        Database.SQLite,
        'dec',
        [
          '    #[sea_orm(column_type = "custom(\\"dec\\")", select_as = "REAL")]',
          '    pub v: Decimal,',
        ],
      ],
      [
        Database.SQLite,
        'INTERVAL',
        [
          '    #[sea_orm(column_type = "custom(\\"INTERVAL\\")", select_as = "TEXT")]',
          '    pub v: String,',
        ],
      ],
      [Database.SQLite, '', ['    pub v: String,']],
      [Database.SQLite, 'BLOB', ['    pub v: Vec<u8>,']],
      [Database.SQLite, 'VARCHAR(40)', ['    pub v: String,']],
      [Database.SQLite, 'REAL', ['    pub v: f64,']],
      [Database.MSSQL, 'nvarchar(40)', ['    pub v: String,']],
      [Database.Oracle, 'NUMBER(10,2)', ['    pub v: Decimal,']],
      [Database.Snowflake, 'TIMESTAMP_LTZ', ['    pub v: DateTimeUtc,']],
    ])('writes %i %j as its entity reads it', (database, dataType, lines) => {
      expect(columnOf(database, dataType)).toEqual(lines);
    });

    it('writes a type as typed where an argument is past what a u32 holds', () => {
      expect(columnOf(Database.PostgreSQL, 'varchar(4294967296)')).toEqual([
        '    #[sea_orm(column_type = "custom(\\"varchar(4294967296)\\")")]',
        '    pub v: String,',
      ]);
      expect(
        columnOf(Database.PostgreSQL, 'varchar(100000000000000000000000)')
      ).toEqual([
        '    #[sea_orm(column_type = "custom(\\"varchar(100000000000000000000000)\\")")]',
        '    pub v: String,',
      ]);
      expect(columnOf(Database.MySQL, 'VARCHAR(4294967296)')).toEqual([
        '    #[sea_orm(column_type = "custom(\\"VARCHAR(4294967296)\\")")]',
        '    pub v: String,',
      ]);
      expect(columnOf(Database.MySQL, 'DECIMAL(4294967296,2)')).toEqual([
        '    #[sea_orm(column_type = "custom(\\"DECIMAL(4294967296,2)\\")")]',
        '    pub v: Decimal,',
      ]);
      expect(columnOf(Database.PostgreSQL, 'varchar(4294967295)')).toEqual([
        '    #[sea_orm(column_type = "String(StringLen::N(4294967295))")]',
        '    pub v: String,',
      ]);
    });

    it('keeps the native column_type under a Turkish default locale', () => {
      underTurkishLocale(() => {
        expect(columnOf(Database.MySQL, 'INT UNSIGNED')).toEqual([
          '    pub v: u32,',
        ]);
        expect(columnOf(Database.MySQL, 'BINARY(16)')).toEqual([
          '    #[sea_orm(column_type = "Binary(16)")]',
          '    pub v: Vec<u8>,',
        ]);
        expect(columnOf(Database.MySQL, 'BIT(8)')).toEqual([
          '    #[sea_orm(column_type = "Bit(Some(8))")]',
          '    pub v: u64,',
        ]);
      });
    });

    it('drops Eq beside a float, one in a Vec too', () => {
      expect(getEntityColumnType('real[]', Database.PostgreSQL)).toMatchObject({
        type: 'Vec<f32>',
        isFloat: true,
      });
      expect(
        getEntityColumnType('real[][]', Database.PostgreSQL)
      ).toMatchObject({
        type: 'String',
        isFloat: false,
      });
    });
  });

  describe('attributes', () => {
    it('keeps several items on one line while they take 70 columns', () => {
      const write = (length: number) =>
        columnOf(
          Database.PostgreSQL,
          'text',
          ColumnOption.unique,
          'c'.repeat(length)
        );

      expect(write(28)[0]).toBe(
        `    #[sea_orm(column_type = "Text", unique, comment = "${'c'.repeat(28)}")]`
      );
      expect(write(29)[0]).toBe('    #[sea_orm(');
    });

    it('keeps one item on one line while the line is under 100 columns', () => {
      const write = (length: number) =>
        columnOf(Database.PostgreSQL, 'int', NN, 'c'.repeat(length));

      expect(write(71)).toHaveLength(2);
      expect(write(72)).toEqual([
        '    #[sea_orm(',
        `        comment = "${'c'.repeat(72)}"`,
        '    )]',
        '    pub v: i32,',
      ]);
    });

    it('writes a string literal rustc takes for any text', () => {
      expect(
        rustString(
          'quote " backslash \\ line\nend\r\t\u0001\u007f\u202E\u2066 é'
        )
      ).toBe(
        '"quote \\" backslash \\\\ line\\nend\\r\\t\\u{0001}\\u{007F}\\u{202E}\\u{2066} é"'
      );
    });
  });
});
