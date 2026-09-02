import { describe, expect, it } from 'vite-plus/test';

import { getReachableRect } from '@/components/erd/hide-sign/hideSignBounds';
import { CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from '@/constants/schema';

const CANVAS = { width: 2_000, height: 2_000 };
const VIEWPORT = { width: 1_000, height: 800 };

const rectAt = (zoomLevel: number, viewport = VIEWPORT) =>
  getReachableRect({ ...CANVAS, zoomLevel }, viewport);

/** How far past each edge of the canvas box a shrinking zoom can still scroll. */
const overhang = (size: number, zoomLevel: number) =>
  (size * (1 - zoomLevel)) / (2 * zoomLevel);

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
   * The other half of the travel, unchanged. A canvas drawn smaller than the
   * screen leaves the scroll the room the unzoomed box had, so the scene it
   * reaches grows by that room read back through the zoom.
   */
  it.each([0.9, 0.5, 0.25, CANVAS_ZOOM_MIN])(
    'widens by the overhang the scroll keeps at zoom %s',
    zoomLevel => {
      const rect = rectAt(zoomLevel);
      const x = overhang(2_000, zoomLevel);

      expect(rect.x).toBeCloseTo(-x, 6);
      expect(rect.y).toBeCloseTo(-x, 6);
      expect(rect.w).toBeCloseTo(2_000 + 2 * x, 6);
      expect(rect.h).toBeCloseTo(2_000 + 2 * x, 6);
    }
  );

  it('reads -9000 to 11000 at the zoom floor, as the css transform did', () => {
    const rect = rectAt(CANVAS_ZOOM_MIN);

    expect(rect.x).toBeCloseTo(-9_000, 6);
    expect(rect.x + rect.w).toBeCloseTo(11_000, 6);
  });

  /**
   * The travel a zoom allows moves with the screen, and what it reaches does
   * not, so the answer is the same on a phone and on a wall. A frame the host
   * has not measured yet reports nothing and has to get that answer too.
   */
  it.each([
    [0, 0],
    [320, 480],
    [1_000, 800],
    [3_840, 2_160],
  ])('ignores a viewport of %s x %s', (width, height) => {
    for (const zoomLevel of [CANVAS_ZOOM_MIN, 0.5, 1, 1.2, CANVAS_ZOOM_MAX]) {
      const rect = rectAt(zoomLevel, { width, height });
      const reference = rectAt(zoomLevel);

      expect(rect.x).toBeCloseTo(reference.x, 6);
      expect(rect.y).toBeCloseTo(reference.y, 6);
      expect(rect.w).toBeCloseTo(reference.w, 6);
      expect(rect.h).toBeCloseTo(reference.h, 6);
    }
  });

  it('measures each axis against its own side of a rectangular canvas', () => {
    const rect = getReachableRect(
      { width: 3_000, height: 1_000, zoomLevel: 0.5 },
      VIEWPORT
    );

    expect(rect.x).toBeCloseTo(-1_500, 6);
    expect(rect.w).toBeCloseTo(6_000, 6);
    expect(rect.y).toBeCloseTo(-500, 6);
    expect(rect.h).toBeCloseTo(2_000, 6);
  });
});
