import { query } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { TablePlacement } from '@/constants/tablePlacement';
import { ViewKind } from '@/engine/modules/editor/state';
import {
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { getContentRect } from '@/konva/scene/contentBounds';
import { type Rect } from '@/konva/scene/metrics';
import { getVisibleColumnIds } from '@/konva/scene/viewLayout';
import {
  createElkLayoutRequest,
  type ElkLayoutPoint,
  type ElkLayoutRequest,
  flattenElkNodes,
  toTablePoints,
  toViewPoints,
} from '@/services/elk-layout/elkGraph';
import {
  calcTableHeight,
  calcTableWidths,
  calcViewTableWidths,
} from '@/utils/calcTable';

/** A name long enough that the box it sizes is nothing like a short one's. */
const LONG_NAME = 'a_table_whose_name_is_far_longer_than_the_other_one_here';

const contexts: AppContext[] = [];

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

function addColumns(app: AppContext, tableId: string, ids: string[]) {
  app.store.dispatchSync(...ids.map(id => addColumnAction({ id, tableId })));
}

function relate(
  app: AppContext,
  id: string,
  start: string,
  end: string,
  columns: { start?: string[]; end?: string[] } = {}
) {
  app.store.dispatchSync(
    addRelationshipAction({
      id,
      relationshipType: 4,
      start: { tableId: start, columnIds: columns.start ?? [] },
      end: { tableId: end, columnIds: columns.end ?? [] },
    })
  );
}

function contentCenter(state: RootState) {
  const { x, y, width, height } = getContentRect(state) as Rect;

  return { x: x + width / 2, y: y + height / 2 };
}

function tableAt(state: RootState, id: string) {
  const table = query(state.collections)
    .collection('tableEntities')
    .selectById(id);

  return { x: table?.ui.x, y: table?.ui.y };
}

afterEach(() => {
  contexts.splice(0).forEach(app => app.store.destroy());
});

describe('createElkLayoutRequest', () => {
  it('carries the placement it was asked for', () => {
    const app = createApp();
    addTable(app, 't1', 'users');

    expect(
      createElkLayoutRequest(app.store.state, TablePlacement.flow).placement
    ).toBe(TablePlacement.flow);
  });

  it('sends one node per table, at the size the editor draws it', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    const state = app.store.state;

    const { nodes } = createElkLayoutRequest(
      state,
      TablePlacement.layeredHorizontal
    );
    const tables = query(state.collections)
      .collection('tableEntities')
      .selectByIds(state.doc.tableIds);

    expect(nodes.map(node => node.id)).toEqual(['t1', 't2']);
    nodes.forEach((node, index) => {
      expect(node.width).toBe(calcTableWidths(tables[index], state).width);
      expect(node.height).toBe(calcTableHeight(tables[index]));
    });
  });

  it('sends one edge per related pair', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    relate(app, 'r1', 't1', 't2');

    const { edges } = createElkLayoutRequest(
      app.store.state,
      TablePlacement.layeredHorizontal
    );

    expect(edges).toEqual([
      { source: 't1', target: 't2', sourceRow: -1, targetRow: -1 },
    ]);
  });

  it('sends a pair joined twice as one edge', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    relate(app, 'r1', 't1', 't2');
    relate(app, 'r2', 't1', 't2');

    expect(
      createElkLayoutRequest(app.store.state, TablePlacement.flow).edges
    ).toHaveLength(1);
  });

  it('sends no edge for a table that references itself', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    relate(app, 'r1', 't1', 't1');

    expect(
      createElkLayoutRequest(app.store.state, TablePlacement.flow).edges
    ).toEqual([]);
  });

  it('sends nothing for a document with no tables', () => {
    const app = createApp();

    const request = createElkLayoutRequest(
      app.store.state,
      TablePlacement.flow
    );

    expect(request.nodes).toEqual([]);
    expect(request.edges).toEqual([]);
  });
});

describe('createElkLayoutRequest rows', () => {
  it('reports the row each end of a relationship sits on', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addColumns(app, 't1', ['u0', 'u1', 'u2']);
    addColumns(app, 't2', ['p0', 'p1']);
    relate(app, 'r1', 't1', 't2', { start: ['u2'], end: ['p1'] });

    expect(
      createElkLayoutRequest(app.store.state, TablePlacement.flow).edges
    ).toEqual([{ source: 't1', target: 't2', sourceRow: 2, targetRow: 1 }]);
  });

  it('takes the topmost row of a key spread over several columns', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addColumns(app, 't1', ['u0', 'u1', 'u2']);
    addColumns(app, 't2', ['p0']);
    relate(app, 'r1', 't1', 't2', { start: ['u2', 'u1'], end: ['p0'] });

    expect(
      createElkLayoutRequest(app.store.state, TablePlacement.flow).edges[0]
        .sourceRow
    ).toBe(1);
  });

  it('reports no row for an end whose column is gone', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addColumns(app, 't1', ['u0']);
    relate(app, 'r1', 't1', 't2', { start: ['missing'], end: [] });

    const [first] = createElkLayoutRequest(
      app.store.state,
      TablePlacement.flow
    ).edges;
    expect({ source: first.sourceRow, target: first.targetRow }).toEqual({
      source: -1,
      target: -1,
    });
  });
});

describe('toTablePoints', () => {
  const horizontal = (state: RootState) =>
    createElkLayoutRequest(state, TablePlacement.layeredHorizontal);

  it('keeps the shape of the layout it was handed', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 10, y: 20 });
    addTable(app, 't2', 'posts', { x: 30, y: 40 });
    const state = app.store.state;

    const [first, second] = toTablePoints(state, horizontal(state), [
      { id: 't1', x: 0, y: 0 },
      { id: 't2', x: 500, y: 0 },
    ]);

    expect(second.x - first.x).toBe(500);
    expect(second.y).toBe(first.y);
  });

  it('centres the layout on the middle of what the document already drew', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: -4_000, y: -3_000 });
    addTable(app, 't2', 'posts', { x: -3_000, y: -3_000 });
    const state = app.store.state;
    const center = contentCenter(state);

    const placed = toTablePoints(state, horizontal(state), [
      { id: 't1', x: 0, y: 0 },
      { id: 't2', x: 1_000, y: 0 },
    ]);
    const width = calcTableWidths(
      query(state.collections).collection('tableEntities').selectById('t1')!,
      state
    ).width;
    const middle =
      (Math.min(...placed.map(p => p.x)) +
        Math.max(...placed.map(p => p.x + width))) /
      2;

    expect(middle).toBeCloseTo(center.x, 6);
  });

  it('leaves the document where it is rather than moving it on', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 100, y: 100 });
    addTable(app, 't2', 'posts', { x: 900, y: 100 });
    const state = app.store.state;
    const points: ElkLayoutPoint[] = [
      { id: 't1', x: 0, y: 0 },
      { id: 't2', x: 700, y: 0 },
    ];

    const once = toTablePoints(state, horizontal(state), points);
    const twice = toTablePoints(state, horizontal(state), points);

    expect(twice).toEqual(once);
  });

  it('drops a point for a table the request never named', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 10, y: 20 });
    const state = app.store.state;

    expect(
      toTablePoints(state, horizontal(state), [{ id: 'gone', x: 900, y: 900 }])
    ).toEqual([]);
  });

  it('answers an empty layout with no points at all', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 10, y: 20 });
    const state = app.store.state;

    expect(toTablePoints(state, horizontal(state), [])).toEqual([]);
  });
});

function openFlow(app: AppContext, positions: Record<string, Point> = {}) {
  app.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
  if (Object.keys(positions).length) {
    app.store.dispatchSync(
      viewSetLayoutAction({ kind: ViewKind.flow, positions })
    );
  }
}

const nodeById = (request: ElkLayoutRequest, id: string) =>
  request.nodes.find(node => node.id === id)!;

// AC-60: the interactive strategies are why a node carries a hint at all, and
// normalizing is why a document row does not come back as one layer per table.
// What the hint does to the layers is measured in the service spec.
describe('createElkLayoutRequest hints', () => {
  it('hints every node with the corner the source draws it at', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 1_000, y: 2_000 });
    addTable(app, 't2', 'posts', { x: 1_400, y: 2_000 });

    const request = createElkLayoutRequest(
      app.store.state,
      TablePlacement.liamLayered
    );

    expect(request.nodes.every(node => Number.isFinite(node.x))).toBe(true);
    expect(request.nodes.every(node => Number.isFinite(node.y))).toBe(true);
  });

  // The two tables are deliberately of different widths, so the average the
  // hint is divided by is a number neither box has on its own.
  it('measures the hint from the corner of the source box, in node widths', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 1_000, y: 2_000 });
    addTable(app, 't2', LONG_NAME, { x: 1_400, y: 2_600 });

    const request = createElkLayoutRequest(
      app.store.state,
      TablePlacement.liamLayered
    );
    const widths = request.nodes.map(node => node.width);
    const scale = (widths[0] + widths[1]) / 2;

    expect(widths[0]).not.toBe(widths[1]);
    expect(nodeById(request, 't1')).toMatchObject({ x: 0, y: 0 });
    expect(nodeById(request, 't2').x).toBeCloseTo(400 / scale, 6);
    expect(nodeById(request, 't2').y).toBeCloseTo(600 / scale, 6);
  });

  // The hint costs two fields a node on the wire and the three placements the
  // author picks derive their layers from the edges alone, so it is sent to
  // the one preset whose strategies read it.
  it('sends no hint with a placement that reads none', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 1_000, y: 2_000 });
    addTable(app, 't2', 'posts', { x: 1_400, y: 2_600 });
    const state = app.store.state;

    for (const placement of [
      TablePlacement.layeredHorizontal,
      TablePlacement.layeredVertical,
      TablePlacement.flow,
    ] as const) {
      const { nodes } = createElkLayoutRequest(state, placement);

      expect(nodes.every(node => node.x === undefined)).toBe(true);
      expect(nodes.every(node => node.y === undefined)).toBe(true);
    }
  });

  // The whole of the normalization: a coordinate the infinite canvas happens to
  // sit at says the same thing as the same shape drawn at the origin.
  it('says the same thing wherever on the canvas the shape was drawn', () => {
    const near = createApp();
    addTable(near, 't1', 'users', { x: 0, y: 0 });
    addTable(near, 't2', 'posts', { x: 400, y: 0 });
    const far = createApp();
    addTable(far, 't1', 'users', { x: 90_000, y: -70_000 });
    addTable(far, 't2', 'posts', { x: 90_400, y: -70_000 });

    const hints = (app: AppContext) =>
      createElkLayoutRequest(app.store.state, TablePlacement.liamLayered).nodes;

    expect(hints(far)).toEqual(hints(near));
  });

  it('hints a lone table at the origin, which is the corner it is', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: -820, y: 640 });

    expect(
      createElkLayoutRequest(app.store.state, TablePlacement.liamLayered)
        .nodes[0]
    ).toMatchObject({ x: 0, y: 0 });
  });

  it('hints from the document until the view has placed the table', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 0, y: 0 });
    addTable(app, 't2', 'posts', { x: 400, y: 0 });
    openFlow(app);

    const request = createElkLayoutRequest(
      app.store.state,
      TablePlacement.liamLayered,
      { source: 'flow' }
    );

    expect(nodeById(request, 't1').x).toBe(0);
    expect(nodeById(request, 't2').x).toBeGreaterThan(0);
  });

  it('hints from the view once the view has placed the table', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 0, y: 0 });
    addTable(app, 't2', 'posts', { x: 400, y: 0 });
    openFlow(app, { t1: { x: 400, y: 0 }, t2: { x: 0, y: 0 } });

    const request = createElkLayoutRequest(
      app.store.state,
      TablePlacement.liamLayered,
      { source: 'flow' }
    );

    expect(nodeById(request, 't2')).toMatchObject({ x: 0, y: 0 });
    expect(nodeById(request, 't1').x).toBeGreaterThan(0);
  });
});

describe('createElkLayoutRequest options', () => {
  it('places only the tables it was given, and only the edges between them', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addTable(app, 't3', 'tags');
    relate(app, 'r1', 't1', 't2');
    relate(app, 'r2', 't2', 't3');

    const request = createElkLayoutRequest(
      app.store.state,
      TablePlacement.liamLayered,
      { tableIds: ['t1', 't2'] }
    );

    expect(request.nodes.map(node => node.id)).toEqual(['t1', 't2']);
    expect(request.edges).toHaveLength(1);
  });

  it('measures a table the way the view of that source draws it', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumns(app, 't1', ['c0', 'c1', 'c2']);
    openFlow(app);
    const state = app.store.state;
    const table = query(state.collections)
      .collection('tableEntities')
      .selectById('t1')!;

    const view = createElkLayoutRequest(state, TablePlacement.liamLayered, {
      source: 'flow',
    });
    const document = createElkLayoutRequest(state, TablePlacement.liamLayered);

    expect(view.nodes[0].height).toBe(calcTableHeight(table, 0, 'flow'));
    expect(document.nodes[0].height).toBe(calcTableHeight(table));
    expect(view.nodes[0].height).toBeLessThan(document.nodes[0].height);
    expect(view.nodes[0].width).toBe(
      calcViewTableWidths(
        table,
        state,
        getVisibleColumnIds(state, table, 'flow')
      ).width
    );
    expect(document.nodes[0].width).toBe(calcTableWidths(table, state).width);
    expect(view.nodes[0].width).toBeLessThan(document.nodes[0].width);
  });

  // getVisibleColumnIds shows every row where there is no view to ask, so a
  // request built for a view before it is open measures the view's own card
  // with every row showing, spaced for tables the view will not draw.
  it('measures a view that is not open at the view chrome, every row showing', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumns(app, 't1', ['c0', 'c1', 'c2']);
    const state = app.store.state;
    const table = query(state.collections)
      .collection('tableEntities')
      .selectById('t1')!;

    const beforeOpen = createElkLayoutRequest(
      state,
      TablePlacement.liamLayered,
      {
        source: 'flow',
      }
    );
    const document = createElkLayoutRequest(state, TablePlacement.liamLayered);

    expect(beforeOpen.nodes[0].height).toBe(
      calcTableHeight(table, table.columnIds.length, 'flow')
    );
    expect(beforeOpen.nodes[0].height).toBeGreaterThan(
      document.nodes[0].height
    );
  });

  // AC-50, the request half: the tables no relationship reaches leave the
  // layers and go into one node instead.
  it('folds the tables no relationship reaches into one group node', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addTable(app, 'lone1', 'audit');
    addTable(app, 'lone2', 'config');
    relate(app, 'r1', 't1', 't2');

    const { nodes } = createElkLayoutRequest(
      app.store.state,
      TablePlacement.liamLayered,
      { groupUnrelated: true }
    );

    expect(nodes.map(node => node.id)).toEqual([
      't1',
      't2',
      expect.any(String),
    ]);
    expect(nodes[2].children?.map(child => child.id)).toEqual([
      'lone1',
      'lone2',
    ]);
    expect(
      flattenElkNodes(nodes)
        .map(node => node.id)
        .sort()
    ).toEqual(['lone1', 'lone2', 't1', 't2']);
  });

  it('leaves the list flat when nothing asked for a group', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 'lone1', 'audit');

    const { nodes } = createElkLayoutRequest(
      app.store.state,
      TablePlacement.liamLayered
    );

    expect(nodes.every(node => node.children === undefined)).toBe(true);
  });

  it('builds no group where every table is joined to another', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    relate(app, 'r1', 't1', 't2');

    const { nodes } = createElkLayoutRequest(
      app.store.state,
      TablePlacement.liamLayered,
      { groupUnrelated: true }
    );

    expect(nodes.map(node => node.id)).toEqual(['t1', 't2']);
  });
});

describe('toViewPoints', () => {
  const liam = (state: RootState) =>
    createElkLayoutRequest(state, TablePlacement.liamLayered);

  it('puts the corner of the layout at the origin of the view', () => {
    const app = createApp();
    addTable(app, 't1', 'users', { x: 5_000, y: 5_000 });
    addTable(app, 't2', 'posts', { x: 6_000, y: 5_000 });
    const state = app.store.state;

    const placed = toViewPoints(liam(state), [
      { id: 't1', x: 40, y: 90 },
      { id: 't2', x: 640, y: 90 },
    ]);

    expect(placed).toEqual([
      { id: 't1', x: 0, y: 0 },
      { id: 't2', x: 600, y: 0 },
    ]);
  });

  // A view shares no coordinate with the document, so where the document draws
  // is the one thing the landing must not read.
  it('lands in the same place wherever the document sits', () => {
    const near = createApp();
    addTable(near, 't1', 'users', { x: 0, y: 0 });
    const far = createApp();
    addTable(far, 't1', 'users', { x: -50_000, y: 12_000 });
    const points: ElkLayoutPoint[] = [{ id: 't1', x: 33, y: 44 }];

    expect(toViewPoints(liam(far.store.state), points)).toEqual(
      toViewPoints(liam(near.store.state), points)
    );
  });

  it('lands a table the request buried in a group like any other', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    addTable(app, 'lone1', 'audit');
    relate(app, 'r1', 't1', 't2');
    const request = createElkLayoutRequest(
      app.store.state,
      TablePlacement.liamLayered,
      { groupUnrelated: true }
    );

    const placed = toViewPoints(request, [
      { id: 't1', x: 0, y: 0 },
      { id: 't2', x: 400, y: 0 },
      { id: 'lone1', x: 800, y: 0 },
    ]);

    expect(placed.map(point => point.id)).toEqual(['t1', 't2', 'lone1']);
  });

  it('answers an empty layout with no points at all', () => {
    const app = createApp();
    addTable(app, 't1', 'users');

    expect(toViewPoints(liam(app.store.state), [])).toEqual([]);
  });
});
