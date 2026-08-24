import { describe, expect, it } from 'vite-plus/test';

import { parseGraphQLModel } from '@/utils/schema-graphql-parser/parser';
import {
  GraphQLField,
  GraphQLModel,
  GraphQLTable,
} from '@/utils/schema-graphql-parser/types';

function parseModel(sdl: string): GraphQLModel {
  const result = parseGraphQLModel(sdl);
  if (!result.ok) throw new Error(result.message);
  return result.model;
}

function parseMessage(sdl: string): string {
  const result = parseGraphQLModel(sdl);
  if (result.ok) throw new Error('expected a parse failure');
  return result.message;
}

function tableByName(model: GraphQLModel, name: string): GraphQLTable {
  const table = model.tables.find(table => table.name === name);
  if (!table) throw new Error(`table not found: ${name}`);
  return table;
}

function fieldByName(table: GraphQLTable, name: string): GraphQLField {
  const field = table.fields.find(field => field.name === name);
  if (!field) throw new Error(`field not found: ${name}`);
  return field;
}

const firstTable = (sdl: string) => parseModel(sdl).tables[0];

describe('schema-graphql-parser/parser type refs', () => {
  const table = firstTable(`
    type User {
      a: String
      b: String!
      c: [String!]
      d: [String!]!
      e: [String]
      f: [[String]]
    }
  `);

  it('reads a bare named type as nullable and unlisted', () => {
    expect(fieldByName(table, 'a').typeRef).toEqual({
      named: 'String',
      nonNull: false,
      isList: false,
      itemNonNull: false,
    });
  });

  it('reads the outermost NonNull as the column NOT NULL signal', () => {
    expect(fieldByName(table, 'b').typeRef).toEqual({
      named: 'String',
      nonNull: true,
      isList: false,
      itemNonNull: false,
    });
  });

  it('keeps the item NonNull separate from the column one', () => {
    expect(fieldByName(table, 'c').typeRef).toEqual({
      named: 'String',
      nonNull: false,
      isList: true,
      itemNonNull: true,
    });
  });

  it('reads both NonNull positions of [T!]!', () => {
    expect(fieldByName(table, 'd').typeRef).toEqual({
      named: 'String',
      nonNull: true,
      isList: true,
      itemNonNull: true,
    });
  });

  it('reads a nullable item inside a list', () => {
    expect(fieldByName(table, 'e').typeRef).toEqual({
      named: 'String',
      nonNull: false,
      isList: true,
      itemNonNull: false,
    });
  });

  it('reaches the named type through a nested list', () => {
    expect(fieldByName(table, 'f').typeRef.named).toBe('String');
  });
});

describe('schema-graphql-parser/parser interfaces', () => {
  const model = parseModel(`
    interface Node {
      id: ID!
      createdAt: DateTime
    }

    interface Timestamped {
      createdAt: DateTime
      updatedAt: DateTime
    }

    type User implements Node & Timestamped {
      id: Int
      name: String
    }
  `);

  it('does not turn an interface into a table', () => {
    expect(model.tables.map(table => table.name)).toEqual(['User']);
  });

  it('prepends interface fields ahead of the object own fields', () => {
    expect(tableByName(model, 'User').fields.map(field => field.name)).toEqual([
      'createdAt',
      'updatedAt',
      'id',
      'name',
    ]);
  });

  it('lets the object own field win the name collision', () => {
    expect(fieldByName(tableByName(model, 'User'), 'id').typeRef).toEqual({
      named: 'Int',
      nonNull: false,
      isList: false,
      itemNonNull: false,
    });
  });

  it('inlines a field shared by two interfaces once', () => {
    const createdAt = tableByName(model, 'User').fields.filter(
      field => field.name === 'createdAt'
    );

    expect(createdAt).toHaveLength(1);
  });

  it('ignores an interface the document never declares', () => {
    const table = firstTable(`
      type User implements Missing {
        id: ID!
      }
    `);

    expect(table.fields.map(field => field.name)).toEqual(['id']);
  });

  it('merges an interface extension into the inlined fields', () => {
    const table = firstTable(`
      interface Node {
        id: ID!
      }

      extend interface Node {
        version: Int
      }

      type User implements Node {
        name: String
      }
    `);

    expect(table.fields.map(field => field.name)).toEqual([
      'id',
      'version',
      'name',
    ]);
  });
});

describe('schema-graphql-parser/parser object extensions', () => {
  it('merges extension fields into the base table', () => {
    const table = firstTable(`
      type User {
        id: ID!
      }

      extend type User {
        email: String
      }
    `);

    expect(table.fields.map(field => field.name)).toEqual(['id', 'email']);
  });

  it('creates the table when only the extension declares it', () => {
    const table = firstTable(`
      extend type User {
        id: ID!
      }
    `);

    expect(table.name).toBe('User');
    expect(table.fields.map(field => field.name)).toEqual(['id']);
  });

  it('keeps the base definition of a field the extension repeats', () => {
    const table = firstTable(`
      type User {
        id: ID!
      }

      extend type User {
        id: String
      }
    `);

    expect(fieldByName(table, 'id').typeRef.named).toBe('ID');
  });

  it('applies a directive carried by the extension', () => {
    const table = firstTable(`
      type User {
        id: ID!
      }

      extend type User @table(name: "users") {
        email: String
      }
    `);

    expect(table.name).toBe('users');
  });
});

describe('schema-graphql-parser/parser root types', () => {
  it('skips the default root type names', () => {
    const model = parseModel(`
      type Query {
        users: [User!]!
      }

      type Mutation {
        insertUser(name: String): User
      }

      type Subscription {
        userAdded: User
      }

      type User {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['User']);
    expect(model.skipped).toEqual(['Query', 'Mutation', 'Subscription']);
  });

  it('replaces the default skip set with the declared root types', () => {
    const model = parseModel(`
      schema {
        query: RootQuery
        mutation: RootMutation
      }

      type RootQuery {
        users: [User!]!
      }

      type Query {
        id: ID!
      }

      type User {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['Query', 'User']);
    expect(model.skipped).toEqual(['RootQuery']);
  });

  it('reads the root types off a schema extension too', () => {
    const model = parseModel(`
      extend schema {
        query: RootQuery
      }

      type RootQuery {
        users: [User!]!
      }

      type Query {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['Query']);
  });

  it('keeps the defaults when a schema extension carries no operation types', () => {
    const model = parseModel(`
      directive @link on SCHEMA

      extend schema @link

      type Query {
        id: ID!
      }

      type User {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['User']);
  });
});

describe('schema-graphql-parser/parser noise pruning', () => {
  it('prunes introspection types', () => {
    const model = parseModel(`
      type __Schema {
        types: [__Type!]!
      }

      type User {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['User']);
    expect(model.skipped).toContain('__Schema');
  });

  it('prunes Relay connection scaffolding', () => {
    const model = parseModel(`
      type PageInfo {
        hasNextPage: Boolean!
      }

      type UserConnection {
        edges: [UserEdge!]!
      }

      type UserEdge {
        node: User!
      }

      type User {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['User']);
    expect(model.skipped).toEqual(['PageInfo', 'UserConnection', 'UserEdge']);
  });

  it('keeps a type whose whole name is a Relay suffix', () => {
    const model = parseModel(`
      type Edge {
        id: ID!
      }

      type Connection {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual([
      'Edge',
      'Connection',
    ]);
  });

  it('prunes the Hasura generated types', () => {
    const model = parseModel(`
      type users_aggregate {
        count: Int
      }

      type users_aggregate_fields {
        count: Int
      }

      type users_mutation_response {
        affected_rows: Int!
      }

      type users_max_fields {
        id: Int
      }

      type users_min_fields {
        id: Int
      }

      type users_sum_fields {
        id: Int
      }

      type users_avg_fields {
        id: Float
      }

      type users_stddev_fields {
        id: Float
      }

      type users_variance_fields {
        id: Float
      }

      type users_bool_exp {
        id: Int
      }

      type users_order_by {
        id: Int
      }

      type users_insert_input {
        id: Int
      }

      type users_set_input {
        id: Int
      }

      type users_on_conflict {
        id: Int
      }

      type users_constraint {
        id: Int
      }

      type users_update_column {
        id: Int
      }

      type users_select_column {
        id: Int
      }

      type users {
        id: Int!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['users']);
    expect(model.skipped).toHaveLength(17);
  });

  it('keeps a Hasura array relation with arguments as a field', () => {
    const table = firstTable(`
      type users {
        id: Int!
        posts(where: posts_bool_exp, limit: Int): [posts!]!
      }

      type posts {
        id: Int!
      }
    `);
    const posts = fieldByName(table, 'posts');

    expect(posts.hasArguments).toBe(true);
    expect(posts.typeRef).toEqual({
      named: 'posts',
      nonNull: true,
      isList: true,
      itemNonNull: true,
    });
  });

  it('prunes the Apollo Federation types', () => {
    const model = parseModel(`
      type _Service {
        sdl: String
      }

      type _Entity {
        id: ID!
      }

      type _Any {
        id: ID!
      }

      type _FieldSet {
        id: ID!
      }

      type User @key(fields: "id") {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['User']);
    expect(model.skipped).toEqual(['_Service', '_Entity', '_Any', '_FieldSet']);
  });

  it('prunes an object left with no field at all', () => {
    const model = parseModel(`
      type Empty @table(name: "empty") {
        __typename: String
      }

      type User {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['User']);
    expect(model.skipped).toEqual(['Empty']);
  });
});

describe('schema-graphql-parser/parser descriptions', () => {
  it('reads a block description on a type and on a field', () => {
    const table = firstTable(`
      """
      The account table
      """
      type User {
        """the primary key"""
        id: ID!
      }
    `);

    expect(table.comment).toBe('The account table');
    expect(fieldByName(table, 'id').comment).toBe('the primary key');
  });

  it('recovers a # comment the AST drops', () => {
    const table = firstTable(`# the account table
type User {
  # the primary key
  id: ID!
}
`);

    expect(table.comment).toBe('the account table');
    expect(fieldByName(table, 'id').comment).toBe('the primary key');
  });

  it('joins contiguous # comment lines with a space', () => {
    const table = firstTable(`# first line
# second line
type User {
  id: ID!
}
`);

    expect(table.comment).toBe('first line second line');
  });

  it('stops at a blank line between the comment and the type', () => {
    const table = firstTable(`# detached

type User {
  id: ID!
}
`);

    expect(table.comment).toBe('');
  });

  it('does not claim a trailing comment written after the previous field', () => {
    const table = firstTable(`type User {
  id: ID! # the primary key
  name: String
}
`);

    expect(fieldByName(table, 'name').comment).toBe('');
  });

  it('prefers the block description over the # comment above it', () => {
    const table = firstTable(`# the hash comment
"""the block description"""
type User {
  id: ID!
}
`);

    expect(table.comment).toBe('the block description');
  });

  it('collapses newlines inside a block description', () => {
    const table = firstTable(`
      """
      first line
      second line
      """
      type User {
        id: ID!
      }
    `);

    expect(table.comment).toBe('first line second line');
  });
});

describe('schema-graphql-parser/parser field directives', () => {
  it('reads @id and @primaryKey as the primary key', () => {
    const table = firstTable(`
      type User {
        id: ID! @id
        code: String @primaryKey
      }
    `);

    expect(fieldByName(table, 'id').primaryKey).toBe(true);
    expect(fieldByName(table, 'code').primaryKey).toBe(true);
  });

  it('reads @unique', () => {
    const table = firstTable(`
      type User {
        email: String @unique
      }
    `);

    expect(fieldByName(table, 'email').unique).toBe(true);
  });

  it('reads every literal kind out of @default', () => {
    const table = firstTable(`
      type User {
        a: String @default(value: "now()")
        b: Int @default(value: 0)
        c: Float @default(value: 1.5)
        d: Boolean @default(value: false)
        e: Role @default(value: USER)
        f: String @default(value: null)
        g: [Int!] @default(value: [1, 2])
      }
    `);

    expect(fieldByName(table, 'a').default).toBe('now()');
    expect(fieldByName(table, 'b').default).toBe('0');
    expect(fieldByName(table, 'c').default).toBe('1.5');
    expect(fieldByName(table, 'd').default).toBe('false');
    expect(fieldByName(table, 'e').default).toBe('USER');
    expect(fieldByName(table, 'f').default).toBe('null');
    expect(fieldByName(table, 'g').default).toBe('1, 2');
  });

  it('reads a positional @default argument', () => {
    const table = firstTable(`
      type User {
        status: String @default("active")
      }
    `);

    expect(fieldByName(table, 'status').default).toBe('active');
  });

  it('reads autoincrement out of @default and out of @autoincrement', () => {
    const table = firstTable(`
      type User {
        id: Int @default(value: "autoincrement()")
        seq: Int @autoincrement
      }
    `);

    const id = fieldByName(table, 'id');
    expect(id.autoIncrement).toBe(true);
    expect(id.default).toBe('');
    expect(fieldByName(table, 'seq').autoIncrement).toBe(true);
  });

  it('reads a @db.* override verbatim, arguments included', () => {
    const table = firstTable(`
      type User {
        name: String @db.VarChar(255)
        bio: String @db.Text
        id: String @db.Uuid
        price: Float @db.Decimal(10, 2)
      }
    `);

    expect(fieldByName(table, 'name').dataType).toBe('VarChar(255)');
    expect(fieldByName(table, 'bio').dataType).toBe('Text');
    expect(fieldByName(table, 'id').dataType).toBe('Uuid');
    expect(fieldByName(table, 'price').dataType).toBe('Decimal(10, 2)');
  });

  it('renames a column through @map in both spellings', () => {
    const table = firstTable(`
      type User {
        createdAt: DateTime @map(name: "created_at")
        updatedAt: DateTime @map("updated_at")
      }
    `);

    expect(table.fields.map(field => field.name)).toEqual([
      'created_at',
      'updated_at',
    ]);
  });

  it('reads @relation into its three parts', () => {
    const table = firstTable(`
      type Post {
        authorId: Int!
        author: User @relation(name: "AuthorPosts", fields: ["authorId"], references: ["id"])
      }
    `);
    const author = fieldByName(table, 'author');

    expect(author.relationName).toBe('AuthorPosts');
    expect(author.relationFields).toEqual(['authorId']);
    expect(author.relationReferences).toEqual(['id']);
  });

  it('reads a positional @relation name without eating the field list', () => {
    const table = firstTable(`
      type Post {
        author: User @relation("AuthorPosts", fields: [authorId], references: [id])
      }
    `);
    const author = fieldByName(table, 'author');

    expect(author.relationName).toBe('AuthorPosts');
    expect(author.relationFields).toEqual(['authorId']);
    expect(author.relationReferences).toEqual(['id']);
  });

  it('leaves the relation name empty when only fields are given', () => {
    const table = firstTable(`
      type Post {
        author: User @relation(fields: ["authorId"], references: ["id"])
      }
    `);
    const author = fieldByName(table, 'author');

    expect(author.relationName).toBe('');
    expect(author.relationFields).toEqual(['authorId']);
  });

  it('takes every part of a full @column override', () => {
    const table = firstTable(`
      type User {
        id: String
          @column(
            name: "user_id"
            dataType: "BIGINT"
            default: 0
            autoIncrement: true
            unique: true
            primaryKey: true
          )
      }
    `);
    const column = fieldByName(table, 'user_id');

    expect(column.dataType).toBe('BIGINT');
    expect(column.default).toBe('0');
    expect(column.autoIncrement).toBe(true);
    expect(column.unique).toBe(true);
    expect(column.primaryKey).toBe(true);
  });

  it('lets an explicit false in @column turn a flag back off', () => {
    const table = firstTable(`
      type User {
        id: String @unique @column(unique: false, primaryKey: false)
      }
    `);
    const column = fieldByName(table, 'id');

    expect(column.unique).toBe(false);
    expect(column.primaryKey).toBe(false);
  });

  it('ignores the directives that carry no schema meaning', () => {
    const table = firstTable(`
      type User {
        id: ID! @deprecated(reason: "gone") @external @key(fields: "id") @whatever
      }
    `);

    expect(fieldByName(table, 'id')).toEqual({
      name: 'id',
      comment: '',
      typeRef: {
        named: 'ID',
        nonNull: true,
        isList: false,
        itemNonNull: false,
      },
      primaryKey: false,
      unique: false,
      autoIncrement: false,
      default: '',
      dataType: '',
      relationName: '',
      relationFields: [],
      relationReferences: [],
      hasArguments: false,
    });
  });

  it('drops a field whose name is introspection', () => {
    const table = firstTable(`
      type User {
        __typename: String
        id: ID!
      }
    `);

    expect(table.fields.map(field => field.name)).toEqual(['id']);
  });
});

describe('schema-graphql-parser/parser type directives', () => {
  it('renames a table through @map in both spellings', () => {
    const model = parseModel(`
      type User @map(name: "users") {
        id: ID!
      }

      type Post @map("posts") {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['users', 'posts']);
  });

  it('reads name and comment out of @table', () => {
    const table = firstTable(`
      type User @table(name: "users", comment: "the account table") {
        id: ID!
      }
    `);

    expect(table.name).toBe('users');
    expect(table.comment).toBe('the account table');
  });

  it('collects a repeated @index', () => {
    const table = firstTable(`
      type User
        @index(name: "ix_email", fields: ["email"], unique: true)
        @index(fields: ["name", "email"]) {
        name: String
        email: String
      }
    `);

    expect(table.indexes).toEqual([
      { name: 'ix_email', unique: true, fieldNames: ['email'] },
      { name: '', unique: false, fieldNames: ['name', 'email'] },
    ]);
  });

  it('drops an @index that names no field', () => {
    const table = firstTable(`
      type User @index(unique: true) {
        email: String
      }
    `);

    expect(table.indexes).toEqual([]);
  });
});

describe('schema-graphql-parser/parser type collections', () => {
  it('collects enums, unions and custom scalars', () => {
    const model = parseModel(`
      scalar DateTime
      scalar UUID

      enum Role {
        USER
        ADMIN
      }

      union Owner = User | Team

      type User {
        id: ID!
        role: Role
      }

      type Team {
        id: ID!
      }
    `);

    expect(model.enums).toEqual({ Role: ['USER', 'ADMIN'] });
    expect(model.unions).toEqual({ Owner: ['User', 'Team'] });
    expect(model.customScalars).toEqual(['DateTime', 'UUID']);
  });

  it('skips inputs, directive definitions and operations', () => {
    const model = parseModel(`
      directive @auth on FIELD_DEFINITION

      input UserInput {
        name: String
      }

      fragment UserParts on User {
        id
      }

      query GetUser {
        user {
          id
        }
      }

      type User {
        id: ID!
      }
    `);

    expect(model.tables.map(table => table.name)).toEqual(['User']);
    expect(model.skipped).toEqual([]);
  });

  it('yields no table for a document that only holds operations', () => {
    const model = parseModel(`
      query GetUser {
        user {
          id
        }
      }
    `);

    expect(model.tables).toEqual([]);
  });
});

describe('schema-graphql-parser/parser errors', () => {
  it('names the line and column of a schema.prisma file', () => {
    expect(
      parseMessage(`generator client {
  provider = "prisma-client-js"
}

model User {
  id Int @id @default(autoincrement())
}
`)
    ).toBe('Syntax Error at line 1, column 1: Unexpected Name "generator".');
  });

  it('names the line and column of a bare prisma model', () => {
    expect(
      parseMessage(`model User {
  id Int @id
}
`)
    ).toBe('Syntax Error at line 1, column 1: Unexpected Name "model".');
  });

  it('reports the position measured against the text the user picked', () => {
    expect(
      parseMessage(`type User {
  name: String @db.VarChar(255)
}

model Post {
  id Int
}
`)
    ).toBe('Syntax Error at line 2, column 19: Unexpected character: ".".');
  });

  it('reports an empty document rather than throwing', () => {
    expect(parseMessage('')).toContain('Unexpected <EOF>');
  });

  it('reports a truncated type', () => {
    expect(parseMessage('type User {')).toContain('Syntax Error at line 1');
  });
});
