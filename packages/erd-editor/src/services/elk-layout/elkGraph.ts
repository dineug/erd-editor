import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { getContentRect } from '@/konva/scene/contentBounds';
import { getTableRect, type Rect, unionRect } from '@/konva/scene/metrics';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { getTableGroupId, padRect } from '@/utils/tableGroup';

import {
  type ElkCompoundKind,
  type ElkPlacement,
  keepsTableGroups,
  usesCoordinateHints,
} from './elkLayoutOptions';

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
  /** What a node holding children stands for, left out for the box of unrelated tables. */
  kind?: ElkCompoundKind;
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

/** What a component node's id starts with, which no table id does. */
const COMPONENT_ID_PREFIX = 'elk-component-';

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
function toHints(nodes: ElkLayoutNode[], rects: Rect[]): void {
  if (!nodes.length) return;

  const scale =
    nodes.reduce((total, node) => total + node.width, 0) / nodes.length;
  if (scale <= 0) return;

  const minX = Math.min(...rects.map(({ x }) => x));
  const minY = Math.min(...rects.map(({ y }) => y));

  nodes.forEach((node, index) => {
    node.x = (rects[index].x - minX) / scale;
    node.y = (rects[index].y - minY) / scale;
  });
}

/**
 * What ELK is asked to place, at the sizes the source draws, with a hint where
 * the placement reads one. A document placement keeps each table group in a
 * node, and grouping folds the tables no relationship reaches into one box.
 *
 * @example
 * createElkLayoutRequest(state, TablePlacement.viewLayered, { source: 'flow' });
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
  const { doc, collections } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds ?? doc.tableIds);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(doc.relationshipIds);

  // The scene's own measurement, cached per source, rather than a second copy
  // of the same sums: a box ELK is given and the box the source draws cannot
  // then disagree about how tall a table under a show mode is.
  const rects = tables.map(table => getTableRect(state, table, source));
  const nodes = tables.map<ElkLayoutNode>((table, index) => ({
    id: table.id,
    width: rects[index].width,
    height: rects[index].height,
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

  if (usesCoordinateHints(placement)) {
    toHints(nodes, rects);
  }

  const grouped = keepsTableGroups(placement)
    ? withTableGroups(state, tables, nodes, edges)
    : nodes;

  return {
    placement,
    nodes: groupUnrelated ? withUnrelatedGroup(grouped, edges) : grouped,
    edges,
  };
}

/**
 * The connected parts of a graph whose nodes are the ids given and whose links
 * are the pairs, each id answered with the one id its part is known by.
 */
function connectedParts(
  ids: string[],
  pairs: Array<[string, string]>
): (id: string) => string {
  const parents = new Map(ids.map(id => [id, id]));
  const find = (id: string): string => {
    const parent = parents.get(id)!;
    if (parent === id) return id;

    const root = find(parent);
    parents.set(id, root);
    return root;
  };

  pairs.forEach(([a, b]) => parents.set(find(a), find(b)));

  return find;
}

/**
 * Each group's members in a node of the group where its first member stood,
 * and what relationships join across a group's border in a component node laid
 * out as one; the rest stay at the top, where ELK packs what nothing joins.
 */
function withTableGroups(
  state: RootState,
  tables: Table[],
  nodes: ElkLayoutNode[],
  edges: ElkLayoutEdge[]
): ElkLayoutNode[] {
  const groupIds = new Map(
    tables.map(table => [table.id, getTableGroupId(state, table)])
  );
  const groups = new Map<string, ElkLayoutNode>();
  const blocks: ElkLayoutNode[] = [];

  nodes.forEach(node => {
    const groupId = groupIds.get(node.id);
    const group = groupId ? groups.get(groupId) : undefined;

    if (!groupId) {
      blocks.push(node);
    } else if (group) {
      group.children!.push(node);
    } else {
      const created: ElkLayoutNode = {
        id: groupId,
        width: 0,
        height: 0,
        kind: 'tableGroup',
        children: [node],
      };
      groups.set(groupId, created);
      blocks.push(created);
    }
  });

  if (!groups.size) return nodes;

  const blockOf = (tableId: string) => groupIds.get(tableId) || tableId;
  const links = edges
    .map(({ source, target }): [string, string] => [
      blockOf(source),
      blockOf(target),
    ])
    .filter(([a, b]) => a !== b);
  const partOf = connectedParts(
    blocks.map(block => block.id),
    links
  );
  // Only a link that reaches a group crosses a border; two tables in no group
  // are joined at whatever level they sit, which is the root.
  const crossing = new Set(
    links
      .filter(([a, b]) => groups.has(a) || groups.has(b))
      .map(([a]) => partOf(a))
  );
  const components = new Map<string, ElkLayoutNode>();

  return blocks.flatMap(block => {
    const part = partOf(block.id);
    if (!crossing.has(part)) return [block];

    const component = components.get(part);
    if (component) {
      component.children!.push(block);
      return [];
    }

    const created: ElkLayoutNode = {
      id: `${COMPONENT_ID_PREFIX}${components.size}`,
      width: 0,
      height: 0,
      kind: 'component',
      children: [block],
    };
    components.set(part, created);
    return [created];
  });
}

/**
 * The tables no edge reaches, moved inside one group node at the end of the
 * list, a node holding children left where it is. ELK places the box like any
 * node, and what comes back is flat, so nothing downstream learns of it.
 */
function withUnrelatedGroup(
  nodes: ElkLayoutNode[],
  edges: ElkLayoutEdge[]
): ElkLayoutNode[] {
  const related = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  const unrelated = new Set(
    nodes.filter(node => !node.children && !related.has(node.id))
  );
  if (!unrelated.size) return nodes;

  return [
    ...nodes.filter(node => !unrelated.has(node)),
    {
      id: UNRELATED_GROUP_ID,
      width: 0,
      height: 0,
      children: [...unrelated],
    },
  ];
}

/** Every table in a node list, which is every node the group nodes do not hold. */
export function flattenElkNodes(nodes: ElkLayoutNode[]): ElkLayoutNode[] {
  return nodes.flatMap(node =>
    node.children?.length ? flattenElkNodes(node.children) : [node]
  );
}

/**
 * The boxes a layout draws: each placed table, and round the members of each
 * table group the box the editor draws for it, its padding and title bar.
 */
function layoutRects(
  nodes: ElkLayoutNode[],
  pointById: Map<string, ElkLayoutPoint>
): Rect[] {
  return nodes.flatMap(node => {
    if (!node.children?.length) {
      const point = pointById.get(node.id);
      return point
        ? [{ x: point.x, y: point.y, width: node.width, height: node.height }]
        : [];
    }

    const inner = layoutRects(node.children, pointById);
    return node.kind === 'tableGroup' && inner.length
      ? [...inner, padRect(inner.reduce(unionRect))]
      : inner;
  });
}

/** The box what was placed draws, groups included, or null when nothing was placed. */
function boundsOfLayout(
  nodes: ElkLayoutNode[],
  points: ElkLayoutPoint[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const rects = layoutRects(
    nodes,
    new Map(points.map(point => [point.id, point]))
  );
  if (!rects.length) return null;

  return {
    minX: Math.min(...rects.map(({ x }) => x)),
    minY: Math.min(...rects.map(({ y }) => y)),
    maxX: Math.max(...rects.map(({ x, width }) => x + width)),
    maxY: Math.max(...rects.map(({ y, height }) => y + height)),
  };
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
