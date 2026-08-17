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
} from '@/utils/schema-sql/Oracle';
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
    postUserId,
    postsIndex,
    usersIndex,
  };
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
        '  INTO: NEW.id',
        '  FROM DUAL;',
        'END;',
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
        '  INTO: NEW.a',
        '  FROM DUAL;',
        'END;',
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
        '  INTO: NEW.b',
        '  FROM DUAL;',
        'END;',
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
    Reflect.deleteProperty(state.collections.tableEntities, 't-posts');

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
        '    REFERENCES users ();',
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

    expect(sql).toContain('  ADD CONSTRAINT UQ_users_email UNIQUE (email);\n');
    expect(sql).toContain('  ADD CONSTRAINT UQ_posts_email UNIQUE (email);\n');
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
