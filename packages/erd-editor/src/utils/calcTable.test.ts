import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  INPUT_MARGIN_RIGHT,
  TABLE_BORDER,
  TABLE_PADDING,
  VIEW_COLUMN_HEIGHT,
} from '@/constants/layout';
import { ColumnType, ColumnUIKey, Show } from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import {
  createEditor,
  ShowMode,
  ViewKind,
} from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { getVisibleColumnIds } from '@/konva/scene/viewLayout';
import {
  calcTableHeight,
  calcTableWidths,
  calcViewTableWidths,
  recalculateTableWidth,
} from '@/utils/calcTable';
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

    // 12 + 8 + 60 + 8 + 12 = 100 -> 1 + 8 + 100 + 8 + 1
    expect(calcTableWidths(table, state)).toEqual({
      width: 118,
      name: 0,
      comment: 0,
      dataType: 0,
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

    // (100 + 8) + (70 + 8) = 186 -> 1 + 8 + 186 + 8 + 1
    expect(calcTableWidths(table, state).width).toBe(204);
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
    ).toBe(199);
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
    ).toBe(204);
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
      name: 80,
      comment: 120,
      dataType: 90,
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
      name: 80,
      comment: 0,
      dataType: 90,
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
      name: 0,
      comment: 0,
      dataType: 0,
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
      name: 200,
      comment: 0,
      dataType: 0,
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

    // (500 + 8) -> 1 + 8 + 508 + 8 + 1
    expect(calcTableWidths(table, state).width).toBe(526);
  });
});

describe('calcTableHeight', () => {
  it('returns only the chrome for a table without columns', () => {
    expect(calcTableHeight(createTable())).toBe(56);
  });

  it('adds one column height per column id', () => {
    expect(calcTableHeight(createTable({ columnIds: ['a', 'b', 'c'] }))).toBe(
      56 + 3 * COLUMN_HEIGHT
    );
    expect(calcTableHeight(createTable({ columnIds: ['a', 'b', 'c'] }))).toBe(
      128
    );
  });

  /** AC-1. A view showing fewer rows than the table has is that many rows tall, and none is the header alone. */
  it('counts the rows it is given rather than the columns', () => {
    const table = createTable({
      columnIds: Array.from({ length: 40 }, (_, index) => `c${index}`),
    });

    expect(calcTableHeight(table, 0)).toBe(56);
    expect(calcTableHeight(table, 0)).toBe(calcTableHeight(createTable()));
    expect(calcTableHeight(table, 2)).toBe(56 + 2 * COLUMN_HEIGHT);
    expect(calcTableHeight(table)).toBe(56 + 40 * COLUMN_HEIGHT);
  });

  /** AC-13, AC-14. A view card wears a shorter header and shorter rows than the document card. */
  it('adds the view chrome and the view row for a view source', () => {
    const table = createTable({ columnIds: ['a', 'b', 'c'] });

    expect(calcTableHeight(table, 0, 'flow')).toBe(42);
    expect(calcTableHeight(table, 2, 'flow')).toBe(42 + 2 * VIEW_COLUMN_HEIGHT);
    expect(calcTableHeight(table, 0, 'flow')).toBeLessThan(
      calcTableHeight(table, 0)
    );
    expect(calcTableHeight(table, 3, 'flow')).toBeLessThan(
      calcTableHeight(table, 3, 'document')
    );
  });
});

describe('calcViewTableWidths', () => {
  const CHROME = (TABLE_BORDER + TABLE_PADDING) * 2;

  /** The row width a name and a type take past the key badge, margins included. */
  const rowWidth = (name: number, dataType: number) =>
    COLUMN_KEY_WIDTH +
    INPUT_MARGIN_RIGHT +
    name +
    INPUT_MARGIN_RIGHT +
    dataType +
    INPUT_MARGIN_RIGHT;

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
      name: 80,
      comment: 0,
      dataType: 90,
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
    expect(viewWidths(table, unlit).width).toBe(CHROME + rowWidth(80, 10));
  });

  it('is the header name alone while the view shows no row', () => {
    const { table, columns } = keyedTable();
    const state = createState({ tables: [table], columns });
    openKeysOnly(state, table.id, ShowMode.nameOnly);

    expect(viewWidths(table, state)).toEqual({
      width: CHROME + 40 + INPUT_MARGIN_RIGHT,
      name: 0,
      comment: 0,
      dataType: 0,
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

    expect(viewWidths(table, state).width).toBe(
      CHROME + 1_000 + INPUT_MARGIN_RIGHT
    );
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
