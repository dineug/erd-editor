import { Point } from '@/internal-types';

/** Below this a curve is a smudge rather than a corner, and the corner is kept. */
const MIN_RADIUS = 2;

/**
 * How many chords a full-radius corner is flattened into. A chord strays from the
 * arc by about a tenth of a pixel at the canvas's closest zoom, so the turn still
 * reads as a curve there; a smaller corner takes one chord per pixel of radius.
 */
export const ROUTE_CORNER_SEGMENTS = 6;

/** Steps distance from corner towards toward, which shares one axis. */
function along(corner: Point, toward: Point, distance: number): Point {
  return Math.abs(corner.x - toward.x) < 0.5
    ? { x: corner.x, y: corner.y + Math.sign(toward.y - corner.y) * distance }
    : { x: corner.x + Math.sign(toward.x - corner.x) * distance, y: corner.y };
}

/**
 * The quarter circle from one run into the next, as chords. Its centre sits off
 * the corner by both legs, so the arc leaves each run along the run itself and
 * the turn has no kink at either end.
 */
function arc(from: Point, corner: Point, to: Point, chords: number): Point[] {
  const centre = { x: from.x + to.x - corner.x, y: from.y + to.y - corner.y };
  const points: Point[] = [from];

  for (let step = 1; step < chords; step++) {
    const angle = (step / chords) * (Math.PI / 2);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push({
      x: centre.x + (from.x - centre.x) * cos + (to.x - centre.x) * sin,
      y: centre.y + (from.y - centre.y) * cos + (to.y - centre.y) * sin,
    });
  }

  points.push(to);
  return points;
}

export function roundPolyline(points: Point[], radius: number): Point[] {
  if (points.length < 3 || radius <= 0) return points;

  const rounded: Point[] = [points[0]];
  const push = (point: Point) => {
    // Two arcs that reach the same place, a staircase whose middle run is
    // exactly two radii long, meet in one S rather than leaving a segment of
    // nothing between them.
    const last = rounded[rounded.length - 1];
    if (Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) {
      return;
    }
    rounded.push(point);
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
    // each other.
    const back =
      Math.abs(corner.x - previous.x) + Math.abs(corner.y - previous.y);
    const forward = Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y);
    const distance = Math.min(radius, back / 2, forward / 2);

    if (distance < MIN_RADIUS) {
      push(corner);
      continue;
    }

    const chords = Math.min(ROUTE_CORNER_SEGMENTS, Math.ceil(distance));
    for (const point of arc(
      along(corner, previous, distance),
      corner,
      along(corner, next, distance),
      chords
    )) {
      push(point);
    }
  }

  push(points[points.length - 1]);
  return rounded;
}
