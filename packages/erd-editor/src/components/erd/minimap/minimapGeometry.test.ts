import { describe, expect, it } from 'vite-plus/test';

import {
  getMinimapBoxSize,
  getMinimapHandleRect,
  getMinimapRatio,
  getMinimapViewportRect,
  getScrollToCenter,
  getVisibleCanvasRect,
  type MinimapTransform,
  toScrollDistance,
  toScrollMovement,
} from '@/components/erd/minimap/minimapGeometry';

const transform = (
  overrides: Partial<MinimapTransform> = {}
): MinimapTransform => ({
  width: 2000,
  height: 2000,
  scrollLeft: 0,
  scrollTop: 0,
  zoomLevel: 1,
  viewportWidth: 1200,
  viewportHeight: 675,
  ...overrides,
});

describe('getMinimapRatio', () => {
  it('is the canvas box folded into the minimap square', () => {
    expect(getMinimapRatio(2000)).toBe(0.075);
    expect(getMinimapRatio(4000)).toBe(0.0375);
  });
});

describe('getVisibleCanvasRect', () => {
  it('is the scroll and the editor viewport when the canvas is unzoomed', () => {
    expect(getVisibleCanvasRect(transform())).toEqual({
      x: 0,
      y: 0,
      width: 1200,
      height: 675,
    });

    expect(
      getVisibleCanvasRect(transform({ scrollLeft: -400, scrollTop: -200 }))
    ).toEqual({ x: 400, y: 200, width: 1200, height: 675 });
  });

  it('covers more canvas per screen pixel as the canvas zooms out', () => {
    // The screen is 1200 wide over a canvas drawn at half size, so it reaches
    // 2400 canvas units, starting 1000 left of the box the zoom shrank about.
    expect(getVisibleCanvasRect(transform({ zoomLevel: 0.5 }))).toEqual({
      x: -1000,
      y: -1000,
      width: 2400,
      height: 1350,
    });
  });

  it('covers less canvas per screen pixel as the canvas zooms in', () => {
    expect(getVisibleCanvasRect(transform({ zoomLevel: 2 }))).toEqual({
      x: 500,
      y: 500,
      width: 600,
      height: 337.5,
    });
  });

  it('answers a plain zero where negating the origin would sign one', () => {
    // The store compares with Object.is, so a negative zero here reads as a
    // scroll change on every frame that has not moved.
    const rect = getVisibleCanvasRect(transform());

    expect(Object.is(rect.x, 0)).toBe(true);
    expect(Object.is(rect.y, 0)).toBe(true);
  });

  it('falls back to an unzoomed read rather than inverting a zero zoom', () => {
    expect(getVisibleCanvasRect(transform({ zoomLevel: 0 }))).toEqual(
      getVisibleCanvasRect(transform({ zoomLevel: 1 }))
    );
  });
});

describe('getMinimapViewportRect', () => {
  it('draws the editor viewport at the fixed minimap ratio', () => {
    expect(getMinimapViewportRect(transform())).toEqual({
      x: 0,
      y: 0,
      width: 90,
      height: 50.625,
    });
  });

  it('grows past the minimap square as the canvas zooms out', () => {
    // Twice the 90 the same viewport draws at zoom 1: the map underneath keeps
    // its size, so the whole of the zoom has to land in this rectangle.
    expect(getMinimapViewportRect(transform({ zoomLevel: 0.5 }))).toEqual({
      x: -75,
      y: -75,
      width: 180,
      height: 101.25,
    });
  });

  it('shrinks inside the minimap square as the canvas zooms in', () => {
    expect(getMinimapViewportRect(transform({ zoomLevel: 2 }))).toEqual({
      x: 37.5,
      y: 37.5,
      width: 45,
      height: 25.3125,
    });
  });

  it('stays inside the minimap for every scroll the engine allows at zoom 1', () => {
    // The engine clamps the scroll to viewport minus canvas, which at zoom 1 is
    // exactly the range that keeps this rectangle within the 150px square.
    const left = getMinimapViewportRect(transform({ scrollLeft: 0 }));
    const right = getMinimapViewportRect(transform({ scrollLeft: -800 }));

    expect(left.x).toBe(0);
    expect(right.x + right.width).toBe(150);
  });
});

describe('getMinimapBoxSize', () => {
  it('is the canvas box at the minimap ratio, always 150 wide', () => {
    expect(getMinimapBoxSize(2000, 2000)).toEqual({ width: 150, height: 150 });
    expect(getMinimapBoxSize(4000, 2000)).toEqual({ width: 150, height: 75 });
  });
});

describe('getMinimapHandleRect', () => {
  it('is the untrimmed rectangle whenever that already fits the map', () => {
    expect(getMinimapHandleRect(transform())).toEqual(
      getMinimapViewportRect(transform())
    );
    expect(getMinimapHandleRect(transform({ zoomLevel: 2 }))).toEqual(
      getMinimapViewportRect(transform({ zoomLevel: 2 }))
    );
  });

  it('trims the part of the rectangle that leaves the map', () => {
    // Untrimmed this is 180 x 101.25 from -75, -75, so both leading edges are
    // off the map and only the far edges land on it.
    expect(getMinimapHandleRect(transform({ zoomLevel: 0.5 }))).toEqual({
      x: 0,
      y: 0,
      width: 105,
      height: 26.25,
    });
  });

  it('stays inside the map at every zoom and every scroll', () => {
    for (const zoomLevel of [1, 0.7, 0.5, 0.2, 0.1, 2]) {
      for (const scroll of [0, -400, -800, -2000, 500]) {
        const rect = getMinimapHandleRect(
          transform({ zoomLevel, scrollLeft: scroll, scrollTop: scroll })
        );

        // The drawn box is a pointer target: anything of it outside the map
        // would take presses meant for the canvas underneath.
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.width).toBeGreaterThanOrEqual(0);
        expect(rect.height).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(150);
        expect(rect.y + rect.height).toBeLessThanOrEqual(150);
      }
    }
  });
});

describe('toScrollDistance', () => {
  it('turns a canvas distance into the screen scroll that travels it', () => {
    expect(toScrollDistance(100, 1)).toBe(-100);
    expect(toScrollDistance(100, 0.5)).toBe(-50);
    expect(toScrollDistance(100, 2)).toBe(-200);
    expect(toScrollDistance(100, 0)).toBe(-100);
  });
});

describe('toScrollMovement', () => {
  it('is unchanged at zoom 1, where a canvas unit is a screen pixel', () => {
    expect(toScrollMovement(10, 0.075, 1)).toBeCloseTo(-133.3333, 4);
  });

  it('scales with the zoom, so the rectangle tracks the pointer 1:1', () => {
    expect(toScrollMovement(10, 0.075, 0.5)).toBeCloseTo(-66.6667, 4);
    expect(toScrollMovement(10, 0.075, 2)).toBeCloseTo(-266.6667, 4);
  });

  it('moves the drawn rectangle by exactly the pointer travel at every zoom', () => {
    for (const zoomLevel of [1, 0.7, 0.5, 0.2, 0.1, 2]) {
      const before = getMinimapViewportRect(transform({ zoomLevel }));
      const scrollLeft = toScrollMovement(10, getMinimapRatio(2000), zoomLevel);
      const after = getMinimapViewportRect(
        transform({ zoomLevel, scrollLeft })
      );

      expect(after.x - before.x).toBeCloseTo(10, 6);
      expect(after.width).toBeCloseTo(before.width, 6);
    }
  });
});

describe('getScrollToCenter', () => {
  it('leaves the scroll where it is when the point is already centred', () => {
    const scroll = getScrollToCenter(transform(), { x: 600, y: 337.5 });

    expect(scroll.x).toBe(0);
    expect(scroll.y).toBe(0);
  });

  it('centres the screen on the point at every zoom', () => {
    for (const zoomLevel of [1, 0.7, 0.5, 0.2, 0.1, 2]) {
      const center = { x: 400, y: 900 };
      const scroll = getScrollToCenter(transform({ zoomLevel }), center);
      const rect = getVisibleCanvasRect(
        transform({ zoomLevel, scrollLeft: scroll.x, scrollTop: scroll.y })
      );

      expect(rect.x + rect.width / 2).toBeCloseTo(center.x, 6);
      expect(rect.y + rect.height / 2).toBeCloseTo(center.y, 6);
    }
  });

  it('answers the same scroll whatever scroll it starts from', () => {
    const center = { x: 400, y: 900 };
    const from = getScrollToCenter(
      transform({ zoomLevel: 0.5, scrollLeft: -500, scrollTop: -700 }),
      center
    );
    const fresh = getScrollToCenter(transform({ zoomLevel: 0.5 }), center);

    expect(from.x).toBeCloseTo(fresh.x, 6);
    expect(from.y).toBeCloseTo(fresh.y, 6);
  });
});
