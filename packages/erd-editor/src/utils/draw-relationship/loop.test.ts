import { describe, expect, it } from 'vite-plus/test';

import { Point } from '@/internal-types';
import { PATH_END_HEIGHT } from '@/utils/draw-relationship';
import {
  LOOP_CURVATURE,
  LOOP_SEGMENTS,
  LOOP_STUB_RATIO,
  loopOffset,
  loopPolyline,
  loopReach,
  loopStub,
} from '@/utils/draw-relationship/loop';

/** A loop whose anchors sit offset from the top-right corner of a table at (0, 0). */
const anchors = (offset: number): [Point, Point] => [
  { x: -offset, y: 0 },
  { x: 0, y: offset },
];

const UP = { x: 0, y: -1 };
const RIGHT = { x: 1, y: 0 };

/** The loop drawn between its two turning points, as the path finder draws it. */
const loop = (offset: number) => {
  const [start, end] = anchors(offset);
  const stub = loopStub(start, end);

  return loopPolyline(
    { x: start.x, y: start.y - stub },
    UP,
    { x: end.x + stub, y: end.y },
    RIGHT,
    loopOffset(start, end)
  );
};

describe('loop geometry', () => {
  it('reads the offset along either side of the corner', () => {
    expect(loopOffset(...anchors(38))).toBe(38);
    expect(loopOffset({ x: 0, y: 0 }, { x: 0, y: 50 })).toBe(50);
  });

  it('runs the first loop out on the stub every other connector starts at', () => {
    expect(loopStub(...anchors(20))).toBe(PATH_END_HEIGHT);
    expect(loopStub(...anchors(38))).toBeCloseTo(38 * LOOP_STUB_RATIO, 9);
  });

  it('reaches as far as the stub and the control point together', () => {
    expect(loopReach(...anchors(20))).toBeCloseTo(
      20 * (LOOP_STUB_RATIO + LOOP_CURVATURE),
      9
    );
  });

  it('starts and ends on the turning points, leaving each along its stub', () => {
    const points = loop(20);
    const [first, second] = points;
    const [beforeLast, last] = points.slice(-2);

    expect(points).toHaveLength(LOOP_SEGMENTS + 1);
    expect(first).toEqual({ x: -20, y: -24 });
    expect(last).toEqual({ x: 24, y: 20 });
    expect(Math.abs(second.x - first.x)).toBeLessThan(first.y - second.y);
    expect(Math.abs(last.y - beforeLast.y)).toBeLessThan(beforeLast.x - last.x);
  });

  it('is one shape at every size, scaled about the corner', () => {
    const small = loop(20);
    const large = loop(56);

    small.forEach((point, index) => {
      expect(large[index].x).toBeCloseTo((point.x * 56) / 20, 9);
      expect(large[index].y).toBeCloseTo((point.y * 56) / 20, 9);
    });
  });

  it('stays clear of the table, more so the larger the loop', () => {
    const clearance = (offset: number) =>
      Math.min(
        ...loop(offset).map(({ x, y }) =>
          x > 0 ? (y < 0 ? Math.hypot(x, y) : x) : -y
        )
      );

    expect(clearance(20)).toBeGreaterThan(12);
    expect(clearance(56)).toBeGreaterThan(clearance(20));
  });
});
