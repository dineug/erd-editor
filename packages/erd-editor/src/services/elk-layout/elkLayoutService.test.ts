import { describe, expect, it } from 'vite-plus/test';

import { TablePlacement } from '@/constants/tablePlacement';
import type {
  ElkLayoutEdge,
  ElkLayoutRequest,
} from '@/services/elk-layout/elkGraph';
import {
  ElkLayoutService,
  portsByNode,
  toElkGraph,
} from '@/services/elk-layout/elkLayoutService';

const edge = (
  source: string,
  target: string,
  sourceRow = 0,
  targetRow = 0
): ElkLayoutEdge => ({ source, target, sourceRow, targetRow });

const box = (id: string) => ({ id, width: 200, height: 100 });

const chain = (placement: ElkLayoutRequest['placement']): ElkLayoutRequest => ({
  placement,
  nodes: [box('t1'), box('t2'), box('t3')],
  edges: [edge('t1', 't2'), edge('t2', 't3')],
});

/** One table whose three foreign keys leave it at rows 2, 0 and 1. */
const fanOut = (): ElkLayoutRequest => ({
  placement: TablePlacement.flow,
  nodes: [box('users'), box('a'), box('b'), box('c')],
  edges: [
    edge('users', 'a', 2, 0),
    edge('users', 'b', 0, 0),
    edge('users', 'c', 1, 0),
  ],
});

describe('portsByNode', () => {
  it('gives every relationship endpoint a port of its own', () => {
    const ports = portsByNode(fanOut().edges);

    expect(ports.get('users')).toHaveLength(3);
    expect(['a', 'b', 'c'].map(id => ports.get(id)?.length)).toEqual([1, 1, 1]);
  });

  it('leaves a table by the east side and arrives on the west', () => {
    const ports = portsByNode([edge('t1', 't2')]);

    expect(ports.get('t1')?.[0].layoutOptions).toEqual({
      'elk.port.side': 'EAST',
    });
    expect(ports.get('t2')?.[0].layoutOptions).toEqual({
      'elk.port.side': 'WEST',
    });
  });

  it('lists an east side down the rows, which is what a fixed order reads', () => {
    const ports = portsByNode(fanOut().edges) ?? [];

    expect(ports.get('users')?.map(port => port.id)).toEqual([
      'edge-1-source',
      'edge-2-source',
      'edge-0-source',
    ]);
  });

  // Measured against ELK: a fixed order runs clockwise from the top left, so
  // a west side listed downwards comes out upside down.
  it('lists a west side back up the rows', () => {
    const ports = portsByNode([
      edge('a', 'posts', 0, 2),
      edge('b', 'posts', 0, 0),
      edge('c', 'posts', 0, 1),
    ]);

    expect(ports.get('posts')?.map(port => port.id)).toEqual([
      'edge-0-target',
      'edge-2-target',
      'edge-1-target',
    ]);
  });

  it('puts every east port before every west one on a table with both', () => {
    const ports = portsByNode([edge('mid', 'out'), edge('in', 'mid')]);
    const sides = ports
      .get('mid')
      ?.map(port => port.layoutOptions?.['elk.port.side']);

    expect(sides).toEqual(['EAST', 'WEST']);
  });

  it('gives every port a box, because elk reserves room for one', () => {
    for (const ports of portsByNode(fanOut().edges).values()) {
      for (const port of ports) {
        expect(port.width).toBeGreaterThan(0);
        expect(port.height).toBeGreaterThan(0);
      }
    }
  });
});

describe('toElkGraph', () => {
  it('builds one flat root, because an erd nests no table in another', () => {
    const graph = toElkGraph(chain(TablePlacement.layeredHorizontal));

    expect(graph.id).toBe('root');
    expect(graph.children?.every(child => !('children' in child))).toBe(true);
  });

  it('carries the size of every node through unchanged', () => {
    const request = chain(TablePlacement.layeredHorizontal);

    expect(toElkGraph(request).children).toEqual(request.nodes);
  });

  it('gives every edge an id of its own, which elk requires', () => {
    const graph = toElkGraph(chain(TablePlacement.layeredHorizontal));
    const ids = graph.edges?.map(edge => edge.id) ?? [];

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('joins node to node for a placement that asks for no port', () => {
    const graph = toElkGraph(chain(TablePlacement.layeredVertical));

    expect(graph.edges?.[0]).toMatchObject({
      sources: ['t1'],
      targets: ['t2'],
    });
    expect(graph.children?.every(child => !('ports' in child))).toBe(true);
  });

  it('joins port to port for flow, and fixes the order on every node', () => {
    const graph = toElkGraph(chain(TablePlacement.flow));

    expect(graph.edges?.[0]).toMatchObject({
      sources: ['edge-0-source'],
      targets: ['edge-0-target'],
    });
    expect(
      graph.children?.every(
        child => child.layoutOptions?.['elk.portConstraints'] === 'FIXED_ORDER'
      )
    ).toBe(true);
  });

  it('gives a table joined to nothing an empty port list rather than none', () => {
    const graph = toElkGraph({
      placement: TablePlacement.flow,
      nodes: [box('lonely')],
      edges: [],
    });

    expect(graph.children?.[0].ports).toEqual([]);
  });

  it('names the algorithm for the placement it was given', () => {
    expect(
      toElkGraph(chain(TablePlacement.flow)).layoutOptions?.['elk.algorithm']
    ).toBe('layered');
  });
});

describe('ElkLayoutService', () => {
  it('answers its handshake, which is what proves elk evaluated here', async () => {
    await expect(new ElkLayoutService().ready()).resolves.toBe(true);
  });

  it('places every node it was given, once each', async () => {
    const points = await new ElkLayoutService().layout(
      chain(TablePlacement.layeredHorizontal)
    );

    expect(points.map(point => point.id).sort()).toEqual(['t1', 't2', 't3']);
  });

  it('lays a chain out left to right for the horizontal placement', async () => {
    const points = await new ElkLayoutService().layout(
      chain(TablePlacement.layeredHorizontal)
    );
    const byId = new Map(points.map(point => [point.id, point]));

    expect(byId.get('t2')!.x).toBeGreaterThan(byId.get('t1')!.x);
    expect(byId.get('t3')!.x).toBeGreaterThan(byId.get('t2')!.x);
  });

  it('lays the same chain out top to bottom for the vertical placement', async () => {
    const points = await new ElkLayoutService().layout(
      chain(TablePlacement.layeredVertical)
    );
    const byId = new Map(points.map(point => [point.id, point]));

    expect(byId.get('t2')!.y).toBeGreaterThan(byId.get('t1')!.y);
    expect(byId.get('t3')!.y).toBeGreaterThan(byId.get('t2')!.y);
  });

  // The whole point of the ports: the rows a relationship leaves a table at
  // decide which of its neighbours ends up above which.
  it('orders what one table fans out to by the row each leaves it at', async () => {
    const points = await new ElkLayoutService().layout(fanOut());
    const byId = new Map(points.map(point => [point.id, point]));

    expect(byId.get('b')!.y).toBeLessThan(byId.get('c')!.y);
    expect(byId.get('c')!.y).toBeLessThan(byId.get('a')!.y);
  });

  // A junction table is short and joined to everything, so ELK is asked for
  // more ports than fit along its side. It squeezes them rather than growing
  // the box, and the box is what the placement reads.
  it('keeps a hub table its own size when its ports outnumber its rows', async () => {
    const spokes = Array.from({ length: 12 }, (_, index) => `t${index}`);
    const points = await new ElkLayoutService().layout({
      placement: TablePlacement.flow,
      nodes: [
        { id: 'hub', width: 200, height: 60 },
        ...spokes.map(id => ({ id, width: 200, height: 60 })),
      ],
      edges: spokes.map((id, index) => edge('hub', id, index, 0)),
    });
    const ys = spokes.map(id => points.find(point => point.id === id)!.y);

    expect(points).toHaveLength(spokes.length + 1);
    expect(ys.every((y, index) => index === 0 || y > ys[index - 1])).toBe(true);
  });

  // The visible difference the SIMPLE placement buys: a table that fans out
  // sits level with the middle of what it feeds, rather than pulled onto the
  // longest straight run its layer allows.
  it('centres a branch point over what it feeds, where layered does not', async () => {
    const fan = (
      placement: ElkLayoutRequest['placement']
    ): ElkLayoutRequest => ({
      placement,
      nodes: ['A', 'B', 'D', 'C', 'E', 'F', 'G'].map(box),
      edges: [
        edge('A', 'B', 0, 0),
        edge('A', 'D', 1, 0),
        edge('A', 'C', 2, 0),
        edge('B', 'E', 0, 0),
        edge('D', 'E', 0, 1),
        edge('C', 'E', 0, 2),
        edge('E', 'F', 0, 0),
        edge('E', 'G', 1, 0),
      ],
    });
    const centreOf = async (placement: ElkLayoutRequest['placement']) => {
      const points = await new ElkLayoutService().layout(fan(placement));
      const middle = new Map(points.map(point => [point.id, point.y + 50]));

      return {
        branch: middle.get('E')!,
        fed: (middle.get('F')! + middle.get('G')!) / 2,
      };
    };

    const flow = await centreOf(TablePlacement.flow);
    const plain = await centreOf(TablePlacement.layeredHorizontal);

    expect(flow.branch).toBeCloseTo(flow.fed, 6);
    expect(plain.branch).not.toBeCloseTo(plain.fed, 6);
  });

  // The west side of the same rule, and the half a listing order that reads
  // clockwise gets wrong: three tables feeding one at its rows 0, 1 and 2 come
  // out in that order, not upside down.
  it('orders what feeds one table by the row each arrives at', async () => {
    const points = await new ElkLayoutService().layout({
      placement: TablePlacement.flow,
      nodes: [box('a'), box('b'), box('c'), box('hub')],
      edges: [
        edge('a', 'hub', 0, 0),
        edge('b', 'hub', 0, 1),
        edge('c', 'hub', 0, 2),
      ],
    });
    const byId = new Map(points.map(point => [point.id, point]));

    expect(byId.get('a')!.y).toBeLessThan(byId.get('b')!.y);
    expect(byId.get('b')!.y).toBeLessThan(byId.get('c')!.y);
  });

  it('lays a chain out left to right for flow too', async () => {
    const points = await new ElkLayoutService().layout(
      chain(TablePlacement.flow)
    );
    const byId = new Map(points.map(point => [point.id, point]));

    expect(byId.get('t2')!.x).toBeGreaterThan(byId.get('t1')!.x);
    expect(byId.get('t3')!.x).toBeGreaterThan(byId.get('t2')!.x);
  });

  it('leaves the two tables of a layer further apart than elk would by default', async () => {
    const points = await new ElkLayoutService().layout({
      placement: TablePlacement.layeredHorizontal,
      nodes: [box('root'), box('a'), box('b')],
      edges: [edge('root', 'a'), edge('root', 'b')],
    });
    const byId = new Map(points.map(point => [point.id, point]));
    const gap = Math.abs(byId.get('a')!.y - byId.get('b')!.y) - 100;

    expect(gap).toBeGreaterThanOrEqual(80);
  });

  it('lays a schema with a cycle out rather than refusing it', async () => {
    const points = await new ElkLayoutService().layout({
      placement: TablePlacement.layeredHorizontal,
      nodes: [box('t1'), box('t2')],
      edges: [edge('t1', 't2'), edge('t2', 't1')],
    });

    expect(points).toHaveLength(2);
    expect(points.every(point => Number.isFinite(point.x))).toBe(true);
  });

  it('places a table joined to nothing without overlapping the rest', async () => {
    const points = await new ElkLayoutService().layout({
      placement: TablePlacement.flow,
      nodes: [box('t1'), box('t2'), box('lonely')],
      edges: [edge('t1', 't2')],
    });
    const byId = new Map(points.map(point => [point.id, point]));
    const lonely = byId.get('lonely')!;

    expect(
      ['t1', 't2'].every(id => {
        const other = byId.get(id)!;
        return (
          Math.abs(other.x - lonely.x) >= 200 ||
          Math.abs(other.y - lonely.y) >= 100
        );
      })
    ).toBe(true);
  });

  it('answers an empty document with an empty layout', async () => {
    await expect(
      new ElkLayoutService().layout({
        placement: TablePlacement.flow,
        nodes: [],
        edges: [],
      })
    ).resolves.toEqual([]);
  });
});
