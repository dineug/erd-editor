import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/go';

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

describe('generator-code/go', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits structs sorted by name with comments and pointer nullables', () => {
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
        'type Posts struct {',
        '\tId int64 `json:"id"`',
        '}',
        '',
        '// user table',
        'type Users struct {',
        '\t// user id',
        '\tId       int32   `json:"id"`',
        '\tNickName *string `json:"nick_name"`',
        '}',
        '',
      ].join('\n')
    );
  });

  it('maps every primitive type to a Go type', () => {
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
      'type Types struct {',
      '\tIntCol     int32           `json:"intCol"`',
      '\tLongCol    int64           `json:"longCol"`',
      '\tFloatCol   float32         `json:"floatCol"`',
      '\tDoubleCol  float64         `json:"doubleCol"`',
      '\tDecimalCol decimal.Decimal `json:"decimalCol"`',
      '\tBooleanCol bool            `json:"booleanCol"`',
      '\tStringCol  string          `json:"stringCol"`',
      '\tLobCol     string          `json:"lobCol"`',
      '\tDateCol    time.Time       `json:"dateCol"`',
      '\tTimeCol    time.Time       `json:"timeCol"`',
      '\tUnknownCol string          `json:"unknownCol"`',
      '}',
    ]);
  });

  it('maps the dateTime primitive type to time.Time', () => {
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
      'type Ts struct {',
      '\tCreatedAt time.Time `json:"created_at"`',
      '}',
    ]);
  });

  it('points at the type for columns without the not null option', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-nullable',
      name: 'nullable',
      columns: [
        { name: 'intCol', dataType: 'INT', options: ColumnOption.primaryKey },
        { name: 'boolCol', dataType: 'BOOLEAN', comment: 'a flag' },
        { name: 'amount', dataType: 'DECIMAL(10, 2)' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Nullable struct {',
      '\tIntCol *int32 `json:"intCol"`',
      '\t// a flag',
      '\tBoolCol *bool            `json:"boolCol"`',
      '\tAmount  *decimal.Decimal `json:"amount"`',
      '}',
    ]);
  });

  it('restarts the column alignment at a comment, the way gofmt does', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-runs',
      name: 'runs',
      columns: [
        { name: 'id', dataType: 'INT', options: ColumnOption.notNull },
        {
          name: 'name',
          dataType: 'VARCHAR(10)',
          options: ColumnOption.notNull,
        },
        {
          name: 'settled_amount',
          dataType: 'DECIMAL(19, 4)',
          comment: 'in the account currency',
          options: ColumnOption.notNull,
        },
        { name: 'memo', dataType: 'TEXT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Runs struct {',
      '\tId   int32  `json:"id"`',
      '\tName string `json:"name"`',
      '\t// in the account currency',
      '\tSettledAmount decimal.Decimal `json:"settled_amount"`',
      '\tMemo          string          `json:"memo"`',
      '}',
    ]);
  });

  it('exports the struct and its fields whatever the name case setting is', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.camelCase;
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
      'type User_profile struct {',
      '\tUserId int32 `json:"user_id"`',
      '}',
    ]);
  });

  it('keeps the tag on the column name the database spells, not the cased one', () => {
    const state = createState();
    state.settings.columnNameCase = NameCase.pascalCase;
    const table = addTable(state, {
      id: 't-tags',
      name: 'tags',
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
      'type Tags struct {',
      '\tCreatedAt time.Time `json:"created_at"`',
      '}',
    ]);
  });

  it('escapes a quote or a backslash so the tag reads back as the column name', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-quoted',
      name: 'quoted',
      columns: [
        { name: 'say"hi', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'back\\slash', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'plain', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Quoted struct {',
      '\tSayHi     int32 `json:"say\\"hi"`',
      '\tBackSlash int32 `json:"back\\\\slash"`',
      '\tPlain     int32 `json:"plain"`',
      '}',
    ]);
  });

  it('falls back to an interpreted tag literal for a name holding a backtick', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-backtick',
      name: 'backtick',
      columns: [
        { name: 'we`ird', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Backtick struct {',
      '\tWeIrd int32 "json:\\"we`ird\\""',
      '}',
    ]);
  });

  it('emits an empty struct body for a table without columns', () => {
    const state = createState();
    const table = addTable(state, { id: 't-empty', name: 'empty' });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['type Empty struct {', '}']);
  });

  it('leaves no trailing whitespace on a field line', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-widths',
      name: 'widths',
      columns: [
        { name: 'a', dataType: 'INT', options: ColumnOption.notNull },
        {
          name: 'bbbbbbbb',
          dataType: 'DECIMAL(10, 2)',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    buffer.forEach(line => expect(line).toBe(line.trimEnd()));
  });
});
