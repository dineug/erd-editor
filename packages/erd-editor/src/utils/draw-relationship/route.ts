import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { getVisibleIds } from '@/konva/scene/viewLayout';
import { MIN_STUB, PATH_LINE_HEIGHT } from '@/utils/draw-relationship';
import { tableToObjectPoint } from '@/utils/draw-relationship/calc';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import type { DirtyBox } from '@/utils/draw-relationship/incremental';
import { searchRoute } from '@/utils/draw-relationship/search';
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
/**
 * How far a route may turn back over its own stub and still clear the markers:
 * the shortest stub ends this far past the guide line's start.
 */
const BACKTRACK_ALLOWANCE = MIN_STUB - PATH_LINE_HEIGHT;

export type Obstacles = {
  ids: string[];
  left: Float64Array;
  top: Float64Array;
  right: Float64Array;
  bottom: Float64Array;
};

/**
 * Every table the source shows, not only those carrying a relationship: a
 * table with no relationships at all still blocks the view. For a view that is
 * the tables it places, at the points it places them.
 */
export function collectObstacles(
  state: RootState,
  source: GeometrySource = 'document'
): Obstacles {
  const { tableIds } = getVisibleIds(state, source);
  const tables = query(state.collections)
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
    const point = tableToObjectPoint(state, table, source);
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
 * The stretch of the other axis a run turning at one of these lanes covers, a
 * clearance wider each way: only a table reaching into it can sit in the run's
 * way, and so give the run a lane to turn at.
 */
function band(a: number, b: number): [number, number] {
  return [Math.min(a, b) - ROUTE_CLEARANCE, Math.max(a, b) + ROUTE_CLEARANCE];
}

/**
 * Channel coordinates worth turning at on one axis: the midpoint, and a lane
 * just clear of each table reaching into the band the run crosses. Sorted by
 * distance, then coordinate, so no truncation or tie follows document order.
 */
function channels(
  from: number,
  to: number,
  obstacles: Obstacles,
  horizontal: boolean,
  [spanLow, spanHigh]: [number, number]
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

  lanes.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || a - b);

  // Tables standing in a row put their edges on one lane, and copies of it
  // would fill the channels tried while a free lane just past them waits.
  const tried = [middle];
  for (const lane of lanes) {
    if (tried.length > MAX_CHANNELS) break;
    if (tried.some(other => Math.abs(other - lane) < 0.5)) continue;
    tried.push(lane);
  }
  return tried;
}

type Candidate = { points: Point[]; bends: number };

/**
 * Where two ends facing the same way, which only tables drawn over each other
 * give, turn into one channel: a clearance past the further turning point, so
 * each end arrives heading outward and neither stub is walked back over.
 */
function sharedChannel(a: number, b: number, sign: number) {
  return (sign > 0 ? Math.max(a, b) : Math.min(a, b)) + sign * ROUTE_CLEARANCE;
}

/**
 * Whether two facing ends' stubs, both clamped to MIN_STUB, overlap so far that
 * a step out of either end lands inside the other table, which is drawn over
 * it. The route then turns across the gap between the tables instead.
 */
function hidesStepOut(m: number, l: number, mSign: number) {
  const overlap = (m - l) * mSign;
  return overlap > MIN_STUB - ROUTE_CLEARANCE && overlap <= 2 * MIN_STUB;
}

/**
 * Gives an empty list of outward lanes one, a clearance out from the turning
 * point, so a route between two sides on different axes always has a corner
 * that leaves and arrives outward rather than none.
 */
function stepOut(lanes: number[], from: number, sign: number) {
  if (!lanes.length) lanes.push(from + sign * ROUTE_CLEARANCE);
}

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
    const xs = channels(m.x, l.x, obstacles, true, band(m.y, l.y));
    for (const x of xs) {
      if ((x - m.x) * mSign < 0 || (x - l.x) * lSign < 0) continue;
      push([m, { x, y: m.y }, { x, y: l.y }, l]);
    }
    if (mSign === lSign) {
      const x = sharedChannel(m.x, l.x, mSign);
      push([m, { x, y: m.y }, { x, y: l.y }, l]);
    } else if (hidesStepOut(m.x, l.x, mSign) && Math.abs(m.y - l.y) >= 0.5) {
      const x = (m.x + l.x) / 2;
      push([m, { x, y: m.y }, { x, y: l.y }, l]);
    }
    // The target behind an end: step out of both, cross in the free band above
    // or below, and come back in.
    const a = m.x + mSign * ROUTE_CLEARANCE;
    const b = l.x + lSign * ROUTE_CLEARANCE;
    const ys = channels(m.y, l.y, obstacles, false, band(a, b));
    for (const y of ys) {
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
    const ys = channels(m.y, l.y, obstacles, false, band(m.x, l.x));
    for (const y of ys) {
      if ((y - m.y) * mSign < 0 || (y - l.y) * lSign < 0) continue;
      push([m, { x: m.x, y }, { x: l.x, y }, l]);
    }
    if (mSign === lSign) {
      const y = sharedChannel(m.y, l.y, mSign);
      push([m, { x: m.x, y }, { x: l.x, y }, l]);
    } else if (hidesStepOut(m.y, l.y, mSign) && Math.abs(m.x - l.x) >= 0.5) {
      const y = (m.y + l.y) / 2;
      push([m, { x: m.x, y }, { x: l.x, y }, l]);
    }
    const a = m.y + mSign * ROUTE_CLEARANCE;
    const b = l.y + lSign * ROUTE_CLEARANCE;
    const xs = channels(m.x, l.x, obstacles, true, band(a, b));
    for (const x of xs) {
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
    const xs = channels(m.x, l.x, obstacles, true, band(m.y, l.y))
      .filter(x => (x - m.x) * mSign >= 0)
      .slice(0, MAX_MIXED);
    const ys = channels(m.y, l.y, obstacles, false, band(m.x, l.x))
      .filter(y => (y - l.y) * lSign >= 0)
      .slice(0, MAX_MIXED);
    if (!xs.length || !ys.length) {
      const middle = (m.x + l.x) / 2;
      if ((middle - m.x) * mSign > -BACKTRACK_ALLOWANCE) {
        push([m, { x: middle, y: m.y }, { x: middle, y: l.y }, l]);
      } else {
        stepOut(xs, m.x, mSign);
        stepOut(ys, l.y, lSign);
      }
    }
    for (const x of xs) {
      for (const y of ys) {
        push([m, { x, y: m.y }, { x, y }, { x: l.x, y }, l]);
      }
    }
  } else {
    if ((l.y - m.y) * mSign >= 0 && (m.x - l.x) * lSign >= 0) {
      push([m, { x: m.x, y: l.y }, l]);
    }
    const ys = channels(m.y, l.y, obstacles, false, band(m.x, l.x))
      .filter(y => (y - m.y) * mSign >= 0)
      .slice(0, MAX_MIXED);
    const xs = channels(m.x, l.x, obstacles, true, band(m.y, l.y))
      .filter(x => (x - l.x) * lSign >= 0)
      .slice(0, MAX_MIXED);
    if (!xs.length || !ys.length) {
      const middle = (m.y + l.y) / 2;
      if ((middle - m.y) * mSign > -BACKTRACK_ALLOWANCE) {
        push([m, { x: m.x, y: middle }, { x: l.x, y: middle }, l]);
      } else {
        stepOut(ys, m.y, mSign);
        stepOut(xs, l.x, lSign);
      }
    }
    for (const y of ys) {
      for (const x of xs) {
        push([m, { x: m.x, y }, { x, y }, { x, y: l.y }, l]);
      }
    }
  }

  return out;
}

/** A route, and the box holding every table whose move could change it. */
export type RouteResult = {
  points: Point[];
  reach: DirtyBox;
};

/**
 * The box of every candidate tried, the two turning points included. A table
 * outside it, by more than the cache's touch distance, neither gave a lane nor
 * stood in any candidate's way, so moving it changes no score.
 */
function boxOfCandidates(m: Point, l: Point, options: Candidate[]): DirtyBox {
  const box: DirtyBox = {
    left: Math.min(m.x, l.x),
    top: Math.min(m.y, l.y),
    right: Math.max(m.x, l.x),
    bottom: Math.max(m.y, l.y),
  };
  for (const { points } of options) {
    for (const { x, y } of points) {
      if (x < box.left) box.left = x;
      if (x > box.right) box.right = x;
      if (y < box.top) box.top = y;
      if (y > box.bottom) box.bottom = y;
    }
  }
  return box;
}

function union(a: DirtyBox, b: DirtyBox): DirtyBox {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
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
  return routeWithReach(m, mDirection, l, lDirection, obstacles, skipA, skipB)
    .points;
}

/**
 * routeOrthogonal, with the box its answer depends on. When every candidate
 * passes through a table, a search through the lanes near the two ends looks
 * for a way round with more bends, and the box it searched is that answer's.
 */
export function routeWithReach(
  m: Point,
  mDirection: number,
  l: Point,
  lDirection: number,
  obstacles: Obstacles,
  skipA: string,
  skipB: string
): RouteResult {
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

  const reach = boxOfCandidates(m, l, options);
  if (best && bestCost < BLOCK_COST) return { points: best, reach };

  const { points, region } = searchRoute(
    m,
    mDirection,
    l,
    lDirection,
    obstacles,
    ROUTE_CLEARANCE,
    BEND_COST
  );
  const chosen =
    points ??
    best ??
    (isHorizontal(mDirection)
      ? [m, { x: (m.x + l.x) / 2, y: m.y }, { x: (m.x + l.x) / 2, y: l.y }, l]
      : [m, { x: m.x, y: (m.y + l.y) / 2 }, { x: l.x, y: (m.y + l.y) / 2 }, l]);

  return { points: chosen, reach: union(reach, region) };
}
