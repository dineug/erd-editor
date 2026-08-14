import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vitest';

import { ColumnOption, ColumnType, Show } from '@/constants/schema';
import { createEditor, FocusType } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { tableCopyToHtml, tableCopyToText } from '@/utils/table-clipboard/copy';

const ALL_SHOW =
  Show.tableComment |
  Show.columnComment |
  Show.columnDataType |
  Show.columnDefault |
  Show.columnAutoIncrement |
  Show.columnPrimaryKey |
  Show.columnUnique |
  Show.columnNotNull |
  Show.relationship;

const FULL_COLUMN_ORDER = [
  ColumnType.columnName,
  ColumnType.columnDataType,
  ColumnType.columnNotNull,
  ColumnType.columnUnique,
  ColumnType.columnAutoIncrement,
  ColumnType.columnDefault,
  ColumnType.columnComment,
];

type Options = {
  tables?: Table[];
  columns?: Column[];
  show?: number;
  columnOrder?: number[];
  focusTable?: Partial<{
    tableId: string;
    selectColumnIds: string[];
    edit: boolean;
  }> | null;
};

function createState({
  tables = [],
  columns = [],
  show = ALL_SHOW,
  columnOrder = FULL_COLUMN_ORDER,
  focusTable = null,
}: Options = {}): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };

  state.settings.show = show;
  state.settings.columnOrder = columnOrder;

  for (const table of tables) {
    state.collections.tableEntities[table.id] = table;
  }
  for (const column of columns) {
    state.collections.tableColumnEntities[column.id] = column;
  }

  if (focusTable) {
    state.editor.focusTable = {
      tableId: focusTable.tableId ?? '',
      columnId: null,
      focusType: FocusType.columnName,
      selectColumnIds: focusTable.selectColumnIds ?? [],
      prevSelectColumnId: null,
      edit: focusTable.edit ?? false,
    };
  }

  return state;
}

function createFixture() {
  const idColumn = createColumn({
    id: 'column-id',
    tableId: 'table-1',
    name: 'id',
    dataType: 'int',
    default: '',
    comment: 'pk',
    options: ColumnOption.autoIncrement | ColumnOption.notNull,
  });
  const nameColumn = createColumn({
    id: 'column-name',
    tableId: 'table-1',
    name: 'name',
    dataType: 'varchar(50)',
    default: "''",
    comment: 'user name',
    options: ColumnOption.unique,
  });
  const table = createTable({
    id: 'table-1',
    name: 'users',
    columnIds: ['column-id', 'column-name'],
  });

  return { table, idColumn, nameColumn };
}

describe('tableCopyToText', () => {
  it('renders one tab separated line per selected column', () => {
    const { table, idColumn, nameColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn, nameColumn],
      focusTable: {
        tableId: 'table-1',
        selectColumnIds: ['column-id', 'column-name'],
      },
    });

    expect(tableCopyToText(state)).toBe(
      [
        ['id', 'int', 'NOT NULL', 'FALSE', 'TRUE', '', 'pk'].join('\t'),
        [
          'name',
          'varchar(50)',
          'NULL',
          'TRUE',
          'FALSE',
          "''",
          'user name',
        ].join('\t'),
      ].join('\n')
    );
  });

  it('follows the table column order, not the selection order', () => {
    const { table, idColumn, nameColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn, nameColumn],
      columnOrder: [ColumnType.columnName],
      focusTable: {
        tableId: 'table-1',
        selectColumnIds: ['column-name', 'column-id'],
      },
    });

    expect(tableCopyToText(state)).toBe('id\nname');
  });

  it('only emits the visible column types', () => {
    const { table, idColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn],
      show: Show.columnDataType,
      focusTable: { tableId: 'table-1', selectColumnIds: ['column-id'] },
    });

    expect(tableCopyToText(state)).toBe('id\tint');
  });

  it('returns an empty string when there is no focused table', () => {
    const { table, idColumn } = createFixture();
    const state = createState({ tables: [table], columns: [idColumn] });

    expect(tableCopyToText(state)).toBe('');
  });

  it('returns an empty string while the focused table is being edited', () => {
    const { table, idColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn],
      focusTable: {
        tableId: 'table-1',
        selectColumnIds: ['column-id'],
        edit: true,
      },
    });

    expect(tableCopyToText(state)).toBe('');
  });

  it('returns an empty string when no column is selected', () => {
    const { table, idColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn],
      focusTable: { tableId: 'table-1', selectColumnIds: [] },
    });

    expect(tableCopyToText(state)).toBe('');
  });

  it('returns an empty string when the focused table does not exist', () => {
    const { idColumn } = createFixture();
    const state = createState({
      columns: [idColumn],
      focusTable: { tableId: 'missing', selectColumnIds: ['column-id'] },
    });

    expect(tableCopyToText(state)).toBe('');
  });

  it('ignores selected ids that are not columns of the focused table', () => {
    const { table, idColumn, nameColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn, nameColumn],
      columnOrder: [ColumnType.columnName],
      focusTable: {
        tableId: 'table-1',
        selectColumnIds: ['column-id', 'column-not-in-table'],
      },
    });

    expect(tableCopyToText(state)).toBe('id');
  });
});

describe('tableCopyToHtml', () => {
  it('wraps every cell in a td carrying its cell type', () => {
    const { table, idColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn],
      columnOrder: [
        ColumnType.columnName,
        ColumnType.columnDataType,
        ColumnType.columnNotNull,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
        ColumnType.columnDefault,
        ColumnType.columnComment,
      ],
      focusTable: { tableId: 'table-1', selectColumnIds: ['column-id'] },
    });

    expect(tableCopyToHtml(state)).toBe(
      '<table><tbody><tr>' +
        '<td data-type="columnName">id</td>' +
        '<td data-type="columnDataType">int</td>' +
        '<td data-type="columnNotNull">NOT NULL</td>' +
        '<td data-type="columnUnique">FALSE</td>' +
        '<td data-type="columnAutoIncrement">TRUE</td>' +
        '<td data-type="columnDefault"></td>' +
        '<td data-type="columnComment">pk</td>' +
        '</tr></tbody></table>'
    );
  });

  it('emits one tr per selected column', () => {
    const { table, idColumn, nameColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn, nameColumn],
      columnOrder: [ColumnType.columnName],
      focusTable: {
        tableId: 'table-1',
        selectColumnIds: ['column-id', 'column-name'],
      },
    });

    expect(tableCopyToHtml(state)).toBe(
      '<table><tbody>' +
        '<tr><td data-type="columnName">id</td></tr>' +
        '<tr><td data-type="columnName">name</td></tr>' +
        '</tbody></table>'
    );
  });

  it('returns an empty string when there is nothing to copy', () => {
    expect(tableCopyToHtml(createState())).toBe('');
  });
});
