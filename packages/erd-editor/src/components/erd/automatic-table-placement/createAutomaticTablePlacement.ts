import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3';

import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { query } from '@/utils/collection/query';
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
