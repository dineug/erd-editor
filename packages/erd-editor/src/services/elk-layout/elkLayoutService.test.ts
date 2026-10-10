import { describe, expect, it } from 'vite-plus/test';

import { TablePlacement } from '@/constants/tablePlacement';
import type {
  ElkLayoutEdge,
  ElkLayoutPoint,
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

  it('asks for no hierarchy anywhere and keeps every edge at the root for a document with no group', () => {
    for (const placement of [
      TablePlacement.layeredHorizontal,
      TablePlacement.layeredVertical,
      TablePlacement.flow,
    ]) {
      const graph = toElkGraph(chain(placement));

      expect(JSON.stringify(graph)).not.toContain('hierarchyHandling');
      expect(graph.edges).toHaveLength(2);
      expect(graph.children?.every(child => !child.edges)).toBe(true);
    }
  });
});

/** Two groups a relationship joins, one member of each joined to nothing, and a table off on its own. */
const twoGroups = (
  placement: ElkLayoutRequest['placement']
): ElkLayoutRequest => ({
  placement,
  nodes: [
    {
      id: 'component',
      width: 0,
      height: 0,
      kind: 'component',
      children: [
        {
          id: 'g1',
          width: 0,
          height: 0,
          kind: 'tableGroup',
          children: [box('a1'), box('a2'), box('a3')],
        },
        {
          id: 'g2',
          width: 0,
          height: 0,
          kind: 'tableGroup',
          children: [box('b1'), box('b2')],
        },
      ],
    },
    box('alone'),
  ],
  edges: [edge('a1', 'a2'), edge('a2', 'b1')],
});

describe('toElkGraph with table groups', () => {
  it('tells ELK about each edge in the deepest node holding both its ends', () => {
    const graph = toElkGraph(twoGroups(TablePlacement.layeredHorizontal));
    const component = graph.children![0];
    const g1 = component.children![0];

    expect(graph.edges).toEqual([]);
    expect(component.edges?.map(({ id }) => id)).toEqual(['edge-1']);
    expect(g1.edges?.map(({ id }) => id)).toEqual(['edge-0']);
    expect(component.children![1]).not.toHaveProperty('edges');
  });

  it('lays a component out across its groups and gives each group the padding round its members', () => {
    const graph = toElkGraph(twoGroups(TablePlacement.layeredHorizontal));
    const component = graph.children![0];

    expect(component.layoutOptions?.['elk.hierarchyHandling']).toBe(
      'INCLUDE_CHILDREN'
    );
    expect(component.children?.[0].layoutOptions).toMatchObject({
      'elk.padding': '[top=52,left=24,bottom=24,right=24]',
      'elk.spacing.nodeNode': '80',
    });
    expect(graph.layoutOptions).not.toHaveProperty('elk.hierarchyHandling');
  });

  it('gives the tables inside a group their ports for flow, joined port to port across the border', () => {
    const graph = toElkGraph(twoGroups(TablePlacement.flow));
    const component = graph.children![0];
    const a2 = component.children![0].children![1];

    expect(component.edges?.[0]).toMatchObject({
      sources: ['edge-1-source'],
      targets: ['edge-1-target'],
    });
    expect(a2.ports?.map(({ id }) => id)).toEqual([
      'edge-1-source',
      'edge-0-target',
    ]);
    expect(a2.layoutOptions?.['elk.portConstraints']).toBe('FIXED_ORDER');
  });
});

/** Each group's box as the editor draws it: its members' bounds and the padding. */
function groupBoxes(
  points: ElkLayoutPoint[],
  members: Record<string, string[]>
) {
  const byId = new Map(points.map(point => [point.id, point]));

  return Object.fromEntries(
    Object.entries(members).map(([groupId, ids]) => {
      const rects = ids.map(id => ({
        ...byId.get(id)!,
        width: 200,
        height: 100,
      }));
      const left = Math.min(...rects.map(({ x }) => x)) - 24;
      const top = Math.min(...rects.map(({ y }) => y)) - 52;
      const right = Math.max(...rects.map(({ x, width }) => x + width)) + 24;
      const bottom = Math.max(...rects.map(({ y, height }) => y + height)) + 24;
      return [groupId, { left, top, right, bottom }];
    })
  );
}

type Box = { left: number; top: number; right: number; bottom: number };

const intersects = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const tableBox = ({ x, y }: ElkLayoutPoint): Box => ({
  left: x,
  top: y,
  right: x + 200,
  bottom: y + 100,
});

describe('ElkLayoutService with table groups', () => {
  const MEMBERS = { g1: ['a1', 'a2', 'a3'], g2: ['b1', 'b2'] };

  for (const placement of [
    TablePlacement.layeredHorizontal,
    TablePlacement.layeredVertical,
    TablePlacement.flow,
  ]) {
    it(`keeps each group's members apart from every other table under ${placement}`, async () => {
      const points = await new ElkLayoutService().layout(twoGroups(placement));
      const boxes = groupBoxes(points, MEMBERS);

      expect(points.map(({ id }) => id).sort()).toEqual([
        'a1',
        'a2',
        'a3',
        'alone',
        'b1',
        'b2',
      ]);
      expect(intersects(boxes.g1, boxes.g2)).toBe(false);
      for (const point of points) {
        const own = Object.entries(MEMBERS).find(([, ids]) =>
          ids.includes(point.id)
        )?.[0];
        for (const [groupId, box] of Object.entries(boxes)) {
          if (groupId !== own) {
            expect(intersects(tableBox(point), box)).toBe(false);
          }
        }
      }
      expect(overlaps(points)).toBe(false);
    });
  }

  it('places a group by a relationship from another group, which only the component makes it read', async () => {
    const points = await new ElkLayoutService().layout(
      twoGroups(TablePlacement.layeredHorizontal)
    );
    const boxes = groupBoxes(points, MEMBERS);

    expect(boxes.g2.left).toBeGreaterThan(boxes.g1.right);
  });

  it('packs what nothing joins beside a component, as it packs it with no group', async () => {
    const lone = Array.from({ length: 6 }, (_, index) => box(`lone${index}`));
    const request = twoGroups(TablePlacement.layeredHorizontal);
    const points = await new ElkLayoutService().layout({
      ...request,
      nodes: [...request.nodes, ...lone],
    });
    const columns = new Set(
      points.filter(({ id }) => id.startsWith('lone')).map(({ x }) => x)
    );

    expect(columns.size).toBeGreaterThan(1);
    expect(overlaps(points)).toBe(false);
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

const NODE = { width: 200, height: 100 };

/** Six tables the document draws in one row, five of them hanging off the first. */
const documentRow = (scale: number): ElkLayoutRequest => ({
  placement: TablePlacement.viewLayered,
  nodes: Array.from({ length: 6 }, (_, index) => ({
    id: `t${index}`,
    ...NODE,
    x: (index * 400) / scale,
    y: 0,
  })),
  edges: Array.from({ length: 5 }, (_, index) => edge('t0', `t${index + 1}`)),
});

const boxesOf = (points: ElkLayoutPoint[]) =>
  points.map(({ x, y }) => ({
    left: x,
    top: y,
    right: x + NODE.width,
    bottom: y + NODE.height,
  }));

function overlaps(points: ElkLayoutPoint[]): boolean {
  const boxes = boxesOf(points);

  return boxes.some((a, index) =>
    boxes
      .slice(index + 1)
      .some(
        b =>
          a.left < b.right &&
          b.left < a.right &&
          a.top < b.bottom &&
          b.top < a.bottom
      )
  );
}

describe('toElkGraph for the views preset', () => {
  it('carries the coordinate hint of every node through, which INTERACTIVE reads', () => {
    const graph = toElkGraph(documentRow(NODE.width));

    expect(graph.children?.map(child => child.x)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(graph.children?.every(child => child.y === 0)).toBe(true);
  });

  it('leaves out the hint of a node the source never placed', () => {
    const graph = toElkGraph({
      placement: TablePlacement.viewLayered,
      nodes: [box('t1')],
      edges: [],
    });

    expect(graph.children?.[0]).not.toHaveProperty('x');
    expect(graph.children?.[0]).not.toHaveProperty('y');
  });

  it('aligns every node left, which is what the reference tells each of them', () => {
    const graph = toElkGraph(documentRow(NODE.width));

    expect(
      graph.children?.every(
        child => child.layoutOptions?.['elk.alignment'] === 'LEFT'
      )
    ).toBe(true);
  });

  it('gives a group node the ratio alone and keeps its children inside it', () => {
    const graph = toElkGraph({
      placement: TablePlacement.viewLayered,
      nodes: [
        box('t1'),
        { id: 'group', width: 0, height: 0, children: [box('lone')] },
      ],
      edges: [],
    });
    const group = graph.children?.find(child => child.id === 'group');

    expect(group?.layoutOptions).toEqual({ 'elk.aspectRatio': '0.5625' });
    expect(group?.children?.map(child => child.id)).toEqual(['lone']);
  });
});

// AC-60: the normalized hint is what keeps a row of tables from coming back as
// one layer per table, so the layers follow the relationships instead.
describe('ElkLayoutService under the views preset', () => {
  it('lays a document row out in as many layers as the relationships are deep', async () => {
    const points = await new ElkLayoutService().layout(documentRow(NODE.width));
    const layers = new Set(points.map(point => point.x));

    expect(layers.size).toBe(2);
    expect(layers.size).toBeLessThan(points.length);
  });

  // What the normalization buys, measured against the coordinates it replaces:
  // handed those, INTERACTIVE layering reads the row back one table per layer.
  it('would read that row back layer for table off unnormalized coordinates', async () => {
    const points = await new ElkLayoutService().layout(documentRow(1));

    expect(new Set(points.map(point => point.x)).size).toBe(points.length);
  });

  it('overlaps no two boxes', async () => {
    const points = await new ElkLayoutService().layout(documentRow(NODE.width));

    expect(points).toHaveLength(6);
    expect(overlaps(points)).toBe(false);
  });

  it('answers the same request with the same layout, twice running', async () => {
    const service = new ElkLayoutService();
    const request = documentRow(NODE.width);

    expect(await service.layout(request)).toEqual(
      await service.layout(request)
    );
  });

  // AC-50: the group is a device for packing, so nothing downstream sees it —
  // what comes back is one absolute corner per table and no group at all.
  it('flattens a group away and answers its children in root coordinates', async () => {
    const points = await new ElkLayoutService().layout({
      placement: TablePlacement.viewLayered,
      nodes: [
        { id: 't1', ...NODE },
        { id: 't2', ...NODE },
        {
          id: 'group',
          width: 0,
          height: 0,
          children: [
            { id: 'lone1', ...NODE },
            { id: 'lone2', ...NODE },
            { id: 'lone3', ...NODE },
          ],
        },
      ],
      edges: [edge('t1', 't2')],
    });

    expect(points.map(point => point.id).sort()).toEqual([
      'lone1',
      'lone2',
      'lone3',
      't1',
      't2',
    ]);
    expect(overlaps(points)).toBe(false);
  });

  // Measured rather than read off the options, which is the look section G
  // asks for by asking for the view preset: a group with no algorithm of its own is
  // laid out by the layered one around it, which stands its tables in one column.
  it('stands the children of a group in one column, as the reference does', async () => {
    const lone = Array.from({ length: 8 }, (_, index) => ({
      id: `lone${index}`,
      ...NODE,
    }));
    const points = await new ElkLayoutService().layout({
      placement: TablePlacement.viewLayered,
      nodes: [{ id: 'group', width: 0, height: 0, children: lone }],
      edges: [],
    });
    const columns = new Set(points.map(point => point.x));
    const rows = new Set(points.map(point => point.y));

    expect(points).toHaveLength(8);
    expect(columns.size).toBe(1);
    expect(rows.size).toBe(8);
    expect(overlaps(points)).toBe(false);
  });
});
