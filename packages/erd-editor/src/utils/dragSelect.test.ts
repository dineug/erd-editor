import { describe, expect, it } from 'vite-plus/test';

import {
  getAbsolutePoint,
  getAbsolutePosition,
  getAbsoluteZoomPoint,
  getOverlapPosition,
  getZoomViewport,
  isOverlapPosition,
  type Rect,
} from '@/utils/dragSelect';

const rect = (x: number, y: number, w: number, h: number): Rect => ({
  x,
  y,
  w,
  h,
});

describe('isOverlapPosition', () => {
  it('detects a partial overlap', () => {
    expect(isOverlapPosition(rect(0, 0, 50, 50), rect(25, 25, 50, 50))).toBe(
      true
    );
  });

  it('detects full containment in both directions', () => {
    expect(isOverlapPosition(rect(0, 0, 100, 100), rect(10, 10, 10, 10))).toBe(
      true
    );
    expect(isOverlapPosition(rect(10, 10, 10, 10), rect(0, 0, 100, 100))).toBe(
      true
    );
  });

  it('treats touching edges as overlapping', () => {
    expect(isOverlapPosition(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(
      true
    );
    expect(isOverlapPosition(rect(0, 0, 10, 10), rect(0, 10, 10, 10))).toBe(
      true
    );
  });

  it('returns false when the drag rect is to the right of the rect', () => {
    expect(isOverlapPosition(rect(101, 0, 10, 10), rect(0, 0, 100, 10))).toBe(
      false
    );
  });

  it('returns false when the drag rect is to the left of the rect', () => {
    expect(isOverlapPosition(rect(0, 0, 10, 10), rect(11, 0, 10, 10))).toBe(
      false
    );
  });

  it('returns false when the drag rect is below the rect', () => {
    expect(isOverlapPosition(rect(0, 101, 10, 10), rect(0, 0, 10, 100))).toBe(
      false
    );
  });

  it('returns false when the drag rect is above the rect', () => {
    expect(isOverlapPosition(rect(0, 0, 10, 10), rect(0, 11, 10, 10))).toBe(
      false
    );
  });
});

describe('getOverlapPosition', () => {
  it('returns null when the rects do not overlap', () => {
    expect(getOverlapPosition(rect(0, 0, 10, 10), rect(50, 50, 10, 10))).toBe(
      null
    );
  });

  it('returns the intersection with x2/y2 relative to the target rect', () => {
    expect(
      getOverlapPosition(rect(0, 0, 50, 50), rect(25, 25, 100, 100))
    ).toEqual({ x1: 25, y1: 25, x2: 25, y2: 25 });
  });

  it('clamps the intersection to the target rect when the drag rect covers it', () => {
    expect(
      getOverlapPosition(rect(-10, -10, 200, 200), rect(20, 30, 40, 50))
    ).toEqual({ x1: 20, y1: 30, x2: 40, y2: 50 });
  });

  it('returns the drag rect bounds when it sits inside the target rect', () => {
    expect(
      getOverlapPosition(rect(30, 40, 10, 20), rect(0, 0, 100, 100))
    ).toEqual({ x1: 30, y1: 40, x2: 40, y2: 60 });
  });

  it('returns a zero sized intersection for touching edges', () => {
    expect(getOverlapPosition(rect(10, 0, 10, 10), rect(0, 0, 10, 10))).toEqual(
      { x1: 10, y1: 0, x2: 10, y2: 10 }
    );
  });
});

describe('getZoomViewport', () => {
  it('centers a shrunken viewport inside the canvas', () => {
    expect(getZoomViewport(1000, 500, 0.5)).toEqual({
      x: 250,
      y: 125,
      w: 500,
      h: 250,
    });
  });

  it('returns the full canvas at zoom level 1', () => {
    expect(getZoomViewport(1000, 500, 1)).toEqual({
      x: 0,
      y: 0,
      w: 1000,
      h: 500,
    });
  });

  it('produces negative offsets when zoomed above 1', () => {
    expect(getZoomViewport(100, 100, 2)).toEqual({
      x: -50,
      y: -50,
      w: 200,
      h: 200,
    });
  });
});

describe('getAbsolutePosition', () => {
  it('removes the viewport offset from x1/y1 and scales every value', () => {
    const zoomViewport = getZoomViewport(1000, 500, 0.5);

    expect(
      getAbsolutePosition(
        { x1: 300, y1: 175, x2: 50, y2: 25 },
        zoomViewport,
        0.5
      )
    ).toEqual({ x1: 100, y1: 100, x2: 100, y2: 50 });
  });

  it('is the identity at zoom level 1', () => {
    const overlap = { x1: 10, y1: 20, x2: 30, y2: 40 };

    expect(
      getAbsolutePosition(overlap, getZoomViewport(800, 600, 1), 1)
    ).toEqual(overlap);
  });
});

describe('getAbsoluteZoomPoint', () => {
  it('scales the point and shifts it by the zoom viewport origin', () => {
    expect(getAbsoluteZoomPoint({ x: 100, y: 50 }, 1000, 500, 0.5)).toEqual({
      x: 300,
      y: 150,
    });
  });

  it('returns the point unchanged at zoom level 1', () => {
    expect(getAbsoluteZoomPoint({ x: 100, y: 50 }, 1000, 500, 1)).toEqual({
      x: 100,
      y: 50,
    });
  });
});

describe('getAbsolutePoint', () => {
  it('returns the point unchanged at zoom level 1', () => {
    expect(getAbsolutePoint({ x: 100, y: 50 }, 1000, 500, 1)).toEqual({
      x: 100,
      y: 50,
    });
  });

  it('compensates for the zoom viewport offset when zoomed out', () => {
    expect(getAbsolutePoint({ x: 100, y: 50 }, 1000, 500, 0.5)).toEqual({
      x: -300,
      y: -150,
    });
  });

  it('compensates in the opposite direction when zoomed in', () => {
    // zoomViewport: { x: -50, y: -50 }, zoom point: { x: 150, y: 150 }
    expect(getAbsolutePoint({ x: 100, y: 100 }, 100, 100, 2)).toEqual({
      x: 75,
      y: 75,
    });
  });

  it('keeps the canvas center fixed', () => {
    expect(getAbsolutePoint({ x: 500, y: 250 }, 1000, 500, 0.5)).toEqual({
      x: 500,
      y: 250,
    });
  });
});
