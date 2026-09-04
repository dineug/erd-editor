import { query } from '@dineug/erd-editor-schema';
import {
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from 'd3-force';

import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const Group = {
  table: 'table',
  column: 'column',
} as const;
export type Group = ValuesType<typeof Group>;

/**
 * One dot of the graph. d3 owns the position fields from the first step on,
 * and a pinned node is one whose fixed pair is set, which is how a drag holds
 * it against the forces the way the svg drag did.
 */
export type VisualizationNode = {
  id: string;
  group: Group;
  name: string;
  /** The table a column hangs off; a table node has none. */
  tableId: string | null;
  x: number;
  y: number;
  fx: number | null;
  fy: number | null;
};

export const LinkKind = {
  column: 'column',
  relationship: 'relationship',
} as const;
export type LinkKind = ValuesType<typeof LinkKind>;

/**
 * One line of the graph. Each end is an id when the link is built and the node
 * it named once the link force has resolved it, which createVisualization does
 * before it returns; linkEnds is the read that takes that for granted.
 */
export type VisualizationLink = {
  id: string;
  kind: LinkKind;
  source: VisualizationNode | string;
  target: VisualizationNode | string;
};

/**
 * How long each kind of link rests at, in scene units. A column stays close
 * to its table, and two tables a relationship joins keep enough room between
 * them for both of their columns and the names on them.
 */
const LINK_DISTANCE: Record<LinkKind, number> = {
  [LinkKind.column]: 36,
  [LinkKind.relationship]: 140,
};

/**
 * How hard every node pushes every other away, twice d3's default: the svg
 * graph drew dots alone, and a name under each dot needs the room.
 */
const CHARGE_STRENGTH = -60;

export type VisualizationGraph = {
  nodes: VisualizationNode[];
  links: VisualizationLink[];
};

export type Visualization = VisualizationGraph & {
  simulation: Simulation<VisualizationNode, VisualizationLink>;
};

/**
 * Asks d3 for a place. It lays a node with no coordinates on a spiral out from
 * the origin, which spreads a fresh graph instead of stacking it on one point.
 */
const UNPLACED = Number.NaN;

const createNode = (
  id: string,
  group: Group,
  name: string,
  tableId: string | null
): VisualizationNode => ({
  id,
  group,
  name,
  tableId,
  x: UNPLACED,
  y: UNPLACED,
  fx: null,
  fy: null,
});

/**
 * The document as a graph: a node per table and per column, a link from each
 * column to its table and one per pair of tables a relationship joins. The
 * pair is ordered, so the same two tables joined both ways draw two lines.
 */
export function convertVisualization({
  doc: { tableIds, relationshipIds },
  collections,
}: RootState): VisualizationGraph {
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);

  const nodes: VisualizationNode[] = [];
  const links: VisualizationLink[] = [];
  const linkIdSet = new Set<string>();

  tables.forEach(table => {
    nodes.push(createNode(table.id, Group.table, table.name, null));
    query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds)
      .forEach(column => {
        nodes.push(createNode(column.id, Group.column, column.name, table.id));
        links.push({
          id: `${table.id}-${column.id}`,
          kind: LinkKind.column,
          source: table.id,
          target: column.id,
        });
      });
  });

  // A relationship naming a table the document no longer holds is skipped: the
  // link force resolves each end by id and throws on one it cannot find.
  const tableIdSet = new Set(tables.map(table => table.id));

  relationships.forEach(({ start, end }) => {
    const linkId = `${start.tableId}-${end.tableId}`;

    if (
      start.tableId !== end.tableId &&
      tableIdSet.has(start.tableId) &&
      tableIdSet.has(end.tableId) &&
      !linkIdSet.has(linkId)
    ) {
      links.push({
        id: linkId,
        kind: LinkKind.relationship,
        source: start.tableId,
        target: end.tableId,
      });
      linkIdSet.add(linkId);
    }
  });

  return { nodes, links };
}

/**
 * Both ends of a link as nodes. The link force rewrote each id to its node when
 * createVisualization installed it, and no link reaches a scene before that.
 */
export function linkEnds(
  link: VisualizationLink
): [VisualizationNode, VisualizationNode] {
  return [link.source as VisualizationNode, link.target as VisualizationNode];
}

/**
 * The graph with the force layout running over it. The forces are the ones the
 * svg graph ran, links holding their length, nodes repelling and both axes
 * pulling toward the origin, which the view puts at the middle of the stage.
 *
 * @example
 * const { nodes, links, simulation } = createVisualization(store.state);
 * simulation.on('tick', redraw);
 */
export function createVisualization(state: RootState): Visualization {
  const { nodes, links } = convertVisualization(state);

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink<VisualizationNode, VisualizationLink>(links)
        .id(node => node.id)
        .distance(link => LINK_DISTANCE[link.kind])
    )
    .force('charge', forceManyBody().strength(CHARGE_STRENGTH))
    .force('x', forceX())
    .force('y', forceY());

  return { nodes, links, simulation };
}
