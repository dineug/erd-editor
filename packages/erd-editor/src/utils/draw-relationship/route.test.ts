import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import { createEditor, ViewKind } from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import {
  collectObstacles,
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
    // countBlocked skips whole tables using the polyline's bounding box, which
    // is only allowed if it never changes an answer. This is the same count
    // without any of the skipping.
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

  it('picks the same lane between two tied ones whatever order the tables come in', () => {
    // The lanes clear of c1 and c2 sit 70 either side of the midpoint, which c3
    // blocks, so the two routes cost the same. Peers and an undone removal hold
    // the tables in different orders, and both have to draw this one route.
    const c1 = { id: 'c1', left: 400, top: 150, right: 481, bottom: 250 };
    const c2 = { id: 'c2', left: 653, top: 150, right: 720, bottom: 250 };
    const c3 = { id: 'c3', left: 500, top: 150, right: 634, bottom: 250 };
    const route = (boxes: Obstacles) =>
      routeOrthogonal(
        { x: 300, y: 100 },
        Direction.right,
        { x: 834, y: 300 },
        Direction.left,
        boxes,
        'a',
        'b'
      );

    const forward = route(obstacles([c1, c2, c3]));
    const backward = route(obstacles([c2, c1, c3]));

    expect(forward).toEqual(backward);
    expect(forward[1]).toEqual({ x: 497, y: 100 });
  });

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

  it('joins two ends facing the same way through one shared channel', () => {
    // Two tables drawn over each other, both connected from their bottoms. A
    // step out of each end and back made a staircase of four bends.
    const points = routeOrthogonal(
      { x: 67, y: 54 },
      Direction.bottom,
      { x: 77, y: 64 },
      Direction.bottom,
      NONE,
      'a',
      'b'
    );

    expect(points).toEqual([
      { x: 67, y: 54 },
      { x: 67, y: 80 },
      { x: 77, y: 80 },
      { x: 77, y: 64 },
    ]);
  });

  it('joins two ends facing the same way sideways too', () => {
    const points = routeOrthogonal(
      { x: 54, y: 67 },
      Direction.left,
      { x: 64, y: 77 },
      Direction.left,
      NONE,
      'a',
      'b'
    );

    expect(points).toEqual([
      { x: 54, y: 67 },
      { x: 38, y: 67 },
      { x: 38, y: 77 },
      { x: 64, y: 77 },
    ]);
  });

  it('turns across the gap between two facing tables too close to step out of', () => {
    // 36 apart and 30 out of line, so each 24 stub reaches past the other
    // table's edge, and a step out of either end ran inside the other table.
    const points = routeOrthogonal(
      { x: 124, y: 50 },
      Direction.right,
      { x: 112, y: 80 },
      Direction.left,
      NONE,
      'a',
      'b'
    );

    expect(points).toEqual([
      { x: 124, y: 50 },
      { x: 118, y: 50 },
      { x: 118, y: 80 },
      { x: 112, y: 80 },
    ]);
  });

  it('turns across the gap between two facing tables above each other', () => {
    const points = routeOrthogonal(
      { x: 50, y: 124 },
      Direction.bottom,
      { x: 80, y: 112 },
      Direction.top,
      NONE,
      'a',
      'b'
    );

    expect(points).toEqual([
      { x: 50, y: 124 },
      { x: 50, y: 118 },
      { x: 80, y: 118 },
      { x: 80, y: 112 },
    ]);
  });

  it('keeps stepping out of two facing tables a step apart or more', () => {
    // 44 apart, a step out of each end still lands in the gap, and the S it
    // draws there keeps both corners clear of the markers.
    const points = routeOrthogonal(
      { x: 124, y: 50 },
      Direction.right,
      { x: 120, y: 80 },
      Direction.left,
      NONE,
      'a',
      'b'
    );

    expect(points).toHaveLength(6);
    expect(points[1]).toEqual({ x: 140, y: 50 });
  });

  it('steps out of a side when no lane lies outward of it', () => {
    // A 134 x 30 table at the origin and one 60 up and 80 right of it: every
    // lane the router knows sits behind the right-facing end, so it used to
    // fall back to a route that ran 5.5 back over that end's markers.
    const boxes = obstacles([
      { id: 'a', left: 2, top: 2, right: 132, bottom: 28 },
      { id: 'b', left: 82, top: -58, right: 212, bottom: -32 },
    ]);

    const points = routeOrthogonal(
      { x: 158, y: 15 },
      Direction.right,
      { x: 147, y: -6 },
      Direction.bottom,
      boxes,
      'a',
      'b'
    );

    expect(points).toEqual([
      { x: 158, y: 15 },
      { x: 174, y: 15 },
      { x: 174, y: 4.5 },
      { x: 147, y: 4.5 },
      { x: 147, y: -6 },
    ]);
  });

  it('keeps the two-bend route when it turns back less than the stub clears', () => {
    // Two pixels back over a 24 stub still ends past the 21 the markers take.
    const boxes = obstacles([
      { id: 'a', left: 2, top: 2, right: 132, bottom: 28 },
      { id: 'b', left: 89, top: -58, right: 219, bottom: -32 },
    ]);

    const points = routeOrthogonal(
      { x: 158, y: 15 },
      Direction.right,
      { x: 154, y: -6 },
      Direction.bottom,
      boxes,
      'a',
      'b'
    );

    expect(points).toEqual([
      { x: 158, y: 15 },
      { x: 156, y: 15 },
      { x: 156, y: -6 },
      { x: 154, y: -6 },
    ]);
  });

  it('steps out of a top or bottom side the same way', () => {
    // The same layout turned a quarter, so the start leaves downwards.
    const boxes = obstacles([
      { id: 'a', left: 2, top: 2, right: 28, bottom: 132 },
      { id: 'b', left: -58, top: 82, right: -32, bottom: 212 },
    ]);

    const points = routeOrthogonal(
      { x: 15, y: 158 },
      Direction.bottom,
      { x: -6, y: 147 },
      Direction.right,
      boxes,
      'a',
      'b'
    );

    expect(points).toEqual([
      { x: 15, y: 158 },
      { x: 15, y: 174 },
      { x: 4.5, y: 174 },
      { x: 4.5, y: 147 },
      { x: -6, y: 147 },
    ]);
  });

  it('joins two ends that face different axes with a single bend when it can', () => {
    // The end turning point is above its anchor, so a route arriving from above
    // carries straight on into the guide line. Below, the same corner would
    // reverse on arrival and the router takes three bends instead.
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

/** Two connected tables and a third on its own, at 134 x 30 each with nothing shown. */
function createScene(): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;

  for (const [id, x, y] of [
    ['A', 0, 0],
    ['B', 400, 0],
    ['C', 900, 900],
  ] as const) {
    state.collections.tableEntities[id] = createTable({ id, ui: { x, y } });
    state.doc.tableIds.push(id);
  }
  state.collections.relationshipEntities.ab = createRelationship({
    id: 'ab',
    start: { tableId: 'A' },
    end: { tableId: 'B' },
  });
  state.doc.relationshipIds.push('ab');

  return state;
}

describe('collectObstacles', () => {
  it('reads every document table by default, inset by two', () => {
    const state = createScene();

    const obstacles = collectObstacles(state);

    expect(obstacles.ids).toEqual(['A', 'B', 'C']);
    expect(Array.from(obstacles.left)).toEqual([2, 402, 902]);
    expect(Array.from(obstacles.right)).toEqual([132, 532, 1032]);
    expect(Array.from(obstacles.bottom)).toEqual([28, 28, 928]);
    expect(obstacles).toEqual(collectObstacles(state, 'document'));
  });

  it('reads the tables a view shows, where the view places them', () => {
    const state = createScene();
    const view = createSceneView(ViewKind.flow, ['A']);
    view.positions = { A: { x: 5_000, y: -3_000 }, B: { x: 5_600, y: -3_000 } };
    state.editor.views.flow = view;

    const obstacles = collectObstacles(state, 'flow');

    // C has no connector to A and is not in the view, so nothing routes around it.
    expect(obstacles.ids).toEqual(['A', 'B']);
    expect(Array.from(obstacles.left)).toEqual([5_002, 5_602]);
    expect(Array.from(obstacles.top)).toEqual([-2_998, -2_998]);
    expect(collectObstacles(state).ids).toEqual(['A', 'B', 'C']);
  });

  it('reads no table for a view while none is open', () => {
    const state = createScene();

    expect(collectObstacles(state, 'flow').ids).toEqual([]);
  });
});
