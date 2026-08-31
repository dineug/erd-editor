import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  COLUMN_HEIGHT,
  TABLE_BORDER,
  TABLE_HEADER_HEIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { createEditor } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import { findColumnDropTarget } from '@/konva/scene/columnDropTarget';
import { getTableRect } from '@/konva/scene/metrics';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

const TABLE_INSET = TABLE_BORDER + TABLE_PADDING;

function createState(): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;
  return state;
}

function addTable(
  state: RootState,
  id: string,
  x: number,
  y: number,
  columns: string[]
) {
  const table = createTable({ id, ui: { x, y } });
  state.collections.tableEntities[id] = table;
  state.doc.tableIds.push(id);

  for (const columnId of columns) {
    state.collections.tableColumnEntities[columnId] = createColumn({
      id: columnId,
      tableId: id,
    });
    table.columnIds.push(columnId);
  }

  return table;
}

/** The centre of one row, which is where a pointer over that row sits. */
function rowCentre(state: RootState, tableId: string, index: number) {
  const table = state.collections.tableEntities[tableId];
  const rect = getTableRect(state, table);

  return {
    x: rect.x + rect.width / 2,
    y:
      rect.y +
      TABLE_INSET +
      TABLE_HEADER_HEIGHT +
      index * COLUMN_HEIGHT +
      COLUMN_HEIGHT / 2,
  };
}

describe('the row a column drag drops on (AC-G5)', () => {
  it('names the row the pointer is over inside a table', () => {
    const state = createState();
    addTable(state, 't1', 100, 100, ['c1', 'c2', 'c3']);

    expect(findColumnDropTarget(state, rowCentre(state, 't1', 1))).toEqual({
      tableId: 't1',
      columnId: 'c2',
      index: 1,
    });
  });

  it('names a row of another table the drag has reached', () => {
    const state = createState();
    addTable(state, 't1', 100, 100, ['c1', 'c2']);
    addTable(state, 't2', 600, 400, ['x1', 'x2']);

    expect(findColumnDropTarget(state, rowCentre(state, 't2', 0))).toEqual({
      tableId: 't2',
      columnId: 'x1',
      index: 0,
    });
  });

  it('names nothing over bare canvas', () => {
    const state = createState();
    addTable(state, 't1', 100, 100, ['c1']);

    expect(findColumnDropTarget(state, { x: 900, y: 900 })).toBeNull();
  });

  it('names nothing over a table header', () => {
    const state = createState();
    const table = addTable(state, 't1', 100, 100, ['c1', 'c2']);
    const rect = getTableRect(state, table);

    expect(
      findColumnDropTarget(state, { x: rect.x + 20, y: rect.y + 4 })
    ).toBeNull();
  });

  it('names nothing past the last row of a table', () => {
    const state = createState();
    addTable(state, 't1', 100, 100, ['c1']);

    expect(findColumnDropTarget(state, rowCentre(state, 't1', 1))).toBeNull();
  });

  it('takes the row of whichever table is drawn over the others there', () => {
    const state = createState();
    const under = addTable(state, 't1', 100, 100, ['c1', 'c2']);
    const over = addTable(state, 't2', 100, 100, ['x1', 'x2']);
    under.ui.zIndex = 1;
    over.ui.zIndex = 2;

    expect(findColumnDropTarget(state, rowCentre(state, 't1', 0))).toEqual({
      tableId: 't2',
      columnId: 'x1',
      index: 0,
    });
  });

  it('names the row under a pointer on a canvas the zoom has shrunk', () => {
    const state = createState();
    state.settings.width = 8000;
    state.settings.height = 8000;
    state.settings.zoomLevel = 0.5;
    state.editor.viewport = { width: 1000, height: 1000 };
    // What the middle of the screen inverts to here. The culling rect this
    // shares with the scene used to have dropped the table before the row
    // arithmetic ever ran, so a drag over a visible row found nothing.
    const centre = (500 - (8000 * (1 - 0.5)) / 2) / 0.5;
    addTable(state, 't1', centre, centre, ['c1', 'c2']);

    expect(findColumnDropTarget(state, rowCentre(state, 't1', 1))).toEqual({
      tableId: 't1',
      columnId: 'c2',
      index: 1,
    });
  });

  it('never reads the hit canvas, which is a frame the bench measures', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/konva/scene/columnDropTarget.ts'),
      'utf8'
    );

    expect(source).not.toContain('getIntersection');
  });
});
