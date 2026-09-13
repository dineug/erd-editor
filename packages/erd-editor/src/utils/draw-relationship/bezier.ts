import { Point } from '@/internal-types';

/**
 * How far a control point is pushed out, relative to the gap it spans. The
 * reference draws every edge with xyflow's default curvature, and these two
 * numbers are what put its control points where they sit.
 */
export const VIEW_CURVATURE = 0.25;

const CURVATURE_SCALE = 25;

/**
 * How many straight chords one view connector's curve is flattened into. Over
 * the run a view lays out, the widest gap between a chord and the true curve
 * stays under the half pixel every geometry reader here works to.
 */
export const VIEW_BEZIER_SEGMENTS = 24;

/**
 * How far a control point reaches past its own end where the other end lies
 * behind it. The only branch that leaves the box the two ends make, so a
 * culling test carrying this much covers the whole curve.
 */
export function curveReach(gap: number): number {
  return VIEW_CURVATURE * CURVATURE_SCALE * Math.sqrt(Math.max(gap, 0));
}

/** Half the gap ahead, or the square root reach behind, as the reference measures it. */
function controlOffset(distance: number): number {
  return distance >= 0 ? distance / 2 : curveReach(-distance);
}

function control(from: Point, outward: Point, to: Point): Point {
  const distance = (to.x - from.x) * outward.x + (to.y - from.y) * outward.y;
  const offset = controlOffset(distance);

  return { x: from.x + outward.x * offset, y: from.y + outward.y * offset };
}

/**
 * The two control points of the curve between a connector's turning points.
 * Each leaves straight out of its own end, so the stub run meets the curve
 * without a corner and the whole turn is carried between them.
 */
export function bezierControls(
  from: Point,
  fromOutward: Point,
  to: Point,
  toOutward: Point
): [Point, Point] {
  return [control(from, fromOutward, to), control(to, toOutward, from)];
}

/**
 * That curve as a polyline. Flattening it here is what keeps every reader
 * downstream working on straight segments: the path serialiser, the hit path,
 * the particle measurement and the route box all stay as they were.
 */
export function bezierPolyline(
  from: Point,
  fromOutward: Point,
  to: Point,
  toOutward: Point,
  segments: number = VIEW_BEZIER_SEGMENTS
): Point[] {
  const count = Math.max(1, Math.floor(segments));
  const [first, second] = bezierControls(from, fromOutward, to, toOutward);
  const points: Point[] = [{ x: from.x, y: from.y }];

  for (let step = 1; step <= count; step++) {
    const at = step / count;
    points.push({
      x: cubic(from.x, first.x, second.x, to.x, at),
      y: cubic(from.y, first.y, second.y, to.y, at),
    });
  }

  return points;
}

/** One coordinate of the cubic at a parameter, in Bernstein form. */
function cubic(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  at: number
): number {
  const rest = 1 - at;

  return (
    rest * rest * rest * p0 +
    3 * rest * rest * at * p1 +
    3 * rest * at * at * p2 +
    at * at * at * p3
  );
}
