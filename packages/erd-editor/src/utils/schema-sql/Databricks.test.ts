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
import { Relationship } from '@/internal-types';
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
} from '@/utils/schema-sql/Databricks';
import {
  createSchemaSQL,
  createSchemaSQLTable,
} from '@/utils/schema-sql/index';
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

describe('schema-sql/Databricks', () => {
  describe('formatTable', () => {
    it('emits an identity column, a RELY primary key constraint and the DELTA tail', () => {
      const { state, users } = createFixture();
      state.collections.tableColumnEntities['col-id'].dataType = 'BIGINT';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer).toEqual([
        'CREATE TABLE `users`',
        '(',
        '  `id`   BIGINT      NOT NULL GENERATED ALWAYS AS IDENTITY,',
        "  `name` VARCHAR(50) NOT NULL DEFAULT 'guest' COMMENT 'user name',",
        '  `age`  INT,',
        '  CONSTRAINT `PK_users` PRIMARY KEY (`id`) NOT ENFORCED RELY',
        ')',
        'USING DELTA',
        "COMMENT 'user table';",
      ]);
    });

    it('closes with a bare USING DELTA when the table has no comment', () => {
      const { state, posts } = createFixture();
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer).toEqual([
        'CREATE TABLE `posts`',
        '(',
        '  `title`   VARCHAR(20) NOT NULL,',
        '  `user_id` INT',
        ')',
        'USING DELTA;',
      ]);
    });

    it('treats a whitespace-only table comment as no comment', () => {
      const { state, posts } = createFixture();
      posts.comment = '   ';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer.at(-1)).toBe('USING DELTA;');
    });

    it('quotes identifiers with backticks whatever the bracket type says', () => {
      const { state, users } = createFixture();
      state.settings.bracketType = BracketType.doubleQuote;
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer.join('\n')).not.toContain('"');
      expect(buffer[0]).toBe('CREATE TABLE `users`');
      expect(buffer[5]).toBe(
        '  CONSTRAINT `PK_users` PRIMARY KEY (`id`) NOT ENFORCED RELY'
      );
    });

    it('emits no NULL token and no trailing space for a nullable column', () => {
      const { state, posts } = createFixture();
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer[3]).toBe('  `user_id` INT');
      expect(buffer[3]).not.toContain('NULL');
      expect(buffer[3]).toBe(buffer[3].trimEnd());
    });

    it('keeps a nullable column trimmed right after its default and comment', () => {
      const { state, posts } = createFixture();
      const column = state.collections.tableColumnEntities['col-user-id'];
      column.default = '0';
      column.comment = 'author';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer[3]).toBe(
        "  `user_id` INT                  DEFAULT 0 COMMENT 'author'"
      );
      expect(buffer[3]).not.toContain('NULL');
      expect(buffer[3]).toBe(buffer[3].trimEnd());
    });

    it('escapes a quote and a backslash of a comment with a backslash', () => {
      const { state, posts } = createFixture();
      const column = state.collections.tableColumnEntities['col-user-id'];
      column.comment = "it's C:\\x";
      posts.comment = "o'k";
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer[3]).toBe(
        "  `user_id` INT                  COMMENT 'it\\'s C:\\\\x'"
      );
      expect(buffer.at(-1)).toBe("COMMENT 'o\\'k';");
    });

    it('ignores a whitespace-only default and comment', () => {
      const { state, posts } = createFixture();
      const column = state.collections.tableColumnEntities['col-user-id'];
      column.default = '  ';
      column.comment = '  ';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: posts });

      expect(buffer[3]).toBe('  `user_id` INT');
    });

    it('marks a primary key column NOT NULL even without the not null option', () => {
      const { state, users } = createFixture();
      const column = state.collections.tableColumnEntities['col-id'];
      column.options = ColumnOption.primaryKey;
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer[2]).toBe('  `id`   INT         NOT NULL,');
    });

    it('prefers GENERATED ALWAYS AS IDENTITY over a DEFAULT value on the same column', () => {
      const { state, users } = createFixture();
      state.collections.tableColumnEntities['col-id'].dataType = 'BIGINT';
      state.collections.tableColumnEntities['col-id'].default = '1';
      const buffer: string[] = [];

      formatTable(state, { buffer, table: users });

      expect(buffer[2]).toBe(
        '  `id`   BIGINT      NOT NULL GENERATED ALWAYS AS IDENTITY,'
      );
      expect(buffer[2]).not.toContain('DEFAULT');
      expect(buffer[2]).not.toContain('AUTO_INCREMENT');
    });

    it('renders an empty table body when it has no columns', () => {
      const { state } = createFixture();
      const empty = createTable({ id: 'tbl-empty', name: 'empty' });
      const buffer: string[] = [];

      formatTable(state, { buffer, table: empty });

      expect(buffer).toEqual([
        'CREATE TABLE `empty`',
        '(',
        ')',
        'USING DELTA;',
      ]);
    });
  });

  describe('formatIndex', () => {
    it('comments out an auto named index instead of emitting CREATE INDEX', () => {
      const { state, index } = createFixture();
      const buffer: string[] = [];
      const indexNames: Name[] = [];

      formatIndex(state, { buffer, index, indexNames });

      expect(buffer).toEqual([
        '-- Databricks has no secondary indexes. `IDX_posts` on `posts` (`title` ASC)',
        '-- ALTER TABLE `posts` CLUSTER BY (`title`);',
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

      expect(buffer[0]).toContain('`IDX_posts` on `posts`');
      expect(buffer[2]).toContain('`IDX_posts1` on `posts`');
    });

    it('keeps an explicit index name and drops UNIQUE from the comment', () => {
      const { state, index } = createFixture();
      index.name = 'UX_posts_title';
      index.unique = true;
      state.collections.indexColumnEntities['idx-col-1'].orderType =
        OrderType.DESC;
      const buffer: string[] = [];
      const indexNames: Name[] = [];

      formatIndex(state, { buffer, index, indexNames });

      expect(buffer).toEqual([
        '-- Databricks has no secondary indexes. `UX_posts_title` on `posts` (`title` DESC)',
        '-- ALTER TABLE `posts` CLUSTER BY (`title`);',
      ]);
      expect(buffer.join('\n')).not.toContain('UNIQUE');
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

    it('renders an unknown order type as an empty suffix', () => {
      const { state, index } = createFixture();
      state.collections.indexColumnEntities['idx-col-1'].orderType = 0;
      const buffer: string[] = [];

      formatIndex(state, { buffer, index, indexNames: [] });

      expect(buffer[0]).toBe(
        '-- Databricks has no secondary indexes. `IDX_posts` on `posts` (`title` )'
      );
    });
  });

  describe('createSchema', () => {
    it('emits tables sorted by name, unique warnings, RELY foreign keys and index comments', () => {
      const { state } = createFixture();

      expect(createSchema(state).split('\n')).toEqual([
        '',
        'CREATE TABLE `posts`',
        '(',
        '  `title`   VARCHAR(20) NOT NULL,',
        '  `user_id` INT',
        ')',
        'USING DELTA;',
        '',
        'CREATE TABLE `users`',
        '(',
        '  `id`   INT         NOT NULL,',
        "  `name` VARCHAR(50) NOT NULL DEFAULT 'guest' COMMENT 'user name',",
        '  `age`  INT,',
        '  CONSTRAINT `PK_users` PRIMARY KEY (`id`) NOT ENFORCED RELY',
        ')',
        'USING DELTA',
        "COMMENT 'user table';",
        '',
        '-- Databricks takes IDENTITY only on BIGINT, so `users`.`id` is written without it.',
        '',
        '-- Databricks does not support UNIQUE constraints: `users`.`name`',
        '',
        'ALTER TABLE `posts`',
        '  ADD CONSTRAINT `FK_users_TO_posts`',
        '    FOREIGN KEY (`user_id`)',
        '    REFERENCES `users` (`id`) NOT ENFORCED RELY;',
        '',
        '-- Databricks has no secondary indexes. `IDX_posts` on `posts` (`title` ASC)',
        '-- ALTER TABLE `posts` CLUSTER BY (`title`);',
        '',
      ]);
    });

    it('reports a unique column as a comment instead of an ALTER TABLE constraint', () => {
      const { state } = createFixture();

      const sql = createSchema(state);

      expect(sql).toContain(
        '-- Databricks does not support UNIQUE constraints: `users`.`name`\n'
      );
      expect(sql).not.toContain('UNIQUE (');
      expect(sql).not.toContain('ADD CONSTRAINT `UQ_');
    });

    it('reports every unique column of a table on its own line', () => {
      const { state, users } = createFixture();
      state.collections.tableColumnEntities['col-email'] = createColumn({
        id: 'col-email',
        tableId: 'tbl-users',
        name: 'email',
        dataType: 'VARCHAR(255)',
        options: ColumnOption.unique,
      });
      users.columnIds.push('col-email');

      const sql = createSchema(state);

      expect(sql).toContain(
        '-- Databricks does not support UNIQUE constraints: `users`.`name`\n'
      );
      expect(sql).toContain(
        '-- Databricks does not support UNIQUE constraints: `users`.`email`\n'
      );
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

      expect(sql).toContain('  ADD CONSTRAINT `FK_users_TO_posts`\n');
      expect(sql).toContain('  ADD CONSTRAINT `FK_users_TO_posts1`\n');
    });

    it('skips a relationship none of whose columns resolve, blank line and all', () => {
      const { state } = createFixture();
      const relationship = state.collections.relationshipEntities['rel-1'];
      relationship.start.columnIds = ['ghost-start'];
      relationship.end.columnIds = ['ghost-end'];

      const sql = createSchema(state);

      expect(sql).not.toContain('FOREIGN KEY');
      expect(sql).toContain(
        '-- Databricks does not support UNIQUE constraints: `users`.`name`\n\n' +
          '-- Databricks has no secondary indexes.'
      );
    });

    it('skips a relationship whose tables cannot be resolved', () => {
      const { state } = createFixture();
      state.collections.relationshipEntities['rel-1'].end.tableId = 'ghost';

      expect(createSchema(state)).not.toContain('ADD CONSTRAINT `FK_');
    });

    it('keeps backticks when the bracket type asks for double quotes', () => {
      const { state } = createFixture();
      state.settings.bracketType = BracketType.doubleQuote;

      const sql = createSchema(state);

      expect(sql).not.toContain('"');
      expect(sql).toContain('ALTER TABLE `posts`\n');
      expect(sql).toContain(
        '    REFERENCES `users` (`id`) NOT ENFORCED RELY;\n'
      );
    });
  });

  describe('createSchemaSQLTable', () => {
    it('dispatches a single table and its indexes to the Databricks generator', () => {
      const { state, posts } = createFixture();
      state.settings.database = Database.Databricks;

      expect(createSchemaSQLTable(state, posts).split('\n')).toEqual([
        '',
        'CREATE TABLE `posts`',
        '(',
        '  `title`   VARCHAR(20) NOT NULL,',
        '  `user_id` INT',
        ')',
        'USING DELTA;',
        '',
        '-- Databricks has no secondary indexes. `IDX_posts` on `posts` (`title` ASC)',
        '-- ALTER TABLE `posts` CLUSTER BY (`title`);',
        '',
      ]);
    });
  });
});

describe('Databricks identity types', () => {
  it.each(['BIGINT', 'bigint', ' BigInt ', 'LONG', ' long '])(
    'makes an AUTOINCREMENT %j column an identity',
    dataType => {
      const sql = createSchemaSQL(
        createSampleState({ memberIdType: dataType, postIdType: dataType }),
        Database.Databricks
      );

      expect(sql.split('GENERATED ALWAYS AS IDENTITY')).toHaveLength(3);
      expect(sql).not.toContain('-- Databricks takes IDENTITY');
    }
  );

  it('writes a LONG key, the BIGINT of another name, with IDENTITY', () => {
    const sql = createSchemaSQL(
      createSampleState({ memberIdType: 'LONG', postIdType: 'LONG' }),
      Database.Databricks
    );

    expect(sql).toContain(
      '\n  `id`    LONG         NOT NULL GENERATED ALWAYS AS IDENTITY,\n'
    );
    expect(sql).toContain(
      '\n  `id`        LONG         NOT NULL GENERATED ALWAYS AS IDENTITY,\n'
    );
  });

  it.each(['INT', 'DECIMAL(20)'])(
    'writes an AUTOINCREMENT %j column without IDENTITY or a DEFAULT and says why',
    dataType => {
      const state = createSampleState({ memberIdType: dataType });
      state.collections.tableColumnEntities.m1.default = '1';

      const sql = createSchemaSQL(state, Database.Databricks);

      expect(sql).not.toContain('GENERATED ALWAYS AS IDENTITY');
      expect(sql).not.toContain('DEFAULT');
      expect(sql).toContain(
        "COMMENT 'Members';\n\n-- Databricks takes IDENTITY only on BIGINT, so `member`.`id` is written without it.\n\n"
      );
    }
  );

  it('matches the INT key fixture, which is the sample as it stands', () => {
    expect(createSchemaSQL(createSampleState(), Database.Databricks)).toBe(
      readFixture('Databricks/non-bigint-identity-create-none.sql')
    );
  });

  it('matches the BIGINT key fixture', () => {
    expect(
      createSchemaSQL(
        createSampleState({
          memberIdType: 'BIGINT',
          postIdType: 'BIGINT',
          postMemberIdType: 'BIGINT',
        }),
        Database.Databricks
      )
    ).toBe(readFixture('Databricks/bigint-identity-create-none.sql'));
  });

  it('names every column of a table that goes without IDENTITY', () => {
    const state = createSampleState();
    state.collections.tableColumnEntities.m2.options |=
      ColumnOption.autoIncrement;

    expect(createSchemaSQL(state, Database.Databricks)).toContain(
      [
        "COMMENT 'Members';",
        '',
        '-- Databricks takes IDENTITY only on BIGINT, so `member`.`id` is written without it.',
        '-- Databricks takes IDENTITY only on BIGINT, so `member`.`email` is written without it.',
        '',
      ].join('\n')
    );
  });
});

describe('Databricks options', () => {
  it('drops each foreign key right above adding it back under ifNotExists', () => {
    const sql = createSchemaSQL(
      createSampleState(),
      Database.Databricks,
      undefined,
      {
        statements: 'ifNotExists',
      }
    );

    expect(sql).toContain('\nCREATE TABLE IF NOT EXISTS `member`\n');
    expect(sql).toContain(
      [
        '',
        'ALTER TABLE `post` DROP CONSTRAINT IF EXISTS `FK_member_TO_post`;',
        'ALTER TABLE `post`',
        '  ADD CONSTRAINT `FK_member_TO_post`',
      ].join('\n')
    );
  });

  it('drops each table written', () => {
    const state = createSampleState();
    const written = createWrittenObjects();

    expect(formatDropBlock(state, written)).toBe('');
    createSchema(state, undefined, { statements: 'recreate', written });
    expect(formatDropBlock(state, written)).toBe(
      'DROP TABLE IF EXISTS `member`;\nDROP TABLE IF EXISTS `post`;'
    );
  });

  it('writes the header in backticks whatever the bracket type', () => {
    const state = createSampleState();
    state.settings.bracketType = BracketType.doubleQuote;

    expect(formatHeader(state, 'use', 'shop')).toBe('USE SCHEMA `shop`;');
    expect(formatHeader(state, 'createAndUse', 'shop')).toBe(
      'CREATE SCHEMA IF NOT EXISTS `shop`;\nUSE SCHEMA `shop`;'
    );
  });
});
