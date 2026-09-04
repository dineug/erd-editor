import { query } from '@dineug/erd-editor-schema';
import { createInRange } from '@dineug/shared';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';

import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { relationshipSort } from '@/utils/draw-relationship/sort';

type Node = {
  id: string;
  r: number;
  x: number;
  y: number;
  ref: Table;
};

type Link = {
  source: string;
  target: string;
};

function createNodes(
  state: RootState,
  x: number,
  y: number
): [Array<Node>, Array<Link>] {
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

  const nodes: Node[] = [];
  const links: Link[] = [];
  const linkIdSet = new Set<string>();

  tables.forEach(table => {
    const width = calcTableWidths(table, state).width;
    const height = calcTableHeight(table);
    nodes.push({
      id: table.id,
      r: (width + height) / 4,
      x,
      y,
      ref: table,
    });
  });

  relationships.forEach(relationship => {
    const { start, end } = relationship;
    const linkId = `${start.tableId}-${end.tableId}`;

    if (start.tableId !== end.tableId && !linkIdSet.has(linkId)) {
      links.push({
        source: start.tableId,
        target: end.tableId,
      });
      linkIdSet.add(linkId);
    }
  });

  return [nodes, links];
}

const progressInRange = createInRange(0, 1);

/** The two readings of a simulation's heat that its progress is taken from. */
type Cooling = {
  alpha(): number;
  alphaMin(): number;
};

/**
 * How far a placement has run, from 0 to 1. The simulation cools by a fixed
 * factor a tick until its heat reaches the floor it stops at, so the log of
 * the heat over the log of that floor is the share of the ticks it will take.
 *
 * @example
 * simulation.on('tick.progress', () => {
 *   state.progress = placementProgress(simulation);
 * });
 */
export function placementProgress(simulation: Cooling): number {
  return progressInRange(
    Math.log(simulation.alpha()) / Math.log(simulation.alphaMin())
  );
}

export function createAutomaticTablePlacement(state: RootState) {
  const { settings } = state;
  const centerX = settings.width / 2;
  const centerY = settings.height / 2;
  const [nodes, links] = createNodes(state, centerX, centerY);

  return forceSimulation(nodes)
    .force(
      'link',
      forceLink(links).id((d: any) => d.id)
    )
    .force(
      'collide',
      forceCollide().radius((d: any) => 100 + d.r)
    )
    .force('charge', forceManyBody())
    .force('x', forceX(centerX))
    .force('y', forceY(centerY))
    .on('tick', () => {
      nodes.forEach(({ r, x, y, ref }) => {
        ref.ui.x = x - r;
        ref.ui.y = y - r;
      });
      relationshipSort(state);
    });
}
