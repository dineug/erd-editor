import { observable } from '@dineug/r-html';

import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import {
  Point,
  Relationship,
  RelationshipPoint,
  ValuesType,
} from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';
import type {
  GeometrySource,
  ViewSource,
} from '@/utils/draw-relationship/geometrySource';

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

type StoredRoute = {
  points: Point[];
  epoch: number;
};

/** One end of a connector as the geometry reads it: which table, where on it, and which way out. */
export type Anchor = Pick<RelationshipPoint, 'x' | 'y' | 'direction'> & {
  tableId: string;
};

export type Anchors = {
  start: Anchor;
  end: Anchor;
};

/**
 * Everything one source's sort keeps beside the document. A side channel
 * because none of it may reach the document, the register set or the history:
 * a slot index, a route, an epoch stamp, or the anchors a view places its ends at.
 */
type SortChannel = {
  /**
   * Opened once per sort, retiring every route box the previous one wrote.
   * Identity outlives a sort, so the stamp a route carries is what separates a
   * box for the current routes from one the next sort has already replaced.
   */
  epoch: number;
  /**
   * Which slot each end of a relationship took on its table side, recorded by
   * relationshipSort and read by getRelationshipPath.
   */
  stubSlots: WeakMap<Relationship, readonly [number, number]>;
  /**
   * The routed polyline, from the first turning point to the last, stamped with
   * the sort that wrote it. Routing needs every table and every other route, so
   * it runs once per sort; with no entry a relationship falls back to two bends.
   */
  routes: WeakMap<Relationship, StoredRoute>;
  /**
   * Where a view's sort put the two ends. The document has no entry here: its
   * sort writes the entity, the one derived geometry the document carries.
   */
  anchors: WeakMap<Relationship, Anchors>;
};

const createSortChannel = (): SortChannel => ({
  epoch: 0,
  stubSlots: new WeakMap(),
  routes: new WeakMap(),
  anchors: new WeakMap(),
});

/**
 * One channel per source, so the document's sort and the view's never read
 * each other's routes nor retire each other's epoch when they run turn about.
 */
const channels: Record<GeometrySource, SortChannel> = {
  document: createSortChannel(),
  flow: createSortChannel(),
};

/**
 * A version per connector of each view channel, observable so a render that
 * read a view's ends, slots or route is redrawn once that view's sort changes
 * them. Keyed by the entity, not its id, so two stores on one document never wake each other.
 */
const viewVersions: Record<ViewSource, WeakMap<Relationship, Version>> = {
  flow: new WeakMap(),
};

type Version = { version: number };

function viewVersionOf(relationship: Relationship, source: ViewSource) {
  const versions = viewVersions[source];
  let held = versions.get(relationship);
  if (!held) {
    held = observable({ version: 0 });
    versions.set(relationship, held);
  }
  return held;
}

/** Registers the render in hand, if any, on the connector's version in that view. */
function observeView(relationship: Relationship, source: ViewSource) {
  return viewVersionOf(relationship, source).version;
}

/**
 * Wakes every render that read this connector from that view's channel.
 * Called only for a change, as the entity's own proxy only notifies a changed
 * field, so a sort that moves one table redraws the connectors it moved and no other.
 */
function bumpView(relationship: Relationship, source: ViewSource) {
  viewVersionOf(relationship, source).version += 1;
}

/**
 * Forgets what a source's sorts wrote for these connectors, so a reader sees a
 * source that never sorted them. Per connector, never the whole channel: the
 * channels and their epochs are module-wide, and a page may host two stores.
 */
export function clearSortChannel(
  relationships: Iterable<Relationship>,
  source: GeometrySource = 'document'
) {
  const channel = channels[source];

  for (const relationship of relationships) {
    const hadSlots = channel.stubSlots.delete(relationship);
    const hadRoute = channel.routes.delete(relationship);
    const hadAnchors = channel.anchors.delete(relationship);
    if (source !== 'document' && (hadSlots || hadRoute || hadAnchors)) {
      bumpView(relationship, source);
    }
  }
}

const sameSlots = (
  a: readonly [number, number],
  b: readonly [number, number]
) => a[0] === b[0] && a[1] === b[1];

const sameAnchor = (a: Anchor, b: Anchor) =>
  a.x === b.x && a.y === b.y && a.direction === b.direction;

const samePoints = (a: Point[], b: Point[]) =>
  a.length === b.length &&
  a.every((point, index) => point.x === b[index].x && point.y === b[index].y);

export function setStubSlots(
  relationship: Relationship,
  slots: readonly [number, number],
  source: GeometrySource = 'document'
) {
  const channel = channels[source];
  if (
    source !== 'document' &&
    !sameSlots(channel.stubSlots.get(relationship) ?? EMPTY_SLOTS, slots)
  ) {
    bumpView(relationship, source);
  }
  channel.stubSlots.set(relationship, slots);
}

/** Falls back to slot zero, which reproduces the pre-stagger geometry. */
export function getStubSlots(
  relationship: Relationship,
  source: GeometrySource = 'document'
): readonly [number, number] {
  if (source !== 'document') observeView(relationship, source);
  return channels[source].stubSlots.get(relationship) ?? EMPTY_SLOTS;
}

export function setRoute(
  relationship: Relationship,
  points: Point[],
  source: GeometrySource = 'document'
) {
  const channel = channels[source];
  if (source !== 'document') {
    const held = channel.routes.get(relationship);
    if (!held || !samePoints(held.points, points)) {
      bumpView(relationship, source);
    }
  }
  channel.routes.set(relationship, { points, epoch: channel.epoch });
}

export function getRoute(
  relationship: Relationship,
  source: GeometrySource = 'document'
): Point[] | undefined {
  if (source !== 'document') observeView(relationship, source);
  return channels[source].routes.get(relationship)?.points;
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

/** Opens a sort on one source, retiring every route box that source's previous sort wrote. */
export function nextSortEpoch(source: GeometrySource = 'document') {
  channels[source].epoch += 1;
}

/**
 * Where a connector's two ends sit, for a reader outside the sort. The
 * document keeps them on the entity, where its sort wrote them; a view keeps
 * its own in its channel, and one it has not sorted yet reads the document's.
 */
export function getAnchors(
  relationship: Relationship,
  source: GeometrySource = 'document'
): Anchors {
  if (source !== 'document') {
    observeView(relationship, source);
    return channels[source].anchors.get(relationship) ?? relationship;
  }
  return relationship;
}

/**
 * Where a sort leaves a connector's two ends: on the entity for the document,
 * the one derived geometry written to it, and in the channel for a view, which
 * writes nothing to the document. Copied, so the channel never aliases a caller's object.
 */
export function setAnchors(
  relationship: Relationship,
  { start, end }: Anchors,
  source: GeometrySource = 'document'
) {
  if (source !== 'document') {
    const seen = channels[source].anchors.get(relationship) ?? relationship;
    if (!sameAnchor(seen.start, start) || !sameAnchor(seen.end, end)) {
      bumpView(relationship, source);
    }
    channels[source].anchors.set(relationship, {
      start: {
        tableId: start.tableId,
        x: start.x,
        y: start.y,
        direction: start.direction,
      },
      end: {
        tableId: end.tableId,
        x: end.x,
        y: end.y,
        direction: end.direction,
      },
    });
    return;
  }

  relationship.start.direction = start.direction;
  relationship.start.x = start.x;
  relationship.start.y = start.y;
  relationship.end.direction = end.direction;
  relationship.end.x = end.x;
  relationship.end.y = end.y;
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
  strokeWidth: number = RELATIONSHIP_STROKE_WIDTH,
  source: GeometrySource = 'document'
): BBox {
  const channel = channels[source];
  const { start, end } = getAnchors(relationship, source);
  const entry = channel.routes.get(relationship);
  const routed = entry && entry.epoch === channel.epoch ? entry.points : null;

  return inflate(
    aabb(routed ? [...routed, start, end] : [start, end]),
    ROUTE_BBOX_REACH + strokeWidth + (routed ? 0 : MAX_STUB)
  );
}
