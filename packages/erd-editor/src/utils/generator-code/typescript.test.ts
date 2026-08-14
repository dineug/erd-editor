import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vitest';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/typescript';

type ColumnInput = {
  name: string;
  dataType?: string;
  comment?: string;
  options?: number;
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

describe('generator-code/typescript', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits interfaces sorted by name with comments and nullable unions', () => {
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
        },
        { name: 'nick_name', dataType: 'VARCHAR(50)' },
      ],
    });
    addTable(state, {
      id: 't-posts',
      name: 'posts',
      columns: [
        { name: 'id', dataType: 'BIGINT', options: ColumnOption.notNull },
      ],
    });

    expect(createCode(state)).toBe(
      [
        '',
        'export interface Posts {',
        '  id: number;',
        '}',
        '',
        '// user table',
        'export interface Users {',
        '  // user id',
        '  id: number;',
        '  nickName: string | null;',
        '}',
        '',
      ].join('\n')
    );
  });

  it('maps every primitive type to a TypeScript type', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-types',
      name: 'types',
      columns: [
        { name: 'intCol', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'longCol', dataType: 'BIGINT', options: ColumnOption.notNull },
        { name: 'floatCol', dataType: 'FLOAT', options: ColumnOption.notNull },
        {
          name: 'doubleCol',
          dataType: 'DOUBLE',
          options: ColumnOption.notNull,
        },
        {
          name: 'decimalCol',
          dataType: 'DECIMAL(10, 2)',
          options: ColumnOption.notNull,
        },
        {
          name: 'booleanCol',
          dataType: 'BOOLEAN',
          options: ColumnOption.notNull,
        },
        {
          name: 'stringCol',
          dataType: 'VARCHAR(10)',
          options: ColumnOption.notNull,
        },
        { name: 'lobCol', dataType: 'TEXT', options: ColumnOption.notNull },
        { name: 'dateCol', dataType: 'DATE', options: ColumnOption.notNull },
        { name: 'timeCol', dataType: 'TIME', options: ColumnOption.notNull },
        {
          name: 'unknownCol',
          dataType: 'NOT_A_TYPE',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'export interface Types {',
      '  intCol: number;',
      '  longCol: number;',
      '  floatCol: number;',
      '  doubleCol: number;',
      '  decimalCol: number;',
      '  booleanCol: boolean;',
      '  stringCol: string;',
      '  lobCol: string;',
      '  dateCol: string;',
      '  timeCol: string;',
      '  unknownCol: string;',
      '}',
    ]);
  });

  it('maps the dateTime primitive type to string', () => {
    const state = createState();
    state.settings.database = Database.Oracle;
    const table = addTable(state, {
      id: 't-ts',
      name: 'ts',
      columns: [
        {
          name: 'created_at',
          dataType: 'TIMESTAMP',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'export interface Ts {',
      '  createdAt: string;',
      '}',
    ]);
  });

  it('appends a null union for columns without the not null option', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-nullable',
      name: 'nullable',
      columns: [
        { name: 'intCol', dataType: 'INT', options: ColumnOption.primaryKey },
        { name: 'boolCol', dataType: 'BOOLEAN', comment: 'a flag' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'export interface Nullable {',
      '  intCol: number | null;',
      '  // a flag',
      '  boolCol: boolean | null;',
      '}',
    ]);
  });

  it('applies the configured table and column name cases', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.pascalCase;
    const table = addTable(state, {
      id: 't-user-profile',
      name: 'UserProfile',
      columns: [
        { name: 'user_id', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'export interface user_profile {',
      '  UserId: number;',
      '}',
    ]);
  });
});
