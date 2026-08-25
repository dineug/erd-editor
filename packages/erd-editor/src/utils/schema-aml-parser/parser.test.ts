import { describe, expect, it } from 'vite-plus/test';

import { parseAMLModel } from '@/utils/schema-aml-parser/parser';
import {
  AMLAttribute,
  AMLEntity,
  AMLModel,
  AMLRelation,
} from '@/utils/schema-aml-parser/types';

const FULL_AML = `#
# Full Schema AML
#

users # simplest entity
  id uid pk
  first_name varchar unique=name
  last_name varchar unique=name
  email varchar unique check
  is_admin bool=false

cms.posts as p # entity in schema
  id int pk {autoIncrement, tags: [id]}
  title varchar(100) unique check(\`title <> ''\`)
  status post_status
  content varchar nullable
  settings json nullable
    slug string unique
    publish_at date
    publish_by -> users(id)
    tags "string[]"
    category json
      id number index
      name string
  created_at "timestamp with time zone"
  created_by int -> users(id)

post_members
  post_id uuid pk=post_members_pk -> cms.posts(id)
  user_id int pk=post_members_pk -> users(id)
  role varchar(10)=author check(\`role IN ('author', 'editor')\`)=members_role_chk

"legacy schema"."post member details" # special entity name
  post_id uuid pk
  user_id int pk
  "index" int=0 | keyword attribute name
  "added by" int nullable -> users(id) | special attribute name

rel "legacy schema"."post member details"(post_id, user_id) -> post_members(post_id, user_id)

comments as c {color: "#ccc", tags: [utils, "owner:infra"]} |||
  a table with most options
  looks quite complex but not intended to be used all together ^^
||| # several additional props
  id uuid pk=comment_pk
  item_kind comment_item(User, Post) index=item |||
    polymorphic column for polymorphic relation
    used with both item_kind and item_id
  |||
  item_id int index=item
  content | doc with \\# escaped # no type
  created_by -> users # attribute type should default to target column is not set

rel comments(item_id) -item_kind=User> users(id)
rel comments(item_id) -item_kind=Post> cms.posts(id) {onDelete: cascade}

db1.web.public.legacy_slug
  old_slug slug check(\`old_slug <> '' AND new_slug <> ''\`)=slug_check
  new_slug slug check=slug_check # composite check, add it to every attribute, predicate can be defined once
  cur_slug varchar nullable -> p(settings.slug)

organizations
  id int pk <> users | many-to-many relation
  name varchar(50)
  content box nullable

identity...profiles
  id int pk -- users(id) | one-to-one relation

admins {view}
  id
  first_name
  last_name
  email

guests {view: "SELECT *\\nFROM users\\nWHERE is_admin = false"} # a view without attributes but with definition

type slug | anonymous type
type uid int {tags: [generic]} # alias type
type cms.post_status (draft, published, archived) # enum type
type position {x int, y int} # struct type
type box \`(INPUT = lower, OUTPUT = lower, INTERNALLENGTH = 16)\` # custom type

namespace social.

social_accounts | entity with no attribute

rel social_accounts <> users | natural many-to-many relation
`;

const LEGACY_AML = `#
# Full Schema AML
#

users # simplest entity
  id uid pk
  first_name varchar unique=name
  last_name varchar unique=name
  email varchar unique check
  is_admin bool=false

cms.posts # entity in schema
  id int pk
  title varchar(100) unique check="title <> ''"
  status post_status
  content varchar nullable
  settings json nullable
  created_at "timestamp with time zone"
  created_by int fk users.id

post_members
  post_id uuid pk fk cms.posts.id
  user_id int pk fk users.id
  role varchar(10)=author check="role IN ('author', 'editor')"

"legacy schema"."post member details" # special entity name
  post_id uuid pk
  user_id int pk
  "index" int=0 | keyword attribute name
  "added by" int nullable fk users.id | special attribute name

fk "legacy schema"."post member details".post_id -> post_members.post_id
fk "legacy schema"."post member details".user_id -> post_members.user_id

comments | a table with most options looks quite complex but not intended to be used all together ^^ # several additional props
  id uuid pk
  item_kind comment_item(User, Post) index=item | polymorphic column for polymorphic relation used with both item_kind and item_id
  item_id int index=item
  content | doc with \\# escaped # no type
  created_by fk users.id # attribute type should default to target column is not set

fk comments.item_id -> users.id
fk comments.item_id -> cms.posts.id

public.legacy_slug
  old_slug slug check="old_slug <> '' AND new_slug <> ''"
  new_slug slug check="old_slug <> '' AND new_slug <> ''" # composite check, add it to every attribute, predicate can be defined once
  cur_slug varchar nullable fk cms.posts.settings:slug

organizations
  id int pk fk users.id | many-to-many relation
  name varchar(50)
  content box nullable

profiles
  id int pk fk users.id | one-to-one relation

admins*
  id
  first_name
  last_name
  email

guests* # a view without attributes but with definition

social_accounts | entity with no attribute
`;

function parse(source: string): AMLModel {
  const result = parseAMLModel(source);
  if (!result.ok) throw new Error(result.message);
  return result.model;
}

function firstEntity(source: string): AMLEntity {
  const [entity] = parse(source).entities;
  if (!entity) throw new Error('expected an entity');
  return entity;
}

function attributesOf(source: string): AMLAttribute[] {
  return firstEntity(source).attributes;
}

function pathsOf(source: string): string[] {
  return attributesOf(source).map(entry => entry.path);
}

function attribute(line: string): AMLAttribute {
  const [entry] = attributesOf(`t\n  ${line}`);
  if (!entry) throw new Error('expected an attribute');
  return entry;
}

function relationsOf(source: string): AMLRelation[] {
  return parse(source).relations;
}

function firstRelation(source: string): AMLRelation {
  const [relation] = relationsOf(source);
  if (!relation) throw new Error('expected a relation');
  return relation;
}

function entityNames(source: string): string[] {
  return parse(source).entities.map(entry => entry.name);
}

function namedEntity(model: AMLModel, name: string): AMLEntity {
  const entity = model.entities.find(entry => entry.name === name);
  if (!entity) throw new Error(`expected an entity named ${name}`);
  return entity;
}

describe('schema-aml-parser/parser', () => {
  it('returns an empty model for an empty document', () => {
    expect(parse('')).toEqual({
      entities: [],
      relations: [],
      types: {},
      skipped: [],
    });
  });

  it('returns an empty model for a document of comments alone', () => {
    expect(parse('# nothing here\n# nor here\n').entities).toEqual([]);
  });

  it('ignores blank lines between statements', () => {
    expect(entityNames('a\n\n\nb\n')).toEqual(['a', 'b']);
  });

  describe('entities', () => {
    it('reads an entity and its attributes', () => {
      const entity = firstEntity('users\n  id int\n  name varchar');

      expect(entity.name).toBe('users');
      expect(entity.attributes.map(entry => entry.path)).toEqual([
        'id',
        'name',
      ]);
    });

    it('reads a quoted entity and attribute name', () => {
      const entity = firstEntity('"user list"\n  "full name" varchar');

      expect(entity.name).toBe('user list');
      expect(entity.attributes[0].path).toBe('full name');
    });

    it('reads a schema-qualified name', () => {
      expect(firstEntity('cms.posts')).toMatchObject({
        namespace: { database: '', catalog: '', schema: 'cms' },
        name: 'posts',
      });
    });

    it('reads a catalog-qualified name', () => {
      expect(firstEntity('web.cms.posts')).toMatchObject({
        namespace: { database: '', catalog: 'web', schema: 'cms' },
        name: 'posts',
      });
    });

    it('reads a database-qualified name', () => {
      expect(firstEntity('db1.web.public.legacy_slug')).toMatchObject({
        namespace: { database: 'db1', catalog: 'web', schema: 'public' },
        name: 'legacy_slug',
      });
    });

    it('reads the dot-elided spelling, whose empty segments still count', () => {
      expect(firstEntity('identity...profiles')).toMatchObject({
        namespace: { database: 'identity', catalog: '', schema: '' },
        name: 'profiles',
      });
    });

    it('reads an alias', () => {
      expect(firstEntity('cms.posts as p').alias).toBe('p');
    });

    it('reads a doc as the comment', () => {
      expect(firstEntity('users | people').comment).toBe('people');
    });

    it('reads a comment when there is no doc', () => {
      expect(firstEntity('users # people').comment).toBe('people');
    });

    it('prefers the doc over the comment', () => {
      expect(firstEntity('users | people # source note').comment).toBe(
        'people'
      );
    });

    it('reads a multiline doc', () => {
      expect(firstEntity('users |||\n  one\n  two\n|||').comment).toBe(
        'one\ntwo'
      );
    });

    it('drops the view property and records the label', () => {
      const model = parse('admins {view}\n  id');

      expect(model.entities[0].name).toBe('admins');
      expect(model.skipped).toEqual(['view']);
    });

    it('drops every other property and records its key', () => {
      expect(parse('users {color: "#ccc", tags: [a, b]}').skipped).toEqual([
        'color',
        'tags',
      ]);
    });

    it('records a skipped label once', () => {
      expect(parse('a {color: red}\nb {color: blue}').skipped).toEqual([
        'color',
      ]);
    });

    it('drops an entity whose name is a keyword', () => {
      expect(parse('check\n  id int').entities).toEqual([]);
    });
  });

  describe('namespaces', () => {
    it('sets the schema for the entities that follow', () => {
      expect(firstEntity('namespace app\nusers').namespace).toEqual({
        database: '',
        catalog: '',
        schema: 'app',
      });
    });

    it('reads two segments as catalog and schema', () => {
      expect(firstEntity('namespace web.app\nusers').namespace).toEqual({
        database: '',
        catalog: 'web',
        schema: 'app',
      });
    });

    it('reads three segments as database, catalog and schema', () => {
      expect(firstEntity('namespace db1.web.app\nusers').namespace).toEqual({
        database: 'db1',
        catalog: 'web',
        schema: 'app',
      });
    });

    it('reads a trailing dot as a catalog with no schema', () => {
      expect(firstEntity('namespace social.\nusers').namespace).toEqual({
        database: '',
        catalog: 'social',
        schema: '',
      });
    });

    it('clears the default when written bare', () => {
      expect(entityNames('namespace app\na\nnamespace\nb')).toEqual(['a', 'b']);
      expect(
        parse('namespace app\na\nnamespace\nb').entities[1].namespace
      ).toEqual({ database: '', catalog: '', schema: '' });
    });

    it('fills only the parts the entity does not spell', () => {
      expect(firstEntity('namespace web.app\nother.users').namespace).toEqual({
        database: '',
        catalog: 'web',
        schema: 'other',
      });
    });
  });

  describe('the attribute line', () => {
    it('reads an attribute with no type at all', () => {
      expect(attribute('a')).toEqual({
        path: 'a',
        comment: '',
        typeName: '',
        enumValues: [],
        notNull: true,
        primaryKey: false,
        indexes: [],
        default: '',
        autoIncrement: false,
      });
    });

    it('reads a type', () => {
      expect(attribute('a int').typeName).toBe('int');
    });

    it('reads a quoted type', () => {
      expect(attribute('a "timestamp with time zone"').typeName).toBe(
        'timestamp with time zone'
      );
    });

    it('keeps the array suffix a quoted type carries', () => {
      expect(attribute('a "string[]"').typeName).toBe('string[]');
    });

    it('keeps a single integer argument inside the type name', () => {
      expect(attribute('a varchar(100)')).toMatchObject({
        typeName: 'varchar(100)',
        enumValues: [],
      });
    });

    it('keeps two integer arguments inside the type name', () => {
      expect(attribute('a decimal(2,3)').typeName).toBe('decimal(2,3)');
    });

    it('reads a named argument list as inline enum members', () => {
      expect(attribute('a status(draft, published)')).toMatchObject({
        typeName: 'status',
        enumValues: ['draft', 'published'],
      });
    });

    it('reads three integers as enum members, not as arguments', () => {
      expect(attribute('a code(1, 2, 3)')).toMatchObject({
        typeName: 'code',
        enumValues: ['1', '2', '3'],
      });
    });

    it('reads a default inside the type group', () => {
      expect(attribute('a int=0').default).toBe('0');
    });

    it('reads a default after an argument list', () => {
      expect(attribute('a varchar(10)=author')).toMatchObject({
        typeName: 'varchar(10)',
        default: 'author',
      });
    });

    it('reads a boolean default', () => {
      expect(attribute('a bool=false').default).toBe('false');
    });

    it('reads an expression default', () => {
      expect(attribute('a date=`now()`').default).toBe('`now()`');
    });

    it('reads a negative default', () => {
      expect(attribute('a int=-1').default).toBe('-1');
    });

    it('has no way to spell a default without a type', () => {
      expect(attribute('a =1').default).toBe('');
    });

    it('is not null by default', () => {
      expect(attribute('a int').notNull).toBe(true);
    });

    it('clears not null on the nullable keyword', () => {
      expect(attribute('a int nullable').notNull).toBe(false);
    });

    it('reads a primary key', () => {
      expect(attribute('a int pk').primaryKey).toBe(true);
    });

    it('reads a named primary key', () => {
      expect(attribute('a int pk=t_pk').primaryKey).toBe(true);
    });

    it('reads a bare unique as an unnamed index', () => {
      expect(attribute('a int unique').indexes).toEqual([
        { name: '', unique: true },
      ]);
    });

    it('reads a named unique', () => {
      expect(attribute('a int unique=u').indexes).toEqual([
        { name: 'u', unique: true },
      ]);
    });

    it('reads a bare index', () => {
      expect(attribute('a int index').indexes).toEqual([
        { name: '', unique: false },
      ]);
    });

    it('reads a named index', () => {
      expect(attribute('a int index=i').indexes).toEqual([
        { name: 'i', unique: false },
      ]);
    });

    it('reads several constraints in one line', () => {
      expect(attribute('a int pk unique index=i')).toMatchObject({
        primaryKey: true,
        indexes: [
          { name: '', unique: true },
          { name: 'i', unique: false },
        ],
      });
    });

    it('drops a bare check and records the label', () => {
      expect(parse('t\n  a int check').skipped).toEqual(['check']);
    });

    it('drops a check with a predicate and a name', () => {
      const model = parse('t\n  a int check(`a > 0`)=c pk');

      expect(model.skipped).toEqual(['check']);
      expect(model.entities[0].attributes[0].primaryKey).toBe(true);
    });

    it('reads autoIncrement from the properties', () => {
      expect(attribute('a int pk {autoIncrement}').autoIncrement).toBe(true);
    });

    it('drops every other property and records its key', () => {
      const model = parse('t\n  a int {autoIncrement, tags: [id]}');

      expect(model.entities[0].attributes[0].autoIncrement).toBe(true);
      expect(model.skipped).toEqual(['tags']);
    });

    it('reads a doc as the comment', () => {
      expect(attribute('a int | the id').comment).toBe('the id');
    });

    it('reads a comment when there is no doc', () => {
      expect(attribute('a int # the id').comment).toBe('the id');
    });

    it('prefers the doc over the comment', () => {
      expect(attribute('a int | the id # note').comment).toBe('the id');
    });

    it('reads a doc on an attribute with no type', () => {
      expect(attribute('a | the id')).toMatchObject({
        typeName: '',
        comment: 'the id',
      });
    });

    it('never reads a keyword as the type', () => {
      expect(attribute('a nullable')).toMatchObject({
        typeName: '',
        notNull: false,
      });
    });

    it('drops a line whose name is a keyword', () => {
      expect(attributesOf('t\n  index int')).toEqual([]);
    });

    it('drops an indented line with no entity above it', () => {
      expect(parse('  a int').entities).toEqual([]);
    });
  });

  describe('nesting', () => {
    it('dots the path from the entity root', () => {
      expect(
        pathsOf(`t
  a json
    b int
      c int
    d int
  e int`)
      ).toEqual(['a', 'a.b', 'a.b.c', 'a.d', 'e']);
    });

    it('emits parents before children, flat and in source order', () => {
      expect(
        pathsOf(`t
  a json
    b int
  c json
    d int`)
      ).toEqual(['a', 'a.b', 'c', 'c.d']);
    });

    it('reads a tab as one level', () => {
      expect(pathsOf('t\n\ta json\n\t\tb int')).toEqual(['a', 'a.b']);
    });

    it('goes only one level deeper on a jumped indent', () => {
      expect(pathsOf('t\n  a json\n      b int')).toEqual(['a', 'a.b']);
    });

    it('treats the first attribute as a root even when it is indented', () => {
      expect(pathsOf('t\n    a json\n    b int')).toEqual(['a', 'a.b']);
    });

    it('climbs back out of several levels at once', () => {
      expect(
        pathsOf(`t
  a json
    b json
      c int
  d int`)
      ).toEqual(['a', 'a.b', 'a.b.c', 'd']);
    });

    it('starts over for the next entity', () => {
      const model = parse('t1\n  a json\n    b int\nt2\n  c int');

      expect(model.entities[1].attributes.map(entry => entry.path)).toEqual([
        'c',
      ]);
    });
  });

  describe('inline relations', () => {
    it('fills the src from the owning attribute', () => {
      expect(firstRelation('t\n  a int -> u(b)')).toEqual({
        src: {
          namespace: { database: '', catalog: '', schema: '' },
          entityName: 't',
          attributePaths: ['a'],
        },
        ref: {
          namespace: { database: '', catalog: '', schema: '' },
          entityName: 'u',
          attributePaths: ['b'],
        },
        srcCardinality: 'n',
        refCardinality: '1',
        polymorphic: false,
      });
    });

    it('reads a one-to-one arrow', () => {
      expect(firstRelation('t\n  a int -- u(b)')).toMatchObject({
        srcCardinality: '1',
        refCardinality: '1',
      });
    });

    it('reads a many-to-many arrow', () => {
      expect(firstRelation('t\n  a int <> u(b)')).toMatchObject({
        srcCardinality: 'n',
        refCardinality: 'n',
      });
    });

    it('reads a reversed arrow', () => {
      expect(firstRelation('t\n  a int <- u(b)')).toMatchObject({
        srcCardinality: '1',
        refCardinality: 'n',
      });
    });

    it('leaves a natural ref with no attribute path', () => {
      expect(firstRelation('t\n  a int -> u').ref).toEqual({
        namespace: { database: '', catalog: '', schema: '' },
        entityName: 'u',
        attributePaths: [],
      });
    });

    it('reads a polymorphic arrow and drops the discriminator', () => {
      expect(firstRelation('t\n  a int -item_kind=User> u(b)')).toMatchObject({
        polymorphic: true,
        srcCardinality: 'n',
        refCardinality: '1',
      });
    });

    it('reads a polymorphic discriminator on a nested path', () => {
      expect(
        firstRelation('t\n  a int -meta.kind=User> u(b)').polymorphic
      ).toBe(true);
    });

    it('reads a schema on the ref', () => {
      expect(firstRelation('t\n  a int -> cms.u(b)').ref.namespace).toEqual({
        database: '',
        catalog: '',
        schema: 'cms',
      });
    });

    it('reads a nested attribute path on the ref', () => {
      expect(firstRelation('t\n  a int -> u(s.b)').ref.attributePaths).toEqual([
        's.b',
      ]);
    });

    it('dots the src path of a nested attribute', () => {
      expect(
        firstRelation('t\n  s json\n    p int -> u(id)').src.attributePaths
      ).toEqual(['s.p']);
    });

    it('carries the entity namespace into the src', () => {
      expect(
        firstRelation('namespace app\nt\n  a int -> u(b)').src.namespace
      ).toEqual({ database: '', catalog: '', schema: 'app' });
    });

    it('never defaults the ref namespace', () => {
      expect(
        firstRelation('namespace app\nt\n  a int -> u(b)').ref.namespace
      ).toEqual({ database: '', catalog: '', schema: '' });
    });

    it('keeps the attribute when the arrow has no target', () => {
      const model = parse('t\n  a int ->');

      expect(model.relations).toEqual([]);
      expect(model.entities[0].attributes[0].path).toBe('a');
    });

    it('reads relations in source order', () => {
      expect(
        relationsOf('t\n  a int -> u(b)\n  c int -> v(d)').map(
          relation => relation.ref.entityName
        )
      ).toEqual(['u', 'v']);
    });
  });

  describe('standalone relations', () => {
    it('reads the composite form', () => {
      expect(firstRelation('rel t(a, b) -> u(x, y)')).toMatchObject({
        src: { entityName: 't', attributePaths: ['a', 'b'] },
        ref: { entityName: 'u', attributePaths: ['x', 'y'] },
      });
    });

    it('reads a natural relation on both sides', () => {
      expect(firstRelation('rel t <> u')).toEqual({
        src: {
          namespace: { database: '', catalog: '', schema: '' },
          entityName: 't',
          attributePaths: [],
        },
        ref: {
          namespace: { database: '', catalog: '', schema: '' },
          entityName: 'u',
          attributePaths: [],
        },
        srcCardinality: 'n',
        refCardinality: 'n',
        polymorphic: false,
      });
    });

    it('reads a polymorphic standalone relation', () => {
      expect(
        firstRelation('rel c(item_id) -item_kind=User> u(id)')
      ).toMatchObject({
        polymorphic: true,
        src: { entityName: 'c', attributePaths: ['item_id'] },
        ref: { entityName: 'u', attributePaths: ['id'] },
      });
    });

    it('reads a quoted, schema-qualified endpoint', () => {
      expect(firstRelation('rel "a b"."c d"(x) -> u(y)').src).toMatchObject({
        namespace: { database: '', catalog: '', schema: 'a b' },
        entityName: 'c d',
      });
    });

    it('reads a catalog on the src', () => {
      expect(firstRelation('rel web.cms.t(a) -> u(b)').src.namespace).toEqual({
        database: '',
        catalog: 'web',
        schema: 'cms',
      });
    });

    it('defaults the src namespace when the src spells none', () => {
      expect(
        firstRelation('namespace app\nrel t(a) -> u(b)').src.namespace
      ).toEqual({ database: '', catalog: '', schema: 'app' });
    });

    it('leaves a spelled src namespace alone', () => {
      expect(
        firstRelation('namespace app\nrel s.t(a) -> u(b)').src.namespace
      ).toEqual({ database: '', catalog: '', schema: 's' });
    });

    it('drops a relation with no arrow', () => {
      expect(relationsOf('rel t(a) u(b)')).toEqual([]);
    });

    it('drops a relation with nothing after the keyword', () => {
      expect(relationsOf('rel')).toEqual([]);
    });

    it('drops the properties and records their keys', () => {
      expect(parse('rel t(a) -> u(b) {onDelete: cascade}').skipped).toEqual([
        'onDelete',
      ]);
    });
  });

  describe('types', () => {
    it('reads a type with no content', () => {
      expect(parse('type slug').types).toEqual({
        slug: { values: [], alias: '' },
      });
    });

    it('reads an alias', () => {
      expect(parse('type uid int').types.uid).toEqual({
        values: [],
        alias: 'int',
      });
    });

    it('reads an enum', () => {
      expect(parse('type status (draft, published)').types.status).toEqual({
        values: ['draft', 'published'],
        alias: '',
      });
    });

    it('registers a qualified type under both spellings', () => {
      expect(parse('type cms.post_status (draft)').types).toEqual({
        'cms.post_status': { values: ['draft'], alias: '' },
        post_status: { values: ['draft'], alias: '' },
      });
    });

    it('qualifies with the namespace in force', () => {
      expect(
        Object.keys(parse('namespace app\ntype status (a)').types)
      ).toEqual(['app.status', 'status']);
    });

    it('records a struct without its members', () => {
      const model = parse('type position {x int, y int}');

      expect(model.types.position).toEqual({ values: [], alias: '' });
      expect(model.skipped).toEqual(['struct type']);
    });

    it('records a custom type without its definition', () => {
      const model = parse('type box `(INPUT = lower)`');

      expect(model.types.box).toEqual({ values: [], alias: '' });
      expect(model.skipped).toEqual(['custom type']);
    });

    it('reads the properties after an alias', () => {
      const model = parse('type uid int {tags: [generic]}');

      expect(model.types.uid.alias).toBe('int');
      expect(model.skipped).toEqual(['tags']);
    });

    it('reads a doc without taking it for content', () => {
      expect(parse('type slug | anonymous type').types.slug).toEqual({
        values: [],
        alias: '',
      });
    });

    it('drops a type with no name', () => {
      expect(parse('type').types).toEqual({});
    });
  });

  describe('the AMLv1 dialect', () => {
    it('reads fk as the standalone relation keyword', () => {
      expect(firstRelation('fk t.a -> u.b')).toMatchObject({
        src: { entityName: 't', attributePaths: ['a'] },
        ref: { entityName: 'u', attributePaths: ['b'] },
      });
    });

    it('reads fk as an inline arrow', () => {
      expect(firstRelation('t\n  a int fk u.b')).toEqual({
        src: {
          namespace: { database: '', catalog: '', schema: '' },
          entityName: 't',
          attributePaths: ['a'],
        },
        ref: {
          namespace: { database: '', catalog: '', schema: '' },
          entityName: 'u',
          attributePaths: ['b'],
        },
        srcCardinality: 'n',
        refCardinality: '1',
        polymorphic: false,
      });
    });

    it('shifts one segment out of the namespace of a dotted ref', () => {
      expect(firstRelation('fk cms.t.a -> u.b').src).toEqual({
        namespace: { database: '', catalog: '', schema: 'cms' },
        entityName: 't',
        attributePaths: ['a'],
      });
    });

    it('reads a colon as the nested path separator', () => {
      expect(
        firstRelation('fk t.settings:slug -> u.b').src.attributePaths
      ).toEqual(['settings.slug']);
    });

    it('reads a colon path on a qualified ref', () => {
      expect(firstRelation('fk a.b -> cms.t.settings:slug').ref).toEqual({
        namespace: { database: '', catalog: '', schema: 'cms' },
        entityName: 't',
        attributePaths: ['settings.slug'],
      });
    });

    it('reads a bare entity name as a natural relation', () => {
      expect(firstRelation('t\n  a int fk u').ref.attributePaths).toEqual([]);
    });

    it('reads the asterisk view suffix', () => {
      const model = parse('admins*\n  id');

      expect(model.entities[0].name).toBe('admins');
      expect(model.skipped).toEqual(['view']);
    });

    it('reads = as the property separator', () => {
      expect(parse('t {color=red}').skipped).toEqual(['color']);
    });

    it('reads a quoted check predicate', () => {
      const model = parse('t\n  a int check="a > 0"');

      expect(model.skipped).toEqual(['check']);
      expect(model.entities[0].attributes[0].typeName).toBe('int');
    });
  });

  describe('malformed input', () => {
    it('never fails on a stray punctuation line', () => {
      expect(parseAMLModel('(((\n]]]\n').ok).toBe(true);
    });

    it('keeps the entities around a broken line', () => {
      expect(entityNames('a\n  x int\n===\nb\n  y int')).toEqual(['a', 'b']);
    });

    it('degrades an unterminated quote to the rest of the line', () => {
      expect(attribute('a "unterminated').typeName).toBe('unterminated');
    });

    it('tolerates an unclosed argument list', () => {
      expect(attribute('a status(draft').enumValues).toEqual(['draft']);
    });

    it('tolerates an unclosed property list', () => {
      expect(parse('t {color: red').skipped).toEqual(['color']);
    });

    it('tolerates a namespace with no name', () => {
      expect(firstEntity('namespace\nt').namespace).toEqual({
        database: '',
        catalog: '',
        schema: '',
      });
    });

    it('tolerates trailing garbage after the constraints', () => {
      expect(attribute('a int pk ??? ###').primaryKey).toBe(true);
    });
  });

  describe('the reference document', () => {
    const model = parse(FULL_AML);

    it('reads every entity in source order', () => {
      expect(model.entities.map(entry => entry.name)).toEqual([
        'users',
        'posts',
        'post_members',
        'post member details',
        'comments',
        'legacy_slug',
        'organizations',
        'profiles',
        'admins',
        'guests',
        'social_accounts',
      ]);
    });

    it('flattens the nested settings attribute', () => {
      expect(
        namedEntity(model, 'posts').attributes.map(entry => entry.path)
      ).toEqual([
        'id',
        'title',
        'status',
        'content',
        'settings',
        'settings.slug',
        'settings.publish_at',
        'settings.publish_by',
        'settings.tags',
        'settings.category',
        'settings.category.id',
        'settings.category.name',
        'created_at',
        'created_by',
      ]);
    });

    it('reads the entity alias and the entity comment', () => {
      expect(namedEntity(model, 'posts')).toMatchObject({
        alias: 'p',
        comment: 'entity in schema',
        namespace: { database: '', catalog: '', schema: 'cms' },
      });
    });

    it('reads the multiline doc of the comments entity', () => {
      expect(namedEntity(model, 'comments').comment).toBe(
        'a table with most options\nlooks quite complex but not intended to be used all together ^^'
      );
    });

    it('reads the last entity under the namespace in force', () => {
      expect(namedEntity(model, 'social_accounts')).toMatchObject({
        namespace: { database: '', catalog: 'social', schema: '' },
        comment: 'entity with no attribute',
      });
    });

    it('reads the escaped hash in a doc and the comment after it', () => {
      expect(
        namedEntity(model, 'comments').attributes.find(
          entry => entry.path === 'content'
        )
      ).toMatchObject({ typeName: '', comment: 'doc with # escaped' });
    });

    it('reads the keyword-named attribute and its default', () => {
      expect(
        namedEntity(model, 'post member details').attributes.map(
          entry => entry.path
        )
      ).toEqual(['post_id', 'user_id', 'index', 'added by']);
      expect(
        namedEntity(model, 'post member details').attributes[2].default
      ).toBe('0');
    });

    it('reads the inline enum of item_kind', () => {
      expect(
        namedEntity(model, 'comments').attributes.find(
          entry => entry.path === 'item_kind'
        )
      ).toMatchObject({
        typeName: 'comment_item',
        enumValues: ['User', 'Post'],
        indexes: [{ name: 'item', unique: false }],
      });
    });

    it('reads autoIncrement on the posts primary key', () => {
      expect(namedEntity(model, 'posts').attributes[0]).toMatchObject({
        primaryKey: true,
        autoIncrement: true,
      });
    });

    it('reads nullable only where it is written', () => {
      const attributes = namedEntity(model, 'posts').attributes;

      expect(
        attributes.filter(entry => !entry.notNull).map(entry => entry.path)
      ).toEqual(['content', 'settings']);
    });

    it('reads every relation in source order', () => {
      expect(
        model.relations.map(
          relation =>
            `${relation.src.entityName}(${relation.src.attributePaths.join(
              ','
            )}) ${relation.refCardinality}${relation.srcCardinality} ${
              relation.ref.entityName
            }(${relation.ref.attributePaths.join(',')})`
        )
      ).toEqual([
        'posts(settings.publish_by) 1n users(id)',
        'posts(created_by) 1n users(id)',
        'post_members(post_id) 1n posts(id)',
        'post_members(user_id) 1n users(id)',
        'post member details(added by) 1n users(id)',
        'post member details(post_id,user_id) 1n post_members(post_id,user_id)',
        'comments(created_by) 1n users()',
        'comments(item_id) 1n users(id)',
        'comments(item_id) 1n posts(id)',
        'legacy_slug(cur_slug) 1n p(settings.slug)',
        'organizations(id) nn users()',
        'profiles(id) 11 users(id)',
        'social_accounts() nn users()',
      ]);
    });

    it('marks only the two polymorphic relations', () => {
      expect(
        model.relations.filter(relation => relation.polymorphic)
      ).toHaveLength(2);
    });

    it('registers every type', () => {
      expect(model.types).toEqual({
        slug: { values: [], alias: '' },
        uid: { values: [], alias: 'int' },
        'cms.post_status': {
          values: ['draft', 'published', 'archived'],
          alias: '',
        },
        post_status: {
          values: ['draft', 'published', 'archived'],
          alias: '',
        },
        position: { values: [], alias: '' },
        box: { values: [], alias: '' },
      });
    });

    it('records every dropped construct once', () => {
      expect(model.skipped).toEqual([
        'check',
        'tags',
        'color',
        'onDelete',
        'view',
        'struct type',
        'custom type',
      ]);
    });
  });

  describe('the AMLv1 reference document', () => {
    const model = parse(LEGACY_AML);

    it('reads the same entities as the AMLv2 spelling', () => {
      expect(model.entities.map(entry => entry.name)).toEqual([
        'users',
        'posts',
        'post_members',
        'post member details',
        'comments',
        'legacy_slug',
        'organizations',
        'profiles',
        'admins',
        'guests',
        'social_accounts',
      ]);
    });

    it('reads the same users attributes as the AMLv2 spelling', () => {
      expect(
        namedEntity(model, 'users').attributes.map(entry => entry.path)
      ).toEqual(
        namedEntity(parse(FULL_AML), 'users').attributes.map(
          entry => entry.path
        )
      );
    });

    it('reads every relation in source order', () => {
      expect(
        model.relations.map(
          relation =>
            `${relation.src.entityName}(${relation.src.attributePaths.join(
              ','
            )}) ${relation.refCardinality}${relation.srcCardinality} ${
              relation.ref.entityName
            }(${relation.ref.attributePaths.join(',')})`
        )
      ).toEqual([
        'posts(created_by) 1n users(id)',
        'post_members(post_id) 1n posts(id)',
        'post_members(user_id) 1n users(id)',
        'post member details(added by) 1n users(id)',
        'post member details(post_id) 1n post_members(post_id)',
        'post member details(user_id) 1n post_members(user_id)',
        'comments(created_by) 1n users(id)',
        'comments(item_id) 1n users(id)',
        'comments(item_id) 1n posts(id)',
        'legacy_slug(cur_slug) 1n posts(settings.slug)',
        'organizations(id) 1n users(id)',
        'profiles(id) 1n users(id)',
      ]);
    });

    it('reads the schema of the legacy standalone relations', () => {
      expect(model.relations[4].src.namespace).toEqual({
        database: '',
        catalog: '',
        schema: 'legacy schema',
      });
      expect(model.relations[9].ref.namespace).toEqual({
        database: '',
        catalog: '',
        schema: 'cms',
      });
    });

    it('reads the inline enum the same way', () => {
      expect(
        namedEntity(model, 'comments').attributes.find(
          entry => entry.path === 'item_kind'
        )
      ).toMatchObject({
        typeName: 'comment_item',
        enumValues: ['User', 'Post'],
      });
    });

    it('reads the asterisk views as entities', () => {
      expect(
        namedEntity(model, 'admins').attributes.map(entry => entry.path)
      ).toEqual(['id', 'first_name', 'last_name', 'email']);
      expect(namedEntity(model, 'guests').attributes).toEqual([]);
    });

    it('records the dropped constructs of the v1 spelling', () => {
      expect(model.skipped).toEqual(['check', 'view']);
    });

    it('declares no type', () => {
      expect(model.types).toEqual({});
    });
  });
});
