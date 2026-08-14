import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vitest';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/scala';

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

describe('generator-code/scala', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits case classes sorted by name, with a trailing comma on every field but the last', () => {
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
      columns: [{ name: 'id', dataType: 'BIGINT' }],
    });

    expect(createCode(state)).toBe(
      [
        '',
        '@Data',
        'case class Posts(',
        ' id: Long',
        ')',
        '',
        '// user table',
        '@Data',
        'case class Users(',
        ' // user id',
        ' id: Int,',
        ' nickName: String',
        ')',
        '',
      ].join('\n')
    );
  });

  it('emits an empty parameter list for a table without columns', () => {
    const state = createState();
    const table = addTable(state, { id: 't-empty', name: 'empty' });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['@Data', 'case class Empty(', ')']);
  });

  it('maps every primitive type to a Scala type', () => {
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
      '@Data',
      'case class Types(',
      ' intCol: Int,',
      ' longCol: Long,',
      ' floatCol: Float,',
      ' doubleCol: Double,',
      ' decimalCol: BigDecimal,',
      ' booleanCol: Boolean,',
      ' stringCol: String,',
      ' lobCol: String,',
      ' dateCol: LocalDate,',
      ' timeCol: LocalTime,',
      ' unknownCol: String',
      ')',
    ]);
  });

  it('maps the dateTime primitive type to LocalDateTime', () => {
    const state = createState();
    state.settings.database = Database.Oracle;
    const table = addTable(state, {
      id: 't-ts',
      name: 'ts',
      columns: [{ name: 'created_at', dataType: 'TIMESTAMP' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '@Data',
      'case class Ts(',
      ' createdAt: LocalDateTime',
      ')',
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
        { name: 'user_id', dataType: 'INT', comment: 'the id' },
        { name: 'user_name', dataType: 'VARCHAR(10)' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '@Data',
      'case class user_profile(',
      ' // the id',
      ' UserId: Int,',
      ' UserName: String',
      ')',
    ]);
  });
});
