import '@/services/elk-layout/elkWorkerRealm';

import type { ELK, ElkNode, ElkPort, LayoutOptions } from 'elkjs/lib/elk-api';

import type {
  ElkLayoutEdge,
  ElkLayoutNode,
  ElkLayoutPoint,
  ElkLayoutRequest,
} from './elkGraph';
import {
  ELK_ALGORITHMS,
  elkLayoutOptions,
  elkNodeLayoutOptions,
  GROUP_NODE_OPTIONS,
  usesPorts,
} from './elkLayoutOptions';

/** The box a port is given. ELK reserves it; the editor draws none of it. */
const PORT_SIZE = 8;

/** Which side of a table a relationship leaves by, in the one layered direction flow takes. */
const SOURCE_SIDE = 'EAST';

const TARGET_SIDE = 'WEST';

type SidedPort = {
  id: string;
  row: number;
  side: typeof SOURCE_SIDE | typeof TARGET_SIDE;
};

const sourcePortId = (index: number) => `edge-${index}-source`;

const targetPortId = (index: number) => `edge-${index}-target`;

/**
 * A fixed order is read clockwise from the top left corner, so an east side
 * runs down the rows and a west side back up them. Measured against ELK rather
 * than assumed: a west side listed downwards comes out upside down.
 */
function byClockwiseRow(a: SidedPort, b: SidedPort): number {
  if (a.side !== b.side) return a.side === SOURCE_SIDE ? -1 : 1;

  return a.side === SOURCE_SIDE ? a.row - b.row : b.row - a.row;
}

/** One port per relationship endpoint, grouped by the table it sits on. */
export function portsByNode(edges: ElkLayoutEdge[]): Map<string, ElkPort[]> {
  const byNode = new Map<string, SidedPort[]>();
  const add = (nodeId: string, port: SidedPort) => {
    const ports = byNode.get(nodeId);
    ports ? ports.push(port) : byNode.set(nodeId, [port]);
  };

  edges.forEach((edge, index) => {
    add(edge.source, {
      id: sourcePortId(index),
      row: edge.sourceRow,
      side: SOURCE_SIDE,
    });
    add(edge.target, {
      id: targetPortId(index),
      row: edge.targetRow,
      side: TARGET_SIDE,
    });
  });

  return new Map(
    [...byNode].map(([nodeId, ports]) => [
      nodeId,
      ports.sort(byClockwiseRow).map(({ id, side }) => ({
        id,
        width: PORT_SIZE,
        height: PORT_SIZE,
        layoutOptions: { 'elk.port.side': side },
      })),
    ])
  );
}

/**
 * The graph ELK is handed. An ERD nests no table in another, so the one node
 * that ever holds children is the group a request packs its unrelated tables
 * into, and every edge stays at the root whatever level its ends sit on.
 */
export function toElkGraph({
  placement,
  nodes,
  edges,
}: ElkLayoutRequest): ElkNode {
  const ports = usesPorts(placement) ? portsByNode(edges) : null;

  return {
    id: 'root',
    layoutOptions: elkLayoutOptions(placement),
    children: nodes.map(node => toElkChild(node, placement, ports)),
    edges: edges.map(({ source, target }, index) => ({
      id: `edge-${index}`,
      sources: [ports ? sourcePortId(index) : source],
      targets: [ports ? targetPortId(index) : target],
    })),
  };
}

/** One node of the graph: a table with its hint and ports, or a group holding tables. */
function toElkChild(
  { id, width, height, x, y, children }: ElkLayoutNode,
  placement: ElkLayoutRequest['placement'],
  ports: Map<string, ElkPort[]> | null
): ElkNode {
  if (children?.length) {
    return {
      id,
      width,
      height,
      layoutOptions: { ...GROUP_NODE_OPTIONS },
      children: children.map(child => toElkChild(child, placement, ports)),
    };
  }

  const layoutOptions: LayoutOptions = {
    ...elkNodeLayoutOptions(placement),
    // Only a node whose ports are fixed has ELK read the order they were
    // listed in; left free it sorts them itself and the rows mean nothing.
    ...(ports ? { 'elk.portConstraints': 'FIXED_ORDER' } : {}),
  };

  return {
    id,
    width,
    height,
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
    ...(Object.keys(layoutOptions).length ? { layoutOptions } : {}),
    ...(ports ? { ports: ports.get(id) ?? [] } : {}),
  };
}

/**
 * Every table of a laid out graph, at the coordinates the root works in. ELK
 * answers a child of a group relative to that group, and a caller placing
 * tables has no group to place them in.
 */
function toAbsolutePoints(
  children: ElkNode[],
  offsetX: number,
  offsetY: number
): ElkLayoutPoint[] {
  return children.flatMap(({ id, x, y, children: nested }) => {
    const absoluteX = offsetX + (x ?? 0);
    const absoluteY = offsetY + (y ?? 0);

    return nested?.length
      ? toAbsolutePoints(nested, absoluteX, absoluteY)
      : [{ id, x: absoluteX, y: absoluteY }];
  });
}

let elk: Promise<ELK> | null = null;

/**
 * ELK, loaded on first use. The import has to be this one rather than a static
 * one, because a static import is evaluated before any statement in its own
 * module and the realm above would then be stubbed too late to be read.
 */
function loadElk(): Promise<ELK> {
  elk ??= import('elkjs/lib/elk.bundled.js').then(
    ({ default: ELKConstructor }) =>
      new ELKConstructor({ algorithms: ELK_ALGORITHMS })
  );

  return elk;
}

/**
 * Places tables by an ELK algorithm, off the thread that asked for it. What
 * comes back is a corner per table and nothing else, because the editor routes
 * its own relationship lines and drops the sections ELK computed for them.
 */
export class ElkLayoutService {
  /**
   * Loading ELK at all is what proves this realm can run it. A shared worker
   * that throws while evaluating reports it to the console and to nobody else:
   * its port stays open and every call after it hangs.
   */
  async ready(): Promise<boolean> {
    await loadElk();

    return true;
  }

  async layout(request: ElkLayoutRequest): Promise<ElkLayoutPoint[]> {
    const graph = await (await loadElk()).layout(toElkGraph(request));

    return toAbsolutePoints(graph.children ?? [], 0, 0);
  }
}
