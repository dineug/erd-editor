import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Memo, Point, Relationship } from '@/internal-types';
import {
  createCullingRect,
  type CullingRect,
  getCullingRect,
  getSceneOrigin,
  intersects,
  isMemoVisible,
  isRelationshipVisible,
  isTableVisible,
  type SceneTransform,
} from '@/konva/scene/viewport';
import { createMemo } from '@/utils/collection/memo.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { getAbsolutePoint } from '@/utils/dragSelect';
import {
  type BBox,
  getRoute,
  getRouteBBox,
  MAX_STUB,
  nextSortEpoch,
  ROUTE_BBOX_REACH,
} from '@/utils/draw-relationship';
import { relationshipSort } from '@/utils/draw-relationship/sort';

// A table with no columns and every show flag disabled is 118 x 56, which is
// the same measurement sort.test.ts pins.
const TABLE_WIDTH = 118;
const TABLE_HEIGHT = 56;

const PAD = ROUTE_BBOX_REACH + RELATIONSHIP_STROKE_WIDTH;

function createState(): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;
  return state;
}

function addTable(state: RootState, id: string, x: number, y: number) {
  const table = createTable({ id, ui: { x, y } });
  state.collections.tableEntities[id] = table;
  state.doc.tableIds.push(id);
  return table;
}

function addMemo(state: RootState, id: string, x: number, y: number): Memo {
  const memo = createMemo({ id, ui: { x, y } });
  state.collections.memoEntities[id] = memo;
  state.doc.memoIds.push(id);
  return memo;
}

function addRelationship(
  state: RootState,
  id: string,
  startTableId: string,
  endTableId: string
): Relationship {
  const relationship = createRelationship({
    id,
    start: { tableId: startTableId },
    end: { tableId: endTableId },
  });
  state.collections.relationshipEntities[id] = relationship;
  state.doc.relationshipIds.push(id);
  return relationship;
}

/** The box expression the implementation is meant to use, written out longhand. */
function boxOf(points: Point[], padding: number): BBox {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return {
    x: x - padding,
    y: y - padding,
    width: Math.max(...xs) - x + padding * 2,
    height: Math.max(...ys) - y + padding * 2,
  };
}

const contains = (box: BBox, { x, y }: Point) =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

const rectAt = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
});

/**
 * The transform CanvasScene hands Konva, written out longhand and inverted.
 * CanvasScene.browser.test.tsx pins the same numbers against a live layer, so
 * this is the layer the rect has to agree with, not a restatement of the rect.
 */
function screenToScene(
  screen: Point,
  { width, height, scrollLeft, scrollTop, zoomLevel }: SceneTransform
): Point {
  const originX = scrollLeft + (width * (1 - zoomLevel)) / 2;
  const originY = scrollTop + (height * (1 - zoomLevel)) / 2;

  return {
    x: (screen.x - originX) / zoomLevel,
    y: (screen.y - originY) / zoomLevel,
  };
}

type ScreenCase = SceneTransform & {
  viewportWidth: number;
  viewportHeight: number;
};

const screenCorners = (options: ScreenCase): Point[] =>
  [
    { x: 0, y: 0 },
    { x: options.viewportWidth, y: 0 },
    { x: 0, y: options.viewportHeight },
    { x: options.viewportWidth, y: options.viewportHeight },
  ].map(corner => screenToScene(corner, options));

/**
 * Where the old rect went wrong: the canvas box is not the screen, so a zoom
 * that shrinks a large canvas moves the scene origin by more than the margin,
 * and the top left of the screen falls out of a rect that never read the box.
 */
const DEFECT_CASES: Array<[string, ScreenCase]> = [
  [
    'canvas 8000 at zoom 0.5, the case a screen-centred table vanished in',
    {
      width: 8000,
      height: 8000,
      scrollLeft: 0,
      scrollTop: 0,
      zoomLevel: 0.5,
      viewportWidth: 1000,
      viewportHeight: 1000,
    },
  ],
  [
    'canvas 8000 at zoom 0.3, where the whole screen fell out of the rect',
    {
      width: 8000,
      height: 8000,
      scrollLeft: -3280,
      scrollTop: -1782.5,
      zoomLevel: 0.3,
      viewportWidth: 1440,
      viewportHeight: 870,
    },
  ],
  [
    'canvas 4000 at zoom 0.5 on a wide viewport, one axis over and one under',
    {
      width: 4000,
      height: 4000,
      scrollLeft: -400,
      scrollTop: -900,
      zoomLevel: 0.5,
      viewportWidth: 1440,
      viewportHeight: 870,
    },
  ],
  [
    'the default canvas at the lowest zoom, which a pan alone reaches',
    {
      width: 2000,
      height: 2000,
      scrollLeft: -504,
      scrollTop: -917,
      zoomLevel: 0.1,
      viewportWidth: 1440,
      viewportHeight: 690,
    },
  ],
  [
    'canvas 20000 at zoom 0.5, the largest box the toolbar offers',
    {
      width: 20000,
      height: 20000,
      scrollLeft: 0,
      scrollTop: 0,
      zoomLevel: 0.5,
      viewportWidth: 1000,
      viewportHeight: 1000,
    },
  ],
];

describe('the culling rect covers the screen it is inverted out of', () => {
  it.each(DEFECT_CASES)(
    'keeps all four screen corners: %s',
    (_name, options) => {
      const rect = createCullingRect(options);

      for (const corner of screenCorners(options)) {
        expect(contains(rect, corner)).toBe(true);
      }
    }
  );

  it('keeps a table sitting dead centre of a shrunk 8000 canvas', () => {
    const options = DEFECT_CASES[0][1];
    const state = createState();
    state.settings.width = options.width;
    state.settings.height = options.height;
    state.settings.zoomLevel = options.zoomLevel;
    state.editor.viewport = {
      width: options.viewportWidth,
      height: options.viewportHeight,
    };
    const centre = screenToScene({ x: 500, y: 500 }, options);
    const table = addTable(
      state,
      'centre',
      centre.x - TABLE_WIDTH / 2,
      centre.y - TABLE_HEIGHT / 2
    );

    expect(isTableVisible(getCullingRect(state), state, table)).toBe(true);
  });

  it('inverts the very origin the scene layer is placed at', () => {
    const options = DEFECT_CASES[1][1];
    const rect = createCullingRect(options);
    const origin = getSceneOrigin(options);
    const screenWidth = options.viewportWidth / options.zoomLevel;
    const screenHeight = options.viewportHeight / options.zoomLevel;

    expect(origin).toEqual({
      x: options.scrollLeft + (options.width * (1 - options.zoomLevel)) / 2,
      y: options.scrollTop + (options.height * (1 - options.zoomLevel)) / 2,
    });
    expect(rect.x + screenWidth).toBeCloseTo(-origin.x / options.zoomLevel);
    expect(rect.y + screenHeight).toBeCloseTo(-origin.y / options.zoomLevel);
  });

  it('lands on the point the editor already inverts a screen point with', () => {
    const options = DEFECT_CASES[1][1];
    const rect = createCullingRect(options);
    const topLeft = getAbsolutePoint(
      { x: -options.scrollLeft, y: -options.scrollTop },
      options.width,
      options.height,
      options.zoomLevel
    );

    expect(rect.x + options.viewportWidth / options.zoomLevel).toBeCloseTo(
      topLeft.x
    );
    expect(rect.y + options.viewportHeight / options.zoomLevel).toBeCloseTo(
      topLeft.y
    );
  });

  it('reads the canvas box, not only the scroll, zoom and viewport', () => {
    const state = createState();
    state.settings.width = 8000;
    state.settings.height = 8000;
    state.settings.zoomLevel = 0.5;
    state.editor.viewport = { width: 1000, height: 1000 };
    const wide = getCullingRect(state);

    state.settings.width = 2000;
    state.settings.height = 2000;

    expect(getCullingRect(state)).not.toEqual(wide);
    expect(getCullingRect(state)).toEqual(
      createCullingRect({
        width: 2000,
        height: 2000,
        scrollLeft: 0,
        scrollTop: 0,
        zoomLevel: 0.5,
        viewportWidth: 1000,
        viewportHeight: 1000,
      })
    );
  });
});

describe('the culling rect is three screens on a side (AC-G4)', () => {
  const base: ScreenCase = {
    width: 2000,
    height: 2000,
    scrollLeft: -300,
    scrollTop: -200,
    zoomLevel: 1,
    viewportWidth: 800,
    viewportHeight: 600,
  };

  it.each([1, 0.5, 2])('measures 3W/zoom by 3H/zoom at zoom %s', zoomLevel => {
    const rect = createCullingRect({ ...base, zoomLevel });

    expect(rect.width).toBe((800 / zoomLevel) * 3);
    expect(rect.height).toBe((600 / zoomLevel) * 3);
  });

  it.each([1, 0.5, 2])(
    'centres on the middle of the screen at zoom %s',
    zoomLevel => {
      const options = { ...base, zoomLevel };
      const rect = createCullingRect(options);
      const centre = screenToScene({ x: 400, y: 300 }, options);

      expect(rect.x + rect.width / 2).toBeCloseTo(centre.x);
      expect(rect.y + rect.height / 2).toBeCloseTo(centre.y);
    }
  );

  it('still drops what a whole screen of margin does not reach', () => {
    const options = DEFECT_CASES[0][1];
    const state = createState();
    state.settings.width = options.width;
    state.settings.height = options.height;
    state.settings.zoomLevel = options.zoomLevel;
    state.editor.viewport = {
      width: options.viewportWidth,
      height: options.viewportHeight,
    };
    const corner = screenToScene({ x: 0, y: 0 }, options);
    const near = addTable(state, 'near', corner.x - 1500, corner.y);
    const far = addTable(state, 'far', corner.x - 2500, corner.y);
    const rect = getCullingRect(state);

    expect(isTableVisible(rect, state, near)).toBe(true);
    expect(isTableVisible(rect, state, far)).toBe(false);
  });
});

/**
 * The scroll offsets the reducer allows, longhand. Zooming past 1 flips the
 * sign of the box offset, so the far end of the range moves the opposite way
 * from the one the shrinking half of the zoom range walks.
 */
function reachableScrolls(size: number, zoomLevel: number, viewport: number) {
  const drawn = size * zoomLevel;
  const offset = (size - drawn) / 2;
  const max = -offset;
  const min = viewport - drawn - offset;

  return min > max ? [max] : [min, (min + max) / 2, max];
}

const MAGNIFIED_GRID: Array<[number, number]> = [];
for (const size of [2_000, 8_000, 20_000]) {
  for (const zoomLevel of [1, 1.2, 1.5]) {
    MAGNIFIED_GRID.push([size, zoomLevel]);
  }
}

describe('nothing on screen goes undrawn while the zoom magnifies', () => {
  const VIEWPORT_WIDTH = 1440;
  const VIEWPORT_HEIGHT = 900;

  it.each(MAGNIFIED_GRID)(
    'covers every reachable scroll of a %s canvas at zoom %s',
    (width, zoomLevel) => {
      const missed: string[] = [];

      for (const scrollLeft of reachableScrolls(
        width,
        zoomLevel,
        VIEWPORT_WIDTH
      )) {
        for (const scrollTop of reachableScrolls(
          width,
          zoomLevel,
          VIEWPORT_HEIGHT
        )) {
          const options: ScreenCase = {
            width,
            height: width,
            scrollLeft,
            scrollTop,
            zoomLevel,
            viewportWidth: VIEWPORT_WIDTH,
            viewportHeight: VIEWPORT_HEIGHT,
          };
          const rect = createCullingRect(options);

          for (const corner of screenCorners(options)) {
            if (!contains(rect, corner)) {
              missed.push(
                `${scrollLeft},${scrollTop} @ ${corner.x},${corner.y}`
              );
            }
          }
        }
      }

      expect(missed).toEqual([]);
    }
  );

  it.each(MAGNIFIED_GRID)(
    'keeps a table under the screen centre of a %s canvas at zoom %s',
    (width, zoomLevel) => {
      const state = createState();
      state.settings.width = width;
      state.settings.height = width;
      state.settings.zoomLevel = zoomLevel;
      state.editor.viewport = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
      };
      const undrawn: string[] = [];

      for (const scrollLeft of reachableScrolls(
        width,
        zoomLevel,
        VIEWPORT_WIDTH
      )) {
        for (const scrollTop of reachableScrolls(
          width,
          zoomLevel,
          VIEWPORT_HEIGHT
        )) {
          state.settings.scrollLeft = scrollLeft;
          state.settings.scrollTop = scrollTop;
          const centre = screenToScene(
            { x: VIEWPORT_WIDTH / 2, y: VIEWPORT_HEIGHT / 2 },
            state.settings
          );
          const table = addTable(
            state,
            `${scrollLeft}:${scrollTop}`,
            centre.x - TABLE_WIDTH / 2,
            centre.y - TABLE_HEIGHT / 2
          );

          if (!isTableVisible(getCullingRect(state), state, table)) {
            undrawn.push(`${scrollLeft},${scrollTop}`);
          }
        }
      }

      expect(undrawn).toEqual([]);
    }
  );

  /**
   * The far corner is the one a magnifying zoom loses: the box offset turns
   * negative, so a rect that read the scroll alone would slide off the wrong
   * end of the screen from the one the shrinking half slides off.
   */
  it('keeps the bottom right corner of a magnified 20000 canvas', () => {
    const options: ScreenCase = {
      width: 20_000,
      height: 20_000,
      scrollLeft: VIEWPORT_WIDTH - 30_000 + 5_000,
      scrollTop: VIEWPORT_HEIGHT - 30_000 + 5_000,
      zoomLevel: 1.5,
      viewportWidth: VIEWPORT_WIDTH,
      viewportHeight: VIEWPORT_HEIGHT,
    };
    const rect = createCullingRect(options);
    const corner = screenToScene(
      { x: VIEWPORT_WIDTH, y: VIEWPORT_HEIGHT },
      options
    );

    expect(corner.x).toBeCloseTo(20_000, 6);
    expect(corner.y).toBeCloseTo(20_000, 6);
    expect(contains(rect, corner)).toBe(true);
  });

  it('reads the canvas box at a magnifying zoom, not the scroll alone', () => {
    const base: ScreenCase = {
      width: 2_000,
      height: 2_000,
      scrollLeft: 0,
      scrollTop: 0,
      zoomLevel: 1.5,
      viewportWidth: VIEWPORT_WIDTH,
      viewportHeight: VIEWPORT_HEIGHT,
    };

    expect(getSceneOrigin(base)).toEqual({ x: -500, y: -500 });
    expect(createCullingRect(base)).not.toEqual(
      createCullingRect({ ...base, width: 8_000, height: 8_000 })
    );
  });
});

describe('a frame the host has not measured yet', () => {
  const canvas = {
    width: 2000,
    height: 2000,
    scrollLeft: 0,
    scrollTop: 0,
    zoomLevel: 0.5,
  };

  it.each([
    ['no viewport at all', 0, 0],
    ['a viewport the toolbar height drove negative', -30, -30],
  ])('falls back to the canvas box for %s', (_name, width, height) => {
    const rect = createCullingRect({
      ...canvas,
      viewportWidth: width,
      viewportHeight: height,
    });

    expect(Number.isFinite(rect.x)).toBe(true);
    expect(Number.isFinite(rect.width)).toBe(true);
    expect(contains(rect, { x: 0, y: 0 })).toBe(true);
    expect(contains(rect, { x: canvas.width, y: canvas.height })).toBe(true);
  });

  it('reads a zoom of zero as one rather than inverting by it', () => {
    const options = { ...canvas, zoomLevel: 0 };
    const rect = createCullingRect({
      ...options,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(Number.isFinite(rect.x)).toBe(true);
    expect(rect.width).toBe(2400);
    expect(rect.height).toBe(1800);
    for (const corner of screenCorners({
      ...options,
      zoomLevel: 1,
      viewportWidth: 800,
      viewportHeight: 600,
    })) {
      expect(contains(rect, corner)).toBe(true);
    }
  });
});

describe('a table or a memo is kept for the box it occupies', () => {
  let state: RootState;

  beforeEach(() => {
    state = createState();
  });

  it('keeps a table the rect overlaps and drops one it does not', () => {
    const table = addTable(state, 'A', 0, 0);

    expect(isTableVisible(rectAt(-10, -10, 40, 40), state, table)).toBe(true);
    expect(isTableVisible(rectAt(500, 0, 100, 100), state, table)).toBe(false);
  });

  it('keeps a table touching the rect along an edge', () => {
    const table = addTable(state, 'A', 0, 0);

    expect(isTableVisible(rectAt(TABLE_WIDTH, 0, 10, 10), state, table)).toBe(
      true
    );
    expect(
      isTableVisible(rectAt(TABLE_WIDTH + 1, 0, 10, 10), state, table)
    ).toBe(false);
  });

  it('measures a memo with its border, padding and header', () => {
    const memo = addMemo(state, 'M', 400, 400);

    expect(isMemoVisible(rectAt(390, 390, 20, 20), memo)).toBe(true);
    expect(isMemoVisible(rectAt(0, 0, 100, 100), memo)).toBe(false);
  });
});

describe('a relationship is kept for its whole reach (AC-G14)', () => {
  let state: RootState;
  let relationship: Relationship;

  beforeEach(() => {
    state = createState();
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 2000, 0);
    relationship = addRelationship(state, 'r', 'A', 'B');
    relationshipSort(state);
  });

  it('routed the connector it is about to cull', () => {
    expect(relationship.start).toMatchObject({
      x: TABLE_WIDTH,
      y: TABLE_HEIGHT / 2,
    });
    expect(relationship.end).toMatchObject({ x: 2000, y: TABLE_HEIGHT / 2 });
    expect(getRoute(relationship)?.length).toBeGreaterThan(1);
  });

  it('keeps one lying wholly inside the rect', () => {
    const rect: CullingRect = rectAt(-500, -500, 4000, 2000);
    const box = getRouteBBox(relationship);

    expect(contains(rect, { x: box.x, y: box.y })).toBe(true);
    expect(
      contains(rect, { x: box.x + box.width, y: box.y + box.height })
    ).toBe(true);
    expect(isRelationshipVisible(rect, relationship)).toBe(true);
  });

  it('drops one lying wholly outside the rect', () => {
    expect(
      isRelationshipVisible(rectAt(0, 5000, 1000, 1000), relationship)
    ).toBe(false);
  });

  it('keeps one straddling the rect boundary', () => {
    const rect: CullingRect = rectAt(1000, -100, 2000, 400);
    const box = getRouteBBox(relationship);

    expect(contains(rect, { x: box.x, y: box.y })).toBe(false);
    expect(isRelationshipVisible(rect, relationship)).toBe(true);
  });

  it('keeps one whose tables are both culled while its path crosses the screen', () => {
    const rect: CullingRect = rectAt(900, -50, 200, 100);
    const tables = Object.values(state.collections.tableEntities);

    expect(tables.map(table => isTableVisible(rect, state, table))).toEqual([
      false,
      false,
    ]);
    expect(isRelationshipVisible(rect, relationship)).toBe(true);
  });

  it('keeps one whose routed points are all off screen while its anchor is on it', () => {
    const rect: CullingRect = rectAt(60, 0, 70, 60);
    const route = getRoute(relationship) ?? [];

    expect(intersects(rect, boxOf(route, PAD))).toBe(false);
    expect(isRelationshipVisible(rect, relationship)).toBe(true);
  });

  it('follows the route a table move re-sorts it onto', () => {
    const before = getRouteBBox(relationship);

    state.collections.tableEntities.B.ui.y = 1200;
    relationshipSort(state);
    const after = getRouteBBox(relationship);
    const route = getRoute(relationship) ?? [];

    expect(after).not.toEqual(before);
    expect(after).toEqual(
      boxOf([...route, relationship.start, relationship.end], PAD)
    );
    expect(contains(before, relationship.end)).toBe(false);
    expect(contains(after, relationship.end)).toBe(true);
    expect(
      isRelationshipVisible(rectAt(1900, 1150, 200, 200), relationship)
    ).toBe(true);
  });

  /**
   * The one call a sort makes that no route of its own answers for. A connector
   * the sort filtered out keeps the routes of the sort before it, so only the
   * epoch the sort opens with can retire a box that now describes nothing.
   */
  it('retires the box of a connector the next sort no longer routes', () => {
    const routed = getRouteBBox(relationship);
    const stale = (getRoute(relationship) ?? []).map(({ x, y }) => ({ x, y }));
    const strip = rectAt(routed.x + 10, routed.y + routed.height + 10, 40, 40);

    expect(isRelationshipVisible(strip, relationship)).toBe(false);

    state.doc.tableIds = state.doc.tableIds.filter(id => id !== 'B');
    state.collections.tableEntities.A.ui.y = 900;
    relationshipSort(state);

    expect(relationship.start.y).toBe(TABLE_HEIGHT / 2);
    expect(getRoute(relationship)).toEqual(stale);
    expect(getRouteBBox(relationship)).toEqual(
      boxOf([relationship.start, relationship.end], PAD + MAX_STUB)
    );
    expect(isRelationshipVisible(strip, relationship)).toBe(true);
  });

  it('falls back to the anchors and the longest stub for a self relationship', () => {
    const self = addRelationship(state, 'self', 'A', 'A');
    relationshipSort(state);

    expect(getRoute(self)).toBeUndefined();
    expect(getRouteBBox(self)).toEqual(
      boxOf([self.start, self.end], PAD + MAX_STUB)
    );
  });

  it('writes one expression for both branches, differing by MAX_STUB alone', () => {
    const route = getRoute(relationship) ?? [];
    const hit = getRouteBBox(relationship);

    expect(hit).toEqual(
      boxOf([...route, relationship.start, relationship.end], PAD)
    );

    nextSortEpoch();

    expect(getRouteBBox(relationship)).toEqual(
      boxOf([relationship.start, relationship.end], PAD + MAX_STUB)
    );
  });

  it('pads a wider stroke by the extra width on every side', () => {
    const thin = getRouteBBox(relationship);
    const thick = getRouteBBox(relationship, 12);
    const extra = 12 - RELATIONSHIP_STROKE_WIDTH;

    expect(thick.x).toBe(thin.x - extra);
    expect(thick.width).toBe(thin.width + extra * 2);
  });
});
