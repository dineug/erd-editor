import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/csharp';

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

describe('generator-code/csharp', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits classes sorted by name with table and column comments', () => {
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
        'public class Posts {',
        '  public long Id { get; set; }',
        '}',
        '',
        '// user table',
        'public class Users {',
        '  // user id',
        '  public int Id { get; set; }',
        '  public string NickName { get; set; }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('maps every primitive type to a C# type', () => {
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
      'public class Types {',
      '  public int IntCol { get; set; }',
      '  public long LongCol { get; set; }',
      '  public float FloatCol { get; set; }',
      '  public double DoubleCol { get; set; }',
      '  public decimal DecimalCol { get; set; }',
      '  public bool BooleanCol { get; set; }',
      '  public string StringCol { get; set; }',
      '  public string LobCol { get; set; }',
      '  public DateTime DateCol { get; set; }',
      '  public TimeSpan TimeCol { get; set; }',
      '  public string UnknownCol { get; set; }',
      '}',
    ]);
  });

  it('maps the dateTime primitive type to DateTime', () => {
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
      'public class Ts {',
      '  public DateTime CreatedAt { get; set; }',
      '}',
    ]);
  });

  it('applies the configured table and column name cases before upper casing the property', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.snakeCase;
    const table = addTable(state, {
      id: 't-user-profile',
      name: 'UserProfile',
      columns: [{ name: 'userId', dataType: 'INT' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'public class user_profile {',
      '  public int User_id { get; set; }',
      '}',
    ]);
  });

  it('renders an empty property name for a column without a name', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-empty',
      name: '',
      columns: [{ name: '', dataType: 'VARCHAR(10)' }],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'public class  {',
      '  public string  { get; set; }',
      '}',
    ]);
  });
});
