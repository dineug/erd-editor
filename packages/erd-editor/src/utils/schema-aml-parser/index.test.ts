import { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { CANVAS_SIZE_MAX, CANVAS_SIZE_MIN, Database } from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { Column } from '@/internal-types';
import { schemaAMLParserToSchemaJson } from '@/utils/schema-aml-parser';

type Schema = Pick<
  ERDEditorSchemaV3,
  '$schema' | 'version' | 'settings' | 'doc' | 'collections'
>;

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

function parse(
  aml: string,
  prepare?: (schema: ERDEditorSchemaV3) => ERDEditorSchemaV3
): Schema {
  return JSON.parse(schemaAMLParserToSchemaJson(aml, ctx, prepare));
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

const relationshipNames = (schema: Schema): string[] =>
  schema.doc.relationshipIds.map(id => {
    const { start, end } = schema.collections.relationshipEntities[id];
    return `${schema.collections.tableEntities[start.tableId].name} -> ${
      schema.collections.tableEntities[end.tableId].name
    }`;
  });

const SIMPLE = `users
  id int pk
  name varchar`;

// The AMLv2 spelling: a namespace, an alias, nested attributes, a declared
// enum and the three arrows that are not one-to-many.
const AML_V2 = `#
# Full Schema AML
#

users # simplest entity
  id uid pk
  email varchar unique check

cms.posts as p # entity in schema
  id int pk {autoIncrement}
  status post_status
  settings json nullable
    slug string unique
  created_by int -> users(id)

db1.web.public.legacy_slug
  cur_slug varchar nullable -> p(settings.slug)

organizations
  id int pk <> users | many-to-many relation

identity...profiles
  id int pk -- users(id) | one-to-one relation

admins {view}
  id
  email

type uid int # alias type
type cms.post_status (draft, published, archived) # enum type`;

// The AMLv1 spelling the reference parser still accepts: fk for rel, a
// dotted attribute path, check= with a quoted predicate and * for a view.
const AML_V1 = `users # simplest entity
  id int pk
  email varchar unique

cms.posts
  id int pk
  title varchar(100) check="title <> ''"
  created_by int fk users.id

post_members
  post_id uuid pk fk cms.posts.id
  user_id int pk fk users.id

admins*
  id
  email`;

describe('schemaAMLParserToSchemaJson', () => {
  it('returns a formatted JSON string, not an object', () => {
    const json = schemaAMLParserToSchemaJson(SIMPLE, ctx);

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
    it('grows with the entity count', () => {
      const source = Array.from(
        { length: 40 },
        (_, index) => `t${index}\n  id int`
      ).join('\n');

      expect(parse(source).settings.width).toBe(4000);
    });

    it('never falls below the minimum', () => {
      expect(parse(SIMPLE).settings.width).toBe(CANVAS_SIZE_MIN);
    });

    it('never rises above the maximum', () => {
      const source = Array.from(
        { length: 300 },
        (_, index) => `t${index}\n  id int`
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
      const source = `type status (created)

orders
  state status`;

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

    it('reads prose as entities rather than failing, a bare name being one', () => {
      expect(tableNames(parse('not aml at all'))).toEqual(['not']);
    });

    it('keeps the entities around a line it cannot read', () => {
      expect(tableNames(parse(`a\n  x int\n!! garbage\nb\n  y int`))).toEqual([
        'a',
        'b',
      ]);
    });

    it('produces an empty document for a file holding only types', () => {
      expect(parse('type uid int').doc.tableIds).toEqual([]);
    });
  });

  describe('the AMLv2 spelling', () => {
    it('prefixes an entity whose namespace is not the default one', () => {
      expect(tableNames(parse(AML_V2))).toEqual([
        'users',
        'cms_posts',
        'db1_web_public_legacy_slug',
        'organizations',
        'identity_profiles',
        'admins',
        'organizations_users',
      ]);
    });

    it('flattens a nested attribute into a dotted column', () => {
      const schema = parse(AML_V2);
      const posts = schema.collections.tableEntities[schema.doc.tableIds[1]];

      expect(
        posts.columnIds.map(
          id => schema.collections.tableColumnEntities[id].name
        )
      ).toEqual(['id', 'status', 'settings', 'settings.slug', 'created_by']);
    });

    it('walks the alias type through to the aliased name', () => {
      const schema = parse(AML_V2);
      const users = schema.collections.tableEntities[schema.doc.tableIds[0]];

      expect(
        schema.collections.tableColumnEntities[users.columnIds[0]].dataType
      ).toBe('int');
    });

    it('reads a declared enum as the dialect enum column', () => {
      expect(dataTypes(parse(AML_V2)).status).toBe(
        "ENUM('draft','published','archived')"
      );
    });

    it('resolves an inline relation stated against the entity alias', () => {
      expect(relationshipNames(parse(AML_V2))).toContain(
        'cms_posts -> db1_web_public_legacy_slug'
      );
    });

    it('invents the junction table a many-to-many has no other home for', () => {
      const schema = parse(AML_V2);
      const junction =
        schema.collections.tableEntities[
          schema.doc.tableIds[schema.doc.tableIds.length - 1]
        ];

      expect(junction.comment).toBe(
        'Junction table inferred from organizations <-> users'
      );
      expect(relationshipNames(schema)).toEqual(
        expect.arrayContaining([
          'organizations -> organizations_users',
          'users -> organizations_users',
        ])
      );
    });

    it('imports a view as a table, its typeless attributes included', () => {
      const schema = parse(AML_V2);
      const admins = schema.collections.tableEntities[schema.doc.tableIds[5]];

      expect(
        admins.columnIds.map(
          id => schema.collections.tableColumnEntities[id].dataType
        )
      ).toEqual(['', '']);
    });
  });

  describe('the AMLv1 legacy spelling', () => {
    it('does not load as an empty diagram', () => {
      expect(tableNames(parse(AML_V1))).toEqual([
        'users',
        'cms_posts',
        'post_members',
        'admins',
      ]);
    });

    it('reads fk as the relation keyword, across the dotted path form', () => {
      expect(relationshipNames(parse(AML_V1))).toEqual([
        'users -> cms_posts',
        'cms_posts -> post_members',
        'users -> post_members',
      ]);
    });

    it('reads the quoted check predicate without losing the attribute', () => {
      expect(dataTypes(parse(AML_V1)).title).toBe('varchar(100)');
    });

    it('reads the * view suffix as an entity name terminator', () => {
      expect(tableNames(parse(AML_V1))).toContain('admins');
    });
  });
});
