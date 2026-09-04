import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { type Obstacles } from '@/utils/draw-relationship/route';

export type DirtyBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * A route and the inputs it was computed from, so the next sort can tell whether
 * anything it reads has moved. Anchors are recomputed in full every sort, so the
 * turning points below are what a changed anchor shows up as.
 */
export type RouteEntry = {
  mx: number;
  my: number;
  mDirection: number;
  lx: number;
  ly: number;
  lDirection: number;
  startTableId: string;
  endTableId: string;
  /** The router's own output, before nudgeRoutes pushed anything apart. */
  pristine: Point[];
  /** What was finally drawn, which is what a reused group is put back onto. */
  nudged: Point[];
  bounds: DirtyBox;
};

export type SortCache = {
  boxes: Map<string, DirtyBox>;
  entries: Map<string, RouteEntry>;
};

/**
 * How close a moved table has to come to a route before it can change it. The
 * router keeps ROUTE_CLEARANCE from every box and picks lanes just clear of one,
 * so a table further out than this changes neither the lanes nor the scoring.
 */
const ROUTE_TOUCH = 40;

/**
 * How far along its own axis a changed segment reaches. A group is laid out
 * around where its members already sit and scored against everything within a
 * few lanes, which is the distance this covers.
 */
const LANE_INFLUENCE = 64;

/** Slack when asking whether two segments on one lane run over each other. */
const EXTENT_SLACK = 16;

/** Lane coordinates are bucketed this wide, which decides how coarse a hit is. */
const BUCKET = 64;

/**
 * Above this many moved tables the whole document is re-routed. Every moved box
 * is tested against every route, so a placement pass that moves everything is
 * cheaper done from scratch than filtered.
 */
const MAX_MOVED_TABLES = 64;

const caches = new WeakMap<RootState, SortCache>();

export function getSortCache(state: RootState): SortCache {
  let cache = caches.get(state);
  if (!cache) {
    cache = { boxes: new Map(), entries: new Map() };
    caches.set(state, cache);
  }
  return cache;
}

function boxOf(obstacles: Obstacles, index: number): DirtyBox {
  return {
    left: obstacles.left[index],
    top: obstacles.top[index],
    right: obstacles.right[index],
    bottom: obstacles.bottom[index],
  };
}

function union(a: DirtyBox, b: DirtyBox): DirtyBox {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

function same(a: DirtyBox, b: DirtyBox) {
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom
  );
}

export function boundsOfPoints(points: Point[]): DirtyBox {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const { x, y } of points) {
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }

  return { left, top, right, bottom };
}

function overlaps(a: DirtyBox, b: DirtyBox) {
  return (
    a.left <= b.right &&
    a.right >= b.left &&
    a.top <= b.bottom &&
    a.bottom >= b.top
  );
}

/**
 * Whether a moved table can change a route. The bounding box rather than the
 * runs inside it: the router picks its lanes from every table reaching into the
 * band between the two anchors, not only from the ones the route passes.
 */
export function routeTouches(bounds: DirtyBox, boxes: DirtyBox[]) {
  const reach: DirtyBox = {
    left: bounds.left - ROUTE_TOUCH,
    top: bounds.top - ROUTE_TOUCH,
    right: bounds.right + ROUTE_TOUCH,
    bottom: bounds.bottom + ROUTE_TOUCH,
  };

  for (const box of boxes) {
    if (overlaps(reach, box)) return true;
  }

  return false;
}

type Bucket = Map<number, number[]>;

/**
 * Where this sort changed something, as lanes rather than as areas. Everything
 * nudgeRoutes decides is decided one axis at a time, so a change is only ever
 * felt by segments sharing that axis within a few lanes of it.
 */
export type DirtyLanes = {
  markSpan(
    vertical: boolean,
    from: number,
    to: number,
    low: number,
    high: number
  ): void;
  markBox(box: DirtyBox): void;
  hits(
    vertical: boolean,
    from: number,
    to: number,
    low: number,
    high: number
  ): boolean;
};

export function createDirtyLanes(): DirtyLanes {
  const verticalLanes: Bucket = new Map();
  const horizontalLanes: Bucket = new Map();

  const markSpan = (
    vertical: boolean,
    from: number,
    to: number,
    low: number,
    high: number
  ) => {
    const bucket = vertical ? verticalLanes : horizontalLanes;
    const first = Math.floor(Math.min(from, to) / BUCKET);
    const last = Math.floor(Math.max(from, to) / BUCKET);

    for (let key = first; key <= last; key++) {
      const list = bucket.get(key);
      if (list) {
        list.push(from, to, low, high);
      } else {
        bucket.set(key, [from, to, low, high]);
      }
    }
  };

  return {
    markSpan,
    markBox(box) {
      markSpan(true, box.left, box.right, box.top, box.bottom);
      markSpan(false, box.top, box.bottom, box.left, box.right);
    },
    hits(vertical, from, to, low, high) {
      const bucket = vertical ? verticalLanes : horizontalLanes;
      if (!bucket.size) return false;

      const near = Math.min(from, to) - LANE_INFLUENCE;
      const far = Math.max(from, to) + LANE_INFLUENCE;
      const first = Math.floor(near / BUCKET);
      const last = Math.floor(far / BUCKET);

      for (let key = first; key <= last; key++) {
        const list = bucket.get(key);
        if (!list) continue;

        for (let index = 0; index < list.length; index += 4) {
          if (list[index + 1] < near || list[index] > far) continue;
          if (list[index + 3] < low - EXTENT_SLACK) continue;
          if (list[index + 2] > high + EXTENT_SLACK) continue;
          return true;
        }
      }

      return false;
    },
  };
}

/** Marks every axis-aligned run of a polyline as changed. */
export function markRoute(lanes: DirtyLanes, points: Point[]) {
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const vertical = Math.abs(a.x - b.x) < 0.5;
    if (vertical) {
      lanes.markSpan(true, a.x, b.x, Math.min(a.y, b.y), Math.max(a.y, b.y));
    } else {
      lanes.markSpan(false, a.y, b.y, Math.min(a.x, b.x), Math.max(a.x, b.x));
    }
  }
}

/**
 * What nudgeRoutes needs to leave an untouched group where it already was: the
 * routes this sort re-routed, the lanes they and the moved tables changed, and
 * the coordinate every segment was last drawn at.
 */
export type NudgeMemo = {
  dirty: Set<string>;
  lanes: DirtyLanes;
  coordinate(
    relationshipId: string,
    index: number,
    vertical: boolean
  ): number | undefined;
};

/**
 * Which table boxes moved since the last sort, or null when so much changed that
 * filtering costs more than re-routing. The cache's own snapshot is replaced
 * here, so this runs once per sort.
 */
export function diffTableBoxes(
  cache: SortCache,
  obstacles: Obstacles
): DirtyBox[] | null {
  const previous = cache.boxes;
  const next = new Map<string, DirtyBox>();
  const dirty: DirtyBox[] = [];
  let full = false;

  for (let index = 0; index < obstacles.ids.length; index++) {
    const id = obstacles.ids[index];
    const box = boxOf(obstacles, index);
    next.set(id, box);

    if (full) continue;

    const was = previous.get(id);
    if (!was) {
      dirty.push(box);
    } else if (!same(was, box)) {
      dirty.push(union(was, box));
    }
    if (dirty.length > MAX_MOVED_TABLES) full = true;
  }

  if (!full) {
    for (const [id, box] of previous) {
      if (next.has(id)) continue;
      dirty.push(box);
      if (dirty.length > MAX_MOVED_TABLES) {
        full = true;
        break;
      }
    }
  }

  cache.boxes = next;
  return full || previous.size === 0 ? null : dirty;
}
