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
});
