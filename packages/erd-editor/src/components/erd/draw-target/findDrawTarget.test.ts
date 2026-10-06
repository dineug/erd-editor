import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import {
  containsPoint,
  type DrawTargetQuery,
  findDrawTarget,
  hasTravelled,
  SELF_REFERENCE_TRAVEL,
} from '@/components/erd/draw-target/findDrawTarget';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  moveToTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import type { Point } from '@/internal-types';
import { getTableRect } from '@/konva/scene/metrics';
import { getSceneTransform, toScreenPoint } from '@/konva/scene/viewport';
import { isHighLevelTable } from '@/utils/validation';

let app: AppContext;

const addTable = (id: string, x: number, y: number, zIndex = 2) =>
  app.store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex } }));

const sceneRectOf = (id: string) => {
  const { state } = app.store;
  return getTableRect(state, state.collections.tableEntities[id]);
};

/** A screen point a little inside the top left corner of a table's box. */
const insideOf = (id: string, dx = 4, dy = 4): Point => {
  const rect = sceneRectOf(id);
  return toScreenPoint(getSceneTransform(app.store.state), {
    x: rect.x + dx,
    y: rect.y + dy,
  });
};

const find = (pointer: Point, query: Partial<DrawTargetQuery> = {}) =>
  findDrawTarget(app.store.state, {
    pointer,
    startTableId: 'start',
    selfArmed: false,
    current: null,
    keep: [],
    ...query,
  });

// The relationship hooks a table wakes run on a timer that would outlast the file.
afterEach(() => {
  app.store.destroy();
});

beforeEach(() => {
  app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 1200, height: 800 }));
  addTable('start', 40, 40);
});

describe('findDrawTarget', () => {
  it('names the table under the pointer, and none over the empty canvas', () => {
    addTable('orders', 400, 40);

    expect(find(insideOf('orders'))).toBe('orders');
    expect(find({ x: 1100, y: 700 })).toBeNull();
  });

  it('names no table under a memo, which takes the press for itself', () => {
    addTable('orders', 400, 40);
    app.store.dispatchSync(
      addMemoAction({
        id: 'memo',
        ui: { x: 400, y: 40, width: 40, height: 80, zIndex: 1 },
      })
    );
    const { width } = sceneRectOf('orders');

    expect(find(insideOf('orders'))).toBeNull();
    expect(find(insideOf('orders', width - 4))).toBe('orders');
  });

  it('names the table of the larger z-index where two overlap', () => {
    addTable('upper', 400, 40, 9);
    addTable('lower', 410, 50, 3);

    expect(find(insideOf('lower'))).toBe('upper');
  });

  /**
   * The canvas paints a z-index tie in the document's order, the later on top,
   * and the later takes the press; the same two tables listed the other way
   * round draw, and name, the other one.
   */
  it('names the later of two tables at the same z-index, as the canvas paints it on top', () => {
    addTable('first', 400, 40);
    addTable('second', 410, 50);
    const pointer = insideOf('second');

    expect(find(pointer)).toBe('second');

    app.store.state.doc.tableIds = ['start', 'second', 'first'];

    expect(find(pointer)).toBe('first');
  });

  it('offers the start table only once the pointer has travelled from the press', () => {
    const pointer = insideOf('start');

    expect(find(pointer)).toBeNull();
    expect(find(pointer, { selfArmed: true })).toBe('start');
  });

  it('reads the travel in screen pixels, 23 short and 24 enough', () => {
    const press = { x: 100, y: 100 };

    expect(SELF_REFERENCE_TRAVEL).toBe(24);
    expect(hasTravelled(press, { x: 123, y: 100 })).toBe(false);
    expect(hasTravelled(press, { x: 124, y: 100 })).toBe(true);
    expect(hasTravelled(press, { x: 100 + 14.4, y: 100 + 19.2 })).toBe(true);
  });

  it('reads the same boxes at a zoom that draws a table by its name alone', () => {
    addTable('orders', 400, 40);
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));

    expect(isHighLevelTable(app.store.state.settings.zoomLevel)).toBe(true);
    expect(find(insideOf('orders'))).toBe('orders');
    expect(find(insideOf('orders', -8, 4))).toBeNull();
  });

  it('follows the canvas placement, so a pan moves what lies under a still pointer', () => {
    addTable('orders', 400, 40);
    const pointer = insideOf('orders');

    app.store.dispatchSync(scrollToAction({ originX: -2000, originY: 0 }));

    expect(find(pointer)).toBeNull();
  });

  describe('over the buttons or the strip beside them', () => {
    const keep = [{ x: 0, y: 0, width: 200, height: 200 }];

    it('keeps the table they stand beside, whatever lies under them', () => {
      addTable('orders', 400, 40);

      expect(find(insideOf('start'), { current: 'orders', keep })).toBe(
        'orders'
      );
    });

    it('keeps it where the strip reaches over a neighbour', () => {
      addTable('orders', 400, 40);
      addTable('neighbour', 60, 60, 5);

      expect(find(insideOf('neighbour'), { current: 'orders', keep })).toBe(
        'orders'
      );
      expect(find(insideOf('neighbour'), { current: 'orders' })).toBe(
        'neighbour'
      );
    });

    it('reads again once the table they stood beside is gone', () => {
      addTable('orders', 400, 40);
      addTable('neighbour', 60, 60, 5);
      app.store.dispatchSync(removeTableAction({ id: 'orders' }));

      expect(find(insideOf('neighbour'), { current: 'orders', keep })).toBe(
        'neighbour'
      );
    });
  });

  describe('after the document changes under a still pointer', () => {
    it('names none once the table is removed', () => {
      addTable('orders', 400, 40);
      const pointer = insideOf('orders');
      app.store.dispatchSync(removeTableAction({ id: 'orders' }));

      expect(find(pointer, { current: 'orders' })).toBeNull();
    });

    it('names none once the table moves from under it', () => {
      addTable('orders', 400, 40);
      const pointer = insideOf('orders');
      app.store.dispatchSync(
        moveToTableAction({ id: 'orders', x: 900, y: 500 })
      );

      expect(find(pointer, { current: 'orders' })).toBeNull();
    });

    it('names a table that moves in under it', () => {
      addTable('orders', 400, 40);
      addTable('users', 900, 500);
      const pointer = insideOf('orders');
      app.store.dispatchSync(
        moveToTableAction({ id: 'orders', x: 900, y: 300 }),
        moveToTableAction({ id: 'users', x: 400, y: 40 })
      );

      expect(find(pointer, { current: 'orders' })).toBe('users');
    });
  });
});

describe('containsPoint', () => {
  it('counts a point on an edge as inside', () => {
    const rect = { x: 10, y: 10, width: 20, height: 20 };

    expect(containsPoint(rect, { x: 10, y: 30 })).toBe(true);
    expect(containsPoint(rect, { x: 31, y: 20 })).toBe(false);
  });
});
