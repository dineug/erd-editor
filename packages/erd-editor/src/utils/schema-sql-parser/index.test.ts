import { ERDEditorSchemaV3, schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  Database,
  OrderType,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { Column, Index, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createSchemaSQL } from '@/utils/schema-sql';
import { schemaSQLParserToSchemaJson } from '@/utils/schema-sql-parser';

type Schema = Pick<
  ERDEditorSchemaV3,
  '$schema' | 'version' | 'settings' | 'doc' | 'collections'
>;

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

function parse(
  sql: string,
  prepare?: (schema: ERDEditorSchemaV3) => ERDEditorSchemaV3
): Schema {
  return JSON.parse(schemaSQLParserToSchemaJson(sql, ctx, prepare));
}

const tablesOf = (schema: Schema): Table[] =>
  schema.doc.tableIds.map(id => schema.collections.tableEntities[id]);

const tableByName = (schema: Schema, name: string): Table => {
  const table = tablesOf(schema).find(table => table.name === name);
  if (!table) throw new Error(`table not found: ${name}`);
  return table;
};

const columnsOf = (schema: Schema, table: Table): Column[] =>
  table.columnIds.map(id => schema.collections.tableColumnEntities[id]);

const columnByName = (schema: Schema, table: Table, name: string): Column => {
  const column = columnsOf(schema, table).find(column => column.name === name);
  if (!column) throw new Error(`column not found: ${name}`);
  return column;
};

const relationshipsOf = (schema: Schema): Relationship[] =>
  schema.doc.relationshipIds.map(
    id => schema.collections.relationshipEntities[id]
  );

const indexesOf = (schema: Schema): Index[] =>
  schema.doc.indexIds.map(id => schema.collections.indexEntities[id]);

describe('schemaSQLParserToSchemaJson', () => {
  it('produces a v3 schema envelope for an empty source', () => {
    const schema = parse('');

    expect(schema.version).toBe('3.0.0');
    expect(schema.$schema).toBe(
      'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json'
    );
    expect(schema.doc).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    });
    expect(schema.collections.tableEntities).toEqual({});
    expect(schema.collections.tableColumnEntities).toEqual({});
  });

  it('returns a formatted JSON string, not an object', () => {
    const json = schemaSQLParserToSchemaJson('CREATE TABLE t (a INT);', ctx);

    expect(typeof json).toBe('string');
    expect(json).toContain('\n  "version": "3.0.0"');
  });

  describe('canvas size', () => {
    const createTables = (count: number) =>
      Array.from(
        { length: count },
        (_, i) => `CREATE TABLE t${i} (a INT);`
      ).join('\n');

    it('clamps small schemas up to the canvas minimum', () => {
      const schema = parse(createTables(2));

      expect(schema.settings.width).toBe(2000);
      expect(schema.settings.height).toBe(2000);
    });

    it('scales with the table count between the bounds', () => {
      const schema = parse(createTables(25));

      expect(schema.doc.tableIds).toHaveLength(25);
      expect(schema.settings.width).toBe(2500);
      expect(schema.settings.height).toBe(2500);
    });

    it('clamps large schemas down to the canvas maximum', () => {
      const schema = parse(createTables(205));

      expect(schema.doc.tableIds).toHaveLength(205);
      expect(schema.settings.width).toBe(20000);
      expect(schema.settings.height).toBe(20000);
    });
  });

  describe('table conversion', () => {
    const SQL = `
      CREATE TABLE users (
        id INT NOT NULL AUTO_INCREMENT COMMENT 'pk column',
        name VARCHAR(50) NOT NULL DEFAULT 'anon',
        email VARCHAR(100) UNIQUE,
        bio TEXT,
        PRIMARY KEY (id)
      ) COMMENT 'the user table';
    `;

    it('creates a table with name, comment and column order', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');

      expect(schema.doc.tableIds).toEqual([users.id]);
      expect(users.comment).toBe('the user table');
      expect(users.columnIds).toEqual(users.seqColumnIds);
      expect(columnsOf(schema, users).map(column => column.name)).toEqual([
        'id',
        'name',
        'email',
        'bio',
      ]);
    });

    it('maps every column option bit', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');
      const id = columnByName(schema, users, 'id');
      const name = columnByName(schema, users, 'name');
      const email = columnByName(schema, users, 'email');
      const bio = columnByName(schema, users, 'bio');

      expect(id.options).toBe(
        ColumnOption.autoIncrement |
          ColumnOption.primaryKey |
          ColumnOption.notNull
      );
      expect(name.options).toBe(ColumnOption.notNull);
      expect(email.options).toBe(ColumnOption.unique);
      expect(bio.options).toBe(0);
    });

    it('flags the primary key in ui.keys only for the primary key column', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');

      expect(columnByName(schema, users, 'id').ui.keys).toBe(
        ColumnUIKey.primaryKey
      );
      expect(columnByName(schema, users, 'name').ui.keys).toBe(0);
    });

    it('carries over the column payload', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');
      const id = columnByName(schema, users, 'id');
      const name = columnByName(schema, users, 'name');

      expect(id.tableId).toBe(users.id);
      expect(id.dataType).toBe('INT');
      expect(id.comment).toBe('pk column');
      expect(name.dataType).toBe('VARCHAR(50)');
      expect(name.default).toBe('anon');
    });

    it('sizes widths with toWidth clamped to the column minimum', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');
      const name = columnByName(schema, users, 'name');

      // 'users'.length * 10 === 50 -> clamped up to 60
      expect(users.ui.widthName).toBe(60);
      // 'the user table'.length * 10 === 140
      expect(users.ui.widthComment).toBe(140);
      // 'VARCHAR(50)'.length * 10 === 110
      expect(name.ui.widthDataType).toBe(110);
      // 'anon'.length * 10 === 40 -> clamped up to 60
      expect(name.ui.widthDefault).toBe(60);
      // empty comment -> clamped up to 60
      expect(name.ui.widthComment).toBe(60);
    });

    it('skips CREATE TABLE statements without a name', () => {
      const schema = parse('CREATE TABLE ( id INT );');

      expect(schema.doc.tableIds).toHaveLength(0);
      expect(schema.collections.tableColumnEntities).toEqual({});
    });
  });

  describe('COMMENT ON merging', () => {
    const SQL = `
      CREATE TABLE users
      (
        id    INT          NOT NULL,
        email VARCHAR(255) NOT NULL
      );

      COMMENT ON TABLE users IS 'user table';

      COMMENT ON COLUMN users.id IS 'user id';

      COMMENT ON COLUMN public.users.email IS 'email address';
    `;

    it('applies the PostgreSQL table and column comments', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');

      expect(users.comment).toBe('user table');
      expect(columnByName(schema, users, 'id').comment).toBe('user id');
      expect(columnByName(schema, users, 'email').comment).toBe(
        'email address'
      );
    });

    it('sizes the comment columns from the applied comments', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');

      // 'user table'.length * 10 === 100
      expect(users.ui.widthComment).toBe(100);
      // 'user id'.length * 10 === 70
      expect(columnByName(schema, users, 'id').ui.widthComment).toBe(70);
    });

    it('ignores a COMMENT ON that names a table or column the source never created', () => {
      const schema = parse(`
        CREATE TABLE users (id INT);

        COMMENT ON TABLE missing IS 'nope';
        COMMENT ON COLUMN users.missing IS 'nope';
        COMMENT ON COLUMN missing.id IS 'nope';
      `);
      const users = tableByName(schema, 'users');

      expect(users.comment).toBe('');
      expect(columnByName(schema, users, 'id').comment).toBe('');
    });

    it('reads a MySQL table option comment through the equal sign', () => {
      const schema = parse(
        "CREATE TABLE t (id INT) ENGINE=InnoDB COMMENT='(test)bug here!!';"
      );

      expect(tableByName(schema, 't').comment).toBe('(test)bug here!!');
    });
  });

  describe('ALTER TABLE merging', () => {
    it('applies ADD PRIMARY KEY and ADD UNIQUE to existing columns', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT, c INT);
        ALTER TABLE t ADD CONSTRAINT pk_t PRIMARY KEY (a);
        ALTER TABLE t ADD CONSTRAINT uq_t UNIQUE (b);
      `);
      const t = tableByName(schema, 't');

      expect(
        bHas(columnByName(schema, t, 'a').options, ColumnOption.primaryKey)
      ).toBe(true);
      expect(columnByName(schema, t, 'a').ui.keys).toBe(ColumnUIKey.primaryKey);
      expect(
        bHas(columnByName(schema, t, 'b').options, ColumnOption.unique)
      ).toBe(true);
      expect(columnByName(schema, t, 'c').options).toBe(0);
    });

    it('matches table and column names case-insensitively', () => {
      const schema = parse(`
        CREATE TABLE t (a INT);
        ALTER TABLE T ADD PRIMARY KEY (A);
      `);
      const t = tableByName(schema, 't');

      expect(
        bHas(columnByName(schema, t, 'a').options, ColumnOption.primaryKey)
      ).toBe(true);
    });

    it('ignores ALTER statements targeting an unknown table', () => {
      const schema = parse(`
        CREATE TABLE t (a INT);
        ALTER TABLE missing ADD PRIMARY KEY (a);
        ALTER TABLE missing ADD UNIQUE (a);
        ALTER TABLE missing ADD FOREIGN KEY (a) REFERENCES t (a);
        CREATE INDEX idx ON missing (a);
      `);
      const t = tableByName(schema, 't');

      expect(columnByName(schema, t, 'a').options).toBe(0);
      expect(schema.doc.relationshipIds).toHaveLength(0);
      expect(schema.doc.indexIds).toHaveLength(0);
    });

    it('ignores ALTER statements targeting an unknown column', () => {
      const schema = parse(`
        CREATE TABLE t (a INT);
        ALTER TABLE t ADD PRIMARY KEY (nope);
        ALTER TABLE t ADD UNIQUE (nope);
      `);
      const t = tableByName(schema, 't');

      expect(columnByName(schema, t, 'a').options).toBe(0);
    });

    it('drops ALTER statements that carry no column names', () => {
      const schema = parse(`
        CREATE TABLE t (a INT);
        ALTER TABLE t ADD PRIMARY KEY ();
        ALTER TABLE t ADD UNIQUE ();
      `);
      const t = tableByName(schema, 't');

      expect(columnByName(schema, t, 'a').options).toBe(0);
    });

    it('drops foreign keys whose column list could not be parsed', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT);
        CREATE TABLE o (c INT);
        ALTER TABLE t ADD FOREIGN KEY (a, b) REFERENCES o (c);
      `);

      expect(schema.doc.relationshipIds).toHaveLength(0);
    });
  });

  describe('relationship conversion', () => {
    it('creates a non-identifying relationship for a plain foreign key', () => {
      const schema = parse(`
        CREATE TABLE users (id INT, PRIMARY KEY (id));
        CREATE TABLE posts (id INT, user_id INT, PRIMARY KEY (id));
        ALTER TABLE posts ADD CONSTRAINT fk_posts FOREIGN KEY (user_id) REFERENCES users (id);
      `);
      const users = tableByName(schema, 'users');
      const posts = tableByName(schema, 'posts');
      const [relationship] = relationshipsOf(schema);

      expect(relationshipsOf(schema)).toHaveLength(1);
      expect(relationship.identification).toBe(false);
      expect(relationship.relationshipType).toBe(RelationshipType.ZeroN);
      expect(relationship.startRelationshipType).toBe(
        StartRelationshipType.dash
      );
      expect(relationship.start.tableId).toBe(users.id);
      expect(relationship.start.columnIds).toEqual([
        columnByName(schema, users, 'id').id,
      ]);
      expect(relationship.end.tableId).toBe(posts.id);
      expect(relationship.end.columnIds).toEqual([
        columnByName(schema, posts, 'user_id').id,
      ]);
      expect(columnByName(schema, posts, 'user_id').ui.keys).toBe(
        ColumnUIKey.foreignKey
      );
      // the primary key of the end table keeps its own key flag
      expect(columnByName(schema, posts, 'id').ui.keys).toBe(
        ColumnUIKey.primaryKey
      );
    });

    it('creates an identifying relationship when every end column is also a primary key', () => {
      const schema = parse(`
        CREATE TABLE parent (id INT, PRIMARY KEY (id));
        CREATE TABLE child (parent_id INT, seq INT, PRIMARY KEY (parent_id, seq));
        ALTER TABLE child ADD FOREIGN KEY (parent_id) REFERENCES parent (id);
      `);
      const child = tableByName(schema, 'child');
      const [relationship] = relationshipsOf(schema);

      expect(relationship.identification).toBe(true);
      expect(columnByName(schema, child, 'parent_id').ui.keys).toBe(
        ColumnUIKey.primaryKey | ColumnUIKey.foreignKey
      );
      expect(columnByName(schema, child, 'seq').ui.keys).toBe(
        ColumnUIKey.primaryKey
      );
    });

    it('supports composite foreign keys', () => {
      const schema = parse(`
        CREATE TABLE parent (a INT, b INT, PRIMARY KEY (a, b));
        CREATE TABLE child (pa INT, pb INT);
        ALTER TABLE child ADD FOREIGN KEY (pa, pb) REFERENCES parent (a, b);
      `);
      const parent = tableByName(schema, 'parent');
      const child = tableByName(schema, 'child');
      const [relationship] = relationshipsOf(schema);

      expect(relationship.start.columnIds).toEqual([
        columnByName(schema, parent, 'a').id,
        columnByName(schema, parent, 'b').id,
      ]);
      expect(relationship.end.columnIds).toEqual([
        columnByName(schema, child, 'pa').id,
        columnByName(schema, child, 'pb').id,
      ]);
      expect(relationship.identification).toBe(false);
    });

    it('supports inline REFERENCES declared inside CREATE TABLE', () => {
      const schema = parse(`
        CREATE TABLE users (id INT, PRIMARY KEY (id));
        CREATE TABLE posts (
          user_id INT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        );
      `);

      expect(relationshipsOf(schema)).toHaveLength(1);
      expect(relationshipsOf(schema)[0].start.tableId).toBe(
        tableByName(schema, 'users').id
      );
    });

    it('skips a foreign key whose referenced table does not exist', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT, user_id INT);
        ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES nosuch (id);
      `);
      const posts = tableByName(schema, 'posts');

      expect(schema.doc.relationshipIds).toHaveLength(0);
      expect(columnByName(schema, posts, 'user_id').ui.keys).toBe(0);
    });

    it('drops unresolvable columns from the relationship endpoints', () => {
      const schema = parse(`
        CREATE TABLE users (id INT, PRIMARY KEY (id));
        CREATE TABLE posts (id INT, user_id INT);
        ALTER TABLE posts ADD FOREIGN KEY (nope) REFERENCES users (id);
      `);
      const users = tableByName(schema, 'users');
      const [relationship] = relationshipsOf(schema);

      expect(relationshipsOf(schema)).toHaveLength(1);
      expect(relationship.start.columnIds).toEqual([
        columnByName(schema, users, 'id').id,
      ]);
      // no end column resolved, yet `[].some(...)` makes it identifying
      expect(relationship.end.columnIds).toEqual([]);
      expect(relationship.identification).toBe(true);
    });

    it('drops an unresolvable referenced column from the start endpoint', () => {
      const schema = parse(`
        CREATE TABLE users (id INT);
        CREATE TABLE posts (user_id INT);
        ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES users (nope);
      `);
      const posts = tableByName(schema, 'posts');
      const [relationship] = relationshipsOf(schema);

      expect(relationship.start.columnIds).toEqual([]);
      expect(relationship.end.columnIds).toEqual([
        columnByName(schema, posts, 'user_id').id,
      ]);
      expect(relationship.identification).toBe(false);
    });

    it('creates one relationship per foreign key on the same table', () => {
      const schema = parse(`
        CREATE TABLE a (id INT);
        CREATE TABLE b (id INT);
        CREATE TABLE c (a_id INT, b_id INT);
        ALTER TABLE c ADD FOREIGN KEY (a_id) REFERENCES a (id);
        ALTER TABLE c ADD FOREIGN KEY (b_id) REFERENCES b (id);
      `);

      expect(relationshipsOf(schema)).toHaveLength(2);
      expect(
        relationshipsOf(schema).map(relationship => relationship.start.tableId)
      ).toEqual([tableByName(schema, 'a').id, tableByName(schema, 'b').id]);
    });
  });

  describe('index conversion', () => {
    it('converts CREATE INDEX into an index with ordered columns', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT, title VARCHAR(200), user_id INT);
        CREATE UNIQUE INDEX idx_posts ON posts (title DESC, user_id ASC);
      `);
      const posts = tableByName(schema, 'posts');
      const [index] = indexesOf(schema);

      expect(indexesOf(schema)).toHaveLength(1);
      expect(index.name).toBe('idx_posts');
      expect(index.unique).toBe(true);
      expect(index.tableId).toBe(posts.id);
      expect(index.indexColumnIds).toEqual(index.seqIndexColumnIds);

      const indexColumns = index.indexColumnIds.map(
        id => schema.collections.indexColumnEntities[id]
      );

      expect(indexColumns.map(indexColumn => indexColumn.indexId)).toEqual([
        index.id,
        index.id,
      ]);
      expect(indexColumns.map(indexColumn => indexColumn.columnId)).toEqual([
        columnByName(schema, posts, 'title').id,
        columnByName(schema, posts, 'user_id').id,
      ]);
      expect(indexColumns.map(indexColumn => indexColumn.orderType)).toEqual([
        OrderType.DESC,
        OrderType.ASC,
      ]);
    });

    it('defaults a non-unique index to unique: false', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT);
        CREATE INDEX idx_posts ON posts (id);
      `);

      expect(indexesOf(schema)[0].unique).toBe(false);
    });

    it('converts indexes declared inline in CREATE TABLE', () => {
      const schema = parse(`
        CREATE TABLE t (
          a INT,
          b INT,
          INDEX idx_t (a DESC, b)
        );
      `);
      const t = tableByName(schema, 't');
      const [index] = indexesOf(schema);
      const indexColumns = index.indexColumnIds.map(
        id => schema.collections.indexColumnEntities[id]
      );

      expect(index.name).toBe('idx_t');
      expect(index.tableId).toBe(t.id);
      expect(indexColumns.map(indexColumn => indexColumn.orderType)).toEqual([
        OrderType.DESC,
        OrderType.ASC,
      ]);
    });

    it('skips index columns that do not resolve, keeping the rest', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT);
        CREATE INDEX idx_posts ON posts (id, nope);
      `);
      const posts = tableByName(schema, 'posts');
      const [index] = indexesOf(schema);

      expect(index.indexColumnIds).toHaveLength(1);
      expect(
        schema.collections.indexColumnEntities[index.indexColumnIds[0]].columnId
      ).toBe(columnByName(schema, posts, 'id').id);
    });

    it('does not create an index when no column resolves', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT);
        CREATE INDEX idx_posts ON posts (nope);
      `);

      expect(schema.doc.indexIds).toHaveLength(0);
      expect(schema.collections.indexEntities).toEqual({});
      expect(schema.collections.indexColumnEntities).toEqual({});
    });

    it('drops CREATE INDEX statements without a table or without columns', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT);
        CREATE INDEX idx_a ON posts ();
        CREATE INDEX idx_b ON;
      `);

      expect(schema.doc.indexIds).toHaveLength(0);
    });
  });

  describe('prepare hook', () => {
    it('is applied before serialization', () => {
      const schema = parse('CREATE TABLE t (a INT);', schema => {
        schema.settings.databaseName = 'prepared';
        schema.settings.zoomLevel = 0.5;
        return schema;
      });

      expect(schema.settings.databaseName).toBe('prepared');
      expect(schema.settings.zoomLevel).toBe(0.5);
      expect(schema.doc.tableIds).toHaveLength(1);
    });

    it('can swap the schema entirely', () => {
      const replacement = parse('CREATE TABLE replacement (a INT);');
      const schema = parse(
        'CREATE TABLE original (a INT);',
        () => replacement as ERDEditorSchemaV3
      );

      expect(tablesOf(schema).map(table => table.name)).toEqual([
        'replacement',
      ]);
    });
  });

  describe('combined document', () => {
    it('converts tables, relationships and indexes together', () => {
      const schema = parse(`
        CREATE TABLE users (
          id INT NOT NULL AUTO_INCREMENT,
          email VARCHAR(100) NOT NULL,
          PRIMARY KEY (id)
        ) COMMENT 'users';

        CREATE TABLE posts (
          id INT NOT NULL,
          user_id INT NOT NULL,
          title VARCHAR(200),
          PRIMARY KEY (id)
        );

        ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);
        ALTER TABLE posts ADD CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id);
        CREATE INDEX idx_posts_title ON posts (title);
      `);

      expect(tablesOf(schema).map(table => table.name)).toEqual([
        'users',
        'posts',
      ]);
      expect(Object.keys(schema.collections.tableColumnEntities)).toHaveLength(
        5
      );
      expect(schema.doc.relationshipIds).toHaveLength(1);
      expect(schema.doc.indexIds).toHaveLength(1);
      expect(schema.doc.memoIds).toEqual([]);
      expect(schema.settings.width).toBe(2000);

      const users = tableByName(schema, 'users');
      expect(
        bHas(columnByName(schema, users, 'email').options, ColumnOption.unique)
      ).toBe(true);
    });
  });

  describe('comment round trip', () => {
    function commentedState(): RootState {
      const state = {
        ...schemaV3Parser({}),
        editor: {},
        lww: {},
      } as unknown as RootState;

      state.collections.tableColumnEntities = {
        'col-id': createColumn({
          id: 'col-id',
          tableId: 'tbl-users',
          name: 'id',
          dataType: 'INT',
          comment: 'user id',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        }),
      };
      state.collections.tableEntities = {
        'tbl-users': createTable({
          id: 'tbl-users',
          name: 'users',
          comment: 'user table',
          columnIds: ['col-id'],
        }),
      };
      state.doc.tableIds = ['tbl-users'];

      return state;
    }

    it.each([Database.PostgreSQL, Database.Oracle, Database.MySQL])(
      'keeps the comments of a %s export when the SQL is imported back',
      database => {
        const schema = parse(createSchemaSQL(commentedState(), database));
        const users = tableByName(schema, 'users');

        expect(users.comment).toBe('user table');
        expect(columnByName(schema, users, 'id').comment).toBe('user id');
      }
    );

    it('keeps the columns of a SQLite export, whose comments are plain -- lines', () => {
      const schema = parse(createSchemaSQL(commentedState(), Database.SQLite));
      const users = tableByName(schema, 'users');

      expect(columnsOf(schema, users).map(column => column.name)).toEqual([
        'id',
      ]);
    });
  });
});
