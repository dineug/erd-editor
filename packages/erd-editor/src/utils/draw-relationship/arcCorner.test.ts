// AC-28: a view bends its connector corners round an arc, under the same
// bounds the document's 45 degree cut works to, so the two differ in the shape
// between the cut points and in nothing else.

import { describe, expect, it } from 'vite-plus/test';

import { Point } from '@/internal-types';
import {
  arcPolyline,
  VIEW_ARC_SEGMENTS,
} from '@/utils/draw-relationship/arcCorner';

const line = (...pairs: Array<[number, number]>): Point[] =>
  pairs.map(([x, y]) => ({ x, y }));

/** Three decimals, an order finer than the half pixel the readers work to. */
const pairs = (points: Point[]): Array<[number, number]> =>
  points.map(point => [
    Math.round(point.x * 1000) / 1000,
    Math.round(point.y * 1000) / 1000,
  ]);

describe('arcPolyline', () => {
  it('bends a corner into an arc that leaves each run the given distance back', () => {
    const cut = arcPolyline(line([0, 0], [100, 0], [100, 100]), 8);

    expect(pairs(cut)).toEqual([
      [0, 0],
      [92, 0],
      [95.061, 0.609],
      [97.657, 2.343],
      [99.391, 4.939],
      [100, 8],
      [100, 100],
    ]);
  });

  it('never takes more than half a run, so two corners cannot cross', () => {
    // The middle run is 20 long: a 40px radius either end would overrun it, so
    // each corner is limited to half of the shorter run it touches.
    const cut = arcPolyline(line([0, 0], [100, 0], [100, 20], [200, 20]), 40);

    expect(pairs(cut)).toEqual([
      [0, 0],
      [90, 0],
      [93.827, 0.761],
      [97.071, 2.929],
      [99.239, 6.173],
      [100, 10],
      [100.761, 13.827],
      [102.929, 17.071],
      [106.173, 19.239],
      [110, 20],
      [200, 20],
    ]);
  });

  it('merges a staircase where the two arcs meet', () => {
    // Middle run of 16, radius 8 either side: both arcs end on its midpoint,
    // and they join there instead of straddling a segment of nothing.
    const cut = arcPolyline(line([0, 0], [100, 0], [100, 16], [200, 16]), 8);

    expect(pairs(cut)).toEqual([
      [0, 0],
      [92, 0],
      [95.061, 0.609],
      [97.657, 2.343],
      [99.391, 4.939],
      [100, 8],
      [100.609, 11.061],
      [102.343, 13.657],
      [104.939, 15.391],
      [108, 16],
      [200, 16],
    ]);
  });

  it('keeps the right angle when the arc would be a smudge', () => {
    const cut = arcPolyline(line([0, 0], [100, 0], [100, 3]), 8);

    expect(pairs(cut)).toEqual([
      [0, 0],
      [100, 0],
      [100, 3],
    ]);
  });

  it('leaves the two ends where they were', () => {
    const points = line([10, 20], [200, 20], [200, 300], [400, 300]);
    const cut = arcPolyline(points, 8);

    expect(cut[0]).toEqual({ x: 10, y: 20 });
    expect(cut[cut.length - 1]).toEqual({ x: 400, y: 300 });
  });

  it('passes through a polyline with no corner to bend', () => {
    expect(pairs(arcPolyline(line([0, 0], [100, 0]), 8))).toEqual([
      [0, 0],
      [100, 0],
    ]);
    expect(arcPolyline([], 8)).toEqual([]);
  });

  it('leaves a point that continues in the same direction alone', () => {
    expect(pairs(arcPolyline(line([0, 0], [50, 0], [100, 0]), 8))).toEqual([
      [0, 0],
      [50, 0],
      [100, 0],
    ]);
  });

  it('does nothing when there is no radius to bend with', () => {
    const points = line([0, 0], [100, 0], [100, 100]);
    expect(arcPolyline(points, 0)).toBe(points);
    expect(arcPolyline(points, 8, 0)).toBe(points);
  });

  it('draws the bend as one quarter circle of the radius it was given', () => {
    const cut = arcPolyline(line([0, 0], [100, 0], [100, 100]), 8);
    const bend = cut.slice(1, -1);
    const center = { x: 92, y: 8 };

    expect(bend).toHaveLength(VIEW_ARC_SEGMENTS + 1);
    for (const point of bend) {
      expect(Math.hypot(point.x - center.x, point.y - center.y)).toBeCloseTo(
        8,
        10
      );
    }
  });

  it('keeps every point of the bend inside the corner it replaced', () => {
    const cut = arcPolyline(line([0, 0], [100, 0], [100, 100]), 8);
    const bend = cut.slice(1, -1);

    for (const point of bend) {
      // Inside the box the two cut points and the corner span, and on the
      // corner's side of the chord that joins them, which together is the
      // triangle those three make.
      expect(point.x).toBeGreaterThanOrEqual(92);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(8);
      expect(point.x - point.y).toBeGreaterThanOrEqual(92);
    }
  });

  it('hands back a chain no reader has to close a gap in', () => {
    const cut = arcPolyline(
      line([0, 0], [100, 0], [100, 200], [300, 200], [300, 400]),
      12
    );

    for (let index = 1; index < cut.length; index++) {
      const before = cut[index - 1];
      const point = cut[index];
      // No repeated point, so every consecutive pair is a segment with a
      // direction of its own, which is what the drawer and the particles read.
      expect(
        Math.hypot(point.x - before.x, point.y - before.y)
      ).toBeGreaterThan(0.5);

      if (index < 2) continue;
      const previous = cut[index - 2];
      const dot =
        (before.x - previous.x) * (point.x - before.x) +
        (before.y - previous.y) * (point.y - before.y);
      // Never doubles back: an arc step turns a fraction of a right angle.
      expect(dot).toBeGreaterThan(0);
    }
  });
});
