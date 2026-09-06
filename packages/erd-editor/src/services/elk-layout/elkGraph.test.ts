import { query } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { TablePlacement } from '@/constants/tablePlacement';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';
import { getContentRect } from '@/konva/scene/contentBounds';
import { type Rect } from '@/konva/scene/metrics';
import {
  createElkLayoutRequest,
  type ElkLayoutPoint,
  toTablePoints,
} from '@/services/elk-layout/elkGraph';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';

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
