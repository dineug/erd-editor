import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, OrderType } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createSchemaSQL,
  createSchemaSQLTable,
} from '@/utils/schema-sql/index';

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
    columnIds: ['col-id'],
  });
  const posts = createTable({
    id: 'tbl-posts',
    name: 'posts',
    columnIds: ['col-title', 'col-user-id'],
  });

  state.collections.tableEntities = {
    'tbl-users': users,
    'tbl-posts': posts,
  };
  state.collections.tableColumnEntities = {
    'col-id': idColumn,
    'col-title': titleColumn,
    'col-user-id': userIdColumn,
  };
  state.collections.indexEntities = {
    'idx-1': createIndex({
      id: 'idx-1',
      tableId: 'tbl-posts',
      indexColumnIds: ['idx-col-1'],
    }),
  };
  state.collections.indexColumnEntities = {
    'idx-col-1': createIndexColumn({
      id: 'idx-col-1',
      indexId: 'idx-1',
      columnId: 'col-title',
      orderType: OrderType.ASC,
    }),
  };

  state.doc.tableIds = ['tbl-users', 'tbl-posts'];
  state.doc.indexIds = ['idx-1'];

  return { state, users, posts };
}

describe('schema-sql/index', () => {
  describe('createSchemaSQL', () => {
    it('defaults to settings.database when no override is given', () => {
      const { state } = createFixture();

      expect(state.settings.database).toBe(Database.MySQL);
      expect(createSchemaSQL(state)).toContain('AUTO_INCREMENT');
    });

    it('follows settings.database when it is changed', () => {
      const { state } = createFixture();
      state.settings.database = Database.PostgreSQL;

      expect(createSchemaSQL(state)).toContain('GENERATED ALWAYS AS IDENTITY');
    });

    it('generates MariaDB output identical to MySQL output but under ifNotExists', () => {
      const { state } = createFixture();

      (['create', 'recreate'] as const).forEach(statements => {
        expect(
          createSchemaSQL(state, Database.MariaDB, undefined, { statements })
        ).toBe(
          createSchemaSQL(state, Database.MySQL, undefined, { statements })
        );
      });
      expect(
        createSchemaSQL(state, Database.MariaDB, undefined, {
          statements: 'ifNotExists',
        })
      ).not.toBe(
        createSchemaSQL(state, Database.MySQL, undefined, {
          statements: 'ifNotExists',
        })
      );
    });

    it('generates MSSQL output', () => {
      const { state } = createFixture();
      const sql = createSchemaSQL(state, Database.MSSQL);

      expect(sql).toContain('IDENTITY(1,1)');
      expect(sql).toContain('CONSTRAINT PK_users PRIMARY KEY (id)');
    });

    it('generates Oracle output', () => {
      const { state } = createFixture();
      const sql = createSchemaSQL(state, Database.Oracle);

      expect(sql).toContain('CREATE SEQUENCE SEQ_users');
      expect(sql).toContain('CREATE OR REPLACE TRIGGER SEQ_TRG_users');
    });

    it('generates PostgreSQL output', () => {
      const { state } = createFixture();
      const sql = createSchemaSQL(state, Database.PostgreSQL);

      expect(sql).toContain('GENERATED ALWAYS AS IDENTITY');
      expect(sql).toContain("COMMENT ON TABLE users IS 'user table';");
    });

    it('generates SQLite output', () => {
      const { state } = createFixture();
      const sql = createSchemaSQL(state, Database.SQLite);

      expect(sql).toContain('AUTOINCREMENT');
      expect(sql).not.toContain('AUTO_INCREMENT');
    });

    it('returns an empty string for an unsupported database', () => {
      const { state } = createFixture();

      expect(createSchemaSQL(state, 256)).toBe('');
    });

    it('falls back to settings.database when the override is 0', () => {
      const { state } = createFixture();
      state.settings.database = Database.SQLite;

      expect(createSchemaSQL(state, 0)).toContain('AUTOINCREMENT');
    });

    it.each([
      ['MySQL', Database.MySQL],
      ['MariaDB', Database.MariaDB],
      ['PostgreSQL', Database.PostgreSQL],
      ['MSSQL', Database.MSSQL],
      ['Oracle', Database.Oracle],
      ['Snowflake', Database.Snowflake],
      ['Databricks', Database.Databricks],
      ['SQLite', Database.SQLite],
    ])(
      'writes only the tables named and their indexes in %s',
      (_, database) => {
        const { state } = createFixture();

        const users = createSchemaSQL(state, database, ['tbl-users']);
        const posts = createSchemaSQL(state, database, ['tbl-posts']);

        expect(users).toMatch(/CREATE TABLE \W?users/);
        expect(users).not.toMatch(/CREATE TABLE \W?posts/);
        expect(users).not.toContain('IDX_posts');
        expect(posts).not.toMatch(/CREATE TABLE \W?users/);
        expect(posts).toContain('IDX_posts');
      }
    );

    /**
     * The fixture with what a session keeps after removals: a posts column
     * taken out of its table that the posts index still names, and a table
     * taken out of the document with an index the document still lists.
     */
    function withRemovals(name: string) {
      const fixture = createFixture();
      const { collections, doc } = fixture.state;
      collections.tableColumnEntities['col-gone'] = createColumn({
        id: 'col-gone',
        tableId: 'tbl-posts',
        name: 'gone_column',
        dataType: 'INT',
      });
      collections.indexColumnEntities['idx-col-gone'] = createIndexColumn({
        id: 'idx-col-gone',
        indexId: 'idx-1',
        columnId: 'col-gone',
      });
      collections.indexEntities['idx-1'].indexColumnIds.push('idx-col-gone');
      collections.tableEntities['tbl-removed'] = createTable({
        id: 'tbl-removed',
        name: 'removed_table',
        columnIds: ['col-gone'],
      });
      collections.indexEntities['idx-removed'] = createIndex({
        id: 'idx-removed',
        name,
        tableId: 'tbl-removed',
        indexColumnIds: ['idx-col-gone'],
      });
      doc.indexIds.push('idx-removed');
      return fixture;
    }

    it.each([
      ['MySQL', Database.MySQL],
      ['MariaDB', Database.MariaDB],
      ['PostgreSQL', Database.PostgreSQL],
      ['MSSQL', Database.MSSQL],
      ['Oracle', Database.Oracle],
      ['Snowflake', Database.Snowflake],
      ['Databricks', Database.Databricks],
      ['SQLite', Database.SQLite],
    ])(
      'writes in %s the indexes a saved file keeps: no removed column, no index of a removed table',
      (_, database) => {
        const { state } = withRemovals('IDX_removed');
        const sql = createSchemaSQL(state, database);

        expect(sql).toBe(createSchemaSQL(createFixture().state, database));
        expect(sql).toContain('IDX_posts');
        expect(sql).not.toContain('gone_column');
        expect(sql).not.toContain('removed_table');
        expect(sql).not.toContain('IDX_removed');
      }
    );

    it.each([
      ['MySQL', Database.MySQL],
      ['MariaDB', Database.MariaDB],
      ['PostgreSQL', Database.PostgreSQL],
      ['MSSQL', Database.MSSQL],
      ['Oracle', Database.Oracle],
      ['Snowflake', Database.Snowflake],
      ['Databricks', Database.Databricks],
      ['SQLite', Database.SQLite],
    ])(
      'writes in %s no index whose every column its table took out',
      (_, database) => {
        const { state } = withRemovals('IDX_removed');
        const { collections, doc } = state;
        collections.indexEntities['idx-only-gone'] = createIndex({
          id: 'idx-only-gone',
          name: 'IDX_only_gone',
          tableId: 'tbl-posts',
          indexColumnIds: ['idx-col-gone'],
        });
        doc.indexIds.push('idx-only-gone');

        const sql = createSchemaSQL(state, database);

        expect(sql).toContain('IDX_posts');
        expect(sql).not.toContain('IDX_only_gone');
        expect(sql).not.toContain('gone_column');
      }
    );

    it('returns an empty string when settings.database is unsupported', () => {
      const { state } = createFixture();
      state.settings.database = 0;

      expect(createSchemaSQL(state)).toBe('');
    });
  });

  describe('createSchemaSQLTable', () => {
    it('emits the table plus only the indexes that belong to it', () => {
      const { state, posts } = createFixture();

      expect(createSchemaSQLTable(state, posts).split('\n')).toEqual([
        '',
        'CREATE TABLE posts',
        '(',
        '  title   VARCHAR(20) NOT NULL,',
        '  user_id INT         NULL    ',
        ');',
        '',
        'CREATE INDEX IDX_posts',
        '  ON posts (title ASC);',
        '',
      ]);
    });

    it('emits no index block for a table without indexes', () => {
      const { state, users } = createFixture();

      expect(createSchemaSQLTable(state, users).split('\n')).toEqual([
        '',
        'CREATE TABLE users',
        '(',
        '  id INT NOT NULL AUTO_INCREMENT,',
        '  PRIMARY KEY (id)',
        ") COMMENT 'user table';",
        '',
      ]);
    });

    it('uses the MariaDB generator when configured', () => {
      const { state, posts } = createFixture();
      state.settings.database = Database.MariaDB;

      expect(createSchemaSQLTable(state, posts)).toBe(
        createSchemaSQLTable(
          {
            ...state,
            settings: { ...state.settings, database: Database.MySQL },
          },
          posts
        )
      );
    });

    it('uses the MSSQL generator when configured', () => {
      const { state, users, posts } = createFixture();
      state.settings.database = Database.MSSQL;

      expect(createSchemaSQLTable(state, users)).toContain('IDENTITY(1,1)');
      expect(createSchemaSQLTable(state, posts)).toContain(
        'CREATE INDEX IDX_posts'
      );
    });

    it('uses the Oracle generator when configured', () => {
      const { state, posts } = createFixture();
      state.settings.database = Database.Oracle;
      const sql = createSchemaSQLTable(state, posts);

      expect(sql).toContain('CREATE TABLE posts');
      expect(sql).toContain('CREATE INDEX IDX_posts');
    });

    it('uses the PostgreSQL generator when configured', () => {
      const { state, users, posts } = createFixture();
      state.settings.database = Database.PostgreSQL;

      expect(createSchemaSQLTable(state, users)).toContain(
        'GENERATED ALWAYS AS IDENTITY'
      );
      expect(createSchemaSQLTable(state, posts)).toContain(
        'CREATE INDEX IDX_posts'
      );
    });

    it('uses the SQLite generator when configured', () => {
      const { state, users, posts } = createFixture();
      state.settings.database = Database.SQLite;
      const sql = createSchemaSQLTable(state, users);

      expect(sql).toContain('AUTOINCREMENT');
      expect(sql).not.toContain('AUTO_INCREMENT');
      expect(createSchemaSQLTable(state, posts)).toContain(
        'CREATE INDEX IDX_posts'
      );
    });

    it('writes the constraint of a unique column after the table', () => {
      const { state, posts } = createFixture();
      state.collections.tableColumnEntities['col-title'].options |=
        ColumnOption.unique;

      expect(createSchemaSQLTable(state, posts).split('\n')).toEqual([
        '',
        'CREATE TABLE posts',
        '(',
        '  title   VARCHAR(20) NOT NULL,',
        '  user_id INT         NULL    ',
        ');',
        '',
        'ALTER TABLE posts',
        '  ADD CONSTRAINT UQ_posts_title UNIQUE (title);',
        '',
        'CREATE INDEX IDX_posts',
        '  ON posts (title ASC);',
        '',
      ]);
    });

    it.each([
      Database.MySQL,
      Database.MariaDB,
      Database.MSSQL,
      Database.Oracle,
      Database.Databricks,
      Database.PostgreSQL,
      Database.SQLite,
      Database.Snowflake,
    ])(
      'carries the uniqueness the whole %s export writes for the table',
      database => {
        const { state, posts } = createFixture();
        state.collections.tableColumnEntities['col-title'].options |=
          ColumnOption.unique;
        state.settings.database = database;
        // The lines that declare title unique, whether a statement of their
        // own, a comment or an inline UNIQUE on the column.
        const uniqueLines = (sql: string) => {
          const lines = sql.split('\n');
          return lines
            .map((line, index) =>
              /UQ_posts_title|UNIQUE constraints|^ {2}title .*UNIQUE/.test(line)
                ? [lines[index - 1], line]
                : null
            )
            .filter(pair => pair !== null);
        };
        const table = uniqueLines(createSchemaSQLTable(state, posts));

        expect(table).toHaveLength(1);
        expect(table).toEqual(uniqueLines(createSchemaSQL(state, database)));
      }
    );

    it('returns only the leading empty buffer entry for an unsupported database', () => {
      const { state, posts } = createFixture();
      state.settings.database = 0;

      expect(createSchemaSQLTable(state, posts)).toBe('');
    });
  });
});
