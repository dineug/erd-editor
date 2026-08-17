import { describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import { Point } from '@/internal-types';
import {
  countBlocked,
  type Obstacles,
  routeOrthogonal,
  segmentHitsBox,
} from '@/utils/draw-relationship/route';

function obstacles(
  boxes: Array<{
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>
): Obstacles {
  return {
    ids: boxes.map(box => box.id),
    left: Float64Array.from(boxes.map(box => box.left)),
    top: Float64Array.from(boxes.map(box => box.top)),
    right: Float64Array.from(boxes.map(box => box.right)),
    bottom: Float64Array.from(boxes.map(box => box.bottom)),
  };
}

const NONE = obstacles([]);

/** Every segment of an orthogonal polyline runs along exactly one axis. */
function isOrthogonal(points: Point[]) {
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const horizontal = Math.abs(a.y - b.y) < 0.5;
    const vertical = Math.abs(a.x - b.x) < 0.5;
    if (horizontal === vertical) return false;
  }
  return true;
}

describe('segmentHitsBox', () => {
  it('finds a segment crossing the box', () => {
    expect(segmentHitsBox(0, 50, 200, 50, 40, 0, 160, 100)).toBe(true);
  });

  it('ignores a segment passing outside it', () => {
    expect(segmentHitsBox(0, 200, 200, 200, 40, 0, 160, 100)).toBe(false);
  });

  it('ignores a segment that stops short of it', () => {
    expect(segmentHitsBox(0, 50, 30, 50, 40, 0, 160, 100)).toBe(false);
  });
});

describe('countBlocked', () => {
  it('does not count the two tables the relationship connects', () => {
    const boxes = obstacles([
      { id: 'a', left: 0, top: 0, right: 100, bottom: 100 },
      { id: 'b', left: 200, top: 0, right: 300, bottom: 100 },
      { id: 'c', left: 120, top: 0, right: 180, bottom: 100 },
    ]);
    const line: Point[] = [
      { x: 50, y: 50 },
      { x: 250, y: 50 },
    ];

    expect(countBlocked(line, boxes, 'a', 'b')).toBe(1);
    expect(countBlocked(line, boxes, 'a', 'c')).toBe(1);
  });

  it('counts a table once however many segments cross it', () => {
    const boxes = obstacles([
      { id: 'c', left: 0, top: 0, right: 100, bottom: 100 },
    ]);
    const zigzag: Point[] = [
      { x: -50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 80 },
      { x: -50, y: 80 },
    ];

    expect(countBlocked(zigzag, boxes, 'a', 'b')).toBe(1);
  });

  it('agrees with an unfiltered count over random scenes', () => {
    // `countBlocked` skips whole tables using the polyline's bounding box. The
    // saving is real — it is the router's hot function — but it is only allowed
    // if it never changes an answer, which a handful of hand-picked cases
    // cannot show. This is the same count without any of the skipping.
    const naive = (
      points: Point[],
      boxes: Obstacles,
      skipA: string,
      skipB: string
    ) => {
      let count = 0;
      for (let index = 0; index < boxes.ids.length; index++) {
        const id = boxes.ids[index];
        if (id === skipA || id === skipB) continue;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1];
          const b = points[i];
          if (
            segmentHitsBox(
              a.x,
              a.y,
              b.x,
              b.y,
              boxes.left[index],
              boxes.top[index],
              boxes.right[index],
              boxes.bottom[index]
            )
          ) {
            count++;
            break;
          }
        }
      }
      return count;
    };

    // Fixed seed: a benchmark that only reproduces sometimes is not a
    // benchmark, and neither is a test.
    let seed = 0x9e3779b9;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    // Deliberately tight: the boxes have to sit close enough together that
    // routes graze their edges, or every scene rejects trivially and the test
    // exercises nothing.
    const coordinate = () => Math.round(random() * 400) - 200;

    for (let scene = 0; scene < 400; scene++) {
      const boxes = obstacles(
        Array.from({ length: 6 }, (_, index) => {
          const x = coordinate();
          const y = coordinate();
          return {
            id: `t${index}`,
            left: x,
            top: y,
            right: x + Math.round(random() * 120) + 10,
            bottom: y + Math.round(random() * 120) + 10,
          };
        })
      );
      const points: Point[] = Array.from(
        { length: 2 + Math.floor(random() * 4) },
        () => ({ x: coordinate(), y: coordinate() })
      );
      const skipA = `t${Math.floor(random() * 8)}`;
      const skipB = `t${Math.floor(random() * 8)}`;

      expect(countBlocked(points, boxes, skipA, skipB)).toBe(
        naive(points, boxes, skipA, skipB)
      );
    }
  });
});

describe('routeOrthogonal', () => {
  const leftFacing = { x: 100, y: 100 };
  const rightFacing = { x: 500, y: 300 };

  it('produces an axis-aligned polyline between the two turning points', () => {
    const points = routeOrthogonal(
      leftFacing,
      Direction.right,
      rightFacing,
      Direction.left,
      NONE,
      'a',
      'b'
    );

    expect(points[0]).toEqual(leftFacing);
    expect(points[points.length - 1]).toEqual(rightFacing);
    expect(isOrthogonal(points)).toBe(true);
  });

  it('leaves and arrives heading away from each table', () => {
    // Anything else doubles back through the guide line that carries the
    // cardinality symbols.
    const points = routeOrthogonal(
      leftFacing,
      Direction.right,
      rightFacing,
      Direction.left,
      NONE,
      'a',
      'b'
    );

    expect(points[1].x).toBeGreaterThanOrEqual(leftFacing.x);
    expect(points[points.length - 2].x).toBeLessThanOrEqual(rightFacing.x);
  });

  it('goes around a table standing between the two ends', () => {
    const between = obstacles([
      { id: 'c', left: 250, top: 0, right: 350, bottom: 260 },
    ]);
    const points = routeOrthogonal(
      leftFacing,
      Direction.right,
      rightFacing,
      Direction.left,
      between,
      'a',
      'b'
    );

    expect(countBlocked(points, between, 'a', 'b')).toBe(0);
    expect(isOrthogonal(points)).toBe(true);
  });

  it('still returns a polyline when every route is blocked', () => {
    const walled = obstacles([
      { id: 'c', left: 120, top: -5000, right: 480, bottom: 5000 },
    ]);
    const points = routeOrthogonal(
      leftFacing,
      Direction.right,
      rightFacing,
      Direction.left,
      walled,
      'a',
      'b'
    );

    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points[0]).toEqual(leftFacing);
    expect(points[points.length - 1]).toEqual(rightFacing);
  });

  it('joins two ends that face different axes with a single bend when it can', () => {
    // The end turning point is above its anchor, so a route arriving from above
    // carries straight on into the guide line. Were it below (`bottom`), the
    // same corner would arrive and immediately reverse, and the router takes
    // three bends instead.
    const points = routeOrthogonal(
      { x: 100, y: 100 },
      Direction.right,
      { x: 400, y: 300 },
      Direction.top,
      NONE,
      'a',
      'b'
    );

    expect(points).toEqual([
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 300 },
    ]);
  });
});
