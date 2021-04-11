import { Store } from '@@types/engine/store';
import {
  scaleOrdinal,
  schemeCategory10,
  drag,
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  create,
} from 'd3';

type Group = 'table' | 'column';

interface Node {
  id: string;
  group: Group;
  name: string;
  tableId?: string;
}

interface Link {
  source: string;
  target: string;
}

interface Visualization {
  nodes: Node[];
  links: Link[];
}

function convertVisualization(store: Store): Visualization {
  const { tableState, relationshipState } = store;
  const data: Visualization = {
    nodes: [],
    links: [],
  };
  const tables = tableState.tables;
  const relationships = relationshipState.relationships;

  tables.forEach(table => {
    data.nodes.push({
      id: table.id,
      name: table.name,
      group: 'table',
    });
    table.columns.forEach(column => {
      data.nodes.push({
        id: column.id,
        name: column.name,
        group: 'column',
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
    if (
      start.tableId !== end.tableId &&
      isLink(data.links, start.tableId, end.tableId)
    ) {
      data.links.push({
        source: start.tableId,
        target: end.tableId,
      });
    }
  });

  return data;
}

function isLink(
  links: Link[],
  startTableId: string,
  endTableId: string
): boolean {
  let result = true;
  for (const link of links) {
    if (link.source === startTableId && link.target === endTableId) {
      result = false;
      break;
    }
  }
  return result;
}

/**
 * https://observablehq.com/@d3/disjoint-force-directed-graph
 */
const scale = scaleOrdinal(schemeCategory10);

function onDrag(simulation: any, callbacks: any): any {
  return drag()
    .on('start', (event, d: any) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      callbacks.dragStart();
    })
    .on('drag', (event, d: any) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d: any) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      callbacks.dragEnd();
    });
}

export function createVisualization(store: Store, callbacks: any) {
  const data = convertVisualization(store);
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
    .call(onDrag(simulation, callbacks));

  node.on('mouseover', (event, d) => {
    const node = data.nodes[d.index];
    let tableId: string | null = null;
    let columnId: string | null = null;
    if (node.group === 'table') {
      tableId = node.id;
    } else if (node.group === 'column' && node.tableId) {
      tableId = node.tableId;
      columnId = node.id;
    }
    callbacks.startPreview(tableId, columnId);
  });
  node.on('mouseleave', () => {
    callbacks.endPreview();
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
