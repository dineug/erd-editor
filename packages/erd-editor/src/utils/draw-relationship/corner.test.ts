import { describe, expect, it } from 'vite-plus/test';

import { Point } from '@/internal-types';
import {
  roundPolyline,
  ROUTE_CORNER_SEGMENTS,
} from '@/utils/draw-relationship/corner';

const line = (...pairs: Array<[number, number]>): Point[] =>
  pairs.map(([x, y]) => ({ x, y }));

const pairs = (points: Point[]): Array<[number, number]> =>
  points.map(point => [point.x, point.y]);

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

describe('roundPolyline', () => {
  it('turns a corner on a quarter circle of the given radius', () => {
    const rounded = roundPolyline(line([0, 0], [100, 0], [100, 100]), 8);
    const arc = rounded.slice(1, -1);

    expect(rounded[0]).toEqual({ x: 0, y: 0 });
    expect(rounded[rounded.length - 1]).toEqual({ x: 100, y: 100 });
    expect(arc).toHaveLength(ROUTE_CORNER_SEGMENTS + 1);
    expect(arc[0]).toEqual({ x: 92, y: 0 });
    expect(arc[arc.length - 1]).toEqual({ x: 100, y: 8 });
    for (const point of arc) {
      expect(distance(point, { x: 92, y: 8 })).toBeCloseTo(8, 6);
    }
  });

  it('leaves each run along the run, so the turn has no kink', () => {
    const rounded = roundPolyline(line([0, 0], [100, 0], [100, 100]), 8);
    const [, from, second] = rounded;
    const [penultimate, to] = rounded.slice(-3, -1);

    // The first chord is the arc's own start: steeper than the run would be a
    // corner, and its slope shrinks to nothing as the chords grow in number.
    expect(Math.abs(second.y - from.y)).toBeLessThan(
      Math.abs(second.x - from.x)
    );
    expect(Math.abs(to.x - penultimate.x)).toBeLessThan(
      Math.abs(to.y - penultimate.y)
    );
  });

  it('keeps every chord within a tenth of a pixel of the arc at full zoom', () => {
    const rounded = roundPolyline(line([0, 0], [100, 0], [100, 100]), 8);
    const arc = rounded.slice(1, -1);

    for (let index = 1; index < arc.length; index++) {
      const middle = {
        x: (arc[index - 1].x + arc[index].x) / 2,
        y: (arc[index - 1].y + arc[index].y) / 2,
      };
      expect(8 - distance(middle, { x: 92, y: 8 })).toBeLessThan(0.07);
    }
  });

  it('stays inside the box the corner already spans', () => {
    const points = line([0, 0], [100, 0], [100, 100]);
    for (const point of roundPolyline(points, 8)) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(100);
    }
  });

  // Every way into a corner and every way out of it: the arc starts and ends a
  // radius along each run and bulges towards the corner it replaces.
  const headings: Array<[string, number, number]> = [
    ['right', 1, 0],
    ['left', -1, 0],
    ['down', 0, 1],
    ['up', 0, -1],
  ];
  const turns = headings.flatMap(([inName, inX, inY]) =>
    headings
      .filter(([, outX, outY]) => inX * outX + inY * outY === 0)
      .map(([outName, outX, outY]) => ({
        name: `${inName} then ${outName}`,
        into: { x: inX, y: inY },
        out: { x: outX, y: outY },
      }))
  );

  it.each(turns)('turns $name on a quarter circle', ({ into, out }) => {
    const corner = { x: 100, y: 100 };
    const rounded = roundPolyline(
      [
        { x: corner.x - into.x * 100, y: corner.y - into.y * 100 },
        corner,
        { x: corner.x + out.x * 100, y: corner.y + out.y * 100 },
      ],
      8
    );
    const arc = rounded.slice(1, -1);
    const centre = {
      x: corner.x - into.x * 8 + out.x * 8,
      y: corner.y - into.y * 8 + out.y * 8,
    };

    expect(turns).toHaveLength(8);
    expect(arc[0]).toEqual({
      x: corner.x - into.x * 8,
      y: corner.y - into.y * 8,
    });
    expect(arc[arc.length - 1]).toEqual({
      x: corner.x + out.x * 8,
      y: corner.y + out.y * 8,
    });
    for (const point of arc) {
      expect(distance(point, centre)).toBeCloseTo(8, 6);
      expect(distance(point, corner)).toBeLessThanOrEqual(8);
    }
  });

  it('turns a small corner in one chord per pixel of radius, dropping none', () => {
    // The runs either side are 6 long, so the corner takes a radius of 3.
    const rounded = roundPolyline(line([0, 0], [6, 0], [6, 6]), 8);
    const arc = rounded.slice(1, -1);

    expect(arc).toHaveLength(3 + 1);
    expect(arc[0]).toEqual({ x: 3, y: 0 });
    expect(arc[arc.length - 1]).toEqual({ x: 6, y: 3 });
    for (const point of arc) {
      expect(distance(point, { x: 3, y: 3 })).toBeCloseTo(3, 6);
    }
  });

  it('never takes more than half a run, so two corners cannot cross', () => {
    // The middle run is 20 long: each corner is limited to half of the shorter
    // run it touches, so both arcs take a radius of 10 and meet in its middle.
    const rounded = roundPolyline(
      line([0, 0], [100, 0], [100, 20], [200, 20]),
      40
    );

    expect(rounded[1]).toEqual({ x: 90, y: 0 });
    expect(rounded[rounded.length - 2]).toEqual({ x: 110, y: 20 });
    expect(
      rounded.filter(point => point.x === 100 && point.y === 10)
    ).toHaveLength(1);
    expect(rounded).toHaveLength(2 + (ROUTE_CORNER_SEGMENTS + 1) * 2 - 1);
  });

  it('joins a staircase into one S when the two arcs meet', () => {
    // Middle run of 16, radius 8 either side: both arcs reach its midpoint,
    // and they join there instead of straddling a segment of nothing.
    const rounded = roundPolyline(
      line([0, 0], [100, 0], [100, 16], [200, 16]),
      8
    );

    expect(
      rounded.filter(point => point.x === 100 && point.y === 8)
    ).toHaveLength(1);
    for (let index = 1; index < rounded.length; index++) {
      expect(distance(rounded[index - 1], rounded[index])).toBeGreaterThan(0.5);
    }
  });

  it('keeps the right angle when the curve would be a smudge', () => {
    const rounded = roundPolyline(line([0, 0], [100, 0], [100, 3]), 8);

    expect(pairs(rounded)).toEqual([
      [0, 0],
      [100, 0],
      [100, 3],
    ]);
  });

  it('leaves the two ends where they were', () => {
    const points = line([10, 20], [200, 20], [200, 300], [400, 300]);
    const rounded = roundPolyline(points, 8);

    expect(rounded[0]).toEqual({ x: 10, y: 20 });
    expect(rounded[rounded.length - 1]).toEqual({ x: 400, y: 300 });
  });

  it('passes through a polyline with no corner to round', () => {
    expect(pairs(roundPolyline(line([0, 0], [100, 0]), 8))).toEqual([
      [0, 0],
      [100, 0],
    ]);
    expect(roundPolyline([], 8)).toEqual([]);
  });

  it('leaves a point that continues in the same direction alone', () => {
    expect(pairs(roundPolyline(line([0, 0], [50, 0], [100, 0]), 8))).toEqual([
      [0, 0],
      [50, 0],
      [100, 0],
    ]);
  });

  it('does nothing when there is no radius to turn on', () => {
    const points = line([0, 0], [100, 0], [100, 100]);
    expect(roundPolyline(points, 0)).toBe(points);
  });
});
