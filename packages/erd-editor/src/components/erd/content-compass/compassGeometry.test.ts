import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  formatDistance,
  getContentCompass,
} from '@/components/erd/content-compass/compassGeometry';
import {
  getViewTransform,
  getVisibleCanvasRect,
  type ViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { getContentRects } from '@/konva/scene/contentBounds';
import { type Rect } from '@/konva/scene/metrics';
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

const middleOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

const screenOf = (state: RootState) =>
  getVisibleCanvasRect(getViewTransform(state));

describe('getContentCompass', () => {
  it('reports nothing for a document holding no table and no memo', () => {
    expect(getContentCompass(stateOf())).toBeNull();
  });

  it('reports nothing while a table is on the screen', () => {
    expect(
      getContentCompass(stateOf({ tables: [{ x: 200, y: 200 }] }))
    ).toBeNull();
  });

  it('reports nothing while one entity of several is on the screen', () => {
    const state = stateOf({
      tables: [{ x: 200, y: 200 }],
      memos: [{ x: 40_000, y: 40_000 }],
    });

    expect(getContentCompass(state)).toBeNull();
  });

  it('counts a table touching the screen edge as on the screen', () => {
    // Its near edge lands exactly on the screen's far edge, which is the end of
    // the pure travel, and culling draws a box that touches the same way.
    const state = stateOf({ tables: [{ x: 1_200, y: 300 }] });

    expect(getContentCompass(state)).toBeNull();
  });

  it('measures the gap from the screen edge to the entity, not from its middle', () => {
    const state = stateOf({ tables: [{ x: 2_000, y: 0 }] });

    // The table's own rows span less than the screen, so the two boxes overlap
    // along y and the gap is the one axis they do not share.
    expect(getContentCompass(state)?.distance).toBeCloseTo(2_000 - 1_200, 6);
  });

  it('measures both axes at once when the entity lies off a corner', () => {
    const state = stateOf({ memos: [{ x: 4_200, y: 3_675 }] });

    expect(getContentCompass(state)?.distance).toBeCloseTo(
      Math.hypot(4_200 - 1_200, 3_675 - 675),
      6
    );
  });

  it('names the middle of the nearest entity as what a press centres', () => {
    const state = stateOf({
      tables: [{ x: 9_000, y: 0 }],
      memos: [{ x: 3_000, y: 0 }],
    });
    const [, memo] = getContentRects(state);

    expect(getContentCompass(state)?.target).toEqual(middleOf(memo));
  });

  it('points the arrow at that middle, from the middle of the screen', () => {
    const state = stateOf({ memos: [{ x: -6_000, y: -4_000 }] });
    const compass = getContentCompass(state)!;
    const from = middleOf(screenOf(state));
    const radians = (compass.angle * Math.PI) / 180;
    const reach = Math.hypot(
      compass.target.x - from.x,
      compass.target.y - from.y
    );

    expect(from.x + Math.cos(radians) * reach).toBeCloseTo(compass.target.x, 6);
    expect(from.y + Math.sin(radians) * reach).toBeCloseTo(compass.target.y, 6);
  });

  it('turns the arrow through every quarter the content can lie in', () => {
    const far = 20_000;
    const quarters = [
      { at: { x: far, y: 0 }, low: -90, high: 0 },
      { at: { x: far, y: far }, low: 0, high: 90 },
      { at: { x: -far, y: far }, low: 90, high: 180 },
      { at: { x: -far, y: -far }, low: -180, high: -90 },
    ];

    for (const { at, low, high } of quarters) {
      const angle = getContentCompass(stateOf({ memos: [at] }))!.angle;

      expect({ at, turned: angle > low && angle < high }).toEqual({
        at,
        turned: true,
      });
    }
  });

  it('follows the view rather than the document, so a pan back puts it away', () => {
    const at = { x: 8_000, y: 6_000 };

    expect(getContentCompass(stateOf({ tables: [at] }))).not.toBeNull();
    expect(
      getContentCompass(
        stateOf({ tables: [at], view: { originX: -7_900, originY: -5_900 } })
      )
    ).toBeNull();
  });

  it('reads the screen the zoom leaves, so zooming out brings the content back', () => {
    const at = { x: 3_000, y: 2_000 };

    expect(getContentCompass(stateOf({ memos: [at] }))).not.toBeNull();
    expect(
      getContentCompass(stateOf({ memos: [at], view: { zoomLevel: 0.1 } }))
    ).toBeNull();
  });

  it('reports nothing while nobody has measured the screen', () => {
    const state = stateOf({
      tables: [{ x: 40_000, y: 40_000 }],
      view: { viewportWidth: 0, viewportHeight: 0 },
    });

    expect(getContentCompass(state)).toBeNull();
  });
});

describe('formatDistance', () => {
  it('prints whole scene units under a thousand', () => {
    expect(formatDistance(0)).toBe('0');
    expect(formatDistance(7.4)).toBe('7');
    expect(formatDistance(812.6)).toBe('813');
  });

  it('carries one decimal into the thousands and the millions, and drops it past ten', () => {
    expect(formatDistance(999.6)).toBe('1.0k');
    expect(formatDistance(2_400)).toBe('2.4k');
    expect(formatDistance(12_345)).toBe('12k');
    expect(formatDistance(999_500)).toBe('1.0M');
    expect(formatDistance(4_250_000)).toBe('4.3M');
  });

  it('stays inside four characters over every distance a pan can reach', () => {
    const distances = [
      0, 9, 99, 999, 1_000, 9_949, 9_950, 99_999, 999_999, 1_000_000,
      999_999_999,
    ];

    for (const distance of distances) {
      expect({ distance, label: formatDistance(distance) }).toEqual({
        distance,
        label: expect.stringMatching(/^.{1,4}$/),
      });
    }
  });

  it('never prints a negative distance, which only a torn rect could ask for', () => {
    expect(formatDistance(-5)).toBe('0');
  });
});
