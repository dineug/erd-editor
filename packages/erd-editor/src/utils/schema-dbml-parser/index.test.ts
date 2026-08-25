import { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { CANVAS_SIZE_MAX, CANVAS_SIZE_MIN, Database } from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { Column } from '@/internal-types';
import { schemaDBMLParserToSchemaJson } from '@/utils/schema-dbml-parser';

type Schema = Pick<
  ERDEditorSchemaV3,
  '$schema' | 'version' | 'settings' | 'doc' | 'collections'
>;

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

function parse(
  dbml: string,
  prepare?: (schema: ERDEditorSchemaV3) => ERDEditorSchemaV3
): Schema {
  return JSON.parse(schemaDBMLParserToSchemaJson(dbml, ctx, prepare));
}

const withDatabase =
  (database: number) =>
  (schema: ERDEditorSchemaV3): ERDEditorSchemaV3 => {
    schema.settings.database = database;
    return schema;
  };

const columnsOf = (schema: Schema): Column[] =>
  schema.doc.tableIds.flatMap(tableId =>
    schema.collections.tableEntities[tableId].columnIds.map(
      columnId => schema.collections.tableColumnEntities[columnId]
    )
  );

const dataTypes = (schema: Schema): Record<string, string> =>
  Object.fromEntries(
    columnsOf(schema).map(column => [column.name, column.dataType])
  );

const tableNames = (schema: Schema): string[] =>
  schema.doc.tableIds.map(id => schema.collections.tableEntities[id].name);

const SIMPLE = `Table users {
  id int [pk]
  name varchar
}`;

// The spelling `sql2dbml` emits: every identifier quoted, no space after the
// colon, and `?<?` on a nullable foreign key.
const SQL2DBML = `Table "app"."users" {
  "id" serial [pk, increment]
  "email" varchar(255) [not null, unique]

  Note: '''the users
table'''
}

Table "app"."posts" {
  "id" serial [pk, increment]
  "user_id" integer
  "title" varchar(255)

  Indexes {
    title [name: "idx_posts_title"]
  }
}

Ref:"app"."users"."id" ?<? "app"."posts"."user_id"`;

const PRISMA_DBML = `//// ------------------------------------------------------
//// THIS FILE WAS AUTOMATICALLY GENERATED
//// ------------------------------------------------------

Table User {
  id String [pk]
  email String [unique, not null]
  posts Post [not null]
}

Table Post {
  id String [pk]
  authorId String [not null]
}

Ref: Post.authorId > User.id [delete: Cascade]`;

describe('schemaDBMLParserToSchemaJson', () => {
  it('returns a formatted JSON string, not an object', () => {
    const json = schemaDBMLParserToSchemaJson(SIMPLE, ctx);

    expect(typeof json).toBe('string');
    expect(json).toContain('\n  "version": "3.0.0"');
  });

  it('produces a v3 envelope', () => {
    const schema = parse(SIMPLE);

    expect(schema.version).toBe('3.0.0');
    expect(schema.$schema).toContain('schema.json');
    expect(Object.keys(schema).sort()).toEqual([
      '$schema',
      'collections',
      'doc',
      'settings',
      'version',
    ]);
  });

  it('reads the document', () => {
    const schema = parse(SIMPLE);

    expect(tableNames(schema)).toEqual(['users']);
    expect(columnsOf(schema).map(column => column.name)).toEqual([
      'id',
      'name',
    ]);
  });

  describe('canvas size', () => {
    it('grows with the table count', () => {
      const source = Array.from(
        { length: 40 },
        (_, index) => `Table t${index} { id int }`
      ).join('\n');

      expect(parse(source).settings.width).toBe(4000);
    });

    it('never falls below the minimum', () => {
      expect(parse(SIMPLE).settings.width).toBe(CANVAS_SIZE_MIN);
    });

    it('never rises above the maximum', () => {
      const source = Array.from(
        { length: 300 },
        (_, index) => `Table t${index} { id int }`
      ).join('\n');

      expect(parse(source).settings.height).toBe(CANVAS_SIZE_MAX);
    });
  });

  describe('the prepare callback', () => {
    it('keeps the settings it is handed', () => {
      const schema = parse(SIMPLE, incoming => {
        incoming.settings.databaseName = 'shop';
        return incoming;
      });

      expect(schema.settings.databaseName).toBe('shop');
    });

    it('keeps the canvas size the importer computed', () => {
      const schema = parse(SIMPLE, incoming => {
        incoming.settings.databaseName = 'shop';
        return incoming;
      });

      expect(schema.settings.width).toBe(CANVAS_SIZE_MIN);
    });

    it('reaches the columns, so the dialect decides an enum column', () => {
      const source = `Enum status { created }
Table orders { state status }`;

      expect(dataTypes(parse(source, withDatabase(Database.MySQL)))).toEqual({
        state: "ENUM('created')",
      });
      expect(
        dataTypes(parse(source, withDatabase(Database.PostgreSQL)))
      ).toEqual({ state: 'varchar(255)' });
    });

    it('defaults to the schema settings when it is not given', () => {
      expect(parse(SIMPLE).settings.database).toBe(Database.MySQL);
    });
  });

  describe('degrading rather than throwing', () => {
    it('produces an empty document for an empty string', () => {
      expect(parse('').doc.tableIds).toEqual([]);
    });

    it('produces an empty document for text that is not DBML', () => {
      expect(parse('not dbml at all { ] }').doc.tableIds).toEqual([]);
    });

    it('keeps the tables around a line it cannot read', () => {
      expect(
        tableNames(parse(`Table a { x int }\n!! garbage\nTable b { y int }`))
      ).toEqual(['a', 'b']);
    });

    it('produces an empty document for a file whose schema lives behind use', () => {
      expect(parse("use * from './base'").doc.tableIds).toEqual([]);
    });
  });

  describe('the spelling sql2dbml emits', () => {
    it('reads both tables and drops the shared schema from their names', () => {
      expect(tableNames(parse(SQL2DBML))).toEqual(['users', 'posts']);
    });

    it('reads the relationship across the fully quoted endpoints', () => {
      const schema = parse(SQL2DBML);
      const [relationship] = schema.doc.relationshipIds.map(
        id => schema.collections.relationshipEntities[id]
      );

      expect(
        schema.collections.tableEntities[relationship.start.tableId].name
      ).toBe('users');
      expect(
        schema.collections.tableEntities[relationship.end.tableId].name
      ).toBe('posts');
    });

    it('reads a triple-quoted note across lines', () => {
      const schema = parse(SQL2DBML);

      expect(
        schema.collections.tableEntities[schema.doc.tableIds[0]].comment
      ).toBe('the users\ntable');
    });

    it('reads the index', () => {
      const schema = parse(SQL2DBML);

      expect(
        schema.doc.indexIds.map(id => schema.collections.indexEntities[id].name)
      ).toEqual(['idx_posts_title']);
    });
  });

  describe('the spelling prisma-dbml-generator emits', () => {
    it('reads past the banner comment', () => {
      expect(tableNames(parse(PRISMA_DBML))).toEqual(['User', 'Post']);
    });

    it('reads the ref stated from the child side', () => {
      const schema = parse(PRISMA_DBML);
      const [relationship] = schema.doc.relationshipIds.map(
        id => schema.collections.relationshipEntities[id]
      );

      expect(
        schema.collections.tableEntities[relationship.start.tableId].name
      ).toBe('User');
      expect(
        schema.collections.tableEntities[relationship.end.tableId].name
      ).toBe('Post');
    });

    it('imports a relation object field as a column, having no way to tell', () => {
      expect(
        columnsOf(parse(PRISMA_DBML))
          .filter(column => column.name === 'posts')
          .map(column => column.dataType)
      ).toEqual(['Post']);
    });
  });
});
