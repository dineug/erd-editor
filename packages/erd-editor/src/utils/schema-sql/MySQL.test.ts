import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { BracketType, ColumnOption, OrderType } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Index, Relationship } from '@/internal-types';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createSchema,
  formatDropBlock,
  formatHeader,
  formatIndex,
  formatTable,
} from '@/utils/schema-sql/MySQL';
import { createWrittenObjects, Name } from '@/utils/schema-sql/utils';

function createFixture() {
  const state = {
    ...schemaV3Parser({}),
    editor: {},
    lww: {},
  } as unknown as RootState;

  const idColumn = createColumn({
    id: 'col-id',
    tableId: 'tbl-users',
    name: 'id',
    dataType: 'INT',
    options:
      ColumnOption.primaryKey |
      ColumnOption.notNull |
      ColumnOption.autoIncrement,
  });
  const nameColumn = createColumn({
    id: 'col-name',
    tableId: 'tbl-users',
    name: 'name',
    dataType: 'VARCHAR(50)',
    default: "'guest'",
    comment: 'user name',
    options: ColumnOption.notNull | ColumnOption.unique,
  });
  const ageColumn = createColumn({
    id: 'col-age',
    tableId: 'tbl-users',
    name: 'age',
    dataType: 'INT',
  });
  const titleColumn = createColumn({
    id: 'col-title',
    tableId: 'tbl-posts',
    name: 'title',
    dataType: 'VARCHAR(20)',
    options: ColumnOption.notNull,
  });
  const userIdColumn = createColumn({
    id: 'col-user-id',
    tableId: 'tbl-posts',
    name: 'user_id',
    dataType: 'INT',
  });

  const users = createTable({
    id: 'tbl-users',
    name: 'users',
    comment: 'user table',
    columnIds: ['col-id', 'col-name', 'col-age'],
  });
  const posts = createTable({
    id: 'tbl-posts',
    name: 'posts',
    columnIds: ['col-title', 'col-user-id'],
  });

  const relationship = createRelationship({
    id: 'rel-1',
    start: { tableId: 'tbl-users', columnIds: ['col-id'] },
    end: { tableId: 'tbl-posts', columnIds: ['col-user-id'] },
  });

  const indexColumn = createIndexColumn({
    id: 'idx-col-1',
    indexId: 'idx-1',
    columnId: 'col-title',
    orderType: OrderType.ASC,
  });
  const index = createIndex({
    id: 'idx-1',
    tableId: 'tbl-posts',
    indexColumnIds: ['idx-col-1'],
  });

  state.collections.tableEntities = {
    'tbl-users': users,
    'tbl-posts': posts,
  };
  state.collections.tableColumnEntities = {
    'col-id': idColumn,
    'col-name': nameColumn,
    'col-age': ageColumn,
    'col-title': titleColumn,
    'col-user-id': userIdColumn,
  };
  state.collections.relationshipEntities = { 'rel-1': relationship };
  state.collections.indexEntities = { 'idx-1': index };
  state.collections.indexColumnEntities = { 'idx-col-1': indexColumn };

  state.doc.tableIds = ['tbl-users', 'tbl-posts'];
  state.doc.relationshipIds = ['rel-1'];
  state.doc.indexIds = ['idx-1'];

  return { state, users, posts, index, relationship };
}

/**
 * Adds a second users table that posts also references, and an unnamed index on
 * users and on it that the document does not list yet. The table borrows the
 * users key column, which the DDL reads by id alone.
 */
function addSecondUsers(state: RootState, name: string) {
  const table = createTable({
    id: 'tbl-users-2',
    name,
    columnIds: ['col-id'],
  });
  const relationship = createRelationship({
    id: 'rel-users-2',
    start: { tableId: table.id, columnIds: ['col-id'] },
    end: { tableId: 'tbl-posts', columnIds: ['col-user-id'] },
  });
  const usersIndex = createIndex({
    id: 'idx-users',
    tableId: 'tbl-users',
    indexColumnIds: ['idx-col-1'],
  });
  const index = createIndex({
    id: 'idx-users-2',
    tableId: table.id,
    indexColumnIds: ['idx-col-1'],
  });
  state.collections.tableEntities[table.id] = table;
  state.collections.relationshipEntities[relationship.id] = relationship;
  state.collections.indexEntities[usersIndex.id] = usersIndex;
  state.collections.indexEntities[index.id] = index;
  state.doc.tableIds.push(table.id);
  state.doc.relationshipIds.push(relationship.id);
  return { usersIndex, index };
}

describe('schema-sql/MySQL', () => {
  describe('formatTable', () => {
    it('aligns columns, emits AUTO_INCREMENT, PRIMARY KEY and the table comment', () => {
      const { state, users } = createFixture();
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer).toEqual([
        'CREATE TABLE users',
        '(',
        '  id   INT         NOT NULL AUTO_INCREMENT,',
        "  name VARCHAR(50) NOT NULL DEFAULT 'guest' COMMENT 'user name',",
        '  age  INT         NULL    ,',
        '  PRIMARY KEY (id)',
        ") COMMENT 'user table';",
      ]);
    });

    it('omits PRIMARY KEY, drops the trailing comma and closes plainly without a comment', () => {
      const { state, posts } = createFixture();
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer).toEqual([
        'CREATE TABLE posts',
        '(',
        '  title   VARCHAR(20) NOT NULL,',
        '  user_id INT         NULL    ',
        ');',
      ]);
    });

    it('treats a whitespace-only table comment as no comment', () => {
      const { state, posts } = createFixture();
      posts.comment = '   ';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer.at(-1)).toBe(');');
    });

    it('wraps identifiers with the configured bracket', () => {
      const { state, users } = createFixture();
      state.settings.bracketType = BracketType.backtick;
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer[0]).toBe('CREATE TABLE `users`');
      expect(buffer[2]).toBe('  `id`   INT         NOT NULL AUTO_INCREMENT,');
      expect(buffer[5]).toBe('  PRIMARY KEY (`id`)');
    });

    it('wraps a DEFAULT expression in the parentheses MySQL needs', () => {
      const { state, users } = createFixture();
      const columns = state.collections.tableColumnEntities;
      columns['col-name'].default = 'uuid()';
      columns['col-age'].default =
        'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer[3]).toBe(
        "  name VARCHAR(50) NOT NULL DEFAULT (uuid()) COMMENT 'user name',"
      );
      expect(buffer[4]).toBe(
        '  age  INT         NULL     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
      );
    });

    it('wraps a literal DEFAULT on a LONG VARCHAR column, a MEDIUMTEXT to MySQL', () => {
      const { state, users } = createFixture();
      state.collections.tableColumnEntities['col-name'].dataType =
        'LONG VARCHAR';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer[3]).toBe(
        "  name LONG VARCHAR NOT NULL DEFAULT ('guest') COMMENT 'user name',"
      );
    });

    it('prefers AUTO_INCREMENT over a DEFAULT value on the same column', () => {
      const { state, users } = createFixture();
      state.collections.tableColumnEntities['col-id'].default = '1';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer[2]).toBe('  id   INT         NOT NULL AUTO_INCREMENT,');
      expect(buffer[2]).not.toContain('DEFAULT');
    });

    it('ignores a whitespace-only default and comment', () => {
      const { state, posts } = createFixture();
      const column = state.collections.tableColumnEntities['col-user-id'];
      column.default = '  ';
      column.comment = '  ';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer[3]).toBe('  user_id INT         NULL    ');
    });

    it('renders an empty table body when it has no columns', () => {
      const { state } = createFixture();
      const empty = createTable({ id: 'tbl-empty', name: 'empty' });
      const buffer: string[] = [];

      formatTable(state, { buffer, table: empty });

      expect(buffer).toEqual(['CREATE TABLE empty', '(', ');']);
    });
  });

  describe('formatIndex', () => {
    it('generates an auto named index with the column order type', () => {
      const { state, index } = createFixture();
      const buffer: string[] = [];
      const indexNames: Name[] = [];

      formatIndex(state, { buffer, index, indexNames });

      expect(buffer).toEqual([
        'CREATE INDEX IDX_posts',
        '  ON posts (title ASC);',
      ]);
      expect(indexNames.map(v => v.name)).toEqual(['IDX_posts']);
    });

    it('deduplicates generated index names across calls', () => {
      const { state, index } = createFixture();
      const buffer: string[] = [];
      const indexNames: Name[] = [];

      formatIndex(state, { buffer, index, indexNames });
      formatIndex(state, { buffer, index, indexNames });

      expect(buffer[0]).toBe('CREATE INDEX IDX_posts');
      expect(buffer[2]).toBe('CREATE INDEX IDX_posts1');
    });

    it('keeps an explicit index name and emits UNIQUE when requested', () => {
      const { state, index } = createFixture();
      index.name = 'UX_posts_title';
      index.unique = true;
      state.collections.indexColumnEntities['idx-col-1'].orderType =
        OrderType.DESC;
      const buffer: string[] = [];
      const indexNames: Name[] = [];

      formatIndex(state, { buffer, index, indexNames });

      expect(buffer).toEqual([
        'CREATE UNIQUE INDEX UX_posts_title',
        '  ON posts (title DESC);',
      ]);
      expect(indexNames).toHaveLength(0);
    });

    it('does nothing when the index table is missing', () => {
      const { state } = createFixture();
      const buffer: string[] = [];

      formatIndex(state, {
        buffer,
        index: createIndex({
          id: 'idx-x',
          tableId: 'nope',
          indexColumnIds: ['idx-col-1'],
        }) as Index,
        indexNames: [],
      });

      expect(buffer).toEqual([]);
    });

    it('does nothing when no index column resolves to a real column', () => {
      const { state } = createFixture();
      state.collections.indexColumnEntities['idx-col-1'].columnId = 'ghost';
      const buffer: string[] = [];

      formatIndex(state, {
        buffer,
        index: state.collections.indexEntities['idx-1'],
        indexNames: [],
      });

      expect(buffer).toEqual([]);
    });

    it('wraps index identifiers with the configured bracket', () => {
      const { state, index } = createFixture();
      state.settings.bracketType = BracketType.doubleQuote;
      const buffer: string[] = [];

      formatIndex(state, { buffer, index, indexNames: [] });

      expect(buffer).toEqual([
        'CREATE INDEX "IDX_posts"',
        '  ON "posts" ("title" ASC);',
      ]);
    });
  });

  describe('createSchema', () => {
    it('emits tables sorted by name, unique constraints, foreign keys and indexes', () => {
      const { state } = createFixture();

      expect(createSchema(state).split('\n')).toEqual([
        '',
        'CREATE TABLE posts',
        '(',
        '  title   VARCHAR(20) NOT NULL,',
        '  user_id INT         NULL    ',
        ');',
        '',
        'CREATE TABLE users',
        '(',
        '  id   INT         NOT NULL AUTO_INCREMENT,',
        "  name VARCHAR(50) NOT NULL DEFAULT 'guest' COMMENT 'user name',",
        '  age  INT         NULL    ,',
        '  PRIMARY KEY (id)',
        ") COMMENT 'user table';",
        '',
        'ALTER TABLE users',
        '  ADD CONSTRAINT UQ_users_name UNIQUE (name);',
        '',
        'ALTER TABLE posts',
        '  ADD CONSTRAINT FK_users_TO_posts',
        '    FOREIGN KEY (user_id)',
        '    REFERENCES users (id);',
        '',
        'CREATE INDEX IDX_posts',
        '  ON posts (title ASC);',
        '',
      ]);
    });

    it('returns only a newline-joined empty buffer for an empty document', () => {
      const { state } = createFixture();
      state.doc.tableIds = [];
      state.doc.relationshipIds = [];
      state.doc.indexIds = [];

      expect(createSchema(state)).toBe('');
    });

    it('deduplicates foreign key constraint names', () => {
      const { state, relationship } = createFixture();
      const duplicate = createRelationship({
        id: 'rel-2',
        start: { tableId: 'tbl-users', columnIds: ['col-id'] },
        end: { tableId: 'tbl-posts', columnIds: ['col-user-id'] },
      }) as Relationship;
      state.collections.relationshipEntities['rel-2'] = duplicate;
      state.doc.relationshipIds = [relationship.id, 'rel-2'];

      const sql = createSchema(state);

      expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
      expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts1\n');
    });

    it('skips a relationship none of whose columns resolve, blank line and all', () => {
      const { state } = createFixture();
      const relationship = state.collections.relationshipEntities['rel-1'];
      relationship.start.columnIds = ['ghost-start'];
      relationship.end.columnIds = ['ghost-end'];

      const sql = createSchema(state);

      expect(sql).not.toContain('FOREIGN KEY');
      expect(sql).toContain(
        '  ADD CONSTRAINT UQ_users_name UNIQUE (name);\n\nCREATE INDEX IDX_posts\n'
      );
    });

    it('skips a relationship whose tables cannot be resolved', () => {
      const { state } = createFixture();
      state.collections.relationshipEntities['rel-1'].end.tableId = 'ghost';

      expect(createSchema(state)).not.toContain('ADD CONSTRAINT FK_');
    });

    it('applies the bracket type to unique constraints and foreign keys', () => {
      const { state } = createFixture();
      state.settings.bracketType = BracketType.backtick;

      const sql = createSchema(state);

      expect(sql).toContain('ALTER TABLE `users`\n');
      expect(sql).toContain(
        '  ADD CONSTRAINT `UQ_users_name` UNIQUE (`name`);\n'
      );
      expect(sql).toContain('    REFERENCES `users` (`id`);\n');
    });

    it('qualifies a unique constraint with its table so two tables can share a column name', () => {
      const { state, posts } = createFixture();
      state.collections.tableColumnEntities['col-post-name'] = createColumn({
        id: 'col-post-name',
        tableId: 'tbl-posts',
        name: 'name',
        dataType: 'VARCHAR(50)',
        options: ColumnOption.unique,
      });
      posts.columnIds.push('col-post-name');

      const sql = createSchema(state);

      expect(sql).toContain('  ADD CONSTRAINT UQ_users_name UNIQUE (name);\n');
      expect(sql).toContain('  ADD CONSTRAINT UQ_posts_name UNIQUE (name);\n');
    });
  });
});

describe('schema-sql/MySQL dotted table names', () => {
  it('names constraints and indexes after the table part of an unquoted schema.table', () => {
    const { state, users, posts } = createFixture();
    users.name = 'sales.users';
    posts.name = 'sales.posts';

    expect(createSchema(state).split('\n')).toEqual([
      '',
      'CREATE TABLE sales.posts',
      '(',
      '  title   VARCHAR(20) NOT NULL,',
      '  user_id INT         NULL    ',
      ');',
      '',
      'CREATE TABLE sales.users',
      '(',
      '  id   INT         NOT NULL AUTO_INCREMENT,',
      "  name VARCHAR(50) NOT NULL DEFAULT 'guest' COMMENT 'user name',",
      '  age  INT         NULL    ,',
      '  PRIMARY KEY (id)',
      ") COMMENT 'user table';",
      '',
      'ALTER TABLE sales.users',
      '  ADD CONSTRAINT UQ_users_name UNIQUE (name);',
      '',
      'ALTER TABLE sales.posts',
      '  ADD CONSTRAINT FK_users_TO_posts',
      '    FOREIGN KEY (user_id)',
      '    REFERENCES sales.users (id);',
      '',
      'CREATE INDEX IDX_posts',
      '  ON sales.posts (title ASC);',
      '',
    ]);
  });

  it('names keys after the table part of "sales"."users" without its quotes', () => {
    const { state, users } = createFixture();
    users.name = '"sales"."users"';

    const sql = createSchema(state);

    expect(sql).toContain('  ADD CONSTRAINT UQ_users_name UNIQUE (name);\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
  });

  it('numbers a foreign key and an index name that repeat an earlier one but for case', () => {
    const { state, users, posts } = createFixture();
    users.name = 'sales.users';
    posts.name = 'sales.posts';
    const { usersIndex, index } = addSecondUsers(state, 'hr.Users');
    state.doc.indexIds = [usersIndex.id, index.id];

    const sql = createSchema(state);

    expect(sql).toContain('  ADD CONSTRAINT FK_users_TO_posts\n');
    expect(sql).toContain('  ADD CONSTRAINT FK_Users_TO_posts1\n');
    expect(sql).toContain('CREATE INDEX IDX_users\n  ON sales.users');
    expect(sql).toContain('CREATE INDEX IDX_Users1\n  ON hr.Users');
  });

  it('keeps a quoted dotted name whole in every automatic name', () => {
    const { state, users, posts } = createFixture();
    users.name = 'sales.users';
    posts.name = 'sales.posts';
    state.settings.bracketType = BracketType.backtick;

    const sql = createSchema(state);

    expect(sql).toContain('  ADD CONSTRAINT `UQ_sales.users_name` UNIQUE');
    expect(sql).toContain('  ADD CONSTRAINT `FK_sales.users_TO_sales.posts`');
    expect(sql).toContain('CREATE INDEX `IDX_sales.posts`\n  ON `sales.posts`');
  });

  it('numbers a quoted name repeating an earlier one but for case too', () => {
    const { state } = createFixture();
    state.settings.bracketType = BracketType.backtick;
    const { usersIndex, index } = addSecondUsers(state, 'Users');
    state.doc.indexIds = [usersIndex.id, index.id];

    const sql = createSchema(state);

    expect(sql).toContain('  ADD CONSTRAINT `FK_users_TO_posts`\n');
    expect(sql).toContain('  ADD CONSTRAINT `FK_Users_TO_posts1`\n');
    expect(sql).toContain('CREATE INDEX `IDX_users`\n  ON `users`');
    expect(sql).toContain('CREATE INDEX `IDX_Users1`\n  ON `Users`');
  });
});

describe('schema-sql/MySQL ifNotExists', () => {
  const ifNotExists = { statements: 'ifNotExists' } as const;

  it('writes each table with its keys, indexes and foreign keys inside, the checks off around them', () => {
    const { state } = createFixture();

    expect(createSchema(state, undefined, ifNotExists)).toBe(
      [
        '',
        'SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;',
        '',
        'CREATE TABLE IF NOT EXISTS posts',
        '(',
        '  title   VARCHAR(20) NOT NULL,',
        '  user_id INT         NULL    ,',
        '  INDEX IDX_posts (title ASC),',
        '  CONSTRAINT FK_users_TO_posts',
        '    FOREIGN KEY (user_id)',
        '    REFERENCES users (id)',
        ');',
        '',
        'CREATE TABLE IF NOT EXISTS users',
        '(',
        '  id   INT         NOT NULL AUTO_INCREMENT,',
        "  name VARCHAR(50) NOT NULL DEFAULT 'guest' COMMENT 'user name',",
        '  age  INT         NULL    ,',
        '  PRIMARY KEY (id),',
        '  CONSTRAINT UQ_users_name UNIQUE (name)',
        ") COMMENT 'user table';",
        '',
        'SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;',
        '',
      ].join('\n')
    );
  });

  it('keeps a foreign key to its own table and a unique index inside it, quoted', () => {
    const { state, users, index } = createFixture();
    state.settings.bracketType = BracketType.backtick;
    state.collections.tableColumnEntities['col-parent'] = createColumn({
      id: 'col-parent',
      tableId: users.id,
      name: 'parent_id',
      dataType: 'INT',
    });
    users.columnIds.push('col-parent');
    state.collections.relationshipEntities['rel-self'] = createRelationship({
      id: 'rel-self',
      start: { tableId: users.id, columnIds: ['col-id'] },
      end: { tableId: users.id, columnIds: ['col-parent'] },
    });
    state.doc.relationshipIds.push('rel-self');
    index.unique = true;
    index.name = 'uq_title';

    const sql = createSchema(state, undefined, ifNotExists);

    expect(sql).toContain(
      [
        '  PRIMARY KEY (`id`),',
        '  CONSTRAINT `UQ_users_name` UNIQUE (`name`),',
        '  CONSTRAINT `FK_users_TO_users`',
        '    FOREIGN KEY (`parent_id`)',
        '    REFERENCES `users` (`id`)',
        ") COMMENT 'user table';",
      ].join('\n')
    );
    expect(sql).toContain('  UNIQUE INDEX `uq_title` (`title` ASC),\n');
  });

  it('names the foreign keys and indexes as the create batch does', () => {
    const { state } = createFixture();
    const { usersIndex, index } = addSecondUsers(state, 'Users');
    state.doc.indexIds = [usersIndex.id, index.id, 'idx-1'];

    const create = createSchema(state);
    const inline = createSchema(state, undefined, ifNotExists);

    ['FK_users_TO_posts', 'FK_Users_TO_posts1'].forEach(name => {
      expect(create).toContain(`  ADD CONSTRAINT ${name}\n`);
      expect(inline).toContain(`  CONSTRAINT ${name}\n`);
    });
    expect(create).toContain('CREATE INDEX IDX_Users1\n  ON Users');
    expect(inline).toContain('  INDEX IDX_Users1 (title ASC)\n');
    expect(inline).toContain('  INDEX IDX_posts (title ASC),\n');
  });

  it('leaves out what writes nothing, and writes nothing without tables', () => {
    const { state } = createFixture();
    state.collections.indexColumnEntities['idx-col-1'].columnId = 'gone';
    state.collections.relationshipEntities['rel-1'].start.tableId = 'gone';

    const sql = createSchema(state, undefined, ifNotExists);

    expect(sql).not.toContain('INDEX');
    expect(sql).not.toContain('FOREIGN KEY');
    expect(sql).toContain('  user_id INT         NULL    \n);');
    expect(createSchema(state, [], ifNotExists)).toBe('');
  });

  it('writes CREATE TABLE IF NOT EXISTS from formatTable alone', () => {
    const { state, posts } = createFixture();
    const buffer: string[] = [];

    formatTable(state, { buffer, table: posts, ...ifNotExists });

    expect(buffer[0]).toBe('CREATE TABLE IF NOT EXISTS posts');
    expect(buffer.at(-1)).toBe(');');
  });

  it('collects the tables it writes, as the create batch does', () => {
    const { state, users, posts } = createFixture();
    const inline = createWrittenObjects();
    const create = createWrittenObjects();

    createSchema(state, undefined, { ...ifNotExists, written: inline });
    createSchema(state, undefined, { statements: 'create', written: create });

    expect(inline.tables).toEqual([posts, users]);
    expect(create.tables).toEqual([posts, users]);
  });
});

describe('schema-sql/MySQL header and drop block', () => {
  it('writes USE, after CREATE DATABASE for createAndUse, quoted as the tables are', () => {
    const { state } = createFixture();

    expect(formatHeader(state, 'use', 'shop')).toBe('USE shop;');
    state.settings.bracketType = BracketType.backtick;
    expect(formatHeader(state, 'createAndUse', 'shop')).toBe(
      'CREATE DATABASE IF NOT EXISTS `shop`;\nUSE `shop`;'
    );
  });

  it('drops every table written while the checks are off', () => {
    const { state, users, posts } = createFixture();
    state.settings.bracketType = BracketType.backtick;
    const written = createWrittenObjects();

    expect(formatDropBlock(state, written)).toBe('');
    written.tables.push(posts, users);
    expect(formatDropBlock(state, written)).toBe(
      [
        'SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;',
        '',
        'DROP TABLE IF EXISTS `posts`;',
        'DROP TABLE IF EXISTS `users`;',
        '',
        'SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;',
      ].join('\n')
    );
  });
});
