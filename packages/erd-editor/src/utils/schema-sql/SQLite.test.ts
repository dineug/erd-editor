import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vitest';

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
} from '@/utils/schema-sql/SQLite';
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

  return { state, users, posts, postsIndex, usersIndex };
}

/** Table with `count` primary key columns plus one plain column. */
function seedParentChild(
  state: RootState,
  {
    pkNames,
    autoIncrement = false,
    relationshipCount = 1,
  }: { pkNames: string[]; autoIncrement?: boolean; relationshipCount?: number }
) {
  const parentId = createColumn({
    id: 'c-parent-id',
    tableId: 't-parent',
    name: 'id',
    dataType: 'INT',
    options: ColumnOption.primaryKey,
  });
  const parent = createTable({
    id: 't-parent',
    name: 'parent',
    columnIds: [parentId.id],
  });
  const pkColumns = pkNames.map((name, i) =>
    createColumn({
      id: `c-child-pk-${i}`,
      tableId: 't-child',
      name,
      dataType: 'INT',
      options:
        ColumnOption.primaryKey |
        (autoIncrement ? ColumnOption.autoIncrement : 0),
    })
  );
  const fkColumn = createColumn({
    id: 'c-child-fk',
    tableId: 't-child',
    name: 'fk_col',
    dataType: 'INT',
  });
  const child = createTable({
    id: 't-child',
    name: 'child',
    columnIds: [...pkColumns.map(({ id }) => id), fkColumn.id],
  });

  state.collections.tableEntities[parent.id] = parent;
  state.collections.tableEntities[child.id] = child;
  [parentId, ...pkColumns, fkColumn].forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });

  const relationshipIds: string[] = [];
  for (let i = 0; i < relationshipCount; i++) {
    const relationship = createRelationship({
      id: `r-${i}`,
      start: { tableId: parent.id, columnIds: [parentId.id] },
      end: { tableId: child.id, columnIds: [fkColumn.id] },
    });
    state.collections.relationshipEntities[relationship.id] = relationship;
    relationshipIds.push(relationship.id);
  }
  state.doc.relationshipIds = relationshipIds;
  state.doc.tableIds = [parent.id, child.id];

  return { parent, child, parentId, pkColumns, fkColumn };
}

describe('SQLite createSchema', () => {
  it('emits table comments, inline foreign keys, AUTOINCREMENT and indexes', () => {
    const { state } = createFixture();

    expect(createSchema(state)).toBe(
      [
        '',
        'CREATE TABLE posts',
        '(',
        '  id      INT NULL    ,',
        '  user_id INT NOT NULL,',
        '  PRIMARY KEY (id),',
        '  FOREIGN KEY (user_id) REFERENCES users (id)',
        ');',
        '',
        '-- user table',
        'CREATE TABLE users',
        '(',
        '  -- user id',
        '  id    INT          NOT NULL,',
        '  -- email address',
        "  email VARCHAR(255) NOT NULL UNIQUE DEFAULT 'a@b.c',",
        "  name  VARCHAR(50)  NULL     DEFAULT 'guest',",
        '  PRIMARY KEY (id AUTOINCREMENT)',
        ');',
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
    state.settings.bracketType = BracketType.singleQuote;
    state.doc.tableIds = ['t-posts'];
    state.doc.indexIds = [];

    expect(createSchema(state)).toBe(
      [
        '',
        "CREATE TABLE 'posts'",
        '(',
        "  'id'      INT NULL    ,",
        "  'user_id' INT NOT NULL,",
        "  PRIMARY KEY ('id'),",
        "  FOREIGN KEY ('user_id') REFERENCES 'users' ('id')",
        ');',
        '',
      ].join('\n')
    );
  });

  it('returns an empty string for an empty document', () => {
    expect(createSchema(createState())).toBe('');
  });
});

describe('SQLite formatTable', () => {
  it('adds AUTOINCREMENT and a trailing comma when a relationship follows the single primary key', () => {
    const state = createState();
    const { child } = seedParentChild(state, {
      pkNames: ['id'],
      autoIncrement: true,
    });

    const buffer: string[] = [];
    formatTable(state, { table: child, buffer });

    expect(buffer).toEqual([
      'CREATE TABLE child',
      '(',
      '  id     INT NULL    ,',
      '  fk_col INT NULL    ,',
      '  PRIMARY KEY (id AUTOINCREMENT),',
      '  FOREIGN KEY (fk_col) REFERENCES parent (id)',
      ');',
    ]);
  });

  it('never adds AUTOINCREMENT to a composite primary key', () => {
    const state = createState();
    const { child } = seedParentChild(state, {
      pkNames: ['a', 'b'],
      autoIncrement: true,
    });

    const buffer: string[] = [];
    formatTable(state, { table: child, buffer });

    expect(buffer).toEqual([
      'CREATE TABLE child',
      '(',
      '  a      INT NULL    ,',
      '  b      INT NULL    ,',
      '  fk_col INT NULL    ,',
      '  PRIMARY KEY (a, b),',
      '  FOREIGN KEY (fk_col) REFERENCES parent (id)',
      ');',
    ]);
  });

  it('drops the trailing comma from a composite primary key without relationships', () => {
    const state = createState();
    const { child } = seedParentChild(state, {
      pkNames: ['a', 'b'],
      relationshipCount: 0,
    });

    const buffer: string[] = [];
    formatTable(state, { table: child, buffer });

    expect(buffer).toEqual([
      'CREATE TABLE child',
      '(',
      '  a      INT NULL    ,',
      '  b      INT NULL    ,',
      '  fk_col INT NULL    ,',
      '  PRIMARY KEY (a, b)',
      ');',
    ]);
  });

  it('drops the trailing comma from a single primary key without relationships', () => {
    const state = createState();
    const { child } = seedParentChild(state, {
      pkNames: ['id'],
      relationshipCount: 0,
    });

    const buffer: string[] = [];
    formatTable(state, { table: child, buffer });

    expect(buffer[buffer.length - 2]).toBe('  PRIMARY KEY (id)');
    expect(buffer[buffer.length - 1]).toBe(');');
  });

  it('separates multiple foreign keys with commas', () => {
    const state = createState();
    const { child } = seedParentChild(state, {
      pkNames: ['id'],
      relationshipCount: 2,
    });

    const buffer: string[] = [];
    formatTable(state, { table: child, buffer });

    expect(buffer.slice(4)).toEqual([
      '  PRIMARY KEY (id),',
      '  FOREIGN KEY (fk_col) REFERENCES parent (id),',
      '  FOREIGN KEY (fk_col) REFERENCES parent (id)',
      ');',
    ]);
  });

  it('skips relationships whose start table is missing', () => {
    const state = createState();
    const { child } = seedParentChild(state, { pkNames: ['id'] });
    Reflect.deleteProperty(state.collections.tableEntities, 't-parent');

    const buffer: string[] = [];
    formatTable(state, { table: child, buffer });

    expect(buffer).toEqual([
      'CREATE TABLE child',
      '(',
      '  id     INT NULL    ,',
      '  fk_col INT NULL    ,',
      '  PRIMARY KEY (id),',
      ');',
    ]);
  });

  it('drops relationship columns that no longer exist', () => {
    const state = createState();
    const { child } = seedParentChild(state, { pkNames: ['id'] });
    state.collections.relationshipEntities['r-0'].start.columnIds = [
      'missing-start',
    ];
    state.collections.relationshipEntities['r-0'].end.columnIds = [
      'missing-end',
    ];

    const buffer: string[] = [];
    formatTable(state, { table: child, buffer });

    expect(buffer[buffer.length - 2]).toBe(
      '  FOREIGN KEY () REFERENCES parent ()'
    );
  });

  it('emits no primary key clause when no column is a primary key', () => {
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
      '  msg TEXT NULL    ,',
      '  lvl INT  NOT NULL',
      ');',
    ]);
  });

  it('suppresses the default value on auto increment columns', () => {
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

    expect(buffer[2]).toBe('  seq INT NULL     UNIQUE');
  });

  it('ignores a whitespace-only default value and a whitespace-only comment', () => {
    const state = createState();
    const column = createColumn({
      id: 'c-blank',
      name: 'blank',
      dataType: 'INT',
      default: '  ',
      comment: '  ',
    });
    const table = createTable({
      id: 't-blank',
      name: 'blank_table',
      comment: ' ',
      columnIds: [column.id],
    });
    state.collections.tableColumnEntities[column.id] = column;
    state.collections.tableEntities[table.id] = table;

    const buffer: string[] = [];
    formatTable(state, { table, buffer });

    expect(buffer).toEqual([
      'CREATE TABLE blank_table',
      '(',
      '  blank INT NULL    ',
      ');',
    ]);
  });
});

describe('SQLite formatIndex', () => {
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
