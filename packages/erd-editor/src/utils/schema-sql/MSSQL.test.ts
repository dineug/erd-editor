import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { BracketType, ColumnOption, OrderType } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createSchema,
  formatIndex,
  formatTable,
} from '@/utils/schema-sql/MSSQL';
import { Name } from '@/utils/schema-sql/utils';

function createState(): RootState {
  return {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;
}

function createFixture() {
  const state = createState();

  const userId = createColumn({
    id: 'c-user-id',
    tableId: 't-users',
    name: 'id',
    dataType: 'INT',
    comment: 'user id',
    options:
      ColumnOption.primaryKey |
      ColumnOption.notNull |
      ColumnOption.autoIncrement,
  });
  const userEmail = createColumn({
    id: 'c-user-email',
    tableId: 't-users',
    name: 'email',
    dataType: 'VARCHAR(255)',
    comment: 'email address',
    default: "'a@b.c'",
    options: ColumnOption.unique | ColumnOption.notNull,
  });
  const userName = createColumn({
    id: 'c-user-name',
    tableId: 't-users',
    name: 'name',
    dataType: 'VARCHAR(50)',
    default: "'guest'",
  });
  const users = createTable({
    id: 't-users',
    name: 'users',
    comment: 'user table',
    columnIds: [userId.id, userEmail.id, userName.id],
  });

  const postId = createColumn({
    id: 'c-post-id',
    tableId: 't-posts',
    name: 'id',
    dataType: 'INT',
    options: ColumnOption.primaryKey,
  });
  const postUserId = createColumn({
    id: 'c-post-user-id',
    tableId: 't-posts',
    name: 'user_id',
    dataType: 'INT',
    options: ColumnOption.notNull,
  });
  const posts = createTable({
    id: 't-posts',
    name: 'posts',
    columnIds: [postId.id, postUserId.id],
  });

  const relationship = createRelationship({
    id: 'r-1',
    start: { tableId: users.id, columnIds: [userId.id] },
    end: { tableId: posts.id, columnIds: [postUserId.id] },
  });

  const postsIndexColumn = createIndexColumn({
    id: 'ic-1',
    indexId: 'i-1',
    columnId: postUserId.id,
    orderType: OrderType.ASC,
  });
  const postsIndex = createIndex({
    id: 'i-1',
    name: '',
    tableId: posts.id,
    indexColumnIds: [postsIndexColumn.id],
  });
  const usersIndexColumn = createIndexColumn({
    id: 'ic-2',
    indexId: 'i-2',
    columnId: userEmail.id,
    orderType: OrderType.DESC,
  });
  const usersIndex = createIndex({
    id: 'i-2',
    name: 'IDX_EMAIL',
    tableId: users.id,
    unique: true,
    indexColumnIds: [usersIndexColumn.id],
  });

  const { collections, doc } = state;
  collections.tableEntities[users.id] = users;
  collections.tableEntities[posts.id] = posts;
  [userId, userEmail, userName, postId, postUserId].forEach(column => {
    collections.tableColumnEntities[column.id] = column;
  });
  collections.relationshipEntities[relationship.id] = relationship;
  collections.indexEntities[postsIndex.id] = postsIndex;
  collections.indexEntities[usersIndex.id] = usersIndex;
  collections.indexColumnEntities[postsIndexColumn.id] = postsIndexColumn;
  collections.indexColumnEntities[usersIndexColumn.id] = usersIndexColumn;
  doc.tableIds = [users.id, posts.id];
  doc.relationshipIds = [relationship.id];
  doc.indexIds = [postsIndex.id, usersIndex.id];

  return {
    state,
    users,
    posts,
    userId,
    userEmail,
    userName,
    postId,
    postUserId,
    relationship,
    postsIndex,
    usersIndex,
  };
}

describe('MSSQL createSchema', () => {
  it('emits tables sorted by name, unique constraints, comments, FKs and indexes', () => {
    const { state } = createFixture();

    expect(createSchema(state)).toBe(
      [
        '',
        'CREATE TABLE posts',
        '(',
        '  id      INT,',
        '  user_id INT NOT NULL,',
        '  CONSTRAINT PK_posts PRIMARY KEY (id)',
        ')',
        'GO',
        '',
        'CREATE TABLE users',
        '(',
        '  id    INT          NOT NULL IDENTITY(1,1),',
        "  email VARCHAR(255) NOT NULL DEFAULT 'a@b.c',",
        "  name  VARCHAR(50)  DEFAULT 'guest',",
        '  CONSTRAINT PK_users PRIMARY KEY (id)',
        ')',
        'GO',
        '',
        'ALTER TABLE users',
        '  ADD CONSTRAINT UQ_users_email UNIQUE (email)',
        'GO',
        '',
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',",
        "  'user table', 'schema', 'dbo', 'table', 'users'",
        'GO',
        '',
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',",
        "  'user id', 'schema', 'dbo', 'table', 'users', 'column', 'id'",
        'GO',
        '',
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',",
        "  'email address', 'schema', 'dbo', 'table', 'users', 'column', 'email'",
        'GO',
        '',
        'ALTER TABLE posts',
        '  ADD CONSTRAINT FK_users_TO_posts',
        '    FOREIGN KEY (user_id)',
        '    REFERENCES users (id)',
        'GO',
        '',
        'CREATE INDEX IDX_posts',
        '  ON posts (user_id ASC)',
        'GO',
        '',
        'CREATE UNIQUE INDEX IDX_EMAIL',
        '  ON users (email DESC)',
        'GO',
        '',
      ].join('\n')
    );
  });

  it('wraps identifiers with the configured bracket type', () => {
    const { state } = createFixture();
    state.settings.bracketType = BracketType.doubleQuote;
    state.doc.tableIds = ['t-posts'];
    state.doc.relationshipIds = [];
    state.doc.indexIds = [];

    expect(createSchema(state)).toBe(
      [
        '',
        'CREATE TABLE "posts"',
        '(',
        '  "id"      INT,',
        '  "user_id" INT NOT NULL,',
        '  CONSTRAINT "PK_posts" PRIMARY KEY ("id")',
        ')',
        'GO',
        '',
      ].join('\n')
    );
  });

  it('returns only the leading empty line when the document is empty', () => {
    const state = createState();

    expect(createSchema(state)).toBe('');
  });

  it('numbers duplicated foreign key names', () => {
    const { state, users, posts, userId, postUserId } = createFixture();
    const second = createRelationship({
      id: 'r-2',
      start: { tableId: users.id, columnIds: [userId.id] },
      end: { tableId: posts.id, columnIds: [postUserId.id] },
    });
    state.collections.relationshipEntities[second.id] = second;
    state.doc.tableIds = [];
    state.doc.indexIds = [];
    state.doc.relationshipIds = ['r-1', 'r-2'];

    const sql = createSchema(state);

    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts1\n');
  });

  it('skips relationships whose tables are missing', () => {
    const { state } = createFixture();
    state.doc.tableIds = [];
    state.doc.indexIds = [];
    Reflect.deleteProperty(state.collections.tableEntities, 't-users');

    expect(createSchema(state)).toBe('\n');
  });

  it('drops relationship columns that no longer exist', () => {
    const { state } = createFixture();
    state.doc.tableIds = [];
    state.doc.indexIds = [];
    state.collections.relationshipEntities['r-1'].start.columnIds = [
      'missing-start',
    ];
    state.collections.relationshipEntities['r-1'].end.columnIds = [
      'missing-end',
    ];

    expect(createSchema(state)).toBe(
      [
        '',
        'ALTER TABLE posts',
        '  ADD CONSTRAINT FK_users_TO_posts',
        '    FOREIGN KEY ()',
        '    REFERENCES users ()',
        'GO',
        '',
      ].join('\n')
    );
  });

  it('qualifies a unique constraint with its table so two tables can share a column name', () => {
    const { state, posts } = createFixture();
    state.collections.tableColumnEntities['c-post-email'] = createColumn({
      id: 'c-post-email',
      tableId: 't-posts',
      name: 'email',
      dataType: 'VARCHAR(255)',
      options: ColumnOption.unique,
    });
    posts.columnIds.push('c-post-email');

    const sql = createSchema(state);

    expect(sql).toContain('  ADD CONSTRAINT UQ_users_email UNIQUE (email)');
    expect(sql).toContain('  ADD CONSTRAINT UQ_posts_email UNIQUE (email)');
  });

  it('doubles the quotes of a description and of the names it points at', () => {
    const { state, users, userId } = createFixture();
    users.name = "o'users";
    users.comment = "user's table";
    userId.name = "user's id";
    userId.comment = "it's the id";
    state.doc.relationshipIds = [];
    state.doc.indexIds = [];

    const sql = createSchema(state);

    expect(sql).toContain(
      "  'user''s table', 'schema', 'dbo', 'table', 'o''users'\nGO"
    );
    expect(sql).toContain(
      "  'it''s the id', 'schema', 'dbo', 'table', 'o''users', 'column', 'user''s id'\nGO"
    );
  });

  // SQL Server refuses a property on a table named sales.users in schema dbo
  // when its unquoted CREATE TABLE put a table users in schema sales.
  it('names the schema of an unquoted dotted table name at level 0 and the table at level 1', () => {
    const { state, users } = createFixture();
    users.name = 'sales.users';
    state.doc.tableIds = [users.id];
    state.doc.relationshipIds = [];
    state.doc.indexIds = [];

    const sql = createSchema(state);

    expect(sql).toContain('CREATE TABLE sales.users\n');
    expect(sql).toContain(
      "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n" +
        "  'user table', 'schema', 'sales', 'table', 'users'\nGO"
    );
    expect(sql).toContain(
      "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n" +
        "  'user id', 'schema', 'sales', 'table', 'users', 'column', 'id'\nGO"
    );
  });

  // The levels name no database, and a call acts on the database its procedure
  // belongs to: shop's own finds shop.sales.users from any connected database.
  it('runs the procedure of the database a three-part unquoted name gives', () => {
    const { state, users } = createFixture();
    users.name = 'shop.sales.users';
    state.doc.tableIds = [users.id];
    state.doc.relationshipIds = [];
    state.doc.indexIds = [];

    const sql = createSchema(state);

    expect(sql).toContain('CREATE TABLE shop.sales.users\n');
    expect(sql).toContain(
      "EXECUTE shop.sys.sp_addextendedproperty 'MS_Description',\n" +
        "  'user table', 'schema', 'sales', 'table', 'users'\nGO"
    );
    expect(sql).toContain(
      "EXECUTE shop.sys.sp_addextendedproperty 'MS_Description',\n" +
        "  'user id', 'schema', 'sales', 'table', 'users', 'column', 'id'\nGO"
    );
    expect(sql).not.toContain('EXECUTE sys.');
  });

  // The database part goes before the procedure as typed, where a space or a
  // dot inside its brackets stays legal, and a server part before it is
  // dropped, since CREATE TABLE refuses a four-part name.
  it.each([
    ['[my shop].[sales].[users]', '[my shop]', 'sales'],
    ['"shop"."sales"."users"', '"shop"', 'sales'],
    ['[my.db].sales.users', '[my.db]', 'sales'],
    ['shop..users', 'shop', 'dbo'],
    ['srv.shop.sales.users', 'shop', 'sales'],
  ])(
    'runs the procedure of the database the unquoted name %s gives',
    (name, database, schema) => {
      const { state, users } = createFixture();
      users.name = name;
      state.doc.tableIds = [users.id];
      state.doc.relationshipIds = [];
      state.doc.indexIds = [];

      const sql = createSchema(state);

      expect(sql).toContain(
        `EXECUTE ${database}.sys.sp_addextendedproperty 'MS_Description',\n` +
          `  'user table', 'schema', '${schema}', 'table', 'users'\nGO`
      );
      expect(sql).toContain(
        `EXECUTE ${database}.sys.sp_addextendedproperty 'MS_Description',\n` +
          `  'user id', 'schema', '${schema}', 'table', 'users', 'column', 'id'\nGO`
      );
    }
  );

  // Such a database part fails its CREATE TABLE too, and before the procedure
  // it would open a quote or a bracket that swallows every later batch.
  it.each([
    ["o'shop.o'sales.users", "o''sales"],
    ['[shop.sales.users', 'sales'],
    ['my shop.sales.users', 'sales'],
  ])(
    'drops the database part of %s, which SQL Server reads as no one name',
    (name, schema) => {
      const { state, users } = createFixture();
      users.name = name;
      state.doc.tableIds = [users.id];
      state.doc.relationshipIds = [];
      state.doc.indexIds = [];

      const sql = createSchema(state);

      expect(sql).toContain(
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n" +
          `  'user table', 'schema', '${schema}', 'table', 'users'\nGO`
      );
      expect(sql).not.toContain('.sys.sp_addextendedproperty');
    }
  );

  // SQL Server reads [sales].[users] and "sales"."users" as a table users in
  // schema sales, a dot inside the pair as part of the name and a doubled
  // closing character as one, so the literals naming it hold no delimiters.
  it.each([
    ['[sales].[users]', 'sales', 'users'],
    ['"sales"."users"', 'sales', 'users'],
    ['[sales].users', 'sales', 'users'],
    ['[Order]', 'dbo', 'Order'],
    ['[].users', 'dbo', 'users'],
    ['[sales.v2].users', 'sales.v2', 'users'],
    ['"sales.v2".users', 'sales.v2', 'users'],
    ['[x.y.z]', 'dbo', 'x.y.z'],
    ['[x]]y]', 'dbo', 'x]y'],
    ['"x""y"', 'dbo', 'x"y'],
  ])(
    'takes one pair of brackets or quotes off each part of the unquoted name %s',
    (name, schema, table) => {
      const { state, users } = createFixture();
      users.name = name;
      state.doc.tableIds = [users.id];
      state.doc.relationshipIds = [];
      state.doc.indexIds = [];

      const sql = createSchema(state);

      expect(sql).toContain(
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n" +
          `  'user table', 'schema', '${schema}', 'table', '${table}'\nGO`
      );
      expect(sql).toContain(
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n" +
          `  'user id', 'schema', '${schema}', 'table', '${table}', 'column', 'id'\nGO`
      );
    }
  );

  it('keeps a quoted dotted table name whole, in the dbo schema its CREATE TABLE puts it in', () => {
    const { state, users } = createFixture();
    state.settings.bracketType = BracketType.doubleQuote;
    users.name = 'sales.users';
    state.doc.tableIds = [users.id];
    state.doc.relationshipIds = [];
    state.doc.indexIds = [];

    const sql = createSchema(state);

    expect(sql).toContain('CREATE TABLE "sales.users"\n');
    expect(sql).toContain(
      "  'user table', 'schema', 'dbo', 'table', 'sales.users'\nGO"
    );
    expect(sql).toContain(
      "  'user id', 'schema', 'dbo', 'table', 'sales.users', 'column', 'id'\nGO"
    );
  });

  // CREATE TABLE "[Order]" and "shop.sales.users" each make one dbo table of
  // that whole name, brackets and dots included.
  it.each(['[Order]', 'shop.sales.users'])(
    'keeps the quoted table name %s whole, brackets and database part included',
    name => {
      const { state, users } = createFixture();
      state.settings.bracketType = BracketType.doubleQuote;
      users.name = name;
      state.doc.tableIds = [users.id];
      state.doc.relationshipIds = [];
      state.doc.indexIds = [];

      expect(createSchema(state)).toContain(
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n" +
          `  'user table', 'schema', 'dbo', 'table', '${name}'\nGO`
      );
    }
  );

  it('doubles the quotes of a schema it splits from the table name', () => {
    const { state, users } = createFixture();
    users.name = "o'sales.o'users";
    state.doc.tableIds = [users.id];
    state.doc.relationshipIds = [];
    state.doc.indexIds = [];

    expect(createSchema(state)).toContain(
      "  'user table', 'schema', 'o''sales', 'table', 'o''users'\nGO"
    );
  });
});

describe('MSSQL dotted table names', () => {
  it('names constraints and indexes after the table part of an unquoted schema.table', () => {
    const { state, users, posts, userId, userEmail } = createFixture();
    users.name = 'sales.users';
    posts.name = 'sales.posts';
    users.comment = '';
    userId.comment = '';
    userEmail.comment = '';

    expect(createSchema(state)).toBe(
      [
        '',
        'CREATE TABLE sales.posts',
        '(',
        '  id      INT,',
        '  user_id INT NOT NULL,',
        '  CONSTRAINT PK_posts PRIMARY KEY (id)',
        ')',
        'GO',
        '',
        'CREATE TABLE sales.users',
        '(',
        '  id    INT          NOT NULL IDENTITY(1,1),',
        "  email VARCHAR(255) NOT NULL DEFAULT 'a@b.c',",
        "  name  VARCHAR(50)  DEFAULT 'guest',",
        '  CONSTRAINT PK_users PRIMARY KEY (id)',
        ')',
        'GO',
        '',
        'ALTER TABLE sales.users',
        '  ADD CONSTRAINT UQ_users_email UNIQUE (email)',
        'GO',
        '',
        'ALTER TABLE sales.posts',
        '  ADD CONSTRAINT FK_users_TO_posts',
        '    FOREIGN KEY (user_id)',
        '    REFERENCES sales.users (id)',
        'GO',
        '',
        'CREATE INDEX IDX_posts',
        '  ON sales.posts (user_id ASC)',
        'GO',
        '',
        'CREATE UNIQUE INDEX IDX_EMAIL',
        '  ON sales.users (email DESC)',
        'GO',
        '',
      ].join('\n')
    );
  });

  it('repeats the primary key and unique names in each schema and numbers the foreign key and index names', () => {
    const { state, users, posts, userId, userEmail, postUserId } =
      createFixture();
    users.name = 'sales.users';
    posts.name = 'hr.posts';
    // The hr table borrows the sales columns, which the DDL reads by id alone.
    const hrUsers = createTable({
      id: 't-hr-users',
      name: 'hr.users',
      columnIds: [userId.id, userEmail.id],
    });
    const hrRelationship = createRelationship({
      id: 'r-hr',
      start: { tableId: hrUsers.id, columnIds: [userId.id] },
      end: { tableId: posts.id, columnIds: [postUserId.id] },
    });
    const hrIndex = createIndex({
      id: 'i-hr',
      name: '',
      tableId: hrUsers.id,
      indexColumnIds: ['ic-2'],
    });
    state.collections.tableEntities[hrUsers.id] = hrUsers;
    state.collections.relationshipEntities[hrRelationship.id] = hrRelationship;
    state.collections.indexEntities[hrIndex.id] = hrIndex;
    state.collections.indexEntities['i-2'].name = '';
    state.doc.tableIds.push(hrUsers.id);
    state.doc.relationshipIds.push(hrRelationship.id);
    state.doc.indexIds = ['i-2', hrIndex.id];

    const sql = createSchema(state);

    expect(sql.match(/CONSTRAINT PK_users PRIMARY KEY/g)).toHaveLength(2);
    expect(sql.match(/ADD CONSTRAINT UQ_users_email UNIQUE/g)).toHaveLength(2);
    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts1\n');
    expect(sql).toContain('CREATE UNIQUE INDEX IDX_users\n  ON sales.users');
    expect(sql).toContain('CREATE INDEX IDX_users1\n  ON hr.users');
  });

  it('numbers a foreign key and an index name that repeat an earlier one but for case', () => {
    const { state, users, posts, userId, postUserId } = createFixture();
    users.name = 'sales.users';
    posts.name = 'sales.posts';
    // The hr table borrows the sales key column, which the DDL reads by id alone.
    const hrUsers = createTable({
      id: 't-hr-users',
      name: 'hr.Users',
      columnIds: [userId.id],
    });
    const hrRelationship = createRelationship({
      id: 'r-hr',
      start: { tableId: hrUsers.id, columnIds: [userId.id] },
      end: { tableId: posts.id, columnIds: [postUserId.id] },
    });
    const hrIndex = createIndex({
      id: 'i-hr',
      name: '',
      tableId: hrUsers.id,
      indexColumnIds: ['ic-1'],
    });
    state.collections.tableEntities[hrUsers.id] = hrUsers;
    state.collections.relationshipEntities[hrRelationship.id] = hrRelationship;
    state.collections.indexEntities[hrIndex.id] = hrIndex;
    state.collections.indexEntities['i-2'].name = '';
    state.doc.tableIds.push(hrUsers.id);
    state.doc.relationshipIds.push(hrRelationship.id);
    state.doc.indexIds = ['i-2', hrIndex.id];

    const sql = createSchema(state);

    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_Users_TO_posts1\n');
    expect(sql).toContain('CREATE UNIQUE INDEX IDX_users\n  ON sales.users');
    expect(sql).toContain('CREATE INDEX IDX_Users1\n  ON hr.Users');
  });

  it('keeps a quoted dotted name whole in every automatic name', () => {
    const { state, users, posts } = createFixture();
    users.name = 'sales.users';
    posts.name = 'sales.posts';
    state.settings.bracketType = BracketType.doubleQuote;

    const sql = createSchema(state);

    expect(sql).toContain('  CONSTRAINT "PK_sales.users" PRIMARY KEY ("id")');
    expect(sql).toContain('  ADD CONSTRAINT "UQ_sales.users_email" UNIQUE');
    expect(sql).toContain('  ADD CONSTRAINT "FK_sales.users_TO_sales.posts"');
    expect(sql).toContain('CREATE INDEX "IDX_sales.posts"\n  ON "sales.posts"');
  });
});

describe('MSSQL formatTable', () => {
  it('omits the primary key constraint and the trailing comma without a primary key', () => {
    const state = createState();
    const msg = createColumn({
      id: 'c-msg',
      name: 'msg',
      dataType: 'TEXT',
    });
    const level = createColumn({
      id: 'c-level',
      name: 'lvl',
      dataType: 'INT',
      options: ColumnOption.notNull,
    });
    const table = createTable({
      id: 't-logs',
      name: 'logs',
      columnIds: [msg.id, level.id],
    });
    state.collections.tableColumnEntities[msg.id] = msg;
    state.collections.tableColumnEntities[level.id] = level;
    state.collections.tableEntities[table.id] = table;

    const buffer: string[] = [];
    formatTable(state, { table, buffer });

    expect(buffer).toEqual([
      'CREATE TABLE logs',
      '(',
      '  msg TEXT,',
      '  lvl INT  NOT NULL',
      ')\nGO',
    ]);
  });

  it('lists every primary key column inside one constraint', () => {
    const state = createState();
    const a = createColumn({
      id: 'c-a',
      name: 'a',
      dataType: 'INT',
      options: ColumnOption.primaryKey,
    });
    const b = createColumn({
      id: 'c-b',
      name: 'b',
      dataType: 'INT',
      options: ColumnOption.primaryKey,
    });
    const table = createTable({
      id: 't-pair',
      name: 'pair',
      columnIds: [a.id, b.id],
    });
    state.collections.tableColumnEntities[a.id] = a;
    state.collections.tableColumnEntities[b.id] = b;
    state.collections.tableEntities[table.id] = table;

    const buffer: string[] = [];
    formatTable(state, { table, buffer });

    expect(buffer).toEqual([
      'CREATE TABLE pair',
      '(',
      '  a INT,',
      '  b INT,',
      '  CONSTRAINT PK_pair PRIMARY KEY (a, b)',
      ')\nGO',
    ]);
  });

  it('prefers IDENTITY over the default value', () => {
    const state = createState();
    const column = createColumn({
      id: 'c-seq',
      name: 'seq',
      dataType: 'INT',
      default: '10',
      options: ColumnOption.autoIncrement,
    });
    const table = createTable({
      id: 't-seq',
      name: 'seq_table',
      columnIds: [column.id],
    });
    state.collections.tableColumnEntities[column.id] = column;
    state.collections.tableEntities[table.id] = table;

    const buffer: string[] = [];
    formatTable(state, { table, buffer });

    expect(buffer[2]).toBe('  seq INT IDENTITY(1,1)');
    expect(buffer[2]).not.toContain('DEFAULT');
  });

  it('ignores a whitespace-only default value', () => {
    const state = createState();
    const column = createColumn({
      id: 'c-blank',
      name: 'blank',
      dataType: 'INT',
      default: '   ',
    });
    const table = createTable({
      id: 't-blank',
      name: 'blank_table',
      columnIds: [column.id],
    });
    state.collections.tableColumnEntities[column.id] = column;
    state.collections.tableEntities[table.id] = table;

    const buffer: string[] = [];
    formatTable(state, { table, buffer });

    expect(buffer[2]).toBe('  blank INT');
  });
});

describe('MSSQL formatIndex', () => {
  it('does nothing when the index table does not exist', () => {
    const { state, postsIndex } = createFixture();
    Reflect.deleteProperty(state.collections.tableEntities, 't-posts');
    const buffer: string[] = [];

    formatIndex(state, { index: postsIndex, buffer, indexNames: [] });

    expect(buffer).toEqual([]);
  });

  it('does nothing when none of the index columns resolve', () => {
    const { state, postsIndex } = createFixture();
    Reflect.deleteProperty(
      state.collections.tableColumnEntities,
      'c-post-user-id'
    );
    const buffer: string[] = [];

    formatIndex(state, { index: postsIndex, buffer, indexNames: [] });

    expect(buffer).toEqual([]);
  });

  it('numbers auto generated index names per table', () => {
    const { state, postsIndex } = createFixture();
    const indexNames: Name[] = [];
    const buffer: string[] = [];

    formatIndex(state, { index: postsIndex, buffer, indexNames });
    formatIndex(state, { index: postsIndex, buffer, indexNames });

    expect(buffer).toEqual([
      'CREATE INDEX IDX_posts',
      '  ON posts (user_id ASC)\nGO',
      'CREATE INDEX IDX_posts1',
      '  ON posts (user_id ASC)\nGO',
    ]);
    expect(indexNames.map(({ name }) => name)).toEqual([
      'IDX_posts',
      'IDX_posts1',
    ]);
  });

  it('renders an unknown order type as an empty suffix', () => {
    const { state, postsIndex } = createFixture();
    state.collections.indexColumnEntities['ic-1'].orderType = 0;
    const buffer: string[] = [];

    formatIndex(state, { index: postsIndex, buffer, indexNames: [] });

    expect(buffer[1]).toBe('  ON posts (user_id )\nGO');
  });
});
