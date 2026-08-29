import {
  AnyAction,
  createRef,
  FC,
  html,
  observable,
  Ref,
  ref,
} from '@dineug/r-html';
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
import {
  ErdEditorElement,
  ErdEditorProps,
} from '@/components/erd-editor/ErdEditor';
import { useErdEditorAttachElement } from '@/components/erd-editor/useErdEditorAttachElement';
import {
  dragSelectRectAction,
  editTableAction,
  focusColumnAction,
  focusTableAction,
  focusTableEndAction,
  getLWWAction,
  selectAction,
  selectAllAction,
  SHARED_DRAG_SELECT_TRACKER_TIMEOUT,
  SHARED_FOCUS_TRACKER_TIMEOUT,
  sharedDragSelectTrackerAction,
  sharedFocusTrackerAction,
  sharedSelectionTrackerAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { AccentColor, Appearance, GrayColor } from '@/themes/radix-ui-theme';
import {
  openDiffViewerAction,
  schemaGCAction,
  setThemeOptionsAction,
} from '@/utils/emitter';

type MediaListener = (event: { matches: boolean }) => void;

let mediaListeners: MediaListener[] = [];
let mediaMatches = false;

function fireMediaChange(matches: boolean) {
  mediaMatches = matches;
  mediaListeners.forEach(listener => listener({ matches }));
}

type Harness = {
  api: ReturnType<typeof useErdEditorAttachElement>;
  app: AppContext;
  ctx: ErdEditorElement;
  props: ErdEditorProps;
  root: Ref<HTMLDivElement>;
  mounted: Mounted;
};

let harnesses: Harness[] = [];

async function setup(initialProps: Partial<ErdEditorProps> = {}) {
  const app = createTestAppContext();
  const props = observable<ErdEditorProps>(
    {
      readonly: false,
      systemDarkMode: false,
      enableThemeBuilder: false,
      ...initialProps,
    },
    { shallow: true }
  );
  const ctx = document.createElement('div') as unknown as ErdEditorElement;
  document.body.append(ctx);

  const root = createRef<HTMLDivElement>();
  let api!: ReturnType<typeof useErdEditorAttachElement>;

  const Host: FC<{}, HTMLElement> = () => {
    api = useErdEditorAttachElement({ props, ctx, app, root });
    return () => html`<div ${ref(root)} tabindex="-1"></div>`;
  };

  const mounted = mount(html`<${Host} />`, app);
  await flush();

  const harness: Harness = { api, app, ctx, props, root, mounted };
  harnesses.push(harness);
  return harness;
}

beforeEach(() => {
  mediaListeners = [];
  mediaMatches = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return mediaMatches;
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: MediaListener) => {
      mediaListeners.push(listener);
    },
    removeEventListener: (_type: string, listener: MediaListener) => {
      mediaListeners = mediaListeners.filter(item => item !== listener);
    },
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  harnesses.forEach(({ mounted, ctx }) => {
    mounted.unmount();
    ctx.remove();
  });
  harnesses = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useErdEditorAttachElement', () => {
  it('starts from the slate/indigo/dark preset and reports dark mode', async () => {
    const { api } = await setup();

    expect(api.themeState.options).toEqual({
      grayColor: 'slate',
      accentColor: 'indigo',
      appearance: 'dark',
    });
    expect(api.hasDarkMode()).toBe(true);
    expect(typeof api.theme.canvasBoundaryBackground).toBe('string');
    expect(api.theme.canvasBoundaryBackground.length).toBeGreaterThan(0);
  });

  it('installs the public API on the host element', async () => {
    const { ctx } = await setup();

    expect(typeof ctx.clear).toBe('function');
    expect(typeof ctx.destroy).toBe('function');
    expect(typeof ctx.setInitialValue).toBe('function');
    expect(typeof ctx.setPresetTheme).toBe('function');
    expect(typeof ctx.setTheme).toBe('function');
    expect(typeof ctx.setKeyBindingMap).toBe('function');
    expect(typeof ctx.setSchemaSQL).toBe('function');
    expect(typeof ctx.setSchemaGraphQL).toBe('function');
    expect(typeof ctx.setSchemaDBML).toBe('function');
    expect(typeof ctx.setSchemaAML).toBe('function');
    expect(typeof ctx.getSchemaSQL).toBe('function');
    expect(typeof ctx.getSharedStore).toBe('function');
    expect(typeof ctx.setDiffValue).toBe('function');
    expect(typeof ctx.value).toBe('string');
  });

  it('defines focus/blur as writable own properties that drive the root element', async () => {
    const { ctx, root } = await setup();

    const focusDescriptor = Object.getOwnPropertyDescriptor(ctx, 'focus');
    expect(focusDescriptor?.writable).toBe(true);
    expect(focusDescriptor?.configurable).toBe(true);
    expect(focusDescriptor?.enumerable).toBe(true);

    const $root = root.value as HTMLDivElement;
    const focusSpy = vi.spyOn($root, 'focus');
    const blurSpy = vi.spyOn($root, 'blur');

    ctx.focus();
    expect(focusSpy).toHaveBeenCalledTimes(1);

    ctx.blur();
    expect(focusSpy).toHaveBeenCalledTimes(2);
    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it('applies only valid preset theme options and ignores the rest', async () => {
    const { api, ctx } = await setup();

    ctx.setPresetTheme({
      grayColor: GrayColor.sage,
      accentColor: 'not-a-color' as any,
      appearance: 42 as any,
    });

    expect(api.themeState.options.grayColor).toBe('sage');
    expect(api.themeState.options.accentColor).toBe('indigo');
    expect(api.themeState.options.appearance).toBe('dark');
  });

  it('accepts a valid accent color and rebuilds the accent scale', async () => {
    const { api, ctx } = await setup();
    const before = api.theme.accentColor9;

    ctx.setPresetTheme({ accentColor: AccentColor.tomato });
    await flush();

    expect(api.themeState.options.accentColor).toBe('tomato');
    expect(api.theme.accentColor9).not.toBe(before);
  });

  it('recreates the preset and repaints the theme when the appearance changes', async () => {
    const { api, ctx } = await setup();
    const darkBackground = api.theme.canvasBackground;

    ctx.setPresetTheme({ appearance: Appearance.light });
    await flush();

    expect(api.hasDarkMode()).toBe(false);
    expect(api.theme.canvasBackground).not.toBe(darkBackground);
  });

  it('overlays only string valued known tokens from setTheme', async () => {
    const { api, ctx } = await setup();
    const untouched = api.theme.canvasBoundaryBackground;

    ctx.setTheme({
      canvasBackground: '#123456',
      tableBackground: 999 as any,
      notAToken: '#ffffff',
    } as any);
    await flush();

    expect(api.themeState.custom).toEqual({ canvasBackground: '#123456' });
    expect(api.theme.canvasBackground).toBe('#123456');
    expect(Reflect.has(api.theme, 'notAToken')).toBe(false);
    expect(api.theme.canvasBoundaryBackground).toBe(untouched);
  });

  it('keeps the custom overlay on top of a later preset change', async () => {
    const { api, ctx } = await setup();

    ctx.setTheme({ canvasBackground: '#abcdef' });
    await flush();
    ctx.setPresetTheme({ appearance: Appearance.light });
    await flush();

    expect(api.theme.canvasBackground).toBe('#abcdef');
  });

  it('accepts external key bindings but ignores the reserved and malformed ones', async () => {
    const { app, ctx } = await setup();
    const before = app.keyBindingMap.undo;

    ctx.setKeyBindingMap({
      addTable: [{ shortcut: 'Alt+KeyT' }],
      addColumn: 'Alt+KeyC' as any,
      undo: [{ shortcut: 'Alt+KeyU' }],
    } as any);

    expect(app.keyBindingMap.addTable).toEqual([{ shortcut: 'Alt+KeyT' }]);
    expect(app.keyBindingMap.addColumn).toEqual([
      { shortcut: 'Alt+Enter', preventDefault: true },
    ]);
    expect(app.keyBindingMap.undo).toBe(before);
  });

  it('loads an initial value and emits a schema GC request', async () => {
    const { app, ctx } = await setup();
    const schemaGC = vi.fn();
    app.emitter.on({ schemaGC });

    ctx.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        settings: { databaseName: 'seeded' },
      })
    );

    expect(app.store.state.settings.databaseName).toBe('seeded');
    expect(schemaGC).toHaveBeenCalledTimes(1);
  });

  it('falls back to an empty document when the initial value is not a string', async () => {
    const { app, ctx } = await setup();

    ctx.setInitialValue(undefined as any);

    expect(app.store.state.doc.tableIds).toEqual([]);
    expect(typeof app.store.state.settings.databaseName).toBe('string');
  });

  it('round-trips the document through the value accessor', async () => {
    const { app, ctx } = await setup();

    ctx.value = JSON.stringify({
      version: '3.0.0',
      settings: { databaseName: 'round-trip' },
    });

    expect(app.store.state.settings.databaseName).toBe('round-trip');
    expect(JSON.parse(ctx.value).settings.databaseName).toBe('round-trip');

    ctx.value = '   ';
    expect(app.store.state.settings.databaseName).not.toBe('round-trip');
  });

  it('imports schema SQL and ignores blank input', async () => {
    const { app, ctx } = await setup();

    ctx.setSchemaSQL('CREATE TABLE users (id INT);');
    const tableIds = [...app.store.state.doc.tableIds];
    expect(tableIds.length).toBe(1);
    expect(app.store.state.collections.tableEntities[tableIds[0]].name).toBe(
      'users'
    );

    ctx.setSchemaSQL('   ');
    expect(app.store.state.doc.tableIds).toEqual(tableIds);
  });

  it('imports GraphQL SDL and ignores blank input', async () => {
    const { app, ctx } = await setup();

    ctx.setSchemaGraphQL('type User {\n  id: ID!\n}');
    const tableIds = [...app.store.state.doc.tableIds];
    expect(tableIds.length).toBe(1);
    expect(app.store.state.collections.tableEntities[tableIds[0]].name).toBe(
      'User'
    );

    ctx.setSchemaGraphQL('   ');
    expect(app.store.state.doc.tableIds).toEqual(tableIds);
  });

  it('loads an empty document when the SDL declares no object type', async () => {
    const { app, ctx } = await setup();
    ctx.setSchemaGraphQL('type User {\n  id: ID!\n}');

    ctx.setSchemaGraphQL('query GetUser { user { id } }');

    expect(app.store.state.doc.tableIds).toEqual([]);
  });

  it('imports DBML and ignores blank input', async () => {
    const { app, ctx } = await setup();

    ctx.setSchemaDBML('Table users {\n  id int [pk]\n}');
    const tableIds = [...app.store.state.doc.tableIds];
    expect(tableIds.length).toBe(1);
    expect(app.store.state.collections.tableEntities[tableIds[0]].name).toBe(
      'users'
    );

    ctx.setSchemaDBML('   ');
    expect(app.store.state.doc.tableIds).toEqual(tableIds);
  });

  it('loads an empty document when the DBML declares no table', async () => {
    const { app, ctx } = await setup();
    ctx.setSchemaDBML('Table users {\n  id int [pk]\n}');

    ctx.setSchemaDBML("Project p { database_type: 'PostgreSQL' }");

    expect(app.store.state.doc.tableIds).toEqual([]);
  });

  it('imports AML and ignores blank input', async () => {
    const { app, ctx } = await setup();

    ctx.setSchemaAML('users\n  id int pk');
    const tableIds = [...app.store.state.doc.tableIds];
    expect(tableIds.length).toBe(1);
    expect(app.store.state.collections.tableEntities[tableIds[0]].name).toBe(
      'users'
    );

    ctx.setSchemaAML('   ');
    expect(app.store.state.doc.tableIds).toEqual(tableIds);
  });

  it('loads an empty document when the AML declares no entity', async () => {
    const { app, ctx } = await setup();
    ctx.setSchemaAML('users\n  id int pk');

    ctx.setSchemaAML('type uid int');

    expect(app.store.state.doc.tableIds).toEqual([]);
  });

  it('exports schema SQL for the default and for a named vendor', async () => {
    const { ctx } = await setup();
    ctx.setSchemaSQL('CREATE TABLE users (id INT);');

    const defaultSQL = ctx.getSchemaSQL();
    const postgresSQL = ctx.getSchemaSQL('PostgreSQL');
    const unknownVendorSQL = ctx.getSchemaSQL('NotADatabase' as any);

    expect(defaultSQL).toContain('users');
    expect(postgresSQL).toContain('users');
    expect(unknownVendorSQL).toBe(defaultSQL);
  });

  it('clears the document through clear()', async () => {
    const { app, ctx } = await setup();
    ctx.setSchemaSQL('CREATE TABLE users (id INT);');
    expect(app.store.state.doc.tableIds.length).toBe(1);

    ctx.clear();

    expect(app.store.state.doc.tableIds).toEqual([]);
  });

  it('emits a diff viewer request, defaulting a blank value to an empty document', async () => {
    const { app, ctx } = await setup();
    const openDiffViewer = vi.fn();
    app.emitter.on({ openDiffViewer });

    ctx.setDiffValue('{"version":"3.0.0"}');
    expect(openDiffViewer).toHaveBeenCalledWith(
      openDiffViewerAction({ value: '{"version":"3.0.0"}' })
    );

    ctx.setDiffValue(null as any);
    expect(openDiffViewer).toHaveBeenLastCalledWith(
      openDiffViewerAction({ value: '{}' })
    );
  });

  it('starts and ends mouse tracking around the shared store lifecycle', async () => {
    const { app, ctx } = await setup();
    const mouseTrackerStart = vi.fn();
    const mouseTrackerEnd = vi.fn();
    app.emitter.on({ mouseTrackerStart, mouseTrackerEnd });

    const first = ctx.getSharedStore();
    const second = ctx.getSharedStore();

    expect(Object.isFrozen(first)).toBe(true);
    expect(mouseTrackerStart).toHaveBeenCalledTimes(2);

    first.destroy();
    expect(mouseTrackerEnd).not.toHaveBeenCalled();

    second.destroy();
    expect(mouseTrackerEnd).toHaveBeenCalledTimes(1);
  });

  it('skips mouse tracking when the shared store opts out', async () => {
    const { app, ctx } = await setup();
    const mouseTrackerStart = vi.fn();
    app.emitter.on({ mouseTrackerStart });

    const sharedStore = ctx.getSharedStore({ mouseTracker: false });

    expect(mouseTrackerStart).not.toHaveBeenCalled();
    sharedStore.destroy();
  });

  it('ends mouse tracking when the last shared store is an opted-out one', async () => {
    const { app, ctx } = await setup();
    const mouseTrackerStart = vi.fn();
    const mouseTrackerEnd = vi.fn();
    app.emitter.on({ mouseTrackerStart, mouseTrackerEnd });

    const tracked = ctx.getSharedStore();
    const untracked = ctx.getSharedStore({ mouseTracker: false });

    expect(mouseTrackerStart).toHaveBeenCalledTimes(1);

    tracked.destroy();
    expect(mouseTrackerEnd).not.toHaveBeenCalled();

    untracked.destroy();
    expect(mouseTrackerEnd).toHaveBeenCalledTimes(1);
  });

  it('broadcasts no presence while no shared store is open', async () => {
    const { app, ctx } = await setup();
    const { tableId } = await seedUsersTable(app, ctx);
    const focus = collectSharedFocus(app);
    const selection = collectSharedSelection(app);
    const dragSelect = collectSharedDragSelect(app);

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName }),
      selectAction({ [tableId]: SelectType.table }),
      dragSelectRectAction({ rect: { x: 1, y: 2, w: 3, h: 4 } })
    );
    await flush();

    expect(focus).toHaveLength(0);
    expect(selection).toHaveLength(0);
    expect(dragSelect).toHaveLength(0);
  });

  it('broadcasts an absolute focus snapshot once a shared store exists', async () => {
    const { app, ctx } = await setup();
    const { tableId, columnId } = await seedUsersTable(app, ctx);
    const dispatched = collectSharedFocus(app);
    const sharedStore = ctx.getSharedStore();

    app.store.dispatchSync(
      focusColumnAction({
        tableId,
        columnId,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    await flush();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload).toEqual({
      focus: { tableId, columnId, focusType: FocusType.columnName },
    });
    sharedStore.destroy();
  });

  it('repeats neither the same focus nor the edit flag', async () => {
    const { app, ctx } = await setup();
    const { tableId } = await seedUsersTable(app, ctx);
    const dispatched = collectSharedFocus(app);
    const sharedStore = ctx.getSharedStore();

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );
    await flush();
    expect(dispatched).toHaveLength(1);

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );
    await flush();
    expect(dispatched).toHaveLength(1);

    app.store.dispatchSync(editTableAction());
    await flush();

    expect(app.store.state.editor.focusTable?.edit).toBe(true);
    expect(dispatched).toHaveLength(1);
    sharedStore.destroy();
  });

  it('broadcasts a null focus when the focus ends', async () => {
    const { app, ctx } = await setup();
    const { tableId } = await seedUsersTable(app, ctx);
    const dispatched = collectSharedFocus(app);
    const sharedStore = ctx.getSharedStore();

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );
    await flush();
    app.store.dispatchSync(focusTableEndAction());
    await flush();

    expect(dispatched).toHaveLength(2);
    expect(dispatched[1].payload).toEqual({ focus: null });
    sharedStore.destroy();
  });

  it('skips every presence channel when the shared store opts out', async () => {
    const { app, ctx } = await setup();
    const { tableId } = await seedUsersTable(app, ctx);
    const focus = collectSharedFocus(app);
    const selection = collectSharedSelection(app);
    const dragSelect = collectSharedDragSelect(app);
    const sharedStore = ctx.getSharedStore({ focusTracker: false });

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName }),
      selectAction({ [tableId]: SelectType.table }),
      dragSelectRectAction({ rect: { x: 1, y: 2, w: 3, h: 4 } })
    );
    await flush();

    expect(focus).toHaveLength(0);
    expect(selection).toHaveLength(0);
    expect(dragSelect).toHaveLength(0);
    sharedStore.destroy();
  });

  it('ends focus tracking when the last shared store is an opted-out one', async () => {
    const { app, ctx } = await setup();
    const { tableId } = await seedUsersTable(app, ctx);
    const dispatched = collectSharedFocus(app);

    const tracked = ctx.getSharedStore();
    const untracked = ctx.getSharedStore({ focusTracker: false });

    tracked.destroy();
    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );
    await flush();
    expect(dispatched).toHaveLength(1);

    untracked.destroy();
    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableComment })
    );
    await flush();

    expect(dispatched).toHaveLength(1);
  });

  it('rebroadcasts the unchanged focus so a joining peer learns it', async () => {
    const { app, ctx } = await setup();
    const { tableId } = await seedUsersTable(app, ctx);
    const dispatched = collectSharedFocus(app);
    const sharedStore = ctx.getSharedStore();

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );
    await flush();
    expect(dispatched).toHaveLength(1);

    app.store.dispatchSync(getLWWAction());
    await flush();

    expect(dispatched).toHaveLength(2);
    expect(dispatched[1].payload).toEqual({
      focus: { tableId, columnId: null, focusType: FocusType.tableName },
    });
    sharedStore.destroy();
  });

  it('heartbeats the held focus so a peer never expires a live marker', async () => {
    vi.useFakeTimers();
    try {
      const { app, ctx } = await setup();
      const { tableId } = await seedUsersTable(app, ctx);
      const dispatched = collectSharedFocus(app);
      const sharedStore = ctx.getSharedStore();

      app.store.dispatchSync(
        focusTableAction({ tableId, focusType: FocusType.tableName })
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(dispatched).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(SHARED_FOCUS_TRACKER_TIMEOUT);

      expect(dispatched.length).toBeGreaterThan(1);
      expect(dispatched.at(-1)!.payload).toEqual({
        focus: { tableId, columnId: null, focusType: FocusType.tableName },
      });

      sharedStore.destroy();
      const settled = dispatched.length;
      await vi.advanceTimersByTimeAsync(SHARED_FOCUS_TRACKER_TIMEOUT);
      expect(dispatched).toHaveLength(settled);
    } finally {
      vi.useRealTimers();
    }
  });

  it('broadcasts the sorted selection snapshot once a shared store exists', async () => {
    const { app, ctx } = await setup();
    const { first, second } = await seedTwoTables(app, ctx);
    const dispatched = collectSharedSelection(app);
    const sharedStore = ctx.getSharedStore();

    app.store.dispatchSync(
      selectAction({ [second]: SelectType.table, [first]: SelectType.table })
    );
    await flush();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload).toEqual({
      selectedIds: [first, second].sort(),
    });
    sharedStore.destroy();
  });

  it('repeats no selection broadcast when the same set arrives in another order', async () => {
    const { app, ctx } = await setup();
    const { first, second } = await seedTwoTables(app, ctx);
    const dispatched = collectSharedSelection(app);
    const sharedStore = ctx.getSharedStore();

    app.store.dispatchSync(
      selectAction({ [second]: SelectType.table, [first]: SelectType.table })
    );
    await flush();
    const selectOrder = Object.keys(app.store.state.editor.selectedMap);
    expect(dispatched).toHaveLength(1);

    app.store.dispatchSync(selectAllAction());
    await flush();
    const selectAllOrder = Object.keys(app.store.state.editor.selectedMap);

    expect(selectAllOrder).not.toEqual(selectOrder);
    expect([...selectAllOrder].sort()).toEqual([...selectOrder].sort());
    expect(dispatched).toHaveLength(1);
    sharedStore.destroy();
  });

  it('broadcasts an empty selection when everything is unselected', async () => {
    const { app, ctx } = await setup();
    const { tableId } = await seedUsersTable(app, ctx);
    const dispatched = collectSharedSelection(app);
    const sharedStore = ctx.getSharedStore();

    app.store.dispatchSync(selectAction({ [tableId]: SelectType.table }));
    await flush();
    app.store.dispatchSync(unselectAllAction());
    await flush();

    expect(dispatched).toHaveLength(2);
    expect(dispatched[1].payload).toEqual({ selectedIds: [] });
    sharedStore.destroy();
  });

  it('broadcasts a detached copy of the local drag box', async () => {
    const { app, ctx } = await setup();
    const dispatched = collectSharedDragSelect(app);
    const sharedStore = ctx.getSharedStore();
    const rect = { x: 10, y: 20, w: 30, h: 40 };

    app.store.dispatchSync(dragSelectRectAction({ rect }));
    await flush();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload).toEqual({ rect });
    expect(dispatched[0].payload.rect).not.toBe(
      app.store.state.editor.dragSelect
    );
    sharedStore.destroy();
  });

  it('broadcasts a null drag box when the drag ends', async () => {
    const { app, ctx } = await setup();
    const dispatched = collectSharedDragSelect(app);
    const sharedStore = ctx.getSharedStore();

    app.store.dispatchSync(
      dragSelectRectAction({ rect: { x: 1, y: 2, w: 3, h: 4 } })
    );
    await flush();
    app.store.dispatchSync(dragSelectRectAction({ rect: null }));
    await flush();

    expect(dispatched).toHaveLength(2);
    expect(dispatched[1].payload).toEqual({ rect: null });
    sharedStore.destroy();
  });

  it('rebroadcasts every presence channel so a joining peer learns them', async () => {
    const { app, ctx } = await setup();
    const { tableId } = await seedUsersTable(app, ctx);
    const focus = collectSharedFocus(app);
    const selection = collectSharedSelection(app);
    const dragSelect = collectSharedDragSelect(app);
    const sharedStore = ctx.getSharedStore();
    const rect = { x: 5, y: 6, w: 7, h: 8 };

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName }),
      selectAction({ [tableId]: SelectType.table }),
      dragSelectRectAction({ rect })
    );
    await flush();
    expect(focus).toHaveLength(1);
    expect(selection).toHaveLength(1);
    expect(dragSelect).toHaveLength(1);

    app.store.dispatchSync(getLWWAction());
    await flush();

    expect(focus).toHaveLength(2);
    expect(selection).toHaveLength(2);
    expect(dragSelect).toHaveLength(2);
    expect(focus[1].payload).toEqual({
      focus: { tableId, columnId: null, focusType: FocusType.tableName },
    });
    expect(selection[1].payload).toEqual({ selectedIds: [tableId] });
    expect(dragSelect[1].payload).toEqual({ rect });
    sharedStore.destroy();
  });

  it('heartbeats the held drag box and stays silent once it is gone', async () => {
    vi.useFakeTimers();
    try {
      const { app, ctx } = await setup();
      const dispatched = collectSharedDragSelect(app);
      const sharedStore = ctx.getSharedStore();
      const rect = { x: 12, y: 34, w: 56, h: 78 };

      app.store.dispatchSync(dragSelectRectAction({ rect }));
      await vi.advanceTimersByTimeAsync(0);
      expect(dispatched).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(SHARED_DRAG_SELECT_TRACKER_TIMEOUT);

      expect(dispatched.length).toBeGreaterThan(1);
      expect(dispatched.at(-1)!.payload).toEqual({ rect });

      app.store.dispatchSync(dragSelectRectAction({ rect: null }));
      await vi.advanceTimersByTimeAsync(0);
      const settled = dispatched.length;
      expect(dispatched.at(-1)!.payload).toEqual({ rect: null });

      await vi.advanceTimersByTimeAsync(SHARED_DRAG_SELECT_TRACKER_TIMEOUT);

      expect(dispatched).toHaveLength(settled);
      sharedStore.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops every presence channel and both intervals on the last destroy', async () => {
    vi.useFakeTimers();
    try {
      const { app, ctx } = await setup();
      const { tableId } = await seedUsersTable(app, ctx);
      const focus = collectSharedFocus(app);
      const selection = collectSharedSelection(app);
      const dragSelect = collectSharedDragSelect(app);
      const sharedStore = ctx.getSharedStore();

      app.store.dispatchSync(
        focusTableAction({ tableId, focusType: FocusType.tableName }),
        selectAction({ [tableId]: SelectType.table }),
        dragSelectRectAction({ rect: { x: 1, y: 2, w: 3, h: 4 } })
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(focus).toHaveLength(1);
      expect(selection).toHaveLength(1);
      expect(dragSelect).toHaveLength(1);

      sharedStore.destroy();
      await vi.advanceTimersByTimeAsync(SHARED_DRAG_SELECT_TRACKER_TIMEOUT);
      await vi.advanceTimersByTimeAsync(SHARED_FOCUS_TRACKER_TIMEOUT);

      expect(focus).toHaveLength(1);
      expect(selection).toHaveLength(1);
      expect(dragSelect).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tears every watcher and shared store down on destroy()', async () => {
    const { api, app, ctx } = await setup();
    ctx.getSharedStore({ mouseTracker: false });
    const schemaGC = vi.fn();
    app.emitter.on({ schemaGC });
    expect(api.destroySet.size).toBeGreaterThan(0);

    ctx.destroy();

    expect(api.destroySet.size).toBe(0);
    app.emitter.emit(schemaGCAction());
    expect(schemaGC).not.toHaveBeenCalled();
  });

  it('dispatches a change event for document mutations', async () => {
    const { app, ctx } = await setup();
    const onChange = vi.fn();
    ctx.addEventListener('change', onChange);

    app.store.dispatchSync(
      (
        await import('@/engine/modules/settings/atom.actions')
      ).changeDatabaseNameAction({ value: 'changed' })
    );
    await new Promise(resolve => setTimeout(resolve, 260));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stays silent in readonly mode', async () => {
    const { app, ctx } = await setup({ readonly: true });
    const onChange = vi.fn();
    ctx.addEventListener('change', onChange);

    app.store.dispatchSync(
      (
        await import('@/engine/modules/settings/atom.actions')
      ).changeDatabaseNameAction({ value: 'changed' })
    );
    await new Promise(resolve => setTimeout(resolve, 260));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('answers a setThemeOptions request and echoes the resolved options back', async () => {
    const { app, ctx, api } = await setup();
    const onChangePresetTheme = vi.fn();
    ctx.addEventListener('changePresetTheme', onChangePresetTheme);

    app.emitter.emit(setThemeOptionsAction({ appearance: Appearance.light }));

    expect(api.themeState.options.appearance).toBe('light');
    expect(onChangePresetTheme).toHaveBeenCalledTimes(1);
    const detail = onChangePresetTheme.mock.calls[0][0].detail;
    expect(detail).toEqual({
      grayColor: 'slate',
      accentColor: 'indigo',
      appearance: 'light',
    });
    expect(detail).not.toBe(api.themeState.options);
  });

  it('follows the system appearance only while systemDarkMode is on', async () => {
    const { api, props } = await setup();

    fireMediaChange(true);
    await flush();
    expect(api.themeState.options.appearance).toBe('dark');

    props.systemDarkMode = true;
    await flush();
    expect(api.themeState.options.appearance).toBe('dark');

    fireMediaChange(false);
    await flush();
    expect(api.themeState.options.appearance).toBe('light');

    fireMediaChange(true);
    await flush();
    expect(api.themeState.options.appearance).toBe('dark');
  });

  it('ignores prop changes other than systemDarkMode', async () => {
    const { api, props } = await setup();
    ctxSetLight(api);
    await flush();

    props.readonly = true;
    props.enableThemeBuilder = true;
    await flush();

    expect(api.themeState.options.appearance).toBe('light');
  });

  it('turns the system watcher off again when systemDarkMode goes back to false', async () => {
    const { api, props } = await setup({ systemDarkMode: true });

    props.systemDarkMode = false;
    await flush();
    fireMediaChange(true);
    await flush();

    expect(api.themeState.options.appearance).toBe('dark');

    ctxSetLight(api);
    await flush();
    fireMediaChange(false);
    await flush();

    expect(api.themeState.options.appearance).toBe('light');
  });
});

function ctxSetLight(api: ReturnType<typeof useErdEditorAttachElement>) {
  api.themeState.options.appearance = Appearance.light;
}

async function seedUsersTable(app: AppContext, ctx: ErdEditorElement) {
  ctx.setSchemaSQL('CREATE TABLE users (id INT);');
  await flush();

  const tableId = app.store.state.doc.tableIds[0];
  const columnId =
    app.store.state.collections.tableEntities[tableId].columnIds[0];
  return { tableId, columnId };
}

async function seedTwoTables(app: AppContext, ctx: ErdEditorElement) {
  ctx.setSchemaSQL(
    'CREATE TABLE users (id INT);\nCREATE TABLE posts (id INT);'
  );
  await flush();

  const [first, second] = app.store.state.doc.tableIds;
  return { first, second };
}

function collectDispatched(app: AppContext, type: string) {
  const dispatched: AnyAction[] = [];
  app.store.subscribe(actions => {
    actions.forEach(action => {
      action.type === type && dispatched.push(action);
    });
  });
  return dispatched;
}

function collectSharedFocus(app: AppContext) {
  return collectDispatched(app, sharedFocusTrackerAction.type);
}

function collectSharedSelection(app: AppContext) {
  return collectDispatched(app, sharedSelectionTrackerAction.type);
}

function collectSharedDragSelect(app: AppContext) {
  return collectDispatched(app, sharedDragSelectTrackerAction.type);
}
