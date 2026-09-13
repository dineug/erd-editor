// AC-28: a view draws its connectors as curves, so the shape is fixed here as
// the reference fixes it — the control points, and the polyline the curve is
// handed to every reader downstream as.

import { describe, expect, it } from 'vite-plus/test';

import { Point } from '@/internal-types';
import {
  bezierControls,
  bezierPolyline,
  curveReach,
  VIEW_BEZIER_SEGMENTS,
  VIEW_CURVATURE,
} from '@/utils/draw-relationship/bezier';

/** The last bits of a cubic summed four ways, well under the padding a box adds. */
const SLOP = 1e-9;

const RIGHT: Point = { x: 1, y: 0 };
const LEFT: Point = { x: -1, y: 0 };
const DOWN: Point = { x: 0, y: 1 };
const UP: Point = { x: 0, y: -1 };

/** How far the polyline strays from the straight line between its two ends. */
function bulge(points: Point[]): number {
  const from = points[0];
  const to = points[points.length - 1];
  const run = { x: to.x - from.x, y: to.y - from.y };
  const length = Math.hypot(run.x, run.y);

  return points.reduce((furthest, point) => {
    const away =
      Math.abs((point.x - from.x) * run.y - (point.y - from.y) * run.x) /
      length;
    return Math.max(furthest, away);
  }, 0);
}

describe('bezierControls', () => {
  it('puts each control half the gap ahead, along its own end direction', () => {
    expect(
      bezierControls({ x: 0, y: 0 }, RIGHT, { x: 300, y: 100 }, LEFT)
    ).toEqual([
      { x: 150, y: 0 },
      { x: 150, y: 100 },
    ]);
  });

  it('measures the gap on the axis the end faces, not the distance between them', () => {
    const [start, end] = bezierControls(
      { x: 0, y: 0 },
      DOWN,
      { x: 400, y: 200 },
      UP
    );

    expect(start).toEqual({ x: 0, y: 100 });
    expect(end).toEqual({ x: 400, y: 100 });
  });

  it('reaches back by a square root where the other end is behind it', () => {
    const [start] = bezierControls(
      { x: 0, y: 0 },
      RIGHT,
      { x: -64, y: 0 },
      {
        x: 1,
        y: 0,
      }
    );

    expect(start).toEqual({ x: curveReach(64), y: 0 });
    expect(curveReach(64)).toBe(VIEW_CURVATURE * 25 * 8);
  });

  it('reads a gap of nothing as no reach at all', () => {
    expect(curveReach(0)).toBe(0);
    expect(curveReach(-5)).toBe(0);
    expect(
      bezierControls({ x: 10, y: 10 }, RIGHT, { x: 10, y: 90 }, LEFT)
    ).toEqual([
      { x: 10, y: 10 },
      { x: 10, y: 90 },
    ]);
  });
});

describe('bezierPolyline', () => {
  const curve = bezierPolyline({ x: 0, y: 0 }, RIGHT, { x: 200, y: 200 }, UP);

  it('lands on both ends exactly, with one point per segment between', () => {
    expect(curve).toHaveLength(VIEW_BEZIER_SEGMENTS + 1);
    expect(curve[0]).toEqual({ x: 0, y: 0 });
    expect(curve[curve.length - 1]).toEqual({ x: 200, y: 200 });
  });

  it('bends away from the straight line its ends make', () => {
    expect(bulge(curve)).toBeCloseTo(53.033, 3);
  });

  it('turns by a little at each of its points and never doubles back', () => {
    const headings = curve.slice(1).map((point, index) => {
      const before = curve[index];
      return Math.atan2(point.y - before.y, point.x - before.x);
    });

    for (let index = 1; index < headings.length; index++) {
      const turn = Math.abs(
        ((headings[index] - headings[index - 1]) * 180) / Math.PI
      );
      expect(turn).toBeGreaterThan(3);
      expect(turn).toBeLessThan(5);
    }
  });

  it('draws a straight run as a straight run, whatever it costs in points', () => {
    const straight = bezierPolyline(
      { x: 0, y: 0 },
      RIGHT,
      { x: 240, y: 0 },
      LEFT
    );

    expect(straight).toHaveLength(VIEW_BEZIER_SEGMENTS + 1);
    expect(bulge(straight)).toBeCloseTo(0, 9);
  });

  it('never leaves the box its two ends make, inflated by the reach', () => {
    // The invariant getRouteBBox culls a view by. Ends facing away are the
    // ones that push a control point outside that box, so each is tried both
    // ways round and against an end that faces the other axis.
    const ends: Array<[Point, Point, Point, Point]> = [
      [{ x: 0, y: 0 }, RIGHT, { x: 400, y: 120 }, LEFT],
      [{ x: 0, y: 0 }, LEFT, { x: 400, y: 120 }, RIGHT],
      [{ x: 0, y: 0 }, RIGHT, { x: -400, y: -120 }, LEFT],
      [{ x: 0, y: 0 }, DOWN, { x: 40, y: -900 }, DOWN],
      [{ x: 0, y: 0 }, UP, { x: -900, y: 40 }, RIGHT],
      [{ x: 7, y: 7 }, RIGHT, { x: 7, y: 7 }, UP],
    ];

    for (const [from, fromOutward, to, toOutward] of ends) {
      const reach = curveReach(
        Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))
      );
      const left = Math.min(from.x, to.x) - reach - SLOP;
      const right = Math.max(from.x, to.x) + reach + SLOP;
      const top = Math.min(from.y, to.y) - reach - SLOP;
      const bottom = Math.max(from.y, to.y) + reach + SLOP;

      for (const point of bezierPolyline(from, fromOutward, to, toOutward)) {
        expect(point.x).toBeGreaterThanOrEqual(left);
        expect(point.x).toBeLessThanOrEqual(right);
        expect(point.y).toBeGreaterThanOrEqual(top);
        expect(point.y).toBeLessThanOrEqual(bottom);
      }
    }
  });

  it('takes a segment count of its own, and never fewer than one', () => {
    expect(
      bezierPolyline({ x: 0, y: 0 }, RIGHT, { x: 100, y: 50 }, LEFT, 4)
    ).toHaveLength(5);
    expect(
      bezierPolyline({ x: 0, y: 0 }, RIGHT, { x: 100, y: 50 }, LEFT, 0)
    ).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ]);
  });
});
