import { describe, expect, it } from 'vite-plus/test';

import { getReachableRect } from '@/components/erd/hide-sign/hideSignBounds';
import { CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from '@/constants/schema';
import { getScrollRanges } from '@/engine/modules/settings/atom.actions';

const CANVAS = { width: 2_000, height: 2_000 };
const VIEWPORT = { width: 1_000, height: 800 };

const rectAt = (zoomLevel: number, viewport = VIEWPORT) =>
  getReachableRect({ ...CANVAS, zoomLevel }, viewport);

/**
 * How far past each edge of the canvas box the scroll can still carry the
 * screen: the half screen a shrinking zoom holds inside the document, or, once
 * the screen outgrows the drawn canvas, whatever is left of it, over the zoom.
 */
const overhang = (size: number, viewportLength: number, zoomLevel: number) => {
  const held = (viewportLength * (1 - Math.min(1, zoomLevel))) / 2;
  const spare = viewportLength - size * zoomLevel - held;

  return Math.max(held, spare) / zoomLevel;
};

/** Where the scene layer puts a point, written longhand rather than inverted. */
const toScreen = (scene: number, scroll: number, zoomLevel: number) =>
  scene * zoomLevel + scroll + (CANVAS.width * (1 - zoomLevel)) / 2;

describe('getReachableRect', () => {
  it('is the document box itself at zoom 1', () => {
    expect(rectAt(1)).toEqual({ x: 0, y: 0, w: 2_000, h: 2_000 });
  });

  /**
   * The regression. A magnifying zoom shows less of the document at once but
   * scrolls over all of it, and the box this replaces shrank with the zoom
   * instead: at 1.5 it read 333 to 1667 and marked visible edge tables.
   */
  it.each([1.2, 1.4, CANVAS_ZOOM_MAX])(
    'stays the document box at zoom %s',
    zoomLevel => {
      const rect = rectAt(zoomLevel);

      expect(rect.x).toBeCloseTo(0, 6);
      expect(rect.y).toBeCloseTo(0, 6);
      expect(rect.w).toBeCloseTo(2_000, 6);
      expect(rect.h).toBeCloseTo(2_000, 6);
    }
  );

  /**
   * The other half of the travel. A canvas drawn smaller than the screen keeps
   * the room that holds the screen's own edges on the document, so what the
   * scroll reaches past the box is half a screen rather than half the shrink.
   */
  it.each([0.9, 0.5, 0.25, CANVAS_ZOOM_MIN])(
    'widens by the half screen the scroll keeps at zoom %s',
    zoomLevel => {
      const rect = rectAt(zoomLevel);
      const x = overhang(2_000, VIEWPORT.width, zoomLevel);
      const y = overhang(2_000, VIEWPORT.height, zoomLevel);

      expect(rect.x).toBeCloseTo(-x, 6);
      expect(rect.y).toBeCloseTo(-y, 6);
      expect(rect.w).toBeCloseTo(2_000 + 2 * x, 6);
      expect(rect.h).toBeCloseTo(2_000 + 2 * y, 6);
    }
  );

  it('reads -4500 to 6500 across a 1000 wide screen at the zoom floor', () => {
    const rect = rectAt(CANVAS_ZOOM_MIN);

    expect(rect.x).toBeCloseTo(-4_500, 6);
    expect(rect.x + rect.w).toBeCloseTo(6_500, 6);
  });

  /**
   * The screen is a term now, where the box it replaces had none. A magnifying
   * zoom still answers the same on a phone and on a wall, and a frame the host
   * has not measured yet reports no screen and gets the document box.
   */
  it.each([
    [0, 0],
    [320, 480],
    [1_000, 800],
    [3_840, 2_160],
  ])(
    'follows a viewport of %s x %s exactly where the travel does',
    (width, height) => {
      for (const zoomLevel of [
        CANVAS_ZOOM_MIN,
        0.5,
        0.9,
        1,
        1.2,
        CANVAS_ZOOM_MAX,
      ]) {
        const rect = rectAt(zoomLevel, { width, height });
        const x = overhang(2_000, width, zoomLevel);
        const y = overhang(2_000, height, zoomLevel);

        expect(rect.x).toBeCloseTo(-x, 6);
        expect(rect.y).toBeCloseTo(-y, 6);
        expect(rect.w).toBeCloseTo(2_000 + 2 * x, 6);
        expect(rect.h).toBeCloseTo(2_000 + 2 * y, 6);
      }
    }
  );

  /**
   * What changed, stated as the loss it is. The box used to widen by half the
   * shrink of the canvas box, which is a whole document at the floor, so it
   * left tables unmarked that no scroll at that zoom could bring on screen.
   */
  it.each([CANVAS_ZOOM_MIN, 0.25, 0.5, 0.9])(
    'reaches less than half the canvas shrink at zoom %s',
    zoomLevel => {
      const canvasShrink = (2_000 * (1 - zoomLevel)) / (2 * zoomLevel);

      expect(-rectAt(zoomLevel).x).toBeLessThan(canvasShrink);
      expect(-rectAt(zoomLevel).x).toBeGreaterThan(0);
    }
  );

  it('measures each axis against its own side of a rectangular canvas', () => {
    const rect = getReachableRect(
      { width: 3_000, height: 1_000, zoomLevel: 0.5 },
      VIEWPORT
    );

    expect(rect.x).toBeCloseTo(-500, 6);
    expect(rect.w).toBeCloseTo(4_000, 6);
    expect(rect.y).toBeCloseTo(-400, 6);
    expect(rect.h).toBeCloseTo(1_800, 6);
  });

  /**
   * What the box means, read off the reducer's own travel rather than restated:
   * a point inside it is one some scroll the zoom allows puts on screen, and a
   * point outside it is one no scroll reaches.
   */
  it('holds exactly the scene points some scroll can show', () => {
    const wrong: string[] = [];
    const zooms = [CANVAS_ZOOM_MIN, 0.5, 0.9, 1, 1.2, CANVAS_ZOOM_MAX];

    for (const zoomLevel of zooms) {
      const rect = rectAt(zoomLevel);
      const { min, max } = getScrollRanges(
        { ...CANVAS, zoomLevel },
        VIEWPORT
      ).left;
      const shown = (scene: number) => {
        for (let step = 0; step <= 512; step++) {
          const scroll = min + ((max - min) * step) / 512;
          const at = toScreen(scene, scroll, zoomLevel);

          if (at >= 0 && at <= VIEWPORT.width) return true;
        }

        return false;
      };

      for (const inside of [rect.x + 1, 1_000, rect.x + rect.w - 1]) {
        if (shown(inside)) continue;
        wrong.push(
          `zoom ${zoomLevel}: scene x ${inside} is inside the box and no scroll shows it`
        );
      }

      for (const outside of [rect.x - 1, rect.x + rect.w + 1]) {
        if (!shown(outside)) continue;
        wrong.push(
          `zoom ${zoomLevel}: scene x ${outside} is outside the box and a scroll shows it`
        );
      }
    }

    expect(wrong).toEqual([]);
  });
});
