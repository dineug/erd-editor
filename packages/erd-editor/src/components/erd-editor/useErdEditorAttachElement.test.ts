import { createSchema, toJson } from '@dineug/erd-editor-schema';
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
import { TABLE_SORT_START } from '@/constants/layout';
import { SaveSettingType } from '@/constants/schema';
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
import {
  changeTableNameAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import type { ElkLayoutPoint, ElkLayoutRequest } from '@/services/elk-layout';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
  SYSTEM_APPEARANCE,
} from '@/themes/radix-ui-theme';
import {
  openDiffViewerAction,
  schemaGCAction,
  setThemeOptionsAction,
} from '@/utils/emitter';

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
        : Promise.reject(new Error('no worker'));
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

/** A one-table document with a known id, placed at the x given. */
const loadedDocument = (x = 0) =>
  JSON.stringify({
    version: '3.0.0',
    doc: { tableIds: ['t1'] },
    collections: {
      tableEntities: {
        t1: {
          id: 't1',
          name: 'loaded',
          comment: '',
          columnIds: [],
          seqColumnIds: [],
          ui: { x, y: 0, zIndex: 2, widthName: 60, widthComment: 60 },
          meta: { updateAt: 1, createAt: 1 },
        },
      },
    },
  });

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
  hoisted.elkLayout = null;
  hoisted.requests.length = 0;
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
    expect(typeof ctx.setSystemAppearance).toBe('function');
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

  it('accepts system as a preset appearance', async () => {
    const { api, ctx } = await setup();

    ctx.setPresetTheme({ appearance: SYSTEM_APPEARANCE });

    expect(api.themeState.options.appearance).toBe('system');
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

  it('lets a host remap the search and find and replace chords, and none of the reserved ones', async () => {
    const { app, ctx } = await setup();
    const reserved = {
      edit: app.keyBindingMap.edit,
      stop: app.keyBindingMap.stop,
      redo: app.keyBindingMap.redo,
      zoomIn: app.keyBindingMap.zoomIn,
      zoomOut: app.keyBindingMap.zoomOut,
      zoomReset: app.keyBindingMap.zoomReset,
    };

    ctx.setKeyBindingMap({
      search: [{ shortcut: '$mod+KeyP', preventDefault: true }],
      findReplace: [{ shortcut: '$mod+Shift+KeyH', preventDefault: true }],
      ...Object.fromEntries(
        Object.keys(reserved).map(name => [name, [{ shortcut: 'KeyQ' }]])
      ),
    } as any);

    expect(app.keyBindingMap.search).toEqual([
      { shortcut: '$mod+KeyP', preventDefault: true },
    ]);
    expect(app.keyBindingMap.findReplace).toEqual([
      { shortcut: '$mod+Shift+KeyH', preventDefault: true },
    ]);
    for (const [name, before] of Object.entries(reserved)) {
      expect(Reflect.get(app.keyBindingMap, name)).toBe(before);
    }
  });

  it('takes an empty list for find and replace, which leaves its chord to the page', async () => {
    const { app, ctx } = await setup();
    const search = app.keyBindingMap.search;

    ctx.setKeyBindingMap({ findReplace: [] } as any);

    expect(app.keyBindingMap.findReplace).toEqual([]);
    expect(app.keyBindingMap.search).toBe(search);
  });

  it('lets a host remap the delete key, or hand Delete and Backspace back to the page', async () => {
    const { app, ctx } = await setup();
    const removeTable = app.keyBindingMap.removeTable;

    ctx.setKeyBindingMap({
      removeSelection: [{ shortcut: 'Alt+KeyD', preventDefault: true }],
    } as any);
    expect(app.keyBindingMap.removeSelection).toEqual([
      { shortcut: 'Alt+KeyD', preventDefault: true },
    ]);

    ctx.setKeyBindingMap({ removeSelection: [] } as any);
    expect(app.keyBindingMap.removeSelection).toEqual([]);
    expect(app.keyBindingMap.removeTable).toBe(removeTable);
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

  it('drops the history of the document setInitialValue replaces', async () => {
    const { app, ctx } = await setup();
    const { store } = app;

    ctx.setSchemaSQL('CREATE TABLE imported (id INT);');
    await flush();
    expect(store.history.size).toBe(1);
    expect(store.state.editor.hasUndo).toBe(true);

    ctx.setInitialValue(loadedDocument());
    await flush();

    expect(store.history.size).toBe(0);
    expect(store.state.editor.hasUndo).toBe(false);
    expect(store.state.editor.hasRedo).toBe(false);

    store.undo();
    store.redo();
    expect(store.state.doc.tableIds).toEqual(['t1']);

    store.dispatchSync(changeTableNameAction({ id: 't1', value: 'renamed' }));
    await flush();
    expect(store.state.editor.hasUndo).toBe(true);

    store.undo();
    expect(store.state.collections.tableEntities['t1'].name).toBe('loaded');
  });

  it('leaves no redo that brings the replaced document back', async () => {
    const { app, ctx } = await setup();
    const { store } = app;

    ctx.setSchemaSQL('CREATE TABLE imported (id INT);');
    store.undo();
    await flush();
    expect(store.state.editor.hasRedo).toBe(true);

    ctx.setInitialValue(loadedDocument());
    await flush();
    expect(store.state.editor.hasRedo).toBe(false);

    store.redo();
    expect(store.state.doc.tableIds).toEqual(['t1']);
  });

  it('keeps a drag still being grouped out of the loaded history', async () => {
    vi.useFakeTimers();
    try {
      const { app, ctx } = await setup();
      const { store } = app;
      ctx.setInitialValue(loadedDocument(0));

      store.dispatchSync(
        moveTableAction({ ids: ['t1'], movementX: 60, movementY: 0 })
      );
      ctx.setInitialValue(loadedDocument(500));
      await vi.advanceTimersByTimeAsync(300);

      expect(store.history.size).toBe(0);
      expect(store.state.editor.hasUndo).toBe(false);

      store.undo();
      expect(store.state.collections.tableEntities['t1'].ui.x).toBe(500);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to an empty document when the initial value is not a string', async () => {
    const { app, ctx } = await setup();

    ctx.setInitialValue(undefined as any);

    expect(app.store.state.doc.tableIds).toEqual([]);
    expect(typeof app.store.state.settings.databaseName).toBe('string');
  });

  describe('the save switches of what a host loads', () => {
    const OFF = SaveSettingType.scroll | SaveSettingType.zoomLevel;
    const file = '{"version":"3.0.0"}';

    it('shows an element given no value a new document, both switches off', async () => {
      const { app, ctx } = await setup();

      expect(app.store.state.settings.ignoreSaveSettings).toBe(OFF);
      expect(JSON.parse(ctx.value).settings.ignoreSaveSettings).toBe(OFF);
    });

    it('loads an empty initial value, a new file, as a new document', async () => {
      const { app, ctx } = await setup();
      ctx.setInitialValue(file);
      expect(app.store.state.settings.ignoreSaveSettings).toBe(0);

      ctx.setInitialValue('');

      expect(app.store.state.settings.ignoreSaveSettings).toBe(OFF);
    });

    it('keeps a file without the field saving its view', async () => {
      const { app, ctx } = await setup();

      ctx.setInitialValue(file);

      expect(app.store.state.settings.ignoreSaveSettings).toBe(0);
    });

    it('sends the new document an empty value loads, which any peer parses', async () => {
      const { app, ctx } = await setup();
      ctx.value = file;
      const sent: AnyAction[] = [];
      app.store.subscribe(actions => sent.push(...actions));

      ctx.value = '';

      const load = sent.find(({ type }) => type === 'editor.loadJson');
      expect(load?.payload).toEqual({ value: toJson(createSchema()) });
      expect(app.store.state.settings.ignoreSaveSettings).toBe(OFF);
    });

    it.each([
      ['setSchemaSQL', 'CREATE TABLE a (id INT);'],
      ['setSchemaDBML', 'Table a {\n  id int\n}'],
      ['setSchemaAML', 'a\n  id int pk'],
      ['setSchemaGraphQL', 'type A { id: ID! }'],
    ] as const)(
      'makes %s on an element given no value a new document',
      async (method, source) => {
        const { app, ctx } = await setup();

        ctx[method](source);

        expect(app.store.state.doc.tableIds).toHaveLength(1);
        expect(JSON.parse(ctx.value).settings.ignoreSaveSettings).toBe(OFF);
      }
    );

    it('keeps the switches of the file a source is imported into', async () => {
      const { app, ctx } = await setup();
      ctx.setInitialValue(file);

      ctx.setSchemaSQL('CREATE TABLE a (id INT);');

      expect(app.store.state.doc.tableIds).toHaveLength(1);
      expect(app.store.state.settings.ignoreSaveSettings).toBe(0);
    });

    it('keeps the switches of the file clear() empties, which stays that file', async () => {
      const { app, ctx } = await setup();
      ctx.setInitialValue(file);
      ctx.setSchemaSQL('CREATE TABLE a (id INT);');

      ctx.clear();

      expect(app.store.state.doc.tableIds).toEqual([]);
      expect(JSON.parse(ctx.value).settings.ignoreSaveSettings).toBe(0);
    });
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

  it('lands an import at once and returns nothing unless asked to place it', async () => {
    const { app, ctx } = await setup();

    expect(ctx.setSchemaSQL('CREATE TABLE users (id INT);')).toBeUndefined();
    expect(app.store.state.doc.tableIds).toHaveLength(1);

    expect(
      ctx.setSchemaAML('accounts\n  id int pk', { placement: 'grid' })
    ).toBeUndefined();
    const { doc, collections } = app.store.state;
    expect(doc.tableIds.map(id => collections.tableEntities[id].name)).toEqual([
      'accounts',
    ]);
    expect(hoisted.requests).toEqual([]);
  });

  it('places an import by its relationships first when asked for auto', async () => {
    const { app, ctx } = await setup();
    hoisted.elkLayout = async ({ nodes }) =>
      nodes.map((node, index) => ({ id: node.id, x: index * 700, y: 0 }));

    const landing = ctx.setSchemaSQL(RELATED_SQL, { placement: 'auto' });
    expect(landing).toBeInstanceOf(Promise);
    expect(app.store.state.doc.tableIds).toEqual([]);
    await landing;

    const { doc, collections } = app.store.state;
    expect(hoisted.requests).toHaveLength(1);
    expect(
      hoisted.requests[0].nodes.map(
        ({ id }) => collections.tableEntities[id].ui.x
      )
    ).toEqual([TABLE_SORT_START, TABLE_SORT_START + 700]);
    expect(doc.tableIds).toHaveLength(2);
    expect(app.store.history.size).toBe(1);
  });

  it.each([
    ['setSchemaSQL', 'CREATE TABLE a (id INT);', 'a'],
    ['setSchemaGraphQL', 'type A { id: ID! }', 'A'],
    ['setSchemaDBML', 'Table a {\n  id int\n}', 'a'],
    ['setSchemaAML', 'a\n  id int pk', 'a'],
  ] as const)(
    'reads %s through its own parser when asked for auto',
    async (method, source, name) => {
      const { app, ctx } = await setup();

      await ctx[method](source, { placement: 'auto' });

      const { doc, collections } = app.store.state;
      expect(
        doc.tableIds.map(id => collections.tableEntities[id].name)
      ).toEqual([name]);
    }
  );

  it.each<[string, (ctx: ErdEditorElement) => void, string[]]>([
    [
      'setInitialValue',
      ctx => ctx.setInitialValue(loadedDocument()),
      ['loaded'],
    ],
    ['the value setter', ctx => (ctx.value = loadedDocument()), ['loaded']],
    ['clear', ctx => ctx.clear(), []],
  ])(
    'lands no auto import once %s has loaded meanwhile',
    async (_, load, names) => {
      const { app, ctx } = await setup();
      let settle = (_: ElkLayoutPoint[]) => {};
      hoisted.elkLayout = () => new Promise(resolve => (settle = resolve));

      const landing = ctx.setSchemaSQL(RELATED_SQL, { placement: 'auto' });
      await flush();
      load(ctx);
      settle(hoisted.requests[0].nodes.map(({ id }) => ({ id, x: 0, y: 0 })));

      await expect(landing).resolves.toBeUndefined();
      const { doc, collections } = app.store.state;
      expect(
        doc.tableIds.map(id => collections.tableEntities[id].name)
      ).toEqual(names);
    }
  );

  it('answers auto on blank input with a settled Promise and no change', async () => {
    const { app, ctx } = await setup();

    await expect(
      ctx.setSchemaDBML('   ', { placement: 'auto' })
    ).resolves.toBeUndefined();
    expect(app.store.history.size).toBe(0);
  });

  it('asks no layout for an auto import a readonly editor would refuse', async () => {
    const { app, ctx } = await setup({ readonly: true });

    await expect(
      ctx.setSchemaSQL(RELATED_SQL, { placement: 'auto' })
    ).resolves.toBeUndefined();
    expect(hoisted.requests).toEqual([]);
    expect(app.store.state.doc.tableIds).toEqual([]);
  });

  /** The names of the tables the document holds, in order. */
  const namesOf = ({ store }: AppContext) =>
    store.state.doc.tableIds.map(
      id => store.state.collections.tableEntities[id].name
    );

  it('adds an import below the diagram for an append, returning nothing', async () => {
    const { app, ctx } = await setup();
    ctx.setSchemaSQL('CREATE TABLE users (id INT);');

    expect(
      ctx.setSchemaGraphQL('type Post { id: ID! }', { mode: 'append' })
    ).toBeUndefined();
    expect(
      ctx.setSchemaDBML('Table tags {\n  id int\n}', {
        mode: 'append',
        placement: 'grid',
      })
    ).toBeUndefined();
    ctx.setSchemaAML('roles\n  id int pk', { mode: 'append' });
    ctx.setSchemaSQL('   ', { mode: 'append' });

    expect(namesOf(app)).toEqual(['users', 'Post', 'tags', 'roles']);
    expect(hoisted.requests).toEqual([]);
  });

  it('places an import by its relationships before adding it for auto', async () => {
    const { app, ctx } = await setup();
    ctx.setSchemaSQL('CREATE TABLE old (id INT);');
    hoisted.elkLayout = async ({ nodes }) =>
      nodes.map((node, index) => ({ id: node.id, x: index * 700, y: 0 }));

    const landing = ctx.setSchemaSQL(RELATED_SQL, {
      placement: 'auto',
      mode: 'append',
    });
    expect(landing).toBeInstanceOf(Promise);
    expect(namesOf(app)).toEqual(['old']);
    await landing;

    expect(hoisted.requests).toHaveLength(1);
    expect(namesOf(app)).toEqual(['old', 'users', 'posts']);
    expect(app.store.history.size).toBe(2);
  });

  it('adds nothing to a readonly editor, which it would refuse', async () => {
    const { app, ctx, props } = await setup();
    ctx.setSchemaSQL('CREATE TABLE old (id INT);');
    props.readonly = true;
    await flush();

    ctx.setSchemaSQL('CREATE TABLE more (id INT);', { mode: 'append' });
    await expect(
      ctx.setSchemaSQL(RELATED_SQL, { placement: 'auto', mode: 'append' })
    ).resolves.toBeUndefined();
    ctx.setSchemaJSON(JSON.stringify(app.store.state), { mode: 'append' });

    expect(namesOf(app)).toEqual(['old']);
    expect(hoisted.requests).toEqual([]);
    expect(app.store.state.editor.selectedMap).toEqual({});
  });

  it('replaces the document with setSchemaJSON, an edit undo takes back', async () => {
    const { app, ctx } = await setup();
    ctx.setSchemaSQL('CREATE TABLE old (id INT);');
    const json = loadedDocument(40);

    ctx.setSchemaJSON(json);
    expect(namesOf(app)).toEqual(['loaded']);
    ctx.setSchemaJSON('  ');
    expect(namesOf(app)).toEqual(['loaded']);

    app.store.undo();
    expect(namesOf(app)).toEqual(['old']);
  });

  it('adds a document with setSchemaJSON for an append, keeping the settings', async () => {
    const { app, ctx } = await setup();
    ctx.setSchemaSQL('CREATE TABLE old (id INT);');
    const { databaseName } = app.store.state.settings;

    ctx.setSchemaJSON(loadedDocument(40), {
      mode: 'append',
    });

    expect(namesOf(app)).toEqual(['old', 'loaded']);
    expect(app.store.state.settings.databaseName).toBe(databaseName);
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
      openDiffViewerAction({ value: toJson(createSchema()) })
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

    fireMediaChange(false);
    await flush();
    expect(api.themeState.options.appearance).toBe('dark');
    expect(api.hasDarkMode()).toBe(true);

    props.systemDarkMode = true;
    await flush();
    expect(api.themeState.options.appearance).toBe('system');
    expect(api.hasDarkMode()).toBe(false);

    fireMediaChange(true);
    await flush();
    expect(api.hasDarkMode()).toBe(true);

    fireMediaChange(false);
    await flush();
    expect(api.hasDarkMode()).toBe(false);
  });

  it('repaints the theme when the system it follows turns light or dark', async () => {
    const { api, ctx } = await setup();
    const darkBackground = api.theme.canvasBackground;

    ctx.setPresetTheme({ appearance: SYSTEM_APPEARANCE });
    await flush();
    expect(api.theme.canvasBackground).not.toBe(darkBackground);

    fireMediaChange(true);
    await flush();
    expect(api.theme.canvasBackground).toBe(darkBackground);
  });

  it('keeps a light or dark the builder picked while systemDarkMode is on', async () => {
    const { api, app, props } = await setup();
    props.systemDarkMode = true;
    await flush();

    app.emitter.emit(setThemeOptionsAction({ appearance: Appearance.light }));
    fireMediaChange(true);
    await flush();

    expect(api.themeState.options.appearance).toBe('light');
    expect(api.hasDarkMode()).toBe(false);
  });

  it('echoes a system pick from the builder as system, not as what it shows', async () => {
    const { app, ctx } = await setup();
    const onChangePresetTheme = vi.fn();
    ctx.addEventListener('changePresetTheme', onChangePresetTheme);

    app.emitter.emit(setThemeOptionsAction({ appearance: SYSTEM_APPEARANCE }));

    expect(onChangePresetTheme.mock.calls[0][0].detail).toEqual({
      grayColor: 'slate',
      accentColor: 'indigo',
      appearance: 'system',
    });
  });

  it('lets a host name what system shows, over the OS color scheme', async () => {
    const { api, ctx } = await setup();
    ctx.setPresetTheme({ appearance: SYSTEM_APPEARANCE });
    ctx.setSystemAppearance(Appearance.dark);
    await flush();
    expect(api.hasDarkMode()).toBe(true);

    fireMediaChange(false);
    await flush();
    expect(api.hasDarkMode()).toBe(true);

    ctx.setSystemAppearance(Appearance.light);
    await flush();
    expect(api.hasDarkMode()).toBe(false);
    expect(api.theme.canvasBackground).toBe(
      createTheme({ ...api.themeState.options, appearance: 'light' })
        .canvasBackground
    );
  });

  it('hands system back to the OS color scheme for null or an unknown value', async () => {
    const { api, ctx } = await setup();
    ctx.setPresetTheme({ appearance: SYSTEM_APPEARANCE });
    ctx.setSystemAppearance(Appearance.light);
    await flush();

    fireMediaChange(true);
    ctx.setSystemAppearance(null);
    await flush();
    expect(api.themeState.systemAppearance).toBeNull();
    expect(api.hasDarkMode()).toBe(true);

    ctx.setSystemAppearance(Appearance.light);
    ctx.setSystemAppearance('system' as any);
    await flush();
    expect(api.themeState.systemAppearance).toBeNull();
    expect(api.hasDarkMode()).toBe(true);
  });

  it('keeps the light or dark picked when the host names what system shows', async () => {
    const { api, ctx } = await setup();
    ctx.setPresetTheme({ appearance: Appearance.light });
    await flush();
    const lightBackground = api.theme.canvasBackground;

    ctx.setSystemAppearance(Appearance.dark);
    await flush();

    expect(api.hasDarkMode()).toBe(false);
    expect(api.theme.canvasBackground).toBe(lightBackground);
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

  it('keeps the appearance system shows when systemDarkMode goes back to false', async () => {
    const { api, props } = await setup();
    props.systemDarkMode = true;
    await flush();

    props.systemDarkMode = false;
    await flush();
    expect(api.themeState.options.appearance).toBe('light');

    fireMediaChange(true);
    await flush();
    expect(api.hasDarkMode()).toBe(false);

    ctxSetLight(api);
    await flush();
    fireMediaChange(false);
    await flush();

    expect(api.themeState.options.appearance).toBe('light');
  });

  it('leaves a light or dark as it is when systemDarkMode goes back to false', async () => {
    const { api, ctx, props } = await setup();
    props.systemDarkMode = true;
    await flush();
    ctx.setPresetTheme({ appearance: Appearance.dark });
    await flush();

    props.systemDarkMode = false;
    await flush();

    expect(api.themeState.options.appearance).toBe('dark');
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
