import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  Database,
  NameCase,
  RelationshipType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/graphql';

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
  relationshipType: number = RelationshipType.ZeroN
) {
  const relationship = createRelationship({
    id,
    relationshipType,
    start: { tableId: startTableId },
    end: { tableId: endTableId },
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

  it('deduplicates identical relation fields', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a', comment: 'a table' });
    addTable(state, { id: 't-b', name: 'b', comment: 'b table' });
    addRelationship(state, 'r-1', 't-a', 't-b', RelationshipType.OneOnly);
    addRelationship(state, 'r-2', 't-a', 't-b', RelationshipType.ZeroOne);

    expect(createCode(state)).toBe(
      [
        '',
        '"""a table"""',
        'type A {',
        '  """b table"""',
        '  b: B',
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

  it('emits a single field for a self-referencing relationship', () => {
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
      ['', 'type Users {', '  id: ID', '  users: Users', '}', ''].join('\n')
    );
    expectValidSDL(code);
  });

  it('emits a single field per side of a bidirectional relationship pair', () => {
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
        '}',
        '',
        'type Users {',
        '  profiles: Profiles',
        '}',
        '',
      ].join('\n')
    );
    expectValidSDL(code);
  });

  it('drops a relation field that collides with a column name', () => {
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
});
