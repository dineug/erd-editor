import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  beginColumnDragPointer,
  endColumnDragPointer,
  getColumnDragPointer,
  moveColumnDragPointer,
} from '@/components/erd/canvas/column-drag-ghost/columnDragPointer';
import { COLUMN_HEIGHT } from '@/constants/layout';
import { createEditor } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import { getColumnRect, getTableRect } from '@/konva/scene/metrics';
import { createTable } from '@/utils/collection/table.entity';

function createState(): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  const table = createTable({ id: 't1', ui: { x: 100, y: 100 } });
  table.columnIds.push('c1', 'c2', 'c3');
  state.collections.tableEntities.t1 = table;
  state.doc.tableIds.push('t1');
  return state;
}

describe('the pointer a column drag holds', () => {
  it('holds the pressed row where it was taken, as far down the stack as it is dragged', () => {
    const state = createState();
    const table = state.collections.tableEntities.t1;
    const row = getColumnRect(state, table, 2);
    const press = { x: row.x + 30, y: row.y + 5 };

    beginColumnDragPointer(state, table, press, {
      columnId: 'c3',
      columnIds: ['c1', 'c3'],
    });

    expect(getColumnDragPointer(state)).toEqual({
      ...press,
      grabX: press.x - getTableRect(state, table).x,
      grabY: 5 + COLUMN_HEIGHT,
      over: true,
    });
    endColumnDragPointer(state);
  });

  it('follows a drag that began, and nothing for one that never did', () => {
    const state = createState();
    const table = state.collections.tableEntities.t1;

    moveColumnDragPointer(state, { x: 1, y: 2 }, false);
    expect(getColumnDragPointer(state)).toBeNull();

    beginColumnDragPointer(
      state,
      table,
      { x: 0, y: 0 },
      { columnId: 'c1', columnIds: ['c1'] }
    );
    moveColumnDragPointer(state, { x: 40, y: 50 }, false);

    expect(getColumnDragPointer(state)).toMatchObject({
      x: 40,
      y: 50,
      over: false,
    });
    endColumnDragPointer(state);
    expect(getColumnDragPointer(state)).toBeNull();
  });

  it('keeps the drag of one editor out of another on the same page', () => {
    const first = createState();
    const second = createState();

    beginColumnDragPointer(
      first,
      first.collections.tableEntities.t1,
      { x: 0, y: 0 },
      { columnId: 'c1', columnIds: ['c1'] }
    );

    expect(getColumnDragPointer(first)).not.toBeNull();
    expect(getColumnDragPointer(second)).toBeNull();
    endColumnDragPointer(first);
  });
});
