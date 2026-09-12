import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { getContentRect } from '@/konva/scene/contentBounds';
import { getTableRect } from '@/konva/scene/metrics';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

import { type ElkPlacement, usesCoordinateHints } from './elkLayoutOptions';

export type ElkLayoutNode = {
  id: string;
  width: number;
  height: number;
  /**
   * Where the source already draws this table, normalized into node widths.
   * Only a placement whose strategies read a hint is sent one, and a view that
   * has not placed the table yet hints from where the document draws it.
   */
  x?: number;
  y?: number;
  /** What is laid out inside this node, which is what makes it a group rather than a table. */
  children?: ElkLayoutNode[];
};

/**
 * Which tables a request covers and what it measures them by. The source picks
 * both the sizes and the hints, and grouping packs the tables no relationship
 * reaches into one box instead of scattering them through the layers.
 */
export type ElkLayoutRequestOptions = {
  tableIds?: string[];
  source?: GeometrySource;
  groupUnrelated?: boolean;
};

export type ElkLayoutEdge = {
  source: string;
  target: string;
  /**
   * Which row of each table the relationship meets, counted from the top, or
   * -1 where the column it names is gone. A placement that hands ELK ports
   * orders them by this, so a layout reads the connectors the editor draws.
   */
  sourceRow: number;
  targetRow: number;
};

/**
 * A layout as it crosses a realm boundary. Only the boxes and what joins them
 * travel, so the answering realm measures no text and reads no document.
 */
export type ElkLayoutRequest = {
  placement: ElkPlacement;
  nodes: ElkLayoutNode[];
  edges: ElkLayoutEdge[];
};

/** Where one table's top left corner ended up, in scene units. */
export type ElkLayoutPoint = {
  id: string;
  x: number;
  y: number;
};

/** What a document drawing nothing is centred on, which is a point at the origin. */
const EMPTY_RECT = { x: 0, y: 0, width: 0, height: 0 };

/** A relationship whose column is gone, which sorts above every row there is. */
const NO_ROW = -1;

/** The one node that is not a table, holding every table no relationship reaches. */
const UNRELATED_GROUP_ID = 'elk-unrelated-group';

/**
 * The topmost row a relationship touches. A composite key names several, and
 * the editor draws one connector for all of them, so the first is the one.
 */
function rowOf(
  columnIds: string[] | undefined,
  endpointColumnIds: string[]
): number {
  if (!columnIds) return NO_ROW;

  const rows = endpointColumnIds
    .map(columnId => columnIds.indexOf(columnId))
    .filter(row => row !== NO_ROW);

  return rows.length ? Math.min(...rows) : NO_ROW;
}

/**
 * Puts the hint every node carries into node widths, measured from the corner
 * of the box the source draws. Handed the raw coordinates instead, the
 * INTERACTIVE strategies read one document row back as one layer per table.
 */
function toHints(
  nodes: ElkLayoutNode[],
  points: Map<string, { x: number; y: number }>
): void {
  const placed = nodes.filter(node => points.has(node.id));
  if (!placed.length) return;

  const scale =
    placed.reduce((total, node) => total + node.width, 0) / placed.length;
  if (scale <= 0) return;

  const xs = placed.map(node => points.get(node.id)!.x);
  const ys = placed.map(node => points.get(node.id)!.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  placed.forEach(node => {
    const { x, y } = points.get(node.id)!;
    node.x = (x - minX) / scale;
    node.y = (y - minY) / scale;
  });
}

/**
 * What ELK is asked to place, at the sizes the source draws. Nodes carry a
 * hint of where they already stand where the placement reads one, and grouping
 * folds the tables no relationship reaches into one packed box.
 *
 * @example
 * createElkLayoutRequest(state, TablePlacement.liamLayered, { source: 'flow' });
 */
export function createElkLayoutRequest(
  state: RootState,
  placement: ElkPlacement,
  {
    tableIds,
    source = 'document',
    groupUnrelated,
  }: ElkLayoutRequestOptions = {}
): ElkLayoutRequest {
  const {
    doc: { relationshipIds },
    collections,
  } = state;
  const shown = tableIds ?? state.doc.tableIds;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(shown);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);

  // The scene's own measurement, cached per source, rather than a second copy
  // of the same sums: a box ELK is given and the box the source draws cannot
  // then disagree about how tall a table under a show mode is.
  const rects = new Map(
    tables.map(table => [table.id, getTableRect(state, table, source)] as const)
  );
  const nodes = tables.map<ElkLayoutNode>(table => {
    const { width, height } = rects.get(table.id)!;

    return { id: table.id, width, height };
  });

  const nodeIdSet = new Set(nodes.map(node => node.id));
  const rowsByTable = new Map(tables.map(table => [table.id, table.columnIds]));
  const edgeIdSet = new Set<string>();
  const edges: ElkLayoutEdge[] = [];

  relationships.forEach(({ start, end }) => {
    // A self reference says nothing about where a table goes, and a second
    // edge between one pair only costs ELK the same crossing weighed twice.
    if (start.tableId === end.tableId) return;
    if (!nodeIdSet.has(start.tableId) || !nodeIdSet.has(end.tableId)) return;

    const edgeId = `${start.tableId}-${end.tableId}`;
    if (edgeIdSet.has(edgeId)) return;

    edgeIdSet.add(edgeId);
    edges.push({
      source: start.tableId,
      target: end.tableId,
      sourceRow: rowOf(rowsByTable.get(start.tableId), start.columnIds),
      targetRow: rowOf(rowsByTable.get(end.tableId), end.columnIds),
    });
  });

  if (usesCoordinateHints(placement)) {
    toHints(nodes, rects);
  }

  return {
    placement,
    nodes: groupUnrelated ? withUnrelatedGroup(nodes, edges) : nodes,
    edges,
  };
}

/**
 * The nodes no edge reaches, moved inside one group node at the end of the
 * list. ELK sizes and places that node like any other, and what comes back is
 * flat, so nothing downstream learns the group was ever there.
 */
function withUnrelatedGroup(
  nodes: ElkLayoutNode[],
  edges: ElkLayoutEdge[]
): ElkLayoutNode[] {
  const related = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  const unrelated = nodes.filter(node => !related.has(node.id));
  if (!unrelated.length) return nodes;

  return [
    ...nodes.filter(node => related.has(node.id)),
    { id: UNRELATED_GROUP_ID, width: 0, height: 0, children: unrelated },
  ];
}

/** Every table in a node list, which is every node the group nodes do not hold. */
export function flattenElkNodes(nodes: ElkLayoutNode[]): ElkLayoutNode[] {
  return nodes.flatMap(node =>
    node.children?.length ? flattenElkNodes(node.children) : [node]
  );
}

/** The box the placed tables occupy, or null when none of them were placed. */
function boundsOfLayout(
  nodes: ElkLayoutNode[],
  points: ElkLayoutPoint[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const sizeById = new Map(
    flattenElkNodes(nodes).map(node => [node.id, node] as const)
  );
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach(({ id, x, y }) => {
    const size = sizeById.get(id);
    if (!size) return;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + size.width);
    maxY = Math.max(maxY, y + size.height);
  });

  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/**
 * Where each table lands, over the middle of what the document already draws.
 * ELK lays every graph out from its own origin, so a document placed twice
 * would otherwise walk away from where it was read.
 *
 * @example
 * onChange(toTablePoints(store.state, request, await createElkLayout(request)));
 */
export function toTablePoints(
  state: RootState,
  { nodes }: ElkLayoutRequest,
  points: ElkLayoutPoint[]
): ElkLayoutPoint[] {
  const bounds = boundsOfLayout(nodes, points);
  if (!bounds) return [];

  const content = getContentRect(state) ?? EMPTY_RECT;
  const offsetX =
    content.x + content.width / 2 - (bounds.minX + bounds.maxX) / 2;
  const offsetY =
    content.y + content.height / 2 - (bounds.minY + bounds.maxY) / 2;
  return offsetBy(nodes, points, offsetX, offsetY);
}

/**
 * Where each table lands in a view, whose coordinates start at its own corner.
 * A view shares nothing with the document, so unlike a placement of the
 * document this reads no content rect and centres the layout on nothing.
 *
 * @example
 * dispatch(viewSetLayout({ positions: toViewPoints(request, points) }));
 */
export function toViewPoints(
  { nodes }: ElkLayoutRequest,
  points: ElkLayoutPoint[]
): ElkLayoutPoint[] {
  const bounds = boundsOfLayout(nodes, points);
  if (!bounds) return [];

  return offsetBy(nodes, points, -bounds.minX, -bounds.minY);
}

/** The points of the tables the request asked for, moved by the offset given. */
function offsetBy(
  nodes: ElkLayoutNode[],
  points: ElkLayoutPoint[],
  offsetX: number,
  offsetY: number
): ElkLayoutPoint[] {
  const placed = new Set(flattenElkNodes(nodes).map(node => node.id));

  return points
    .filter(({ id }) => placed.has(id))
    .map(({ id, x, y }) => ({ id, x: x + offsetX, y: y + offsetY }));
}
