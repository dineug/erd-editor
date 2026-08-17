import { describe, expect, it } from 'vite-plus/test';

import { Point } from '@/internal-types';
import { nudgeRoutes } from '@/utils/draw-relationship/nudge';
import { countBlocked, type Obstacles } from '@/utils/draw-relationship/route';

/**
 * Random scenes over the invariants the nudge pass has to hold whatever it is
 * handed. The hand-written cases in `nudge.test.ts` each pin one decision; these
 * catch the ones no scene was written for — a rounding that only shows up at some
 * coordinates, a lane that folds a connector nobody thought to build.
 *
 * Every route here is the staircase `routeOrthogonal` emits most often, and every
 * channel is drawn from a band a few pixels wide, so a scene is a bundle of runs
 * that all have to be pulled apart at once.
 */

/** mulberry32 — the generator the routing benchmark uses, for the same reason. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Scene = {
  routes: Array<[string, Point[]]>;
  obstacles: Obstacles;
  endpoints: Map<string, [string, string]>;
};

/** Three bars across the middle, so some lanes are unavailable. */
const OBSTACLES: Obstacles = {
  ids: ['b0', 'b1', 'b2'],
  left: new Float64Array([140, 60, 200]),
  top: new Float64Array([120, 240, 300]),
  right: new Float64Array([200, 120, 260]),
  bottom: new Float64Array([160, 280, 340]),
};

function scene(seed: number): Scene {
  const random = prng(seed);
  const pick = (bound: number) => Math.floor(random() * bound);

  const routes: Array<[string, Point[]]> = [];
  const endpoints = new Map<string, [string, string]>();
  const count = 4 + pick(9);
  const band = 1 + pick(6);

  for (let index = 0; index < count; index++) {
    const id = `r${index}`;
    // Every leg is a whole number of pixels long and no leg is empty: the anchor
    // end sits left of the band, and the near end above where the run turns.
    const startX = pick(10) * 10;
    const startY = pick(19) * 10;
    const channel = 100 + pick(8) * band;
    const turnY = 200 + pick(20) * 10;
    const endX = 300 + pick(20) * 10;

    routes.push([
      id,
      [
        { x: startX, y: startY },
        { x: channel, y: startY },
        { x: channel, y: turnY },
        { x: endX, y: turnY },
      ],
    ]);
    endpoints.set(id, [`t${index}`, `t${index + count}`]);
  }

  return { routes, obstacles: OBSTACLES, endpoints };
}

const clone = (routes: Scene['routes']): Scene['routes'] =>
  routes.map(([id, points]) => [id, points.map(point => ({ ...point }))]);

const fingerprint = (routes: Scene['routes']) =>
  routes
    .map(
      ([id, points]) =>
        `${id}:${points.map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(' ')}`
    )
    .sort()
    .join('|');

const isOrthogonal = (points: Point[]) =>
  points.every((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    const flat = Math.abs(point.y - previous.y) < 0.5;
    const upright = Math.abs(point.x - previous.x) < 0.5;
    return flat !== upright;
  });

const blockedTotal = (routes: Scene['routes'], scene: Scene) =>
  routes.reduce((total, [id, points]) => {
    const pair = scene.endpoints.get(id);
    return (
      total +
      countBlocked(points, scene.obstacles, pair?.[0] ?? '', pair?.[1] ?? '')
    );
  }, 0);

const SEEDS = 400;

describe('nudgeRoutes over random bundles', () => {
  it('gives the same drawing whatever order the routes arrive in', () => {
    // The replication-store worker and every peer iterate their own way round the
    // document; a tie broken by iteration order would put a different picture in
    // the file each time it is saved.
    const differed: string[] = [];

    for (let seed = 1; seed <= SEEDS; seed++) {
      const base = scene(seed);
      const random = prng(seed * 7919);

      const forward = clone(base.routes);
      nudgeRoutes(new Map(forward), base.obstacles, base.endpoints);
      const expected = fingerprint(forward);

      const shuffled = clone(base.routes);
      for (let index = shuffled.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
      }
      nudgeRoutes(new Map(shuffled), base.obstacles, base.endpoints);

      if (fingerprint(shuffled) !== expected) differed.push(`seed ${seed}`);
    }

    expect(differed).toEqual([]);
  });

  it('keeps the anchors, the right angles and the penetration count', () => {
    const anchorMoved: string[] = [];
    const diagonal: string[] = [];
    const blockedWorse: string[] = [];
    // A route may only leave its anchor outward, which is what routeOrthogonal
    // enforces when it enumerates candidates. A lane on the other side of the
    // turning point sends the run back over the guide line the cardinality
    // symbols are drawn on, and nothing else here can see that: the fold stays
    // orthogonal, collapses nothing, and misses every foreign table.
    const folded: string[] = [];
    const direction = (points: Point[], index: number) => {
      const a = points[index];
      const b = points[index + 1];
      return Math.abs(a.x - b.x) < 0.5
        ? Math.sign(b.y - a.y)
        : Math.sign(b.x - a.x);
    };

    for (let seed = 1; seed <= SEEDS; seed++) {
      const base = scene(seed);
      const after = clone(base.routes);
      const blockedBefore = blockedTotal(base.routes, base);

      nudgeRoutes(new Map(after), base.obstacles, base.endpoints);

      after.forEach(([id, points], index) => {
        const before = base.routes[index][1];
        const last = points.length - 1;
        if (
          points[0].x !== before[0].x ||
          points[0].y !== before[0].y ||
          points[last].x !== before[last].x ||
          points[last].y !== before[last].y
        ) {
          anchorMoved.push(`seed ${seed} ${id}`);
        }
        if (!isOrthogonal(points)) diagonal.push(`seed ${seed} ${id}`);
        if (
          direction(points, 0) !== direction(before, 0) ||
          direction(points, last - 1) !== direction(before, last - 1)
        ) {
          folded.push(`seed ${seed} ${id}`);
        }
      });

      const blockedAfter = blockedTotal(after, base);
      if (blockedAfter > blockedBefore) {
        blockedWorse.push(`seed ${seed}: ${blockedBefore} -> ${blockedAfter}`);
      }
    }

    expect({ anchorMoved, diagonal, blockedWorse, folded }).toEqual({
      anchorMoved: [],
      diagonal: [],
      blockedWorse: [],
      folded: [],
    });
  });
});
