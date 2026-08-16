import { createRef, FC, html, observable, Ref, ref } from '@dineug/r-html';
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
