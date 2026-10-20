import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  COLUMN_ALTERNATE_KEY_CHAR_WIDTH,
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  INPUT_MARGIN_RIGHT,
  TABLE_BORDER,
  TABLE_HEADER_BAND_PADDING,
  TABLE_HEADER_INPUT_HEIGHT,
  TABLE_PADDING,
  VIEW_COLUMN_HEIGHT,
  VIEW_COLUMN_ICON_GAP,
  VIEW_COLUMN_ICON_SIZE,
  VIEW_TABLE_HEADER_BUTTONS_WIDTH,
  VIEW_TABLE_HEADER_ICON_GAP,
  VIEW_TABLE_HEADER_ICON_SIZE,
  VIEW_TABLE_MIN_WIDTH,
} from '@/constants/layout';
import {
  ColumnType,
  ColumnUIKey,
  NameViewMode,
  Show,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import {
  createEditor,
  FocusType,
  ShowMode,
  ViewKind,
} from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { getVisibleColumnIds } from '@/konva/scene/viewLayout';
import {
  calcAlternateKeyWidth,
  calcTableHeight,
  calcTableWidths,
  calcViewTableWidths,
  headerCellWidth,
  measureTableSize,
  recalculateTableWidth,
  viewHeaderNameWidth,
} from '@/utils/calcTable';
import { createDomain } from '@/utils/collection/domain.entity';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

/** The view widths for the rows a view shows, which the function no longer looks up itself. */
const viewWidths = (table: Table, state: RootState) =>
  calcViewTableWidths(table, state, getVisibleColumnIds(state, table, 'flow'));

type StateOptions = {
  show?: number;
  maxWidthComment?: number;
  tables?: Table[];
  columns?: Column[];
};

function createState({
  show = 0,
  maxWidthComment = -1,
  tables = [],
  columns = [],
}: StateOptions = {}): RootState {
  const schema = schemaV3Parser({});
  schema.settings.show = show;
  schema.settings.maxWidthComment = maxWidthComment;
  schema.doc.tableIds = tables.map(table => table.id);

  for (const table of tables) {
    schema.collections.tableEntities[table.id] = table;
  }
  for (const column of columns) {
    schema.collections.tableColumnEntities[column.id] = column;
  }

  return { ...schema, editor: createEditor(), lww: {} };
}

describe('calcTableWidths', () => {
  it('falls back to the default column width when nothing is shown', () => {
    const table = createTable({ id: 'table-1' });
    const state = createState({ show: 0, tables: [table] });

    // The header line outgrows the default columns (12 + 8 + 60 + 8 + 12 = 100):
    // 12 + 8 + 60 + 8 + 28 = 116 -> 1 + 8 + 116 + 8 + 1
    expect(calcTableWidths(table, state)).toEqual({
      width: 134,
      alternateKey: 0,
      name: 0,
      logicalName: 0,
      comment: 0,
      dataType: 0,
      domain: 0,
      default: 0,
      notNull: 0,
      autoIncrement: 0,
      unique: 0,
    });
  });

  it('adds the table comment width when the table comment is shown', () => {
    const table = createTable({
      id: 'table-1',
      ui: { widthName: 100, widthComment: 70 },
    });
    const state = createState({ show: Show.tableComment, tables: [table] });

    // 12 + 8 + (100 + 8) + (70 + 8) + 28 = 234 -> 1 + 8 + 234 + 8 + 1
    expect(calcTableWidths(table, state).width).toBe(252);
  });

  it('clamps the table comment width to maxWidthComment', () => {
    const table = createTable({
      id: 'table-1',
      ui: { widthName: 100, widthComment: 70 },
    });

    expect(
      calcTableWidths(
        table,
        createState({
          show: Show.tableComment,
          maxWidthComment: 65,
          tables: [table],
        })
      ).width
    ).toBe(247);
  });

  it('keeps the table comment width when maxWidthComment is larger', () => {
    const table = createTable({
      id: 'table-1',
      ui: { widthName: 100, widthComment: 70 },
    });

    expect(
      calcTableWidths(
        table,
        createState({
          show: Show.tableComment,
          maxWidthComment: 100,
          tables: [table],
        })
      ).width
    ).toBe(252);
  });

  it('collects the max width of every shown column field', () => {
    const columns = [
      createColumn({
        id: 'column-1',
        tableId: 'table-1',
        ui: {
          widthName: 80,
          widthComment: 70,
          widthDataType: 90,
          widthDefault: 60,
        },
      }),
      createColumn({
        id: 'column-2',
        tableId: 'table-1',
        ui: {
          widthName: 60,
          widthComment: 120,
          widthDataType: 60,
          widthDefault: 100,
        },
      }),
    ];
    const table = createTable({
      id: 'table-1',
      columnIds: ['column-1', 'column-2'],
    });
    const show =
      Show.columnComment |
      Show.columnDataType |
      Show.columnDefault |
      Show.columnNotNull |
      Show.columnAutoIncrement |
      Show.columnUnique;
    const state = createState({ show, tables: [table], columns });

    expect(calcTableWidths(table, state)).toEqual({
      width: 568,
      alternateKey: 0,
      name: 80,
      logicalName: 0,
      comment: 120,
      dataType: 90,
      domain: 0,
      default: 100,
      notNull: 35,
      autoIncrement: 15,
      unique: 22,
    });
  });

  it('leaves hidden column fields at zero even when the column has a width', () => {
    const column = createColumn({
      id: 'column-1',
      tableId: 'table-1',
      ui: {
        widthName: 80,
        widthComment: 200,
        widthDataType: 90,
        widthDefault: 300,
      },
    });
    const table = createTable({ id: 'table-1', columnIds: ['column-1'] });
    const state = createState({
      show: Show.columnDataType,
      tables: [table],
      columns: [column],
    });

    expect(calcTableWidths(table, state)).toEqual({
      width: 236,
      alternateKey: 0,
      name: 80,
      logicalName: 0,
      comment: 0,
      dataType: 90,
      domain: 0,
      default: 0,
      notNull: 0,
      autoIncrement: 0,
      unique: 0,
    });
  });

  it('clamps the column comment width to maxWidthComment', () => {
    const columns = [
      createColumn({
        id: 'column-1',
        tableId: 'table-1',
        ui: { widthName: 60, widthComment: 70 },
      }),
      createColumn({
        id: 'column-2',
        tableId: 'table-1',
        ui: { widthName: 60, widthComment: 120 },
      }),
    ];
    const table = createTable({
      id: 'table-1',
      columnIds: ['column-1', 'column-2'],
    });
    const state = createState({
      show: Show.columnComment,
      maxWidthComment: 100,
      tables: [table],
      columns,
    });

    expect(calcTableWidths(table, state).comment).toBe(100);
  });

  it('uses the flag widths for the boolean columns even without any column', () => {
    const table = createTable({ id: 'table-1' });
    const show =
      Show.columnNotNull | Show.columnUnique | Show.columnAutoIncrement;
    const state = createState({ show, tables: [table] });

    expect(calcTableWidths(table, state)).toEqual({
      width: 214,
      alternateKey: 0,
      name: 0,
      logicalName: 0,
      comment: 0,
      dataType: 0,
      domain: 0,
      default: 0,
      notNull: 35,
      autoIncrement: 15,
      unique: 22,
    });
  });

  it('ignores column ids that are not in the collection', () => {
    const column = createColumn({
      id: 'column-1',
      tableId: 'table-1',
      ui: { widthName: 200 },
    });
    const table = createTable({
      id: 'table-1',
      columnIds: ['column-1', 'missing'],
    });
    const state = createState({
      show: 0,
      tables: [table],
      columns: [column],
    });

    // 12 + 8 + 12 + (200 + 8) = 240 -> 1 + 8 + 240 + 8 + 1
    expect(calcTableWidths(table, state)).toEqual({
      width: 258,
      alternateKey: 0,
      name: 200,
      logicalName: 0,
      comment: 0,
      dataType: 0,
      domain: 0,
      default: 0,
      notNull: 0,
      autoIncrement: 0,
      unique: 0,
    });
  });

  it('lets a wide table name win over the column widths', () => {
    const column = createColumn({ id: 'column-1', tableId: 'table-1' });
    const table = createTable({
      id: 'table-1',
      columnIds: ['column-1'],
      ui: { widthName: 500 },
    });
    const state = createState({
      show: 0,
      tables: [table],
      columns: [column],
    });

    // 12 + 8 + (500 + 8) + 28 = 556 -> 1 + 8 + 556 + 8 + 1
    expect(calcTableWidths(table, state).width).toBe(574);
  });
});

/** The cells of the name views: the logical name in the name's place or beside it, and the domain in the type's. */
describe('calcTableWidths in the name views', () => {
  const ALL_SHOW = Object.values(Show).reduce((acc, bit) => acc | bit, 0);

  /** A row with a logical name and a listed domain, and a row with neither. */
  function named(
    show: number,
    nameViewMode: RootState['settings']['nameViewMode']
  ) {
    const columns = [
      createColumn({
        id: 'column-1',
        tableId: 'table-1',
        logicalName: 'Created at',
        domainId: 'domain-1',
        ui: {
          widthName: 80,
          widthLogicalName: 150,
          widthDataType: 70,
          widthDomain: 140,
        },
      }),
      createColumn({
        id: 'column-2',
        tableId: 'table-1',
        ui: {
          widthName: 100,
          widthLogicalName: 60,
          widthDataType: 90,
          widthDomain: 60,
        },
      }),
    ];
    const table = createTable({
      id: 'table-1',
      columnIds: ['column-1', 'column-2'],
    });
    const state = createState({ show, tables: [table], columns });
    state.settings.nameViewMode = nameViewMode;
    state.collections.domainEntities['domain-1'] = createDomain({
      id: 'domain-1',
      name: 'Timestamp',
    });
    state.doc.domainIds = ['domain-1'];

    return { table, columns, state };
  }

  it('measures the name cell by the logical names in the logical view, a row with none by its name', () => {
    const physical = named(0, NameViewMode.physical);
    const logical = named(0, NameViewMode.logical);

    expect(calcTableWidths(physical.table, physical.state)).toMatchObject({
      name: 100,
      logicalName: 0,
    });
    expect(calcTableWidths(logical.table, logical.state)).toMatchObject({
      name: 150,
      logicalName: 0,
    });

    // A logical name of blanks draws the name, as an empty one does.
    logical.columns[0].logicalName = '  ';
    expect(calcTableWidths(logical.table, logical.state).name).toBe(100);
  });

  it('adds the logical name cell beside the name in the view of both', () => {
    const physical = named(0, NameViewMode.physical);
    const both = named(0, NameViewMode.both);
    const widths = calcTableWidths(both.table, both.state);

    expect(widths).toMatchObject({ name: 100, logicalName: 150 });
    expect(widths.width).toBe(
      calcTableWidths(physical.table, physical.state).width +
        150 +
        INPUT_MARGIN_RIGHT
    );
  });

  it('measures the type cell by the listed domain in the logical view, by the type elsewhere', () => {
    const physical = named(Show.columnDataType, NameViewMode.physical);
    const logical = named(Show.columnDataType, NameViewMode.logical);

    expect(calcTableWidths(physical.table, physical.state).dataType).toBe(90);
    expect(calcTableWidths(logical.table, logical.state).dataType).toBe(140);

    // A domain the document no longer lists names no cell.
    logical.state.doc.domainIds = [];
    expect(calcTableWidths(logical.table, logical.state).dataType).toBe(90);
  });

  it('gives the domain a cell of its own under its show bit, the type cell keeping the type', () => {
    for (const nameViewMode of Object.values(NameViewMode)) {
      const { table, state } = named(
        Show.columnDataType | Show.columnDomain,
        nameViewMode
      );

      expect(calcTableWidths(table, state)).toMatchObject({
        dataType: 90,
        domain: 140,
      });
    }
  });

  it('adds the domain cell to a row of every shown cell', () => {
    const shown = named(ALL_SHOW, NameViewMode.physical);
    const hidden = named(ALL_SHOW & ~Show.columnDomain, NameViewMode.physical);
    const widths = calcTableWidths(shown.table, shown.state);

    expect(widths.domain).toBe(140);
    expect(widths.width).toBe(
      calcTableWidths(hidden.table, hidden.state).width +
        140 +
        INPUT_MARGIN_RIGHT
    );
  });

  it('runs the header over the cells the view lays out', () => {
    const table = createTable({
      id: 'table-1',
      logicalName: 'Member',
      ui: { widthName: 100, widthLogicalName: 150 },
    });
    const state = createState({ tables: [table] });
    const widthIn = (nameViewMode: typeof state.settings.nameViewMode) => {
      state.settings.nameViewMode = nameViewMode;
      return calcTableWidths(table, state).width;
    };

    // 20 + (100 + 8) + 28 = 156 -> 1 + 8 + 156 + 8 + 1
    expect(widthIn(NameViewMode.physical)).toBe(174);
    // 20 + (150 + 8) + 28 = 206 -> 224
    expect(widthIn(NameViewMode.logical)).toBe(224);
    // 20 + (150 + 8) + (100 + 8) + 28 = 314 -> 332
    expect(widthIn(NameViewMode.both)).toBe(332);

    // The logical view draws the name, dimmed, for a table with no logical name.
    table.logicalName = '';
    expect(widthIn(NameViewMode.logical)).toBe(174);
    expect(widthIn(NameViewMode.both)).toBe(332);
    table.logicalName = '  ';
    expect(widthIn(NameViewMode.logical)).toBe(174);
  });

  it('gives each header cell the width the header lays it out at', () => {
    const table = createTable({
      id: 'table-1',
      logicalName: 'Member',
      ui: { widthName: 100, widthLogicalName: 150, widthComment: 120 },
    });
    const state = createState({ maxWidthComment: 90, tables: [table] });

    expect(headerCellWidth(state, table, FocusType.tableName)).toBe(100);
    expect(headerCellWidth(state, table, FocusType.tableLogicalName)).toBe(150);
    expect(headerCellWidth(state, table, FocusType.tableComment)).toBe(90);
  });

  it('keeps the least room for the logical name and the domain cells', () => {
    const table = createTable({ id: 'table-1' });
    const state = createState({ show: Show.columnDomain, tables: [table] });

    // 12 + 8 + 60 + 8 + 12 = 100, and the domain's 60 + 8 -> 168 -> 186
    expect(calcTableWidths(table, state).width).toBe(186);

    // And the logical name's 60 + 8 -> 236 -> 254, over the header's 184
    state.settings.nameViewMode = NameViewMode.both;
    expect(calcTableWidths(table, state).width).toBe(254);
  });
});

describe('calcTableHeight', () => {
  it('returns only the chrome for a table without columns', () => {
    // 1 + 8 + 20 + 1, the header band and nothing under it
    expect(calcTableHeight(createTable())).toBe(30);
  });

  it('adds one column height per column id', () => {
    expect(calcTableHeight(createTable({ columnIds: ['a', 'b', 'c'] }))).toBe(
      30 + 3 * COLUMN_HEIGHT
    );
    expect(calcTableHeight(createTable({ columnIds: ['a', 'b', 'c'] }))).toBe(
      102
    );
  });

  /** AC-1. A view showing fewer rows than the table has is that many rows tall, and none is the header alone. */
  it('counts the rows it is given rather than the columns', () => {
    const table = createTable({
      columnIds: Array.from({ length: 40 }, (_, index) => `c${index}`),
    });

    expect(calcTableHeight(table, 0)).toBe(30);
    expect(calcTableHeight(table, 0)).toBe(calcTableHeight(createTable()));
    expect(calcTableHeight(table, 2)).toBe(30 + 2 * COLUMN_HEIGHT);
    expect(calcTableHeight(table)).toBe(30 + 40 * COLUMN_HEIGHT);
  });

  /** AC-13, AC-14. A view card wears a taller header than the document's one line, and taller rows. */
  it('adds the view chrome and the view row for a view source', () => {
    const table = createTable({ columnIds: ['a', 'b', 'c'] });

    expect(calcTableHeight(table, 2, 'flow')).toBe(34 + 2 * VIEW_COLUMN_HEIGHT);
    expect(calcTableHeight(table, 0, 'flow')).toBeGreaterThan(
      calcTableHeight(table, 0)
    );
    expect(calcTableHeight(table, 3, 'flow')).toBeGreaterThan(
      calcTableHeight(table, 3, 'document')
    );
  });

  /**
   * A card ends at its last row: the gap its header keeps over the first one
   * is the only padding it draws under the title, so a card with no row wears
   * that gap as its own and stands the title on the middle of the box.
   */
  it('draws no padding under the rows of a card, in a view or the document', () => {
    const table = createTable({ columnIds: ['a', 'b', 'c'] });
    const rowless = calcTableHeight(table, 0, 'flow');
    const above = TABLE_BORDER + TABLE_PADDING;

    expect(rowless).toBe(34);
    expect(above + VIEW_TABLE_HEADER_ICON_SIZE + above).toBe(rowless);
    expect(calcTableHeight(table, 3, 'flow')).toBe(
      rowless + 3 * VIEW_COLUMN_HEIGHT
    );

    // The document card is the same shape at its own line and row heights.
    expect(calcTableHeight(table, 3)).toBe(
      calcTableHeight(table, 0) + 3 * COLUMN_HEIGHT
    );
    expect(calcTableHeight(table, 0)).toBe(
      TABLE_BORDER +
        TABLE_HEADER_BAND_PADDING +
        TABLE_HEADER_INPUT_HEIGHT +
        TABLE_HEADER_BAND_PADDING +
        TABLE_BORDER
    );
  });
});

describe('calcViewTableWidths', () => {
  const CHROME = (TABLE_BORDER + TABLE_PADDING) * 2;

  /** The row width a name and a type take past the key badge, its gap included. */
  const rowWidth = (name: number, dataType: number) =>
    VIEW_COLUMN_ICON_SIZE +
    VIEW_COLUMN_ICON_GAP +
    name +
    INPUT_MARGIN_RIGHT +
    dataType;

  /**
   * The header width a table name takes past the table icon, at the size a
   * view draws it, with the room its two buttons keep after it.
   */
  const headerWidth = (widthName: number) =>
    VIEW_TABLE_HEADER_ICON_SIZE +
    VIEW_TABLE_HEADER_ICON_GAP +
    viewHeaderNameWidth(widthName) +
    INPUT_MARGIN_RIGHT +
    VIEW_TABLE_HEADER_BUTTONS_WIDTH;

  /** A keys only view over the table, so the key rows are what it shows. */
  function openKeysOnly(
    state: RootState,
    tableId: string,
    showMode: ShowMode = ShowMode.keysOnly
  ) {
    const view = createSceneView(ViewKind.flow, [tableId]);
    view.showMode = showMode;
    state.editor.views.flow = view;
    return view;
  }

  function keyedTable() {
    const columns = [
      createColumn({
        id: 'key',
        tableId: 'table-1',
        ui: {
          keys: ColumnUIKey.primaryKey,
          widthName: 80,
          widthDataType: 90,
          widthComment: 500,
          widthDefault: 500,
        },
      }),
      createColumn({
        id: 'plain',
        tableId: 'table-1',
        ui: { widthName: 300, widthDataType: 300 },
      }),
    ];
    const table = createTable({
      id: 'table-1',
      columnIds: ['key', 'plain'],
      ui: { widthName: 40, widthComment: 400 },
    });

    return { table, columns };
  }

  it('measures only the rows the view shows, the name and the type of each', () => {
    const { table, columns } = keyedTable();
    const state = createState({ tables: [table], columns });
    openKeysOnly(state, table.id);

    expect(viewWidths(table, state)).toEqual({
      width: CHROME + rowWidth(80, 90),
      alternateKey: 0,
      name: 80,
      logicalName: 0,
      comment: 0,
      dataType: 90,
      domain: 0,
      default: 0,
      notNull: 0,
      autoIncrement: 0,
      unique: 0,
    });
  });

  it('measures every row in an all fields view', () => {
    const { table, columns } = keyedTable();
    const state = createState({ tables: [table], columns });
    openKeysOnly(state, table.id, ShowMode.allFields);

    expect(viewWidths(table, state).width).toBe(CHROME + rowWidth(300, 300));
  });

  /** AC-4 and B.5. The document's show bits and column order say nothing about a view. */
  it('reads neither the show bits nor the column order', () => {
    const { table, columns } = keyedTable();
    const shows = [
      0,
      Show.tableComment,
      Show.columnComment,
      Show.columnDataType,
      Show.columnDefault,
      Show.columnNotNull,
      Show.columnAutoIncrement,
      Show.columnUnique,
      Show.relationship,
      Object.values(Show).reduce((acc, bit) => acc | bit, 0),
    ];
    const orders = [
      [ColumnType.columnName, ColumnType.columnDataType],
      [ColumnType.columnDataType, ColumnType.columnName],
      [ColumnType.columnName],
      [],
    ];
    const widths = new Set<string>();

    for (const show of shows) {
      for (const columnOrder of orders) {
        const state = createState({ show, tables: [table], columns });
        state.settings.columnOrder = columnOrder;
        state.settings.maxWidthComment = 10;
        openKeysOnly(state, table.id);
        widths.add(JSON.stringify(viewWidths(table, state)));
      }
    }

    expect(widths.size).toBe(1);
    expect(JSON.parse([...widths][0]).width).toBe(CHROME + rowWidth(80, 90));
  });

  /** AC-5. The type is counted into the width whether the table is lit or not. */
  it('counts the type width whether or not the table is lit', () => {
    const { table, columns } = keyedTable();
    const lit = createState({ tables: [table], columns });
    openKeysOnly(lit, table.id);
    const unlit = createState({ tables: [table], columns });
    openKeysOnly(unlit, 'some-other-table');

    expect(viewWidths(table, lit)).toEqual(viewWidths(table, unlit));

    columns[0].ui.widthDataType = 10;
    // 16 + 6 + 80 + 8 + 10 is under the minimum, so the card takes that instead.
    expect(viewWidths(table, unlit).width).toBe(VIEW_TABLE_MIN_WIDTH);
  });

  /**
   * A 40 unit name, its buttons' room and no row is 105 units of content, under
   * the minimum, so the card is drawn at the minimum instead and the name
   * column, which has no row to widen, stays at nothing.
   */
  it('is the header name alone while the view shows no row', () => {
    const { table, columns } = keyedTable();
    const state = createState({ tables: [table], columns });
    openKeysOnly(state, table.id, ShowMode.nameOnly);

    // 16 + 4 + 49 + 8 + 28
    expect(headerWidth(40)).toBe(105);
    expect(viewWidths(table, state)).toEqual({
      width: VIEW_TABLE_MIN_WIDTH,
      alternateKey: 0,
      name: 0,
      logicalName: 0,
      comment: 0,
      dataType: 0,
      domain: 0,
      default: 0,
      notNull: 0,
      autoIncrement: 0,
      unique: 0,
    });
  });

  it('lets a header wider than any row set the width', () => {
    const { table, columns } = keyedTable();
    table.ui.widthName = 1_000;
    const state = createState({ tables: [table], columns });
    openKeysOnly(state, table.id);

    expect(viewWidths(table, state).width).toBe(CHROME + headerWidth(1_000));
  });

  /**
   * The reference gives its node a minimum, and a short name would otherwise
   * leave a cramped box. What the minimum adds goes to the name column, so the
   * type still stands against the right edge.
   */
  it('draws no card under the minimum, and gives the name what that adds', () => {
    const { table, columns } = keyedTable();
    columns[0].ui.widthName = 20;
    columns[0].ui.widthDataType = 20;
    const state = createState({ tables: [table], columns });
    openKeysOnly(state, table.id);

    const widths = viewWidths(table, state);

    expect(rowWidth(20, 20)).toBe(70);
    expect(widths.width).toBe(VIEW_TABLE_MIN_WIDTH);
    expect(widths.name).toBe(20 + (VIEW_TABLE_MIN_WIDTH - CHROME - 70));
    expect(rowWidth(widths.name, widths.dataType)).toBe(
      VIEW_TABLE_MIN_WIDTH - CHROME
    );
  });

  /**
   * The same slack, from a header wider than the row rather than the minimum.
   * The name absorbing it is what keeps one right edge for every row on a card
   * whose width some other measurement set.
   */
  it('gives the name what a wide header adds too', () => {
    const { table, columns } = keyedTable();
    table.ui.widthName = 1_000;
    const state = createState({ tables: [table], columns });
    openKeysOnly(state, table.id);

    const widths = viewWidths(table, state);

    expect(widths.dataType).toBe(90);
    expect(rowWidth(widths.name, widths.dataType)).toBe(headerWidth(1_000));
  });
});

describe('recalculateTableWidth', () => {
  it('recomputes every width of the tables listed in the doc', () => {
    const column = createColumn({
      id: 'column-1',
      tableId: 'table-1',
      name: 'created_at',
      dataType: 'timestamp',
      default: '',
      comment: 'x',
    });
    const table = createTable({
      id: 'table-1',
      name: 'users',
      comment: 'user table',
      columnIds: ['column-1'],
    });
    const state = createState({ tables: [table], columns: [column] });
    const context = createEngineContext({ toWidth: text => text.length * 10 });

    recalculateTableWidth(state, context);

    // 'users' -> 50, clamped to the 60 minimum
    expect(table.ui.widthName).toBe(60);
    expect(table.ui.widthComment).toBe(100);
    expect(column.ui.widthName).toBe(100);
    expect(column.ui.widthDataType).toBe(90);
    expect(column.ui.widthDefault).toBe(60);
    expect(column.ui.widthComment).toBe(60);
  });

  it('measures the logical names, and the domain cell by the name of the domain a column links while a row lists it', () => {
    const linked = createColumn({
      id: 'column-1',
      tableId: 'table-1',
      logicalName: 'Created at',
      domainId: 'domain-1',
    });
    const removed = createColumn({
      id: 'column-2',
      tableId: 'table-1',
      domainId: 'domain-2',
      ui: { widthDomain: 900 },
    });
    const table = createTable({
      id: 'table-1',
      logicalName: 'Member list',
      columnIds: ['column-1', 'column-2'],
    });
    const state = createState({ tables: [table], columns: [linked, removed] });
    state.collections.domainEntities['domain-1'] = createDomain({
      id: 'domain-1',
      name: 'datetime_utc',
    });
    state.collections.domainEntities['domain-2'] = createDomain({
      id: 'domain-2',
      name: 'a removed domain',
    });
    state.doc.domainIds = ['domain-1'];

    recalculateTableWidth(
      state,
      createEngineContext({ toWidth: text => text.length * 10 })
    );

    expect(table.ui.widthLogicalName).toBe(110);
    expect(linked.ui.widthLogicalName).toBe(100);
    expect(linked.ui.widthDomain).toBe(120);
    expect(removed.ui.widthLogicalName).toBe(60);
    expect(removed.ui.widthDomain).toBe(60);
  });

  it('leaves tables that are not referenced by the doc untouched', () => {
    const listed = createTable({ id: 'table-1', name: 'a-very-long-name' });
    const unlisted = createTable({
      id: 'table-2',
      name: 'another-very-long-name',
    });
    const state = createState({ tables: [listed, unlisted] });
    state.doc.tableIds = ['table-1'];
    const context = createEngineContext({ toWidth: text => text.length * 10 });

    recalculateTableWidth(state, context);

    expect(listed.ui.widthName).toBe(160);
    expect(unlisted.ui.widthName).toBe(60);
  });

  it('skips table ids that have no entity and column ids that have no entity', () => {
    const table = createTable({
      id: 'table-1',
      name: 'wide-table-name',
      columnIds: ['missing-column'],
    });
    const state = createState({ tables: [table] });
    state.doc.tableIds = ['table-1', 'missing-table'];
    const context = createEngineContext({ toWidth: text => text.length * 10 });

    expect(() => recalculateTableWidth(state, context)).not.toThrow();
    expect(table.ui.widthName).toBe(150);
  });
});

describe('calcAlternateKeyWidth', () => {
  /** A table of three columns and a unique index over each list of columns named. */
  function keyed(show: number, ...keyColumnIds: string[][]) {
    const columns = ['a', 'b', 'c'].map(id =>
      createColumn({
        id,
        tableId: 'table-1',
        name: id,
        ui: { widthName: 200 },
      })
    );
    const table = createTable({
      id: 'table-1',
      columnIds: columns.map(column => column.id),
    });
    const state = createState({ show, tables: [table], columns });

    keyColumnIds.forEach((columnIds, keyIndex) => {
      const index = createIndex({
        id: `index-${keyIndex}`,
        tableId: table.id,
        unique: true,
      });

      for (const columnId of columnIds) {
        const indexColumn = createIndexColumn({
          id: `${index.id}-${columnId}`,
          indexId: index.id,
          columnId,
        });
        index.indexColumnIds.push(indexColumn.id);
        state.collections.indexColumnEntities[indexColumn.id] = indexColumn;
      }

      state.collections.indexEntities[index.id] = index;
      state.doc.indexIds.push(index.id);
    });

    return { table, state };
  }

  const markWidth = (mark: string) =>
    Math.ceil(mark.length * COLUMN_ALTERNATE_KEY_CHAR_WIDTH);

  it('is the longest mark of the table while the marks are shown', () => {
    const { table, state } = keyed(
      Show.columnAlternateKey,
      ['a', 'b'],
      ['b', 'c']
    );

    expect(calcAlternateKeyWidth(table, state)).toBe(markWidth('AK1.2,AK2.1'));
  });

  it('is nothing while the marks are hidden or the table has none', () => {
    expect(
      calcAlternateKeyWidth(
        ...(Object.values(keyed(0, ['a', 'b'])) as [Table, RootState])
      )
    ).toBe(0);

    const { table, state } = keyed(Show.columnAlternateKey);
    expect(calcAlternateKeyWidth(table, state)).toBe(0);
  });

  it('is nothing for a unique index over one column, which keys no alternate key', () => {
    const { table, state } = keyed(Show.columnAlternateKey, ['a'], ['c']);

    expect(calcAlternateKeyWidth(table, state)).toBe(0);
  });

  it('widens only a table that shows a mark, by the mark and its margin', () => {
    const shown = keyed(Show.columnAlternateKey, ['a', 'b']);
    const hidden = keyed(0, ['a', 'b']);
    const widths = calcTableWidths(shown.table, shown.state);

    expect(widths.alternateKey).toBe(markWidth('AK1.1'));
    expect(widths.width).toBe(
      calcTableWidths(hidden.table, hidden.state).width +
        markWidth('AK1.1') +
        INPUT_MARGIN_RIGHT
    );
  });

  it('keeps the room when the default columns set the width', () => {
    const { table, state } = keyed(Show.columnAlternateKey, ['a', 'b']);
    for (const id of table.columnIds) {
      state.collections.tableColumnEntities[id].ui.widthName = 0;
    }
    state.settings.show |= Show.columnNotNull | Show.columnUnique;
    const hidden = keyed(Show.columnNotNull | Show.columnUnique, ['a', 'b']);
    for (const id of hidden.table.columnIds) {
      hidden.state.collections.tableColumnEntities[id].ui.widthName = 0;
    }

    expect(calcTableWidths(table, state).width).toBe(
      calcTableWidths(hidden.table, hidden.state).width +
        markWidth('AK1.1') +
        INPUT_MARGIN_RIGHT
    );
  });
});

describe('measureTableSize', () => {
  const toWidth = (text: string) => text.length * 10;

  function fixture() {
    const column = createColumn({
      id: 'column-1',
      tableId: 'table-1',
      name: 'created_at',
      dataType: 'timestamp',
      default: 'CURRENT_TIMESTAMP',
      comment: 'x',
      ui: { widthName: 900, widthDataType: 900 },
    });
    const table = createTable({
      id: 'table-1',
      name: 'users',
      comment: 'user table',
      columnIds: ['column-1'],
      ui: { widthName: 900, widthComment: 900 },
    });
    const state = createState({
      show: Show.tableComment | Show.columnDataType | Show.columnDefault,
      tables: [table],
      columns: [column],
    });
    return { table, column, state };
  }

  it('is the size recalculateTableWidth leaves the table at', () => {
    const { table, state } = fixture();
    const measured = measureTableSize(table, state, toWidth);

    recalculateTableWidth(state, createEngineContext({ toWidth }));

    expect(measured).toEqual({
      width: calcTableWidths(table, state).width,
      height: calcTableHeight(table),
    });
  });

  it('measures in the name view the store shows', () => {
    const { table, column, state } = fixture();
    table.logicalName = 'a member of the club';
    column.logicalName = 'the moment it was created';
    const physical = measureTableSize(table, state, toWidth);

    state.settings.nameViewMode = NameViewMode.both;
    const both = measureTableSize(table, state, toWidth);
    recalculateTableWidth(state, createEngineContext({ toWidth }));

    expect(both.width).toBe(calcTableWidths(table, state).width);
    expect(both.width).toBeGreaterThan(physical.width);
  });

  it('writes nothing into the state and ignores the widths it holds', () => {
    const { table, column, state } = fixture();
    const before = JSON.stringify(state.collections);

    const measured = measureTableSize(table, state, toWidth);

    expect(JSON.stringify(state.collections)).toBe(before);
    expect(table.ui.widthName).toBe(900);
    expect(column.ui.widthDataType).toBe(900);
    expect(measured.width).toBeLessThan(900);
  });
});
