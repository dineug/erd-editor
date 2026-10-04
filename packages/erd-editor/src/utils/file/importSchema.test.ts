import { AnyAction, DOMTemplateLiterals, html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { TABLE_SORT_START } from '@/constants/layout';
import { CanvasType, Database } from '@/constants/schema';
import { loadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import {
  changeCanvasTypeAction,
  changeDatabaseAction,
  changeDatabaseNameAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import type { ElkLayoutPoint, ElkLayoutRequest } from '@/services/elk-layout';
import { importSchema, importSchemaPlaced } from '@/utils/file/importSchema';

type Layout = (
  request: ElkLayoutRequest,
  onSlow?: () => void
) => Promise<ElkLayoutPoint[]>;

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
    createElkLayout: (request: ElkLayoutRequest, onSlow?: () => void) => {
      hoisted.requests.push(request);
      return hoisted.elkLayout
        ? hoisted.elkLayout(request, onSlow)
        : Promise.reject(new Error('no worker'));
    },
  };
});

/** A fan: one parent and two children, which Flow and the grid lay out apart. */
const FAN_SQL = `
CREATE TABLE users (id INT NOT NULL, PRIMARY KEY (id));
CREATE TABLE posts (
  id INT NOT NULL,
  user_id INT,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE TABLE photos (
  id INT NOT NULL,
  user_id INT,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);
`;

const BOOKS_SQL = `
CREATE TABLE authors (id INT NOT NULL, PRIMARY KEY (id));
CREATE TABLE books (
  id INT NOT NULL,
  author_id INT,
  PRIMARY KEY (id),
  FOREIGN KEY (author_id) REFERENCES authors (id)
);
`;

const UNRELATED_SQL = `
CREATE TABLE users (id INT NOT NULL);
CREATE TABLE posts (id INT NOT NULL);
`;

type Toast = { message: DOMTemplateLiterals; close?: Promise<void> };

let toastContainer: Mounted | null = null;
const contexts: AppContext[] = [];

function createApp(): AppContext {
  const app = createTestAppContext();
  contexts.push(app);
  app.store.dispatchSync(
    addTableAction({ id: 'old', ui: { x: 900, y: 900, zIndex: 2 } }),
    changeTableNameAction({ id: 'old', value: 'old' })
  );
  return app;
}

function tableNames(app: AppContext): string[] {
  const { doc, collections } = app.store.state;
  return doc.tableIds.map(id => collections.tableEntities[id].name);
}

function cornerOf(app: AppContext, name: string) {
  const { collections } = app.store.state;
  const table = Object.values(collections.tableEntities).find(
    table => table.name === name
  );
  if (!table) throw new Error(`table not found: ${name}`);
  return { x: table.ui.x, y: table.ui.y };
}

/** The batches that reach the document, past the history's own bookkeeping. */
function recordActions(app: AppContext): AnyAction[][] {
  const batches: AnyAction[][] = [];
  app.store.subscribe(actions => {
    const edits = actions.filter(
      ({ type }) => type !== 'editor.changeHasHistory'
    );
    edits.length && batches.push(edits);
  });
  return batches;
}

function listenToasts(app: AppContext): Toast[] {
  const toasts: Toast[] = [];
  app.emitter.on({
    openToast: ({ payload }) => {
      toasts.push(payload as Toast);
    },
  });
  return toasts;
}

/** A Flow layout in a column, each node 1000 below the last, from 400, 300. */
const columnLayout: Layout = async ({ nodes }) =>
  nodes.map((node, index) => ({ id: node.id, x: 400, y: 300 + index * 1000 }));

beforeEach(() => {
  hoisted.elkLayout = null;
  hoisted.requests.length = 0;
});

afterEach(() => {
  contexts.splice(0).forEach(app => app.store.destroy());
  toastContainer?.unmount();
  toastContainer = null;
});

describe('importSchema', () => {
  it('replaces the document at once with the tables in the grid', () => {
    const app = createApp();

    importSchema(app, 'sql', UNRELATED_SQL);

    expect(tableNames(app).sort()).toEqual(['posts', 'users']);
    expect(hoisted.requests).toEqual([]);
    const corners = [cornerOf(app, 'users'), cornerOf(app, 'posts')];
    expect(corners.every(({ y }) => y === TABLE_SORT_START)).toBe(true);
  });

  it.each([
    ['graphql', 'type Account { id: ID! }', 'Account'],
    ['dbml', 'Table accounts {\n  id int\n}', 'accounts'],
    ['aml', 'accounts\n  id int pk', 'accounts'],
  ] as const)('reads %s through its own parser', (type, value, name) => {
    const app = createApp();

    importSchema(app, type, value);

    expect(tableNames(app)).toEqual([name]);
  });
});

describe('importSchemaPlaced', () => {
  it('lands the tables where Flow put them, from the corner the grid starts at', async () => {
    const app = createApp();
    hoisted.elkLayout = columnLayout;

    await importSchemaPlaced(app, 'sql', FAN_SQL);

    expect(hoisted.requests).toHaveLength(1);
    expect(hoisted.requests[0].placement).toBe('flow');
    const [first, second, third] = hoisted.requests[0].nodes.map(({ id }) => {
      const table = app.store.state.collections.tableEntities[id];
      return { x: table.ui.x, y: table.ui.y };
    });
    expect(first).toEqual({ x: TABLE_SORT_START, y: TABLE_SORT_START });
    expect(second).toEqual({ x: TABLE_SORT_START, y: TABLE_SORT_START + 1000 });
    expect(third).toEqual({ x: TABLE_SORT_START, y: TABLE_SORT_START + 2000 });
  });

  it('leaves the document as it was until the placement lands, then replaces it in one batch', async () => {
    const app = createApp();
    const batches = recordActions(app);
    let settle = (_: ElkLayoutPoint[]) => {};
    hoisted.elkLayout = request =>
      new Promise(resolve => {
        settle = resolve;
        void request;
      });

    const placing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    expect(tableNames(app)).toEqual(['old']);
    expect(batches).toEqual([]);

    settle(await columnLayout(hoisted.requests[0]));
    await placing;

    expect(batches).toHaveLength(1);
    expect(batches[0].map(({ type }) => type)).toEqual([
      'editor.clear',
      'editor.loadJson',
    ]);
  });

  it('puts the previous document back on a single undo', async () => {
    const app = createApp();
    hoisted.elkLayout = columnLayout;

    await importSchemaPlaced(app, 'sql', FAN_SQL);
    expect(tableNames(app).sort()).toEqual(['photos', 'posts', 'users']);

    app.store.undo();

    expect(tableNames(app)).toEqual(['old']);
    expect(cornerOf(app, 'old')).toEqual({ x: 900, y: 900 });
  });

  it('keeps every setting of the document it replaces but the view', async () => {
    const app = createApp();
    app.store.dispatchSync(
      changeDatabaseNameAction({ value: 'shop' }),
      changeDatabaseAction({ value: Database.PostgreSQL }),
      scrollToAction({ originX: -700, originY: -700 })
    );
    hoisted.elkLayout = columnLayout;

    await importSchemaPlaced(app, 'sql', FAN_SQL);

    const { settings } = app.store.state;
    expect(settings.databaseName).toBe('shop');
    expect(settings.database).toBe(Database.PostgreSQL);
    expect([settings.originX, settings.originY]).not.toEqual([-700, -700]);
  });

  it('keeps a setting changed while it places, the tab the reader moved to included', async () => {
    const app = createApp();
    let settle = (_: ElkLayoutPoint[]) => {};
    hoisted.elkLayout = () => new Promise(resolve => (settle = resolve));

    const placing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    app.store.dispatchSync(
      changeDatabaseNameAction({ value: 'renamed' }),
      changeCanvasTypeAction({ value: CanvasType.settings })
    );
    settle(await columnLayout(hoisted.requests[0]));
    await placing;

    const { settings } = app.store.state;
    expect(tableNames(app).sort()).toEqual(['photos', 'posts', 'users']);
    expect(settings.databaseName).toBe('renamed');
    expect(settings.canvasType).toBe(CanvasType.settings);
  });

  it('lands the grid at once where the tables share no relationship', async () => {
    const app = createApp();
    const batches = recordActions(app);

    await importSchemaPlaced(app, 'sql', UNRELATED_SQL);

    expect(hoisted.requests).toEqual([]);
    expect(batches).toHaveLength(1);
    expect(batches[0].map(({ type }) => type)).toEqual([
      'editor.clear',
      'editor.loadJson',
      'table.sort',
    ]);
    expect(tableNames(app).sort()).toEqual(['posts', 'users']);
  });

  it('lands the grid without a word when no layout comes back', async () => {
    const app = createApp();
    const toasts = listenToasts(app);

    await importSchemaPlaced(app, 'sql', FAN_SQL);

    expect(hoisted.requests).toHaveLength(1);
    expect(tableNames(app).sort()).toEqual(['photos', 'posts', 'users']);
    expect(cornerOf(app, 'users').y).toBe(TABLE_SORT_START);
    expect(cornerOf(app, 'posts').y).toBe(TABLE_SORT_START);
    expect(toasts).toEqual([]);
  });

  it('lands the grid at once when the slow toast is cancelled', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    hoisted.elkLayout = (_, onSlow) => {
      onSlow?.();
      return new Promise(() => {});
    };

    const placing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'renamed' }));
    const batches = recordActions(app);
    toastContainer = mount(html`${toasts[0].message}`);
    await flush();
    expect(toastContainer.container.textContent).toContain('Placing tables…');
    toastContainer.container
      .querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await placing;

    expect(batches).toHaveLength(1);
    expect(tableNames(app).sort()).toEqual(['photos', 'posts', 'users']);
    expect(cornerOf(app, 'users').y).toBe(TABLE_SORT_START);
    expect(cornerOf(app, 'posts').y).toBe(TABLE_SORT_START);
    expect(app.store.state.settings.databaseName).toBe('renamed');

    app.store.undo();

    expect(tableNames(app)).toEqual(['old']);
  });

  it('lands nothing once a load has replaced the document meanwhile', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    let settle = (_: ElkLayoutPoint[]) => {};
    hoisted.elkLayout = (request, onSlow) => {
      onSlow?.();
      return new Promise(resolve => {
        settle = resolve;
        void request;
      });
    };

    const placing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    importSchema(app, 'sql', 'CREATE TABLE newer (id INT);');
    await expect(toasts[0].close).resolves.toBeUndefined();
    settle(await columnLayout(hoisted.requests[0]));
    await placing;

    expect(tableNames(app)).toEqual(['newer']);
  });

  it('lands the import started last when two placements overlap', async () => {
    const app = createApp();
    const settles: Array<(points: ElkLayoutPoint[]) => void> = [];
    hoisted.elkLayout = () => new Promise(resolve => settles.push(resolve));

    const first = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    const second = importSchemaPlaced(app, 'sql', BOOKS_SQL);
    await flush();
    // The worker answers in the order it was asked, the first layout first.
    settles[0](await columnLayout(hoisted.requests[0]));
    await first;
    expect(tableNames(app)).toEqual(['old']);
    settles[1](await columnLayout(hoisted.requests[1]));
    await second;

    expect(tableNames(app).sort()).toEqual(['authors', 'books']);
    expect(cornerOf(app, 'authors').x).toBe(TABLE_SORT_START);
    expect(cornerOf(app, 'books').x).toBe(TABLE_SORT_START);
  });

  it('stops listening for loads once it has landed', async () => {
    const app = createApp();
    hoisted.elkLayout = columnLayout;

    await importSchemaPlaced(app, 'sql', FAN_SQL);
    app.store.dispatchSync(loadJsonAction$(JSON.stringify({})));

    expect(tableNames(app)).toEqual([]);
  });
});
