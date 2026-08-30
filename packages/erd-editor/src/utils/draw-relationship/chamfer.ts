import { Point } from '@/internal-types';

/** Below this a cut is a smudge rather than a corner, and the corner is kept. */
const MIN_CHAMFER = 2;

/** Steps distance from corner towards toward, which shares one axis. */
function along(corner: Point, toward: Point, distance: number): Point {
  return Math.abs(corner.x - toward.x) < 0.5
    ? { x: corner.x, y: corner.y + Math.sign(toward.y - corner.y) * distance }
    : { x: corner.x + Math.sign(toward.x - corner.x) * distance, y: corner.y };
}

export function chamferPolyline(points: Point[], size: number): Point[] {
  if (points.length < 3 || size <= 0) return points;

  const cut: Point[] = [points[0]];
  const push = (point: Point) => {
    // Two cuts that reach the same place — a staircase whose middle run is
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
    // each other — that is also what merges a staircase into one diagonal.
    const back =
      Math.abs(corner.x - previous.x) + Math.abs(corner.y - previous.y);
    const forward = Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y);
    const distance = Math.min(size, back / 2, forward / 2);

    if (distance < MIN_CHAMFER) {
      push(corner);
      continue;
    }

    push(along(corner, previous, distance));
    push(along(corner, next, distance));
  }

  push(points[points.length - 1]);
  return cut;
}
