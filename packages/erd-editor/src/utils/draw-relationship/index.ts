import { arrayHas } from '@dineug/shared';

import { Point, Relationship, ValuesType } from '@/internal-types';

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
 * The cardinality decoration, measured outward from the anchor.
 *
 * The four are one shape and cannot be set independently: the second tick and
 * the ring share a centre at `LINE_SIZE + LINE_HEIGHT`, the guide line starts
 * where the longest stroke ends at `LINE_HEIGHT * 2 + 3`, and the ring has to
 * clear the first tick behind it and the guide line in front of it, which puts
 * its radius between those two.
 *
 * Scaled to 0.7 of what they were, so a decoration reaches 25px out rather than
 * 35px. `RELATIONSHIP_STROKE_WIDTH` thinned the connector; leaving the notation
 * at its old size would have made the crow's foot the heaviest thing on the
 * canvas.
 */
export const LINE_SIZE = 7;
export const LINE_HEIGHT = 11;
export const CIRCLE_HEIGHT = LINE_SIZE + LINE_HEIGHT;
export const CIRCLE_RADIUS = 6;
export const PATH_LINE_HEIGHT = LINE_HEIGHT + LINE_HEIGHT + 3;

/**
 * How far apart the corridors of two relationships leaving the same table side
 * are placed. Without this every path on a side turns at the same `x` (or `y`),
 * so their first segments run down one another no matter how far apart the
 * anchors are spread.
 */
export const STUB_STEP = 12;

/**
 * Corridors repeat every fourth slot. Growing the stub without limit would walk
 * a busy side's paths ever further from the table; wrapping keeps the longest
 * stub at `PATH_END_HEIGHT + 3 * STUB_STEP` while leaving four slots — at least
 * four anchor pitches apart — between any two that share a corridor.
 */
export const STUB_CYCLE = 4;

/**
 * The shortest a stub may be clamped to.
 *
 * It has to clear `PATH_LINE_HEIGHT`: the cardinality decorations reach that far
 * out from the anchor and the guide line is drawn from there to the stub, so a
 * shorter stub draws that line backwards. It is not derived from it. 36 is where
 * the routing was measured, and letting it follow the decorations down to 26
 * when they shrank took the medium corpus from 168px of collinear overlap to
 * 484px — two tables facing each other closer than `2 * MIN_STUB` turn in
 * earlier, and the routing bench found them sharing a corridor for 316px.
 */
export const MIN_STUB = 36;

/**
 * The widest gap allowed between two anchors on the same table side.
 *
 * Anchors used to be spread over the whole edge, so two relationships on a tall
 * table splayed hundreds of pixels apart and converged again. Capping the pitch
 * keeps a side's anchors together as a group; the side is only filled when it
 * genuinely has that many relationships.
 */
export const ANCHOR_MAX_PITCH = 120;

/** Keeps the outermost anchor of a side clear of the table's corners. */
export const ANCHOR_EDGE_INSET = 12;

/**
 * How far back from a corner a connector turns, when the corner is drawn as a
 * 45-degree cut rather than a right angle.
 *
 * Each cut is clamped to half of the shorter run it touches, so this is a ceiling
 * rather than a length: a short run keeps its right angle instead of losing the
 * whole of itself to two cuts. Two connectors turning the same way in
 * neighbouring lanes stay `NUDGE_GAP` apart through the corner, so a bundle bends
 * as a set of concentric cuts rather than converging on one.
 */
export const ROUTE_CHAMFER = 8;

const EMPTY_SLOTS: readonly [number, number] = [0, 0];

/**
 * Which slot each end of a relationship took on its table side, recorded by
 * `relationshipSort` and read by `getRelationshipPath`.
 *
 * A side channel rather than a field: `RelationshipPoint` is a serialised
 * schema type, and a slot index is a rendering detail that must not reach the
 * document, the LWW register set or the undo history.
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

/**
 * The routed polyline, from the first turning point to the last.
 *
 * Routing needs every table in the document and every other relationship's
 * route, so it cannot happen where the path is drawn — it is computed once per
 * sort and read back here. A relationship with no entry falls back to the
 * two-bend path, which is what a document renders before its first sort.
 */
const routes = new WeakMap<Relationship, Point[]>();

export function setRoute(relationship: Relationship, points: Point[]) {
  routes.set(relationship, points);
}

export function getRoute(relationship: Relationship): Point[] | undefined {
  return routes.get(relationship);
}
