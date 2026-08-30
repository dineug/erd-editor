import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, ColumnType, Show } from '@/constants/schema';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import { payloadToHtml } from '@/utils/table-clipboard/copy';
import {
  payloadToColumns,
  readClipboardPayload,
  tablePasteFromHtmlToColumns,
  tablePasteFromTextToColumns,
} from '@/utils/table-clipboard/paste';
import {
  CLIPBOARD_HTML_ATTR,
  CLIPBOARD_HTML_TRUNCATED_ATTR,
  CLIPBOARD_MIME,
  CLIPBOARD_VERSION,
  ClipboardPayload,
  createPayload,
  HTML_PAYLOAD_MAX_BYTES,
  PayloadKind,
} from '@/utils/table-clipboard/payload';

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

function createState(
  show: number = ALL_SHOW,
  columnOrder: number[] = FULL_COLUMN_ORDER
): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = show;
  state.settings.columnOrder = columnOrder;
  return state;
}

describe('tablePasteFromTextToColumns', () => {
  it('maps tab separated cells onto the visible column order', () => {
    const columns = tablePasteFromTextToColumns(
      createState(),
      'id\tint\tNOT NULL\tTRUE\tTRUE\t0\tprimary key'
    );

    expect(columns).toHaveLength(1);
    const [column] = columns;
    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
    expect(column.default).toBe('0');
    expect(column.comment).toBe('primary key');
    expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
    expect(bHas(column.options, ColumnOption.unique)).toBe(true);
    expect(bHas(column.options, ColumnOption.autoIncrement)).toBe(true);
    expect(bHas(column.options, ColumnOption.primaryKey)).toBe(false);
  });

  it('creates one column per line', () => {
    const columns = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnName]),
      'id\nname\nemail'
    );

    expect(columns.map(column => column.name)).toEqual(['id', 'name', 'email']);
    expect(new Set(columns.map(column => column.id)).size).toBe(3);
  });

  it('trims surrounding whitespace from every cell', () => {
    const [column] = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnName, ColumnType.columnDataType]),
      '  id  \t  int  '
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
  });

  it('leaves defaults untouched for empty and missing cells', () => {
    const [column] = tablePasteFromTextToColumns(
      createState(),
      'id\t\tNOT NULL'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('');
    expect(column.default).toBe('');
    expect(column.comment).toBe('');
    expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
  });

  it('skips cells whose column type is hidden by the settings', () => {
    const [column] = tablePasteFromTextToColumns(
      createState(Show.columnComment, FULL_COLUMN_ORDER),
      'id\tsome comment\tint'
    );

    expect(column.name).toBe('id');
    expect(column.comment).toBe('some comment');
    expect(column.dataType).toBe('');
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['yes', true],
    ['Y', true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['not null', false],
  ])('treats %s as autoIncrement=%s', (value, expected) => {
    const [column] = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnAutoIncrement]),
      value
    );

    expect(bHas(column.options, ColumnOption.autoIncrement)).toBe(expected);
  });

  it.each([
    ['true', true],
    ['1', true],
    ['Yes', true],
    ['y', true],
    ['false', false],
    ['null', false],
  ])('treats %s as unique=%s', (value, expected) => {
    const [column] = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnUnique]),
      value
    );

    expect(bHas(column.options, ColumnOption.unique)).toBe(expected);
  });

  it.each([
    ['NOT NULL', true],
    ['not null', true],
    ['true', true],
    ['1', true],
    ['NULL', false],
    ['nullable', false],
  ])('treats %s as notNull=%s', (value, expected) => {
    const [column] = tablePasteFromTextToColumns(
      createState(ALL_SHOW, [ColumnType.columnNotNull]),
      value
    );

    expect(bHas(column.options, ColumnOption.notNull)).toBe(expected);
  });

  it('returns a single default column for an empty string', () => {
    const columns = tablePasteFromTextToColumns(createState(), '');

    expect(columns).toHaveLength(1);
    expect(columns[0].name).toBe('');
    expect(columns[0].options).toBe(0);
  });
});

describe('tablePasteFromHtmlToColumns', () => {
  it('maps td cells positionally when they carry no data-type', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(),
      '<table><tbody><tr><td>id</td><td>int</td><td>NOT NULL</td><td>yes</td><td>1</td><td>0</td><td>pk</td></tr></tbody></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
    expect(column.default).toBe('0');
    expect(column.comment).toBe('pk');
    expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
    expect(bHas(column.options, ColumnOption.unique)).toBe(true);
    expect(bHas(column.options, ColumnOption.autoIncrement)).toBe(true);
  });

  it('prefers data-type over the positional column order', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName, ColumnType.columnDataType]),
      '<table><tr><td data-type="columnComment">a comment</td><td data-type="columnName">id</td></tr></table>'
    );

    expect(column.comment).toBe('a comment');
    expect(column.name).toBe('id');
    expect(column.dataType).toBe('');
  });

  it('applies typed cells that sit beyond the visible column order', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName]),
      '<table><tr><td data-type="columnName">id</td><td data-type="columnDataType">int</td><td data-type="columnNotNull">NOT NULL</td></tr></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
    expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
  });

  it('maps every known data-type even when nothing is visible', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(0, []),
      '<table><tr>' +
        '<td data-type="columnName">id</td>' +
        '<td data-type="columnDataType">bigint</td>' +
        '<td data-type="columnDefault">nextval()</td>' +
        '<td data-type="columnComment">the pk</td>' +
        '<td data-type="columnAutoIncrement">TRUE</td>' +
        '<td data-type="columnUnique">yes</td>' +
        '<td data-type="columnNotNull">NOT NULL</td>' +
        '</tr></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('bigint');
    expect(column.default).toBe('nextval()');
    expect(column.comment).toBe('the pk');
    expect(column.options).toBe(
      ColumnOption.autoIncrement | ColumnOption.unique | ColumnOption.notNull
    );
  });

  it('leaves the option bits clear for falsy typed flag cells', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(0, []),
      '<table><tr>' +
        '<td data-type="columnAutoIncrement">FALSE</td>' +
        '<td data-type="columnUnique">no</td>' +
        '<td data-type="columnNotNull">NULL</td>' +
        '</tr></table>'
    );

    expect(column.options).toBe(0);
  });

  it('reads th cells as well as td cells', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName, ColumnType.columnDataType]),
      '<table><tr><th>id</th><th>int</th></tr></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
  });

  it('creates one column per tr', () => {
    const columns = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName]),
      '<table><tr><td>id</td></tr><tr><td>name</td></tr></table>'
    );

    expect(columns.map(column => column.name)).toEqual(['id', 'name']);
  });

  it('trims the text content of every cell', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName, ColumnType.columnDataType]),
      '<table><tr><td>\n  id \n</td><td data-type="columnDataType"> int </td></tr></table>'
    );

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
  });

  it('ignores unknown data-type values and falls back to the position', () => {
    const [column] = tablePasteFromHtmlToColumns(
      createState(ALL_SHOW, [ColumnType.columnName]),
      '<table><tr><td data-type="columnPrimaryKey">id</td></tr></table>'
    );

    expect(column.name).toBe('id');
  });

  it('returns an empty array when the html has no rows', () => {
    expect(tablePasteFromHtmlToColumns(createState(), '')).toEqual([]);
    expect(
      tablePasteFromHtmlToColumns(createState(), '<div>not a table</div>')
    ).toEqual([]);
  });

  it('produces a default column for a row with no cells', () => {
    const columns = tablePasteFromHtmlToColumns(
      createState(),
      '<table><tr></tr></table>'
    );

    expect(columns).toHaveLength(1);
    expect(columns[0].name).toBe('');
    expect(columns[0].options).toBe(0);
  });
});

/** Mirrors the escaping the writer applies before the JSON becomes an attribute. */
const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** The visible half of a kind: 'tables' copy — the rung under the payload. */
const TABLE_HTML =
  '<table><tbody><tr>' +
  '<td data-type="columnName">id</td>' +
  '<td data-type="columnDataType">int</td>' +
  '</tr></tbody></table>';

const createHiddenHtml = (payload: ClipboardPayload, table = TABLE_HTML) =>
  `<span ${CLIPBOARD_HTML_ATTR}="${escapeAttribute(
    JSON.stringify(payload)
  )}">${table}</span>`;

function createDataTransfer(data: Record<string, string> = {}): DataTransfer {
  return {
    getData: (type: string) => data[type] ?? '',
  } as unknown as DataTransfer;
}

// Both text fields carry characters the attribute escaping has to survive.
const TABLES_PAYLOAD = createPayload({
  kind: PayloadKind.tables,
  copyId: 'copy-1',
  tables: [
    {
      sourceId: 'table-1',
      name: 'users',
      comment: "the app's users",
      columnIds: ['column-1'],
      ui: {
        x: 10,
        y: 20,
        zIndex: 3,
        widthName: 60,
        widthComment: 60,
        color: '#ff0000',
      },
    },
  ],
  columns: [
    {
      sourceId: 'column-1',
      tableId: 'table-1',
      name: 'id',
      comment: '<pk> & "unique"',
      dataType: 'int',
      default: '0',
      options: ColumnOption.notNull | ColumnOption.unique,
      ui: {
        keys: 1,
        widthName: 120,
        widthComment: 60,
        widthDataType: 60,
        widthDefault: 60,
      },
    },
  ],
});

describe('readClipboardPayload', () => {
  it('reads the payload from the custom mime flavour', () => {
    const result = readClipboardPayload(
      createDataTransfer({ [CLIPBOARD_MIME]: JSON.stringify(TABLES_PAYLOAD) })
    );

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.payload).toEqual(TABLES_PAYLOAD);
  });

  it('prefers the custom mime flavour over the html it travelled with', () => {
    const result = readClipboardPayload(
      createDataTransfer({
        [CLIPBOARD_MIME]: JSON.stringify(TABLES_PAYLOAD),
        'text/html': createHiddenHtml({
          ...TABLES_PAYLOAD,
          copyId: 'copy-2',
        }),
      })
    );

    expect(result.status === 'ok' && result.payload.copyId).toBe('copy-1');
  });

  // AC-18 — the hop that drops the custom mime type still round trips, and the
  // html parser is what undoes the attribute escaping.
  it('falls back to the json hidden in text/html when the custom flavour is gone', () => {
    const result = readClipboardPayload(
      createDataTransfer({
        [CLIPBOARD_MIME]: '',
        'text/html': createHiddenHtml(TABLES_PAYLOAD),
      })
    );

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.payload).toEqual(TABLES_PAYLOAD);
  });

  // AC-27 (a) / AC-28 — the html below carries a payload this reader could read
  // and a table it could parse. Neither may be reached.
  it('stops on a version it cannot read instead of descending to the html', () => {
    const result = readClipboardPayload(
      createDataTransfer({
        [CLIPBOARD_MIME]: JSON.stringify({
          ...TABLES_PAYLOAD,
          version: CLIPBOARD_VERSION + 1,
        }),
        'text/html': createHiddenHtml(TABLES_PAYLOAD),
      })
    );

    expect(result).toEqual({
      status: 'unsupported',
      version: CLIPBOARD_VERSION + 1,
    });
  });

  it('stops when the hidden json is the unreadable one', () => {
    const result = readClipboardPayload(
      createDataTransfer({
        [CLIPBOARD_MIME]: '',
        'text/html': createHiddenHtml({
          ...TABLES_PAYLOAD,
          version: CLIPBOARD_VERSION + 1,
        }),
      })
    );

    expect(result).toEqual({
      status: 'unsupported',
      version: CLIPBOARD_VERSION + 1,
    });
  });

  // AC-27 (b) / AC-28 — a copy too large to embed leaves the marker and nothing
  // else. This is the only guard on that path: the second assertion is the
  // damage a fall through would do, since the table below is one we wrote.
  it('stops on a truncated marker even though the table below it would parse', () => {
    const html = `<span ${CLIPBOARD_HTML_TRUNCATED_ATTR}="1">${TABLE_HTML}</span>`;

    const result = readClipboardPayload(
      createDataTransfer({ [CLIPBOARD_MIME]: '', 'text/html': html })
    );

    expect(result.status).toBe('unsupported');
    expect(
      result.status === 'unsupported' && Number.isNaN(result.version)
    ).toBe(true);
    expect(tablePasteFromHtmlToColumns(createState(), html)).toHaveLength(1);
  });

  // The escaping above is a mirror of the writer's. These two pin the halves
  // together, so a change to one cannot drift away from the other unnoticed.
  it('reads back the html the writer actually produces', () => {
    const result = readClipboardPayload(
      createDataTransfer({
        'text/html': payloadToHtml(TABLES_PAYLOAD, TABLE_HTML),
      })
    );

    expect(result.status === 'ok' && result.payload).toEqual(TABLES_PAYLOAD);
  });

  it('stops on the marker the writer leaves behind for an oversized copy', () => {
    const html = payloadToHtml(
      createPayload({
        kind: PayloadKind.tables,
        memos: [
          {
            sourceId: 'memo-1',
            value: 'x'.repeat(HTML_PAYLOAD_MAX_BYTES + 1),
            ui: { x: 0, y: 0, width: 100, height: 100, zIndex: 1, color: '' },
          },
        ],
      }),
      TABLE_HTML
    );

    expect(html).toContain(CLIPBOARD_HTML_TRUNCATED_ATTR);
    expect(
      readClipboardPayload(createDataTransfer({ 'text/html': html })).status
    ).toBe('unsupported');
  });

  // AC-28 — everything the ladder has to keep descending past.
  it.each([
    ['an empty clipboard', {}],
    ['a custom flavour that is not json', { [CLIPBOARD_MIME]: 'id\tint' }],
    ['a json literal that is not an object', { [CLIPBOARD_MIME]: 'null' }],
    [
      'another application format',
      {
        [CLIPBOARD_MIME]: JSON.stringify({
          format: 'some-other-app',
          version: 1,
        }),
      },
    ],
    ['html with no attribute of ours', { 'text/html': TABLE_HTML }],
    [
      "a stranger's attribute of the same name",
      {
        'text/html': `<span ${CLIPBOARD_HTML_ATTR}="{&quot;format&quot;:&quot;some-other-app&quot;}">${TABLE_HTML}</span>`,
      },
    ],
    ['plain text only', { 'text/plain': 'id\tint' }],
  ])('reports %s as foreign so the ladder continues', (_label, data) => {
    const dataTransfer = createDataTransfer(data);

    expect(() => readClipboardPayload(dataTransfer)).not.toThrow();
    expect(readClipboardPayload(dataTransfer)).toEqual({ status: 'foreign' });
  });
});

describe('payloadToColumns', () => {
  const payload = { ...TABLES_PAYLOAD, kind: PayloadKind.columns };

  it('rebuilds every serialised column attribute', () => {
    const [column] = payloadToColumns(payload);

    expect(column.name).toBe('id');
    expect(column.dataType).toBe('int');
    expect(column.default).toBe('0');
    expect(column.comment).toBe('<pk> & "unique"');
    expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
    expect(bHas(column.options, ColumnOption.unique)).toBe(true);
  });

  it('mints a new id and drops the identity of the source column', () => {
    const [column] = payloadToColumns(payload);

    expect(column.id).not.toBe('column-1');
    expect(column.id).not.toBe('');
    expect(column.tableId).toBe('');
  });

  it('keeps the serialised widths and clears the relationship key bits', () => {
    const [column] = payloadToColumns(payload);

    expect(column.ui.widthName).toBe(120);
    expect(column.ui.widthComment).toBe(60);
    expect(column.ui.keys).toBe(0);
  });

  it('returns an empty array when the payload carries no columns', () => {
    expect(payloadToColumns({ ...payload, columns: [] })).toEqual([]);
  });
});
