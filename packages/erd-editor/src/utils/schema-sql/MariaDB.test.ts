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
  formatIndex,
  formatTable,
} from '@/utils/schema-sql/MariaDB';
import { createSchema as createSchemaMySQL } from '@/utils/schema-sql/MySQL';
import { Name } from '@/utils/schema-sql/utils';

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

describe('schema-sql/MariaDB', () => {
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
        '  ADD CONSTRAINT UQ_name UNIQUE (name);',
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

    it('emits empty key lists when the relationship columns cannot be resolved', () => {
      const { state } = createFixture();
      const relationship = state.collections.relationshipEntities['rel-1'];
      relationship.start.columnIds = ['ghost-start'];
      relationship.end.columnIds = ['ghost-end'];

      const sql = createSchema(state);

      expect(sql).toContain('    FOREIGN KEY ()\n');
      expect(sql).toContain('    REFERENCES users ();\n');
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
      expect(sql).toContain('  ADD CONSTRAINT `UQ_name` UNIQUE (`name`);\n');
      expect(sql).toContain('    REFERENCES `users` (`id`);\n');
    });

    it('produces byte-identical output to the MySQL generator', () => {
      const mariadb = createSchema(createFixture().state);
      const mysql = createSchemaMySQL(createFixture().state);

      expect(mariadb).toBe(mysql);
    });
  });
});
