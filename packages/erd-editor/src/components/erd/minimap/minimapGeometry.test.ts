import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  fromMinimapPoint,
  getMinimapHandleRect,
  getMinimapLayout,
  getMinimapMarkRect,
  getMinimapViewportRect,
  getScrollToCenter,
  getViewTransform,
  getVisibleCanvasRect,
  MINIMAP_BOX_MIN_SIDE,
  MINIMAP_MAP_MARGIN,
  MINIMAP_MAP_STEP,
  MINIMAP_MARK_MIN,
  type MinimapLayout,
  toMinimapPoint,
  toScrollDistance,
  toScrollMovement,
  type ViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import { MINIMAP_SIZE } from '@/constants/layout';
import { createEditor } from '@/engine/modules/editor/state';
import {
  getContentScrollRanges,
  getScrollRanges,
} from '@/engine/modules/settings/atom.actions';
import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { getContentRect, unionRect } from '@/konva/scene/contentBounds';
import { type Rect } from '@/konva/scene/metrics';
import { freezeView, thawView } from '@/konva/scene/viewFreeze';
import { toScenePoint, toScreenPoint } from '@/konva/scene/viewport';
import { createMemo } from '@/utils/collection/memo.entity';
import { createTable } from '@/utils/collection/table.entity';

const view = (overrides: Partial<ViewTransform> = {}): ViewTransform => ({
  originX: 0,
  originY: 0,
  zoomLevel: 1,
  viewportWidth: 1200,
  viewportHeight: 675,
  ...overrides,
});

type Seed = {
  tables?: Point[];
  memos?: Point[];
  view?: Partial<ViewTransform>;
};

/** A document holding a table or memo at each point, seen through the view given. */
function stateOf({ tables = [], memos = [], view: overrides }: Seed = {}) {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  const { originX, originY, zoomLevel, viewportWidth, viewportHeight } =
    view(overrides);

  Object.assign(state.settings, { originX, originY, zoomLevel });
  state.editor.viewport = { width: viewportWidth, height: viewportHeight };

  tables.forEach((ui, index) => {
    const id = `t${index}`;
    state.collections.tableEntities[id] = createTable({ id, ui });
    state.doc.tableIds.push(id);
  });
  memos.forEach((ui, index) => {
    const id = `m${index}`;
    state.collections.memoEntities[id] = createMemo({ id, ui });
    state.doc.memoIds.push(id);
  });

  return state;
}

const ZOOMS = [1, 0.7, 0.5, 0.2, 0.1, 1.5];

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** The screen as the view given would show it, standing at another origin. */
const visibleFrom = (view: ViewTransform, originX: number, originY: number) =>
  getVisibleCanvasRect({ ...view, originX, originY });

/** The screens at the two ends of the travel, which is where a gesture can take the view. */
const endsOf = (state: RootState): [Rect, Rect] => {
  const view = getViewTransform(state);
  const { left, top } = getScrollRanges(state);

  return [
    visibleFrom(view, left.max, top.max),
    visibleFrom(view, left.min, top.min),
  ];
};

/**
 * What the map has to hold: the content and every screen the travel reaches,
 * from the one at the near end to the one at the far end.
 */
const travelHull = (state: RootState): Rect => {
  const [near, far] = endsOf(state);
  const reach = unionRect(near, far);
  const content = getContentRect(state);

  return content ? unionRect(content, reach) : reach;
};

/**
 * The map lies on the grid, holds the rect with the margin around it, and is
 * the smallest such rect: pulling any edge one step in would cut the margin.
 */
function expectSnappedAround(map: Rect, hull: Rect) {
  for (const edge of [map.x, map.y, map.x + map.width, map.y + map.height]) {
    expect(Math.abs(edge % MINIMAP_MAP_STEP)).toBe(0);
  }

  expect(map.x).toBeLessThanOrEqual(hull.x - MINIMAP_MAP_MARGIN);
  expect(map.x + MINIMAP_MAP_STEP).toBeGreaterThan(hull.x - MINIMAP_MAP_MARGIN);
  expect(map.y).toBeLessThanOrEqual(hull.y - MINIMAP_MAP_MARGIN);
  expect(map.y + MINIMAP_MAP_STEP).toBeGreaterThan(hull.y - MINIMAP_MAP_MARGIN);

  const right = hull.x + hull.width + MINIMAP_MAP_MARGIN;
  const bottom = hull.y + hull.height + MINIMAP_MAP_MARGIN;
  expect(map.x + map.width).toBeGreaterThanOrEqual(right);
  expect(map.x + map.width - MINIMAP_MAP_STEP).toBeLessThan(right);
  expect(map.y + map.height).toBeGreaterThanOrEqual(bottom);
  expect(map.y + map.height - MINIMAP_MAP_STEP).toBeLessThan(bottom);
}

describe('getVisibleCanvasRect', () => {
  it('is the negated origin and the editor viewport when the canvas is unzoomed', () => {
    expect(getVisibleCanvasRect(view())).toEqual({
      x: 0,
      y: 0,
      width: 1200,
      height: 675,
    });

    expect(
      getVisibleCanvasRect(view({ originX: -400, originY: -200 }))
    ).toEqual({ x: 400, y: 200, width: 1200, height: 675 });
  });

  it('covers more canvas per screen pixel as the canvas zooms out', () => {
    // The screen is 1200 wide over a canvas drawn at half size, so it reaches
    // 2400 canvas units from the origin, which the zoom leaves where it is.
    expect(getVisibleCanvasRect(view({ zoomLevel: 0.5 }))).toEqual({
      x: 0,
      y: 0,
      width: 2400,
      height: 1350,
    });
  });

  it('covers less canvas per screen pixel as the canvas zooms in', () => {
    expect(getVisibleCanvasRect(view({ zoomLevel: 2 }))).toEqual({
      x: 0,
      y: 0,
      width: 600,
      height: 337.5,
    });
  });

  it('answers a plain zero where negating the origin would sign one', () => {
    // The store compares with Object.is, so a negative zero here reads as a
    // scroll change on every frame that has not moved.
    const rect = getVisibleCanvasRect(view());

    expect(Object.is(rect.x, 0)).toBe(true);
    expect(Object.is(rect.y, 0)).toBe(true);
  });

  it('falls back to an unzoomed read rather than inverting a zero zoom', () => {
    expect(getVisibleCanvasRect(view({ zoomLevel: 0 }))).toEqual(
      getVisibleCanvasRect(view({ zoomLevel: 1 }))
    );
  });

  it('is the screen corners read back through the canon', () => {
    for (const zoomLevel of ZOOMS) {
      const transform = view({ zoomLevel, originX: -321, originY: 654 });
      const rect = getVisibleCanvasRect(transform);
      const topLeft = toScenePoint(transform, { x: 0, y: 0 });
      const bottomRight = toScenePoint(transform, {
        x: transform.viewportWidth,
        y: transform.viewportHeight,
      });

      expect(rect.x).toBeCloseTo(topLeft.x, 6);
      expect(rect.y).toBeCloseTo(topLeft.y, 6);
      expect(rect.x + rect.width).toBeCloseTo(bottomRight.x, 6);
      expect(rect.y + rect.height).toBeCloseTo(bottomRight.y, 6);
    }
  });
});

describe('getViewTransform', () => {
  it('reads the origin, the zoom and the measured screen off the store', () => {
    const state = stateOf({
      view: {
        originX: -12,
        originY: 34,
        zoomLevel: 0.7,
        viewportWidth: 800,
        viewportHeight: 600,
      },
    });

    expect(getViewTransform(state)).toEqual({
      originX: -12,
      originY: 34,
      zoomLevel: 0.7,
      viewportWidth: 800,
      viewportHeight: 600,
    });
  });
});

describe('getMinimapLayout', () => {
  it('maps the screen alone for an empty document, with the margin, on the grid', () => {
    const state = stateOf();
    const { map } = getMinimapLayout(state);

    expectSnappedAround(map, getVisibleCanvasRect(getViewTransform(state)));
  });

  /**
   * The map is the travel: the content, and the screen wherever a gesture can
   * take it, from the end that puts the content's near edge on the screen's far
   * edge to the end that puts its far edge on the near one.
   */
  it('holds the content and the screen at both ends of the travel', () => {
    const state = stateOf({
      tables: [
        { x: -1300, y: 200 },
        { x: 5000, y: 3000 },
      ],
      memos: [{ x: 900, y: -2200 }],
    });
    const { map } = getMinimapLayout(state);
    const content = getContentRect(state)!;
    const [near, far] = endsOf(state);

    expect(contains(map, content)).toBe(true);
    expect(contains(map, getVisibleCanvasRect(getViewTransform(state)))).toBe(
      true
    );
    expect(contains(map, near)).toBe(true);
    expect(contains(map, far)).toBe(true);
    // The two ends straddle the content by a screen each way, so the map
    // reaches past it on every side rather than stopping at its edge.
    expect(near.x).toBeLessThan(content.x);
    expect(far.x + far.width).toBeGreaterThan(content.x + content.width);
    expectSnappedAround(map, travelHull(state));
  });

  /**
   * A gesture is clamped into the pure range while the origin stands inside it,
   * and the map holds every screen that range reaches, so panning the canvas
   * neither rescales the thumbnail nor moves a mark on it: only the handle moves.
   */
  it('stands still while the origin moves anywhere inside the travel', () => {
    for (const zoomLevel of ZOOMS) {
      const state = stateOf({
        tables: [
          { x: -700, y: 300 },
          { x: 2600, y: 1900 },
        ],
        view: { zoomLevel },
      });
      const { left, top } = getContentScrollRanges(state);
      const before = getMinimapLayout(state);

      for (const share of [0, 0.25, 0.5, 0.8, 1]) {
        state.settings.originX = left.min + (left.max - left.min) * share;
        state.settings.originY = top.min + (top.max - top.min) * share;

        expect(getScrollRanges(state)).toEqual({ left, top });
        expect(getMinimapLayout(state)).toEqual(before);
      }
    }
  });

  it('grows to hold the screen where an absolute request parked it outside the travel', () => {
    const state = stateOf({ tables: [{ x: 0, y: 0 }] });
    const inside = getMinimapLayout(state);
    const { left, top } = getContentScrollRanges(state);

    state.settings.originX = left.max + 6_000;
    state.settings.originY = top.min - 4_000;
    const outside = getMinimapLayout(state);
    const visible = getVisibleCanvasRect(getViewTransform(state));

    expect(contains(inside.map, visible)).toBe(false);
    expect(contains(outside.map, visible)).toBe(true);
    expect(contains(outside.map, getContentRect(state)!)).toBe(true);
    expectSnappedAround(outside.map, travelHull(state));
  });

  it('folds the longer side into the minimap size and centres the shorter one', () => {
    const wide = getMinimapLayout(stateOf({ tables: [{ x: 6000, y: 0 }] }));
    const tall = getMinimapLayout(stateOf({ tables: [{ x: 0, y: 6000 }] }));

    for (const { map, ratio, box, offset } of [wide, tall]) {
      expect(ratio).toBeCloseTo(
        MINIMAP_SIZE / Math.max(map.width, map.height),
        12
      );
      expect(Math.max(box.width, box.height)).toBeCloseTo(MINIMAP_SIZE, 9);
      expect(offset.x * 2 + box.width).toBeCloseTo(MINIMAP_SIZE, 9);
      expect(offset.y * 2 + box.height).toBeCloseTo(MINIMAP_SIZE, 9);
    }

    expect(wide.box.width).toBeGreaterThan(wide.box.height);
    expect(wide.offset.x).toBe(0);
    expect(wide.offset.y).toBeGreaterThan(0);
    expect(tall.box.height).toBeGreaterThan(tall.box.width);
    expect(tall.offset.y).toBe(0);
    expect(tall.offset.x).toBeGreaterThan(0);
  });

  it('leaves the map standing while a table moves inside its grid cell', () => {
    const state = stateOf({
      tables: [{ x: 1000, y: 1000 }],
      view: { originX: -600, originY: -500 },
    });
    const before = getMinimapLayout(state);
    const hull = travelHull(state);
    // The room a move to the right has before an edge of what the map holds
    // crosses a grid line: the near edge up to the next line, the far edge up
    // to the map's own. Inside both nothing changes; past the nearer, one line moves.
    const room = Math.min(
      before.map.x + MINIMAP_MAP_STEP - (hull.x - MINIMAP_MAP_MARGIN),
      before.map.x +
        before.map.width -
        (hull.x + hull.width + MINIMAP_MAP_MARGIN)
    );

    expect(room).toBeGreaterThan(1);

    state.collections.tableEntities.t0.ui.x += room - 1;
    expect(getMinimapLayout(state)).toEqual(before);

    state.collections.tableEntities.t0.ui.x += 2;
    const after = getMinimapLayout(state);
    expect(after.map).not.toEqual(before.map);
    // Whichever edge crossed took exactly one line; the others stayed.
    const edges = (rect: Rect) => [rect.x, rect.x + rect.width];
    const moved = edges(after.map).map(
      (edge, index) => edge - edges(before.map)[index]
    );
    expect(moved.every(step => step === 0 || step === MINIMAP_MAP_STEP)).toBe(
      true
    );
    expect(moved.some(step => step === MINIMAP_MAP_STEP)).toBe(true);
  });

  it('grows the map with the screen as the canvas zooms out', () => {
    // Zooms in the order the screen widens: each map holds at least the one
    // before it, and the one at 1.5 holds no more than the one at 1.
    const zooms = [...ZOOMS].sort((a, b) => b - a);
    const widths = zooms.map(
      zoomLevel => getMinimapLayout(stateOf({ view: { zoomLevel } })).map.width
    );

    for (let index = 1; index < zooms.length; index++) {
      expect(widths[index]).toBeGreaterThanOrEqual(widths[index - 1]);
    }
    expect(widths[widths.length - 1]).toBeGreaterThan(widths[0]);
  });

  it('holds the content the drag began with while the view is held', () => {
    const state = stateOf({ tables: [{ x: 0, y: 0 }] });
    const before = getMinimapLayout(state);

    freezeView(state);
    state.collections.tableEntities.t0.ui.x = 9000;

    expect(getMinimapLayout(state)).toEqual(before);

    thawView(state);
    const after = getMinimapLayout(state);

    expect(after).not.toEqual(before);
    expect(contains(after.map, getContentRect(state)!)).toBe(true);
  });

  /**
   * The freeze holds the content and the origin a drag began from, never the
   * screen: a wheel or a jump mid drag carries the screen wherever it is asked
   * to, and the map grows to keep it, while the table being dragged waits for the drop.
   */
  it('grows to hold the screen a wheel carried off while the view is held', () => {
    const state = stateOf({ tables: [{ x: 0, y: 0 }] });
    const before = getMinimapLayout(state);
    const frozenContent = getContentRect(state)!;

    freezeView(state);
    state.collections.tableEntities.t0.ui.x = 9000;
    state.settings.originX = -5000;
    const during = getMinimapLayout(state);
    const visible = getVisibleCanvasRect(getViewTransform(state));
    const [near, far] = endsOf(state);

    expect(contains(before.map, visible)).toBe(false);
    expect(during).not.toEqual(before);
    expect(contains(during.map, visible)).toBe(true);
    expect(contains(during.map, frozenContent)).toBe(true);
    expect(contains(during.map, getContentRect(state)!)).toBe(false);
    expectSnappedAround(
      during.map,
      unionRect(frozenContent, unionRect(near, far))
    );

    thawView(state);
    const after = getMinimapLayout(state);

    expect(contains(after.map, getContentRect(state)!)).toBe(true);
    expect(contains(after.map, visible)).toBe(true);
  });

  /**
   * Two tables fifty thousand units apart fold into a map a few pixels tall,
   * a hairline nothing can be read off. The shorter side is widened to the
   * floor about its middle, on the grid, and the longer side still sets the ratio.
   */
  it('widens a map far wider than tall along its short side to the floor', () => {
    const state = stateOf({
      tables: [
        { x: 0, y: 0 },
        { x: 50_000, y: 0 },
      ],
    });
    const content = getContentRect(state)!;
    const visible = getVisibleCanvasRect(getViewTransform(state));
    const hull = travelHull(state);
    const { map, ratio, box, offset } = getMinimapLayout(state);

    // What the hull alone would have drawn: the content and a screen each way
    // plus the margins, at a ratio set by fifty thousand units, is under the floor.
    expect((hull.height + MINIMAP_MAP_MARGIN * 2) * ratio).toBeLessThan(
      MINIMAP_BOX_MIN_SIDE
    );

    expect(box.width).toBeCloseTo(MINIMAP_SIZE, 9);
    expect(box.height).toBeGreaterThanOrEqual(MINIMAP_BOX_MIN_SIDE);
    expect(box.height).toBeLessThan(
      MINIMAP_BOX_MIN_SIDE + MINIMAP_MAP_STEP * ratio
    );
    expect(ratio).toBeCloseTo(MINIMAP_SIZE / map.width, 12);
    expect(offset.y * 2 + box.height).toBeCloseTo(MINIMAP_SIZE, 9);
    expect(contains(map, content)).toBe(true);
    expect(contains(map, visible)).toBe(true);
    for (const edge of [map.x, map.y, map.x + map.width, map.y + map.height]) {
      expect(Math.abs(edge % MINIMAP_MAP_STEP)).toBe(0);
    }
    // Widened about the middle: the room added above the hull is the room
    // added below it, to within the grid the edges are snapped to.
    const above = hull.y - MINIMAP_MAP_MARGIN - map.y;
    const below =
      map.y + map.height - (hull.y + hull.height + MINIMAP_MAP_MARGIN);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(MINIMAP_MAP_STEP);
  });

  it('leaves a map whose shorter side already clears the floor as the hull snapped', () => {
    const state = stateOf({ tables: [{ x: 3_000, y: 0 }] });
    const { map, box } = getMinimapLayout(state);

    expect(box.height).toBeGreaterThan(MINIMAP_BOX_MIN_SIDE);
    expectSnappedAround(map, travelHull(state));
  });

  it('still maps a document nobody has measured a screen for', () => {
    const state = stateOf({ view: { viewportWidth: 0, viewportHeight: 0 } });
    const { map, ratio, box } = getMinimapLayout(state);

    expect(map.width).toBeGreaterThanOrEqual(MINIMAP_MAP_MARGIN * 2);
    expect(map.height).toBeGreaterThanOrEqual(MINIMAP_MAP_MARGIN * 2);
    expect(Number.isFinite(ratio) && ratio > 0).toBe(true);
    expect(Math.max(box.width, box.height)).toBeCloseTo(MINIMAP_SIZE, 9);
  });
});

describe('toMinimapPoint and fromMinimapPoint', () => {
  const layouts = (): MinimapLayout[] => [
    getMinimapLayout(stateOf()),
    getMinimapLayout(stateOf({ tables: [{ x: -4000, y: 2500 }] })),
    getMinimapLayout(
      stateOf({ tables: [{ x: 7000, y: 100 }], view: { zoomLevel: 0.3 } })
    ),
  ];

  it('invert each other', () => {
    for (const layout of layouts()) {
      for (const point of [
        { x: 0, y: 0 },
        { x: 37.5, y: 12.25 },
        { x: layout.box.width, y: layout.box.height },
      ]) {
        const back = toMinimapPoint(layout, fromMinimapPoint(layout, point));

        expect(back.x).toBeCloseTo(point.x, 9);
        expect(back.y).toBeCloseTo(point.y, 9);
      }
    }
  });

  it('put the map corners on the box corners', () => {
    for (const layout of layouts()) {
      const { map, box } = layout;
      const near = toMinimapPoint(layout, map);
      const far = toMinimapPoint(layout, {
        x: map.x + map.width,
        y: map.y + map.height,
      });

      expect(near).toEqual({ x: 0, y: 0 });
      expect(far.x).toBeCloseTo(box.width, 9);
      expect(far.y).toBeCloseTo(box.height, 9);
    }
  });

  it('answers a plain zero for a map corner at scene zero', () => {
    // The travel's near end puts the screen a screen before the table, so from
    // a table at 1500,1000 the hull less its margin lands in the first grid cell
    // and the snap at zero exactly, where a negated zero would read as a move.
    const layout = getMinimapLayout(
      stateOf({
        tables: [{ x: 1500, y: 1000 }],
        view: { originX: -800, originY: -600 },
      })
    );

    expect(layout.map.x).toBe(0);
    expect(layout.map.y).toBe(0);
    expect(Object.is(toMinimapPoint(layout, { x: 0, y: 0 }).x, 0)).toBe(true);
    expect(Object.is(toMinimapPoint(layout, { x: 0, y: 0 }).y, 0)).toBe(true);
  });
});

describe('getMinimapViewportRect', () => {
  it('draws the screen where the map puts it, at the map ratio', () => {
    const state = stateOf({
      tables: [{ x: 3000, y: 2000 }],
      view: { originX: -300, originY: -150, zoomLevel: 0.5 },
    });
    const layout = getMinimapLayout(state);
    const transform = getViewTransform(state);
    const visible = getVisibleCanvasRect(transform);
    const rect = getMinimapViewportRect(layout, transform);

    expect({ x: rect.x, y: rect.y }).toEqual(toMinimapPoint(layout, visible));
    expect(rect.width).toBeCloseTo(visible.width * layout.ratio, 9);
    expect(rect.height).toBeCloseTo(visible.height * layout.ratio, 9);
  });

  it('is scaled by one ratio on both axes', () => {
    for (const zoomLevel of ZOOMS) {
      const state = stateOf({
        tables: [{ x: 2000, y: 0 }],
        view: { zoomLevel },
      });
      const layout = getMinimapLayout(state);
      const transform = getViewTransform(state);
      const visible = getVisibleCanvasRect(transform);
      const rect = getMinimapViewportRect(layout, transform);

      expect(rect.width / visible.width).toBeCloseTo(
        rect.height / visible.height,
        9
      );
    }
  });
});

describe('getMinimapMarkRect', () => {
  const layout = getMinimapLayout(
    stateOf({
      tables: [
        { x: 0, y: 0 },
        { x: 50_000, y: 0 },
      ],
    })
  );

  it('grows a box that would draw under the mark to the mark, about its middle', () => {
    const rect: Rect = { x: 1_000, y: 200, width: 220, height: 90 };
    const mark = getMinimapMarkRect(layout.ratio, rect);

    expect(rect.width * layout.ratio).toBeLessThan(MINIMAP_MARK_MIN);
    expect(mark.width * layout.ratio).toBeCloseTo(MINIMAP_MARK_MIN, 9);
    expect(mark.height * layout.ratio).toBeCloseTo(MINIMAP_MARK_MIN, 9);
    expect(mark.x + mark.width / 2).toBeCloseTo(rect.x + rect.width / 2, 9);
    expect(mark.y + mark.height / 2).toBeCloseTo(rect.y + rect.height / 2, 9);
  });

  it('hands a box that draws past the mark back as it is', () => {
    const wide = getMinimapLayout(stateOf({ tables: [{ x: 0, y: 0 }] }));
    const rect: Rect = { x: 10, y: 20, width: 200, height: 100 };

    expect(rect.height * wide.ratio).toBeGreaterThan(MINIMAP_MARK_MIN);
    expect(getMinimapMarkRect(wide.ratio, rect)).toEqual(rect);
  });

  it('grows only the side under the mark', () => {
    const rect: Rect = { x: 0, y: 0, width: 5_000, height: 90 };
    const mark = getMinimapMarkRect(layout.ratio, rect);

    expect(mark.width).toBe(rect.width);
    expect(mark.x).toBe(rect.x);
    expect(mark.height * layout.ratio).toBeCloseTo(MINIMAP_MARK_MIN, 9);
  });
});

describe('getMinimapHandleRect', () => {
  it('is the untrimmed rectangle whenever the map was laid out for this view', () => {
    for (const zoomLevel of ZOOMS) {
      const state = stateOf({
        tables: [{ x: 1500, y: 900 }],
        view: { zoomLevel, originX: -250, originY: 125 },
      });
      const layout = getMinimapLayout(state);
      const transform = getViewTransform(state);
      const rect = getMinimapHandleRect(layout, transform);

      expect(rect).toEqual(getMinimapViewportRect(layout, transform));
      expect(contains({ x: 0, y: 0, ...layout.box }, rect)).toBe(true);
    }
  });

  it('draws the handle no thinner than a mark on a map folded far', () => {
    const state = stateOf({
      tables: [
        { x: 0, y: 0 },
        { x: 50_000, y: 0 },
      ],
    });
    const layout = getMinimapLayout(state);
    const transform = getViewTransform(state);
    const footprint = getMinimapViewportRect(layout, transform);
    const handle = getMinimapHandleRect(layout, transform);

    expect(footprint.height).toBeLessThan(MINIMAP_MARK_MIN);
    expect(handle.height).toBe(MINIMAP_MARK_MIN);
    expect(handle.width).toBeCloseTo(footprint.width, 9);
    expect(handle.y + handle.height / 2).toBeCloseTo(
      footprint.y + footprint.height / 2,
      9
    );
  });

  /**
   * A map laid out for the view holds its screen whole, so the trim only
   * reaches a rectangle drawn against a map laid out for another view. Here the
   * screen has left that map to the right entirely, and nothing of it is drawn.
   */
  it('trims a rectangle drawn against a map laid out for another view', () => {
    const state = stateOf({ tables: [{ x: 0, y: 0 }] });
    const layout = getMinimapLayout(state);

    state.settings.originX = -(layout.map.x + layout.map.width) - 600;
    const transform = getViewTransform(state);
    const untrimmed = getMinimapViewportRect(layout, transform);
    const rect = getMinimapHandleRect(layout, transform);

    expect(untrimmed.x).toBeGreaterThan(layout.box.width);
    expect(rect.width).toBe(0);
    expect(rect.x).toBe(layout.box.width);
    expect(rect.height).toBeCloseTo(untrimmed.height, 9);
  });

  /**
   * The map is laid out from the hull that holds the origin where it stands,
   * so the screen a wheel or a jump carried off mid drag is on the map the next
   * render reads, and the handle drawn for it is whole where the held map cut it.
   */
  it('is whole on a map laid out mid drag wherever a wheel carried the screen', () => {
    const state = stateOf({ tables: [{ x: 0, y: 0 }] });
    freezeView(state);
    const held = getMinimapLayout(state);

    // Carried a screen and a half past either end of the held map, so the
    // whole screen is off it and a handle drawn against it has no width.
    for (const sign of [1, -1]) {
      state.settings.originX =
        sign * (held.map.width + getViewTransform(state).viewportWidth * 1.5);
      const layout = getMinimapLayout(state);
      const transform = getViewTransform(state);
      const rect = getMinimapHandleRect(layout, transform);

      expect(getMinimapHandleRect(held, transform).width).toBe(0);
      expect(rect).toEqual(getMinimapViewportRect(layout, transform));
      expect(rect.width).toBeGreaterThan(0);
      expect(contains({ x: 0, y: 0, ...layout.box }, rect)).toBe(true);
    }

    thawView(state);
  });

  it('stays inside the box at every zoom and every origin', () => {
    const state = stateOf({ tables: [{ x: 0, y: 0 }] });
    const layout = getMinimapLayout(state);

    for (const zoomLevel of ZOOMS) {
      for (const origin of [0, -400, -800, -2000, 500, 4000]) {
        const rect = getMinimapHandleRect(layout, {
          ...getViewTransform(state),
          zoomLevel,
          originX: origin,
          originY: origin,
        });

        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.width).toBeGreaterThanOrEqual(0);
        expect(rect.height).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(layout.box.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(layout.box.height);
      }
    }
  });
});

describe('toScrollDistance', () => {
  it('turns a canvas distance into the origin travel that covers it', () => {
    expect(toScrollDistance(100, 1)).toBe(-100);
    expect(toScrollDistance(100, 0.5)).toBe(-50);
    expect(toScrollDistance(100, 2)).toBe(-200);
    expect(toScrollDistance(100, 0)).toBe(-100);
  });
});

describe('toScrollMovement', () => {
  it('spends the ratio first and the zoom second', () => {
    const ratio = MINIMAP_SIZE / 2000;

    expect(toScrollMovement(10, ratio, 1)).toBeCloseTo(-(10 / ratio), 9);
    expect(toScrollMovement(10, ratio, 0.5)).toBeCloseTo(
      -(10 / ratio) * 0.5,
      9
    );
    expect(toScrollMovement(10, ratio, 2)).toBeCloseTo(-(10 / ratio) * 2, 9);
  });

  it('moves the drawn rectangle by exactly the pointer travel at every zoom', () => {
    for (const zoomLevel of ZOOMS) {
      const state = stateOf({
        tables: [{ x: 3000, y: 3000 }],
        view: { zoomLevel },
      });
      const layout = getMinimapLayout(state);
      const transform = getViewTransform(state);
      const before = getMinimapViewportRect(layout, transform);
      const originX =
        transform.originX + toScrollMovement(10, layout.ratio, zoomLevel);
      const after = getMinimapViewportRect(layout, { ...transform, originX });

      expect(after.x - before.x).toBeCloseTo(10, 6);
      expect(after.width).toBeCloseTo(before.width, 6);
    }
  });
});

describe('getScrollToCenter', () => {
  it('leaves the origin where it is when the point is already centred', () => {
    const origin = getScrollToCenter(view(), { x: 600, y: 337.5 });

    expect(origin.x).toBe(0);
    expect(origin.y).toBe(0);
  });

  it('centres the screen on the point at every zoom', () => {
    for (const zoomLevel of ZOOMS) {
      const center = { x: 400, y: 900 };
      const origin = getScrollToCenter(view({ zoomLevel }), center);
      const rect = getVisibleCanvasRect(
        view({ zoomLevel, originX: origin.x, originY: origin.y })
      );

      expect(rect.x + rect.width / 2).toBeCloseTo(center.x, 6);
      expect(rect.y + rect.height / 2).toBeCloseTo(center.y, 6);
    }
  });

  it('answers the same origin whatever origin it starts from', () => {
    const center = { x: 400, y: 900 };
    const from = getScrollToCenter(
      view({ zoomLevel: 0.5, originX: -500, originY: -700 }),
      center
    );
    const fresh = getScrollToCenter(view({ zoomLevel: 0.5 }), center);

    expect(from.x).toBeCloseTo(fresh.x, 6);
    expect(from.y).toBeCloseTo(fresh.y, 6);
  });

  it('lands the scene point under a pressed pixel in the middle of the screen', () => {
    for (const zoomLevel of ZOOMS) {
      const state = stateOf({
        tables: [{ x: 4000, y: -1000 }],
        view: { zoomLevel, originX: 120, originY: -80 },
      });
      const layout = getMinimapLayout(state);
      const transform = getViewTransform(state);
      const pressed = { x: layout.box.width * 0.8, y: layout.box.height * 0.3 };
      const scene = fromMinimapPoint(layout, pressed);
      const origin = getScrollToCenter(transform, scene);
      const landed = toScreenPoint(
        { zoomLevel, originX: origin.x, originY: origin.y },
        scene
      );

      expect(landed.x).toBeCloseTo(transform.viewportWidth / 2, 6);
      expect(landed.y).toBeCloseTo(transform.viewportHeight / 2, 6);
    }
  });
});
