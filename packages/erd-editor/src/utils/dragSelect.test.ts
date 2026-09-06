import { describe, expect, it } from 'vite-plus/test';

import {
  getOverlapPosition,
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
