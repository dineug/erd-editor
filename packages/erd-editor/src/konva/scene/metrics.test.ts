import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  COLUMN_HEIGHT,
  TABLE_BORDER,
  TABLE_HEADER_HEIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import {
  getColumnRect,
  getMemoRect,
  getTableRect,
} from '@/konva/scene/metrics';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { createMemo } from '@/utils/collection/memo.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

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
