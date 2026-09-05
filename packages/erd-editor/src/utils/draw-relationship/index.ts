import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { Point, Relationship, ValuesType } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';

export const DirectionName = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
} as const;
export type DirectionName = ValuesType<typeof DirectionName>;
export const DirectionNameList: ReadonlyArray<string> =
  Object.values(DirectionName);

export type PointToPoint = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type DrawPathLine = {
  start: PointToPoint;
};

export type DrawLine = {
  start: {
    base: PointToPoint;
    base2: PointToPoint;
    center: PointToPoint;
    center2: PointToPoint;
  };
};

export type PathPoint = {
  M: Point;
  L: Point;
  Q: Point;
  d(): Array<[Point, Point]>;
};

export type Path = {
  M: Point;
  L: Point;
  Q: Point;
  d(): string;
};

export type DrawPath = {
  path: { path: Path; line: DrawPathLine };
  line: DrawLine;
};

export type PathLine = {
  start: PointToPoint;
  end: PointToPoint;
};

export type Line = {
  start: {
    base: PointToPoint;
    base2: PointToPoint;
    center: PointToPoint;
    center2: PointToPoint;
  };
  end: {
    base: PointToPoint;
    base2: PointToPoint;
    left: PointToPoint;
    center: PointToPoint;
    center2: PointToPoint;
    right: PointToPoint;
  };
};

export type Circle = {
  cx: number;
  cy: number;
};

export type RelationshipPath = {
  path: { path: PathPoint; line: PathLine };
  line: { line: Line; circle: Circle; startCircle: Circle };
};

export type ObjectPoint = {
  width: number;
  height: number;
  top: Point;
  bottom: Point;
  left: Point;
  right: Point;
  lt: Point;
  rt: Point;
  lb: Point;
  rb: Point;
};

export const isDirection = arrayHas<string>([
  DirectionName.top,
  DirectionName.bottom,
  DirectionName.left,
  DirectionName.right,
]);

export const PATH_HEIGHT = 30;
export const PATH_END_HEIGHT = PATH_HEIGHT + 20;

/**
 * The cardinality decoration, measured outward from the anchor. The four are one
 * shape and cannot be set independently: the ring shares a centre with the
 * second tick and has to clear both the first tick and the guide line.
 */
export const LINE_SIZE = 7;
export const LINE_HEIGHT = 11;
export const CIRCLE_HEIGHT = LINE_SIZE + LINE_HEIGHT;
export const CIRCLE_RADIUS = 6;
export const PATH_LINE_HEIGHT = LINE_HEIGHT + LINE_HEIGHT + 3;

/**
 * How far apart the corridors of two relationships leaving the same table side
 * sit. Without it every path on a side turns at the same coordinate and their
 * first segments run down one another however far the anchors are spread.
 */
export const STUB_STEP = 12;

/**
 * Corridors repeat every fourth slot. An unbounded stub walks a busy side's
 * paths ever further from the table; wrapping caps the longest one and still
 * leaves four slots between any two that share a corridor.
 */
export const STUB_CYCLE = 4;

/**
 * The shortest a stub may be clamped to. It has to clear PATH_LINE_HEIGHT or the
 * guide line is drawn backwards, but it is not derived from it: this is where
 * the routing was measured, and following the decorations down cost overlap.
 */
export const MIN_STUB = 36;

/**
 * The widest gap allowed between two anchors on the same table side. Capping the
 * pitch keeps a side's anchors together as a group, so a tall table's edge is
 * only filled when it genuinely has that many relationships.
 */
export const ANCHOR_MAX_PITCH = 120;

/** Keeps the outermost anchor of a side clear of the table's corners. */
export const ANCHOR_EDGE_INSET = 12;

/**
 * How far back from a corner a connector turns when the corner is cut to 45
 * degrees. A ceiling rather than a length: each cut is clamped to half the
 * shorter run it touches, so a short run keeps its right angle.
 */
export const ROUTE_CHAMFER = 8;

const EMPTY_SLOTS: readonly [number, number] = [0, 0];

/**
 * Which slot each end of a relationship took on its table side, recorded by
 * relationshipSort and read by getRelationshipPath. A side channel because a
 * slot index must not reach the document, the register set or the history.
 */
const stubSlots = new WeakMap<Relationship, readonly [number, number]>();

export function setStubSlots(
  relationship: Relationship,
  slots: readonly [number, number]
) {
  stubSlots.set(relationship, slots);
}

/** Falls back to slot zero, which reproduces the pre-stagger geometry. */
export function getStubSlots(
  relationship: Relationship
): readonly [number, number] {
  return stubSlots.get(relationship) ?? EMPTY_SLOTS;
}

type StoredRoute = {
  points: Point[];
  epoch: number;
};

/**
 * The routed polyline, from the first turning point to the last, stamped with
 * the sort that wrote it. Routing needs every table and every other route, so
 * it runs once per sort; with no entry a relationship falls back to two bends.
 */
const routes = new WeakMap<Relationship, StoredRoute>();

export function setRoute(relationship: Relationship, points: Point[]) {
  routes.set(relationship, { points, epoch: sortEpoch });
}

export function getRoute(relationship: Relationship): Point[] | undefined {
  return routes.get(relationship)?.points;
}

/**
 * How far a connector reaches past its anchor, whichever decoration is furthest
 * out. The ring shares a centre with the second tick, so its outer edge and the
 * start of the guide line are the two candidates.
 */
export const ROUTE_BBOX_REACH = Math.max(
  CIRCLE_HEIGHT + CIRCLE_RADIUS,
  PATH_LINE_HEIGHT
);

/**
 * The longest stub a slot can ask for. It bounds where the turning points of an
 * unrouted relationship can be, which is the only thing the route itself would
 * have told us.
 */
export const MAX_STUB = PATH_END_HEIGHT + (STUB_CYCLE - 1) * STUB_STEP;

export type BBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

let sortEpoch = 0;

/**
 * Opens a sort, retiring every route box the previous one wrote. Identity
 * outlives a sort, so the stamp a route carries is what separates a box for the
 * current routes from one the next sort has already replaced.
 */
export function nextSortEpoch() {
  sortEpoch += 1;
}

function aabb(points: Point[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const { x, y } of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function inflate({ x, y, width, height }: BBox, padding: number): BBox {
  return {
    x: x - padding,
    y: y - padding,
    width: width + padding * 2,
    height: height + padding * 2,
  };
}

/**
 * Everywhere a relationship can be drawn, for a culling test that must not lose
 * a connector whose anchors are on screen and whose route is not. Without a
 * route from this sort the stub ends are unknown, so the padding carries them.
 */
export function getRouteBBox(
  relationship: Relationship,
  strokeWidth: number = RELATIONSHIP_STROKE_WIDTH
): BBox {
  const { start, end } = relationship;
  const entry = routes.get(relationship);
  const routed = entry && entry.epoch === sortEpoch ? entry.points : null;

  return inflate(
    aabb(routed ? [...routed, start, end] : [start, end]),
    ROUTE_BBOX_REACH + strokeWidth + (routed ? 0 : MAX_STUB)
  );
}
