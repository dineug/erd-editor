import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  COLUMN_HEIGHT,
  TABLE_BORDER,
  TABLE_HEADER_HEIGHT,
  TABLE_PADDING,
  VIEW_COLUMN_HEIGHT,
  VIEW_TABLE_HEADER_HEIGHT,
} from '@/constants/layout';
import {
  createEditor,
  ShowMode,
  ViewKind,
} from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import {
  getColumnRect,
  getMemoRect,
  getTableRect,
  getTableWidths,
} from '@/konva/scene/metrics';
import { getVisibleColumnIds } from '@/konva/scene/viewLayout';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';
import {
  calcTableHeight,
  calcTableWidths,
  calcViewTableWidths,
} from '@/utils/calcTable';
import { createMemo } from '@/utils/collection/memo.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

/** The view widths for the rows a view shows, which the function no longer looks up itself. */
const viewWidths = (table: Table, state: RootState) =>
  calcViewTableWidths(table, state, getVisibleColumnIds(state, table, 'flow'));

function createState(): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;
  return state;
}

function addTable(state: RootState, id: string, x: number, y: number): Table {
  const table = createTable({ id, ui: { x, y } });
  state.collections.tableEntities[id] = table;
  state.doc.tableIds.push(id);
  return table;
}

function addColumn(state: RootState, table: Table, id: string) {
  const column = createColumn({ id, tableId: table.id });
  state.collections.tableColumnEntities[id] = column;
  table.columnIds.push(id);
  return column;
}

describe('a table box is the size the rest of the editor measures', () => {
  let state: RootState;

  beforeEach(() => {
    state = createState();
  });

  it('takes its position from the table and its size from calcTable', () => {
    const table = addTable(state, 'A', 120, 340);

    expect(getTableRect(state, table)).toEqual({
      x: 120,
      y: 340,
      width: calcTableWidths(table, state).width,
      height: calcTableHeight(table),
    });
  });

  it('grows by one row height for every column', () => {
    const table = addTable(state, 'A', 0, 0);
    const before = getTableRect(state, table).height;
    addColumn(state, table, 'c1');
    addColumn(state, table, 'c2');

    expect(getTableRect(state, table).height).toBe(before + COLUMN_HEIGHT * 2);
  });
});

describe('a table box in a view', () => {
  let state: RootState;
  let table: Table;

  beforeEach(() => {
    state = createState();
    table = addTable(state, 'A', 120, 340);
    addColumn(state, table, 'c1');
    addColumn(state, table, 'c2');
    const view = createSceneView(ViewKind.flow, ['A']);
    view.showMode = ShowMode.nameOnly;
    view.positions.A = { x: -900, y: 4_000 };
    state.editor.views.flow = view;
  });

  it('stands at the view point and is the size the view measures', () => {
    expect(getTableRect(state, table, 'flow')).toEqual({
      x: -900,
      y: 4_000,
      width: viewWidths(table, state).width,
      height: calcTableHeight(table, 0, 'flow'),
    });
  });

  it('leaves the document box where the document has it', () => {
    expect(getTableRect(state, table)).toEqual({
      x: 120,
      y: 340,
      width: calcTableWidths(table, state).width,
      height: calcTableHeight(table),
    });
  });

  it('lays its rows out against the view widths', () => {
    expect(getTableWidths(state, table, 'flow')).toEqual(
      viewWidths(table, state)
    );
    expect(getTableWidths(state, table)).toEqual(calcTableWidths(table, state));
  });

  it('agrees with the box on the view widths while no view is open', () => {
    state.editor.views.flow = null;

    const rect = getTableRect(state, table, 'flow');

    expect(rect).toEqual({
      x: 120,
      y: 340,
      width: viewWidths(table, state).width,
      height: calcTableHeight(table, table.columnIds.length, 'flow'),
    });
    expect(getTableWidths(state, table, 'flow').width).toBe(rect.width);
  });

  it('puts the first row of a view below the view header at the view point', () => {
    expect(getColumnRect(state, table, 0, 'flow')).toMatchObject({
      x: -900 + TABLE_BORDER + TABLE_PADDING,
      y: 4_000 + TABLE_BORDER + TABLE_PADDING + VIEW_TABLE_HEADER_HEIGHT,
      height: VIEW_COLUMN_HEIGHT,
    });
  });

  /**
   * AC-15. Both offsets are written down here rather than read back out of the
   * sum under test, so a change to the document arithmetic fails this case and
   * a change to the view arithmetic alone does not.
   */
  it('drops the third row 77 units in the document and 97 in a view', () => {
    // 9 of border and padding, then a 20 header over two 24 rows in the
    // document, and the same 9 over a 24 header and two 32 rows in a view.
    expect(
      getColumnRect(state, table, 2, 'document').y -
        getTableRect(state, table).y
    ).toBe(77);
    expect(
      getColumnRect(state, table, 2, 'flow').y -
        getTableRect(state, table, 'flow').y
    ).toBe(97);
  });
});

describe('a column row sits inside the table it belongs to', () => {
  let state: RootState;
  let table: Table;

  beforeEach(() => {
    state = createState();
    table = addTable(state, 'A', 40, 60);
    addColumn(state, table, 'c1');
    addColumn(state, table, 'c2');
  });

  it('starts below the header, inside the border and padding', () => {
    expect(getColumnRect(state, table, 0)).toEqual({
      x: 40 + TABLE_BORDER + TABLE_PADDING,
      y: 60 + TABLE_BORDER + TABLE_PADDING + TABLE_HEADER_HEIGHT,
      width:
        getTableRect(state, table).width - (TABLE_BORDER + TABLE_PADDING) * 2,
      height: COLUMN_HEIGHT,
    });
  });

  it('stacks each row one height below the last', () => {
    const first = getColumnRect(state, table, 0);
    const second = getColumnRect(state, table, 1);

    expect(second.y - first.y).toBe(COLUMN_HEIGHT);
    expect(second.x).toBe(first.x);
    expect(second.width).toBe(first.width);
  });

  it('ends where the table ends, less its border', () => {
    const { y, height } = getTableRect(state, table);
    const last = getColumnRect(state, table, table.columnIds.length - 1);

    expect(last.y + last.height).toBe(y + height - TABLE_BORDER);
  });
});

describe('a memo box is the size the memo component draws', () => {
  it('takes its position from the memo and its size from calcMemo', () => {
    const memo = createMemo({ id: 'M', ui: { x: 500, y: 20 } });

    expect(getMemoRect(memo)).toEqual({
      x: 500,
      y: 20,
      width: calcMemoWidth(memo),
      height: calcMemoHeight(memo),
    });
  });
});
