import { toJson } from '@dineug/erd-editor-schema';
import { FC, html, render } from '@dineug/r-html';
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
import { useI18n } from '@/components/localeContext';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeZenModeAction,
} from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableGroupAction,
  removeTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';
import { MESSAGES } from '@/i18n/messages/index';
import { getTableRect } from '@/konva/scene/metrics';
import { toScreenPoint } from '@/konva/scene/viewport';
import {
  openLocalePickerAction,
  openThemeBuilderAction,
} from '@/utils/emitter';
import { focusEvent, forceFocusEvent } from '@/utils/internalEvents';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';

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

const quickSearch = vi.hoisted(() => ({
  props: null as null | { appearance?: string; locale?: string },
}));

// The palette renders as it is; the wrapper only keeps the props object the
// element hands it, which r-html updates in place on every render.
vi.mock('@/components/quick-search/QuickSearch', async importOriginal => {
  const mod =
    await importOriginal<
      typeof import('@/components/quick-search/QuickSearch')
    >();

  return {
    ...mod,
    default: (props: any, ctx: any) => {
      quickSearch.props = props;
      return mod.default(props, ctx);
    },
  };
});

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

/** A prefers-color-scheme query the spec flips; a removed element hears no change. */
function stubColorScheme(matches: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const query = {
    matches,
    addEventListener: (
      _: string,
      listener: (event: { matches: boolean }) => void
    ) => listeners.add(listener),
    removeEventListener: (
      _: string,
      listener: (event: { matches: boolean }) => void
    ) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);

  return {
    listeners,
    change(next: boolean) {
      query.matches = next;
      listeners.forEach(listener => listener({ matches: next }));
    },
  };
}

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
    tableGroupIds: [],
  };
}

/** Chromium's navigator.languages, a frozen array. */
function spyLanguages(languages: string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(
    Object.freeze([...languages]) as string[]
  );
}

/** A middle press on a node of the shadow tree, composed as a mouse's is. */
function pressMiddle(target: EventTarget): MouseEvent {
  const press = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 1,
  });
  target.dispatchEvent(press);
  return press;
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

  it('takes the toolbar away in zen mode, and only over the canvas it was entered from', async () => {
    const { app, shadow } = await createEditor();

    app.store.dispatchSync(changeZenModeAction({ value: true }));
    await flush();

    expect(shadow.querySelector('.toolbar')).toBeNull();

    // Another canvas type keeps its toolbar whatever the mode says, or the tab
    // that turned zen mode on would be the only one it could be turned off from.
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    await flush();

    expect(shadow.querySelector('.toolbar')).toBeTruthy();
  });

  it('gives the canvas the toolbar height back the moment zen mode takes it away', async () => {
    const { app } = await createEditor();

    resizeCallbacks[0]([
      { contentRect: { width: 900, height: 600 } as DOMRectReadOnly },
    ]);
    await flush();
    expect(app.store.state.editor.viewport).toEqual({
      width: 900,
      height: 600 - TOOLBAR_HEIGHT,
    });

    // No resize follows a mode change, so the viewport has to be applied from
    // the mode as well, or the scene would stay short by a toolbar.
    app.store.dispatchSync(changeZenModeAction({ value: true }));
    await flush();
    expect(app.store.state.editor.viewport).toEqual({
      width: 900,
      height: 600,
    });

    app.store.dispatchSync(changeZenModeAction({ value: false }));
    await flush();
    expect(app.store.state.editor.viewport).toEqual({
      width: 900,
      height: 600 - TOOLBAR_HEIGHT,
    });
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

  it('reflects the locale picker and welcome screen attributes onto the props, both off by default', async () => {
    const { el: plain } = await createEditor();
    expect(plain.enableLocalePicker).toBe(false);
    expect(plain.enableWelcomeScreen).toBe(false);

    const { el } = await createEditor({}, target => {
      target.setAttribute('enable-locale-picker', '');
      target.setAttribute('enable-welcome-screen', 'true');
    });

    expect(el.enableLocalePicker).toBe(true);
    expect(el.enableWelcomeScreen).toBe(true);

    el.setAttribute('enable-locale-picker', 'false');
    el.setAttribute('enable-welcome-screen', 'false');
    await flush();
    expect(el.enableLocalePicker).toBe(false);
    expect(el.enableWelcomeScreen).toBe(false);
  });

  it('shows the toolbar language button only while enableLocalePicker is set', async () => {
    const { el, shadow } = await createEditor();
    expect(shadow.querySelector('.toolbar-locale')).toBeNull();

    el.enableLocalePicker = true;
    await flush();
    expect(shadow.querySelector('.toolbar-locale')).toBeTruthy();

    el.enableLocalePicker = false;
    await flush();
    expect(shadow.querySelector('.toolbar-locale')).toBeNull();
  });

  it('marks its root with the language and direction shown, and the host with neither', async () => {
    const { el, root } = await createEditor();
    expect(root.getAttribute('lang')).toBe('en');
    expect(root.getAttribute('dir')).toBe('ltr');

    el.setLocale('ar-SA');
    await flush();
    expect(root.getAttribute('lang')).toBe('ar-SA');
    expect(root.getAttribute('dir')).toBe('rtl');

    el.setLocale('ko-KR');
    await flush();
    expect(root.getAttribute('lang')).toBe('ko-KR');
    expect(root.getAttribute('dir')).toBe('ltr');
    expect(el.hasAttribute('lang')).toBe(false);
    expect(el.hasAttribute('dir')).toBe(false);
  });

  it('titles the toolbar Search in the language set, Arabic laid out right to left', async () => {
    const { el, app, shadow, root } = await createEditor();
    const searchTitle = () =>
      shadow.querySelector('.toolbar-search')?.getAttribute('title');

    el.setLocale('ko-KR');
    await flush();
    expect(searchTitle()).toBe(
      toShortcutTitle(
        app.keyBindingMap,
        MESSAGES['ko-KR']['common.search'],
        KeyBindingName.search
      )
    );

    el.setLocale('ar-SA');
    await flush();
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(searchTitle()).toBe(
      toShortcutTitle(
        app.keyBindingMap,
        MESSAGES['ar-SA']['common.search'],
        KeyBindingName.search
      )
    );
  });

  it('paints a language a host names before it appends the element from the first frame', async () => {
    const { root } = await createEditor({}, target => {
      target.setLocale('he-IL');
    });

    expect(root.getAttribute('lang')).toBe('he-IL');
    expect(root.getAttribute('dir')).toBe('rtl');
  });

  it('hands a component mounted after a switch the language switched to', async () => {
    const { el, root } = await createEditor();
    const seen: string[] = [];
    const Probe: FC<{}> = (props, ctx) => {
      const i18n = useI18n(ctx);
      return () => {
        seen.push(i18n.value.locale);
        return html`<span>${i18n.value.locale}</span>`;
      };
    };

    el.setLocale('fa-IR');
    await flush();

    const late = document.createElement('div');
    root.append(late);
    render(late, html`<${Probe} />`);
    await flush();

    try {
      expect(late.textContent).toBe('fa-IR');

      el.setLocale('pt-BR');
      await flush();
      expect(late.textContent).toBe('pt-BR');
      expect(seen).toEqual(['fa-IR', 'pt-BR']);
    } finally {
      render(late, null);
      late.remove();
    }
  });

  it('shows English while enableLocalePicker is off whatever the browser language, and the system language while it is on', async () => {
    spyLanguages(['ko-KR']);
    const { el, root } = await createEditor();
    expect(root.getAttribute('lang')).toBe('en');

    el.enableLocalePicker = true;
    await flush();
    expect(root.getAttribute('lang')).toBe('ko-KR');

    el.enableLocalePicker = false;
    await flush();
    expect(root.getAttribute('lang')).toBe('en');

    el.setAttribute('enable-locale-picker', '');
    await flush();
    expect(root.getAttribute('lang')).toBe('ko-KR');

    el.removeAttribute('enable-locale-picker');
    await flush();
    expect(root.getAttribute('lang')).toBe('en');
  });

  it('renders the system language from the first frame when the picker is turned on before the element is appended', async () => {
    spyLanguages(['ar-SA']);
    const el = document.createElement('erd-editor');
    el.enableLocalePicker = true;
    document.body.append(el);
    editors.push(el);

    const root = shadowRoots.get(el)?.querySelector('.root');
    expect(root?.getAttribute('lang')).toBe('ar-SA');
    expect(root?.getAttribute('dir')).toBe('rtl');
    await flush();
  });

  it('hands the palette the option in force while the picker is on, and none while it is off', async () => {
    spyLanguages(['ko-KR']);
    const { el } = await createEditor();
    const props = quickSearch.props;
    expect(props).not.toBeNull();
    expect(props?.locale).toBeUndefined();

    el.setLocale('ja-JP');
    await flush();
    expect(props?.locale).toBeUndefined();

    el.enableLocalePicker = true;
    await flush();
    expect(props?.locale).toBe('ja-JP');

    el.enableLocalePicker = false;
    await flush();
    expect(props?.locale).toBeUndefined();
  });

  it('hands the palette system while the picker is on and no language is set', async () => {
    const { el } = await createEditor({ enableLocalePicker: true });

    expect(quickSearch.props?.locale).toBe('system');

    el.setLocale('ko-KR');
    await flush();
    expect(quickSearch.props?.locale).toBe('ko-KR');
  });

  it('hands the palette the appearance option while the theme builder is on, and none while it is off', async () => {
    const { el } = await createEditor();
    expect(quickSearch.props).not.toBeNull();
    expect(quickSearch.props?.appearance).toBeUndefined();

    el.setPresetTheme({ appearance: 'light' });
    await flush();
    expect(quickSearch.props?.appearance).toBeUndefined();

    el.enableThemeBuilder = true;
    await flush();
    expect(quickSearch.props?.appearance).toBe('light');

    el.setPresetTheme({ appearance: 'system' });
    await flush();
    expect(quickSearch.props?.appearance).toBe('system');

    el.enableThemeBuilder = false;
    await flush();
    expect(quickSearch.props?.appearance).toBeUndefined();
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

  it('closes the theme builder on a middle press over the canvas, which the pan keeps from the root', async () => {
    const { app, shadow } = await createEditor({ enableThemeBuilder: true });
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.themeBuilder]: true } as any)
    );
    await flush();
    const canvas = shadow.querySelector(
      '[data-testid="erd-canvas"]'
    ) as HTMLDivElement;
    expect(canvas).toBeTruthy();

    const press = pressMiddle(canvas);
    window.dispatchEvent(new MouseEvent('mouseup', { button: 1 }));
    await flush();

    // Prevented, so the pan took it and stopped it short of the root.
    expect(press.defaultPrevented).toBe(true);
    expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(false);
  });

  // A pan prevents its middle press, which is what focuses the root on any
  // other press, so the element takes the keyboard itself, or Delete and
  // $mod+Z would still go wherever the focus was before the pan.
  it('takes the keyboard on a middle press over the canvas, which the pan keeps from the root', async () => {
    const { el, shadow } = await createEditor();
    const canvas = shadow.querySelector(
      '[data-testid="erd-canvas"]'
    ) as HTMLDivElement;
    const outside = document.createElement('input');
    document.body.append(outside);
    outside.focus();

    try {
      pressMiddle(canvas);
      window.dispatchEvent(new MouseEvent('mouseup', { button: 1 }));
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(document.activeElement).toBe(el);
    } finally {
      outside.remove();
    }
  });

  it('takes the keyboard on a prevented middle press that reaches the root, as the hand tool and Graph mode leave it', async () => {
    const { el, root } = await createEditor();
    const outside = document.createElement('input');
    document.body.append(outside);
    outside.focus();

    try {
      const press = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 1,
      });
      press.preventDefault();
      root.dispatchEvent(press);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(document.activeElement).toBe(el);
    } finally {
      outside.remove();
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

  /**
   * The host hands the document over before the ResizeObserver has measured
   * anything. Pulled against the store's default size, a far origin would park
   * the content at the edge of a screen nobody has, so the pull waits.
   */
  it('starts unmeasured, and pulls a loaded origin against the first frame that has a size', async () => {
    const { el, app } = await createEditor();
    expect(app.store.state.editor.viewport).toEqual({ width: 0, height: 0 });

    el.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        settings: {
          zoomLevel: 1,
          originX: 40_000,
          originY: -40_000,
          lockSettings: 0,
        },
        doc: { tableIds: ['t1'] },
        collections: {
          tableEntities: {
            t1: {
              id: 't1',
              name: 't1',
              comment: '',
              columnIds: [],
              seqColumnIds: [],
              ui: { x: 0, y: 0, zIndex: 2, widthName: 60, widthComment: 60 },
              meta: { updateAt: 1, createAt: 1 },
            },
          },
        },
      })
    );
    await flush();

    expect(app.store.state.settings.originX).toBe(40_000);
    expect(app.store.state.settings.originY).toBe(-40_000);
    expect(app.store.state.editor.scrollPullPending).toBe(true);

    resizeCallbacks[0]([
      {
        contentRect: {
          width: 1440,
          height: 900 + TOOLBAR_HEIGHT,
        } as DOMRectReadOnly,
      },
    ]);
    await flush();

    const { settings, editor, collections } = app.store.state;
    const rect = getTableRect(app.store.state, collections.tableEntities.t1);
    expect(editor.viewport).toEqual({ width: 1440, height: 900 });
    expect(editor.scrollPullPending).toBe(false);
    // Pulled onto the measured screen: the table's far edge on its far edge,
    // which the 1200 wide default would have put 240 pixels short of.
    expect(
      toScreenPoint(settings, { x: rect.x + rect.width, y: rect.y }).x
    ).toBeCloseTo(1440, 6);
    expect(toScreenPoint(settings, { x: rect.x, y: rect.y }).y).toBeCloseTo(
      0,
      6
    );
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

  // A Tab stop fires a burst: the field it left blurs, and the field it opened
  // blurs again a keystroke later. Only the last one describes where focus was
  // finally dropped, so a throttle that keeps the first alone loses it.
  it('answers a second focus event that lands inside the throttle window', async () => {
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
    const callsAfterMount = focusSpy.mock.calls.length;

    el.dispatchEvent(focusEvent());
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(focusSpy.mock.calls.length).toBe(callsAfterMount + 1);

    outside.focus();
    el.dispatchEvent(focusEvent());
    await new Promise(resolve => setTimeout(resolve, 120));

    expect(focusSpy.mock.calls.length).toBe(callsAfterMount + 2);
    expect(document.activeElement).toBe(el);
    outside.remove();
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

  it('applies a schema GC result holding removed table groups alone, so the value writes no group fields again', async () => {
    const { app } = await createEditor();
    app.store.dispatchSync(
      addTableGroupAction({
        id: 'gone',
        ui: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
      }),
      removeTableGroupAction({ id: 'gone' })
    );
    expect(app.store.state.collections.tableGroupEntities).toHaveProperty(
      'gone'
    );

    gcState.service = {
      run: async () => ({ ...emptyGCIds(), tableGroupIds: ['gone'] }),
    };
    app.emitter.emit({ type: 'schemaGC', payload: undefined } as any);
    await flush(6);

    expect(app.store.state.collections.tableGroupEntities).toEqual({});
    expect(JSON.parse(toJson(app.store.state)).collections).not.toHaveProperty(
      'tableGroupEntities'
    );
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

  it('follows the OS color scheme on the root while the appearance is system', async () => {
    const media = stubColorScheme(false);
    try {
      const { el, root } = await createEditor();
      el.setPresetTheme({ appearance: 'system' });
      await flush();
      expect(root.classList.contains('dark')).toBe(false);

      media.change(true);
      await flush();
      expect(root.classList.contains('dark')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reads the OS color scheme again when it is put back in the document', async () => {
    const media = stubColorScheme(false);
    try {
      const { el, root } = await createEditor();
      el.setPresetTheme({ appearance: 'system' });
      await flush();

      el.remove();
      media.change(true);
      document.body.append(el);
      await flush();

      expect(media.listeners.size).toBe(1);
      expect(root.classList.contains('dark')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows the light or dark a host names for system', async () => {
    const { el, root } = await createEditor();

    el.setPresetTheme({ appearance: 'system' });
    el.setSystemAppearance('dark');
    await flush();
    expect(root.classList.contains('dark')).toBe(true);

    el.setSystemAppearance('light');
    await flush();
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('marks System in its theme builder while the appearance follows the system', async () => {
    const { app, shadow } = await createEditor({
      enableThemeBuilder: true,
      systemDarkMode: true,
    });

    app.emitter.emit(openThemeBuilderAction());
    await flush();

    const selected = Array.from(
      shadow.querySelectorAll('.theme-builder .selected')
    )
      .map(el => el.textContent)
      .filter(Boolean);
    expect(selected).toEqual(['System']);
  });

  describe('locale picker', () => {
    const picker = (shadow: ShadowRoot) =>
      shadow.querySelector<HTMLElement>('.locale-picker');
    const pickerRow = (shadow: ShadowRoot, option: string) =>
      shadow.querySelector<HTMLButtonElement>(
        `.locale-picker button[data-locale="${option}"]`
      );
    const checked = (shadow: ShadowRoot) =>
      Array.from(
        shadow.querySelectorAll<HTMLElement>(
          '.locale-picker [aria-selected="true"]'
        )
      ).map(row => row.dataset.locale);
    const systemHint = (shadow: ShadowRoot) =>
      pickerRow(shadow, 'system')?.querySelector('[lang]');

    const openPicker = async (shadow: ShadowRoot) => {
      shadow
        .querySelector('.toolbar-locale')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    };

    it('mounts the picker only while enableLocalePicker is set', async () => {
      const { el, app, shadow } = await createEditor();
      app.store.dispatchSync(
        changeOpenMapAction({ [Open.localePicker]: true })
      );
      await flush();
      expect(picker(shadow)).toBeNull();

      el.enableLocalePicker = true;
      await flush();
      expect(picker(shadow)).toBeTruthy();

      el.enableLocalePicker = false;
      await flush();
      expect(picker(shadow)).toBeNull();
    });

    it('opens from the toolbar on System, naming the language the browser asks for', async () => {
      spyLanguages(['ja-JP', 'en']);
      const { shadow } = await createEditor({ enableLocalePicker: true });

      await openPicker(shadow);

      expect(checked(shadow)).toEqual(['system']);
      expect(systemHint(shadow)?.textContent).toBe('日本語');
      expect(systemHint(shadow)?.getAttribute('lang')).toBe('ja-JP');
    });

    it('checks the language a host set, and names the one a host gives System', async () => {
      const { el, shadow } = await createEditor({ enableLocalePicker: true });
      el.setLocale('uk-UA');
      el.setSystemLocale('sv');
      await openPicker(shadow);

      expect(checked(shadow)).toEqual(['uk-UA']);
      expect(systemHint(shadow)?.textContent).toBe('Svenska');
    });

    it('moves the System hint when the browser language changes, from a frozen list', async () => {
      spyLanguages(['de-DE']);
      const { shadow } = await createEditor({ enableLocalePicker: true });
      await openPicker(shadow);
      expect(systemHint(shadow)?.textContent).toBe('Deutsch');

      spyLanguages(['pl-PL']);
      window.dispatchEvent(new Event('languagechange'));
      await flush();

      expect(systemHint(shadow)?.textContent).toBe('Polski');
    });

    it('switches the element on a pick, telling the host the option picked', async () => {
      const { el, app, shadow, root } = await createEditor({
        enableLocalePicker: true,
      });
      const picked: unknown[] = [];
      el.addEventListener('changeLocale', event =>
        picked.push((event as CustomEvent).detail)
      );
      await openPicker(shadow);

      pickerRow(shadow, 'ko-KR')!.click();
      await flush();

      expect(picked).toEqual([{ locale: 'ko-KR' }]);
      expect(root.getAttribute('lang')).toBe('ko-KR');
      expect(app.store.state.editor.openMap[Open.localePicker]).toBe(false);
      expect(picker(shadow)).toBeNull();

      await openPicker(shadow);
      expect(checked(shadow)).toEqual(['ko-KR']);
    });

    it('closes when the pointer goes down outside it or the toolbar', async () => {
      const { app, shadow, root } = await createEditor({
        enableLocalePicker: true,
      });
      app.emitter.emit(openLocalePickerAction());
      await flush();

      for (const selector of ['.toolbar', '.locale-picker']) {
        shadow
          .querySelector(selector)!
          .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await flush();
        expect(app.store.state.editor.openMap[Open.localePicker]).toBe(true);
      }

      root.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await flush();
      expect(app.store.state.editor.openMap[Open.localePicker]).toBe(false);
      expect(picker(shadow)).toBeNull();
    });

    it('trades places with the theme builder, either button closing the other panel', async () => {
      const { app, shadow } = await createEditor({
        enableThemeBuilder: true,
        enableLocalePicker: true,
      });

      await openPicker(shadow);
      expect(picker(shadow)).toBeTruthy();

      shadow
        .querySelector('.toolbar-theme')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(shadow.querySelector('.theme-builder')).toBeTruthy();
      expect(picker(shadow)).toBeNull();

      await openPicker(shadow);
      expect(picker(shadow)).toBeTruthy();
      expect(shadow.querySelector('.theme-builder')).toBeNull();
      expect(app.store.state.editor.openMap[Open.themeBuilder]).toBe(false);
    });
  });
});
