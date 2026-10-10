import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  createAutomaticTablePlacement,
  GROUP_BOX_GAP,
  placementProgress,
} from '@/components/erd/automatic-table-placement/createAutomaticTablePlacement';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { RootState } from '@/engine/state';
import { getContentRect } from '@/konva/scene/contentBounds';
import { type Rect, unionRect } from '@/konva/scene/metrics';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { findTableGroupAt, getTableCenter, padRect } from '@/utils/tableGroup';

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

function addTable(
  app: AppContext,
  id: string,
  name: string,
  ui: { x: number; y: number } = { x: 0, y: 0 }
) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { ...ui, zIndex: 2 } }),
    changeTableNameAction({ id, value: name })
  );
}

/** Where the tables already are, which is what the layout is drawn around. */
function contentCenter(state: RootState) {
  const { x, y, width, height } = getContentRect(state) as Rect;

  return { x: x + width / 2, y: y + height / 2 };
}

afterEach(() => {
  simulations.splice(0).forEach(simulation => simulation.stop());
  contexts.splice(0).forEach(app => app.store.destroy());
});

describe('createAutomaticTablePlacement', () => {
  it('creates one node per table seeded at the middle of the content', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: -1_000, y: -2_000 });
    addTable(app, 't2', 'posts', { x: 3_000, y: 4_000 });
    const state = app.store.state;
    const center = contentCenter(state);

    const simulation = create(state);
    const nodes = simulation.nodes() as any[];

    expect(nodes.map(node => node.id)).toEqual(['t1', 't2']);
    expect(nodes.every(node => node.x === center.x)).toBe(true);
    expect(nodes.every(node => node.y === center.y)).toBe(true);
    // Nothing about the seed is the canvas box any more, which a document this
    // far from it would otherwise pull every node back to.
    expect(center.x).not.toBe(state.settings.width / 2);
    expect(center.y).not.toBe(state.settings.height / 2);
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

  it('registers the link, collide, group box, charge, x and y forces', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    const state = app.store.state;

    const simulation = create(state);

    expect(simulation.force('link')).toBeTruthy();
    expect(simulation.force('collide')).toBeTruthy();
    expect(simulation.force('groupBoxes')).toBeTruthy();
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

  it('gives a group the circle inside its box, claiming no room past the box', () => {
    const app = createApp();
    addTable(app, 't1', 'users_with_a_long_table_name');
    app.store.dispatchSync(
      addTableGroupAction({
        id: 'g1',
        ui: { x: 0, y: 0, width: 10, height: 10, zIndex: 1 },
      }),
      changeTableGroupAction({ id: 't1', value: 'g1' })
    );

    const simulation = create(app.store.state);
    const [node] = simulation.nodes() as any[];
    const radius = (simulation.force('collide') as any).radius();

    expect(node.height).toBeLessThan(node.width);
    expect(radius(node)).toBe(node.height / 2);
  });

  it('pulls every node toward the middle of the content on both axes', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: -1_000, y: -2_000 });
    addTable(app, 't2', 'posts', { x: 3_000, y: 4_000 });
    const state = app.store.state;
    const center = contentCenter(state);

    const simulation = create(state);
    const [node] = simulation.nodes() as any[];

    expect((simulation.force('x') as any).x()(node)).toBe(center.x);
    expect((simulation.force('y') as any).y()(node)).toBe(center.y);
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

describe('createAutomaticTablePlacement with table groups', () => {
  function addGroup(app: AppContext, id: string, tableIds: string[]) {
    app.store.dispatchSync(
      addTableGroupAction({
        id,
        ui: { x: -900, y: -900, width: 10, height: 10, zIndex: 1 },
      }),
      ...tableIds.map(tableId =>
        changeTableGroupAction({ id: tableId, value: id })
      )
    );
  }

  const rectOf = (state: RootState, id: string) => {
    const table = state.collections.tableEntities[id];
    return {
      x: table.ui.x,
      y: table.ui.y,
      width: calcTableWidths(table, state).width,
      height: calcTableHeight(table),
    };
  };

  it("makes a group's members one node where its first member stood, its box their bounds and the padding", () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 100, y: 100 });
    addTable(app, 't2', 'posts', { x: 0, y: 0 });
    addTable(app, 't3', 'tags', { x: 600, y: 400 });
    addGroup(app, 'g1', ['t1', 't3']);
    const state = app.store.state;
    const box = padRect(unionRect(rectOf(state, 't1'), rectOf(state, 't3')));

    const nodes = create(state).nodes() as any[];

    expect(nodes.map(node => node.id)).toEqual(['g1', 't2']);
    expect(nodes[0]).toMatchObject({
      width: box.width,
      height: box.height,
      r: (box.width + box.height) / 4,
      group: state.collections.tableGroupEntities['g1'],
    });
  });

  it('links a group by the relationships of its members, one link a pair and none inside it', () => {
    const app = createApp();
    ['t1', 't2', 't3'].forEach(id => addTable(app, id, id));
    addGroup(app, 'g1', ['t1', 't2']);
    ['t1', 't2'].forEach((start, index) =>
      app.store.dispatchSync(
        addRelationshipAction({
          id: `r${index}`,
          relationshipType: 4,
          start: { tableId: start, columnIds: [] },
          end: { tableId: 't3', columnIds: [] },
        })
      )
    );
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'inside',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      })
    );

    const simulation = create(app.store.state);
    const links = (simulation.force('link') as any).links();

    expect(
      links.map(({ source, target }: any) => [source.id, target.id])
    ).toEqual([['g1', 't3']]);
  });

  it('moves the members with their box, each kept where it stands inside, and the group to the box', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 100, y: 100 });
    addTable(app, 't3', 'tags', { x: 600, y: 400 });
    addGroup(app, 'g1', ['t1', 't3']);
    const state = app.store.state;
    const box = padRect(unionRect(rectOf(state, 't1'), rectOf(state, 't3')));

    const simulation = create(state);
    const [node] = simulation.nodes() as any[];
    node.x = 5_000;
    node.y = 6_000;
    (simulation.on('tick') as (this: unknown) => void).call(simulation);

    const left = 5_000 - box.width / 2;
    const top = 6_000 - box.height / 2;
    expect(state.collections.tableGroupEntities['g1'].ui).toMatchObject({
      x: left,
      y: top,
      width: box.width,
      height: box.height,
    });
    expect(state.collections.tableEntities['t1'].ui).toMatchObject({
      x: left + 100 - box.x,
      y: top + 100 - box.y,
    });
    expect(state.collections.tableEntities['t3'].ui).toMatchObject({
      x: left + 600 - box.x,
      y: top + 400 - box.y,
    });
  });

  it('leaves a group with no member out of the simulation, at its rect', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addGroup(app, 'empty', []);
    const state = app.store.state;

    const simulation = create(state);
    (simulation.on('tick') as (this: unknown) => void).call(simulation);

    expect((simulation.nodes() as any[]).map(node => node.id)).toEqual(['t1']);
    expect(state.collections.tableGroupEntities['empty'].ui).toMatchObject({
      x: -900,
      y: -900,
      width: 10,
      height: 10,
    });
  });
});

describe('createAutomaticTablePlacement keeps group boxes apart', () => {
  const overlaps = (a: Rect, b: Rect) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;

  const tableBox = (state: RootState, id: string): Rect => {
    const table = state.collections.tableEntities[id];
    return {
      x: table.ui.x,
      y: table.ui.y,
      width: calcTableWidths(table, state).width,
      height: calcTableHeight(table),
    };
  };

  const groupBox = (state: RootState, id: string): Rect => {
    const { x, y, width, height } = state.collections.tableGroupEntities[id].ui;
    return { x, y, width, height };
  };

  function relate(app: AppContext, id: string, start: string, end: string) {
    app.store.dispatchSync(
      addRelationshipAction({
        id,
        relationshipType: 4,
        start: { tableId: start, columnIds: [] },
        end: { tableId: end, columnIds: [] },
      })
    );
  }

  /** Runs the simulation to the heat its timer stops at, then places once. */
  function settle(simulation: Simulation) {
    while (simulation.alpha() >= simulation.alphaMin()) simulation.tick();
    (simulation.on('tick') as (this: unknown) => void).call(simulation);
  }

  /**
   * Three groups of four tables in a row each, far wider than tall, and four
   * tables in no group, joined group to group and table to group.
   */
  function createWideGroups(app: AppContext) {
    const groups = ['gA', 'gB', 'gC'];
    groups.forEach((groupId, row) => {
      const memberIds = [0, 1, 2, 3].map(index => `${groupId}-t${index}`);
      memberIds.forEach((id, index) => {
        addTable(app, id, `${groupId}_member_table_${index}`, {
          x: index * 300,
          y: row * 500,
        });
        app.store.dispatchSync(
          ...[0, 1, 2, 3, 4, 5, 6, 7].map(column =>
            addColumnAction({ id: `${id}-c${column}`, tableId: id })
          )
        );
      });
      app.store.dispatchSync(
        addTableGroupAction({
          id: groupId,
          ui: { x: 0, y: 0, width: 10, height: 10, zIndex: 1 },
        }),
        ...memberIds.map(id => changeTableGroupAction({ id, value: groupId }))
      );
    });
    const loose = [0, 1, 2, 3].map(index => `loose${index}`);
    loose.forEach(id => addTable(app, id, id));
    relate(app, 'r1', 'gA-t0', 'gB-t0');
    relate(app, 'r2', 'gB-t1', 'gC-t0');
    relate(app, 'r3', 'loose0', 'gA-t1');
    relate(app, 'r4', 'loose1', 'gB-t2');

    return { groups, loose };
  }

  it('leaves no two group boxes overlapping once the simulation settles', () => {
    const app = createApp();
    const { groups } = createWideGroups(app);
    const state = app.store.state;

    settle(create(state));

    groups.forEach((a, index) =>
      groups.slice(index + 1).forEach(b => {
        expect(
          overlaps(groupBox(state, a), groupBox(state, b)),
          `${a} and ${b}`
        ).toBe(false);
      })
    );
    // The drop rule reads the box under a table's centre, so a member whose
    // centre sat in another box would join that group on its next small drag.
    groups.forEach(groupId =>
      [0, 1, 2, 3].forEach(index => {
        const table = state.collections.tableEntities[`${groupId}-t${index}`];
        expect(findTableGroupAt(state, getTableCenter(state, table))?.id).toBe(
          groupId
        );
      })
    );
  });

  it('leaves no table of no group inside a group box once the simulation settles', () => {
    const app = createApp();
    const { groups, loose } = createWideGroups(app);
    const state = app.store.state;

    settle(create(state));

    groups.forEach(groupId =>
      loose.forEach(tableId => {
        expect(
          overlaps(groupBox(state, groupId), tableBox(state, tableId)),
          `${groupId} and ${tableId}`
        ).toBe(false);
      })
    );
  });

  it('places a document with no group exactly where the forces before groups did', () => {
    const build = () => {
      const app = createApp();
      ['t1', 't2', 't3', 't4', 't5'].forEach((id, index) => {
        addTable(app, id, `table_${'x'.repeat(index * 4)}`, {
          x: index * 250,
          y: (index % 2) * 400,
        });
        app.store.dispatchSync(
          ...Array.from({ length: index + 1 }, (_, column) =>
            addColumnAction({ id: `${id}-c${column}`, tableId: id })
          )
        );
      });
      relate(app, 'r1', 't1', 't2');
      relate(app, 'r2', 't2', 't3');
      relate(app, 'r3', 't4', 't1');
      return app.store.state;
    };
    const state = build();
    const reference = build();
    const center = contentCenter(reference);
    const nodes = reference.doc.tableIds.map(id => {
      const { width, height } = tableBox(reference, id);
      return { id, r: (width + height) / 4, x: center.x, y: center.y };
    });
    const before = forceSimulation(nodes)
      .force(
        'link',
        forceLink([
          { source: 't1', target: 't2' },
          { source: 't2', target: 't3' },
          { source: 't4', target: 't1' },
        ]).id((d: any) => d.id)
      )
      .force(
        'collide',
        forceCollide().radius((d: any) => 100 + d.r)
      )
      .force('charge', forceManyBody())
      .force('x', forceX(center.x))
      .force('y', forceY(center.y))
      .stop();
    while (before.alpha() >= before.alphaMin()) before.tick();

    settle(create(state));

    expect(
      state.doc.tableIds.map(id => {
        const { x, y } = state.collections.tableEntities[id].ui;
        return { id, x, y };
      })
    ).toEqual(nodes.map(({ id, x, y, r }) => ({ id, x: x - r, y: y - r })));
  });

  it("pushes a table out of a group's box along the axis it runs in least, the table taking most of it", () => {
    const app = createApp();
    addTable(app, 'member', 'member_table_with_a_long_name', { x: 0, y: 0 });
    addTable(app, 'loose', 'loose');
    app.store.dispatchSync(
      addTableGroupAction({
        id: 'g1',
        ui: { x: 0, y: 0, width: 10, height: 10, zIndex: 1 },
      }),
      changeTableGroupAction({ id: 'member', value: 'g1' })
    );
    const simulation = create(app.store.state);
    const [group, table] = simulation.nodes() as any[];
    // The table's box starts 10 inside the right edge of the group's box, its
    // middle level with the box's, so across is the way it runs in least.
    table.x = group.x + group.width / 2 - 10 + table.r;
    table.y = group.y - table.height / 2 + table.r;

    (simulation.force('groupBoxes') as (alpha: number) => void)(1);

    const push = 10 + GROUP_BOX_GAP;
    const share = table.r ** 2 / (group.r ** 2 + table.r ** 2);
    expect(group.vx).toBeCloseTo(-push * share, 9);
    expect(table.vx).toBeCloseTo(push * (1 - share), 9);
    expect(table.vx).toBeGreaterThan(-group.vx);
    expect([group.vy, table.vy]).toEqual([0, 0]);
  });

  it('parts two group boxes standing on one spot, by their whole height and the gap', () => {
    const app = createApp();
    addTable(app, 't1', 'users_with_a_long_table_name');
    addTable(app, 't2', 'posts_with_a_long_table_name');
    ['g1', 'g2'].forEach((id, index) =>
      app.store.dispatchSync(
        addTableGroupAction({
          id,
          ui: { x: 0, y: 0, width: 10, height: 10, zIndex: 1 },
        }),
        changeTableGroupAction({ id: `t${index + 1}`, value: id })
      )
    );
    const simulation = create(app.store.state);
    const [a, b] = simulation.nodes() as any[];

    (simulation.force('groupBoxes') as (alpha: number) => void)(1);

    expect(a.width).toBe(b.width);
    expect(a.height).toBeLessThan(a.width);
    expect([a.vx, b.vx]).toEqual([0, 0]);
    expect(Math.abs(b.vy - a.vy)).toBeCloseTo(a.height + GROUP_BOX_GAP, 9);
    expect(Math.sign(a.vy)).toBe(-Math.sign(b.vy));
  });
});

describe('placementProgress', () => {
  it('reads nothing done at full heat and everything at the floor', () => {
    const simulation = forceSimulation([]).stop();

    expect(placementProgress(simulation)).toBe(0);

    simulation.alpha(simulation.alphaMin());
    expect(placementProgress(simulation)).toBe(1);
  });

  it('runs with the ticks taken rather than with the heat left', () => {
    // The heat comes down by a fixed factor a tick, so the share of the ticks
    // the simulation will ever take is what the ratio of the logs reads.
    const simulation = forceSimulation([]).stop();
    const total = Math.ceil(
      Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())
    );
    const seen: number[] = [];

    for (let tick = 0; tick < total; tick++) {
      simulation.tick();
      seen.push(placementProgress(simulation));
    }

    expect(seen[Math.floor(total / 2) - 1]).toBeCloseTo(0.5, 1);
    expect(seen.at(-1)).toBe(1);
    for (let index = 1; index < seen.length; index++) {
      expect(seen[index]).toBeGreaterThanOrEqual(seen[index - 1]);
    }
  });

  it('holds at the whole once the simulation has cooled past its floor', () => {
    const simulation = forceSimulation([]).stop().alpha(0);

    expect(placementProgress(simulation)).toBe(1);
  });
});
