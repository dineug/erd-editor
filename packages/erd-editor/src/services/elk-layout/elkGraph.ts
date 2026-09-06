import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { getContentRect } from '@/konva/scene/contentBounds';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';

import type { ElkPlacement } from './elkLayoutOptions';

export type ElkLayoutNode = {
  id: string;
  width: number;
  height: number;
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

export function createElkLayoutRequest(
  state: RootState,
  placement: ElkPlacement
): ElkLayoutRequest {
  const {
    doc: { tableIds, relationshipIds },
    collections,
  } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);

  const nodes = tables.map<ElkLayoutNode>(table => ({
    id: table.id,
    width: calcTableWidths(table, state).width,
    height: calcTableHeight(table),
  }));

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

  return { placement, nodes, edges };
}

/** The box the placed tables occupy, or null when none of them were placed. */
function boundsOfLayout(
  nodes: ElkLayoutNode[],
  points: ElkLayoutPoint[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const sizeById = new Map(nodes.map(node => [node.id, node]));
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
  const placed = new Set(nodes.map(node => node.id));

  return points
    .filter(({ id }) => placed.has(id))
    .map(({ id, x, y }) => ({ id, x: x + offsetX, y: y + offsetY }));
}
