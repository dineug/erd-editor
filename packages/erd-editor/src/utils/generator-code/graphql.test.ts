import { schemaV3Parser } from '@dineug/erd-editor-schema';
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

    expect(createCode(state)).toBe(
      [
        '',
        'type Posts {',
        '  id: ID!',
        '  # post title',
        '  title: String',
        '  # user table',
        '  users: Users',
        '}',
        '',
        '# user table',
        'type Users {',
        '  # user id',
        '  id: ID!',
        '  email: String!',
        '  age: Int',
        '  postsList: [Posts!]!',
        '}',
        '',
      ].join('\n')
    );
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
        '# a table',
        'type A {',
        '  # b table',
        '  bList: [B!]!',
        '}',
        '',
        '# b table',
        'type B {',
        '  # a table',
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
        '# a table',
        'type A {',
        '  # b table',
        '  b: B',
        '}',
        '',
        '# b table',
        'type B {',
        '  # a table',
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

    expect(createCode(state)).toBe(
      ['', 'type A {', '}', '', 'type B {', '  a: A', '}', ''].join('\n')
    );
  });

  it('ignores relationships pointing at a missing table', () => {
    const state = createState();
    addTable(state, { id: 't-a', name: 'a' });
    addTable(state, { id: 't-b', name: 'b' });
    addRelationship(state, 'r-1', 'ghost', 't-b');
    addRelationship(state, 'r-2', 't-a', 'ghost');

    expect(createCode(state)).toBe(
      ['', 'type A {', '}', '', 'type B {', '}', ''].join('\n')
    );
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
