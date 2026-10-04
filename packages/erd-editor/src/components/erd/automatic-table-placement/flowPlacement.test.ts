import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  createFlowRequest,
  placeByFlow,
} from '@/components/erd/automatic-table-placement/flowPlacement';
import { TablePlacement } from '@/constants/tablePlacement';
import { toSchemaImportJson } from '@/engine/modules/editor/generator.actions';
import type { ElkLayoutPoint, ElkLayoutRequest } from '@/services/elk-layout';

type Layout = (request: ElkLayoutRequest) => Promise<ElkLayoutPoint[]>;

const hoisted = vi.hoisted(() => ({
  elkLayout: null as Layout | null,
  requests: [] as ElkLayoutRequest[],
}));

/**
 * ELK answers from a shared worker, which this environment runs none of, so
 * the one call across that boundary is the one the test stands in for.
 */
vi.mock('@/services/elk-layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/elk-layout')>();

  return {
    ...actual,
    createElkLayout: (request: ElkLayoutRequest) => {
      hoisted.requests.push(request);
      return hoisted.elkLayout
        ? hoisted.elkLayout(request)
        : Promise.reject(new Error('no layout'));
    },
  };
});

const RELATED_SQL = `
CREATE TABLE users (id INT NOT NULL, PRIMARY KEY (id));
CREATE TABLE posts (
  id INT NOT NULL,
  user_id INT,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);
`;

const UNRELATED_SQL = `
CREATE TABLE users (id INT NOT NULL);
CREATE TABLE posts (id INT NOT NULL);
`;

const contexts: AppContext[] = [];

function createApp(): AppContext {
  const app = createTestAppContext();
  contexts.push(app);
  return app;
}

const importJson = (app: AppContext, sql: string) =>
  toSchemaImportJson('sql', sql, app.store.state, app);

beforeEach(() => {
  hoisted.elkLayout = null;
  hoisted.requests.length = 0;
});

afterEach(() => {
  contexts.splice(0).forEach(app => app.store.destroy());
});

describe('createFlowRequest', () => {
  it('asks Flow to place every table of a document with a relationship', () => {
    const app = createApp();

    const request = createFlowRequest(app, importJson(app, RELATED_SQL));

    expect(request?.placement).toBe(TablePlacement.flow);
    expect(request?.nodes).toHaveLength(2);
    expect(request?.edges).toHaveLength(1);
  });

  it('leaves a document whose tables share no relationship to the grid', () => {
    const app = createApp();

    expect(createFlowRequest(app, importJson(app, UNRELATED_SQL))).toBeNull();
  });

  it('leaves a single table to the grid, even one that references itself', () => {
    const app = createApp();
    const json = importJson(
      app,
      `CREATE TABLE staff (
        id INT NOT NULL,
        manager_id INT,
        PRIMARY KEY (id),
        FOREIGN KEY (manager_id) REFERENCES staff (id)
      );`
    );

    expect(JSON.parse(json).doc.relationshipIds).toHaveLength(1);
    expect(createFlowRequest(app, json)).toBeNull();
  });

  it('counts a self reference as the relationship the rule asks for', () => {
    const app = createApp();
    const json = importJson(
      app,
      `CREATE TABLE staff (
        id INT NOT NULL,
        manager_id INT,
        PRIMARY KEY (id),
        FOREIGN KEY (manager_id) REFERENCES staff (id)
      );
      CREATE TABLE offices (id INT NOT NULL);`
    );

    const request = createFlowRequest(app, json);

    expect(request?.nodes).toHaveLength(2);
    expect(request?.edges).toEqual([]);
  });

  it('measures on a store of its own, leaving the editor document as it was', () => {
    const app = createApp();
    const before = app.store.state.doc.tableIds.slice();

    createFlowRequest(app, importJson(app, RELATED_SQL));

    expect(app.store.state.doc.tableIds).toEqual(before);
    expect(app.store.history.hasUndo()).toBe(false);
  });
});

describe('placeByFlow', () => {
  it('hands back each table from the corner of the block the layout makes', async () => {
    const app = createApp();
    hoisted.elkLayout = async ({ nodes }) =>
      nodes.map((node, index) => ({
        id: node.id,
        x: 300 + index * 500,
        y: 120 + index * 40,
      }));

    const points = await placeByFlow(app, importJson(app, RELATED_SQL));

    expect(points?.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 },
      { x: 500, y: 40 },
    ]);
  });

  it('asks ELK nothing for a document Flow has nothing to read in', async () => {
    const app = createApp();

    await expect(
      placeByFlow(app, importJson(app, UNRELATED_SQL))
    ).resolves.toBeNull();
    expect(hoisted.requests).toEqual([]);
  });

  it('leaves the tables to the grid when no layout comes back', async () => {
    const app = createApp();

    await expect(
      placeByFlow(app, importJson(app, RELATED_SQL))
    ).resolves.toBeNull();
    expect(hoisted.requests).toHaveLength(1);
  });

  it('leaves the tables to the grid once its signal aborts', async () => {
    const app = createApp();
    const controller = new AbortController();
    hoisted.elkLayout = () => new Promise(() => {});

    const placing = placeByFlow(
      app,
      importJson(app, RELATED_SQL),
      controller.signal
    );
    controller.abort();

    await expect(placing).resolves.toBeNull();
  });
});
