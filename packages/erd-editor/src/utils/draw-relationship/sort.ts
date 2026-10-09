import { query } from '@dineug/erd-editor-schema';

import { Direction } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Point, Relationship, Table } from '@/internal-types';
import { getVisibleIds } from '@/konva/scene/viewLayout';
import { arrayHas } from '@/utils/arrayHas';
import {
  type Anchor,
  ANCHOR_EDGE_INSET,
  ANCHOR_MAX_PITCH,
  type Anchors,
  copyAnchor,
  DirectionName,
  DirectionNameList,
  LINE_SIZE,
  nextSortEpoch,
  ObjectPoint,
  setAnchors,
  setRoute,
  setStubSlots,
} from '@/utils/draw-relationship';
import {
  euclideanDistance,
  tableToObjectPoint,
} from '@/utils/draw-relationship/calc';
import type {
  GeometrySource,
  ViewSource,
} from '@/utils/draw-relationship/geometrySource';
import {
  boundsOfPoints,
  createDirtyLanes,
  diffTableBoxes,
  getSortCache,
  markRoute,
  type NudgeMemo,
  type RouteEntry,
  routeTouches,
} from '@/utils/draw-relationship/incremental';
import { nudgeRoutes } from '@/utils/draw-relationship/nudge';
import {
  collectObstacles,
  routeOrthogonal,
} from '@/utils/draw-relationship/route';
import { stubEnds } from '@/utils/draw-relationship/stub';

type RelationshipGraph = {
  tableId: string;
  centerX: number;
  centerY: number;
  objectPoint: ObjectPoint;
  /** The loops on this table, laid out together once every one is known. */
  loops: ChangeRelationship[];
  top: SideEntry[];
  bottom: SideEntry[];
  left: SideEntry[];
  right: SideEntry[];
};

/** The two ends as this sort places them, and the id they belong to. */
type ChangeRelationship = Anchors & { id: string };

/** One relationship end sitting on one table side, before it is given a slot. */
type SideEntry = {
  id: string;
  /** True when the end on this side is the relationship's start. */
  isStart: boolean;
  point: Anchor;
  /**
   * Where the opposite table lies, as an angle around this table, normalised so
   * that walking the side clockwise means walking this key upwards.
   */
  angle: number;
  /** Separates relationships that share both tables, and so share an angle. */
  tie: number;
};

type DirectionTuple = [DirectionName, DirectionName];

/** Slot index each end of a relationship took, indexed [start, end]. */
type SlotPair = [number, number];

const directionNameToDirection: Record<string, number> = {
  [DirectionName.top]: Direction.top,
  [DirectionName.bottom]: Direction.bottom,
  [DirectionName.left]: Direction.left,
  [DirectionName.right]: Direction.right,
};

const TAU = Math.PI * 2;

/**
 * How far the first loop's anchors sit from the table's top-right corner, the
 * same on every table, so a large table's loop is no larger than a small one's.
 */
const SELF_CORNER_OFFSET = 20;
/**
 * How far each additional loop on the same table steps out from the previous,
 * enough that the markers of two neighbouring loops stay apart where it fits.
 */
const SELF_CORNER_STRIDE = 18;
/** Gap kept between the outermost loop and the nearest ordinary anchor. */
const SELF_CLEARANCE = 8;

/**
 * The angle at which each side's clockwise walk begins. Reading the boundary as
 * one clockwise loop is what makes the anchor order planar: two relationships
 * leaving a table cannot cross when both follow the order of their targets.
 */
const SIDE_START_ANGLE: Record<DirectionName, number> = {
  [DirectionName.top]: -Math.PI,
  [DirectionName.right]: -Math.PI / 2,
  [DirectionName.bottom]: 0,
  [DirectionName.left]: Math.PI / 2,
};

/** Sides whose clockwise walk runs against the axis it is measured on. */
const WALKS_BACKWARDS: Record<DirectionName, boolean> = {
  [DirectionName.top]: false,
  [DirectionName.right]: false,
  [DirectionName.bottom]: true,
  [DirectionName.left]: true,
};

export function relationshipSort(
  state: RootState,
  source: GeometrySource = 'document'
) {
  // Every route box the last sort left behind answers for a route this one is
  // about to replace, and the connectors it skips over - self relationships,
  // and any whose end table left the document - never reach setRoute at all.
  nextSortEpoch(source);

  // The whole document, or what the view shows: the tables it places and the
  // connectors between two of them. Everything below is read at the source's
  // points, sized as the source draws it, and written to the source's channel.
  const { tableIds, relationshipIds } = getVisibleIds(state, source);
  const { collections } = state;
  const isTableIds = arrayHas(tableIds);
  const tableCollection = query(collections).collection('tableEntities');
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .filter(
      ({ start, end }) => isTableIds(start.tableId) && isTableIds(end.tableId)
    );
  const graphMap = new Map<string, RelationshipGraph>();
  const changeMap = new Map<Relationship, ChangeRelationship>();
  const slotMap = new Map<string, SlotPair>();
  const pairs = pairIndexes(relationships);

  for (const relationship of relationships) {
    const relationshipShape = createChangeRelationship(relationship);
    const { start, end } = relationshipShape;
    const startTable = tableCollection.selectById(start.tableId);
    const endTable = tableCollection.selectById(end.tableId);

    if (!startTable || !endTable) {
      continue;
    }

    changeMap.set(relationship, relationshipShape);
    // Seeded here so placeSide only ever mutates an existing pair; looking it
    // up with a fallback allocates a throwaway array for every side entry.
    slotMap.set(relationshipShape.id, [0, 0]);

    if (start.tableId === end.tableId) {
      getOrCreateGraph(state, graphMap, startTable, source).loops.push(
        relationshipShape
      );
    } else {
      const startGraph = getOrCreateGraph(state, graphMap, startTable, source);
      const endGraph = getOrCreateGraph(state, graphMap, endTable, source);
      const [startDirection, endDirection] = getAndSetDirection(
        startGraph.objectPoint,
        endGraph.objectPoint,
        relationshipShape
      );

      startGraph[startDirection].push({
        id: relationshipShape.id,
        isStart: true,
        point: start,
        angle: orderAngle(startDirection, startGraph, endGraph),
        tie: pairs.tieAt(relationshipShape.id, start.tableId, end.tableId),
      });
      endGraph[endDirection].push({
        id: relationshipShape.id,
        isStart: false,
        point: end,
        angle: orderAngle(endDirection, endGraph, startGraph),
        tie: pairs.tieAt(relationshipShape.id, end.tableId, start.tableId),
      });
    }
  }

  for (const graph of graphMap.values()) {
    placeLoops(graph);
    for (const key of DirectionNameList) {
      placeSide(key as DirectionName, graph, slotMap);
    }
  }

  for (const [origin, change] of changeMap.entries()) {
    setStubSlots(origin, slotMap.get(change.id) ?? [0, 0], source);
    setAnchors(origin, change, source);
  }

  if (source === 'document') {
    routeRelationships(state, changeMap, slotMap);
  } else {
    stubRelationships(changeMap, slotMap, source);
  }
}

/**
 * A view draws one curve between the two turning points and reads no route, so
 * its channel holds those two points and nothing else. Skipping the router
 * also keeps a nudge that cannot move them from waking the renders that read them.
 */
function stubRelationships(
  changeMap: Map<Relationship, ChangeRelationship>,
  slotMap: Map<string, SlotPair>,
  source: ViewSource
) {
  for (const [origin, change] of changeMap.entries()) {
    const { id, start, end } = change;
    if (start.tableId === end.tableId) continue;

    const { m, l } = stubEnds(change, slotMap.get(id) ?? [0, 0]);
    setRoute(origin, [m, l], source);
  }
}

/**
 * Routes every relationship around the tables, then pulls apart the routes
 * sharing a channel. The document alone reaches it, and it reads the anchors
 * and slots this sort just placed rather than the entity it has written them to.
 */
function routeRelationships(
  state: RootState,
  changeMap: Map<Relationship, ChangeRelationship>,
  slotMap: Map<string, SlotPair>
) {
  const obstacles = collectObstacles(state);
  const cache = getSortCache(state);
  const moved = diffTableBoxes(cache, obstacles);
  const previous = cache.entries;
  const entries = new Map<string, RouteEntry>();
  const dirty = new Set<string>();
  const lanes = createDirtyLanes();

  if (moved) {
    for (const box of moved) lanes.markBox(box);
  }

  const routes = new Map<string, Point[]>();
  const endpoints = new Map<string, [string, string]>();
  const origins = new Map<string, Relationship>();

  for (const [origin, change] of changeMap.entries()) {
    const { id, start, end } = change;
    if (start.tableId === end.tableId) continue;

    const { m, l } = stubEnds(change, slotMap.get(id) ?? [0, 0]);
    const was = previous.get(id);

    let pristine: Point[];
    let points: Point[];

    if (
      moved !== null &&
      was !== undefined &&
      sameRouteInputs(was, m, l, start, end) &&
      !routeTouches(was.bounds, moved)
    ) {
      pristine = was.pristine;
      points = clonePoints(pristine);
    } else {
      points = routeOrthogonal(
        m,
        start.direction,
        l,
        end.direction,
        obstacles,
        start.tableId,
        end.tableId
      );
      pristine = clonePoints(points);
      dirty.add(id);
      if (was) markRoute(lanes, was.nudged);
      markRoute(lanes, pristine);
    }

    routes.set(id, points);
    endpoints.set(id, [start.tableId, end.tableId]);
    origins.set(id, origin);
    entries.set(id, {
      mx: m.x,
      my: m.y,
      mDirection: start.direction,
      lx: l.x,
      ly: l.y,
      lDirection: end.direction,
      startTableId: start.tableId,
      endTableId: end.tableId,
      pristine,
      nudged: points,
      bounds: boundsOfPoints(pristine),
    });
  }

  if (moved) {
    // A connector that left the document frees the channel it was holding, which
    // is a change to every group it was part of.
    for (const [id, entry] of previous) {
      if (!entries.has(id)) markRoute(lanes, entry.nudged);
    }
  }

  nudgeRoutes(
    routes,
    obstacles,
    endpoints,
    moved === null ? undefined : createMemo(previous, dirty, lanes)
  );

  for (const [id, points] of routes) {
    const origin = origins.get(id);
    if (origin) setRoute(origin, points);
  }

  cache.entries = entries;
}

function clonePoints(points: Point[]): Point[] {
  return points.map(({ x, y }) => ({ x, y }));
}

function createMemo(
  previous: Map<string, RouteEntry>,
  dirty: Set<string>,
  lanes: NudgeMemo['lanes']
): NudgeMemo {
  return {
    dirty,
    lanes,
    coordinate(relationshipId, index, vertical) {
      const point = previous.get(relationshipId)?.nudged[index];
      if (!point) return undefined;
      return vertical ? point.x : point.y;
    },
  };
}

/** Whether the route held for a relationship was computed from these ends. */
function sameRouteInputs(
  was: RouteEntry,
  m: Point,
  l: Point,
  start: Anchor,
  end: Anchor
) {
  return (
    was.mx === m.x &&
    was.my === m.y &&
    was.lx === l.x &&
    was.ly === l.y &&
    was.mDirection === start.direction &&
    was.lDirection === end.direction &&
    was.startTableId === start.tableId &&
    was.endTableId === end.tableId
  );
}

function getOrCreateGraph(
  state: RootState,
  graphMap: Map<string, RelationshipGraph>,
  table: Table,
  source: GeometrySource
) {
  let graph = graphMap.get(table.id);
  if (!graph) {
    const objectPoint = tableToObjectPoint(state, table, source);
    graph = {
      tableId: table.id,
      centerX: objectPoint.top.x,
      centerY: objectPoint.left.y,
      objectPoint,
      loops: [],
      top: [],
      bottom: [],
      left: [],
      right: [],
    };
    graphMap.set(table.id, graph);
  }
  return graph;
}

/**
 * Places a table's loops around its top-right corner, kept out of the side lists
 * entirely so they inflate no side's count. Each further loop steps outwards from
 * the last, closer together where the table's shorter side has no room for more.
 */
function placeLoops(graph: RelationshipGraph) {
  const { rt } = graph.objectPoint;
  const offsets = loopOffsets(graph);

  graph.loops.forEach((relationship, index) => {
    const offset = offsets[index];
    relationship.start.direction = Direction.top;
    relationship.start.x = rt.x - offset;
    relationship.start.y = rt.y;
    relationship.end.direction = Direction.right;
    relationship.end.x = rt.x;
    relationship.end.y = rt.y + offset;
  });
}

/** How far each loop's anchors sit from the corner, on a side of either length. */
function loopOffsets(graph: RelationshipGraph): number[] {
  const { width, height } = graph.objectPoint;
  const count = graph.loops.length;
  const room = Math.max(0, Math.min(width, height) - LINE_SIZE);
  const first = Math.min(SELF_CORNER_OFFSET, room);
  const stride =
    count > 1 ? Math.min(SELF_CORNER_STRIDE, (room - first) / (count - 1)) : 0;

  return graph.loops.map((_, index) => first + index * stride);
}

/**
 * How much of a side the loops in the top-right corner have taken. Loops are
 * placed before the sides are laid out and are not in the slot order, so without
 * this the anchor spread reaches the corner one already sits in.
 */
function selfReserve(graph: RelationshipGraph) {
  const offsets = loopOffsets(graph);
  if (!offsets.length) return 0;
  return offsets[offsets.length - 1] + SELF_CLEARANCE;
}

function createChangeRelationship({
  id,
  start,
  end,
}: Relationship): ChangeRelationship {
  return { id, start: copyAnchor(start), end: copyAnchor(end) };
}

/**
 * Positions within the set of relationships joining the same two tables, whose
 * angle keys all tie. Both ends read one sorted list and the larger table id
 * reads it backwards, because clockwise on one side is anticlockwise on the other.
 */
function pairIndexes(relationships: Relationship[]) {
  const groups = new Map<string, string[]>();

  for (const { id, start, end } of relationships) {
    const key = pairKey(start.tableId, end.tableId);
    const group = groups.get(key);
    if (group) {
      group.push(id);
    } else {
      groups.set(key, [id]);
    }
  }

  // Resolved up front into flat lookups. Searching the group on each call is
  // two linear scans per relationship, and this runs on every mousemove of a
  // drag.
  const indexById = new Map<string, number>();
  const sizeById = new Map<string, number>();
  let anyShared = false;

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    anyShared = true;
    group.sort();
    group.forEach((id, index) => {
      indexById.set(id, index);
      sizeById.set(id, group.length);
    });
  }

  return {
    tieAt(id: string, ownTableId: string, otherTableId: string) {
      if (!anyShared) return 0;

      const index = indexById.get(id) ?? 0;
      if (ownTableId <= otherTableId) return index;
      return (sizeById.get(id) ?? 1) - 1 - index;
    },
  };
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function normalizeAngle(angle: number) {
  const value = angle % TAU;
  return value < 0 ? value + TAU : value;
}

function orderAngle(
  direction: DirectionName,
  own: RelationshipGraph,
  other: RelationshipGraph
) {
  const theta = Math.atan2(
    other.centerY - own.centerY,
    other.centerX - own.centerX
  );
  return normalizeAngle(theta - SIDE_START_ANGLE[direction]);
}

/**
 * Chooses which side of each table the relationship leaves from: the nearest of
 * the sixteen side-midpoint pairs, DirectionNameList order breaking ties.
 * Obstacles are not consulted — routing past a table is the router's job.
 */
function getAndSetDirection(
  start: ObjectPoint,
  end: ObjectPoint,
  relationship: ChangeRelationship
): DirectionTuple {
  const direction: DirectionTuple = [
    DirectionName.bottom,
    DirectionName.bottom,
  ];

  let min = euclideanDistance(start.bottom, end.bottom);
  relationship.start.x = start.bottom.x;
  relationship.start.y = start.bottom.y;
  relationship.end.x = end.bottom.x;
  relationship.end.y = end.bottom.y;
  relationship.start.direction = Direction.bottom;
  relationship.end.direction = Direction.bottom;

  for (const key of DirectionNameList) {
    for (const key2 of DirectionNameList) {
      const k = key as DirectionName;
      const k2 = key2 as DirectionName;
      const temp = euclideanDistance(start[k], end[k2]);
      if (min <= temp) continue;

      min = temp;
      direction[0] = k;
      direction[1] = k2;
      relationship.start.x = start[k].x;
      relationship.start.y = start[k].y;
      relationship.start.direction = directionNameToDirection[k];
      relationship.end.x = end[k2].x;
      relationship.end.y = end[k2].y;
      relationship.end.direction = directionNameToDirection[k2];
    }
  }

  return direction;
}

/**
 * Spaces one side's anchors and records the slot each took. Spacing is capped
 * rather than filling the side, and when the side is too short for the cap the
 * anchors compress instead of spilling past the corners.
 */
function placeSide(
  direction: DirectionName,
  graph: RelationshipGraph,
  slotMap: Map<string, SlotPair>
) {
  const entries = graph[direction];
  if (!entries.length) return;

  // Ordering is by angle, then by the parallel-edge tie, then by id. The last
  // key is what makes the result independent of relationshipIds order, and so
  // identical across peers, workers and reserialisation.
  entries.sort(
    (a, b) => a.angle - b.angle || a.tie - b.tie || (a.id < b.id ? -1 : 1)
  );

  const { objectPoint } = graph;
  const isX =
    direction === DirectionName.top || direction === DirectionName.bottom;

  let low = (isX ? objectPoint.lt.x : objectPoint.lt.y) + ANCHOR_EDGE_INSET;
  let high = (isX ? objectPoint.rb.x : objectPoint.rb.y) - ANCHOR_EDGE_INSET;

  // Loops sit at the top-right corner, so they eat the far end of the top side
  // and the near end of the right one.
  const reserve = selfReserve(graph);
  if (reserve) {
    if (direction === DirectionName.top) {
      high -= reserve;
    } else if (direction === DirectionName.right) {
      low += reserve;
    }
  }
  if (high < low) {
    const middle = (low + high) / 2;
    low = middle;
    high = middle;
  }

  const available = high - low;
  const center = (low + high) / 2;

  const count = entries.length;
  const pitch =
    count > 1 ? Math.min(available / (count - 1), ANCHOR_MAX_PITCH) : 0;
  const first = center - (pitch * (count - 1)) / 2;

  entries.forEach((entry, index) => {
    // The clockwise walk runs against the axis on the bottom and left sides, so
    // the first entry takes the last position there.
    const step = WALKS_BACKWARDS[direction] ? count - 1 - index : index;
    const position = first + step * pitch;

    if (isX) {
      entry.point.x = position;
      entry.point.y =
        direction === DirectionName.top
          ? objectPoint.top.y
          : objectPoint.bottom.y;
    } else {
      entry.point.y = position;
      entry.point.x =
        direction === DirectionName.left
          ? objectPoint.left.x
          : objectPoint.right.x;
    }

    const slots = slotMap.get(entry.id);
    if (slots) {
      slots[entry.isStart ? 0 : 1] = index;
    }
  });
}
