import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, ColumnType, Show } from '@/constants/schema';
import {
  createEditor,
  FocusType,
  SelectType,
} from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Column, Memo, Table } from '@/internal-types';
import { createMemo } from '@/utils/collection/memo.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  CLIPBOARD_FORMAT,
  CLIPBOARD_VERSION,
  ClipboardPayload,
  createPayload,
  HTML_PAYLOAD_MAX_BYTES,
  PayloadKind,
} from '@/utils/table-clipboard';
import {
  columnsCopyToPayload,
  entitiesCopyToPayload,
  entitiesToHtmlTable,
  entitiesToTsv,
  payloadToHtml,
  tableCopyToHtml,
  tableCopyToText,
} from '@/utils/table-clipboard/copy';
import { tablePasteFromHtmlToColumns } from '@/utils/table-clipboard/paste';

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
  memos?: Memo[];
  selectedMap?: Record<string, SelectType>;
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
  memos = [],
  selectedMap = {},
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
  for (const memo of memos) {
    state.collections.memoEntities[memo.id] = memo;
  }

  state.editor.selectedMap = { ...selectedMap };

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

function createEntitiesFixture() {
  const idColumn = createColumn({
    id: 'column-id',
    tableId: 'table-1',
    name: 'id',
    dataType: 'int',
    default: '',
    comment: 'pk',
    options: ColumnOption.autoIncrement | ColumnOption.notNull,
    ui: {
      keys: 1,
      widthName: 61,
      widthComment: 62,
      widthDataType: 63,
      widthDefault: 64,
    },
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
  const titleColumn = createColumn({
    id: 'column-title',
    tableId: 'table-2',
    name: 'title',
    dataType: 'text',
    default: '',
    comment: '',
    options: 0,
  });

  const usersTable = createTable({
    id: 'table-1',
    name: 'users',
    comment: 'app users',
    columnIds: ['column-id', 'column-name'],
    ui: { x: 120, y: 240, zIndex: 7, widthName: 91, widthComment: 92 },
  });
  const postsTable = createTable({
    id: 'table-2',
    name: 'posts',
    comment: '',
    columnIds: ['column-title'],
    ui: { x: 500, y: 300, zIndex: 8 },
  });

  const noteMemo = createMemo({
    id: 'memo-1',
    value: 'first memo',
    ui: { x: 700, y: 100, width: 220, height: 140, zIndex: 9 },
  });
  const gridBreakingMemo = createMemo({
    id: 'memo-2',
    value: 'second\tmemo\nwith a newline',
    ui: { x: 700, y: 300, width: 200, height: 100, zIndex: 10 },
  });

  return {
    usersTable,
    postsTable,
    idColumn,
    nameColumn,
    titleColumn,
    noteMemo,
    gridBreakingMemo,
  };
}

const ALL_SELECTED: Record<string, SelectType> = {
  'table-1': SelectType.table,
  'table-2': SelectType.table,
  'memo-1': SelectType.memo,
  'memo-2': SelectType.memo,
};

const MEMOS_SELECTED: Record<string, SelectType> = {
  'memo-1': SelectType.memo,
  'memo-2': SelectType.memo,
};

function createEntitiesState(
  overrides: {
    show?: number;
    columnOrder?: number[];
    selectedMap?: Record<string, SelectType>;
  } = {}
) {
  const fixture = createEntitiesFixture();
  const state = createState({
    tables: [fixture.usersTable, fixture.postsTable],
    columns: [fixture.idColumn, fixture.nameColumn, fixture.titleColumn],
    memos: [fixture.noteMemo, fixture.gridBreakingMemo],
    selectedMap: overrides.selectedMap ?? ALL_SELECTED,
    show: overrides.show,
    columnOrder: overrides.columnOrder,
  });

  return { ...fixture, state };
}

function readHiddenPayload(html: string): ClipboardPayload | null {
  const template = document.createElement('template');
  template.innerHTML = html;

  const json = template.content
    .querySelector('[data-erd-editor]')
    ?.getAttribute('data-erd-editor');

  return json ? JSON.parse(json) : null;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapedByteLength = (payload: ClipboardPayload) =>
  new TextEncoder().encode(
    JSON.stringify(payload).replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char])
  ).length;

/**
 * A payload whose escaped JSON weighs exactly bytes, so the ceiling can be
 * probed from both sides. The padding is plain ASCII, which neither JSON nor the
 * attribute escaper rewrites, so one character is one byte.
 */
function payloadOfEscapedBytes(bytes: number): ClipboardPayload {
  const build = (value: string) =>
    createPayload({
      kind: PayloadKind.tables,
      copyId: 'copy-id',
      memos: [
        {
          sourceId: 'memo-1',
          value,
          ui: { x: 0, y: 0, width: 200, height: 100, zIndex: 2, color: '' },
        },
      ],
    });

  return build('a'.repeat(bytes - escapedByteLength(build(''))));
}

describe('entitiesCopyToPayload', () => {
  it('carries one entry per selected table and memo (AC-2)', () => {
    const { state } = createEntitiesState();

    const payload = entitiesCopyToPayload(state);

    expect(payload).not.toBeNull();
    expect(payload?.format).toBe(CLIPBOARD_FORMAT);
    expect(payload?.version).toBe(CLIPBOARD_VERSION);
    expect(payload?.kind).toBe(PayloadKind.tables);
    expect(payload?.tables).toHaveLength(2);
    expect(payload?.memos).toHaveLength(2);
    expect(payload?.columns).toHaveLength(3);
  });

  it('fills every sourceId with the id the entity had in the document (AC-3)', () => {
    const { state } = createEntitiesState();

    const payload = entitiesCopyToPayload(state);

    expect(payload?.tables.map(({ sourceId }) => sourceId)).toEqual([
      'table-1',
      'table-2',
    ]);
    expect(payload?.columns.map(({ sourceId }) => sourceId)).toEqual([
      'column-id',
      'column-name',
      'column-title',
    ]);
    expect(payload?.memos.map(({ sourceId }) => sourceId)).toEqual([
      'memo-1',
      'memo-2',
    ]);
    expect(payload?.columns.map(({ tableId }) => tableId)).toEqual([
      'table-1',
      'table-1',
      'table-2',
    ]);
    expect(payload?.tables[0].columnIds).toEqual(['column-id', 'column-name']);
  });

  it('serializes the ui of every entity', () => {
    const { state } = createEntitiesState();

    const payload = entitiesCopyToPayload(state);

    expect(payload?.tables[0].ui).toEqual({
      x: 120,
      y: 240,
      zIndex: 7,
      widthName: 91,
      widthComment: 92,
      color: '',
    });
    expect(payload?.memos[0].ui).toEqual({
      x: 700,
      y: 100,
      width: 220,
      height: 140,
      zIndex: 9,
      color: '',
    });
    expect(payload?.columns[0].ui).toEqual({
      keys: 1,
      widthName: 61,
      widthComment: 62,
      widthDataType: 63,
      widthDefault: 64,
    });
  });

  it('writes every column attribute regardless of show and columnOrder', () => {
    const { state } = createEntitiesState({
      show: 0,
      columnOrder: [ColumnType.columnName],
    });

    const payload = entitiesCopyToPayload(state);

    expect(payload?.columns[0]).toMatchObject({
      name: 'id',
      dataType: 'int',
      comment: 'pk',
      default: '',
      options: ColumnOption.autoIncrement | ColumnOption.notNull,
    });
  });

  it('returns null when nothing is selected (AC-5)', () => {
    const { usersTable, idColumn } = createEntitiesFixture();
    const state = createState({ tables: [usersTable], columns: [idColumn] });

    expect(entitiesCopyToPayload(state)).toBeNull();
  });

  it('returns null when the selection points at entities that are gone', () => {
    const state = createState({
      selectedMap: {
        'table-gone': SelectType.table,
        'memo-gone': SelectType.memo,
      },
    });

    expect(entitiesCopyToPayload(state)).toBeNull();
  });

  it('builds a kind tables payload from a memo only selection (AC-33)', () => {
    const { state } = createEntitiesState({
      selectedMap: MEMOS_SELECTED,
    });

    const payload = entitiesCopyToPayload(state);

    expect(payload?.kind).toBe(PayloadKind.tables);
    expect(payload?.memos).toHaveLength(2);
    expect(payload?.tables).toHaveLength(0);
    expect(payload?.columns).toHaveLength(0);
  });
});

describe('columnsCopyToPayload', () => {
  it('writes every attribute of the selected columns', () => {
    const { table, idColumn, nameColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn, nameColumn],
      show: 0,
      columnOrder: [ColumnType.columnName],
      focusTable: {
        tableId: 'table-1',
        selectColumnIds: ['column-id', 'column-name'],
      },
    });

    const payload = columnsCopyToPayload(state);

    expect(payload?.kind).toBe(PayloadKind.columns);
    expect(payload?.tables).toHaveLength(0);
    expect(payload?.memos).toHaveLength(0);
    expect(payload?.columns.map(({ name }) => name)).toEqual(['id', 'name']);
    expect(payload?.columns[1]).toMatchObject({
      sourceId: 'column-name',
      tableId: 'table-1',
      dataType: 'varchar(50)',
      default: "''",
      comment: 'user name',
      options: ColumnOption.unique,
    });
  });

  it('returns null without a focused table, while editing, or with no column selected', () => {
    const { table, idColumn } = createFixture();
    const base = { tables: [table], columns: [idColumn] };

    expect(columnsCopyToPayload(createState(base))).toBeNull();
    expect(
      columnsCopyToPayload(
        createState({
          ...base,
          focusTable: { tableId: 'table-1', selectColumnIds: [] },
        })
      )
    ).toBeNull();
    expect(
      columnsCopyToPayload(
        createState({
          ...base,
          focusTable: {
            tableId: 'table-1',
            selectColumnIds: ['column-id'],
            edit: true,
          },
        })
      )
    ).toBeNull();
  });
});

describe('entitiesToTsv', () => {
  it('renders one tab separated line per column of every table (AC-15)', () => {
    const { state } = createEntitiesState();
    const payload = entitiesCopyToPayload(state)!;

    expect(entitiesToTsv(payload, state.settings)).toBe(
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
        ['title', 'text', 'NULL', 'FALSE', 'FALSE', '', ''].join('\t'),
      ].join('\n')
    );
  });

  it('keeps the grid intact when a memo carries tabs and newlines (AC-40c)', () => {
    const { state } = createEntitiesState();
    const payload = entitiesCopyToPayload(state)!;
    const withoutMemos = createPayload({
      kind: PayloadKind.tables,
      tables: payload.tables,
      columns: payload.columns,
    });

    const tsv = entitiesToTsv(payload, state.settings);

    expect(tsv).toBe(entitiesToTsv(withoutMemos, state.settings));
    expect(tsv).not.toContain('second');
    expect(tsv.split('\n')).toHaveLength(3);
    for (const line of tsv.split('\n')) {
      expect(line.split('\t')).toHaveLength(FULL_COLUMN_ORDER.length);
    }
  });

  it('joins the memo values with a blank line when there is no table (AC-40b)', () => {
    const { state } = createEntitiesState({
      selectedMap: MEMOS_SELECTED,
    });
    const payload = entitiesCopyToPayload(state)!;

    expect(entitiesToTsv(payload, state.settings)).toBe(
      'first memo\n\nsecond\tmemo\nwith a newline'
    );
  });

  it('returns an empty string for a table with no column (AC-19)', () => {
    const state = createState();
    const payload = createPayload({
      kind: PayloadKind.tables,
      tables: [
        {
          sourceId: 'table-1',
          name: 'users',
          comment: '',
          columnIds: [],
          ui: {
            x: 0,
            y: 0,
            zIndex: 2,
            widthName: 60,
            widthComment: 60,
            color: '',
          },
        },
      ],
    });

    expect(entitiesToTsv(payload, state.settings)).toBe('');
  });

  it('returns an empty string for an empty payload', () => {
    const state = createState();

    expect(
      entitiesToTsv(createPayload({ kind: PayloadKind.tables }), state.settings)
    ).toBe('');
  });
});

describe('entitiesToHtmlTable', () => {
  it('never carries a memo into the grid (AC-14, AC-40a)', () => {
    const { state } = createEntitiesState({
      columnOrder: [ColumnType.columnName],
      show: ALL_SHOW,
    });
    const payload = entitiesCopyToPayload(state)!;

    expect(entitiesToHtmlTable(payload, state.settings)).toBe(
      '<table><tbody>' +
        '<tr><td data-type="columnName">id</td></tr>' +
        '<tr><td data-type="columnName">name</td></tr>' +
        '<tr><td data-type="columnName">title</td></tr>' +
        '</tbody></table>'
    );
  });

  it('writes the same cell shape tableCopyToHtml writes', () => {
    const { state } = createEntitiesState({
      selectedMap: { 'table-1': SelectType.table },
    });
    const payload = entitiesCopyToPayload(state)!;

    expect(entitiesToHtmlTable(payload, state.settings)).toContain(
      '<tr>' +
        '<td data-type="columnName">id</td>' +
        '<td data-type="columnDataType">int</td>' +
        '<td data-type="columnNotNull">NOT NULL</td>' +
        '<td data-type="columnUnique">FALSE</td>' +
        '<td data-type="columnAutoIncrement">TRUE</td>' +
        '<td data-type="columnDefault"></td>' +
        '<td data-type="columnComment">pk</td>' +
        '</tr>'
    );
  });

  it('returns an empty string for a memo only payload (AC-19, AC-40b)', () => {
    const { state } = createEntitiesState({
      selectedMap: MEMOS_SELECTED,
    });
    const payload = entitiesCopyToPayload(state)!;

    expect(entitiesToHtmlTable(payload, state.settings)).toBe('');
  });
});

describe('payloadToHtml', () => {
  it('hides the payload on a span wrapping the visible table', () => {
    const { state } = createEntitiesState();
    const payload = entitiesCopyToPayload(state)!;
    const tableHtml = entitiesToHtmlTable(payload, state.settings);

    const html = payloadToHtml(payload, tableHtml);

    expect(html.startsWith('<span data-erd-editor="')).toBe(true);
    expect(html.endsWith(`>${tableHtml}</span>`)).toBe(true);
  });

  it('escapes the json so it survives a round trip through the attribute', () => {
    const state = createState();
    const payload = createPayload({
      kind: PayloadKind.tables,
      copyId: 'copy-id',
      memos: [
        {
          sourceId: 'memo-1',
          value: `& < > " ' </span>`,
          ui: {
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            zIndex: 2,
            color: '',
          },
        },
      ],
    });

    const html = payloadToHtml(
      payload,
      entitiesToHtmlTable(payload, state.settings)
    );

    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
    expect(readHiddenPayload(html)).toEqual(payload);
  });

  it('embeds the json at the size ceiling', () => {
    const payload = payloadOfEscapedBytes(HTML_PAYLOAD_MAX_BYTES);
    expect(escapedByteLength(payload)).toBe(HTML_PAYLOAD_MAX_BYTES);

    const html = payloadToHtml(payload, '<table><tbody></tbody></table>');

    expect(html).toContain('data-erd-editor="');
    expect(html).not.toContain('data-erd-editor-truncated');
    expect(readHiddenPayload(html)).toEqual(payload);
  });

  it('drops the json and flags truncation one byte past the ceiling', () => {
    const payload = payloadOfEscapedBytes(HTML_PAYLOAD_MAX_BYTES + 1);
    expect(escapedByteLength(payload)).toBe(HTML_PAYLOAD_MAX_BYTES + 1);

    const html = payloadToHtml(payload, '<table><tbody></tbody></table>');

    expect(html).toBe(
      '<span data-erd-editor-truncated="1"><table><tbody></tbody></table></span>'
    );
    expect(readHiddenPayload(html)).toBeNull();
  });
});

describe('AC-4 — the column flavours stay byte identical', () => {
  it('leaves text/plain and text/html untouched while a table is also selected', () => {
    const { table, idColumn, nameColumn } = createFixture();
    const state = createState({
      tables: [table],
      columns: [idColumn, nameColumn],
      columnOrder: [ColumnType.columnName],
      selectedMap: { 'table-1': SelectType.table },
      focusTable: {
        tableId: 'table-1',
        selectColumnIds: ['column-id', 'column-name'],
      },
    });

    expect(columnsCopyToPayload(state)?.kind).toBe(PayloadKind.columns);
    expect(tableCopyToText(state)).toBe('id\nname');
    expect(tableCopyToHtml(state)).toBe(
      '<table><tbody>' +
        '<tr><td data-type="columnName">id</td></tr>' +
        '<tr><td data-type="columnName">name</td></tr>' +
        '</tbody></table>'
    );
    expect(tableCopyToHtml(state)).not.toContain('data-erd-editor');
  });
});

describe('AC-40d — the generated text/html never yields a memo derived column', () => {
  it('parses back into exactly the copied columns', () => {
    const { state } = createEntitiesState();
    const payload = entitiesCopyToPayload(state)!;
    const html = payloadToHtml(
      payload,
      entitiesToHtmlTable(payload, state.settings)
    );

    const columns = tablePasteFromHtmlToColumns(state, html);

    expect(columns).toHaveLength(3);
    expect(columns.map(({ name }) => name)).toEqual(['id', 'name', 'title']);
    expect(columns.some(({ name }) => name.includes('memo'))).toBe(false);
  });

  it('yields nothing at all from a memo only copy', () => {
    const { state } = createEntitiesState({
      selectedMap: MEMOS_SELECTED,
    });
    const payload = entitiesCopyToPayload(state)!;
    const html = payloadToHtml(
      payload,
      entitiesToHtmlTable(payload, state.settings)
    );

    expect(tablePasteFromHtmlToColumns(state, html)).toHaveLength(0);
  });
});
