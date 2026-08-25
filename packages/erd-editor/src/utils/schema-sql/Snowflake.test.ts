import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  ColumnOption,
  Database,
  OrderType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Relationship } from '@/internal-types';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createSchemaSQLTable } from '@/utils/schema-sql/index';
import {
  createSchema,
  formatIndex,
  formatTable,
} from '@/utils/schema-sql/Snowflake';
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

describe('schema-sql/Snowflake', () => {
  describe('formatTable', () => {
    it('emits an AUTOINCREMENT column, an inline UNIQUE and a primary key constraint', () => {
      const { state, users } = createFixture();
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer).toEqual([
        'CREATE TABLE users',
        '(',
        '  id   INT         NOT NULL AUTOINCREMENT,',
        "  name VARCHAR(50) UNIQUE NOT NULL DEFAULT 'guest' COMMENT 'user name',",
        '  age  INT,',
        '  CONSTRAINT PK_users PRIMARY KEY (id)',
        ')',
        "COMMENT = 'user table';",
      ]);
    });

    it('closes on the column list when the table has no comment', () => {
      const { state, posts } = createFixture();
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer).toEqual([
        'CREATE TABLE posts',
        '(',
        '  title   VARCHAR(20) NOT NULL,',
        '  user_id INT',
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

    // A quoted Snowflake identifier is case sensitive where a bare one folds to
    // upper case, so the bracket setting decides whether to quote at all.
    it('leaves identifiers bare under the default bracket type', () => {
      const { state, users } = createFixture();

      expect(state.settings.bracketType).toBe(BracketType.none);

      const buffer: string[] = [];
      formatTable(state, { buffer, table: users });

      expect(buffer.join('\n')).not.toContain('"');
      expect(buffer[0]).toBe('CREATE TABLE users');
    });

    it.each([
      BracketType.doubleQuote,
      BracketType.singleQuote,
      BracketType.backtick,
    ])('quotes with double quotes for bracket type %s', bracketType => {
      const { state, users } = createFixture();
      state.settings.bracketType = bracketType;
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer.join('\n')).not.toContain('`');
      expect(buffer[0]).toBe('CREATE TABLE "users"');
      expect(buffer[5]).toBe('  CONSTRAINT "PK_users" PRIMARY KEY ("id")');
    });

    it('declares the keys without NOT ENFORCED, which Snowflake never requires', () => {
      const { state, users } = createFixture();
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer.join('\n')).not.toContain('NOT ENFORCED');
      expect(buffer.join('\n')).not.toContain('RELY');
    });

    it('emits no NULL token and no trailing space for a nullable column', () => {
      const { state, posts } = createFixture();
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer[3]).toBe('  user_id INT');
      expect(buffer[3]).not.toContain('NULL');
      expect(buffer[3]).toBe(buffer[3].trimEnd());
    });

    it('ignores a whitespace-only default and comment', () => {
      const { state, posts } = createFixture();
      const column = state.collections.tableColumnEntities['col-user-id'];
      column.default = '  ';
      column.comment = '  ';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer[3]).toBe('  user_id INT');
    });

    it('marks a primary key column NOT NULL even without the not null option', () => {
      const { state, users } = createFixture();
      const column = state.collections.tableColumnEntities['col-id'];
      column.options = ColumnOption.primaryKey;
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer[2]).toBe('  id   INT         NOT NULL,');
    });

    it('prefers AUTOINCREMENT over a DEFAULT value on the same column', () => {
      const { state, users } = createFixture();
      state.collections.tableColumnEntities['col-id'].default = '1';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer[2]).toBe('  id   INT         NOT NULL AUTOINCREMENT,');
      expect(buffer[2]).not.toContain('DEFAULT');
      expect(buffer[2]).not.toContain('IDENTITY');
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
    it('comments out an auto named index instead of emitting CREATE INDEX', () => {
      const { state, index } = createFixture();
      const buffer: string[] = [];
      const indexNames: Name[] = [];

      formatIndex(state, { buffer, index, indexNames });

      expect(buffer).toEqual([
        '-- Snowflake has no secondary indexes. IDX_posts on posts (title ASC)',
        '-- ALTER TABLE posts CLUSTER BY (title);',
      ]);
      expect(buffer.join('\n')).not.toContain('CREATE INDEX');
      expect(indexNames.map(v => v.name)).toEqual(['IDX_posts']);
    });

    it('deduplicates generated index names across calls', () => {
      const { state, index } = createFixture();
      const buffer: string[] = [];
      const indexNames: Name[] = [];

      formatIndex(state, { buffer, index, indexNames });
      formatIndex(state, { buffer, index, indexNames });

      expect(buffer[0]).toContain('IDX_posts on posts');
      expect(buffer[2]).toContain('IDX_posts1 on posts');
    });

    it('turns a unique index into the constraint Snowflake accepts', () => {
      const { state, index } = createFixture();
      index.name = 'UX_posts_title';
      index.unique = true;
      state.collections.indexColumnEntities['idx-col-1'].orderType =
        OrderType.DESC;
      const buffer: string[] = [];
      const indexNames: Name[] = [];

      formatIndex(state, { buffer, index, indexNames });

      expect(buffer).toEqual([
        'ALTER TABLE posts',
        '  ADD CONSTRAINT UX_posts_title UNIQUE (title);',
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
        }),
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
  });

  describe('createSchema', () => {
    it('emits tables sorted by name, foreign keys and index comments', () => {
      const { state } = createFixture();

      expect(createSchema(state).split('\n')).toEqual([
        '',
        'CREATE TABLE posts',
        '(',
        '  title   VARCHAR(20) NOT NULL,',
        '  user_id INT',
        ');',
        '',
        'CREATE TABLE users',
        '(',
        '  id   INT         NOT NULL AUTOINCREMENT,',
        "  name VARCHAR(50) UNIQUE NOT NULL DEFAULT 'guest' COMMENT 'user name',",
        '  age  INT,',
        '  CONSTRAINT PK_users PRIMARY KEY (id)',
        ')',
        "COMMENT = 'user table';",
        '',
        'ALTER TABLE posts',
        '  ADD CONSTRAINT FK_users_TO_posts',
        '    FOREIGN KEY (user_id)',
        '    REFERENCES users (id);',
        '',
        '-- Snowflake has no secondary indexes. IDX_posts on posts (title ASC)',
        '-- ALTER TABLE posts CLUSTER BY (title);',
        '',
      ]);
    });

    it('carries a unique column inline rather than reporting it', () => {
      const { state } = createFixture();

      const sql = createSchema(state);

      expect(sql).toContain('UNIQUE');
      expect(sql).not.toContain('does not support UNIQUE');
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

    it('skips a relationship whose tables cannot be resolved', () => {
      const { state } = createFixture();
      state.collections.relationshipEntities['rel-1'].end.tableId = 'ghost';

      expect(createSchema(state)).not.toContain('ADD CONSTRAINT FK_');
    });
  });

  describe('createSchemaSQLTable', () => {
    it('dispatches a single table and its indexes to the Snowflake generator', () => {
      const { state, posts } = createFixture();
      state.settings.database = Database.Snowflake;

      expect(createSchemaSQLTable(state, posts).split('\n')).toEqual([
        '',
        'CREATE TABLE posts',
        '(',
        '  title   VARCHAR(20) NOT NULL,',
        '  user_id INT',
        ');',
        '',
        '-- Snowflake has no secondary indexes. IDX_posts on posts (title ASC)',
        '-- ALTER TABLE posts CLUSTER BY (title);',
        '',
      ]);
    });
  });
});
