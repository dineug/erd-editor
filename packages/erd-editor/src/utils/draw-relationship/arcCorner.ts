import { Point } from '@/internal-types';

/** Below this a cut is a smudge rather than a corner, and the corner is kept. */
const MIN_ARC = 2;

/**
 * How many chords one corner's arc is drawn as. Four puts the widest gap
 * between the arc and the true circle at 0.23 px on a 12 px radius, which is
 * under the half pixel every geometry reader here works to.
 */
export const VIEW_ARC_SEGMENTS = 4;

/** Steps distance from corner towards toward, which shares one axis. */
function along(corner: Point, toward: Point, distance: number): Point {
  return Math.abs(corner.x - toward.x) < 0.5
    ? { x: corner.x, y: corner.y + Math.sign(toward.y - corner.y) * distance }
    : { x: corner.x + Math.sign(toward.x - corner.x) * distance, y: corner.y };
}

/**
 * The polyline a view draws its connectors as: the chamfer's own bounds on
 * where a corner may be cut, with the run between the two cut points bent
 * around a quarter circle instead of crossed by one diagonal.
 */
export function arcPolyline(
  points: Point[],
  radius: number,
  segments: number = VIEW_ARC_SEGMENTS
): Point[] {
  if (points.length < 3 || radius <= 0 || segments < 1) return points;

  const cut: Point[] = [points[0]];
  const push = (point: Point) => {
    // Two arcs that reach the same place — a staircase whose middle run is
    // exactly two cuts long — meet rather than leaving a segment of nothing
    // between them.
    const last = cut[cut.length - 1];
    if (Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) {
      return;
    }
    cut.push(point);
  };

  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];

    const upright = Math.abs(corner.x - previous.x) < 0.5;
    const turns = upright !== Math.abs(next.x - corner.x) < 0.5;
    if (!turns) {
      // Two runs on one axis are a straight line with a point in it.
      push(corner);
      continue;
    }

    // Half of each run at most, so two corners sharing a run cannot cross over
    // each other — that is also what merges a staircase into one curve.
    const back =
      Math.abs(corner.x - previous.x) + Math.abs(corner.y - previous.y);
    const forward = Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y);
    const distance = Math.min(radius, back / 2, forward / 2);

    if (distance < MIN_ARC) {
      push(corner);
      continue;
    }

    const from = along(corner, previous, distance);
    const to = along(corner, next, distance);
    push(from);
    for (const point of arcBetween(from, corner, to, distance, segments)) {
      push(point);
    }
    push(to);
  }

  push(points[points.length - 1]);
  return cut;
}

/**
 * The points strictly between the two cut points, on the circle of the given
 * radius that touches both runs there. Its centre is the fourth corner of the
 * square the two cuts and the corner make, so the arc bends toward the corner.
 */
function arcBetween(
  from: Point,
  corner: Point,
  to: Point,
  radius: number,
  segments: number
): Point[] {
  const center = { x: from.x + to.x - corner.x, y: from.y + to.y - corner.y };
  const start = Math.atan2(from.y - center.y, from.x - center.x);
  const end = Math.atan2(to.y - center.y, to.x - center.x);

  // The quarter turn either way round, never the three quarters the other way.
  let sweep = end - start;
  if (sweep > Math.PI) sweep -= 2 * Math.PI;
  if (sweep < -Math.PI) sweep += 2 * Math.PI;

  const between: Point[] = [];
  for (let step = 1; step < segments; step++) {
    const angle = start + (sweep * step) / segments;
    between.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }

  return between;
}
