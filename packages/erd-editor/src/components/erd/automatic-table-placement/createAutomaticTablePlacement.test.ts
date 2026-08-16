import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { createAutomaticTablePlacement } from '@/components/erd/automatic-table-placement/createAutomaticTablePlacement';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';

type Simulation = ReturnType<typeof createAutomaticTablePlacement>;

const simulations: Simulation[] = [];
const contexts: AppContext[] = [];

/** Keep the d3 timer from ticking into the next test. */
function create(state: RootState): Simulation {
  const simulation = createAutomaticTablePlacement(state);
  simulations.push(simulation);
  simulation.stop();
  return simulation;
}

function createApp(): AppContext {
  const app = createTestAppContext();
  contexts.push(app);
  return app;
}

function addTable(app: AppContext, id: string, name: string) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { x: 0, y: 0, zIndex: 2 } }),
    changeTableNameAction({ id, value: name })
  );
}

afterEach(() => {
  simulations.splice(0).forEach(simulation => simulation.stop());
  contexts.splice(0).forEach(app => app.store.destroy());
});

describe('createAutomaticTablePlacement', () => {
  it('creates one node per table seeded at the canvas center', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    const state = app.store.state;

    const simulation = create(state);
    const nodes = simulation.nodes() as any[];

    expect(nodes.map(node => node.id)).toEqual(['t1', 't2']);
    expect(nodes.every(node => node.x === state.settings.width / 2)).toBe(true);
    expect(nodes.every(node => node.y === state.settings.height / 2)).toBe(
      true
    );
  });

  it('derives the node radius from the rendered table width and height', () => {
    const app = createApp();
    addTable(app, 't1', 'a-very-long-table-name');
    app.store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));
    const state = app.store.state;
    const table = state.collections.tableEntities['t1'];

    const simulation = create(state);
    const [node] = simulation.nodes() as any[];

    const expected =
      (calcTableWidths(table, state).width + calcTableHeight(table)) / 4;
    expect(node.r).toBe(expected);
    expect(node.ref).toBe(table);
  });

  it('registers the link, collide, charge, x and y forces', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    const state = app.store.state;

    const simulation = create(state);

    expect(simulation.force('link')).toBeTruthy();
    expect(simulation.force('collide')).toBeTruthy();
    expect(simulation.force('charge')).toBeTruthy();
    expect(simulation.force('x')).toBeTruthy();
    expect(simulation.force('y')).toBeTruthy();
  });

  it('pads the collide radius by 100 around each node radius', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    const state = app.store.state;

    const simulation = create(state);
    const [node] = simulation.nodes() as any[];
    const radius = (simulation.force('collide') as any).radius();

    expect(radius(node)).toBe(100 + node.r);
  });

  it('pulls every node toward the canvas center on both axes', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    const state = app.store.state;

    const simulation = create(state);
    const [node] = simulation.nodes() as any[];

    expect((simulation.force('x') as any).x()(node)).toBe(
      state.settings.width / 2
    );
    expect((simulation.force('y') as any).y()(node)).toBe(
      state.settings.height / 2
    );
  });

  it('links tables that a relationship connects', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    app.store.dispatchSync(
      addColumnAction({ id: 'c1', tableId: 't1' }),
      addColumnAction({ id: 'c2', tableId: 't2' }),
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      })
    );
    const state = app.store.state;

    const simulation = create(state);
    const links = (simulation.force('link') as any).links();

    expect(links).toHaveLength(1);
    expect(links[0].source.id).toBe('t1');
    expect(links[0].target.id).toBe('t2');
  });

  it('deduplicates repeated relationships between the same ordered pair', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      }),
      addRelationshipAction({
        id: 'r2',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      })
    );

    const simulation = create(app.store.state);

    expect((simulation.force('link') as any).links()).toHaveLength(1);
  });

  it('keeps both directions of a pair because dedupe is order sensitive', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      }),
      addRelationshipAction({
        id: 'r2',
        relationshipType: 4,
        start: { tableId: 't2', columnIds: [] },
        end: { tableId: 't1', columnIds: [] },
      })
    );

    const simulation = create(app.store.state);

    expect((simulation.force('link') as any).links()).toHaveLength(2);
  });

  it('ignores self referencing relationships', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't1', columnIds: [] },
      })
    );

    const simulation = create(app.store.state);

    expect((simulation.force('link') as any).links()).toEqual([]);
  });

  it('throws when a relationship points at a table that no longer exists', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 'missing', columnIds: [] },
      })
    );

    expect(() => create(app.store.state)).toThrowError(/node not found/);
  });

  it('produces an empty simulation for an empty document', () => {
    const app = createApp();

    const simulation = create(app.store.state);

    expect(simulation.nodes()).toEqual([]);
    expect((simulation.force('link') as any).links()).toEqual([]);
  });

  it('writes the simulated node positions back onto the tables, offset by the radius', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    const state = app.store.state;
    const table = state.collections.tableEntities['t1'];

    const simulation = create(state);
    const [node] = simulation.nodes() as any[];
    node.x = 1234;
    node.y = 4321;

    const onTick = simulation.on('tick') as (this: unknown) => void;
    onTick.call(simulation);

    expect(table.ui.x).toBe(1234 - node.r);
    expect(table.ui.y).toBe(4321 - node.r);
  });

  it('re-sorts the relationship anchor points on every tick', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      })
    );
    const state = app.store.state;
    const relationship = state.collections.relationshipEntities['r1'];
    relationship.start.x = -1;
    relationship.start.y = -1;

    const simulation = create(state);
    const nodes = simulation.nodes() as any[];
    nodes[0].x = 0;
    nodes[0].y = 0;
    nodes[1].x = 2000;
    nodes[1].y = 2000;

    const onTick = simulation.on('tick') as (this: unknown) => void;
    onTick.call(simulation);

    expect(relationship.start.x).not.toBe(-1);
    expect(relationship.start.y).not.toBe(-1);
    expect(Number.isFinite(relationship.start.x)).toBe(true);
    expect(Number.isFinite(relationship.end.x)).toBe(true);
  });
});
