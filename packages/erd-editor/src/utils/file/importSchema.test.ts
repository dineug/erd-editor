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
import { coveredWidth } from '@/components/find-replace/panelLayout';
import { APPEND_GAP, TABLE_SORT_START } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType, Database } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
  clearAction,
  initialClearAction,
  initialLoadJsonAction,
  loadJsonAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { loadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import {
  SelectType,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import { getActiveView } from '@/engine/modules/editor/view';
import {
  changeVisualizationModeAction,
  viewOpenAction,
} from '@/engine/modules/editor/view.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeCanvasTypeAction,
  changeDatabaseAction,
  changeDatabaseNameAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import type { RxStoreOptions } from '@/engine/rx-store';
import { getContentRect } from '@/konva/scene/contentBounds';
import { getTableRect } from '@/konva/scene/metrics';
import { toScreenPoint } from '@/konva/scene/viewport';
import type { ElkLayoutPoint, ElkLayoutRequest } from '@/services/elk-layout';
import {
  appendSchema,
  appendSchemaJSON,
  appendSchemaPlaced,
  importSchema,
  importSchemaPlaced,
} from '@/utils/file/importSchema';

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

function createApp(options?: RxStoreOptions): AppContext {
  const app = createTestAppContext(options);
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

/**
 * Dispatches a load and fails if any placement still hears it: the only thing
 * a placement does with a load is abort its own controller.
 */
function expectDeafToLoads(app: AppContext) {
  const abort = vi.spyOn(AbortController.prototype, 'abort');
  try {
    app.store.dispatchSync(loadJsonAction$(JSON.stringify({})));
    expect(abort).not.toHaveBeenCalled();
  } finally {
    abort.mockRestore();
  }
}

/** A Flow layout in a column, each node 1000 below the last, from 400, 300. */
const columnLayout: Layout = async ({ nodes }) =>
  nodes.map((node, index) => ({ id: node.id, x: 400, y: 300 + index * 1000 }));

/**
 * The column layout held back until the test lands it, raising the slow toast
 * at once when asked to, as a layout that runs long does.
 */
function pendingColumnLayout({ slow = false } = {}): () => Promise<void> {
  let settle = (_: ElkLayoutPoint[]) => {};
  hoisted.elkLayout = (_, onSlow) => {
    slow && onSlow?.();
    return new Promise(resolve => (settle = resolve));
  };
  return async () => settle(await columnLayout(hoisted.requests[0]));
}

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
    const land = pendingColumnLayout();

    const placing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    expect(tableNames(app)).toEqual(['old']);
    expect(batches).toEqual([]);

    await land();
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
    const land = pendingColumnLayout();

    const placing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    app.store.dispatchSync(
      changeDatabaseNameAction({ value: 'renamed' }),
      changeCanvasTypeAction({ value: CanvasType.settings })
    );
    await land();
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
    expectDeafToLoads(app);
  });

  it('lands nothing once a load has replaced the document meanwhile', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    const land = pendingColumnLayout({ slow: true });

    const placing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    importSchema(app, 'sql', 'CREATE TABLE newer (id INT);');
    await expect(toasts[0].close).resolves.toBeUndefined();
    await land();
    await placing;

    expect(tableNames(app)).toEqual(['newer']);
    expectDeafToLoads(app);
  });

  it.each([
    ['editor.clear', () => clearAction()],
    ['editor.loadJson', () => loadJsonAction({ value: '{}' })],
    ['editor.initialClear', () => initialClearAction()],
    ['editor.initialLoadJson', () => initialLoadJsonAction({ value: '{}' })],
  ])('lands nothing once an %s alone has come meanwhile', async (_, load) => {
    const app = createApp();
    const land = pendingColumnLayout();

    const placing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    app.store.dispatchSync(load());
    await land();
    await placing;

    expect(tableNames(app)).toEqual([]);
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

    expect(tableNames(app).sort()).toEqual(['photos', 'posts', 'users']);
    expectDeafToLoads(app);
  });

  it('asks no layout and opens no toast in a readonly editor, which drops the load', async () => {
    let readonly = false;
    const app = createApp({ getReadonly: () => readonly });
    readonly = true;
    const toasts = listenToasts(app);
    hoisted.elkLayout = (request, onSlow) => {
      onSlow?.();
      return columnLayout(request);
    };

    await expect(
      importSchemaPlaced(app, 'sql', FAN_SQL)
    ).resolves.toBeUndefined();

    expect(hoisted.requests).toEqual([]);
    expect(toasts).toEqual([]);
    expect(tableNames(app)).toEqual(['old']);
  });
});

/** Where the block an append brings starts, under the diagram as it stands. */
function appendCorner(app: AppContext) {
  const content = getContentRect(app.store.state)!;
  return { x: content.x, y: content.y + content.height + APPEND_GAP };
}

/** The diagram on a screen of its own, which the appended block lies below. */
function createScreenApp(options?: RxStoreOptions): AppContext {
  const app = createApp(options);
  app.store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
  app.store.resetHistory();
  return app;
}

/** The left edge of the selected tables, as the screen shows them. */
function selectedLeftOnScreen(app: AppContext): number {
  const { state } = app.store;
  const lefts = Object.entries(state.editor.selectedMap)
    .filter(([, type]) => type === SelectType.table)
    .map(([id]) => {
      const rect = getTableRect(state, state.collections.tableEntities[id]);
      return toScreenPoint(state.settings, rect).x;
    });
  return Math.min(...lefts);
}

function selectedNames(app: AppContext): string[] {
  const { editor, collections } = app.store.state;
  return Object.entries(editor.selectedMap)
    .filter(([, type]) => type === SelectType.table)
    .map(([id]) => collections.tableEntities[id].name)
    .sort();
}

/** Stands the reader in a Flow view, which drops every edit of the document. */
function enterFlow(app: AppContext) {
  app.store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    changeVisualizationModeAction({ value: VisualizationMode.flow }),
    viewOpenAction({ kind: ViewKind.flow })
  );
}

/** Stands the reader in the visualization tab's Graph mode, which opens no view. */
function enterGraph(app: AppContext) {
  app.store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    changeVisualizationModeAction({ value: VisualizationMode.graph })
  );
}

/** Stands the reader on a tab of the editor other than the ERD. */
const enterTab = (value: string) => (app: AppContext) => {
  app.store.dispatchSync(changeCanvasTypeAction({ value }));
};

const ACCOUNTS_JSON = () => {
  const app = createTestAppContext();
  contexts.push(app);
  app.store.dispatchSync(
    addTableAction({ id: 'accounts', ui: { x: 40, y: 40, zIndex: 2 } }),
    changeTableNameAction({ id: 'accounts', value: 'accounts' }),
    addTableAction({ id: 'roles', ui: { x: 640, y: 40, zIndex: 2 } }),
    changeTableNameAction({ id: 'roles', value: 'roles' }),
    addMemoAction({ id: 'note', ui: { x: 40, y: 400, zIndex: 2 } })
  );
  return JSON.stringify(app.store.state);
};

describe('appendSchema', () => {
  it('adds an import below the diagram in the grid, leaving what was there', () => {
    const app = createScreenApp();
    const corner = appendCorner(app);

    appendSchema(app, 'sql', UNRELATED_SQL);

    expect(tableNames(app)[0]).toBe('old');
    expect(tableNames(app).slice(1).sort()).toEqual(['posts', 'users']);
    expect(cornerOf(app, 'old')).toEqual({ x: 900, y: 900 });
    for (const name of ['posts', 'users']) {
      expect(cornerOf(app, name).y).toBe(corner.y);
    }
    expect(hoisted.requests).toEqual([]);
  });

  it('selects what it adds alone and brings it on screen', () => {
    const app = createScreenApp();
    app.store.dispatchSync(
      scrollToAction({ originX: 0, originY: 0 }),
      changeDatabaseNameAction({ value: 'kept' })
    );

    appendSchema(app, 'sql', UNRELATED_SQL);

    const { settings } = app.store.state;
    expect(selectedNames(app)).toEqual(['posts', 'users']);
    expect(settings.originY).toBeLessThan(0);
    expect(settings.databaseName).toBe('kept');
  });

  it('takes the tables, the selection and the scroll back on a single undo', () => {
    const app = createScreenApp();
    const { originX, originY } = app.store.state.settings;

    appendSchema(app, 'sql', UNRELATED_SQL);
    app.store.undo();

    expect(tableNames(app)).toEqual(['old']);
    expect(app.store.state.settings).toMatchObject({ originX, originY });
  });

  it('leaves a Flow view for the ERD tab first, in a dispatch of its own', () => {
    const app = createScreenApp();
    enterFlow(app);
    const batches = recordActions(app);

    appendSchema(app, 'sql', UNRELATED_SQL);

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(getActiveView(app.store.state)).toBeNull();
    expect(batches[0].map(({ type }) => type)).toEqual([
      'settings.changeCanvasType',
    ]);
    expect(batches[1].map(({ type }) => type)).toContain('table.add');
    expect(tableNames(app)).toHaveLength(3);
  });

  it.each([
    ['a Flow view', enterFlow],
    ['Graph mode', enterGraph],
    ['the Schema SQL tab', enterTab(CanvasType.schemaSQL)],
    ['the Code Generator tab', enterTab(CanvasType.generatorCode)],
    ['the Settings tab', enterTab(CanvasType.settings)],
  ] as const)(
    'brings the ERD tab up from %s first, in no undo step, then selects and scrolls to what it adds',
    (_, enter) => {
      const app = createScreenApp();
      app.store.dispatchSync(scrollToAction({ originX: 0, originY: 0 }));
      enter(app);
      app.store.resetHistory();
      const batches = recordActions(app);

      appendSchema(app, 'sql', UNRELATED_SQL);

      expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
      expect(batches.map(batch => batch.map(({ type }) => type))).toEqual([
        ['settings.changeCanvasType'],
        expect.arrayContaining([
          'table.add',
          'editor.select',
          'settings.scrollTo',
        ]),
      ]);
      expect(selectedNames(app)).toEqual(['posts', 'users']);
      expect(app.store.state.settings.originY).toBeLessThan(0);

      app.store.undo();

      expect(tableNames(app)).toEqual(['old']);
      expect(app.store.state.settings).toMatchObject({
        canvasType: CanvasType.ERD,
        originY: 0,
      });
      expect(app.store.history.hasUndo()).toBe(false);
    }
  );

  it('lands clear of an open Find and Replace panel', () => {
    const app = createScreenApp();
    app.store.dispatchSync(
      changeViewportAction({ width: 900, height: 600 }),
      changeOpenMapAction({ [Open.findReplace]: true })
    );

    appendSchema(app, 'sql', UNRELATED_SQL);

    expect(coveredWidth(app.store.state)).toBeGreaterThan(0);
    expect(selectedLeftOnScreen(app)).toBeGreaterThanOrEqual(
      coveredWidth(app.store.state)
    );
  });

  it('scrolls a block that would land under an open Find and Replace panel', () => {
    const app = createScreenApp();
    const corner = appendCorner(app);
    // The block would land on screen 50 px in, where only the panel hides it.
    app.store.dispatchSync(
      changeViewportAction({ width: 1200, height: 800 }),
      changeOpenMapAction({ [Open.findReplace]: true }),
      scrollToAction({ originX: 50 - corner.x, originY: 100 - corner.y })
    );

    appendSchema(app, 'sql', UNRELATED_SQL);

    expect(selectedLeftOnScreen(app)).toBeGreaterThanOrEqual(
      coveredWidth(app.store.state)
    );
  });

  it('dispatches no tab change when the ERD tab is up already', () => {
    const app = createScreenApp();
    const batches = recordActions(app);

    appendSchema(app, 'sql', UNRELATED_SQL);

    expect(batches).toHaveLength(1);
    expect(batches[0].map(({ type }) => type)).not.toContain(
      'settings.changeCanvasType'
    );
  });

  it.each([
    ['a Flow view', enterFlow, CanvasType.visualization],
    [
      'the Schema SQL tab',
      enterTab(CanvasType.schemaSQL),
      CanvasType.schemaSQL,
    ],
  ] as const)(
    'stays in %s when the import brings nothing',
    (_, enter, canvasType) => {
      const app = createScreenApp();
      enter(app);
      const batches = recordActions(app);

      appendSchema(app, 'sql', 'SELECT 1;');

      expect(batches).toEqual([]);
      expect(app.store.state.settings.canvasType).toBe(canvasType);
    }
  );
});

describe('appendSchemaJSON', () => {
  it('adds the tables and memos of a document apart as the file has them, selected', () => {
    const app = createScreenApp();
    const corner = appendCorner(app);

    appendSchemaJSON(app, ACCOUNTS_JSON());

    expect(cornerOf(app, 'accounts')).toEqual(corner);
    expect(cornerOf(app, 'roles')).toEqual({ x: corner.x + 600, y: corner.y });
    expect(selectedNames(app)).toEqual(['accounts', 'roles']);
    const { doc, editor, collections } = app.store.state;
    const [memoId] = doc.memoIds;
    expect(collections.memoEntities[memoId].ui.y).toBe(corner.y + 360);
    expect(editor.selectedMap[memoId]).toBe(SelectType.memo);
  });

  it('adds nothing for text the parser cannot read', () => {
    const app = createScreenApp();
    const batches = recordActions(app);

    appendSchemaJSON(app, '{"version": "3.0.0",');

    expect(batches).toEqual([]);
    expect(tableNames(app)).toEqual(['old']);
  });
});

describe('appendSchemaPlaced', () => {
  it('lands the tables where Flow put them, under the diagram', async () => {
    const app = createScreenApp();
    const corner = appendCorner(app);
    hoisted.elkLayout = columnLayout;

    await appendSchemaPlaced(app, 'sql', FAN_SQL);

    // The layout answers a column, each table 1000 below the last.
    const corners = ['users', 'posts', 'photos']
      .map(name => cornerOf(app, name))
      .sort((a, b) => a.y - b.y);
    expect(hoisted.requests).toHaveLength(1);
    expect(corners).toEqual([
      corner,
      { x: corner.x, y: corner.y + 1000 },
      { x: corner.x, y: corner.y + 2000 },
    ]);
    expect(cornerOf(app, 'old')).toEqual({ x: 900, y: 900 });
    expect(selectedNames(app)).toEqual(['photos', 'posts', 'users']);
  });

  it('reads the diagram as it lands, so a table moved meanwhile is cleared all the same', async () => {
    const app = createScreenApp();
    const land = pendingColumnLayout();

    const placing = appendSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    app.store.dispatchSync(moveToTableAction({ id: 'old', x: 900, y: 3000 }));
    const corner = appendCorner(app);
    await land();
    await placing;

    const tops = ['users', 'posts', 'photos'].map(
      name => cornerOf(app, name).y
    );
    expect(Math.min(...tops)).toBe(corner.y);
  });

  it('lands the grid under the diagram when no layout comes back', async () => {
    const app = createScreenApp();
    const corner = appendCorner(app);

    await appendSchemaPlaced(app, 'sql', FAN_SQL);

    expect(hoisted.requests).toHaveLength(1);
    expect(tableNames(app)).toHaveLength(4);
    expect(cornerOf(app, 'users').y).toBe(corner.y);
    expect(cornerOf(app, 'posts').y).toBe(corner.y);
  });

  it('lands nothing once a load has replaced the document meanwhile', async () => {
    const app = createScreenApp();
    const land = pendingColumnLayout();

    const placing = appendSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    importSchema(app, 'sql', 'CREATE TABLE newer (id INT);');
    await land();
    await placing;

    expect(tableNames(app)).toEqual(['newer']);
  });

  it('lands both of two appends that overlap, in the order they started', async () => {
    const app = createScreenApp();
    const settles: Array<(points: ElkLayoutPoint[]) => void> = [];
    hoisted.elkLayout = () => new Promise(resolve => settles.push(resolve));

    const first = appendSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    const second = appendSchemaPlaced(app, 'sql', BOOKS_SQL);
    await flush();
    // The second layout comes back first, and waits for the first to land.
    settles[1](await columnLayout(hoisted.requests[1]));
    await flush();
    expect(tableNames(app)).toEqual(['old']);
    settles[0](await columnLayout(hoisted.requests[0]));
    await Promise.all([first, second]);

    expect(tableNames(app).slice(1, 4).sort()).toEqual([
      'photos',
      'posts',
      'users',
    ]);
    expect(tableNames(app).slice(4).sort()).toEqual(['authors', 'books']);
    const firstBottom = Math.max(
      ...['users', 'posts', 'photos'].map(name => cornerOf(app, name).y)
    );
    expect(cornerOf(app, 'authors').y).toBeGreaterThan(firstBottom);
    expect(selectedNames(app)).toEqual(['authors', 'books']);
  });

  it('lands after a replace placing when it started, on the document the replace brings', async () => {
    const app = createScreenApp();
    const settles: Array<(points: ElkLayoutPoint[]) => void> = [];
    hoisted.elkLayout = () => new Promise(resolve => settles.push(resolve));

    const replacing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    const appending = appendSchemaPlaced(app, 'sql', BOOKS_SQL);
    await flush();
    settles[1](await columnLayout(hoisted.requests[1]));
    settles[0](await columnLayout(hoisted.requests[0]));
    await Promise.all([replacing, appending]);

    expect(tableNames(app).slice(0, 3).sort()).toEqual([
      'photos',
      'posts',
      'users',
    ]);
    expect(tableNames(app).slice(3).sort()).toEqual(['authors', 'books']);

    app.store.undo();

    expect(tableNames(app).sort()).toEqual(['photos', 'posts', 'users']);
  });

  it('lands nothing once a replace started after it has superseded it', async () => {
    const app = createScreenApp();
    const settles: Array<(points: ElkLayoutPoint[]) => void> = [];
    hoisted.elkLayout = () => new Promise(resolve => settles.push(resolve));

    const appending = appendSchemaPlaced(app, 'sql', BOOKS_SQL);
    await flush();
    const replacing = importSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    settles[0](await columnLayout(hoisted.requests[0]));
    settles[1](await columnLayout(hoisted.requests[1]));
    await Promise.all([appending, replacing]);

    expect(tableNames(app).sort()).toEqual(['photos', 'posts', 'users']);
  });

  it('brings the ERD tab up when the reader moved to another tab while it placed', async () => {
    const app = createScreenApp();
    app.store.dispatchSync(scrollToAction({ originX: 0, originY: 0 }));
    const land = pendingColumnLayout();

    const placing = appendSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    enterTab(CanvasType.generatorCode)(app);
    await land();
    await placing;

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(selectedNames(app)).toEqual(['photos', 'posts', 'users']);
    expect(app.store.state.settings.originY).toBeLessThan(0);
  });
});

describe('an append to a readonly editor', () => {
  /** A screen app whose readonly switch the test turns, off while it is set up. */
  function createReadonlyApp() {
    const state = { readonly: false };
    const app = createScreenApp({ getReadonly: () => state.readonly });
    app.store.dispatchSync(
      selectAction({ old: SelectType.table }),
      scrollToAction({ originX: -10, originY: -20 })
    );
    return { app, state };
  }

  /** What an append's landing would move although the adds are dropped. */
  const viewOf = ({ store: { state } }: AppContext) => ({
    selectedMap: { ...state.editor.selectedMap },
    originX: state.settings.originX,
    originY: state.settings.originY,
    canvasType: state.settings.canvasType,
  });

  it.each([
    ['appendSchema', (app: AppContext) => appendSchema(app, 'sql', FAN_SQL)],
    [
      'appendSchemaJSON',
      (app: AppContext) => appendSchemaJSON(app, ACCOUNTS_JSON()),
    ],
    [
      'appendSchemaPlaced',
      (app: AppContext) => appendSchemaPlaced(app, 'sql', FAN_SQL),
    ],
  ] as const)(
    '%s adds nothing and leaves the selection, the scroll and the tab',
    async (_, append) => {
      const { app, state } = createReadonlyApp();
      hoisted.elkLayout = columnLayout;
      const view = viewOf(app);
      state.readonly = true;
      const batches = recordActions(app);

      await append(app);

      expect(batches).toEqual([]);
      expect(tableNames(app)).toEqual(['old']);
      expect(viewOf(app)).toEqual(view);
      expect(hoisted.requests).toEqual([]);
    }
  );

  it('keeps a Flow view open, the ERD tab never brought up', () => {
    const { app, state } = createReadonlyApp();
    enterFlow(app);
    state.readonly = true;

    appendSchema(app, 'sql', UNRELATED_SQL);

    expect(app.store.state.settings.canvasType).toBe(CanvasType.visualization);
    expect(getActiveView(app.store.state)).not.toBeNull();
  });

  it('keeps the Schema SQL tab, the ERD tab never brought up', () => {
    const { app, state } = createReadonlyApp();
    enterTab(CanvasType.schemaSQL)(app);
    state.readonly = true;

    appendSchema(app, 'sql', UNRELATED_SQL);

    expect(app.store.state.settings.canvasType).toBe(CanvasType.schemaSQL);
    expect(tableNames(app)).toEqual(['old']);
  });

  it('lands nothing of a placed append once the editor turned readonly meanwhile', async () => {
    const { app, state } = createReadonlyApp();
    const view = viewOf(app);
    const land = pendingColumnLayout();

    const placing = appendSchemaPlaced(app, 'sql', FAN_SQL);
    await flush();
    state.readonly = true;
    const batches = recordActions(app);
    await land();
    await placing;

    expect(batches).toEqual([]);
    expect(tableNames(app)).toEqual(['old']);
    expect(viewOf(app)).toEqual(view);
  });
});
