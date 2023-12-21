import { query } from '@dineug/erd-editor-schema';
import {
  create,
  drag,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  scaleOrdinal,
  schemeCategory10,
} from 'd3';

import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

const Group = {
  table: 'table',
  column: 'column',
} as const;
type Group = ValuesType<typeof Group>;

type Node = {
  id: string;
  group: Group;
  name: string;
  tableId?: string;
};

type Link = {
  source: string;
  target: string;
};

type Visualization = {
  nodes: Node[];
  links: Link[];
};

function convertVisualization({
  doc: { tableIds, relationshipIds },
  collections,
}: RootState): Visualization {
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);

  const data: Visualization = {
    nodes: [],
    links: [],
  };
  const linkIdSet = new Set<string>();

  tables.forEach(table => {
    data.nodes.push({
      id: table.id,
      name: table.name,
      group: Group.table,
    });
    query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds)
      .forEach(column => {
        data.nodes.push({
          id: column.id,
          name: column.name,
          group: Group.column,
          tableId: table.id,
        });
        data.links.push({
          source: table.id,
          target: column.id,
        });
      });
  });

  relationships.forEach(relationship => {
    const { start, end } = relationship;
    const linkId = `${start.tableId}-${end.tableId}`;

    if (start.tableId !== end.tableId && !linkIdSet.has(linkId)) {
      data.links.push({
        source: start.tableId,
        target: end.tableId,
      });
      linkIdSet.add(linkId);
    }
  });

  return data;
}

const scale = scaleOrdinal(schemeCategory10);

type Props = {
  onDragStart: () => void;
  onDragEnd: () => void;
  onStartPreview: (
    event: MouseEvent,
    tableId: string | null,
    columnId: string | null
  ) => void;
  onEndPreview: () => void;
};

function onDrag(simulation: any, props: Props): any {
  return drag()
    .on('start', (event, d: any) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      props.onDragStart();
    })
    .on('drag', (event, d: any) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d: any) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      props.onDragEnd();
    });
}

export function createVisualization(state: RootState, props: Props) {
  const data = convertVisualization(state);
  const links = data.links.map(d => Object.create(d));
  const nodes = data.nodes.map(d => Object.create(d));

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink(links).id((d: any) => d.id)
    )
    .force('charge', forceManyBody())
    .force('x', forceX())
    .force('y', forceY());

  const svg = create('svg');

  const link = svg
    .append('g')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', Math.sqrt(2));

  const node = svg
    .append('g')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 5)
    .attr('fill', d => scale(d.group))
    .call(onDrag(simulation, props));

  node.on('mouseenter', (event, d) => {
    const node = data.nodes[d.index];
    let tableId: string | null = null;
    let columnId: string | null = null;
    if (node.group === Group.table) {
      tableId = node.id;
    } else if (node.group === Group.column && node.tableId) {
      tableId = node.tableId;
      columnId = node.id;
    }
    props.onStartPreview(event, tableId, columnId);
  });
  node.on('mouseleave', () => {
    props.onEndPreview();
  });

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node.attr('cx', d => d.x).attr('cy', d => d.y);
  });

  return svg;
}
