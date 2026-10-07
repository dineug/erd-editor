import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  ColumnOption,
  Database,
  OrderType,
  ReferentialAction,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createSchemaSQL } from '@/utils/schema-sql';
import {
  createSchema,
  formatDropBlock,
  formatHeader,
  formatIndex,
  formatTable,
  oracleLongNames,
} from '@/utils/schema-sql/Oracle';
import { createWrittenObjects, Name } from '@/utils/schema-sql/utils';

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
    postUserId,
    postsIndex,
    usersIndex,
  };
}

/**
 * Adds an hr users table that posts also references, and an unnamed index on it
 * that the document does not list yet. The table borrows the fixture's columns,
 * which the DDL reads by id alone.
 */
function addHrUsers(
  { state, posts, userId, postUserId }: ReturnType<typeof createFixture>,
  {
    name,
    columnIds,
    indexColumnId,
  }: { name: string; columnIds: string[]; indexColumnId: string }
) {
  const hrUsers = createTable({ id: 't-hr-users', name, columnIds });
  const hrRelationship = createRelationship({
    id: 'r-hr',
    start: { tableId: hrUsers.id, columnIds: [userId.id] },
    end: { tableId: posts.id, columnIds: [postUserId.id] },
  });
  const hrIndex = createIndex({
    id: 'i-hr',
    name: '',
    tableId: hrUsers.id,
    indexColumnIds: [indexColumnId],
  });
  state.collections.tableEntities[hrUsers.id] = hrUsers;
  state.collections.relationshipEntities[hrRelationship.id] = hrRelationship;
  state.collections.indexEntities[hrIndex.id] = hrIndex;
  state.doc.tableIds.push(hrUsers.id);
  state.doc.relationshipIds.push(hrRelationship.id);
  return hrIndex;
}

interface SampleVariant {
  memberName?: string;
  memberIdType?: string;
  postIdType?: string;
  postMemberIdType?: string;
  onDelete?: number;
}

// The two-table sample every options fixture was written from; a variant
// changes the member table name, the key types or the delete action.
function createSampleState({
  memberName = 'member',
  memberIdType = 'INT',
  postIdType = 'INT',
  postMemberIdType = 'INT',
  onDelete = ReferentialAction.cascade,
}: SampleVariant = {}): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {},
    lww: {},
  } as unknown as RootState;
  const key =
    ColumnOption.primaryKey | ColumnOption.notNull | ColumnOption.autoIncrement;
  const columns = [
    createColumn({
      id: 'm1',
      tableId: 'tm',
      name: 'id',
      dataType: memberIdType,
      options: key,
    }),
    createColumn({
      id: 'm2',
      tableId: 'tm',
      name: 'email',
      dataType: 'VARCHAR(255)',
      options: ColumnOption.notNull | ColumnOption.unique,
    }),
    createColumn({
      id: 'p1',
      tableId: 'tp',
      name: 'id',
      dataType: postIdType,
      options: key,
    }),
    createColumn({
      id: 'p2',
      tableId: 'tp',
      name: 'member_id',
      dataType: postMemberIdType,
      options: ColumnOption.notNull,
    }),
    createColumn({
      id: 'p3',
      tableId: 'tp',
      name: 'title',
      dataType: 'VARCHAR(200)',
      options: ColumnOption.notNull,
    }),
  ];

  state.settings.databaseName = 'shop';
  state.collections.tableEntities = {
    tm: createTable({
      id: 'tm',
      name: memberName,
      comment: 'Members',
      columnIds: ['m1', 'm2'],
    }),
    tp: createTable({ id: 'tp', name: 'post', columnIds: ['p1', 'p2', 'p3'] }),
  };
  state.collections.tableColumnEntities = Object.fromEntries(
    columns.map(column => [column.id, column])
  );
  state.collections.relationshipEntities = {
    rp: createRelationship({
      id: 'rp',
      onDelete,
      start: { tableId: 'tm', columnIds: ['m1'] },
      end: { tableId: 'tp', columnIds: ['p2'] },
    }),
  };
  state.collections.indexEntities = {
    ix: createIndex({
      id: 'ix',
      name: 'idx_post_title',
      tableId: 'tp',
      indexColumnIds: ['ic'],
    }),
  };
  state.collections.indexColumnEntities = {
    ic: createIndexColumn({
      id: 'ic',
      indexId: 'ix',
      columnId: 'p3',
      orderType: OrderType.ASC,
    }),
  };
  state.doc.tableIds = ['tm', 'tp'];
  state.doc.relationshipIds = ['rp'];
  state.doc.indexIds = ['ix'];

  return state;
}

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

function readFixture(path: string): string {
  return readFileSync(join(FIXTURES, 'options', path), 'utf8');
}

describe('Oracle createSchema', () => {
  it('emits tables, unique constraints, sequences, triggers, comments, FKs and indexes', () => {
    const { state } = createFixture();

    expect(createSchema(state)).toBe(
      [
        '',
        'CREATE TABLE posts',
        '(',
        '  id      INT,',
        '  user_id INT NOT NULL,',
        '  CONSTRAINT PK_posts PRIMARY KEY (id)',
        ');',
        '',
        'CREATE TABLE users',
        '(',
        '  id    INT          NOT NULL,',
        "  email VARCHAR(255) DEFAULT 'a@b.c' NOT NULL,",
        "  name  VARCHAR(50)  DEFAULT 'guest',",
        '  CONSTRAINT PK_users PRIMARY KEY (id)',
        ');',
        '',
        'ALTER TABLE users',
        '  ADD CONSTRAINT UQ_users_email UNIQUE (email);',
        '',
        'CREATE SEQUENCE SEQ_users',
        'START WITH 1',
        'INCREMENT BY 1;',
        '',
        'CREATE OR REPLACE TRIGGER SEQ_TRG_users',
        'BEFORE INSERT ON users',
        'REFERENCING NEW AS NEW FOR EACH ROW',
        'BEGIN',
        '  SELECT SEQ_users.NEXTVAL',
        '  INTO :NEW.id',
        '  FROM DUAL;',
        'END;',
        '/',
        '',
        "COMMENT ON TABLE users IS 'user table';",
        '',
        "COMMENT ON COLUMN users.id IS 'user id';",
        '',
        "COMMENT ON COLUMN users.email IS 'email address';",
        '',
        'ALTER TABLE posts',
        '  ADD CONSTRAINT FK_users_TO_posts',
        '    FOREIGN KEY (user_id)',
        '    REFERENCES users (id);',
        '',
        'CREATE INDEX IDX_posts',
        '  ON posts (user_id ASC);',
        '',
        'CREATE UNIQUE INDEX IDX_EMAIL',
        '  ON users (email DESC);',
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
        ');',
        '',
      ].join('\n')
    );
  });

  it('returns an empty string for an empty document', () => {
    expect(createSchema(createState())).toBe('');
  });

  it('numbers duplicated sequence names but reuses the same trigger name', () => {
    const state = createState();
    const a = createColumn({
      id: 'c-a',
      name: 'a',
      dataType: 'INT',
      options: ColumnOption.autoIncrement,
    });
    const b = createColumn({
      id: 'c-b',
      name: 'b',
      dataType: 'INT',
      options: ColumnOption.autoIncrement,
    });
    const table = createTable({
      id: 't-nums',
      name: 'nums',
      columnIds: [a.id, b.id],
    });
    state.collections.tableColumnEntities[a.id] = a;
    state.collections.tableColumnEntities[b.id] = b;
    state.collections.tableEntities[table.id] = table;
    state.doc.tableIds = [table.id];

    const sql = createSchema(state);

    expect(sql).toBe(
      [
        '',
        'CREATE TABLE nums',
        '(',
        '  a INT,',
        '  b INT',
        ');',
        '',
        'CREATE SEQUENCE SEQ_nums',
        'START WITH 1',
        'INCREMENT BY 1;',
        '',
        'CREATE OR REPLACE TRIGGER SEQ_TRG_nums',
        'BEFORE INSERT ON nums',
        'REFERENCING NEW AS NEW FOR EACH ROW',
        'BEGIN',
        '  SELECT SEQ_nums.NEXTVAL',
        '  INTO :NEW.a',
        '  FROM DUAL;',
        'END;',
        '/',
        '',
        'CREATE SEQUENCE SEQ_nums1',
        'START WITH 1',
        'INCREMENT BY 1;',
        '',
        'CREATE OR REPLACE TRIGGER SEQ_TRG_nums',
        'BEFORE INSERT ON nums',
        'REFERENCING NEW AS NEW FOR EACH ROW',
        'BEGIN',
        '  SELECT SEQ_nums1.NEXTVAL',
        '  INTO :NEW.b',
        '  FROM DUAL;',
        'END;',
        '/',
        '',
      ].join('\n')
    );
  });

  it('numbers duplicated foreign key names', () => {
    const { state, users, posts, userId, postUserId } = createFixture();
    const second = createRelationship({
      id: 'r-2',
      start: { tableId: users.id, columnIds: [userId.id] },
      end: { tableId: posts.id, columnIds: [postUserId.id] },
    });
    state.collections.relationshipEntities[second.id] = second;
    state.doc.indexIds = [];
    state.doc.relationshipIds = ['r-1', 'r-2'];

    const sql = createSchema(state);

    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts1\n');
  });

  it('skips relationships whose tables are missing, blank line and all', () => {
    const { state } = createFixture();
    state.doc.tableIds = [];
    state.doc.indexIds = [];
    Reflect.deleteProperty(state.collections.tableEntities, 't-posts');

    expect(createSchema(state)).toBe('');
  });

  it('skips a relationship none of whose columns exist, blank line and all', () => {
    const { state } = createFixture();
    state.collections.relationshipEntities['r-1'].start.columnIds = [
      'missing-start',
    ];
    state.collections.relationshipEntities['r-1'].end.columnIds = [
      'missing-end',
    ];

    const sql = createSchema(state);
    state.doc.relationshipIds = [];

    expect(sql).not.toContain('FOREIGN KEY');
    expect(sql).toBe(createSchema(state));
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

    expect(sql).toContain('  ADD CONSTRAINT UQ_users_email UNIQUE (email);\n');
    expect(sql).toContain('  ADD CONSTRAINT UQ_posts_email UNIQUE (email);\n');
  });
});

describe('Oracle dotted table names', () => {
  it('names constraints, indexes, the sequence and the trigger after the table part of an unquoted schema.table', () => {
    const { state, users, posts } = createFixture();
    users.name = 'sales.users';
    posts.name = 'sales.posts';

    expect(createSchema(state)).toBe(
      [
        '',
        'CREATE TABLE sales.posts',
        '(',
        '  id      INT,',
        '  user_id INT NOT NULL,',
        '  CONSTRAINT PK_posts PRIMARY KEY (id)',
        ');',
        '',
        'CREATE TABLE sales.users',
        '(',
        '  id    INT          NOT NULL,',
        "  email VARCHAR(255) DEFAULT 'a@b.c' NOT NULL,",
        "  name  VARCHAR(50)  DEFAULT 'guest',",
        '  CONSTRAINT PK_users PRIMARY KEY (id)',
        ');',
        '',
        'ALTER TABLE sales.users',
        '  ADD CONSTRAINT UQ_users_email UNIQUE (email);',
        '',
        'CREATE SEQUENCE sales.SEQ_users',
        'START WITH 1',
        'INCREMENT BY 1;',
        '',
        'CREATE OR REPLACE TRIGGER sales.SEQ_TRG_users',
        'BEFORE INSERT ON sales.users',
        'REFERENCING NEW AS NEW FOR EACH ROW',
        'BEGIN',
        '  SELECT sales.SEQ_users.NEXTVAL',
        '  INTO :NEW.id',
        '  FROM DUAL;',
        'END;',
        '/',
        '',
        "COMMENT ON TABLE sales.users IS 'user table';",
        '',
        "COMMENT ON COLUMN sales.users.id IS 'user id';",
        '',
        "COMMENT ON COLUMN sales.users.email IS 'email address';",
        '',
        'ALTER TABLE sales.posts',
        '  ADD CONSTRAINT FK_users_TO_posts',
        '    FOREIGN KEY (user_id)',
        '    REFERENCES sales.users (id);',
        '',
        'CREATE INDEX sales.IDX_posts',
        '  ON sales.posts (user_id ASC);',
        '',
        'CREATE UNIQUE INDEX sales.IDX_EMAIL',
        '  ON sales.users (email DESC);',
        '',
      ].join('\n')
    );
  });

  it('repeats the primary key and unique names in each schema and numbers the foreign key and index names', () => {
    const fixture = createFixture();
    const { state, users, posts, userId, userEmail, usersIndex } = fixture;
    users.name = 'sales.users';
    posts.name = 'hr.posts';
    userId.options = ColumnOption.primaryKey | ColumnOption.notNull;
    const hrIndex = addHrUsers(fixture, {
      name: 'hr.users',
      columnIds: [userId.id, userEmail.id],
      indexColumnId: 'ic-2',
    });
    usersIndex.name = '';
    state.doc.indexIds = [usersIndex.id, hrIndex.id];

    const sql = createSchema(state);

    expect(sql.match(/CONSTRAINT PK_users PRIMARY KEY/g)).toHaveLength(2);
    expect(sql.match(/ADD CONSTRAINT UQ_users_email UNIQUE/g)).toHaveLength(2);
    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts1\n');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX sales.IDX_users\n  ON sales.users'
    );
    expect(sql).toContain('CREATE INDEX hr.IDX_users1\n  ON hr.users');
  });

  it('numbers a foreign key and an index name repeating an earlier one but for case, not a sequence', () => {
    const fixture = createFixture();
    const { state, users, posts, userId, usersIndex } = fixture;
    users.name = 'sales.users';
    posts.name = 'sales.posts';
    const hrIndex = addHrUsers(fixture, {
      name: 'hr.Users',
      columnIds: [userId.id],
      indexColumnId: 'ic-1',
    });
    usersIndex.name = '';
    state.doc.indexIds = [usersIndex.id, hrIndex.id];

    const sql = createSchema(state);

    expect(sql).toContain('CREATE SEQUENCE hr.SEQ_Users\n');
    expect(sql).toContain('CREATE SEQUENCE sales.SEQ_users\n');
    expect(sql).toContain(
      'CREATE OR REPLACE TRIGGER hr.SEQ_TRG_Users\nBEFORE INSERT ON hr.Users\n'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE TRIGGER sales.SEQ_TRG_users\nBEFORE INSERT ON sales.users\n'
    );
    expect(sql).toContain('  SELECT hr.SEQ_Users.NEXTVAL\n');
    expect(sql).toContain('  SELECT sales.SEQ_users.NEXTVAL\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_Users_TO_posts1\n');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX sales.IDX_users\n  ON sales.users'
    );
    expect(sql).toContain('CREATE INDEX hr.IDX_Users1\n  ON hr.Users');
  });

  it('puts an automatic index beside its table and numbers a table part differing only in case', () => {
    const { state, users, posts } = createFixture();
    users.name = 'sales.users';
    posts.name = 'hr.Users';
    state.doc.relationshipIds = [];
    state.doc.indexIds = [];
    const buffer: string[] = [];
    const indexNames: Name[] = [];
    const salesIndex = createIndex({
      id: 'i-sales',
      name: '',
      tableId: users.id,
      indexColumnIds: ['ic-2'],
    });
    const hrIndex = createIndex({
      id: 'i-hr',
      name: '',
      tableId: posts.id,
      indexColumnIds: ['ic-1'],
    });

    formatIndex(state, { index: salesIndex, buffer, indexNames });
    formatIndex(state, { index: hrIndex, buffer, indexNames });

    expect(buffer).toEqual([
      'CREATE INDEX sales.IDX_users',
      '  ON sales.users (email DESC);',
      'CREATE INDEX hr.IDX_Users1',
      '  ON hr.Users (user_id ASC);',
    ]);
  });

  it('puts a named index beside its dotted table, so one name serves two schemas', () => {
    const { state, users, posts } = createFixture();
    users.name = 'sales.users';
    posts.name = 'hr.Users';
    const buffer: string[] = [];
    const indexNames: Name[] = [];
    const salesIndex = createIndex({
      id: 'i-sales',
      name: 'idx_users_name',
      tableId: users.id,
      indexColumnIds: ['ic-2'],
    });
    const hrIndex = createIndex({
      id: 'i-hr',
      name: 'idx_users_name',
      tableId: posts.id,
      indexColumnIds: ['ic-1'],
    });

    formatIndex(state, { index: salesIndex, buffer, indexNames });
    formatIndex(state, { index: hrIndex, buffer, indexNames });

    expect(buffer).toEqual([
      'CREATE INDEX sales.idx_users_name',
      '  ON sales.users (email DESC);',
      'CREATE INDEX hr.idx_users_name',
      '  ON hr.Users (user_id ASC);',
    ]);
    expect(indexNames).toEqual([]);
  });

  // A quoted schema is case sensitive, so it qualifies the index, sequence and
  // trigger as written while the names take the table part without its quotes.
  it('names keys and the sequence after the table part of "sales"."users", keeping its schema as written', () => {
    const { state, users, usersIndex } = createFixture();
    users.name = '"sales"."users"';
    usersIndex.name = '';

    const sql = createSchema(state);

    expect(sql).toContain('  CONSTRAINT PK_users PRIMARY KEY (id)\n');
    expect(sql).toContain('  ADD CONSTRAINT UQ_users_email UNIQUE (email);\n');
    expect(sql).toContain('CREATE SEQUENCE "sales".SEQ_users\n');
    expect(sql).toContain(
      'CREATE OR REPLACE TRIGGER "sales".SEQ_TRG_users\nBEFORE INSERT ON "sales"."users"\n'
    );
    expect(sql).toContain('  SELECT "sales".SEQ_users.NEXTVAL\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "sales".IDX_users\n  ON "sales"."users" (email DESC);'
    );
  });

  it('leaves an index name the user already qualified as written', () => {
    const { state, users, usersIndex } = createFixture();
    users.name = 'sales.users';
    usersIndex.name = 'hr.idx_email';
    const buffer: string[] = [];

    formatIndex(state, { index: usersIndex, buffer, indexNames: [] });

    expect(buffer).toEqual([
      'CREATE UNIQUE INDEX hr.idx_email',
      '  ON sales.users (email DESC);',
    ]);
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
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "IDX_EMAIL"\n  ON "sales.users"'
    );
    expect(sql).toContain('CREATE SEQUENCE SEQ_sales.users\n');
    expect(sql).toContain(
      'CREATE OR REPLACE TRIGGER SEQ_TRG_sales.users\nBEFORE INSERT ON sales.users\n'
    );
    expect(sql).toContain('  SELECT SEQ_sales.users.NEXTVAL\n');
  });
});

describe('Oracle formatTable', () => {
  it('omits the primary key constraint and the trailing comma without a primary key', () => {
    const state = createState();
    const msg = createColumn({ id: 'c-msg', name: 'msg', dataType: 'TEXT' });
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
      ');',
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
      ');',
    ]);
  });

  it('keeps the default value even for auto increment columns', () => {
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

    expect(buffer[2]).toBe('  seq INT DEFAULT 10');
  });

  it('ignores a whitespace-only default value', () => {
    const state = createState();
    const column = createColumn({
      id: 'c-blank',
      name: 'blank',
      dataType: 'INT',
      default: '   ',
      options: ColumnOption.notNull,
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

    expect(buffer[2]).toBe('  blank INT NOT NULL');
  });
});

describe('Oracle formatIndex', () => {
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
      '  ON posts (user_id ASC);',
      'CREATE INDEX IDX_posts1',
      '  ON posts (user_id ASC);',
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

    expect(buffer[1]).toBe('  ON posts (user_id );');
  });
});

describe('Oracle phase 0', () => {
  it('ends each trigger with a slash and binds :NEW, as SQL*Plus runs it', () => {
    expect(createSchemaSQL(createSampleState(), Database.Oracle)).toBe(
      readFixture('Oracle/phase0-create-none.sql')
    );
  });
});

describe('Oracle names past 30 bytes', () => {
  it('lists every name over 30 bytes once, in the order written', () => {
    const state = createSampleState({
      memberName: 'member_notification_settings',
    });
    const { over30Bytes } = JSON.parse(
      readFixture('Oracle/d14-2-long-names.json')
    );

    expect(oracleLongNames(state)).toEqual(over30Bytes);
    expect(oracleLongNames(createSampleState())).toEqual([]);
  });

  it('counts UTF-8 bytes, 30 of them still taken', () => {
    // 27 bytes in 11 characters, so the 30-byte PK name stays off the list.
    const state = createSampleState({ memberName: '회원_알림_설정_목록' });

    expect(oracleLongNames(state)).toEqual([
      'UQ_회원_알림_설정_목록_email',
      'SEQ_회원_알림_설정_목록',
      'SEQ_TRG_회원_알림_설정_목록',
      'FK_회원_알림_설정_목록_TO_post',
    ]);
  });

  it('collects the names without changing a byte of the script', () => {
    const { state, users, posts, postsIndex } = createFixture();
    users.name = 'sales.users';
    posts.name = '"sales"."posts"';
    postsIndex.name = 'hr.idx_posts_user';
    const written = createWrittenObjects();

    const sql = createSchema(state, undefined, {
      statements: 'create',
      written,
    });

    expect(sql).toBe(createSchema(state));
    expect(written.identifiers).toEqual([
      'sales',
      'posts',
      'id',
      'user_id',
      'PK_posts',
      'sales',
      'users',
      'id',
      'email',
      'name',
      'PK_users',
      'UQ_users_email',
      'SEQ_users',
      'SEQ_TRG_users',
      'FK_users_TO_posts',
      'idx_posts_user',
      'IDX_EMAIL',
    ]);
    expect(written.sequences).toEqual(['sales.SEQ_users']);
  });
});

describe('Oracle header and drop block', () => {
  it('writes ALTER SESSION SET CURRENT_SCHEMA for use alone', () => {
    const state = createState();

    expect(formatHeader(state, 'use', 'shop')).toBe(
      'ALTER SESSION SET CURRENT_SCHEMA = shop;'
    );
    expect(formatHeader(state, 'createAndUse', 'shop')).toBe('');
    state.settings.bracketType = BracketType.doubleQuote;
    expect(formatHeader(state, 'use', 'shop')).toBe(
      'ALTER SESSION SET CURRENT_SCHEMA = "shop";'
    );
  });

  it('drops each table, then each sequence with its owner, passing over what is not there', () => {
    const { state, users } = createFixture();
    users.name = 'sales.users';
    const written = createWrittenObjects();
    createSchema(state, undefined, { statements: 'recreate', written });

    expect(formatDropBlock(state, written)).toBe(
      [
        'BEGIN',
        "  EXECUTE IMMEDIATE 'DROP TABLE posts CASCADE CONSTRAINTS';",
        'EXCEPTION WHEN OTHERS THEN',
        '  IF SQLCODE != -942 THEN RAISE; END IF;',
        'END;',
        '/',
        '',
        'BEGIN',
        "  EXECUTE IMMEDIATE 'DROP TABLE sales.users CASCADE CONSTRAINTS';",
        'EXCEPTION WHEN OTHERS THEN',
        '  IF SQLCODE != -942 THEN RAISE; END IF;',
        'END;',
        '/',
        '',
        'BEGIN',
        "  EXECUTE IMMEDIATE 'DROP SEQUENCE sales.SEQ_users';",
        'EXCEPTION WHEN OTHERS THEN',
        '  IF SQLCODE != -2289 THEN RAISE; END IF;',
        'END;',
        '/',
      ].join('\n')
    );
  });

  it('quotes a table as its CREATE does and doubles a quote in the statement', () => {
    const { state, users } = createFixture();
    users.name = "o'users";
    state.settings.bracketType = BracketType.doubleQuote;
    const written = createWrittenObjects();
    createSchema(state, undefined, { statements: 'recreate', written });

    const block = formatDropBlock(state, written);

    expect(block).toContain(
      `  EXECUTE IMMEDIATE 'DROP TABLE "o''users" CASCADE CONSTRAINTS';`
    );
    expect(block).toContain(
      `  EXECUTE IMMEDIATE 'DROP SEQUENCE SEQ_o''users';`
    );
    expect(formatDropBlock(state, createWrittenObjects())).toBe('');
  });
});
