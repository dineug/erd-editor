import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  COLUMN_HEIGHT,
  TABLE_BORDER,
  TABLE_HEADER_HEIGHT,
  TABLE_PADDING,
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

/** The view widths for the rows the Focus view shows, which the function no longer looks up itself. */
const viewWidths = (table: Table, state: RootState) =>
  calcViewTableWidths(table, state, getVisibleColumnIds(state, table, 'focus'));

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
    const view = createSceneView(ViewKind.focus, ['A']);
    view.showMode = ShowMode.nameOnly;
    view.positions.A = { x: -900, y: 4_000 };
    state.editor.views.focus = view;
  });

  it('stands at the view point and is the size the view measures', () => {
    expect(getTableRect(state, table, 'focus')).toEqual({
      x: -900,
      y: 4_000,
      width: viewWidths(table, state).width,
      height: calcTableHeight(table, 0),
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
    expect(getTableWidths(state, table, 'focus')).toEqual(
      viewWidths(table, state)
    );
    expect(getTableWidths(state, table)).toEqual(calcTableWidths(table, state));
  });

  it('agrees with the box on the view widths while no view is open', () => {
    state.editor.views.focus = null;

    const rect = getTableRect(state, table, 'focus');

    expect(rect).toEqual({
      x: 120,
      y: 340,
      width: viewWidths(table, state).width,
      height: calcTableHeight(table),
    });
    expect(getTableWidths(state, table, 'focus').width).toBe(rect.width);
  });

  it('puts the first row of a view below the header at the view point', () => {
    expect(getColumnRect(state, table, 0, 'focus')).toMatchObject({
      x: -900 + TABLE_BORDER + TABLE_PADDING,
      y: 4_000 + TABLE_BORDER + TABLE_PADDING + TABLE_HEADER_HEIGHT,
      height: COLUMN_HEIGHT,
    });
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

  it('ends where the table ends, less its border and padding', () => {
    const { y, height } = getTableRect(state, table);
    const last = getColumnRect(state, table, table.columnIds.length - 1);

    expect(last.y + last.height).toBe(
      y + height - (TABLE_BORDER + TABLE_PADDING)
    );
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
