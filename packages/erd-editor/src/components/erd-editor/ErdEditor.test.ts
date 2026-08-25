import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as erdStyles from '@/components/erd/Erd.styles';
import {
  ErdEditorElement,
  ErdEditorProps,
} from '@/components/erd-editor/ErdEditor';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { focusEvent, forceFocusEvent } from '@/utils/internalEvents';

const { appContexts, gcState } = vi.hoisted(() => ({
  appContexts: [] as any[],
  gcState: {
    service: null as null | { run: (source: string) => Promise<any> },
  },
}));

vi.mock('@/components/appContext', async importOriginal => {
  const mod = await importOriginal<typeof import('@/components/appContext')>();

  return {
    ...mod,
    createAppContext: (...args: any[]) => {
      const app = (mod.createAppContext as any)(...args);
      appContexts.push(app);
      return app;
    },
  };
});

vi.mock('@/services/schema-gc', () => ({
  getSchemaGCService: () => gcState.service,
}));

await import('@/components/erd-editor/ErdEditor');

type ResizeCallback = (
  entries: Array<{ contentRect: DOMRectReadOnly }>
) => void;

let resizeCallbacks: ResizeCallback[] = [];
const OriginalResizeObserver = globalThis.ResizeObserver;

class CapturingResizeObserver {
  constructor(callback: ResizeCallback) {
    resizeCallbacks.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const shadowRoots = new WeakMap<Element, ShadowRoot>();
const originalAttachShadow = Element.prototype.attachShadow;

beforeAll(() => {
  Element.prototype.attachShadow = function attachShadow(
    this: Element,
    init: ShadowRootInit
  ) {
    const shadow = originalAttachShadow.call(this, init);
    shadowRoots.set(this, shadow);
    return shadow;
  };
});

afterAll(() => {
  Element.prototype.attachShadow = originalAttachShadow;
  Reflect.set(globalThis, 'ResizeObserver', OriginalResizeObserver);
});

type Editor = {
  el: ErdEditorElement;
  app: AppContext;
  shadow: ShadowRoot;
  root: HTMLDivElement;
};

const editors: ErdEditorElement[] = [];

async function createEditor(
  props: Partial<ErdEditorProps> = {},
  beforeConnect?: (el: ErdEditorElement) => void
): Promise<Editor> {
  const el = document.createElement('erd-editor');
  Object.assign(el, props);
  beforeConnect?.(el);
  document.body.append(el);
  editors.push(el);
  await flush();

  const shadow = shadowRoots.get(el) as ShadowRoot;
  const root = shadow.querySelector('.root') as HTMLDivElement;
  const app = appContexts[appContexts.length - 1] as AppContext;

  return { el, app, shadow, root };
}

beforeEach(() => {
  resizeCallbacks = [];
  Reflect.set(globalThis, 'ResizeObserver', CapturingResizeObserver);
  gcState.service = { run: async () => emptyGCIds() };
});

afterEach(() => {
  editors.forEach(el => el.remove());
  editors.length = 0;
  appContexts.length = 0;
  vi.restoreAllMocks();
});

const ERD_ROOT_CLASS = String(erdStyles.root);

function hasErdCanvas(shadow: ShadowRoot) {
  return Array.from(shadow.querySelectorAll('div')).some(el =>
    el.classList.contains(ERD_ROOT_CLASS)
  );
}

function emptyGCIds() {
  return {
    tableIds: [],
    tableColumnIds: [],
    relationshipIds: [],
    indexIds: [],
    indexColumnIds: [],
    memoIds: [],
  };
}

describe('<erd-editor>', () => {
  it('renders a focusable root inside its closed shadow root', async () => {
    const { el, shadow, root } = await createEditor();

    expect(el.shadowRoot).toBeNull();
    expect(root).toBeTruthy();
    expect(root.getAttribute('tabindex')).toBe('-1');
    expect(root.classList.contains('dark')).toBe(true);
    expect(shadow.querySelector('.toolbar')).toBeTruthy();
  });

  it('renders the ERD canvas by default and swaps it for the other canvas types', async () => {
    const { app, shadow } = await createEditor();
    expect(hasErdCanvas(shadow)).toBe(true);

    for (const canvasType of [
      CanvasType.visualization,
      CanvasType.schemaSQL,
      CanvasType.generatorCode,
      CanvasType.settings,
    ]) {
      app.store.dispatchSync(changeCanvasTypeAction({ value: canvasType }));
      await flush();

      expect(app.store.state.settings.canvasType).toBe(canvasType);
      expect(hasErdCanvas(shadow)).toBe(false);
    }

    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    await flush();
    expect(hasErdCanvas(shadow)).toBe(true);
  });

  it('renders the theme builder only when enableThemeBuilder is set', async () => {
    const { el, app, shadow } = await createEditor();
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.themeBuilder]: true } as any)
    );
    await flush();
    expect(shadow.querySelector('.theme-builder')).toBeNull();

    el.enableThemeBuilder = true;
    await flush();
    expect(shadow.querySelector('.theme-builder')).toBeTruthy();

    el.enableThemeBuilder = false;
    await flush();
    expect(shadow.querySelector('.theme-builder')).toBeNull();
  });

  it('reflects the enable-theme-builder and readonly attributes onto the props', async () => {
    const { el } = await createEditor({}, target => {
      target.setAttribute('enable-theme-builder', '');
      target.setAttribute('readonly', 'true');
    });

    expect(el.enableThemeBuilder).toBe(true);
    expect(el.readonly).toBe(true);

    el.setAttribute('readonly', 'false');
    await flush();
    expect(el.readonly).toBe(false);
  });

  it('feeds root keydown events into the shared keydown stream', async () => {
    const { app, root } = await createEditor();
    const received: KeyboardEvent[] = [];
    const subscription = app.keydown$.subscribe(event => received.push(event));

    const event = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' });
    root.dispatchEvent(event);

    expect(received).toEqual([event]);
    subscription.unsubscribe();
  });

  it('re-applies the none-focus modifier a beat after focus leaves the root', async () => {
    const { root } = await createEditor();
    expect(root.classList.contains('none-focus')).toBe(false);

    root.dispatchEvent(new FocusEvent('focusout'));
    await new Promise(resolve => setTimeout(resolve, 30));
    await flush();
    expect(root.classList.contains('none-focus')).toBe(true);

    root.dispatchEvent(new FocusEvent('focusin'));
    await flush();
    expect(root.classList.contains('none-focus')).toBe(false);
  });

  it('keeps the focus state when focus only moves between descendants', async () => {
    const { root } = await createEditor();

    root.dispatchEvent(new FocusEvent('focusout'));
    root.dispatchEvent(new FocusEvent('focusin'));
    await new Promise(resolve => setTimeout(resolve, 30));
    await flush();

    expect(root.classList.contains('none-focus')).toBe(false);
  });

  it('forwards clipboard events to the emitter', async () => {
    const { app, root } = await createEditor();
    const copy = vi.fn();
    const paste = vi.fn();
    app.emitter.on({ copy, paste });

    const copyEvent = new Event('copy');
    const pasteEvent = new Event('paste');
    root.dispatchEvent(copyEvent);
    root.dispatchEvent(pasteEvent);

    expect(copy.mock.calls[0][0].payload.event).toBe(copyEvent);
    expect(paste.mock.calls[0][0].payload.event).toBe(pasteEvent);
  });

  it('closes the theme builder when the pointer goes down outside of it', async () => {
    const { app, root } = await createEditor({ enableThemeBuilder: true });
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.themeBuilder]: true } as any)
    );
    await flush();
    expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(true);

    root.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();

    expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(false);
  });

  it('leaves the theme builder open for clicks inside the toolbar or the panel', async () => {
    const { app, shadow } = await createEditor({ enableThemeBuilder: true });

    for (const selector of ['.toolbar', '.theme-builder']) {
      app.store.dispatchSync(
        changeOpenMapAction({ [Open.themeBuilder]: true } as any)
      );
      await flush();

      const target = shadow.querySelector(selector) as HTMLElement;
      expect(target).toBeTruthy();
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await flush();

      expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(true);
    }
  });

  it('ignores a mousedown that carries no target element', async () => {
    const { app, root } = await createEditor({ enableThemeBuilder: true });
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.themeBuilder]: true } as any)
    );
    await flush();

    const event = new MouseEvent('mousedown', { bubbles: true });
    Object.defineProperty(event, 'target', {
      configurable: true,
      get: () => null,
    });
    root.dispatchEvent(event);
    await flush();

    expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(true);
  });

  it('does nothing on mousedown while the theme builder is closed', async () => {
    const { app, root } = await createEditor();
    expect(app.store.state.editor.openMap[Open.themeBuilder]).toBeFalsy();

    root.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();

    expect(app.store.state.editor.openMap[Open.themeBuilder]).toBeFalsy();
  });

  it('pushes observed resize entries into the viewport, minus the toolbar height', async () => {
    const { app } = await createEditor();
    expect(resizeCallbacks.length).toBeGreaterThan(0);

    resizeCallbacks[0]([
      { contentRect: { width: 800, height: 640 } as DOMRectReadOnly },
    ]);
    await flush();

    expect(app.store.state.editor.viewport).toEqual({
      width: 800,
      height: 640 - TOOLBAR_HEIGHT,
    });
  });

  it('re-focuses itself when an internal focus event arrives while focus is elsewhere', async () => {
    const focusSpy = vi.fn();
    const { el } = await createEditor({}, target => {
      const original = target.focus;
      Object.defineProperty(target, 'focus', {
        configurable: true,
        writable: true,
        value: () => {
          focusSpy();
          original.call(target);
        },
      });
    });

    const outside = document.createElement('input');
    document.body.append(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const callsAfterMount = focusSpy.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    el.dispatchEvent(focusEvent());
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(focusSpy.mock.calls.length).toBe(callsAfterMount + 1);

    el.dispatchEvent(forceFocusEvent());
    expect(focusSpy.mock.calls.length).toBe(callsAfterMount + 2);
    outside.remove();
  });

  it('skips the re-focus when the editor already owns focus', async () => {
    const focusSpy = vi.fn();
    const { el } = await createEditor({}, target => {
      const original = target.focus;
      Object.defineProperty(target, 'focus', {
        configurable: true,
        writable: true,
        value: () => {
          focusSpy();
          original.call(target);
        },
      });
    });

    const callsAfterMount = focusSpy.mock.calls.length;
    el.dispatchEvent(focusEvent());
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(document.activeElement).toBe(el);
    expect(focusSpy.mock.calls.length).toBe(callsAfterMount);
  });

  it('tracks mouse tracking state through the emitter', async () => {
    const { el, app } = await createEditor();
    const sharedStore = el.getSharedStore();
    await flush();

    const trackerStart = vi.fn();
    const trackerEnd = vi.fn();
    app.emitter.on({
      mouseTrackerStart: trackerStart,
      mouseTrackerEnd: trackerEnd,
    });

    sharedStore.destroy();
    await flush();
    expect(trackerEnd).toHaveBeenCalledTimes(1);
    expect(trackerStart).not.toHaveBeenCalled();
  });

  it('runs schema GC and applies the returned ids when the emitter asks for it', async () => {
    const { el, app } = await createEditor();
    el.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        settings: { databaseName: 'gc' },
      })
    );
    el.setSchemaSQL('CREATE TABLE gone (id INT);');
    await flush();

    const tableIds = [...app.store.state.doc.tableIds];
    expect(tableIds.length).toBe(1);

    gcState.service = {
      run: async () => ({ ...emptyGCIds(), tableIds }),
    };
    app.emitter.emit({ type: 'schemaGC', payload: undefined } as any);
    await flush(6);

    expect(
      Object.keys(app.store.state.collections.tableEntities)
    ).not.toContain(tableIds[0]);
  });

  it('leaves the document untouched when schema GC finds nothing', async () => {
    const { el, app } = await createEditor();
    el.setSchemaSQL('CREATE TABLE keep (id INT);');
    await flush();
    const tableIds = [...app.store.state.doc.tableIds];

    app.emitter.emit({ type: 'schemaGC', payload: undefined } as any);
    await flush(6);

    expect(app.store.state.doc.tableIds).toEqual(tableIds);
  });

  it('survives a missing schema GC worker', async () => {
    gcState.service = null;
    const { el, app } = await createEditor();

    expect(() =>
      el.setInitialValue(JSON.stringify({ version: '3.0.0' }))
    ).not.toThrow();
    await flush();
    expect(app.store.state.doc.tableIds).toEqual([]);
  });

  it('exposes the document through value, setInitialValue and the SQL helpers', async () => {
    const { el } = await createEditor();

    el.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        settings: { databaseName: 'public-api' },
      })
    );
    await flush();
    expect(JSON.parse(el.value).settings.databaseName).toBe('public-api');

    el.setSchemaSQL('CREATE TABLE accounts (id INT);');
    await flush();
    expect(el.getSchemaSQL('PostgreSQL')).toContain('accounts');

    el.clear();
    await flush();
    expect(JSON.parse(el.value).doc.tableIds).toEqual([]);
  });

  it('repaints when the preset theme is switched to light', async () => {
    const { el, root } = await createEditor();
    expect(root.classList.contains('dark')).toBe(true);

    el.setPresetTheme({ appearance: 'light' });
    await flush();
    expect(root.classList.contains('dark')).toBe(false);

    el.setTheme({ canvasBackground: '#101010' });
    await flush();
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('accepts external key bindings', async () => {
    const { el, app } = await createEditor();

    el.setKeyBindingMap({ addTable: [{ shortcut: 'Alt+KeyT' }] });
    await flush();

    expect(app.keyBindingMap.addTable).toEqual([{ shortcut: 'Alt+KeyT' }]);
  });

  it('emits a change event for edits and stays quiet while readonly', async () => {
    const { el, app } = await createEditor();
    const onChange = vi.fn();
    el.addEventListener('change', onChange);

    el.setSchemaSQL('CREATE TABLE a (id INT);');
    await new Promise(resolve => setTimeout(resolve, 260));
    expect(onChange).toHaveBeenCalled();

    el.readonly = true;
    await flush();
    onChange.mockClear();

    el.setSchemaSQL('CREATE TABLE b (id INT);');
    await new Promise(resolve => setTimeout(resolve, 260));
    expect(onChange).not.toHaveBeenCalled();
    expect(app.store.state.doc.tableIds.length).toBeGreaterThan(0);
  });

  it('imports GraphQL SDL and stays quiet while readonly', async () => {
    const { el, app } = await createEditor();
    const onChange = vi.fn();
    el.addEventListener('change', onChange);

    el.setSchemaGraphQL('type User {\n  id: ID!\n}');
    await new Promise(resolve => setTimeout(resolve, 260));
    expect(onChange).toHaveBeenCalled();

    el.readonly = true;
    await flush();
    onChange.mockClear();

    el.setSchemaGraphQL('type Post {\n  id: ID!\n}');
    await new Promise(resolve => setTimeout(resolve, 260));
    expect(onChange).not.toHaveBeenCalled();
    expect(app.store.state.doc.tableIds.length).toBeGreaterThan(0);
  });

  it('imports DBML and stays quiet while readonly', async () => {
    const { el, app } = await createEditor();
    const onChange = vi.fn();
    el.addEventListener('change', onChange);

    el.setSchemaDBML('Table users {\n  id int [pk]\n}');
    await new Promise(resolve => setTimeout(resolve, 260));
    expect(onChange).toHaveBeenCalled();

    el.readonly = true;
    await flush();
    onChange.mockClear();

    el.setSchemaDBML('Table posts {\n  id int [pk]\n}');
    await new Promise(resolve => setTimeout(resolve, 260));
    expect(onChange).not.toHaveBeenCalled();
    expect(app.store.state.doc.tableIds.length).toBeGreaterThan(0);
  });

  it('imports AML and stays quiet while readonly', async () => {
    const { el, app } = await createEditor();
    const onChange = vi.fn();
    el.addEventListener('change', onChange);

    el.setSchemaAML('users\n  id int pk');
    await new Promise(resolve => setTimeout(resolve, 260));
    expect(onChange).toHaveBeenCalled();

    el.readonly = true;
    await flush();
    onChange.mockClear();

    el.setSchemaAML('posts\n  id int pk');
    await new Promise(resolve => setTimeout(resolve, 260));
    expect(onChange).not.toHaveBeenCalled();
    expect(app.store.state.doc.tableIds.length).toBeGreaterThan(0);
  });

  it('asks for a diff viewer through setDiffValue', async () => {
    const { el, app } = await createEditor();
    const openDiffViewer = vi.fn();
    app.emitter.on({ openDiffViewer });

    el.setDiffValue('{"version":"3.0.0"}');

    expect(openDiffViewer.mock.calls[0][0].payload.value).toBe(
      '{"version":"3.0.0"}'
    );
  });

  it('unsubscribes on disconnect and tears the context down on destroy', async () => {
    const { el, app } = await createEditor();
    const onSchemaGC = vi.fn();
    app.emitter.on({ schemaGC: onSchemaGC });

    el.destroy();
    el.remove();
    await flush();

    app.emitter.emit({ type: 'schemaGC', payload: undefined } as any);
    expect(onSchemaGC).not.toHaveBeenCalled();
  });

  it('follows the system appearance when systemDarkMode is enabled', async () => {
    const { el, root } = await createEditor();

    el.systemDarkMode = true;
    await flush();

    expect(root.classList.contains('dark')).toBe(false);
  });
});
