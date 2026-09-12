import { query } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  VIEW_COLUMN_HEIGHT,
  VIEW_TABLE_HEADER_HEIGHT,
} from '@/constants/layout';
import { ColumnUIKey } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { ShowMode, ViewKind } from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { createStore } from '@/engine/store';
import { Table } from '@/internal-types';
import { getVisibleColumnIds } from '@/konva/scene/viewLayout';
import { calcViewTableWidths } from '@/utils/calcTable';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  euclideanDistance,
  manhattanDistance,
  tableToObjectPoint,
} from '@/utils/draw-relationship/calc';

/** The view widths for the rows the Focus view shows, which the function no longer looks up itself. */
const viewWidths = (table: Table, state: RootState) =>
  calcViewTableWidths(table, state, getVisibleColumnIds(state, table, 'flow'));

function createState(): RootState {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() })
    .state;
}

function addTable(state: RootState, table: Table): Table {
  query(state.collections).collection('tableEntities').addOne(table);
  return table;
}

/** The border, padding and header a view card carries whatever rows it draws. */
const VIEW_CHROME = 1 + 8 + VIEW_TABLE_HEADER_HEIGHT + 8 + 1;

describe('tableToObjectPoint', () => {
  it('derives the nine anchor points of an empty table', () => {
    const state = createState();
    const table = addTable(
      state,
      createTable({ id: 'table-a', ui: { x: 100, y: 50 } })
    );

    const point = tableToObjectPoint(state, table);

    // default widths (60) + default show flags => 365 wide,
    // no columns => 1 + 8 + 38 + 0 + 8 + 1 = 56 high
    expect(point.width).toBe(365);
    expect(point.height).toBe(56);
    expect(point).toEqual({
      width: 365,
      height: 56,
      top: { x: 282.5, y: 50 },
      bottom: { x: 282.5, y: 106 },
      left: { x: 100, y: 78 },
      right: { x: 465, y: 78 },
      lt: { x: 100, y: 50 },
      rt: { x: 465, y: 50 },
      lb: { x: 100, y: 106 },
      rb: { x: 465, y: 106 },
    });
  });

  it('grows the height by COLUMN_HEIGHT per column and widens for the widest column name', () => {
    const state = createState();
    const columnCollection = query(state.collections).collection(
      'tableColumnEntities'
    );
    columnCollection.addMany([
      createColumn({ id: 'column-1', tableId: 'table-a' }),
      createColumn({
        id: 'column-2',
        tableId: 'table-a',
        ui: { widthName: 200 },
      }),
    ]);
    const table = addTable(
      state,
      createTable({
        id: 'table-a',
        columnIds: ['column-1', 'column-2'],
        ui: { x: 0, y: 0 },
      })
    );

    const point = tableToObjectPoint(state, table);

    expect(point.height).toBe(56 + 2 * 24);
    expect(point.width).toBe(505);
    expect(point.top).toEqual({ x: 252.5, y: 0 });
    expect(point.bottom).toEqual({ x: 252.5, y: 104 });
    expect(point.left).toEqual({ x: 0, y: 52 });
    expect(point.right).toEqual({ x: 505, y: 52 });
  });

  it('keeps the corner points consistent with the edge midpoints', () => {
    const state = createState();
    const table = addTable(
      state,
      createTable({ id: 'table-a', ui: { x: -40, y: -25 } })
    );

    const point = tableToObjectPoint(state, table);

    expect(point.lt).toEqual({ x: -40, y: -25 });
    expect(point.rt).toEqual({ x: -40 + point.width, y: -25 });
    expect(point.lb).toEqual({ x: -40, y: -25 + point.height });
    expect(point.rb).toEqual({
      x: -40 + point.width,
      y: -25 + point.height,
    });
    expect(point.top.x).toBe((point.lt.x + point.rt.x) / 2);
    expect(point.left.y).toBe((point.lt.y + point.lb.y) / 2);
  });

  it('shrinks the width when the comment columns are hidden', () => {
    const state = createState();
    const table = addTable(
      state,
      createTable({ id: 'table-a', ui: { x: 0, y: 0 } })
    );
    const withComment = tableToObjectPoint(state, table).width;

    state.settings.show = 0;
    const withoutComment = tableToObjectPoint(state, table).width;

    expect(withComment).toBe(365);
    // only the base column layout remains: 1 + 8 + 100 + 8 + 1
    expect(withoutComment).toBe(118);
    expect(withoutComment).toBeLessThan(withComment);
  });
});

describe('tableToObjectPoint for a view', () => {
  /** Forty columns, the first a key, on a table the view places far from the document's point. */
  function seed(showMode: ShowMode) {
    const state = createState();
    const columnIds = Array.from({ length: 40 }, (_, index) => `c${index}`);
    query(state.collections)
      .collection('tableColumnEntities')
      .addMany(
        columnIds.map((id, index) =>
          createColumn({
            id,
            tableId: 'table-a',
            ui: { keys: index === 0 ? ColumnUIKey.primaryKey : 0 },
          })
        )
      );
    const table = addTable(
      state,
      createTable({ id: 'table-a', columnIds, ui: { x: 100, y: 50 } })
    );
    const view = createSceneView(ViewKind.flow, ['table-a']);
    view.showMode = showMode;
    view.positions['table-a'] = { x: 5_000, y: -3_000 };
    state.editor.views.flow = view;

    return { state, table, view };
  }

  /** AC-1 and AC-6. A name only box is the view header alone, at the view point, edges included. */
  it('measures a name only table as its header at the view point', () => {
    const { state, table } = seed(ShowMode.nameOnly);

    const point = tableToObjectPoint(state, table, 'flow');

    expect(point.height).toBe(VIEW_CHROME);
    expect(point.lt).toEqual({ x: 5_000, y: -3_000 });
    expect(point.rb).toEqual({
      x: 5_000 + point.width,
      y: -3_000 + VIEW_CHROME,
    });
    expect(point.left).toEqual({ x: 5_000, y: -3_000 + VIEW_CHROME / 2 });
  });

  it('measures a keys only table by its key rows', () => {
    const { state, table } = seed(ShowMode.keysOnly);

    expect(tableToObjectPoint(state, table, 'flow').height).toBe(
      VIEW_CHROME + VIEW_COLUMN_HEIGHT
    );
  });

  /** AC-6. The four points the sort anchors against are the midpoints of the header box's edges. */
  it('puts the four anchor edges of a name only table on its header box', () => {
    const { state, table } = seed(ShowMode.nameOnly);

    const { width, top, bottom, left, right } = tableToObjectPoint(
      state,
      table,
      'flow'
    );

    expect(top).toEqual({ x: 5_000 + width / 2, y: -3_000 });
    expect(bottom).toEqual({ x: 5_000 + width / 2, y: -3_000 + VIEW_CHROME });
    expect(left).toEqual({ x: 5_000, y: -3_000 + VIEW_CHROME / 2 });
    expect(right).toEqual({
      x: 5_000 + width,
      y: -3_000 + VIEW_CHROME / 2,
    });
  });

  it('leaves the document measure as it was, before and after a view read', () => {
    const { state, table } = seed(ShowMode.nameOnly);
    const before = tableToObjectPoint(state, table);

    const view = tableToObjectPoint(state, table, 'flow');
    const after = tableToObjectPoint(state, table);

    expect(before.height).toBe(56 + 40 * 24);
    expect(before.lt).toEqual({ x: 100, y: 50 });
    expect(after).toEqual(before);
    expect(view.height).not.toBe(before.height);
  });

  /**
   * The view slot is read before a view is open, on the frame between a scene
   * mount and its layout, and that read must not be handed back once a view is.
   */
  it('measures every row the view way while no view is open, and keeps it once one is', () => {
    const { state, table, view } = seed(ShowMode.allFields);
    state.editor.views.flow = null;

    const before = tableToObjectPoint(state, table, 'flow');
    expect(before.height).toBe(VIEW_CHROME + 40 * VIEW_COLUMN_HEIGHT);
    expect(before.width).toBe(viewWidths(table, state).width);
    expect(before.width).not.toBe(tableToObjectPoint(state, table).width);
    expect(before.lt).toEqual({ x: 100, y: 50 });

    state.editor.views.flow = view;
    const after = tableToObjectPoint(state, table, 'flow');
    expect(after.width).toBe(viewWidths(table, state).width);
    expect(after.height).toBe(VIEW_CHROME + 40 * VIEW_COLUMN_HEIGHT);
    expect(after.lt).toEqual({ x: 5_000, y: -3_000 });
  });

  /** AC-4. A view reads none of the show bits, so toggling one leaves its measure and its key alone. */
  it('does not remeasure a view when a document show bit changes', () => {
    const { state, table } = seed(ShowMode.keysOnly);
    const before = tableToObjectPoint(state, table, 'flow');

    // A wider type on the one shown row: a remeasure would pick it up, and
    // the key does not carry it, so only a show bit in the key could.
    query(state.collections)
      .collection('tableColumnEntities')
      .selectById('c0')!.ui.widthDataType += 500;
    state.settings.show = 0;

    const after = tableToObjectPoint(state, table, 'flow');
    expect(after).toEqual(before);
    expect(after.width).not.toBe(viewWidths(table, state).width);
  });

  it('follows the show mode from one read to the next', () => {
    const { state, table, view } = seed(ShowMode.nameOnly);

    expect(tableToObjectPoint(state, table, 'flow').height).toBe(VIEW_CHROME);

    view.showMode = ShowMode.allFields;
    expect(tableToObjectPoint(state, table, 'flow').height).toBe(
      VIEW_CHROME + 40 * VIEW_COLUMN_HEIGHT
    );

    view.showMode = ShowMode.keysOnly;
    expect(tableToObjectPoint(state, table, 'flow').height).toBe(
      VIEW_CHROME + VIEW_COLUMN_HEIGHT
    );
  });
});

describe('euclideanDistance', () => {
  it('returns 0 for identical points', () => {
    expect(euclideanDistance({ x: 12, y: -7 }, { x: 12, y: -7 })).toBe(0);
  });

  it('computes the hypotenuse of the 3-4-5 triangle', () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(euclideanDistance({ x: 3, y: 4 }, { x: 0, y: 0 })).toBe(5);
  });

  it('is unaffected by the sign of the delta', () => {
    expect(euclideanDistance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
  });

  it('reduces to the axis delta when the points share a coordinate', () => {
    expect(euclideanDistance({ x: 10, y: 0 }, { x: 10, y: 25 })).toBe(25);
    expect(euclideanDistance({ x: -10, y: 3 }, { x: 10, y: 3 })).toBe(20);
  });

  it('handles a non integral result', () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(
      Math.SQRT2,
      10
    );
  });
});

describe('manhattanDistance', () => {
  it('returns 0 for identical points', () => {
    expect(manhattanDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('sums the absolute axis deltas', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(manhattanDistance({ x: 3, y: 4 }, { x: 0, y: 0 })).toBe(7);
    expect(manhattanDistance({ x: -2, y: -3 }, { x: 2, y: 3 })).toBe(10);
  });

  it('is never smaller than the euclidean distance', () => {
    const a = { x: -12, y: 7 };
    const b = { x: 31, y: -4 };

    expect(manhattanDistance(a, b)).toBeGreaterThanOrEqual(
      euclideanDistance(a, b)
    );
  });
});
