import { describe, expect, it } from 'vite-plus/test';

import { Point } from '@/internal-types';
import { nudgeRoutes } from '@/utils/draw-relationship/nudge';
import { type Obstacles } from '@/utils/draw-relationship/route';

const NO_OBSTACLES: Obstacles = {
  ids: [],
  left: new Float64Array(0),
  top: new Float64Array(0),
  right: new Float64Array(0),
  bottom: new Float64Array(0),
};

const line = (...pairs: Array<[number, number]>): Point[] =>
  pairs.map(([x, y]) => ({ x, y }));

/** `[id, left, top, right, bottom]` per table, already inset. */
const boxes = (
  ...rects: Array<[string, number, number, number, number]>
): Obstacles => ({
  ids: rects.map(([id]) => id),
  left: new Float64Array(rects.map(([, left]) => left)),
  top: new Float64Array(rects.map(([, , top]) => top)),
  right: new Float64Array(rects.map(([, , , right]) => right)),
  bottom: new Float64Array(rects.map(([, , , , bottom]) => bottom)),
});

/** Every segment axis-aligned and none collapsed to a point. */
const isOrthogonal = (points: Point[]) =>
  points.every((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    const flat = Math.abs(point.y - previous.y) < 0.5;
    const upright = Math.abs(point.x - previous.x) < 0.5;
    return flat !== upright;
  });

/** Whether a polyline runs across itself — a fold no length check can see. */
const selfCrosses = (points: Point[]) => {
  for (let i = 0; i + 1 < points.length; i++) {
    for (let j = i + 2; j + 1 < points.length; j++) {
      const upright = Math.abs(points[i].x - points[i + 1].x) < 0.5;
      const otherUpright = Math.abs(points[j].x - points[j + 1].x) < 0.5;
      if (upright === otherUpright) continue;

      const [v1, v2, h1, h2] = upright
        ? [points[i], points[i + 1], points[j], points[j + 1]]
        : [points[j], points[j + 1], points[i], points[i + 1]];
      if (
        v1.x > Math.min(h1.x, h2.x) &&
        v1.x < Math.max(h1.x, h2.x) &&
        h1.y > Math.min(v1.y, v2.y) &&
        h1.y < Math.max(v1.y, v2.y)
      ) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Total length two connectors run within 3px of each other, over every segment
 * drawn — the same question `e2e/bench/geometry.ts` asks of a real scene, and
 * the one the tests below would otherwise only ask of the two or three
 * coordinates each was written around.
 *
 * The band is not `RELATIONSHIP_STROKE_WIDTH`. It is the separation these cases
 * are written around: the pairs below start 2px and 3px apart, and a band as
 * narrow as the connector is drawn would score them clear before the pass had
 * moved anything.
 */
const bandOverlap = (routes: Record<string, Point[]>, band = 3) => {
  type Run = {
    id: string;
    upright: boolean;
    at: number;
    low: number;
    high: number;
  };
  const runs: Run[] = [];

  for (const [id, points] of Object.entries(routes)) {
    for (let index = 0; index + 1 < points.length; index++) {
      const a = points[index];
      const b = points[index + 1];
      const upright = Math.abs(a.x - b.x) < 0.5;
      const flat = Math.abs(a.y - b.y) < 0.5;
      if (upright === flat) continue;

      runs.push({
        id,
        upright,
        at: upright ? a.x : a.y,
        low: upright ? Math.min(a.y, b.y) : Math.min(a.x, b.x),
        high: upright ? Math.max(a.y, b.y) : Math.max(a.x, b.x),
      });
    }
  }

  let total = 0;
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i];
      const b = runs[j];
      if (a.id === b.id || a.upright !== b.upright) continue;
      if (Math.abs(a.at - b.at) >= band) continue;
      total += Math.max(0, Math.min(a.high, b.high) - Math.max(a.low, b.low));
    }
  }
  return total;
};

describe('nudgeRoutes', () => {
  it('separates two routes that picked the same horizontal channel', () => {
    // Taken from a benchmark run: both routes chose the lane at y = 771 and
    // were drawn on top of each other for 748px.
    const a = line(
      [1336, 797],
      [1352, 797],
      [1352, 771],
      [2518, 771],
      [2518, 777],
      [2534, 777]
    );
    const b = line(
      [1754, 551],
      [1770, 551],
      [1770, 771],
      [2943, 771],
      [2943, 1109],
      [2959, 1109]
    );

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      NO_OBSTACLES,
      new Map([
        ['a', ['t18', 't22']],
        ['b', ['t11', 't31']],
      ])
    );

    expect(a[2].y).not.toBe(b[2].y);
    expect(a[2].y).toBe(a[3].y);
    expect(b[2].y).toBe(b[3].y);
    expect(bandOverlap({ a, b })).toBe(0);
  });

  it('separates two channels two pixels apart', () => {
    // The worst pair of the small benchmark corpus: two vertical runs at x = 920
    // and x = 922, which a channel keyed on the rounded coordinate filed apart
    // and never considered.
    const a = line([1296, 488], [920, 488], [920, 936], [543, 936]);
    const b = line([555, 1011], [922, 1011], [922, 562], [1308, 562]);

    nudgeRoutes(
      new Map([
        ['r7', a],
        ['r17', b],
      ]),
      NO_OBSTACLES,
      new Map([
        ['r7', ['t7', 't8']],
        ['r17', ['t8', 't7']],
      ])
    );

    expect(Math.abs(a[1].x - b[1].x)).toBeGreaterThanOrEqual(10);
    expect(a[1].x).toBe(a[2].x);
    expect(b[1].x).toBe(b[2].x);
    expect(bandOverlap({ a, b })).toBe(0);
  });

  it('spreads a chain of near-coincident channels evenly', () => {
    // 0-3-6 is one bundle even though no two share a coordinate: a reader sees
    // three lines within one band, not three channels. The lanes are
    // centred on the mean of the three, not on whichever the sort put first.
    const a = line([0, 0], [0, 100], [300, 100], [300, 400]);
    const b = line([10, 0], [10, 103], [310, 103], [310, 400]);
    const c = line([20, 0], [20, 106], [320, 106], [320, 400]);

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
        ['c', c],
      ]),
      NO_OBSTACLES,
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t2', 't3']],
        ['c', ['t4', 't5']],
      ])
    );

    expect([a[1].y, b[1].y, c[1].y]).toEqual([93, 103, 113]);
    expect(bandOverlap({ a, b, c })).toBe(0);
  });

  it('gives a chain of segments two lanes rather than one each', () => {
    // Each of these only reaches its neighbour, so the run is a chain and not a
    // bundle: two lanes clear every overlapping pair. A lane each would splay the
    // outer two 30px apart to fix overlaps that 5px of movement covers, and every
    // pixel of that is paid in crossings and length.
    const a = line([0, 0], [100, 0], [100, 40], [200, 40]);
    const b = line([0, 30], [100, 30], [100, 80], [200, 80]);
    const c = line([0, 70], [100, 70], [100, 120], [200, 120]);
    const d = line([0, 110], [100, 110], [100, 160], [200, 160]);

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
        ['c', c],
        ['d', d],
      ]),
      NO_OBSTACLES,
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t2', 't3']],
        ['c', ['t4', 't5']],
        ['d', ['t6', 't7']],
      ])
    );

    expect([a[1].x, b[1].x, c[1].x, d[1].x]).toEqual([95, 105, 95, 105]);
    expect(bandOverlap({ a, b, c, d })).toBe(0);
  });

  it('does not leave a chain of staircases more doubled up than it found it', () => {
    // Four escape-shaped routes whose upright runs form chains rather than
    // bundles. Choosing the compact layout because it came first in the list —
    // rather than because it moved the group least — added overlap here: its
    // longer jumps stretch the runs attached to an anchor, which this pass cannot
    // move and the other axis has already finished with.
    const routes = {
      r0: line(
        [30, 10],
        [105, 10],
        [105, 180],
        [100, 180],
        [100, 380],
        [400, 380]
      ),
      r1: line(
        [20, 90],
        [115, 90],
        [115, 200],
        [122, 200],
        [122, 360],
        [390, 360]
      ),
      r2: line(
        [50, 0],
        [130, 0],
        [130, 140],
        [136, 140],
        [136, 320],
        [340, 320]
      ),
      r3: line(
        [60, 10],
        [100, 10],
        [100, 200],
        [105, 200],
        [105, 320],
        [490, 320]
      ),
    };
    const before = bandOverlap(routes);

    nudgeRoutes(
      new Map(Object.entries(routes)),
      NO_OBSTACLES,
      new Map([
        ['r0', ['t0', 't1']],
        ['r1', ['t2', 't3']],
        ['r2', ['t4', 't5']],
        ['r3', ['t6', 't7']],
      ])
    );

    expect(bandOverlap(routes)).toBeLessThanOrEqual(before);
  });

  it('leaves a bundle the router already spaced alone', () => {
    // Proximity collects these into one channel, but they are a gap apart
    // already. Re-laning them would reorder a legible bundle for nothing.
    const a = line([0, 0], [0, 100], [300, 100], [300, 400]);
    const b = line([10, 0], [10, 110], [310, 110], [310, 400]);

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      NO_OBSTACLES,
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t2', 't3']],
      ])
    );

    expect([a[1].y, b[1].y]).toEqual([100, 110]);
  });

  it('leaves channels further apart than a gap alone', () => {
    const a = line([0, 0], [0, 100], [300, 100], [300, 400]);
    const b = line([10, 0], [10, 130], [310, 130], [310, 400]);

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      NO_OBSTACLES,
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t2', 't3']],
      ])
    );

    expect([a[1].y, b[1].y]).toEqual([100, 130]);
  });

  it('leaves segments on the same line that never overlap alone', () => {
    const a = line([0, 0], [0, 100], [200, 100], [200, 200]);
    const b = line([600, 0], [600, 100], [800, 100], [800, 200]);
    const before = [a[1].y, b[1].y];

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      NO_OBSTACLES,
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t2', 't3']],
      ])
    );

    expect([a[1].y, b[1].y]).toEqual(before);
  });

  it('narrows the separation when the wide lanes run into a table', () => {
    // Two bars leave a corridor 5px either side of the shared channel, so the
    // preferred lanes and the middle rung of the ladder are both blocked. The
    // segments belong in the narrowest lanes rather than back on one line.
    const a = line([0, 0], [0, 100], [200, 100], [200, 300]);
    const b = line([10, 0], [10, 101], [210, 101], [210, 300]);

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      boxes(['above', 50, 94, 150, 97.5], ['below', 50, 103.5, 150, 107]),
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t2', 't3']],
      ])
    );

    expect(Math.abs(a[1].y - b[1].y)).toBe(4);
    expect(a[1].y).toBe(a[2].y);
    expect(b[1].y).toBe(b[2].y);
  });

  it('separates on the narrowest rung whatever fraction the channel sits on', () => {
    // The same corridor a third of a pixel up the canvas. Lanes are built as
    // `first + index * gap`, so the narrowest rung lands 3.999999999999982 apart
    // — measured against the rung itself the placement reads as a failure and the
    // group is abandoned on the coordinate it started on.
    const third = 1 / 3;
    const a = line([0, 0], [0, 126 + third], [200, 126 + third], [200, 300]);
    const b = line([10, 0], [10, 127 + third], [210, 127 + third], [210, 300]);

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      boxes(
        ['above', 50, 118 + third, 150, 124 + third],
        ['below', 50, 130 + third, 150, 134 + third]
      ),
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t2', 't3']],
      ])
    );

    expect(Math.abs(a[1].y - b[1].y)).toBeCloseTo(4, 6);
    expect(bandOverlap({ a, b })).toBe(0);
  });

  it('leaves a group alone when no separation clears it', () => {
    // The bars close to a 3px corridor, so every lane of every rung runs into
    // one. Moving a segment that stays as overlapped as it started buys nothing
    // and costs a crossing, so the router's coordinates stand.
    const a = line([0, 0], [0, 100], [200, 100], [200, 300]);
    const b = line([10, 0], [10, 101], [210, 101], [210, 300]);

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      boxes(['above', 50, 90, 150, 99], ['below', 50, 102, 150, 112]),
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t2', 't3']],
      ])
    );

    expect([a[1].y, b[1].y]).toEqual([100, 101]);
  });

  it('separates two parallel runs of one connector without folding it', () => {
    // The escape route leaves both anchors on the same axis and comes back, so
    // its two upright runs can land within one band of each other. The
    // lanes are handed out in entry order, which here swaps them — and one of
    // the two ways round walks the connector across itself.
    const u = line(
      [100, 50],
      [116, 50],
      [116, 20],
      [118, 20],
      [118, 60],
      [102, 60]
    );

    nudgeRoutes(
      new Map([['u', u]]),
      NO_OBSTACLES,
      new Map([['u', ['t0', 't1']]])
    );

    expect([u[1].x, u[3].x]).toEqual([112, 122]);
    expect(u[0]).toEqual({ x: 100, y: 50 });
    expect(u[5]).toEqual({ x: 102, y: 60 });
    expect(isOrthogonal(u)).toBe(true);
    expect(selfCrosses(u)).toBe(false);
  });

  it('keeps the run leaving an anchor from collapsing onto it', () => {
    // The lane this connector's first upright run would prefer sits exactly on
    // the point it starts from, which would fold the flat run before it to
    // nothing. It takes the other lane, six pixels away rather than ten.
    const u = line(
      [100, 20],
      [104, 20],
      [104, 50],
      [106, 50],
      [106, -10],
      [102, -10]
    );

    nudgeRoutes(
      new Map([['u', u]]),
      NO_OBSTACLES,
      new Map([['u', ['t0', 't1']]])
    );

    expect([u[1].x, u[3].x]).toEqual([104, 110]);
    expect(isOrthogonal(u)).toBe(true);
  });

  it('never moves the segments attached to an anchor', () => {
    const a = line([0, 0], [0, 100], [200, 100], [200, 200]);
    const b = line([0, 0], [0, 100], [300, 100], [300, 200]);

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
      ]),
      NO_OBSTACLES,
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t0', 't2']],
      ])
    );

    expect(a[0]).toEqual({ x: 0, y: 0 });
    expect(b[0]).toEqual({ x: 0, y: 0 });
    expect(a[a.length - 1]).toEqual({ x: 200, y: 200 });
    expect(b[b.length - 1]).toEqual({ x: 300, y: 200 });
  });

  it('re-reads how far a segment runs between the two axis passes', () => {
    // Separating the upright bundle at x = 100..106 stretches `a`'s flat run
    // leftwards. Read from the extent collected before that, the flat run looks
    // like it starts at x = 100 and misses `c` entirely, and both stay on y = 100.
    const a = line([0, 200], [100, 200], [100, 100], [300, 100], [300, 0]);
    const b = line([0, 300], [102, 300], [102, 150], [400, 150]);
    const d = line([0, 320], [104, 320], [104, 160], [420, 160]);
    const e = line([0, 340], [106, 340], [106, 170], [440, 170]);
    const c = line([60, 400], [60, 100], [99, 100], [99, -500]);

    nudgeRoutes(
      new Map([
        ['a', a],
        ['b', b],
        ['d', d],
        ['e', e],
        ['c', c],
      ]),
      NO_OBSTACLES,
      new Map([
        ['a', ['t0', 't1']],
        ['b', ['t2', 't3']],
        ['d', ['t4', 't5']],
        ['e', ['t6', 't7']],
        ['c', ['t8', 't9']],
      ])
    );

    expect(a[2].y).not.toBe(c[2].y);
  });

  it('does not depend on the order the routes are given in', () => {
    const build = () =>
      [
        line([0, 0], [0, 100], [300, 100], [300, 400]),
        line([10, 0], [10, 103], [310, 103], [310, 400]),
        line([20, 0], [20, 106], [320, 106], [320, 400]),
      ] as const;

    const endpoints = new Map<string, [string, string]>([
      ['a', ['t0', 't1']],
      ['b', ['t2', 't3']],
      ['c', ['t4', 't5']],
    ]);

    const forward = build();
    nudgeRoutes(
      new Map([
        ['a', forward[0]],
        ['b', forward[1]],
        ['c', forward[2]],
      ]),
      NO_OBSTACLES,
      endpoints
    );

    const reversed = build();
    nudgeRoutes(
      new Map([
        ['c', reversed[2]],
        ['b', reversed[1]],
        ['a', reversed[0]],
      ]),
      NO_OBSTACLES,
      endpoints
    );

    expect(forward.map(points => points[1].y)).toEqual(
      reversed.map(points => points[1].y)
    );
  });

  it('gives the same lane to the same connector when every key ties', () => {
    // Three routes on one coordinate, over one span, entered from one place:
    // coordinate, span and entry all tie, so only the identifier decides which
    // lane each takes. Without that last key the answer follows insertion order,
    // and a peer or the replication-store worker iterating differently draws a
    // different picture of the same document.
    const build = () => ({
      r1: line([0, 0], [0, 100], [300, 100], [300, 400]),
      r2: line([0, 0], [0, 100], [300, 100], [300, 400]),
      r3: line([0, 0], [0, 100], [300, 100], [300, 400]),
    });

    const endpoints = new Map<string, [string, string]>([
      ['r1', ['t0', 't1']],
      ['r2', ['t0', 't1']],
      ['r3', ['t0', 't1']],
    ]);

    const forward = build();
    nudgeRoutes(
      new Map([
        ['r1', forward.r1],
        ['r2', forward.r2],
        ['r3', forward.r3],
      ]),
      NO_OBSTACLES,
      endpoints
    );

    const reversed = build();
    nudgeRoutes(
      new Map([
        ['r3', reversed.r3],
        ['r2', reversed.r2],
        ['r1', reversed.r1],
      ]),
      NO_OBSTACLES,
      endpoints
    );

    expect([forward.r1[1].y, forward.r2[1].y, forward.r3[1].y]).toEqual([
      reversed.r1[1].y,
      reversed.r2[1].y,
      reversed.r3[1].y,
    ]);
  });
});
