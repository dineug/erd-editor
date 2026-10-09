import { describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import { Relationship } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { PathPoint, ROUTE_CORNER_RADIUS } from '@/utils/draw-relationship';
import { VIEW_BEZIER_SEGMENTS } from '@/utils/draw-relationship/bezier';
import { ROUTE_CORNER_SEGMENTS } from '@/utils/draw-relationship/corner';
import { LOOP_SEGMENTS } from '@/utils/draw-relationship/loop';
import {
  getRelationshipPath,
  toPathD,
} from '@/utils/draw-relationship/pathFinding';

type Point = { tableId: string; x: number; y: number; direction: number };

function relationship(start: Point, end: Point): Relationship {
  return createRelationship({ id: 'rel', start, end });
}

type Segments = ReturnType<PathPoint['d']>;
type ScenePoint = Segments[number][number];

/** Both ends of a corner's arc and every chord point between them. */
const ARC_POINTS = ROUTE_CORNER_SEGMENTS + 1;

const pointsOf = (segments: Segments): ScenePoint[] => [
  segments[0][0],
  ...segments.map(([, to]) => to),
];

/**
 * The points lying on the quarter circle a corner turns on: a radius from its
 * centre and no further than that from the corner, so an arc bulging the wrong
 * way finds none of its middle.
 */
const onArc = (points: ScenePoint[], centre: ScenePoint, corner: ScenePoint) =>
  points.filter(
    point =>
      Math.abs(
        Math.hypot(point.x - centre.x, point.y - centre.y) - ROUTE_CORNER_RADIUS
      ) < 1e-6 &&
      Math.hypot(point.x - corner.x, point.y - corner.y) <=
        ROUTE_CORNER_RADIUS + 1e-6
  );

describe('getRelationshipPath', () => {
  describe('start right -> end left (horizontal)', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 100, y: 50, direction: Direction.right },
        { tableId: 'B', x: 400, y: 50, direction: Direction.left }
      )
    );

    it('pushes the path end points out by PATH_END_HEIGHT on the x axis', () => {
      expect(path.path.M).toEqual({ x: 124, y: 50 });
      expect(path.path.L).toEqual({ x: 376, y: 50 });
      expect(path.path.Q).toEqual({ x: 0, y: 0 });
    });

    it('pushes the path guide line out by PATH_LINE_HEIGHT', () => {
      expect(path.line.start).toEqual({ x1: 121, y1: 50, x2: 124, y2: 50 });
      expect(path.line.end).toEqual({ x1: 379, y1: 50, x2: 376, y2: 50 });
    });

    it('draws one straight run when the two anchors line up', () => {
      expect(path.path.d()).toEqual([
        [
          { x: 124, y: 50 },
          { x: 376, y: 50 },
        ],
      ]);
    });

    it('lays out the start decoration lines horizontally', () => {
      expect(line.line.start.base).toEqual({
        x1: 109,
        y1: 44,
        x2: 109,
        y2: 56,
      });
      expect(line.line.start.base2).toEqual({
        x1: 115,
        y1: 44,
        x2: 115,
        y2: 56,
      });
      expect(line.line.start.center).toEqual({
        x1: 109,
        y1: 50,
        x2: 100,
        y2: 50,
      });
      expect(line.line.start.center2).toEqual({
        x1: 121,
        y1: 50,
        x2: 100,
        y2: 50,
      });
      expect(line.startCircle).toEqual({ cx: 115, cy: 50 });
    });

    it('lays out the end decoration lines horizontally', () => {
      expect(line.line.end.base).toEqual({ x1: 391, y1: 44, x2: 391, y2: 56 });
      expect(line.line.end.base2).toEqual({ x1: 385, y1: 44, x2: 385, y2: 56 });
      expect(line.line.end.left).toEqual({ x1: 391, y1: 50, x2: 400, y2: 56 });
      expect(line.line.end.right).toEqual({ x1: 391, y1: 50, x2: 400, y2: 44 });
      expect(line.line.end.center).toEqual({
        x1: 391,
        y1: 50,
        x2: 400,
        y2: 50,
      });
      expect(line.line.end.center2).toEqual({
        x1: 379,
        y1: 50,
        x2: 400,
        y2: 50,
      });
      expect(line.circle).toEqual({ cx: 385, cy: 50 });
    });
  });

  describe('start bottom -> end top (vertical)', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 100, y: 100, direction: Direction.bottom },
        { tableId: 'B', x: 300, y: 500, direction: Direction.top }
      )
    );

    it('pushes the path end points out on the y axis', () => {
      expect(path.path.M).toEqual({ x: 100, y: 124 });
      expect(path.path.L).toEqual({ x: 300, y: 476 });
      expect(path.line.start).toEqual({ x1: 100, y1: 121, x2: 100, y2: 124 });
      expect(path.line.end).toEqual({ x1: 300, y1: 479, x2: 300, y2: 476 });
    });

    it('turns at right angles on the y axis, on rounded corners', () => {
      // Two turns at the midpoint, each a quarter circle of ROUTE_CORNER_RADIUS
      // that leaves one run along it and joins the next the same way.
      const segments = path.path.d();
      const points = pointsOf(segments);

      expect(segments[0]).toEqual([
        { x: 100, y: 124 },
        { x: 100, y: 292 },
      ]);
      expect(segments).toContainEqual([
        { x: 108, y: 300 },
        { x: 292, y: 300 },
      ]);
      expect(segments[segments.length - 1]).toEqual([
        { x: 300, y: 308 },
        { x: 300, y: 476 },
      ]);
      expect(
        onArc(points, { x: 108, y: 292 }, { x: 100, y: 300 })
      ).toHaveLength(ARC_POINTS);
      expect(
        onArc(points, { x: 292, y: 308 }, { x: 300, y: 300 })
      ).toHaveLength(ARC_POINTS);
    });

    it('lays out the start decoration lines vertically', () => {
      expect(line.line.start.base).toEqual({
        x1: 94,
        y1: 109,
        x2: 106,
        y2: 109,
      });
      expect(line.line.start.base2).toEqual({
        x1: 94,
        y1: 115,
        x2: 106,
        y2: 115,
      });
      expect(line.line.start.center).toEqual({
        x1: 100,
        y1: 109,
        x2: 100,
        y2: 100,
      });
      expect(line.line.start.center2).toEqual({
        x1: 100,
        y1: 121,
        x2: 100,
        y2: 100,
      });
      expect(line.startCircle).toEqual({ cx: 100, cy: 115 });
    });

    it('lays out the end decoration lines vertically', () => {
      expect(line.line.end.base).toEqual({
        x1: 294,
        y1: 491,
        x2: 306,
        y2: 491,
      });
      expect(line.line.end.base2).toEqual({
        x1: 294,
        y1: 485,
        x2: 306,
        y2: 485,
      });
      expect(line.line.end.left).toEqual({
        x1: 300,
        y1: 491,
        x2: 306,
        y2: 500,
      });
      expect(line.line.end.right).toEqual({
        x1: 300,
        y1: 491,
        x2: 294,
        y2: 500,
      });
      expect(line.line.end.center).toEqual({
        x1: 300,
        y1: 491,
        x2: 300,
        y2: 500,
      });
      expect(line.line.end.center2).toEqual({
        x1: 300,
        y1: 479,
        x2: 300,
        y2: 500,
      });
      expect(line.circle).toEqual({ cx: 300, cy: 485 });
    });
  });

  describe('start left -> end right with an offset on both axes', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 500, y: 200, direction: Direction.left },
        { tableId: 'B', x: 100, y: 260, direction: Direction.right }
      )
    );

    it('crosses on the x axis at the midpoint, on rounded corners', () => {
      const segments = path.path.d();
      const points = pointsOf(segments);

      expect(path.path.M).toEqual({ x: 476, y: 200 });
      expect(path.path.L).toEqual({ x: 124, y: 260 });
      expect(segments[0]).toEqual([
        { x: 476, y: 200 },
        { x: 308, y: 200 },
      ]);
      expect(segments).toContainEqual([
        { x: 300, y: 208 },
        { x: 300, y: 252 },
      ]);
      expect(segments[segments.length - 1]).toEqual([
        { x: 292, y: 260 },
        { x: 124, y: 260 },
      ]);
      expect(
        onArc(points, { x: 308, y: 208 }, { x: 300, y: 200 })
      ).toHaveLength(ARC_POINTS);
      expect(
        onArc(points, { x: 292, y: 252 }, { x: 300, y: 260 })
      ).toHaveLength(ARC_POINTS);
    });

    it('mirrors the decoration lines for the inverted directions', () => {
      expect(line.line.start.center).toEqual({
        x1: 491,
        y1: 200,
        x2: 500,
        y2: 200,
      });
      expect(line.line.start.center2).toEqual({
        x1: 479,
        y1: 200,
        x2: 500,
        y2: 200,
      });
      expect(line.line.end.left).toEqual({
        x1: 109,
        y1: 260,
        x2: 100,
        y2: 266,
      });
      expect(line.line.end.right).toEqual({
        x1: 109,
        y1: 260,
        x2: 100,
        y2: 254,
      });
      expect(line.startCircle).toEqual({ cx: 485, cy: 200 });
      expect(line.circle).toEqual({ cx: 115, cy: 260 });
    });
  });

  describe('start top -> end bottom (inverted vertical)', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 200, y: 400, direction: Direction.top },
        { tableId: 'B', x: 200, y: 100, direction: Direction.bottom }
      )
    );

    it('draws one straight run when the two anchors share an x', () => {
      expect(path.path.M).toEqual({ x: 200, y: 376 });
      expect(path.path.L).toEqual({ x: 200, y: 124 });
      expect(path.path.d()).toEqual([
        [
          { x: 200, y: 376 },
          { x: 200, y: 124 },
        ],
      ]);
    });

    it('flips the end decoration lines downwards', () => {
      expect(line.line.end.base).toEqual({
        x1: 194,
        y1: 109,
        x2: 206,
        y2: 109,
      });
      expect(line.line.end.base2).toEqual({
        x1: 194,
        y1: 115,
        x2: 206,
        y2: 115,
      });
      expect(line.line.end.left).toEqual({
        x1: 200,
        y1: 109,
        x2: 206,
        y2: 100,
      });
      expect(line.line.end.right).toEqual({
        x1: 200,
        y1: 109,
        x2: 194,
        y2: 100,
      });
      expect(line.line.end.center2).toEqual({
        x1: 200,
        y1: 121,
        x2: 200,
        y2: 100,
      });
      expect(line.startCircle).toEqual({ cx: 200, cy: 385 });
      expect(line.circle).toEqual({ cx: 200, cy: 115 });
    });
  });

  describe('self relationship', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 98, y: 0, direction: Direction.top },
        { tableId: 'A', x: 118, y: 20, direction: Direction.right }
      )
    );

    it('curves from one turning point to the other, leaving each straight out', () => {
      const segments = path.path.d();
      const [first] = segments;
      const last = segments[segments.length - 1];

      expect(path.path.M).toEqual({ x: 98, y: -24 });
      expect(path.path.L).toEqual({ x: 142, y: 20 });
      expect(segments).toHaveLength(LOOP_SEGMENTS);
      expect(first[0]).toEqual(path.path.M);
      expect(last[1]).toEqual(path.path.L);
      // Up out of the top anchor's stub, and in along the right one's.
      expect(first[1].y).toBeLessThan(first[0].y);
      expect(Math.abs(first[1].x - first[0].x)).toBeLessThan(
        Math.abs(first[1].y - first[0].y)
      );
      expect(last[1].x).toBeLessThan(last[0].x);
      expect(Math.abs(last[1].y - last[0].y)).toBeLessThan(
        Math.abs(last[1].x - last[0].x)
      );
    });

    it('still lays out both decoration ends', () => {
      expect(path.line.start).toEqual({ x1: 98, y1: -21, x2: 98, y2: -24 });
      expect(path.line.end).toEqual({ x1: 139, y1: 20, x2: 142, y2: 20 });
      expect(line.line.start.base).toEqual({
        x1: 92,
        y1: -9,
        x2: 104,
        y2: -9,
      });
      expect(line.line.start.center2).toEqual({
        x1: 98,
        y1: -21,
        x2: 98,
        y2: 0,
      });
      expect(line.line.end.base).toEqual({ x1: 127, y1: 14, x2: 127, y2: 26 });
      expect(line.line.end.center2).toEqual({
        x1: 139,
        y1: 20,
        x2: 118,
        y2: 20,
      });
      expect(line.startCircle).toEqual({ cx: 98, cy: -15 });
      expect(line.circle).toEqual({ cx: 133, cy: 20 });
    });

    /** A loop whose anchors sit offset from the corner of a table ending at (118, 0). */
    const loop = (offset: number) =>
      getRelationshipPath(
        relationship(
          { tableId: 'A', x: 118 - offset, y: 0, direction: Direction.top },
          { tableId: 'A', x: 118, y: offset, direction: Direction.right }
        )
      ).path.path.d();

    /** How far a point lies from the table, the quarter below and left of the corner. */
    const clearOfTable = ({ x, y }: ScenePoint) =>
      x > 118 ? (y < 0 ? Math.hypot(x - 118, y) : x - 118) : -y;

    it.each([20, 38, 56, 74, 92])(
      'keeps a loop %ipx from the corner clear of the table',
      offset => {
        for (const point of pointsOf(loop(offset))) {
          expect(clearOfTable(point)).toBeGreaterThanOrEqual(12);
        }
      }
    );

    it.each([
      [20, 38],
      [38, 56],
      [56, 74],
    ])(
      'nests the loop %ipx from the corner inside the one %ipx out',
      (inner, outer) => {
        const cross = (
          [a, b]: [ScenePoint, ScenePoint],
          [c, d]: [ScenePoint, ScenePoint]
        ) => {
          const side = (p: ScenePoint, q: ScenePoint, r: ScenePoint) =>
            Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
          return (
            side(a, b, c) * side(a, b, d) < 0 &&
            side(c, d, a) * side(c, d, b) < 0
          );
        };

        for (const segment of loop(inner)) {
          for (const other of loop(outer)) {
            expect(cross(segment, other)).toBe(false);
          }
        }
      }
    );
  });

  describe('unknown direction', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 100, y: 50, direction: 0 },
        { tableId: 'B', x: 400, y: 90, direction: 0 }
      )
    );

    it('leaves the anchors at the origin', () => {
      expect(path.path.M).toEqual({ x: 0, y: 0 });
      expect(path.path.L).toEqual({ x: 0, y: 0 });
      expect(path.path.d()).toEqual([
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      ]);
    });

    it('leaves the guide and decoration lines untouched', () => {
      expect(path.line.start).toEqual({ x1: 100, y1: 50, x2: 100, y2: 50 });
      expect(path.line.end).toEqual({ x1: 400, y1: 90, x2: 400, y2: 90 });
      expect(line.line.start.base).toEqual({
        x1: 100,
        y1: 50,
        x2: 100,
        y2: 50,
      });
      expect(line.line.end.base).toEqual({ x1: 400, y1: 90, x2: 400, y2: 90 });
      expect(line.startCircle).toEqual({ cx: 100, cy: 50 });
      expect(line.circle).toEqual({ cx: 400, cy: 90 });
    });
  });
});

describe('toPathD', () => {
  it('writes one move and a line per segment', () => {
    expect(
      toPathD([
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        [
          { x: 10, y: 0 },
          { x: 10, y: 20 },
        ],
      ])
    ).toBe('M0 0L10 0L10 20');
  });

  it('rounds each coordinate to two decimals', () => {
    expect(
      toPathD([
        [
          { x: 1 / 3, y: 2 / 3 },
          { x: 10.005, y: 4.994 },
        ],
      ])
    ).toBe('M0.33 0.67L10.01 4.99');
  });

  it('draws nothing when there is no segment', () => {
    expect(toPathD([])).toBe('');
  });
});

describe('the corner each source turns (AC-28, AC-29)', () => {
  const relationship = () =>
    createRelationship({
      id: 'rel',
      start: { tableId: 'A', x: 100, y: 100, direction: Direction.bottom },
      end: { tableId: 'B', x: 300, y: 500, direction: Direction.top },
    });

  const pathOf = (source: 'document' | 'flow') =>
    getRelationshipPath(relationship(), source).path.path.d();

  /** The widest turn between two neighbouring segments, in degrees. */
  const sharpestTurn = (segments: ReturnType<typeof pathOf>) => {
    const heading = segments.map(([from, to]) =>
      Math.atan2(to.y - from.y, to.x - from.x)
    );
    let widest = 0;
    for (let index = 1; index < heading.length; index++) {
      let turn = heading[index] - heading[index - 1];
      if (turn > Math.PI) turn -= 2 * Math.PI;
      if (turn < -Math.PI) turn += 2 * Math.PI;
      widest = Math.max(widest, Math.abs((turn * 180) / Math.PI));
    }
    return widest;
  };

  it('rounds the document corners and spends the whole view run on one curve', () => {
    const document = pathOf('document');
    const flow = pathOf('flow');

    // Three straight runs and the chords of two rounded corners.
    expect(document).toHaveLength(3 + 2 * ROUTE_CORNER_SEGMENTS);
    expect(flow).toHaveLength(VIEW_BEZIER_SEGMENTS);
    expect(flow[0][0]).toEqual(document[0][0]);
    expect(flow[flow.length - 1][1]).toEqual(document[document.length - 1][1]);
  });

  it('turns the document corner in even steps of a quarter circle, and the view too', () => {
    expect(sharpestTurn(pathOf('document'))).toBeCloseTo(
      90 / ROUTE_CORNER_SEGMENTS,
      6
    );
    expect(sharpestTurn(pathOf('flow'))).toBeCloseTo(6.041, 3);
  });

  it('leaves the straight line between the two ends, which is what a curve is', () => {
    const flow = pathOf('flow');
    const [from] = flow[0];
    const to = flow[flow.length - 1][1];
    const run = { x: to.x - from.x, y: to.y - from.y };
    const length = Math.hypot(run.x, run.y);

    const widest = flow.reduce((furthest, [point]) => {
      const away =
        Math.abs((point.x - from.x) * run.y - (point.y - from.y) * run.x) /
        length;
      return Math.max(furthest, away);
    }, 0);

    expect(widest).toBeCloseTo(25.095, 3);
  });
});
