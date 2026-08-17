import { describe, expect, it } from 'vite-plus/test';

import { Point } from '@/internal-types';
import { chamferPolyline } from '@/utils/draw-relationship/chamfer';

const line = (...pairs: Array<[number, number]>): Point[] =>
  pairs.map(([x, y]) => ({ x, y }));

const pairs = (points: Point[]): Array<[number, number]> =>
  points.map(point => [point.x, point.y]);

describe('chamferPolyline', () => {
  it('cuts a corner back by the given distance either side', () => {
    const cut = chamferPolyline(line([0, 0], [100, 0], [100, 100]), 8);

    expect(pairs(cut)).toEqual([
      [0, 0],
      [92, 0],
      [100, 8],
      [100, 100],
    ]);
  });

  it('never takes more than half a run, so two corners cannot cross', () => {
    // The middle run is 20 long: an 8px cut either end would leave 4, but each
    // corner is limited to half of the shorter run it touches.
    const cut = chamferPolyline(
      line([0, 0], [100, 0], [100, 20], [200, 20]),
      40
    );

    expect(pairs(cut)).toEqual([
      [0, 0],
      [90, 0],
      [100, 10],
      [110, 20],
      [200, 20],
    ]);
  });

  it('merges a staircase into one diagonal when the cuts meet', () => {
    // Middle run of 16, cut 8 either side: both cuts land on its midpoint, and
    // the two diagonals join there instead of straddling a segment of nothing.
    const cut = chamferPolyline(
      line([0, 0], [100, 0], [100, 16], [200, 16]),
      8
    );

    expect(pairs(cut)).toEqual([
      [0, 0],
      [92, 0],
      [100, 8],
      [108, 16],
      [200, 16],
    ]);
  });

  it('keeps the right angle when the cut would be a smudge', () => {
    const cut = chamferPolyline(line([0, 0], [100, 0], [100, 3]), 8);

    expect(pairs(cut)).toEqual([
      [0, 0],
      [100, 0],
      [100, 3],
    ]);
  });

  it('leaves the two ends where they were', () => {
    const points = line([10, 20], [200, 20], [200, 300], [400, 300]);
    const cut = chamferPolyline(points, 8);

    expect(cut[0]).toEqual({ x: 10, y: 20 });
    expect(cut[cut.length - 1]).toEqual({ x: 400, y: 300 });
  });

  it('passes through a polyline with no corner to cut', () => {
    expect(pairs(chamferPolyline(line([0, 0], [100, 0]), 8))).toEqual([
      [0, 0],
      [100, 0],
    ]);
    expect(chamferPolyline([], 8)).toEqual([]);
  });

  it('leaves a point that continues in the same direction alone', () => {
    expect(pairs(chamferPolyline(line([0, 0], [50, 0], [100, 0]), 8))).toEqual([
      [0, 0],
      [50, 0],
      [100, 0],
    ]);
  });

  it('does nothing when there is no distance to cut with', () => {
    const points = line([0, 0], [100, 0], [100, 100]);
    expect(chamferPolyline(points, 0)).toBe(points);
  });
});
