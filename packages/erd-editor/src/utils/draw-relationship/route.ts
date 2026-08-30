import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { tableToObjectPoint } from '@/utils/draw-relationship/calc';
import { isHorizontal, outwardSign } from '@/utils/draw-relationship/stub';

/** Clearance kept between a route and the table boxes it passes. */
const ROUTE_CLEARANCE = 16;
/** Shrinks each obstacle so a route grazing an edge is not "through" it. */
const OBSTACLE_INSET = 2;
/** What a bend costs relative to a pixel of length, when scoring candidates. */
const BEND_COST = 36;
/** What passing through one table costs. Large enough to always lose. */
const BLOCK_COST = 100_000;
/** Upper bound on channel coordinates tried per free axis. */
const MAX_CHANNELS = 6;
/** Upper bound on channel pairs tried when the two anchors face different axes. */
const MAX_MIXED = 4;

export type Obstacles = {
  ids: string[];
  left: Float64Array;
  top: Float64Array;
  right: Float64Array;
  bottom: Float64Array;
};

/**
 * Every table in the document, not only those carrying a relationship: a table
 * with no relationships at all still blocks the view.
 */
export function collectObstacles(state: RootState): Obstacles {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);

  const size = tables.length;
  const obstacles: Obstacles = {
    ids: new Array(size),
    left: new Float64Array(size),
    top: new Float64Array(size),
    right: new Float64Array(size),
    bottom: new Float64Array(size),
  };

  tables.forEach((table, index) => {
    const point = tableToObjectPoint(state, table);
    obstacles.ids[index] = table.id;
    obstacles.left[index] = point.lt.x + OBSTACLE_INSET;
    obstacles.top[index] = point.lt.y + OBSTACLE_INSET;
    obstacles.right[index] = point.rb.x - OBSTACLE_INSET;
    obstacles.bottom[index] = point.rb.y - OBSTACLE_INSET;
  });

  return obstacles;
}

/** Liang–Barsky, with no divisions until a slab actually clips. */
export function segmentHitsBox(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  left: number,
  top: number,
  right: number,
  bottom: number
) {
  let enter = 0;
  let exit = 1;
  const dx = bx - ax;
  const dy = by - ay;

  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > exit) return false;
      if (t > enter) enter = t;
    } else {
      if (t < enter) return false;
      if (t < exit) exit = t;
    }
    return true;
  };

  return (
    clip(-dx, ax - left) &&
    clip(dx, right - ax) &&
    clip(-dy, ay - top) &&
    clip(dy, bottom - ay) &&
    enter <= exit
  );
}

/**
 * How many tables a polyline passes through, ignoring the two it connects. The
 * hot function of the router, so the polyline's own box is computed once to skip
 * tables outright; every segment's box sits inside it, so the count is the same.
 */
export function countBlocked(
  points: Point[],
  obstacles: Obstacles,
  skipA: string,
  skipB: string
) {
  let count = 0;

  let boundsLeft = Infinity;
  let boundsRight = -Infinity;
  let boundsTop = Infinity;
  let boundsBottom = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point.x < boundsLeft) boundsLeft = point.x;
    if (point.x > boundsRight) boundsRight = point.x;
    if (point.y < boundsTop) boundsTop = point.y;
    if (point.y > boundsBottom) boundsBottom = point.y;
  }

  for (let index = 0; index < obstacles.ids.length; index++) {
    const left = obstacles.left[index];
    const right = obstacles.right[index];
    const top = obstacles.top[index];
    const bottom = obstacles.bottom[index];

    if (boundsRight < left || boundsLeft > right) continue;
    if (boundsBottom < top || boundsTop > bottom) continue;

    const id = obstacles.ids[index];
    if (id === skipA || id === skipB) continue;

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      // Cheap reject first; most tables are nowhere near any given segment.
      if (Math.max(a.x, b.x) < left || Math.min(a.x, b.x) > right) continue;
      if (Math.max(a.y, b.y) < top || Math.min(a.y, b.y) > bottom) continue;
      if (segmentHitsBox(a.x, a.y, b.x, b.y, left, top, right, bottom)) {
        count++;
        break;
      }
    }
  }

  return count;
}

function polylineLength(points: Point[]) {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    total +=
      Math.abs(points[index].x - points[index - 1].x) +
      Math.abs(points[index].y - points[index - 1].y);
  }
  return total;
}

/**
 * Channel coordinates worth turning at on one axis: the midpoint, and a lane
 * just clear of each table reaching into the band the route crosses. Sorted by
 * distance before truncating, never truncated by document order.
 */
function channels(
  from: number,
  to: number,
  obstacles: Obstacles,
  horizontal: boolean,
  spanLow: number,
  spanHigh: number
): number[] {
  const middle = (from + to) / 2;
  const low = obstacles[horizontal ? 'left' : 'top'];
  const high = obstacles[horizontal ? 'right' : 'bottom'];
  const crossLow = obstacles[horizontal ? 'top' : 'left'];
  const crossHigh = obstacles[horizontal ? 'bottom' : 'right'];

  const lanes: number[] = [];
  for (let index = 0; index < obstacles.ids.length; index++) {
    // Only tables that reach into the band the route has to cross can matter.
    if (crossHigh[index] < spanLow || crossLow[index] > spanHigh) continue;
    lanes.push(low[index] - ROUTE_CLEARANCE, high[index] + ROUTE_CLEARANCE);
  }

  lanes.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
  return [middle, ...lanes.slice(0, MAX_CHANNELS)];
}

type Candidate = { points: Point[]; bends: number };

/**
 * Builds the candidate polylines for one pair of turning points. A route may
 * only leave and arrive heading outward from its table or it doubles back
 * through the cardinality guide line, which is what the tests below check.
 */
function candidates(
  m: Point,
  mDirection: number,
  l: Point,
  lDirection: number,
  obstacles: Obstacles
): Candidate[] {
  const mH = isHorizontal(mDirection);
  const lH = isHorizontal(lDirection);
  const mSign = outwardSign(mDirection);
  const lSign = outwardSign(lDirection);

  const spanLow = Math.min(m.x, l.x, m.y, l.y);
  const spanHigh = Math.max(m.x, l.x, m.y, l.y);
  const out: Candidate[] = [];

  const push = (points: Point[]) => {
    // Drop the zero-length steps a channel landing on an endpoint produces.
    const cleaned: Point[] = [points[0]];
    for (let index = 1; index < points.length; index++) {
      const previous = cleaned[cleaned.length - 1];
      const current = points[index];
      if (
        Math.abs(current.x - previous.x) < 0.5 &&
        Math.abs(current.y - previous.y) < 0.5
      ) {
        continue;
      }
      cleaned.push(current);
    }
    if (cleaned.length < 2) return;
    out.push({ points: cleaned, bends: cleaned.length - 2 });
  };

  if (mH && lH) {
    const xs = channels(m.x, l.x, obstacles, true, spanLow, spanHigh);
    for (const x of xs) {
      if ((x - m.x) * mSign < 0 || (x - l.x) * lSign < 0) continue;
      push([m, { x, y: m.y }, { x, y: l.y }, l]);
    }
    // Both anchors facing the same way with the target behind: step out, cross
    // in the free band above or below, and come back in.
    const ys = channels(m.y, l.y, obstacles, false, spanLow, spanHigh);
    for (const y of ys) {
      const a = m.x + mSign * ROUTE_CLEARANCE;
      const b = l.x + lSign * ROUTE_CLEARANCE;
      push([
        m,
        { x: a, y: m.y },
        { x: a, y },
        { x: b, y },
        { x: b, y: l.y },
        l,
      ]);
    }
  } else if (!mH && !lH) {
    const ys = channels(m.y, l.y, obstacles, false, spanLow, spanHigh);
    for (const y of ys) {
      if ((y - m.y) * mSign < 0 || (y - l.y) * lSign < 0) continue;
      push([m, { x: m.x, y }, { x: l.x, y }, l]);
    }
    const xs = channels(m.x, l.x, obstacles, true, spanLow, spanHigh);
    for (const x of xs) {
      const a = m.y + mSign * ROUTE_CLEARANCE;
      const b = l.y + lSign * ROUTE_CLEARANCE;
      push([
        m,
        { x: m.x, y: a },
        { x, y: a },
        { x, y: b },
        { x: l.x, y: b },
        l,
      ]);
    }
  } else if (mH) {
    // One bend, when the corner happens to sit outward of both anchors.
    if ((l.x - m.x) * mSign >= 0 && (m.y - l.y) * lSign >= 0) {
      push([m, { x: l.x, y: m.y }, l]);
    }
    const xs = channels(m.x, l.x, obstacles, true, spanLow, spanHigh)
      .filter(x => (x - m.x) * mSign >= 0)
      .slice(0, MAX_MIXED);
    const ys = channels(m.y, l.y, obstacles, false, spanLow, spanHigh)
      .filter(y => (y - l.y) * lSign >= 0)
      .slice(0, MAX_MIXED);
    for (const x of xs) {
      for (const y of ys) {
        push([m, { x, y: m.y }, { x, y }, { x: l.x, y }, l]);
      }
    }
  } else {
    if ((l.y - m.y) * mSign >= 0 && (m.x - l.x) * lSign >= 0) {
      push([m, { x: m.x, y: l.y }, l]);
    }
    const ys = channels(m.y, l.y, obstacles, false, spanLow, spanHigh)
      .filter(y => (y - m.y) * mSign >= 0)
      .slice(0, MAX_MIXED);
    const xs = channels(m.x, l.x, obstacles, true, spanLow, spanHigh)
      .filter(x => (x - l.x) * lSign >= 0)
      .slice(0, MAX_MIXED);
    for (const y of ys) {
      for (const x of xs) {
        push([m, { x: m.x, y }, { x, y }, { x, y: l.y }, l]);
      }
    }
  }

  return out;
}

/**
 * The cheapest orthogonal polyline from m to l, or a two-bend fallback when
 * nothing is feasible — a connector always has to be drawn.
 */
export function routeOrthogonal(
  m: Point,
  mDirection: number,
  l: Point,
  lDirection: number,
  obstacles: Obstacles,
  skipA: string,
  skipB: string
): Point[] {
  const options = candidates(m, mDirection, l, lDirection, obstacles);

  let best: Point[] | null = null;
  let bestCost = Infinity;

  for (const option of options) {
    const cost =
      countBlocked(option.points, obstacles, skipA, skipB) * BLOCK_COST +
      option.bends * BEND_COST +
      polylineLength(option.points);
    if (cost < bestCost) {
      bestCost = cost;
      best = option.points;
    }
  }

  if (best) return best;

  return isHorizontal(mDirection)
    ? [m, { x: (m.x + l.x) / 2, y: m.y }, { x: (m.x + l.x) / 2, y: l.y }, l]
    : [m, { x: m.x, y: (m.y + l.y) / 2 }, { x: l.x, y: (m.y + l.y) / 2 }, l];
}
