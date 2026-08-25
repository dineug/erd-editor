import { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import {
  ColumnOption,
  ColumnUIKey,
  Database,
  OrderType,
  RelationshipType,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { Column, Table } from '@/internal-types';
import { convertToSchema } from '@/utils/schema-aml-parser/convert';
import {
  AMLAttribute,
  AMLCardinality,
  AMLEndpoint,
  AMLEntity,
  AMLModel,
  AMLNamespace,
  AMLRelation,
  EMPTY_NAMESPACE,
} from '@/utils/schema-aml-parser/types';

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

const EMPTY_MODEL: AMLModel = {
  entities: [],
  relations: [],
  types: {},
  skipped: [],
};

function convert(
  model: Partial<AMLModel>,
  database: number = Database.MySQL
): ERDEditorSchemaV3 {
  return convertToSchema({ ...EMPTY_MODEL, ...model }, ctx, database);
}

const ns = (namespace: Partial<AMLNamespace>): AMLNamespace => ({
  ...EMPTY_NAMESPACE,
  ...namespace,
});

const attr = (
  path: string,
  attribute: Partial<AMLAttribute> = {}
): AMLAttribute => ({
  path,
  comment: '',
  typeName: '',
  enumValues: [],
  notNull: false,
  primaryKey: false,
  indexes: [],
  default: '',
  autoIncrement: false,
  ...attribute,
});

const entity = (name: string, source: Partial<AMLEntity> = {}): AMLEntity => ({
  namespace: EMPTY_NAMESPACE,
  name,
  alias: '',
  comment: '',
  attributes: [],
  ...source,
});

const at = (
  entityName: string,
  attributePaths: string[] = [],
  namespace: AMLNamespace = EMPTY_NAMESPACE
): AMLEndpoint => ({ namespace, entityName, attributePaths });

/** `[srcCardinality, refCardinality]`, in the order the arrow spells them. */
const ARROWS: Record<string, [AMLCardinality, AMLCardinality]> = {
  '->': ['1', 'n'],
  '--': ['1', '1'],
  '<-': ['n', '1'],
  '<>': ['n', 'n'],
};

function rel(
  src: AMLEndpoint,
  arrow: string,
  ref: AMLEndpoint,
  polymorphic = false
): AMLRelation {
  const [srcCardinality, refCardinality] = ARROWS[arrow];

  return { src, ref, srcCardinality, refCardinality, polymorphic };
}

const tablesOf = (schema: ERDEditorSchemaV3): Table[] =>
  schema.doc.tableIds.map(id => schema.collections.tableEntities[id]);

const tableNames = (schema: ERDEditorSchemaV3): string[] =>
  tablesOf(schema).map(table => table.name);

function tableOf(schema: ERDEditorSchemaV3, name: string): Table {
  const table = tablesOf(schema).find(entry => entry.name === name);
  if (!table) throw new Error(`no table named ${name}`);
  return table;
}

const columnsOf = (schema: ERDEditorSchemaV3, name: string): Column[] =>
  tableOf(schema, name).columnIds.map(
    id => schema.collections.tableColumnEntities[id]
  );

function columnOf(
  schema: ERDEditorSchemaV3,
  tableName: string,
  columnName: string
): Column {
  const column = columnsOf(schema, tableName).find(
    entry => entry.name === columnName
  );
  if (!column) throw new Error(`no column named ${columnName}`);
  return column;
}

const relationshipsOf = (schema: ERDEditorSchemaV3) =>
  schema.doc.relationshipIds.map(
    id => schema.collections.relationshipEntities[id]
  );

const edgesOf = (schema: ERDEditorSchemaV3): string[] =>
  relationshipsOf(schema).map(relationship => {
    const names = (tableId: string, columnIds: string[]) =>
      `${schema.collections.tableEntities[tableId].name}(${columnIds
        .map(id => schema.collections.tableColumnEntities[id].name)
        .join(',')})`;

    return `${names(
      relationship.start.tableId,
      relationship.start.columnIds
    )} -> ${names(relationship.end.tableId, relationship.end.columnIds)}`;
  });

const indexesOf = (schema: ERDEditorSchemaV3) =>
  schema.doc.indexIds.map(id => schema.collections.indexEntities[id]);

const indexColumnNames = (schema: ERDEditorSchemaV3, indexId: string) =>
  schema.collections.indexEntities[indexId].indexColumnIds.map(
    id =>
      schema.collections.tableColumnEntities[
        schema.collections.indexColumnEntities[id].columnId
      ].name
  );

const USERS = entity('users', {
  attributes: [
    attr('id', { typeName: 'int', primaryKey: true, notNull: true }),
  ],
});
const POSTS = entity('posts', {
  attributes: [attr('user_id', { typeName: 'int' })],
});

describe('schema-aml-parser/convert', () => {
  it('produces an empty document for an empty model', () => {
    const schema = convert({});

    expect(schema.doc.tableIds).toEqual([]);
    expect(schema.doc.relationshipIds).toEqual([]);
    expect(schema.doc.indexIds).toEqual([]);
  });

  describe('entities', () => {
    it('registers the entity under doc and collections', () => {
      const schema = convert({ entities: [USERS] });

      expect(tableNames(schema)).toEqual(['users']);
      expect(schema.doc.tableIds).toHaveLength(1);
    });

    it('carries the entity doc as the table comment', () => {
      const schema = convert({
        entities: [entity('users', { comment: 'people' })],
      });

      expect(tableOf(schema, 'users').comment).toBe('people');
    });

    it('measures the name and the comment', () => {
      const schema = convert({
        entities: [entity('user_account', { comment: 'the people table' })],
      });
      const table = tableOf(schema, 'user_account');

      expect(table.ui.widthName).toBe(120);
      expect(table.ui.widthComment).toBe(160);
    });

    it('never measures below the column minimum', () => {
      const schema = convert({ entities: [entity('u')] });

      expect(tableOf(schema, 'u').ui.widthName).toBe(COLUMN_MIN_WIDTH);
    });

    it('fills seqColumnIds alongside columnIds', () => {
      const schema = convert({
        entities: [entity('users', { attributes: [attr('id'), attr('name')] })],
      });
      const table = tableOf(schema, 'users');

      expect(table.seqColumnIds).toEqual(table.columnIds);
      expect(table.columnIds).toHaveLength(2);
    });

    it('keeps an entity with no attribute at all', () => {
      const schema = convert({ entities: [entity('social_accounts')] });

      expect(columnsOf(schema, 'social_accounts')).toEqual([]);
    });
  });

  describe('namespace qualification', () => {
    it('drops the namespace when every entity shares it', () => {
      const schema = convert({
        entities: [
          entity('users', { namespace: ns({ schema: 'cms' }) }),
          entity('posts', { namespace: ns({ schema: 'cms' }) }),
        ],
      });

      expect(tableNames(schema)).toEqual(['users', 'posts']);
    });

    it('prefixes the namespace when the document declares several', () => {
      const schema = convert({
        entities: [
          entity('users', { namespace: ns({ schema: 'a' }) }),
          entity('users', { namespace: ns({ schema: 'b' }) }),
        ],
      });

      expect(tableNames(schema)).toEqual(['a_users', 'b_users']);
    });

    it('leaves the entity with no namespace bare beside a qualified one', () => {
      const schema = convert({
        entities: [
          entity('users'),
          entity('users', { namespace: ns({ schema: 'b' }) }),
        ],
      });

      expect(tableNames(schema)).toEqual(['users', 'b_users']);
    });

    it('joins all three namespace segments into the prefix', () => {
      const schema = convert({
        entities: [
          entity('legacy_slug', {
            namespace: ns({
              database: 'db1',
              catalog: 'web',
              schema: 'public',
            }),
          }),
          entity('users'),
        ],
      });

      expect(tableNames(schema)).toEqual([
        'db1_web_public_legacy_slug',
        'users',
      ]);
    });

    it('keeps a partly filled namespace apart from a differently filled one', () => {
      const schema = convert({
        entities: [
          entity('profiles', { namespace: ns({ database: 'identity' }) }),
          entity('profiles', { namespace: ns({ schema: 'identity' }) }),
        ],
      });

      expect(tablesOf(schema)).toHaveLength(2);
      expect(tableNames(schema)).toEqual([
        'identity_profiles',
        'identity_profiles',
      ]);
    });
  });

  describe('attributes', () => {
    const columnFrom = (attribute: Partial<AMLAttribute>): Column => {
      const schema = convert({
        entities: [entity('t', { attributes: [attr('a', attribute)] })],
      });

      return columnOf(schema, 't', 'a');
    };

    it('reads the resolved not null flag without inverting it', () => {
      expect(columnFrom({ notNull: true }).options).toBe(ColumnOption.notNull);
    });

    it('leaves a nullable attribute with no option at all', () => {
      expect(columnFrom({ notNull: false }).options).toBe(0);
    });

    it('reads pk, auto increment and not null into the bitmask', () => {
      expect(
        columnFrom({ primaryKey: true, autoIncrement: true, notNull: true })
          .options
      ).toBe(
        ColumnOption.primaryKey |
          ColumnOption.autoIncrement |
          ColumnOption.notNull
      );
    });

    it('writes the primary key bit into ui.keys as well as options', () => {
      expect(columnFrom({ primaryKey: true }).ui.keys).toBe(
        ColumnUIKey.primaryKey
      );
    });

    it('leaves ui.keys clear on an ordinary attribute', () => {
      expect(columnFrom({}).ui.keys).toBe(0);
    });

    it('carries the type, the default and the doc', () => {
      expect(
        columnFrom({
          typeName: 'varchar(10)',
          default: 'author',
          comment: 'the a column',
        })
      ).toMatchObject({
        dataType: 'varchar(10)',
        default: 'author',
        comment: 'the a column',
      });
    });

    it('measures the type and the default', () => {
      const column = columnFrom({ typeName: 'varchar(50)', default: 'x' });

      expect(column.ui.widthDataType).toBe(110);
      expect(column.ui.widthDefault).toBe(COLUMN_MIN_WIDTH);
    });

    it('names a nested attribute by its dotted path', () => {
      const schema = convert({
        entities: [
          entity('posts', {
            attributes: [attr('settings'), attr('settings.slug')],
          }),
        ],
      });

      expect(columnsOf(schema, 'posts').map(column => column.name)).toEqual([
        'settings',
        'settings.slug',
      ]);
    });

    it('reads a bare unique as the column flag', () => {
      expect(
        columnFrom({ indexes: [{ name: '', unique: true }] }).options
      ).toBe(ColumnOption.unique);
    });

    it('keeps the bare unique out of the index list', () => {
      const schema = convert({
        entities: [
          entity('t', {
            attributes: [attr('a', { indexes: [{ name: '', unique: true }] })],
          }),
        ],
      });

      expect(indexesOf(schema)).toEqual([]);
    });

    it('leaves the unique flag clear for a named unique constraint', () => {
      expect(
        columnFrom({ indexes: [{ name: 'name', unique: true }] }).options
      ).toBe(0);
    });
  });

  describe('types', () => {
    const ENUM_ENTITY = entity('orders', {
      attributes: [attr('state', { typeName: 'post_status' })],
    });
    const ENUM_TYPES = {
      post_status: { values: ['draft', 'published'], alias: '' },
    };

    it('spells the members out on a dialect with an enum column', () => {
      const schema = convert(
        { entities: [ENUM_ENTITY], types: ENUM_TYPES },
        Database.MySQL
      );

      expect(columnOf(schema, 'orders', 'state')).toMatchObject({
        dataType: "ENUM('draft','published')",
        comment: '',
      });
    });

    it.each([
      [Database.MSSQL, 'varchar(255)'],
      [Database.Oracle, 'VARCHAR2(255)'],
      [Database.PostgreSQL, 'varchar(255)'],
      [Database.SQLite, 'TEXT'],
      [Database.Databricks, 'STRING'],
      [Database.Snowflake, 'VARCHAR(255)'],
    ])(
      'falls back to %s string type and keeps the members in the comment',
      (database, dataType) => {
        const schema = convert(
          { entities: [ENUM_ENTITY], types: ENUM_TYPES },
          database
        );

        expect(columnOf(schema, 'orders', 'state')).toMatchObject({
          dataType,
          comment: 'post_status: draft | published',
        });
      }
    );

    it('reads inline enum members off the attribute itself', () => {
      const schema = convert(
        {
          entities: [
            entity('comments', {
              attributes: [
                attr('item_kind', {
                  typeName: 'comment_item',
                  enumValues: ['User', 'Post'],
                }),
              ],
            }),
          ],
        },
        Database.MySQL
      );

      expect(columnOf(schema, 'comments', 'item_kind').dataType).toBe(
        "ENUM('User','Post')"
      );
    });

    it('walks an alias type down to the name it stands for', () => {
      const schema = convert({
        entities: [
          entity('users', { attributes: [attr('id', { typeName: 'uid' })] }),
        ],
        types: { uid: { values: [], alias: 'int' } },
      });

      expect(columnOf(schema, 'users', 'id').dataType).toBe('int');
    });

    it('appends the members to a doc the attribute already carries', () => {
      const schema = convert(
        {
          entities: [
            entity('orders', {
              attributes: [
                attr('state', {
                  typeName: 'post_status',
                  comment: 'lifecycle',
                }),
              ],
            }),
          ],
          types: { post_status: { values: ['draft'], alias: '' } },
        },
        Database.PostgreSQL
      );

      expect(columnOf(schema, 'orders', 'state').comment).toBe(
        'lifecycle post_status: draft'
      );
    });

    it('measures the resolved type rather than the name it was written as', () => {
      const schema = convert(
        {
          entities: [ENUM_ENTITY],
          types: ENUM_TYPES,
        },
        Database.SQLite
      );

      expect(columnOf(schema, 'orders', 'state').ui.widthDataType).toBe(
        COLUMN_MIN_WIDTH
      );
    });
  });

  describe('indexes', () => {
    const indexedEntity = (...attributes: AMLAttribute[]) =>
      convert({ entities: [entity('users', { attributes })] });

    it('registers a named index with its name', () => {
      const schema = indexedEntity(
        attr('name', { indexes: [{ name: 'idx_user', unique: false }] })
      );

      expect(indexesOf(schema)[0]).toMatchObject({
        name: 'idx_user',
        unique: false,
      });
    });

    it('registers a named unique constraint as a unique index', () => {
      const schema = indexedEntity(
        attr('name', { indexes: [{ name: 'uq_user', unique: true }] })
      );

      expect(indexesOf(schema)[0]).toMatchObject({
        name: 'uq_user',
        unique: true,
      });
    });

    it('groups the attributes that named the same index', () => {
      const schema = indexedEntity(
        attr('first_name', { indexes: [{ name: 'name', unique: true }] }),
        attr('last_name', { indexes: [{ name: 'name', unique: true }] })
      );
      const indexes = indexesOf(schema);

      expect(indexes).toHaveLength(1);
      expect(indexColumnNames(schema, indexes[0].id)).toEqual([
        'first_name',
        'last_name',
      ]);
    });

    it('marks the group unique when any member said so', () => {
      const schema = indexedEntity(
        attr('a', { indexes: [{ name: 'item', unique: true }] }),
        attr('b', { indexes: [{ name: 'item', unique: false }] })
      );

      expect(indexesOf(schema)[0].unique).toBe(true);
    });

    it('gives an unnamed index a group of its own', () => {
      const schema = indexedEntity(
        attr('a', { indexes: [{ name: '', unique: false }] }),
        attr('b', { indexes: [{ name: '', unique: false }] })
      );

      expect(
        indexesOf(schema).map(index => indexColumnNames(schema, index.id))
      ).toEqual([['a'], ['b']]);
    });

    it('keeps two attributes of one entity in several indexes at once', () => {
      const schema = indexedEntity(
        attr('a', {
          indexes: [
            { name: '', unique: true },
            { name: 'item', unique: false },
          ],
        }),
        attr('b', { indexes: [{ name: 'item', unique: false }] })
      );

      expect(columnOf(schema, 'users', 'a').options).toBe(ColumnOption.unique);
      expect(indexColumnNames(schema, indexesOf(schema)[0].id)).toEqual([
        'a',
        'b',
      ]);
    });

    it('fills seqIndexColumnIds alongside indexColumnIds', () => {
      const schema = indexedEntity(
        attr('a', { indexes: [{ name: 'item', unique: false }] })
      );
      const index = indexesOf(schema)[0];

      expect(index.seqIndexColumnIds).toEqual(index.indexColumnIds);
    });

    it('orders every index column ascending, which is all AML states', () => {
      const schema = indexedEntity(
        attr('a', { indexes: [{ name: 'item', unique: false }] }),
        attr('b', { indexes: [{ name: 'item', unique: false }] })
      );

      expect(
        Object.values(schema.collections.indexColumnEntities).map(
          indexColumn => indexColumn.orderType
        )
      ).toEqual([OrderType.ASC, OrderType.ASC]);
    });

    it('binds the index to the entity that declared it', () => {
      const schema = convert({
        entities: [
          entity('users', {
            attributes: [attr('a', { indexes: [{ name: '', unique: false }] })],
          }),
          entity('posts', {
            attributes: [attr('b', { indexes: [{ name: '', unique: false }] })],
          }),
        ],
      });

      expect(
        indexesOf(schema).map(
          index => schema.collections.tableEntities[index.tableId].name
        )
      ).toEqual(['users', 'posts']);
    });

    it('keeps the same index name in two entities apart', () => {
      const schema = convert({
        entities: [
          entity('users', {
            attributes: [
              attr('a', { indexes: [{ name: 'item', unique: false }] }),
            ],
          }),
          entity('posts', {
            attributes: [
              attr('b', { indexes: [{ name: 'item', unique: false }] }),
            ],
          }),
        ],
      });

      expect(indexesOf(schema)).toHaveLength(2);
    });
  });

  describe('relations', () => {
    const twoTables = (relations: AMLRelation[], child = POSTS) => ({
      entities: [USERS, child],
      relations,
    });

    it('makes the referencing attribute the child', () => {
      const schema = convert(
        twoTables([rel(at('posts', ['user_id']), '->', at('users', ['id']))])
      );

      expect(edgesOf(schema)).toEqual(['users(id) -> posts(user_id)']);
    });

    it('marks the child attribute as a foreign key', () => {
      const schema = convert(
        twoTables([rel(at('posts', ['user_id']), '->', at('users', ['id']))])
      );

      expect(columnOf(schema, 'posts', 'user_id').ui.keys).toBe(
        ColumnUIKey.foreignKey
      );
    });

    it('leaves a non-key child relation unidentifying', () => {
      const schema = convert(
        twoTables([rel(at('posts', ['user_id']), '->', at('users', ['id']))])
      );

      expect(relationshipsOf(schema)[0].identification).toBe(false);
    });

    it('keeps the primary key bit on a child attribute that is also a key', () => {
      const schema = convert({
        entities: [
          USERS,
          entity('profiles', {
            attributes: [
              attr('user_id', {
                typeName: 'int',
                primaryKey: true,
                notNull: true,
              }),
            ],
          }),
        ],
        relations: [
          rel(at('profiles', ['user_id']), '--', at('users', ['id'])),
        ],
      });

      expect(columnOf(schema, 'profiles', 'user_id').ui.keys).toBe(
        ColumnUIKey.primaryKey | ColumnUIKey.foreignKey
      );
      expect(relationshipsOf(schema)[0].identification).toBe(true);
    });

    it.each([
      ['->', false, RelationshipType.ZeroN],
      ['->', true, RelationshipType.OneN],
      ['--', false, RelationshipType.ZeroOne],
      ['--', true, RelationshipType.OneOnly],
    ])(
      'reads %s with a %s child attribute as the matching cardinality',
      (arrow, notNull, expected) => {
        const schema = convert({
          entities: [
            USERS,
            entity('posts', {
              attributes: [attr('user_id', { typeName: 'int', notNull })],
            }),
          ],
          relations: [
            rel(at('posts', ['user_id']), arrow, at('users', ['id'])),
          ],
        });

        expect(relationshipsOf(schema)[0].relationshipType).toBe(expected);
      }
    );

    it('reads a composite relation as two positional lists', () => {
      const schema = convert({
        entities: [
          entity('post_members', {
            attributes: [
              attr('post_id', { primaryKey: true }),
              attr('user_id', { primaryKey: true }),
            ],
          }),
          entity('details', {
            attributes: [attr('post_id'), attr('user_id')],
          }),
        ],
        relations: [
          rel(
            at('details', ['post_id', 'user_id']),
            '->',
            at('post_members', ['post_id', 'user_id'])
          ),
        ],
      });

      expect(edgesOf(schema)).toEqual([
        'post_members(post_id,user_id) -> details(post_id,user_id)',
      ]);
    });

    it('resolves an endpoint written against the alias', () => {
      const schema = convert({
        entities: [
          entity('posts', {
            alias: 'p',
            namespace: ns({ schema: 'cms' }),
            attributes: [attr('settings.slug', { typeName: 'string' })],
          }),
          entity('legacy_slug', {
            attributes: [attr('cur_slug', { typeName: 'varchar' })],
          }),
        ],
        relations: [
          rel(
            at('legacy_slug', ['cur_slug']),
            '->',
            at('p', ['settings.slug'])
          ),
        ],
      });

      expect(edgesOf(schema)).toEqual([
        'cms_posts(settings.slug) -> legacy_slug(cur_slug)',
      ]);
    });

    it('resolves a namespace-qualified endpoint against the right entity', () => {
      const schema = convert({
        entities: [
          entity('users', {
            namespace: ns({ schema: 'a' }),
            attributes: [attr('id', { primaryKey: true })],
          }),
          entity('users', {
            namespace: ns({ schema: 'b' }),
            attributes: [attr('id', { primaryKey: true })],
          }),
          POSTS,
        ],
        relations: [
          rel(
            at('posts', ['user_id']),
            '->',
            at('users', ['id'], ns({ schema: 'b' }))
          ),
        ],
      });

      expect(edgesOf(schema)).toEqual(['b_users(id) -> posts(user_id)']);
    });

    it('resolves an unqualified endpoint against the qualified entity', () => {
      const schema = convert({
        entities: [
          entity('users', {
            namespace: ns({ schema: 'cms' }),
            attributes: [attr('id', { primaryKey: true })],
          }),
          POSTS,
        ],
        relations: [rel(at('posts', ['user_id']), '->', at('users', ['id']))],
      });

      expect(edgesOf(schema)).toEqual(['cms_users(id) -> posts(user_id)']);
    });

    it('resolves a nested attribute through its dotted path', () => {
      const schema = convert({
        entities: [
          entity('posts', {
            attributes: [
              attr('payload'),
              attr('payload.entities'),
              attr('payload.entities.id', { primaryKey: true }),
            ],
          }),
          entity('details', { attributes: [attr('post_id')] }),
        ],
        relations: [
          rel(
            at('details', ['post_id']),
            '->',
            at('posts', ['payload.entities.id'])
          ),
        ],
      });

      expect(edgesOf(schema)).toEqual([
        'posts(payload.entities.id) -> details(post_id)',
      ]);
    });

    it('reads a self-referential relation', () => {
      const schema = convert({
        entities: [
          entity('node', {
            attributes: [
              attr('id', { primaryKey: true, notNull: true }),
              attr('parent_id'),
            ],
          }),
        ],
        relations: [rel(at('node', ['parent_id']), '->', at('node', ['id']))],
      });

      expect(edgesOf(schema)).toEqual(['node(id) -> node(parent_id)']);
    });

    it('drops the second relation between the same child attributes', () => {
      const relation = rel(at('posts', ['user_id']), '->', at('users', ['id']));
      const schema = convert(twoTables([relation, relation]));

      expect(relationshipsOf(schema)).toHaveLength(1);
    });

    it('keeps two relations between one pair of entities on other attributes', () => {
      const schema = convert({
        entities: [
          entity('users', {
            attributes: [
              attr('id', { primaryKey: true }),
              attr('code', { primaryKey: true }),
            ],
          }),
          entity('posts', {
            attributes: [attr('author_id'), attr('editor_code')],
          }),
        ],
        relations: [
          rel(at('posts', ['author_id']), '->', at('users', ['id'])),
          rel(at('posts', ['editor_code']), '->', at('users', ['code'])),
        ],
      });

      expect(edgesOf(schema)).toEqual([
        'users(id) -> posts(author_id)',
        'users(code) -> posts(editor_code)',
      ]);
    });

    it('drops a relation naming an entity that is not there', () => {
      const schema = convert(
        twoTables([rel(at('posts', ['user_id']), '->', at('missing', ['id']))])
      );

      expect(relationshipsOf(schema)).toEqual([]);
    });

    it('drops a relation naming an attribute that is not there', () => {
      const schema = convert(
        twoTables([
          rel(at('posts', ['user_id']), '->', at('users', ['missing'])),
        ])
      );

      expect(relationshipsOf(schema)).toEqual([]);
    });

    it('drops a relation whose sides name a different number of attributes', () => {
      const schema = convert({
        entities: [
          entity('a', { attributes: [attr('x'), attr('y')] }),
          entity('b', { attributes: [attr('p')] }),
        ],
        relations: [rel(at('b', ['p']), '->', at('a', ['x', 'y']))],
      });

      expect(relationshipsOf(schema)).toEqual([]);
    });

    it('drops a relation whose namespace names no entity', () => {
      const schema = convert(
        twoTables([
          rel(
            at('posts', ['user_id']),
            '->',
            at('users', ['id'], ns({ schema: 'other' }))
          ),
        ])
      );

      expect(relationshipsOf(schema)).toEqual([]);
    });
  });

  describe('natural relations', () => {
    it('resolves an empty attribute list to the target primary key', () => {
      const schema = convert({
        entities: [USERS, POSTS],
        relations: [rel(at('posts', ['user_id']), '->', at('users'))],
      });

      expect(edgesOf(schema)).toEqual(['users(id) -> posts(user_id)']);
    });

    it('resolves a composite primary key on the target side', () => {
      const schema = convert({
        entities: [
          entity('post_members', {
            attributes: [
              attr('post_id', { primaryKey: true }),
              attr('user_id', { primaryKey: true }),
            ],
          }),
          entity('details', {
            attributes: [attr('post_id'), attr('user_id')],
          }),
        ],
        relations: [
          rel(at('details', ['post_id', 'user_id']), '->', at('post_members')),
        ],
      });

      expect(edgesOf(schema)).toEqual([
        'post_members(post_id,user_id) -> details(post_id,user_id)',
      ]);
    });

    it('resolves an empty attribute list on the referencing side too', () => {
      const schema = convert({
        entities: [
          USERS,
          entity('profiles', {
            attributes: [attr('id', { primaryKey: true, notNull: true })],
          }),
        ],
        relations: [rel(at('profiles'), '--', at('users'))],
      });

      expect(edgesOf(schema)).toEqual(['users(id) -> profiles(id)']);
    });

    it('drops a natural relation whose target has no primary key', () => {
      const schema = convert({
        entities: [entity('users', { attributes: [attr('id')] }), POSTS],
        relations: [rel(at('posts', ['user_id']), '->', at('users'))],
      });

      expect(relationshipsOf(schema)).toEqual([]);
    });
  });

  describe('inherited types', () => {
    const TYPED_USERS = entity('users', {
      attributes: [
        attr('id', {
          typeName: 'varchar(255)',
          primaryKey: true,
          notNull: true,
        }),
      ],
    });

    it('takes the target type where the attribute declared none', () => {
      const schema = convert({
        entities: [
          TYPED_USERS,
          entity('comments', { attributes: [attr('created_by')] }),
        ],
        relations: [rel(at('comments', ['created_by']), '->', at('users'))],
      });

      expect(columnOf(schema, 'comments', 'created_by').dataType).toBe(
        'varchar(255)'
      );
    });

    it('measures the type it inherited', () => {
      const schema = convert({
        entities: [
          TYPED_USERS,
          entity('comments', { attributes: [attr('created_by')] }),
        ],
        relations: [rel(at('comments', ['created_by']), '->', at('users'))],
      });

      expect(columnOf(schema, 'comments', 'created_by').ui.widthDataType).toBe(
        120
      );
    });

    it('leaves a declared type alone', () => {
      const schema = convert({
        entities: [
          TYPED_USERS,
          entity('comments', {
            attributes: [attr('created_by', { typeName: 'int' })],
          }),
        ],
        relations: [rel(at('comments', ['created_by']), '->', at('users'))],
      });

      expect(columnOf(schema, 'comments', 'created_by').dataType).toBe('int');
    });

    it('inherits nothing where the target type is empty as well', () => {
      const schema = convert({
        entities: [
          entity('users', { attributes: [attr('id', { primaryKey: true })] }),
          entity('comments', { attributes: [attr('created_by')] }),
        ],
        relations: [rel(at('comments', ['created_by']), '->', at('users'))],
      });

      expect(columnOf(schema, 'comments', 'created_by').dataType).toBe('');
    });
  });

  describe('polymorphic relations', () => {
    const POLYMORPHIC = {
      entities: [
        USERS,
        entity('posts', {
          attributes: [
            attr('id', { typeName: 'int', primaryKey: true, notNull: true }),
          ],
        }),
        entity('comments', {
          attributes: [attr('item_kind'), attr('item_id', { typeName: 'int' })],
        }),
      ],
      relations: [
        rel(at('comments', ['item_id']), '->', at('users', ['id']), true),
        rel(at('comments', ['item_id']), '->', at('posts', ['id']), true),
      ],
    };

    it('keeps both edges out of one discriminated attribute', () => {
      expect(edgesOf(convert(POLYMORPHIC))).toEqual([
        'users(id) -> comments(item_id)',
        'posts(id) -> comments(item_id)',
      ]);
    });

    it('drops the discriminator, which the diagram has no slot for', () => {
      const schema = convert(POLYMORPHIC);

      expect(columnOf(schema, 'comments', 'item_kind').ui.keys).toBe(0);
    });
  });

  describe('many-to-many', () => {
    const MANY = {
      entities: [
        USERS,
        entity('organizations', {
          attributes: [
            attr('id', { typeName: 'int', primaryKey: true, notNull: true }),
          ],
        }),
      ],
      relations: [rel(at('organizations', ['id']), '<>', at('users', ['id']))],
    };

    it('invents the junction table the diagram has no other way to hold', () => {
      expect(tableNames(convert(MANY))).toEqual([
        'users',
        'organizations',
        'organizations_users',
      ]);
    });

    it('says in the diagram that the table was inferred', () => {
      expect(tableOf(convert(MANY), 'organizations_users').comment).toBe(
        'Junction table inferred from organizations <-> users'
      );
    });

    it('gives the junction a key column per parent key', () => {
      expect(
        columnsOf(convert(MANY), 'organizations_users').map(column => [
          column.name,
          column.dataType,
          column.options,
        ])
      ).toEqual([
        [
          'organizations_id',
          'int',
          ColumnOption.primaryKey | ColumnOption.notNull,
        ],
        ['users_id', 'int', ColumnOption.primaryKey | ColumnOption.notNull],
      ]);
    });

    it('binds the junction to both parents', () => {
      expect(edgesOf(convert(MANY))).toEqual([
        'organizations(id) -> organizations_users(organizations_id)',
        'users(id) -> organizations_users(users_id)',
      ]);
    });

    it('reads a natural many-to-many off the primary keys of both sides', () => {
      const schema = convert({
        entities: [
          USERS,
          entity('social_accounts', {
            attributes: [
              attr('id', { typeName: 'int', primaryKey: true, notNull: true }),
            ],
          }),
        ],
        relations: [rel(at('social_accounts'), '<>', at('users'))],
      });

      expect(tableNames(schema)).toEqual([
        'users',
        'social_accounts',
        'social_accounts_users',
      ]);
    });

    it('drops a many-to-many whose parent has no key', () => {
      const schema = convert({
        entities: [entity('users', { attributes: [attr('id')] }), POSTS],
        relations: [rel(at('posts', ['user_id']), '<>', at('users', ['id']))],
      });

      expect(tableNames(schema)).toEqual(['users', 'posts']);
    });
  });
});
