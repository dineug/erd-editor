import { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnUIKey, Database, DatabaseList } from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { Column } from '@/internal-types';
import { schemaGraphQLParserToSchemaJson } from '@/utils/schema-graphql-parser';
import { parseGraphQLModel } from '@/utils/schema-graphql-parser/parser';
import { GraphQLTable } from '@/utils/schema-graphql-parser/types';

type Schema = Pick<
  ERDEditorSchemaV3,
  '$schema' | 'version' | 'settings' | 'doc' | 'collections'
>;

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

function parse(
  sdl: string,
  prepare?: (schema: ERDEditorSchemaV3) => ERDEditorSchemaV3
): Schema {
  return JSON.parse(schemaGraphQLParserToSchemaJson(sdl, ctx, prepare));
}

function parseMessage(sdl: string): string {
  const result = parseGraphQLModel(sdl);
  if (result.ok) throw new Error('expected a parse failure');
  return result.message;
}

function parseTables(sdl: string): GraphQLTable[] {
  const result = parseGraphQLModel(sdl);
  if (!result.ok) throw new Error(result.message);
  return result.model.tables;
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

const PRISMA_SCHEMA = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    String @id @default(uuid())
  email String @unique
  posts Post[]
}
`;

describe('schemaGraphQLParserToSchemaJson', () => {
  it('returns a formatted JSON string, not an object', () => {
    const json = schemaGraphQLParserToSchemaJson('type User { id: ID! }', ctx);

    expect(typeof json).toBe('string');
    expect(json).toContain('\n  "version": "3.0.0"');
  });

  it('produces a v3 envelope', () => {
    const schema = parse('type User { id: ID! name: String! }');

    expect(schema.version).toBe('3.0.0');
    expect(schema.$schema).toBe(
      'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json'
    );
    expect(schema.doc.tableIds).toHaveLength(1);
    expect(schema.doc.relationshipIds).toEqual([]);
    expect(schema.doc.indexIds).toEqual([]);
    expect(schema.doc.memoIds).toEqual([]);
    expect(schema.collections.memoEntities).toEqual({});
  });

  it('carries the tables, columns and relationships into the document', () => {
    const schema = parse(`
      type User { id: ID! posts: [Post!]! }
      type Post { id: ID! author: User! }
    `);
    const columns = columnsOf(schema);

    expect(schema.doc.tableIds).toHaveLength(2);
    expect(schema.doc.relationshipIds).toHaveLength(1);
    expect(columns.map(column => column.name)).toEqual([
      'id',
      'id',
      'authorId',
    ]);
    expect(columns.find(column => column.name === 'authorId')?.ui.keys).toBe(
      ColumnUIKey.foreignKey
    );
  });
});

describe('schemaGraphQLParserToSchemaJson canvas size', () => {
  const createTypes = (count: number) =>
    Array.from({ length: count }, (_, i) => `type T${i} { id: ID! }`).join(
      '\n'
    );

  it('clamps a small schema up to the canvas minimum', () => {
    const schema = parse(createTypes(2));

    expect(schema.settings.width).toBe(2000);
    expect(schema.settings.height).toBe(2000);
  });

  it('scales with the table count between the bounds', () => {
    const schema = parse(createTypes(25));

    expect(schema.doc.tableIds).toHaveLength(25);
    expect(schema.settings.width).toBe(2500);
    expect(schema.settings.height).toBe(2500);
  });

  it('clamps a large schema down to the canvas maximum', () => {
    const schema = parse(createTypes(205));

    expect(schema.doc.tableIds).toHaveLength(205);
    expect(schema.settings.width).toBe(20000);
    expect(schema.settings.height).toBe(20000);
  });
});

describe('schemaGraphQLParserToSchemaJson prepare', () => {
  it('hands prepare the sized-but-empty schema and keeps its settings', () => {
    const seen: Array<{ width: number; tableIds: number }> = [];
    const schema = parse('type User { id: ID! }', draft => {
      seen.push({
        width: draft.settings.width,
        tableIds: draft.doc.tableIds.length,
      });
      draft.settings.database = Database.Oracle;
      draft.settings.scrollTop = 42;
      return draft;
    });

    expect(seen).toEqual([{ width: 2000, tableIds: 0 }]);
    expect(schema.settings.database).toBe(Database.Oracle);
    expect(schema.settings.scrollTop).toBe(42);
    expect(schema.doc.tableIds).toHaveLength(1);
  });

  it('resolves the column data types against the database prepare picked', () => {
    const sdl = 'type Row { id: ID! at: DateTime! }';

    expect(dataTypes(parse(sdl, withDatabase(Database.MySQL)))).toEqual({
      id: 'VARCHAR(255)',
      at: 'DATETIME',
    });
    expect(dataTypes(parse(sdl, withDatabase(Database.PostgreSQL)))).toEqual({
      id: 'varchar(255)',
      at: 'timestamp',
    });
  });

  it('calls prepare even for a document it cannot read', () => {
    let calls = 0;
    const count = (schema: ERDEditorSchemaV3) => {
      calls += 1;
      return schema;
    };

    schemaGraphQLParserToSchemaJson('', ctx, count);
    schemaGraphQLParserToSchemaJson(PRISMA_SCHEMA, ctx, count);
    schemaGraphQLParserToSchemaJson('type Query { ping: Boolean }', ctx, count);

    expect(calls).toBe(3);
  });
});

describe('schemaGraphQLParserToSchemaJson custom scalars per dialect', () => {
  const SDL = `
    scalar UUID
    scalar DateTime
    scalar JSON
    scalar BigInt
    scalar Decimal
    scalar Date
    scalar Time

    type Row {
      id: UUID!
      at: DateTime!
      payload: JSON
      counter: BigInt!
      amount: Decimal!
      day: Date!
      clock: Time!
    }
  `;

  const expected: Record<number, Record<string, string>> = {
    [Database.MariaDB]: {
      id: 'UUID',
      at: 'DATETIME',
      payload: 'JSON',
      counter: 'BIGINT',
      amount: 'DECIMAL',
      day: 'DATE',
      clock: 'TIME',
    },
    [Database.MSSQL]: {
      id: 'uniqueidentifier',
      at: 'datetime2',
      payload: 'json',
      counter: 'bigint',
      amount: 'decimal',
      day: 'date',
      clock: 'time',
    },
    [Database.MySQL]: {
      id: 'CHAR(36)',
      at: 'DATETIME',
      payload: 'JSON',
      counter: 'BIGINT',
      amount: 'DECIMAL',
      day: 'DATE',
      clock: 'TIME',
    },
    [Database.Oracle]: {
      id: 'VARCHAR2(36)',
      at: 'TIMESTAMP',
      payload: 'JSON',
      counter: 'NUMBER(19)',
      amount: 'DECIMAL',
      day: 'DATE',
      clock: 'VARCHAR2(255)',
    },
    [Database.PostgreSQL]: {
      id: 'uuid',
      at: 'timestamp',
      payload: 'jsonb',
      counter: 'bigint',
      amount: 'numeric',
      day: 'date',
      clock: 'time',
    },
    [Database.SQLite]: {
      id: 'TEXT',
      at: 'DATETIME',
      payload: 'TEXT',
      counter: 'BIGINT',
      amount: 'DECIMAL',
      day: 'DATE',
      clock: 'TEXT',
    },
    [Database.Databricks]: {
      id: 'STRING',
      at: 'TIMESTAMP',
      payload: 'VARIANT',
      counter: 'BIGINT',
      amount: 'DECIMAL',
      day: 'DATE',
      clock: 'STRING',
    },
    [Database.Snowflake]: {
      id: 'UUID',
      at: 'TIMESTAMP_NTZ',
      payload: 'VARIANT',
      counter: 'BIGINT',
      amount: 'DECIMAL',
      day: 'DATE',
      clock: 'TIME',
    },
  };

  DatabaseList.forEach(database => {
    it(`resolves them for database ${database}`, () => {
      expect(dataTypes(parse(SDL, withDatabase(database)))).toEqual(
        expected[database]
      );
    });
  });
});

describe('schemaGraphQLParserToSchemaJson unreadable input', () => {
  const unparsable: Array<[string, string]> = [
    ['an empty string', ''],
    ['whitespace only', '   \n\t  '],
    ['a comment with no definition', '# just a note\n'],
    ['a modern schema.prisma', PRISMA_SCHEMA],
    ['a bare prisma model', 'model User {\n  id String @id\n}\n'],
    ['a truncated type', 'type User { id: ID!'],
    ['SQL DDL', 'CREATE TABLE users (id INT PRIMARY KEY);'],
    ['a JSON document', '{"tables": []}'],
    ['unbalanced braces', '{{{ not graphql at all }}}'],
  ];

  unparsable.forEach(([label, sdl]) => {
    it(`loads an empty document for ${label}`, () => {
      const result = parseGraphQLModel(sdl);

      expect(result.ok).toBe(false);
      expect(parse(sdl).doc.tableIds).toEqual([]);
    });
  });

  const tableless: Array<[string, string]> = [
    ['a query document', 'query Q { user { id name } }'],
    [
      'a pure API schema',
      `scalar DateTime
       input UserFilter { name: String }
       type Query { users(filter: UserFilter): [String!]! }
       type Mutation { ping: Boolean }`,
    ],
    ['a document of enums only', 'enum Color { RED GREEN }'],
    [
      'a document whose only type is pruned',
      'type UserConnection { edges: [String!]! }',
    ],
    [
      'a directive definition only',
      'directive @auth(role: String) on FIELD_DEFINITION',
    ],
  ];

  tableless.forEach(([label, sdl]) => {
    it(`loads an empty document for ${label}`, () => {
      expect(parseTables(sdl)).toEqual([]);
      expect(parse(sdl).doc.tableIds).toEqual([]);
    });
  });

  it('reports the line and column of a modern schema.prisma', () => {
    expect(parseMessage(PRISMA_SCHEMA)).toBe(
      'Syntax Error at line 1, column 1: Unexpected Name "generator".'
    );
  });

  it('reports the line and column of a bare prisma model', () => {
    expect(parseMessage('model User {\n  id String @id\n}\n')).toBe(
      'Syntax Error at line 1, column 1: Unexpected Name "model".'
    );
  });

  it('reports the line and column of a truncated type', () => {
    expect(parseMessage('type User {\n  id: ID!\n')).toMatch(
      /^Syntax Error at line 3, column \d+: /
    );
  });

  it('accepts a document that carries even one table', () => {
    expect(
      schemaGraphQLParserToSchemaJson(
        'type Query { ping: Boolean }\ntype User { id: ID! }',
        ctx
      )
    ).not.toBeNull();
  });
});
