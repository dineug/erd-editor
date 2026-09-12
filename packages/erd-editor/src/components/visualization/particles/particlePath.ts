import type { Point } from '@/internal-types';

/** How many particles ride one lit connector at a time, as liam draws them. */
export const PARTICLE_COUNT = 6;

/** How long one particle takes from the PK end to the FK end, in milliseconds. */
export const ANIMATE_DURATION = 6_000;

/**
 * How long after the one before it each particle leaves the PK end: one
 * second, which over six particles fills the six second run, so a connector
 * carries all six evenly spaced at every moment rather than a bunch that thins out.
 */
export const PARTICLE_INTERVAL = ANIMATE_DURATION / PARTICLE_COUNT;

/**
 * The most lit connectors a view animates. Past it the particles stay off and
 * only the fade and the highlight remain, since six circles on each of more
 * connectors than this is more than a frame has room for.
 */
export const PARTICLE_EDGE_MAX = 60;

/** The radius of one particle in scene units, so it scales with the connector it rides. */
export const PARTICLE_RADIUS = 4;

/** A polyline with the distance along it each point sits at, so a distance names a point on it. */
export type MeasuredPath = {
  points: Point[];
  /** How far along the path each point is: zero for the first, the length for the last. */
  distances: number[];
  length: number;
};

/** Copies the polyline and measures it, so the path handed back shares nothing with the caller. */
export function measurePath(points: Point[]): MeasuredPath {
  const copied = points.map(({ x, y }) => ({ x, y }));
  const distances: number[] = [];
  let length = 0;

  copied.forEach((point, index) => {
    if (index > 0) {
      const before = copied[index - 1];
      length += Math.hypot(point.x - before.x, point.y - before.y);
    }
    distances.push(length);
  });

  return { points: copied, distances, length };
}

/**
 * The point so far along the path from its first point. A distance past
 * either end lands on that end, and a zero-length run between two points
 * hands back the first of them rather than dividing by nothing.
 */
export function pointAlong(path: MeasuredPath, distance: number): Point {
  const { points, distances, length } = path;
  if (!points.length) return { x: 0, y: 0 };

  const at = Math.min(Math.max(distance, 0), length);
  let index = 1;
  while (index < points.length && distances[index] < at) index++;
  if (index >= points.length) {
    const { x, y } = points[points.length - 1];
    return { x, y };
  }

  const from = points[index - 1];
  const to = points[index];
  const run = distances[index] - distances[index - 1];
  const ratio = run > 0 ? (at - distances[index - 1]) / run : 0;

  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

/**
 * How far along a connector each of its particles is at a moment: the first
 * leaves the PK end at zero, each next one an interval later, and every one
 * runs the whole length in a period and starts over, so the six stay evenly spread.
 */
export function particlePhase(elapsedMs: number, edgeLength: number): number[] {
  const distances: number[] = [];

  for (let index = 0; index < PARTICLE_COUNT; index++) {
    const since = elapsedMs - index * PARTICLE_INTERVAL;
    const cycle =
      ((since % ANIMATE_DURATION) + ANIMATE_DURATION) % ANIMATE_DURATION;

    distances.push((cycle / ANIMATE_DURATION) * edgeLength);
  }

  return distances;
}
