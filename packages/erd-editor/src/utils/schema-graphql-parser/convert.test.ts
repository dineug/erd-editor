import { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  Database,
  OrderType,
  RelationshipType,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { Column, Table } from '@/internal-types';
import { convertToSchema } from '@/utils/schema-graphql-parser/convert';
import { parseGraphQLModel } from '@/utils/schema-graphql-parser/parser';

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

function convert(
  sdl: string,
  database: number = Database.PostgreSQL
): ERDEditorSchemaV3 {
  const result = parseGraphQLModel(sdl);
  if (!result.ok) throw new Error(result.message);
  return convertToSchema(result.model, ctx, database);
}

const tablesOf = (schema: ERDEditorSchemaV3): Table[] =>
  schema.doc.tableIds.map(id => schema.collections.tableEntities[id]);

const tableNames = (schema: ERDEditorSchemaV3): string[] =>
  tablesOf(schema).map(table => table.name);

function tableByName(schema: ERDEditorSchemaV3, name: string): Table {
  const table = tablesOf(schema).find(table => table.name === name);
  if (!table) throw new Error(`table not found: ${name}`);
  return table;
}

const columnsOf = (schema: ERDEditorSchemaV3, name: string): Column[] =>
  tableByName(schema, name).columnIds.map(
    id => schema.collections.tableColumnEntities[id]
  );

const columnNames = (schema: ERDEditorSchemaV3, name: string): string[] =>
  columnsOf(schema, name).map(column => column.name);

function columnByName(
  schema: ERDEditorSchemaV3,
  tableName: string,
  columnName: string
): Column {
  const column = columnsOf(schema, tableName).find(
    column => column.name === columnName
  );
  if (!column) throw new Error(`column not found: ${tableName}.${columnName}`);
  return column;
}

/** Ids carry no meaning across runs, so a relationship is compared by name. */
const relationshipShapes = (schema: ERDEditorSchemaV3) =>
  schema.doc.relationshipIds.map(id => {
    const { relationshipType, identification, start, end } =
      schema.collections.relationshipEntities[id];
    const point = (side: { tableId: string; columnIds: string[] }) => ({
      table: schema.collections.tableEntities[side.tableId]?.name,
      columns: side.columnIds.map(
        columnId => schema.collections.tableColumnEntities[columnId]?.name
      ),
    });

    return {
      relationshipType,
      identification,
      start: point(start),
      end: point(end),
    };
  });

const indexShapes = (schema: ERDEditorSchemaV3) =>
  schema.doc.indexIds.map(id => {
    const index = schema.collections.indexEntities[id];
    return {
      name: index.name,
      table: schema.collections.tableEntities[index.tableId]?.name,
      unique: index.unique,
      columns: index.indexColumnIds.map(indexColumnId => {
        const indexColumn =
          schema.collections.indexColumnEntities[indexColumnId];
        return {
          name: schema.collections.tableColumnEntities[indexColumn.columnId]
            ?.name,
          orderType: indexColumn.orderType,
        };
      }),
    };
  });

describe('schema-graphql-parser/convert hand-written SDL', () => {
  const SDL = `
    "A registered account."
    type User {
      id: ID!
      "The login address."
      email: String!
      nickname: String
      posts: [Post!]!
    }

    type Post {
      id: ID!
      title: String!
      author: User!
    }
  `;

  it('turns every object type into a table', () => {
    expect(tableNames(convert(SDL))).toEqual(['User', 'Post']);
  });

  it('keeps the descriptions as the table and column comments', () => {
    const schema = convert(SDL);

    expect(tableByName(schema, 'User').comment).toBe('A registered account.');
    expect(columnByName(schema, 'User', 'email').comment).toBe(
      'The login address.'
    );
  });

  it('reads ID! as the primary key and the NonNull as NOT NULL', () => {
    const schema = convert(SDL);
    const id = columnByName(schema, 'User', 'id');

    expect(id.options).toBe(ColumnOption.primaryKey | ColumnOption.notNull);
    expect(id.ui.keys).toBe(ColumnUIKey.primaryKey);
    expect(columnByName(schema, 'User', 'email').options).toBe(
      ColumnOption.notNull
    );
    expect(columnByName(schema, 'User', 'nickname').options).toBe(0);
  });

  it('sizes the ui widths through the engine context', () => {
    const schema = convert(SDL);
    const email = columnByName(schema, 'User', 'email');

    expect(email.ui.widthDataType).toBe('varchar(255)'.length * 10);
    expect(email.ui.widthComment).toBe('The login address.'.length * 10);
    // textInRange floors every width at the column minimum.
    expect(email.ui.widthName).toBe(60);
    expect(tableByName(schema, 'User').ui.widthName).toBe(60);
  });

  it('yields one relationship for the two halves of a 1:N pair', () => {
    expect(relationshipShapes(convert(SDL))).toEqual([
      {
        relationshipType: RelationshipType.OneN,
        identification: false,
        start: { table: 'User', columns: ['id'] },
        end: { table: 'Post', columns: ['authorId'] },
      },
    ]);
  });

  it('synthesizes the foreign key column on the child', () => {
    const schema = convert(SDL);
    const authorId = columnByName(schema, 'Post', 'authorId');

    expect(columnNames(schema, 'Post')).toEqual(['id', 'title', 'authorId']);
    expect(authorId.dataType).toBe(columnByName(schema, 'User', 'id').dataType);
    expect(authorId.options).toBe(ColumnOption.notNull);
    expect(authorId.ui.keys).toBe(ColumnUIKey.foreignKey);
  });

  it('leaves the child nullable when the reference field is', () => {
    const schema = convert(`
      type Post { id: ID! author: User }
      type User { id: ID! name: String! }
    `);

    expect(columnByName(schema, 'Post', 'authorId').options).toBe(0);
    expect(relationshipShapes(schema)[0].relationshipType).toBe(
      RelationshipType.ZeroOne
    );
  });

  it('names the child column after the parent when only the list side exists', () => {
    const schema = convert(`
      type User { id: ID! posts: [Post!]! }
      type Post { id: ID! title: String! }
    `);

    expect(columnNames(schema, 'Post')).toEqual(['id', 'title', 'userId']);
    expect(relationshipShapes(schema)[0].relationshipType).toBe(
      RelationshipType.OneN
    );
  });

  it('reads a lone singular reference as 1:1', () => {
    const schema = convert(`
      type Profile { id: ID! user: User! }
      type User { id: ID! name: String! }
    `);

    expect(relationshipShapes(schema)).toEqual([
      {
        relationshipType: RelationshipType.OneOnly,
        identification: false,
        start: { table: 'User', columns: ['id'] },
        end: { table: 'Profile', columns: ['userId'] },
      },
    ]);
  });

  it('gives a bidirectional 1:1 pair one foreign key, on the declaring side', () => {
    const schema = convert(`
      type User { id: ID! profile: Profile }
      type Profile { id: ID! user: User! }
    `);

    expect(columnNames(schema, 'User')).toEqual(['id', 'profileId']);
    expect(columnNames(schema, 'Profile')).toEqual(['id']);
    expect(relationshipShapes(schema)).toEqual([
      {
        relationshipType: RelationshipType.ZeroOne,
        identification: false,
        start: { table: 'Profile', columns: ['id'] },
        end: { table: 'User', columns: ['profileId'] },
      },
    ]);
  });
});

describe('schema-graphql-parser/convert primary keys', () => {
  it('prefers a declared @id over an ID-typed field', () => {
    const schema = convert(`
      type User {
        uuid: ID!
        code: String! @primaryKey
      }
    `);

    expect(columnByName(schema, 'User', 'code').ui.keys).toBe(
      ColumnUIKey.primaryKey
    );
    expect(columnByName(schema, 'User', 'uuid').ui.keys).toBe(0);
  });

  it('falls back to a field literally named id', () => {
    const schema = convert(`
      type Row { id: Int! label: String! }
    `);

    expect(columnByName(schema, 'Row', 'id').options).toBe(
      ColumnOption.primaryKey | ColumnOption.notNull
    );
  });

  it('does not read a list of ID as the primary key', () => {
    const schema = convert(`
      type Bag { keys: [ID!]! label: String! }
    `);

    expect(columnsOf(schema, 'Bag').map(column => column.ui.keys)).toEqual([
      0, 0,
    ]);
  });

  it('keeps every declared key of a composite primary key', () => {
    const schema = convert(`
      type Tenant {
        tenantId: Int! @primaryKey
        region: String! @primaryKey
        name: String!
      }
    `);

    expect(
      columnsOf(schema, 'Tenant')
        .filter(column => column.ui.keys === ColumnUIKey.primaryKey)
        .map(column => column.name)
    ).toEqual(['tenantId', 'region']);
  });
});

describe('schema-graphql-parser/convert Hasura SDL', () => {
  const SDL = `
    scalar uuid
    scalar timestamptz
    scalar jsonb

    type users {
      id: uuid!
      email: String!
      metadata: jsonb
      created_at: timestamptz!
      posts(
        where: posts_bool_exp
        order_by: [posts_order_by!]
        limit: Int
        offset: Int
      ): [posts!]!
      posts_aggregate(where: posts_bool_exp): posts_aggregate!
    }

    type posts {
      id: uuid!
      title: String!
      user_id: uuid!
      user: users!
    }

    type posts_aggregate {
      aggregate: posts_aggregate_fields
      nodes: [posts!]!
    }

    type posts_aggregate_fields {
      count(columns: [posts_select_column!]): Int!
      max: posts_max_fields
    }

    type posts_max_fields {
      title: String
    }

    type posts_mutation_response {
      affected_rows: Int!
      returning: [posts!]!
    }

    input posts_bool_exp {
      id: uuid_comparison_exp
    }

    input posts_order_by {
      id: order_by
    }

    enum posts_select_column {
      id
      title
    }
  `;

  it('keeps only the two real tables', () => {
    expect(tableNames(convert(SDL))).toEqual(['users', 'posts']);
  });

  it('drops the fields that point at a pruned type', () => {
    const schema = convert(SDL);

    expect(columnNames(schema, 'users')).toEqual([
      'id',
      'email',
      'metadata',
      'created_at',
    ]);
  });

  it('resolves the Hasura scalars through the dialect', () => {
    const schema = convert(SDL);

    expect(columnByName(schema, 'users', 'id').dataType).toBe('uuid');
    expect(columnByName(schema, 'users', 'metadata').dataType).toBe('jsonb');
    expect(columnByName(schema, 'users', 'created_at').dataType).toBe(
      'timestamptz'
    );
  });

  it('discovers the declared user_id instead of synthesizing one', () => {
    const schema = convert(SDL);
    const userId = columnByName(schema, 'posts', 'user_id');

    expect(columnNames(schema, 'posts')).toEqual(['id', 'title', 'user_id']);
    expect(userId.ui.keys).toBe(ColumnUIKey.foreignKey);
    expect(userId.options).toBe(ColumnOption.notNull);
  });

  it('reads an array relation carrying arguments as the N side', () => {
    expect(relationshipShapes(convert(SDL))).toEqual([
      {
        relationshipType: RelationshipType.OneN,
        identification: false,
        start: { table: 'users', columns: ['id'] },
        end: { table: 'posts', columns: ['user_id'] },
      },
    ]);
  });
});

describe('schema-graphql-parser/convert Prisma-flavoured SDL', () => {
  const SDL = `
    scalar DateTime

    type User @map(name: "users") {
      id: Int! @id @default(value: "autoincrement()")
      email: String! @unique @db.VarChar(320)
      role: Role! @default(value: USER)
      createdAt: DateTime! @map(name: "created_at")
      posts: [Post!]!
    }

    type Post @map(name: "posts") {
      id: Int! @id
      title: String! @db.VarChar(180)
      authorId: Int!
      author: User! @relation(fields: [authorId], references: [id])
    }

    enum Role {
      USER
      ADMIN
    }
  `;

  it('renames the tables through @map', () => {
    expect(tableNames(convert(SDL))).toEqual(['users', 'posts']);
  });

  it('follows a @map rename through the fields that reference the type', () => {
    const schema = convert(SDL);

    expect(columnNames(schema, 'users')).toEqual([
      'id',
      'email',
      'role',
      'created_at',
    ]);
    expect(columnNames(schema, 'posts')).toEqual(['id', 'title', 'authorId']);
  });

  it('reads the @id, @unique, @default and autoincrement flags', () => {
    const schema = convert(SDL);

    expect(columnByName(schema, 'users', 'id').options).toBe(
      ColumnOption.autoIncrement |
        ColumnOption.primaryKey |
        ColumnOption.notNull
    );
    expect(columnByName(schema, 'users', 'email').options).toBe(
      ColumnOption.unique | ColumnOption.notNull
    );
    expect(columnByName(schema, 'users', 'role').default).toBe('USER');
  });

  it('lets a @db.* override win over the scalar lookup', () => {
    const schema = convert(SDL);

    expect(columnByName(schema, 'users', 'email').dataType).toBe(
      'VarChar(320)'
    );
    expect(columnByName(schema, 'posts', 'title').dataType).toBe(
      'VarChar(180)'
    );
    expect(columnByName(schema, 'users', 'created_at').dataType).toBe(
      'timestamp'
    );
  });

  it('binds the relationship to the @relation(fields:) column', () => {
    const schema = convert(SDL);

    expect(columnByName(schema, 'posts', 'authorId').ui.keys).toBe(
      ColumnUIKey.foreignKey
    );
    expect(relationshipShapes(schema)).toEqual([
      {
        relationshipType: RelationshipType.OneN,
        identification: false,
        start: { table: 'users', columns: ['id'] },
        end: { table: 'posts', columns: ['authorId'] },
      },
    ]);
  });

  it('binds every column of a composite @relation in order', () => {
    const schema = convert(`
      type Tenant {
        tenantId: Int! @primaryKey
        region: String! @primaryKey
        name: String!
      }

      type Site {
        id: Int! @id
        tenantId: Int!
        region: String!
        tenant: Tenant!
          @relation(fields: [tenantId, region], references: [tenantId, region])
      }
    `);

    expect(relationshipShapes(schema)).toEqual([
      {
        relationshipType: RelationshipType.OneOnly,
        identification: false,
        start: { table: 'Tenant', columns: ['tenantId', 'region'] },
        end: { table: 'Site', columns: ['tenantId', 'region'] },
      },
    ]);
  });

  it('pairs the two halves a @relation(name:) names', () => {
    const schema = convert(`
      type User {
        id: Int! @id
        profile: Profile @relation(name: "UserProfile")
      }

      type Profile {
        id: Int! @id
        userId: Int! @unique
        user: User!
          @relation(name: "UserProfile", fields: [userId], references: [id])
      }
    `);

    expect(columnNames(schema, 'User')).toEqual(['id']);
    expect(relationshipShapes(schema)).toEqual([
      {
        relationshipType: RelationshipType.OneOnly,
        identification: false,
        start: { table: 'User', columns: ['id'] },
        end: { table: 'Profile', columns: ['userId'] },
      },
    ]);
  });
});

describe('schema-graphql-parser/convert interfaces', () => {
  const SDL = `
    scalar DateTime

    interface Node {
      id: ID!
      createdAt: DateTime!
    }

    interface Timestamped {
      updatedAt: DateTime!
    }

    type Account implements Node & Timestamped {
      id: Int! @id
      email: String!
      updatedAt: String!
    }
  `;

  it('does not turn an interface into a table', () => {
    expect(tableNames(convert(SDL))).toEqual(['Account']);
  });

  it('inlines the interface fields ahead of the object own ones', () => {
    expect(columnNames(convert(SDL), 'Account')).toEqual([
      'createdAt',
      'id',
      'email',
      'updatedAt',
    ]);
  });

  it('lets the object own field win a name clash', () => {
    const schema = convert(SDL);

    expect(columnByName(schema, 'Account', 'id').dataType).toBe('integer');
    expect(columnByName(schema, 'Account', 'updatedAt').dataType).toBe(
      'varchar(255)'
    );
    expect(columnByName(schema, 'Account', 'createdAt').dataType).toBe(
      'timestamp'
    );
  });
});

describe('schema-graphql-parser/convert enums, unions and unknown scalars', () => {
  const SDL = `
    scalar Unknown

    "An account."
    type User {
      id: ID!
      "The account role."
      role: Role!
      tags: [Tag!]!
      avatar: Media
      raw: Unknown
    }

    type Photo { id: ID! url: String! }
    type Video { id: ID! url: String! }

    union Media = Photo | Video

    enum Role { USER ADMIN }
    enum Tag { NEW BETA }
  `;

  it('encodes an enum into the dataType on MySQL', () => {
    const schema = convert(SDL, Database.MySQL);

    expect(columnByName(schema, 'User', 'role').dataType).toBe(
      "ENUM('USER','ADMIN')"
    );
    expect(columnByName(schema, 'User', 'role').comment).toBe(
      'The account role.'
    );
  });

  it('falls back on PostgreSQL and keeps the members in the comment', () => {
    const schema = convert(SDL);
    const role = columnByName(schema, 'User', 'role');

    expect(role.dataType).toBe('varchar(255)');
    expect(role.comment).toBe('The account role. Role: USER | ADMIN');
  });

  it('notes the list shape of an enum list column', () => {
    expect(columnByName(convert(SDL), 'User', 'tags').comment).toBe(
      'list of Tag Tag: NEW | BETA'
    );
  });

  it('falls back for a union and lists its members', () => {
    const avatar = columnByName(convert(SDL), 'User', 'avatar');

    expect(avatar.dataType).toBe('varchar(255)');
    expect(avatar.comment).toBe('Media: Photo | Video');
  });

  it('falls back for a custom scalar with no known mapping', () => {
    const raw = columnByName(convert(SDL), 'User', 'raw');

    expect(raw.dataType).toBe('varchar(255)');
    expect(raw.comment).toBe('');
  });

  it('does not draw a relationship through a union', () => {
    expect(relationshipShapes(convert(SDL))).toEqual([]);
  });
});

describe('schema-graphql-parser/convert many to many', () => {
  const SDL = `
    type Student { id: ID! courses: [Course!]! }
    type Course { id: ID! students: [Student!]! }
  `;

  it('synthesizes exactly one junction table', () => {
    const schema = convert(SDL);

    expect(tableNames(schema)).toEqual(['Student', 'Course', 'Student_Course']);
    expect(tableByName(schema, 'Student_Course').comment).toBe(
      'Junction table inferred from Student <-> Course'
    );
  });

  it('makes every junction column both a primary and a foreign key', () => {
    const schema = convert(SDL);

    expect(
      columnsOf(schema, 'Student_Course').map(column => ({
        name: column.name,
        dataType: column.dataType,
        options: column.options,
        keys: column.ui.keys,
      }))
    ).toEqual([
      {
        name: 'studentId',
        dataType: 'varchar(255)',
        options: ColumnOption.primaryKey | ColumnOption.notNull,
        keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey,
      },
      {
        name: 'courseId',
        dataType: 'varchar(255)',
        options: ColumnOption.primaryKey | ColumnOption.notNull,
        keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey,
      },
    ]);
  });

  it('identifies both junction relationships', () => {
    expect(relationshipShapes(convert(SDL))).toEqual([
      {
        relationshipType: RelationshipType.ZeroN,
        identification: true,
        start: { table: 'Student', columns: ['id'] },
        end: { table: 'Student_Course', columns: ['studentId'] },
      },
      {
        relationshipType: RelationshipType.ZeroN,
        identification: true,
        start: { table: 'Course', columns: ['id'] },
        end: { table: 'Student_Course', columns: ['courseId'] },
      },
    ]);
  });

  it('keeps the junction name off a table the document already declares', () => {
    const schema = convert(`
      type Student_Course { id: ID! note: String }
      ${SDL}
    `);

    expect(tableNames(schema)).toEqual([
      'Student_Course',
      'Student',
      'Course',
      'Student_Course1',
    ]);
  });

  it('gives each @relation(name:) pair its own junction table', () => {
    const schema = convert(`
      type Student {
        id: ID!
        enrolled: [Course!]! @relation(name: "Enrolled")
        assisting: [Course!]! @relation(name: "Assisting")
      }

      type Course {
        id: ID!
        students: [Student!]! @relation(name: "Enrolled")
        assistants: [Student!]! @relation(name: "Assisting")
      }
    `);

    expect(tableNames(schema)).toEqual([
      'Student',
      'Course',
      'Student_Course',
      'Student_Course1',
    ]);
    expect(schema.doc.relationshipIds).toHaveLength(4);
  });

  it('skips the junction when a side has no primary key', () => {
    const schema = convert(`
      type Tag { label: String! posts: [Post!]! }
      type Post { id: ID! tags: [Tag!]! }
    `);

    expect(tableNames(schema)).toEqual(['Tag', 'Post']);
    expect(relationshipShapes(schema)).toEqual([]);
  });
});

describe('schema-graphql-parser/convert self relationship', () => {
  const SDL = `
    type Employee {
      id: ID!
      name: String!
      manager: Employee
      reports: [Employee!]!
    }
  `;

  it('draws one relationship back to the same table', () => {
    expect(relationshipShapes(convert(SDL))).toEqual([
      {
        relationshipType: RelationshipType.ZeroN,
        identification: false,
        start: { table: 'Employee', columns: ['id'] },
        end: { table: 'Employee', columns: ['managerId'] },
      },
    ]);
  });

  it('synthesizes the foreign key beside the primary key', () => {
    const schema = convert(SDL);

    expect(columnNames(schema, 'Employee')).toEqual([
      'id',
      'name',
      'managerId',
    ]);
    expect(columnByName(schema, 'Employee', 'managerId').ui.keys).toBe(
      ColumnUIKey.foreignKey
    );
  });
});

describe('schema-graphql-parser/convert unresolvable parent', () => {
  const SDL = `
    type Settings { theme: String! }
    type Account { id: ID! settings: Settings! }
  `;

  it('skips the relationship rather than emitting empty columnIds', () => {
    expect(relationshipShapes(convert(SDL))).toEqual([]);
  });

  it('does not synthesize a foreign key for the skipped relationship', () => {
    const schema = convert(SDL);

    expect(columnNames(schema, 'Account')).toEqual(['id']);
    expect(columnNames(schema, 'Settings')).toEqual(['theme']);
  });
});

describe('schema-graphql-parser/convert declared root types', () => {
  const SDL = `
    schema {
      query: RootQuery
      mutation: RootMutation
    }

    type RootQuery {
      savedQueries: [Query!]!
    }

    type RootMutation {
      saveQuery(text: String!): Query
    }

    "A saved analytics query."
    type Query {
      id: ID!
      text: String!
    }
  `;

  it('keeps a type named Query when the document renames the root', () => {
    const schema = convert(SDL);

    expect(tableNames(schema)).toEqual(['Query']);
    expect(tableByName(schema, 'Query').comment).toBe(
      'A saved analytics query.'
    );
    expect(columnNames(schema, 'Query')).toEqual(['id', 'text']);
  });

  it('draws no relationship out of the skipped root types', () => {
    expect(relationshipShapes(convert(SDL))).toEqual([]);
  });
});

describe('schema-graphql-parser/convert indexes', () => {
  it('builds an index over the columns it names', () => {
    const schema = convert(`
      type Article
        @table(name: "articles", comment: "blog posts")
        @index(name: "ix_slug", fields: ["slug"], unique: true)
        @index(fields: ["title", "slug"]) {
        id: ID!
        slug: String!
        title: String!
      }
    `);

    expect(indexShapes(schema)).toEqual([
      {
        name: 'ix_slug',
        table: 'articles',
        unique: true,
        columns: [{ name: 'slug', orderType: OrderType.ASC }],
      },
      {
        name: '',
        table: 'articles',
        unique: false,
        columns: [
          { name: 'title', orderType: OrderType.ASC },
          { name: 'slug', orderType: OrderType.ASC },
        ],
      },
    ]);
  });

  it('drops an index whose fields resolve to no column', () => {
    const schema = convert(`
      type Article @index(fields: ["missing"]) {
        id: ID!
      }
    `);

    expect(schema.doc.indexIds).toEqual([]);
    expect(schema.collections.indexColumnEntities).toEqual({});
  });
});

describe('schema-graphql-parser/convert Relay and Federation noise', () => {
  const SDL = `
    type Query { node(id: ID!): Node }

    interface Node { id: ID! }

    type User @key(fields: "id") {
      id: ID!
      name: String!
      postsConnection(first: Int, after: String): PostConnection!
      reviews: [Review!]!
    }

    type PostConnection {
      edges: [PostEdge!]!
      pageInfo: PageInfo!
    }

    type PostEdge { cursor: String! node: Post! }

    type PageInfo { hasNextPage: Boolean! endCursor: String }

    type Post { id: ID! title: String! }

    type Review { id: ID! body: String! author: User! }

    type _Service { sdl: String }

    union _Entity = User | Post
  `;

  it('prunes the generated scaffolding and its fields', () => {
    const schema = convert(SDL);

    expect(tableNames(schema)).toEqual(['User', 'Post', 'Review']);
    expect(columnNames(schema, 'User')).toEqual(['id', 'name']);
  });

  it('keeps the relationship the real types carry', () => {
    expect(relationshipShapes(convert(SDL))).toEqual([
      {
        relationshipType: RelationshipType.OneN,
        identification: false,
        start: { table: 'User', columns: ['id'] },
        end: { table: 'Review', columns: ['authorId'] },
      },
    ]);
  });
});
