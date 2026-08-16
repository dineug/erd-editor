import { query } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { RootState } from '@/engine/state';
import { createStore } from '@/engine/store';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  euclideanDistance,
  manhattanDistance,
  tableToObjectPoint,
} from '@/utils/draw-relationship/calc';

function createState(): RootState {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() })
    .state;
}

function addTable(state: RootState, table: Table): Table {
  query(state.collections).collection('tableEntities').addOne(table);
  return table;
}

describe('tableToObjectPoint', () => {
  it('derives the nine anchor points of an empty table', () => {
    const state = createState();
    const table = addTable(
      state,
      createTable({ id: 'table-a', ui: { x: 100, y: 50 } })
    );

    const point = tableToObjectPoint(state, table);

    // default widths (60) + default `show` flags => 365 wide,
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
