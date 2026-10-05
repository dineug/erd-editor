import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { buildSchema, validateSchema } from 'graphql';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  Database,
  NameCase,
  RelationshipType,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/graphql';
import { schemaGraphQLParserToSchemaJson } from '@/utils/schema-graphql-parser';

type ColumnInput = {
  name: string;
  dataType?: string;
  comment?: string;
  options?: number;
  keys?: number;
};

type TableInput = {
  id: string;
  name: string;
  comment?: string;
  columns?: ColumnInput[];
};

function createState(): RootState {
  return {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;
}

function addTable(
  state: RootState,
  { id, name, comment = '', columns = [] }: TableInput
): Table {
  const entities = columns.map((column, index) =>
    createColumn({
      id: `${id}-c${index}`,
      tableId: id,
      name: column.name,
      dataType: column.dataType ?? '',
      comment: column.comment ?? '',
      options: column.options ?? 0,
      ui: { keys: column.keys ?? 0 },
    })
  );
  const table = createTable({
    id,
    name,
    comment,
    columnIds: entities.map(column => column.id),
  });

  state.collections.tableEntities[table.id] = table;
  entities.forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });
  state.doc.tableIds.push(table.id);

  return table;
}

function addRelationship(
  state: RootState,
  id: string,
  startTableId: string,
  endTableId: string,
  relationshipType: number = RelationshipType.ZeroN,
  endColumnIds: string[] = []
) {
  const relationship = createRelationship({
    id,
    relationshipType,
    start: { tableId: startTableId },
    end: { tableId: endTableId, columnIds: endColumnIds },
  });
  state.collections.relationshipEntities[relationship.id] = relationship;
  state.doc.relationshipIds.push(relationship.id);
  return relationship;
}

// Every case is handed to the real parser as well as compared to an expected
// string. buildSchema covers the validation rules -- duplicate type and field
// names -- that parse alone would let through.
function expectValidSDL(code: string) {
  expect(() => buildSchema(code)).not.toThrow();
}

// validateSchema holds what a server checks before it starts, the __ prefix
// GraphQL reserves among them; a generated document defines no Query type.
function expectServableSDL(code: string) {
  expectValidSDL(code);
  const errors = validateSchema(buildSchema(code))
    .map(error => error.message)
    .filter(message => message !== 'Query root type must be provided.');
  expect(errors).toEqual([]);
}

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

function importedRelationshipCount(code: string): number {
  return JSON.parse(schemaGraphQLParserToSchemaJson(code, ctx)).doc
    .relationshipIds.length;
}

const PRIMARY_KEY: ColumnInput = {
  name: 'id',
  dataType: 'INT',
  options: ColumnOption.primaryKey | ColumnOption.notNull,
  keys: ColumnUIKey.primaryKey,
};

function foreignKey(name: string): ColumnInput {
  return {
    name,
    dataType: 'INT',
    options: ColumnOption.notNull,
    keys: ColumnUIKey.foreignKey,
  };
}

/** A user and an order table, each holding its given columns after its id. */
function createOrderState(
  columns: ColumnInput[],
  userColumns: ColumnInput[] = []
): RootState {
  const state = createState();
  addTable(state, {
    id: 't-user',
    name: 'user',
    columns: [PRIMARY_KEY, ...userColumns],
  });
  addTable(state, {
    id: 't-order',
    name: 'order',
    columns: [PRIMARY_KEY, ...columns],
  });
  return state;
}

/** An employee table holding the given columns after its id. */
function createEmployeeState(columns: ColumnInput[]): RootState {
  const state = createState();
  addTable(state, {
    id: 't-employee',
    name: 'employee',
    columns: [PRIMARY_KEY, ...columns],
  });
  return state;
}

function relateUserToOrder(
  state: RootState,
  relationshipType: number,
  endColumnIds: string[]
) {
  const id = `r-${state.doc.relationshipIds.length + 1}`;
  addRelationship(
    state,
    id,
    't-user',
    't-order',
    relationshipType,
    endColumnIds
  );
}

function relateEmployeeToItself(
  state: RootState,
  relationshipType: number,
  endColumnIds: string[]
) {
  const id = `r-${state.doc.relationshipIds.length + 1}`;
  addRelationship(
    state,
    id,
    't-employee',
    't-employee',
    relationshipType,
    endColumnIds
  );
}

describe('generator-code/graphql', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits types sorted by name with comments, ID fields and relation fields', () => {
    const state = createState();

    addTable(state, {
      id: 't-users',
      name: 'users',
      comment: 'user table',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'user id',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
          keys: ColumnUIKey.primaryKey,
        },
        {
          name: 'email',
          dataType: 'VARCHAR(255)',
          options: ColumnOption.notNull,
        },
        { name: 'age', dataType: 'INT' },
      ],
    });
    addTable(state, {
      id: 't-posts',
      name: 'posts',
      columns: [
        {
          name: 'id',
          dataType: 'BIGINT',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
          keys: ColumnUIKey.primaryKey,
        },
        {
          name: 'user_id',
          dataType: 'INT',
          options: ColumnOption.notNull,
          keys: ColumnUIKey.foreignKey,
        },
        {
          name: 'title',
          dataType: 'VARCHAR(100)',
          comment: 'post title',
        },
      ],
    });
    addRelationship(state, 'r-1', 't-users', 't-posts');

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Posts {',
        '  id: ID!',
        '  """post title"""',
        '  title: String',
        '  """user table"""',
        '  users: Users',
        '}',
        '',
        '"""user table"""',
        'type Users {',
        '  """user id"""',
        '  id: ID!',
        '  email: String!',
        '  age: Int',
        '  postsList: [Posts!]!',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('renders a foreign key that is also a primary key as a nullable ID', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-a',
      name: 'a',
      columns: [
        {
          name: 'user_id',
          dataType: 'INT',
          keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['type A {', '  userId: ID', '}']);
  });

  it('maps every primitive type to a GraphQL scalar', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-types',
      name: 'types',
      columns: [
        { name: 'intCol', dataType: 'INT' },
        { name: 'longCol', dataType: 'BIGINT' },
        { name: 'floatCol', dataType: 'FLOAT' },
        { name: 'doubleCol', dataType: 'DOUBLE' },
        { name: 'decimalCol', dataType: 'DECIMAL(10, 2)' },
        { name: 'booleanCol', dataType: 'BOOLEAN' },
        { name: 'stringCol', dataType: 'VARCHAR(10)' },
        { name: 'lobCol', dataType: 'TEXT' },
        { name: 'dateCol', dataType: 'DATE' },
        { name: 'timeCol', dataType: 'TIME' },
        { name: 'unknownCol', dataType: 'NOT_A_TYPE' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Types {',
      '  intCol: Int',
      '  longCol: Int',
      '  floatCol: Float',
      '  doubleCol: Float',
      '  decimalCol: Float',
      '  booleanCol: Boolean',
      '  stringCol: String',
      '  lobCol: String',
      '  dateCol: String',
      '  timeCol: String',
      '  unknownCol: String',
      '}',
    ]);
  });

  it('maps the dateTime primitive type to String', () => {
    const state = createState();
    state.settings.database = Database.Oracle;
    const table = addTable(state, {
      id: 't-ts',
      name: 'ts',
      columns: [{ name: 'created_at', dataType: 'TIMESTAMP' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['type Ts {', '  createdAt: String', '}']);
  });

  it('renders a one-to-one relationship as a single field on both sides', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a' });
    addTable(state, { id: 't-b', name: 'b' });
    addRelationship(state, 'r-1', 't-a', 't-b', RelationshipType.ZeroOne);

    expect(createCode(state)).toBe(
      ['', 'type A {', '  b: B', '}', '', 'type B {', '  a: A', '}', ''].join(
        '\n'
      )
    );
  });

  it('pushes the related table comment before each relation field', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a', comment: 'a table' });
    addTable(state, { id: 't-b', name: 'b', comment: 'b table' });
    addRelationship(state, 'r-1', 't-a', 't-b', RelationshipType.OneN);

    expect(createCode(state)).toBe(
      [
        '',
        '"""a table"""',
        'type A {',
        '  """b table"""',
        '  bList: [B!]!',
        '}',
        '',
        '"""b table"""',
        'type B {',
        '  """a table"""',
        '  a: A',
        '}',
        '',
      ].join('\n')
    );
  });

  it('numbers the fields of two relationships between one pair that no foreign key names', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a', comment: 'a table' });
    addTable(state, { id: 't-b', name: 'b', comment: 'b table' });
    addRelationship(state, 'r-1', 't-a', 't-b', RelationshipType.OneOnly);
    addRelationship(state, 'r-2', 't-a', 't-b', RelationshipType.ZeroOne);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        '"""a table"""',
        'type A {',
        '  """b table"""',
        '  b: B',
        '  """b table"""',
        '  b2: B',
        '}',
        '',
        '"""b table"""',
        'type B {',
        '  """a table"""',
        '  a: A',
        '  """a table"""',
        '  a2: A',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('skips the end side field for an unsupported relationship type', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a' });
    addTable(state, { id: 't-b', name: 'b' });
    addRelationship(state, 'r-1', 't-a', 't-b', 0);

    const code = createCode(state);

    expect(code).toBe(
      ['', 'type A', '', 'type B {', '  a: A', '}', ''].join('\n')
    );
    expectValidSDL(code);
  });

  it('ignores relationships pointing at a missing table', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a' });
    addTable(state, { id: 't-b', name: 'b' });
    addRelationship(state, 'r-1', 'ghost', 't-b');
    addRelationship(state, 'r-2', 't-a', 'ghost');

    const code = createCode(state);

    expect(code).toBe(['', 'type A', '', 'type B', ''].join('\n'));
    expectValidSDL(code);
  });

  it('omits the braces of a type whose every column is a foreign key', () => {
    const state = createState();
    addTable(state, {
      id: 't-a',
      name: 'a',
      comment: 'a table',
      columns: [
        { name: 'b_id', dataType: 'INT', keys: ColumnUIKey.foreignKey },
      ],
    });

    const code = createCode(state);

    expect(code).toBe(['', '"""a table"""', 'type A', ''].join('\n'));
    expectValidSDL(code);
  });

  it('names the child side of a self relationship with no foreign key after its parent', () => {
    const state = createState();
    addTable(state, {
      id: 't-users',
      name: 'users',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          options: ColumnOption.primaryKey,
          keys: ColumnUIKey.primaryKey,
        },
      ],
    });
    addRelationship(
      state,
      'r-1',
      't-users',
      't-users',
      RelationshipType.ZeroOne
    );

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Users {',
        '  id: ID',
        '  parentUsers: Users',
        '  users: Users',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('keeps both relationships of a pair that runs each way', () => {
    const state = createState();
    addTable(state, { id: 't-users', name: 'users' });
    addTable(state, { id: 't-profiles', name: 'profiles' });
    addRelationship(
      state,
      'r-1',
      't-users',
      't-profiles',
      RelationshipType.ZeroOne
    );
    addRelationship(
      state,
      'r-2',
      't-profiles',
      't-users',
      RelationshipType.OneOnly
    );

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Profiles {',
        '  users: Users',
        '  users2: Users',
        '}',
        '',
        'type Users {',
        '  profiles: Profiles',
        '  profiles2: Profiles',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('numbers a relation field that collides with a column name', () => {
    const state = createState();
    addTable(state, { id: 't-user', name: 'user' });
    addTable(state, {
      id: 't-post',
      name: 'post',
      columns: [{ name: 'user', dataType: 'VARCHAR(10)', comment: 'author' }],
    });
    addRelationship(state, 'r-1', 't-user', 't-post', RelationshipType.ZeroN);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Post {',
        '  """author"""',
        '  user: String',
        '  user2: User',
        '}',
        '',
        'type User {',
        '  postList: [Post!]!',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('drops the second relation field two tables outside one pair fold onto', () => {
    const state = createState();
    addTable(state, { id: 't-post', name: 'post' });
    addTable(state, { id: 't-1', name: 'user_profile' });
    addTable(state, { id: 't-2', name: 'UserProfile' });
    addRelationship(state, 'r-1', 't-1', 't-post');
    addRelationship(state, 'r-2', 't-2', 't-post');

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Post {',
        '  userProfile: UserProfile',
        '}',
        '',
        'type UserProfile {',
        '  postList: [Post!]!',
        '}',
        '',
        'type UserProfile2 {',
        '  postList: [Post!]!',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('drops a column whose name is already taken by another column', () => {
    const state = createState();
    addTable(state, {
      id: 't-user',
      name: 'user',
      columns: [
        { name: 'name', dataType: 'VARCHAR(10)' },
        { name: 'name', dataType: 'INT', comment: 'shadowed' },
        { name: 'user_id', dataType: 'INT' },
        { name: 'userId', dataType: 'INT' },
      ],
    });

    const code = createCode(state);

    expect(code).toBe(
      ['', 'type User {', '  name: String', '  userId: Int', '}', ''].join('\n')
    );
    expectValidSDL(code);
  });

  it('wraps a multi-line comment in a block string', () => {
    const state = createState();
    addTable(state, {
      id: 't-users',
      name: 'users',
      comment: 'line one\n\nline two',
      columns: [{ name: 'id', dataType: 'INT', comment: 'PK\nauto' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        '"""',
        'line one',
        '',
        'line two',
        '"""',
        'type Users {',
        '  """',
        '  PK',
        '  auto',
        '  """',
        '  id: Int',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('escapes a comment that would close its own block string', () => {
    const state = createState();
    addTable(state, {
      id: 't-notes',
      name: 'notes',
      comment: 'has """ inside',
      columns: [{ name: 'id', dataType: 'INT', comment: 'ends with "' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        '"""has \\""" inside"""',
        'type Notes {',
        '  """',
        '  ends with "',
        '  """',
        '  id: Int',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('replaces the characters a GraphQL name cannot hold', () => {
    const state = createState();
    addTable(state, {
      id: 't-order',
      name: '주문',
      comment: '주문 내역',
    });
    addTable(state, {
      id: 't-member',
      name: '회원',
      comment: '회원 정보',
      columns: [{ name: '이름', dataType: 'VARCHAR(10)' }],
    });
    addRelationship(
      state,
      'r-1',
      't-member',
      't-order',
      RelationshipType.ZeroN
    );

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        '"""주문 - 주문 내역"""',
        'type __ {',
        '  """회원 - 회원 정보"""',
        '  __: __2',
        '}',
        '',
        '"""회원 - 회원 정보"""',
        'type __2 {',
        '  """이름"""',
        '  __: String',
        '  """주문 - 주문 내역"""',
        '  __list: [__!]!',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('prefixes a name that starts with a digit', () => {
    const state = createState();
    addTable(state, {
      id: 't-token',
      name: '2fa_token',
      columns: [{ name: '2step', dataType: 'INT' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      ['', 'type _2FaToken {', '  _2Step: Int', '}', ''].join('\n')
    );
    expectValidSDL(code);
  });

  it('falls back to a placeholder for an empty name', () => {
    const state = createState();
    addTable(state, {
      id: 't-new',
      name: '',
      columns: [{ name: '', dataType: 'INT' }],
    });

    const code = createCode(state);

    expect(code).toBe(['', 'type _ {', '  _: Int', '}', ''].join('\n'));
    expectValidSDL(code);
  });

  it('replaces the spaces a name keeps under NameCase.none', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.none;
    state.settings.columnNameCase = NameCase.none;
    addTable(state, {
      id: 't-user',
      name: 'user table',
      columns: [{ name: 'first name', dataType: 'VARCHAR(10)' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      ['', 'type user_table {', '  first_name: String', '}', ''].join('\n')
    );
    expectValidSDL(code);
  });

  it('suffixes a type name two tables fold onto', () => {
    const state = createState();
    addTable(state, {
      id: 't-1',
      name: 'user_profile',
      columns: [{ name: 'id', dataType: 'INT' }],
    });
    addTable(state, {
      id: 't-2',
      name: 'UserProfile',
      columns: [{ name: 'code', dataType: 'INT' }],
    });

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type UserProfile {',
        '  id: Int',
        '}',
        '',
        'type UserProfile2 {',
        '  code: Int',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('gives a relation field the same type name the document assigned', () => {
    const state = createState();
    addTable(state, { id: 't-1', name: 'user_profile' });
    addTable(state, { id: 't-2', name: 'UserProfile' });
    addRelationship(state, 'r-1', 't-1', 't-2', RelationshipType.ZeroOne);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type UserProfile {',
        '  userProfile: UserProfile2',
        '}',
        '',
        'type UserProfile2 {',
        '  userProfile: UserProfile',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('applies the configured table and column name cases', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.pascalCase;
    const table = addTable(state, {
      id: 't-user-profile',
      name: 'UserProfile',
      columns: [
        {
          name: 'user_id',
          dataType: 'INT',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['type user_profile {', '  UserId: ID!', '}']);
  });

  it('names two relationships to one table after their foreign keys', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.OneN, ['t-order-c2']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  buyer: User',
        '  seller: User',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderListByBuyer: [Order!]!',
        '  orderListBySeller: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('keeps the table name for a lone relationship whatever its foreign key', () => {
    const state = createOrderState([foreignKey('buyer_id')]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  user: User',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderList: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('names only the relationships of a shared pair after their foreign keys', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
      foreignKey('owner_id'),
    ]);
    addTable(state, { id: 't-shop', name: 'shop', columns: [PRIMARY_KEY] });
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
    addRelationship(state, 'r-3', 't-shop', 't-order', RelationshipType.ZeroN, [
      't-order-c3',
    ]);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  buyer: User',
        '  seller: User',
        '  shop: Shop',
        '}',
        '',
        'type Shop {',
        '  id: ID!',
        '  orderList: [Order!]!',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderListByBuyer: [Order!]!',
        '  orderListBySeller: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('leaves List out of the parent field on a one side', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroOne, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.OneOnly, ['t-order-c2']);

    const code = createCode(state);

    expect(code).toContain(['  buyer: User', '  seller: User'].join('\n'));
    expect(code).toContain(
      ['  orderByBuyer: Order', '  orderBySeller: Order'].join('\n')
    );
    expectServableSDL(code);
  });

  it('drops a last word id in any case, split as foreign key names split', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('sellerId'),
      foreignKey('OwnerID'),
      foreignKey('vip회원ID'),
      foreignKey('order_item_id'),
    ]);
    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(column =>
      relateUserToOrder(state, RelationshipType.ZeroN, [`t-order-${column}`])
    );

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  buyer: User',
        '  seller: User',
        '  owner: User',
        '  vip__: User',
        '  orderItem: User',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderListByBuyer: [Order!]!',
        '  orderListBySeller: [Order!]!',
        '  orderListByOwner: [Order!]!',
        '  orderListByVip__: [Order!]!',
        '  orderListByOrderItem: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it.each([
    ['no id word', [foreignKey('buyer')], ['t-order-c2']],
    ['a last word ids', [foreignKey('buyer_ids')], ['t-order-c2']],
    ['an id with a digit', [foreignKey('buyer_id2')], ['t-order-c2']],
    ['id as the only word', [foreignKey('Id')], ['t-order-c2']],
    ['a name in one case', [foreignKey('BUYERID')], ['t-order-c2']],
    ['an id a case break splits', [foreignKey('buyer_iD')], ['t-order-c2']],
    ['no letter before id', [foreignKey('2Id')], ['t-order-c2']],
    ['an empty name', [foreignKey('')], ['t-order-c2']],
    [
      'a stem the case transform empties',
      [foreignKey('\u0301_id')],
      ['t-order-c2'],
    ],
    ['a stem in a non-ASCII script', [foreignKey('회원ID')], ['t-order-c2']],
    [
      'a composite key',
      [foreignKey('buyer_id'), foreignKey('buyer_no')],
      ['t-order-c2', 't-order-c3'],
    ],
    ['a missing column', [], ['ghost']],
  ])(
    'falls back to the table name for a foreign key with %s',
    (_, columns, endColumnIds) => {
      const state = createOrderState([foreignKey('seller_id'), ...columns]);
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
      relateUserToOrder(state, RelationshipType.ZeroN, endColumnIds);

      const code = createCode(state);

      expect(code).toBe(
        [
          '',
          'type Order {',
          '  id: ID!',
          '  seller: User',
          '  user: User',
          '}',
          '',
          'type User {',
          '  id: ID!',
          '  orderListBySeller: [Order!]!',
          '  orderList: [Order!]!',
          '}',
          '',
        ].join('\n')
      );
      expectServableSDL(code);
    }
  );

  it.each([
    [
      'a mixed-script stem',
      '회원No_id',
      NameCase.camelCase,
      '  orderList: [Order!]!',
    ],
    [
      'a mixed-script stem under snake case',
      '회원_no_id',
      NameCase.snakeCase,
      '  order_list: [Order!]!',
    ],
    [
      'a stem opening with two underscores',
      '__buyer_id',
      NameCase.none,
      '  orderList: [Order!]!',
    ],
  ])(
    'falls back to the table name for %s a Name would open with __',
    (_, column, columnNameCase, parentField) => {
      const state = createOrderState([
        foreignKey('seller_id'),
        foreignKey(column),
      ]);
      state.settings.columnNameCase = columnNameCase;
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);

      const code = createCode(state);

      expect(code).toContain(['  user: User', '}'].join('\n'));
      expect(code).toContain([parentField, '}'].join('\n'));
      expectServableSDL(code);
    }
  );

  it('numbers the table name each fallback field takes', () => {
    const state = createOrderState([foreignKey('buyer'), foreignKey('seller')]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);

    const code = createCode(state);

    expect(code).toContain(['  user: User', '  user2: User'].join('\n'));
    expect(code).toContain(
      ['  orderList: [Order!]!', '  orderList2: [Order!]!'].join('\n')
    );
    expectServableSDL(code);
  });

  it('falls back to the table name for the user_id_2 a second relationship draws', () => {
    const state = createOrderState([
      foreignKey('user_id'),
      foreignKey('user_id_2'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Order {',
        '  id: ID!',
        '  user: User',
        '  user2: User',
        '}',
        '',
        'type User {',
        '  id: ID!',
        '  orderListByUser: [Order!]!',
        '  orderList: [Order!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('numbers a foreign key name that collides with a column name', () => {
    const state = createOrderState([
      { name: 'buyer', dataType: 'VARCHAR(10)' },
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);

    const code = createCode(state);

    expect(code).toContain(
      [
        'type Order {',
        '  id: ID!',
        '  buyer: String',
        '  buyer2: User',
        '  seller: User',
        '}',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('names a self relationship after its foreign key on both sides', () => {
    const state = createEmployeeState([foreignKey('manager_id')]);
    relateEmployeeToItself(state, RelationshipType.ZeroN, ['t-employee-c1']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Employee {',
        '  id: ID!',
        '  manager: Employee',
        '  employeeListByManager: [Employee!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it('keeps the table name on the parent side of a self relationship with no id word', () => {
    const state = createEmployeeState([foreignKey('boss')]);
    relateEmployeeToItself(state, RelationshipType.ZeroN, ['t-employee-c1']);

    const code = createCode(state);

    expect(code).toBe(
      [
        '',
        'type Employee {',
        '  id: ID!',
        '  parentEmployee: Employee',
        '  employeeList: [Employee!]!',
        '}',
        '',
      ].join('\n')
    );
    expectServableSDL(code);
  });

  it.each([
    [
      'snake case',
      NameCase.snakeCase,
      ['  buyer: User', '  order_list_by_buyer: [Order!]!'],
    ],
    [
      'pascal case',
      NameCase.pascalCase,
      ['  Buyer: User', '  OrderListByBuyer: [Order!]!'],
    ],
    [
      'no name case',
      NameCase.none,
      ['  buyer: User', '  orderList_by_buyer: [Order!]!'],
    ],
  ])(
    'applies the column name case to both foreign key names under %s',
    (_, columnNameCase, [childField, parentField]) => {
      const state = createOrderState([
        foreignKey('buyer_id'),
        foreignKey('seller_id'),
      ]);
      state.settings.columnNameCase = columnNameCase;
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
      relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);

      const code = createCode(state);

      expect(code).toContain(childField);
      expect(code).toContain(parentField);
      expectServableSDL(code);
    }
  );

  it('names relation fields the same way in the standalone formatTable', () => {
    const state = createOrderState([
      foreignKey('buyer_id'),
      foreignKey('seller_id'),
    ]);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
    relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
    const buffer: string[] = [];

    formatTable(state, {
      buffer,
      table: state.collections.tableEntities['t-order'],
    });

    expect(buffer).toEqual([
      'type Order {',
      '  id: ID!',
      '  buyer: User',
      '  seller: User',
      '}',
    ]);
  });
});

// Where numbering leaves two names alike the importer cannot pair them, so the
// second table pins what imports back with more; the first keeps every count.
describe('generator-code/graphql round trip through schema-graphql-parser', () => {
  it.each<[string, () => RootState]>([
    [
      'a 1:N pair',
      () => {
        const state = createOrderState([foreignKey('user_id')]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        return state;
      },
    ],
    [
      'a 1:1 pair',
      () => {
        const state = createOrderState([foreignKey('user_id')]);
        relateUserToOrder(state, RelationshipType.OneOnly, ['t-order-c1']);
        return state;
      },
    ],
    [
      'a relation field numbered past a column',
      () => {
        const state = createOrderState([
          { name: 'user', dataType: 'VARCHAR(10)' },
          foreignKey('user_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'a self relationship on manager_id',
      () => {
        const state = createEmployeeState([foreignKey('manager_id')]);
        relateEmployeeToItself(state, RelationshipType.ZeroN, [
          't-employee-c1',
        ]);
        return state;
      },
    ],
    [
      'a self relationship on boss',
      () => {
        const state = createEmployeeState([foreignKey('boss')]);
        relateEmployeeToItself(state, RelationshipType.ZeroOne, [
          't-employee-c1',
        ]);
        return state;
      },
    ],
    [
      'two foreign keys to one table',
      () => {
        const state = createOrderState([
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.OneN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'two foreign keys to one table on a one side',
      () => {
        const state = createOrderState([
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroOne, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.OneOnly, ['t-order-c2']);
        return state;
      },
    ],
    [
      'a pair three relationships join, one of them back the other way',
      () => {
        const state = createOrderState([
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.OneN, ['t-order-c2']);
        addRelationship(
          state,
          'r-3',
          't-order',
          't-user',
          RelationshipType.ZeroOne
        );
        return state;
      },
    ],
    [
      'a foreign key name numbered past a column',
      () => {
        const state = createOrderState([
          { name: 'buyer', dataType: 'VARCHAR(10)' },
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        return state;
      },
    ],
    [
      'a table name fallback ahead of a foreign key name',
      () => {
        const state = createOrderState([
          foreignKey('buyer'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'the user_id_2 a second relationship draws',
      () => {
        const state = createOrderState([
          foreignKey('user_id'),
          foreignKey('user_id_2'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'two self relationships',
      () => {
        const state = createEmployeeState([
          foreignKey('manager_id'),
          foreignKey('mentor_id'),
        ]);
        relateEmployeeToItself(state, RelationshipType.ZeroN, [
          't-employee-c1',
        ]);
        relateEmployeeToItself(state, RelationshipType.ZeroOne, [
          't-employee-c2',
        ]);
        return state;
      },
    ],
    [
      'a self relationship fallback ahead of a foreign key name',
      () => {
        const state = createEmployeeState([
          foreignKey('mentor'),
          foreignKey('manager_id'),
        ]);
        relateEmployeeToItself(state, RelationshipType.ZeroN, [
          't-employee-c1',
        ]);
        relateEmployeeToItself(state, RelationshipType.ZeroN, [
          't-employee-c2',
        ]);
        return state;
      },
    ],
    [
      'two foreign key names each numbered past a column',
      () => {
        const state = createOrderState([
          { name: 'buyer', dataType: 'VARCHAR(10)' },
          { name: 'seller', dataType: 'VARCHAR(10)' },
          foreignKey('buyer_id'),
          foreignKey('seller_id'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c4']);
        return state;
      },
    ],
    [
      'a foreign key name numbered past a column beside a table name fallback',
      () => {
        const state = createOrderState([
          { name: 'buyer', dataType: 'INT' },
          foreignKey('buyer_id'),
          foreignKey('owner'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        return state;
      },
    ],
    [
      'a foreign key name and the user_id_2 fallback numbered past a column',
      () => {
        const state = createOrderState([
          { name: 'user', dataType: 'INT' },
          foreignKey('user_id'),
          foreignKey('user_id_2'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        return state;
      },
    ],
    [
      'a parent field numbered past a column beside a table name fallback',
      () => {
        const state = createOrderState(
          [foreignKey('buyer_id'), foreignKey('owner')],
          [{ name: 'orderListByBuyer', dataType: 'VARCHAR(10)' }]
        );
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'a foreign key name holding another after by',
      () => {
        const state = createOrderState([
          foreignKey('user_id'),
          foreignKey('created_by_user_id'),
          foreignKey('owner'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c3']);
        return state;
      },
    ],
  ])('imports %s back with as many relationships', (_, createDocument) => {
    const state = createDocument();

    const code = createCode(state);

    expect(importedRelationshipCount(code)).toBe(
      state.doc.relationshipIds.length
    );
    expectServableSDL(code);
  });

  it.each<[string, () => RootState]>([
    [
      'two relationships of one pair that no foreign key names',
      () => {
        const state = createOrderState([
          foreignKey('buyer'),
          foreignKey('seller'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'two foreign keys giving one name on a one and a many side',
      () => {
        const state = createOrderState([
          foreignKey('buyer_id'),
          foreignKey('BuyerID'),
        ]);
        relateUserToOrder(state, RelationshipType.ZeroOne, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c2']);
        return state;
      },
    ],
    [
      'a foreign key stem ending in a digit that numbering repeats',
      () => {
        const state = createOrderState(
          [foreignKey('buyer_id'), foreignKey('buyer2_id')],
          [{ name: 'orderListByBuyer', dataType: 'VARCHAR(10)' }]
        );
        relateUserToOrder(state, RelationshipType.ZeroN, ['t-order-c1']);
        relateUserToOrder(state, RelationshipType.ZeroOne, ['t-order-c2']);
        return state;
      },
    ],
  ])(
    'imports %s back with twice as many relationships',
    (_, createDocument) => {
      const state = createDocument();

      const code = createCode(state);

      expect(importedRelationshipCount(code)).toBe(
        state.doc.relationshipIds.length * 2
      );
      expectServableSDL(code);
    }
  );
});
