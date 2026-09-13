import type { Point } from '@/internal-types';
import { VIEW_BEZIER_SEGMENTS } from '@/utils/draw-relationship/bezier';

/** How many particles ride one lit connector at a time, as the reference draws them. */
export const PARTICLE_COUNT = 6;

/** How long one particle takes from the PK end to the FK end, in milliseconds. */
export const ANIMATE_DURATION = 6_000;

/**
 * How long after the one before it each particle leaves the PK end: one
 * second, which over six particles fills the six second run, so a connector
 * carries all six at every moment rather than a bunch that thins out.
 */
export const PARTICLE_INTERVAL = ANIMATE_DURATION / PARTICLE_COUNT;

/**
 * The most lit connectors a view animates. Past it the particles stay off and
 * only the fade and the highlight remain, since six circles on each of more
 * connectors than this is more than a frame has room for.
 */
export const PARTICLE_EDGE_MAX = 60;

/** How long one particle is along the run it rides, in scene units. */
export const PARTICLE_RX = 5;

/** How thick it is across that run, which is what makes the circle an elongated blur. */
export const PARTICLE_RY = 1.2;

/** How opaque the far edge of a particle's gradient is, against 1 at its centre. */
export const PARTICLE_EDGE_ALPHA = 0.4;

/**
 * How far either side of a point the direction is measured over, as a fraction
 * of the whole run, guide lines included: about one chord of the curve, so a
 * window spans a bend and the angle turns through it rather than stepping.
 */
export const TANGENT_WINDOW = 1 / VIEW_BEZIER_SEGMENTS;

/** Under this two points are one place, to the geometry every reader here works to. */
const COINCIDENT = 1e-9;

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
 * runs the whole length in a period and starts over, easing in and out of it.
 */
export function particlePhase(elapsedMs: number, edgeLength: number): number[] {
  const distances: number[] = [];

  for (let index = 0; index < PARTICLE_COUNT; index++) {
    const since = elapsedMs - index * PARTICLE_INTERVAL;
    const cycle =
      ((since % ANIMATE_DURATION) + ANIMATE_DURATION) % ANIMATE_DURATION;

    distances.push(easeInOut(cycle / ANIMATE_DURATION) * edgeLength);
  }

  return distances;
}

/**
 * Which way the path runs at a distance along it, in degrees, so a particle
 * lies along the run it rides. Measured between the points a window either
 * side of it, never off the one chord it sits in, which steps at every bend.
 */
export function tangentAt(path: MeasuredPath, distance: number): number {
  const reach = path.length * TANGENT_WINDOW;
  const before = pointAlong(path, distance - reach);
  const after = pointAlong(path, distance + reach);
  const angle = runAngle(before, after);

  // Both samples on one place is a path that doubles back inside the window.
  // The run the distance sits in still has a direction, and a pure function
  // has no frame before this one to carry an answer over from.
  return angle === null ? runAngleAt(path, distance) : angle;
}

/**
 * The gradient one particle is filled with: its colour at the centre, the same
 * colour at a fraction of its opacity at the edge. Handed to the node whole,
 * so the loop that moves circles sets attributes and computes nothing.
 */
export function particleGradient(fill: string) {
  return {
    fill,
    fillPriority: 'radial-gradient',
    fillRadialGradientStartPoint: { x: 0, y: 0 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientEndRadius: PARTICLE_RY,
    fillRadialGradientColorStops: [
      0,
      fill,
      1,
      withAlpha(fill, PARTICLE_EDGE_ALPHA),
    ],
  };
}

/**
 * The same colour carrying an alpha channel. Every palette token reaching here
 * is a six digit hex, and a colour in any other spelling is handed back as it
 * came rather than mangled into one the canvas would refuse.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;

  const channel = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);
  return `#${hex[1]}${channel.toString(16).padStart(2, '0')}`;
}

/** The direction from one point to another in degrees, or null where they are one place. */
function runAngle(from: Point, to: Point): number | null {
  const x = to.x - from.x;
  const y = to.y - from.y;
  if (Math.abs(x) < COINCIDENT && Math.abs(y) < COINCIDENT) return null;

  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** The direction of the run a distance sits in, searched back then forward for one with a length. */
function runAngleAt(path: MeasuredPath, distance: number): number {
  const { points, distances, length } = path;
  const at = Math.min(Math.max(distance, 0), length);
  let index = 1;
  while (index < points.length && distances[index] < at) index++;

  for (let step = Math.min(index, points.length - 1); step > 0; step--) {
    const angle = runAngle(points[step - 1], points[step]);
    if (angle !== null) return angle;
  }
  for (let step = index + 1; step < points.length; step++) {
    const angle = runAngle(points[step - 1], points[step]);
    if (angle !== null) return angle;
  }

  return 0;
}

/** The two control points of the CSS ease-in-out curve the reference animates on. */
const EASE = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } as const;

/** One coordinate of the unit cubic bezier whose first and last points are 0 and 1. */
function bezier(t: number, p1: number, p2: number): number {
  const rest = 1 - t;
  return 3 * rest * rest * t * p1 + 3 * rest * t * t * p2 + t * t * t;
}

/** That coordinate's rate of change, which is what the solve below steps on. */
function bezierSlope(t: number, p1: number, p2: number): number {
  const rest = 1 - t;
  return 3 * rest * rest * p1 + 6 * rest * t * (p2 - p1) + 3 * t * t * (1 - p2);
}

/**
 * The eased fraction of the run a fraction of the period stands at. The curve
 * is parametric, so the parameter whose x is the time is solved for by Newton
 * steps from the time itself, and its y is the answer.
 */
function easeInOut(fraction: number): number {
  if (fraction <= 0) return 0;
  if (fraction >= 1) return 1;

  let guess = fraction;
  for (let round = 0; round < 8; round++) {
    const error = bezier(guess, EASE.x1, EASE.x2) - fraction;
    if (Math.abs(error) < 1e-9) break;
    const slope = bezierSlope(guess, EASE.x1, EASE.x2);
    if (Math.abs(slope) < 1e-9) break;
    guess -= error / slope;
  }

  return bezier(guess, EASE.y1, EASE.y2);
}
