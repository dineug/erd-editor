import type { ForceLink } from 'd3-force';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  convertVisualization,
  createVisualization,
  Group,
  linkEnds,
  LinkKind,
  type Visualization,
  type VisualizationLink,
  type VisualizationNode,
} from '@/components/visualization/createVisualization';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';

const contexts: AppContext[] = [];
const created: Visualization[] = [];

function createApp(): AppContext {
  const app = createTestAppContext();
  contexts.push(app);
  return app;
}

function create(app: AppContext): Visualization {
  const visualization = createVisualization(app.store.state);
  created.push(visualization);
  return visualization;
}

function addTable(app: AppContext, id: string, name: string) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { x: 0, y: 0, zIndex: 2 } }),
    changeTableNameAction({ id, value: name })
  );
}

function addColumn(app: AppContext, tableId: string, id: string, name: string) {
  app.store.dispatchSync(
    addColumnAction({ id, tableId }),
    changeColumnNameAction({ id, tableId, value: name })
  );
}

function addRelationship(
  app: AppContext,
  id: string,
  start: string,
  end: string
) {
  app.store.dispatchSync(
    addRelationshipAction({
      id,
      relationshipType: 4,
      start: { tableId: start, columnIds: [] },
      end: { tableId: end, columnIds: [] },
    })
  );
}

const idsOf = (nodes: VisualizationNode[]) => nodes.map(node => node.id);

/** Resolves on the next step of the layout, which d3 runs on its own timer. */
function nextTick(visualization: Visualization): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('the force simulation never ticked')),
      2000
    );

    visualization.simulation.on('tick.spec', () => {
      clearTimeout(timeout);
      visualization.simulation.on('tick.spec', null);
      resolve();
    });
  });
}

afterEach(() => {
  created.splice(0).forEach(({ simulation }) => simulation.stop());
  contexts.splice(0).forEach(app => app.store.destroy());
});

describe('convertVisualization', () => {
  it('reads an empty document as an empty graph', () => {
    const app = createApp();

    expect(convertVisualization(app.store.state)).toEqual({
      nodes: [],
      links: [],
    });
  });

  it('makes one node per table and per column, each with its name', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumn(app, 't1', 'c1', 'id');
    addColumn(app, 't1', 'c2', 'name');

    const { nodes } = convertVisualization(app.store.state);

    expect(
      nodes.map(({ id, group, name, tableId }) => [id, group, name, tableId])
    ).toEqual([
      ['t1', Group.table, 'users', null],
      ['c1', Group.column, 'id', 't1'],
      ['c2', Group.column, 'name', 't1'],
    ]);
  });

  it('leaves every node unplaced, which is what asks d3 for a spiral', () => {
    const app = createApp();
    addTable(app, 't1', 'users');

    const [node] = convertVisualization(app.store.state).nodes;

    expect(node.x).toBeNaN();
    expect(node.y).toBeNaN();
    expect(node.fx).toBeNull();
    expect(node.fy).toBeNull();
  });

  it('links every column back to the table that owns it', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumn(app, 't1', 'c1', 'id');
    addColumn(app, 't1', 'c2', 'name');

    const { links } = convertVisualization(app.store.state);

    expect(links).toEqual([
      { id: 't1-c1', kind: LinkKind.column, source: 't1', target: 'c1' },
      { id: 't1-c2', kind: LinkKind.column, source: 't1', target: 'c2' },
    ]);
  });

  it('adds one link per relationship between two different tables', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addRelationship(app, 'r1', 't1', 't2');

    const { links } = convertVisualization(app.store.state);

    expect(links).toEqual([
      {
        id: 't1-t2',
        kind: LinkKind.relationship,
        source: 't1',
        target: 't2',
      },
    ]);
  });

  it('deduplicates relationships that repeat the same ordered table pair', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addRelationship(app, 'r1', 't1', 't2');
    addRelationship(app, 'r2', 't1', 't2');

    expect(convertVisualization(app.store.state).links).toHaveLength(1);
  });

  it('keeps both orientations because the dedupe key is order sensitive', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addRelationship(app, 'r1', 't1', 't2');
    addRelationship(app, 'r2', 't2', 't1');

    expect(convertVisualization(app.store.state).links).toHaveLength(2);
  });

  it('ignores self referencing relationships', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addRelationship(app, 'r1', 't1', 't1');

    expect(convertVisualization(app.store.state).links).toEqual([]);
  });

  it('skips a relationship whose table is not in the document', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addRelationship(app, 'r1', 't1', 'ghost');

    expect(convertVisualization(app.store.state).links).toEqual([]);
  });
});

describe('createVisualization', () => {
  it('hands back the graph with a running layout over it', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumn(app, 't1', 'c1', 'id');

    const { nodes, links, simulation } = create(app);

    expect(idsOf(nodes)).toEqual(['t1', 'c1']);
    expect(links).toHaveLength(1);
    expect(simulation.nodes()).toBe(nodes);
    expect(simulation.alpha()).toBeGreaterThan(0);
  });

  it('places every node before it returns', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addColumn(app, 't1', 'c1', 'id');

    const { nodes } = create(app);

    for (const node of nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
    // The spiral d3 lays nodes out on puts no two on one point.
    expect(new Set(nodes.map(({ x, y }) => `${x},${y}`)).size).toBe(3);
  });

  it('resolves both ends of every link to the nodes they named', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addColumn(app, 't1', 'c1', 'id');
    addRelationship(app, 'r1', 't1', 't2');

    const { nodes, links } = create(app);
    const [table, column, other] = nodes;

    expect(linkEnds(links[0])).toEqual([table, column]);
    expect(linkEnds(links[1])).toEqual([table, other]);
    expect(linkEnds(links[0])[0]).toBe(table);
  });

  it('rests a column close to its table and two tables further apart', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addColumn(app, 't1', 'c1', 'id');
    addRelationship(app, 'r1', 't1', 't2');

    const { links, simulation } = create(app);
    const link = simulation.force('link') as ForceLink<
      VisualizationNode,
      VisualizationLink
    >;
    const distance = link.distance() as (link: VisualizationLink) => number;

    expect(distance(links[0])).toBeLessThan(distance(links[1]));
  });

  it('moves the nodes on every step of the layout', async () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumn(app, 't1', 'c1', 'id');
    addColumn(app, 't1', 'c2', 'name');

    const visualization = create(app);
    const before = visualization.nodes.map(({ x, y }) => ({ x, y }));

    await nextTick(visualization);

    const moved = visualization.nodes.filter(
      ({ x, y }, index) => x !== before[index].x || y !== before[index].y
    );
    expect(moved.length).toBeGreaterThan(0);
  });

  it('holds a pinned node where it was pinned through a step', async () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumn(app, 't1', 'c1', 'id');

    const visualization = create(app);
    const [table] = visualization.nodes;
    table.fx = 40;
    table.fy = -30;

    await nextTick(visualization);

    expect(table.x).toBe(40);
    expect(table.y).toBe(-30);
  });
});
