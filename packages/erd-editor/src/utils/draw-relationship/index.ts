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
export const PATH_LINE_HEIGHT = 35;
export const LINE_SIZE = 10;
export const LINE_HEIGHT = 16;
export const CIRCLE_HEIGHT = 26;

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
 * The shortest a stub may be clamped to. The cardinality decorations reach
 * `PATH_LINE_HEIGHT` out from the anchor and the guide line is drawn from there
 * to the stub, so a shorter stub draws that line backwards.
 */
export const MIN_STUB = PATH_LINE_HEIGHT + 1;

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
