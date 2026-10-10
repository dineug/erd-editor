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
} from '@/utils/schema-sql/PostgreSQL';
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

interface SampleVariant {
  memberIdType?: string;
  postIdType?: string;
  postMemberIdType?: string;
  onDelete?: number;
}

// The two-table sample every options fixture was written from; a variant
// changes the key types or the delete action.
function createSampleState({
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
      name: 'member',
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

describe('PostgreSQL createSchema', () => {
  it('emits tables sorted by name, comments, foreign keys and indexes', () => {
    const { state } = createFixture();

    expect(createSchema(state)).toBe(
      [
        '',
        'CREATE TABLE posts',
        '(',
        '  id      INT,',
        '  user_id INT NOT NULL,',
        '  PRIMARY KEY (id)',
        ');',
        '',
        'CREATE TABLE users',
        '(',
        '  id    INT          NOT NULL GENERATED ALWAYS AS IDENTITY,',
        "  email VARCHAR(255) NOT NULL DEFAULT 'a@b.c' UNIQUE,",
        "  name  VARCHAR(50)  DEFAULT 'guest',",
        '  PRIMARY KEY (id)',
        ');',
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
    state.settings.bracketType = BracketType.backtick;
    state.doc.tableIds = ['t-posts'];
    state.doc.relationshipIds = [];
    state.doc.indexIds = [];

    expect(createSchema(state)).toBe(
      [
        '',
        'CREATE TABLE `posts`',
        '(',
        '  `id`      INT,',
        '  `user_id` INT NOT NULL,',
        '  PRIMARY KEY (`id`)',
        ');',
        '',
      ].join('\n')
    );
  });

  it('returns an empty string for an empty document', () => {
    expect(createSchema(createState())).toBe('');
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
    Reflect.deleteProperty(state.collections.tableEntities, 't-users');

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
});

describe('PostgreSQL dotted table names', () => {
  it('names foreign keys and indexes after the table part of an unquoted schema.table', () => {
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
        '  PRIMARY KEY (id)',
        ');',
        '',
        'CREATE TABLE sales.users',
        '(',
        '  id    INT          NOT NULL GENERATED ALWAYS AS IDENTITY,',
        "  email VARCHAR(255) NOT NULL DEFAULT 'a@b.c' UNIQUE,",
        "  name  VARCHAR(50)  DEFAULT 'guest',",
        '  PRIMARY KEY (id)',
        ');',
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
        'CREATE INDEX IDX_posts',
        '  ON sales.posts (user_id ASC);',
        '',
        'CREATE UNIQUE INDEX IDX_EMAIL',
        '  ON sales.users (email DESC);',
        '',
      ].join('\n')
    );
  });

  it('names keys after the table part of "sales"."users" without its quotes', () => {
    const { state, users, usersIndex } = createFixture();
    users.name = '"sales"."users"';
    usersIndex.name = '';

    const sql = createSchema(state);

    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IDX_users\n  ON "sales"."users" (email DESC);'
    );
  });

  it('numbers a foreign key and an index name that repeat an earlier one but for case', () => {
    const { state, users, posts, userId, userEmail, postUserId } =
      createFixture();
    users.name = 'sales.users';
    posts.name = 'sales.posts';
    // The hr table borrows the sales key and email columns, which the DDL reads
    // by id alone, and its index the sales email index column.
    const hrUsers = createTable({
      id: 't-hr-users',
      name: 'hr.Users',
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

    expect(sql).toContain('  ADD CONSTRAINT "FK_sales.users_TO_sales.posts"');
    expect(sql).toContain('CREATE INDEX "IDX_sales.posts"\n  ON "sales.posts"');
  });
});

describe('PostgreSQL formatTable', () => {
  it('omits the primary key clause and the trailing comma without a primary key', () => {
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

  it('lists every primary key column in one clause', () => {
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
      '  PRIMARY KEY (a, b)',
      ');',
    ]);
  });

  it('wraps a DEFAULT expression PostgreSQL reads only in parentheses', () => {
    const state = createState();
    const created = createColumn({
      id: 'c-created',
      name: 'created',
      dataType: 'TIMESTAMP',
      default: "now() AT TIME ZONE 'utc'::text",
    });
    const seq = createColumn({
      id: 'c-seq',
      name: 'seq',
      dataType: 'INT',
      default: "nextval('s'::regclass)",
    });
    const table = createTable({
      id: 't-log',
      name: 'log',
      columnIds: [created.id, seq.id],
    });
    state.collections.tableColumnEntities[created.id] = created;
    state.collections.tableColumnEntities[seq.id] = seq;
    state.collections.tableEntities[table.id] = table;

    const buffer: string[] = [];
    formatTable(state, { table, buffer });

    expect(buffer.slice(2, 4)).toEqual([
      "  created TIMESTAMP DEFAULT (now() AT TIME ZONE 'utc'::text),",
      "  seq     INT       DEFAULT nextval('s'::regclass)",
    ]);
  });

  it('prefers the identity clause over the default value', () => {
    const state = createState();
    const column = createColumn({
      id: 'c-seq',
      name: 'seq',
      dataType: 'INT',
      default: '10',
      options: ColumnOption.autoIncrement | ColumnOption.unique,
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

    expect(buffer[2]).toBe('  seq INT GENERATED ALWAYS AS IDENTITY UNIQUE');
  });

  it('ignores a whitespace-only default value', () => {
    const state = createState();
    const column = createColumn({
      id: 'c-blank',
      name: 'blank',
      dataType: 'INT',
      default: '  ',
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

describe('PostgreSQL formatIndex', () => {
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

describe('PostgreSQL identity types', () => {
  it.each([
    'INT',
    'INTEGER',
    'BIGINT',
    'SMALLINT',
    'INT2',
    'INT4',
    'INT8',
    ' int ',
  ])('makes an AUTOINCREMENT %j column an identity', dataType => {
    const sql = createSchemaSQL(
      createSampleState({ memberIdType: dataType }),
      Database.PostgreSQL
    );

    expect(sql.split('GENERATED ALWAYS AS IDENTITY')).toHaveLength(3);
    expect(sql).not.toContain('-- PostgreSQL takes IDENTITY');
  });

  it.each(['UUID', 'VARCHAR(36)', 'NUMERIC(10)', 'SERIAL'])(
    'writes an AUTOINCREMENT %j column without IDENTITY and says why',
    dataType => {
      const state = createSampleState({ memberIdType: dataType });
      state.collections.tableColumnEntities.m1.default = 'gen_random_uuid()';

      const sql = createSchemaSQL(state, Database.PostgreSQL);

      expect(sql.split('GENERATED ALWAYS AS IDENTITY')).toHaveLength(2);
      expect(sql).toContain(
        ');\n\n-- PostgreSQL takes IDENTITY only on smallint, integer or bigint, so member.id is written without it.\n\n'
      );
      expect(sql).not.toContain('DEFAULT');
    }
  );

  it('matches the UUID key fixture', () => {
    expect(
      createSchemaSQL(
        createSampleState({ memberIdType: 'UUID', postMemberIdType: 'UUID' }),
        Database.PostgreSQL
      )
    ).toBe(readFixture('PostgreSQL/non-integer-identity-create-none.sql'));
  });

  it('names every column of a table that goes without IDENTITY, quoted as the table is', () => {
    const state = createSampleState({ memberIdType: 'UUID' });
    state.settings.bracketType = BracketType.doubleQuote;
    state.collections.tableColumnEntities.m2.options |=
      ColumnOption.autoIncrement;

    const sql = createSchemaSQL(state, Database.PostgreSQL);

    expect(sql).toContain(
      [
        ');',
        '',
        '-- PostgreSQL takes IDENTITY only on smallint, integer or bigint, so "member"."id" is written without it.',
        '-- PostgreSQL takes IDENTITY only on smallint, integer or bigint, so "member"."email" is written without it.',
        '',
      ].join('\n')
    );
  });
});

describe('PostgreSQL options', () => {
  it('drops each foreign key right above adding it back under ifNotExists', () => {
    const state = createSampleState();
    state.settings.bracketType = BracketType.doubleQuote;
    state.collections.indexEntities.ix.unique = true;

    const sql = createSchemaSQL(state, Database.PostgreSQL, undefined, {
      statements: 'ifNotExists',
    });

    expect(sql).toContain('\nCREATE TABLE IF NOT EXISTS "member"\n');
    expect(sql).toContain(
      [
        '',
        'ALTER TABLE "post" DROP CONSTRAINT IF EXISTS "FK_member_TO_post";',
        'ALTER TABLE "post"',
        '  ADD CONSTRAINT "FK_member_TO_post"',
      ].join('\n')
    );
    expect(sql).toContain(
      '\nCREATE UNIQUE INDEX IF NOT EXISTS "idx_post_title"\n'
    );
  });

  it('matches the UUID key fixture under the editor defaults', () => {
    const state = createSampleState({
      memberIdType: 'UUID',
      postMemberIdType: 'UUID',
    });
    state.settings.databaseName = 'shop';

    expect(
      createSchemaSQL(state, Database.PostgreSQL, undefined, {
        statements: 'ifNotExists',
        header: 'createAndUse',
      })
    ).toBe(
      readFixture(
        'PostgreSQL/non-integer-identity-ifNotExists-createAndUse.sql'
      )
    );
  });

  it('writes the createAndUse header alone, quoted as the tables are', () => {
    const state = createState();

    expect(formatHeader(state, 'use', 'shop')).toBe('');
    state.settings.bracketType = BracketType.doubleQuote;
    expect(formatHeader(state, 'createAndUse', 'shop')).toBe(
      'CREATE SCHEMA IF NOT EXISTS "shop";\nSET search_path TO "shop", public;'
    );
  });

  it('names a table without a schema of its own in the header schema', () => {
    const { state, users, posts } = createFixture();
    users.name = 'sales.users';
    const written = createWrittenObjects();
    written.tables.push(users, posts);

    expect(formatDropBlock(state, written, 'createAndUse', 'shop')).toBe(
      'DROP TABLE IF EXISTS sales.users, shop.posts;'
    );
    expect(formatDropBlock(state, written, 'none', 'shop')).toBe(
      'DROP TABLE IF EXISTS sales.users, posts;'
    );
    state.settings.bracketType = BracketType.doubleQuote;
    expect(formatDropBlock(state, written, 'createAndUse', 'shop')).toBe(
      'DROP TABLE IF EXISTS "shop"."sales.users", "shop"."posts";'
    );
    expect(formatDropBlock(state, createWrittenObjects(), 'none', 'shop')).toBe(
      ''
    );
  });

  it('writes the header and the schema on the DROP for recreate', () => {
    const state = createSampleState();
    state.settings.databaseName = 'shop';
    state.settings.bracketType = BracketType.doubleQuote;

    expect(
      createSchemaSQL(state, Database.PostgreSQL, undefined, {
        statements: 'recreate',
        header: 'createAndUse',
      })
    ).toMatch(
      /^\nCREATE SCHEMA IF NOT EXISTS "shop";\nSET search_path TO "shop", public;\n\nDROP TABLE IF EXISTS "shop"."member", "shop"."post";\n\nCREATE TABLE "member"\n/
    );
  });
});
