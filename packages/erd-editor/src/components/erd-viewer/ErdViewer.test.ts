import '@/erd-viewer';

import { parser, toDocumentJson } from '@dineug/erd-editor-schema';
import { stages } from 'konva/lib/Stage';
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
import type { AppContext } from '@/components/appContext';
import {
  countTransitions,
  transitionKey,
  transitionTo,
} from '@/components/erd/canvas/highlightTransition';
import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import {
  countRelationshipHighlights,
  setRelationshipHighlight,
} from '@/components/erd/relationshipHighlight';
import type { ErdViewerElement } from '@/components/erd-viewer/ErdViewer';
import {
  CANVAS_ZOOM_MAX,
  LockSettingType,
  NameViewMode,
} from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { en } from '@/i18n/messages/en';
import { MESSAGES } from '@/i18n/messages/index';
import { getContentRect } from '@/konva/scene/contentBounds';
import { previewZoomLevel } from '@/konva/scene/fitZoom';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
} from '@/themes/radix-ui-theme';

const { appContexts, dictionaryRequests } = vi.hoisted(() => ({
  appContexts: [] as any[],
  dictionaryRequests: [] as string[],
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

// Every dictionary a viewer asks for, English aside, which it holds from the start.
vi.mock('@/i18n/loadMessages', async importOriginal => {
  const mod = await importOriginal<typeof import('@/i18n/loadMessages')>();

  return {
    ...mod,
    lazyMessagesOf: (code: Parameters<typeof mod.lazyMessagesOf>[0]) => {
      if (code !== 'en') dictionaryRequests.push(code);
      return mod.lazyMessagesOf(code);
    },
  };
});

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
});

type FakeRequest = {
  url: string;
  signal: AbortSignal;
  respond: (body: string, status?: number) => void;
};

let requests: FakeRequest[] = [];

/** A fetch that answers when the spec says, and rejects as the browser does once its signal aborts. */
function stubFetch() {
  requests = [];
  const fetch = vi.fn(
    (url: string, init: { signal: AbortSignal }) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted', 'AbortError'))
        );
        requests.push({
          url,
          signal: init.signal,
          respond: (body, status = 200) =>
            resolve({
              ok: status >= 200 && status < 300,
              status,
              statusText: status === 404 ? 'Not Found' : '',
              text: () => Promise.resolve(body),
            }),
        });
      })
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** Every viewer a spec made, which afterEach destroys so no store of one outlives it. */
const viewers: ErdViewerElement[] = [];

beforeEach(() => {
  appContexts.length = 0;
  dictionaryRequests.length = 0;
  stubFetch();
});

afterEach(async () => {
  viewers.splice(0).forEach(viewer => viewer.destroy());
  document.body.replaceChildren();
  document.documentElement.removeAttribute('lang');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await flush();
});

/** A file holding one table, as a host would hand it over. */
const USERS_FILE = JSON.stringify({
  version: '3.0.0',
  doc: { tableIds: ['users'] },
  collections: { tableEntities: { users: { id: 'users', name: 'users' } } },
});

/** A second file, sharing no table with the first. */
const ORDERS_FILE = JSON.stringify({
  version: '3.0.0',
  doc: { tableIds: ['orders'] },
  collections: { tableEntities: { orders: { id: 'orders', name: 'orders' } } },
});

function createViewer() {
  const viewer = document.createElement('erd-viewer');
  viewers.push(viewer);
  return viewer;
}

function mountViewer(attributes: Record<string, string> = {}) {
  const viewer = createViewer();

  for (const [name, value] of Object.entries(attributes)) {
    viewer.setAttribute(name, value);
  }
  document.body.append(viewer);

  return viewer;
}

function shadowOf(viewer: ErdViewerElement): ShadowRoot {
  const shadow = shadowRoots.get(viewer);
  if (!shadow) throw new Error('the viewer attached no shadow root');
  return shadow;
}

const tableIdsOf = (viewer: ErdViewerElement): string[] =>
  JSON.parse(viewer.value).doc.tableIds ?? [];

/** The app the viewer's view built, the last one made. */
const lastApp = (): AppContext => appContexts[appContexts.length - 1];

/** Lets a fetch answered or aborted reach the viewer and its render. */
async function settle() {
  for (let round = 0; round < 3; round++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    await flush();
  }
}

function listen(viewer: ErdViewerElement) {
  const loads: Event[] = [];
  const errors: CustomEvent[] = [];
  viewer.addEventListener('load', event => loads.push(event));
  viewer.addEventListener('error', (event: Event) =>
    errors.push(event as CustomEvent)
  );
  return { loads, errors };
}

const noticeOf = (viewer: ErdViewerElement) =>
  shadowOf(viewer).querySelector('.view-status');

describe('<erd-viewer> attributes', () => {
  it('shows the minimap and the controls with neither attribute written', () => {
    const viewer = mountViewer();

    expect(viewer.minimap).toBe(true);
    expect(viewer.controls).toBe(true);
    expect(viewer.src).toBe('');
    expect(viewer.nameView).toBeNull();
  });

  it.each(['minimap', 'controls'] as const)(
    'turns %s off only for the attribute value "false"',
    name => {
      const viewer = mountViewer({ [name]: 'false' });

      expect(viewer[name]).toBe(false);

      viewer.setAttribute(name, '');
      expect(viewer[name]).toBe(true);

      viewer.setAttribute(name, 'false');
      viewer.setAttribute(name, 'true');
      expect(viewer[name]).toBe(true);

      viewer.setAttribute(name, 'false');
      viewer.setAttribute(name, 'off');
      expect(viewer[name]).toBe(true);
    }
  );

  it.each(['minimap', 'controls'] as const)(
    'shows %s again once the attribute is removed',
    name => {
      const viewer = mountViewer({ [name]: 'false' });

      viewer.removeAttribute(name);

      expect(viewer[name]).toBe(true);
    }
  );

  it('hides the minimap for minimap="false" and the controls, compass with them, for controls="false"', async () => {
    const viewer = mountViewer();
    viewer.value = USERS_FILE;
    await flush();
    const shadow = shadowOf(viewer);

    expect(shadow.querySelector('.minimap')).not.toBeNull();
    expect(shadow.querySelector('.view-controls')).not.toBeNull();

    viewer.setAttribute('minimap', 'false');
    await flush();
    expect(shadow.querySelector('.minimap')).toBeNull();
    expect(shadow.querySelector('.view-controls')).not.toBeNull();

    viewer.setAttribute('controls', 'false');
    await flush();
    expect(shadow.querySelector('.view-controls')).toBeNull();
    expect(shadow.querySelector('.view-fit')).toBeNull();
    expect(shadow.querySelector('.name-view-trigger')).toBeNull();

    viewer.removeAttribute('minimap');
    viewer.removeAttribute('controls');
    await flush();
    expect(shadow.querySelector('.minimap')).not.toBeNull();
    expect(shadow.querySelector('.view-controls')).not.toBeNull();
  });

  it('takes a name-view other than the three as none', () => {
    const viewer = mountViewer({ 'name-view': 'logical' });
    expect(viewer.nameView).toBe('logical');

    viewer.setAttribute('name-view', 'columns');
    expect(viewer.nameView).toBeNull();
  });
});

describe('<erd-viewer> root', () => {
  it('draws the read-only view, its one root the Tab key reaches, in a closed shadow root', () => {
    const viewer = mountViewer();
    const shadow = shadowOf(viewer);

    expect(viewer.shadowRoot).toBeNull();
    expect(shadow.mode).toBe('closed');
    const focusable = shadow.querySelectorAll('[tabindex]');
    expect(focusable).toHaveLength(1);
    expect(focusable[0].classList.contains('erd-view')).toBe(true);
    expect(focusable[0].getAttribute('tabindex')).toBe('0');
  });

  it('takes no focus on mount, nor when a document loads', async () => {
    const viewer = mountViewer();
    viewer.value = USERS_FILE;
    await flush();

    expect(document.activeElement).toBe(document.body);
  });
});

describe('<erd-viewer> value', () => {
  it('holds an empty document before any value is set', () => {
    const viewer = mountViewer();
    const held = JSON.parse(viewer.value);

    expect(held.version).toBe('3.0.0');
    expect(held.doc).toEqual({});
    expect(held.collections).toBeUndefined();
  });

  it('reads a document back in the form a file saves, out of the view store', () => {
    const viewer = mountViewer();

    viewer.value = USERS_FILE;

    expect(viewer.value).toBe(toDocumentJson(parser(USERS_FILE)));
    expect(viewer.value).toBe(toDocumentJson(lastApp().store.state));
    expect(lastApp().store.state.doc.tableIds).toEqual(['users']);
  });

  it('replaces the document it held with the next value', () => {
    const viewer = mountViewer();

    viewer.value = USERS_FILE;
    viewer.value = '';

    expect(JSON.parse(viewer.value).doc).toEqual({});
  });

  it('keeps a value set before the element connects, and loads it as it mounts', () => {
    const viewer = createViewer();

    viewer.value = USERS_FILE;
    expect(tableIdsOf(viewer)).toEqual(['users']);
    document.body.append(viewer);

    expect(tableIdsOf(viewer)).toEqual(['users']);
    expect(lastApp().store.state.doc.tableIds).toEqual(['users']);
  });

  it('throws on text that holds no document, and keeps the one it held', () => {
    const viewer = mountViewer();
    viewer.value = USERS_FILE;

    expect(() => (viewer.value = '{ not json')).toThrow(SyntaxError);
    expect(() => (viewer.value = '7')).toThrow(TypeError);
    expect(tableIdsOf(viewer)).toEqual(['users']);
  });
});

describe('<erd-viewer> src', () => {
  it('fetches the document, applies it and fires load once', async () => {
    const viewer = mountViewer({ src: 'fixture.erd.json' });
    const { loads, errors } = listen(viewer);
    await settle();

    expect(requests.map(({ url }) => url)).toEqual(['fixture.erd.json']);
    expect(noticeOf(viewer)?.getAttribute('role')).toBe('status');
    expect(noticeOf(viewer)?.textContent).toBe(en['viewer.loading']);

    requests[0].respond(USERS_FILE);
    await settle();

    expect(tableIdsOf(viewer)).toEqual(['users']);
    expect(loads).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(noticeOf(viewer)).toBeNull();
  });

  it.each([
    ['a missing file', '', 404, /404 Not Found/],
    ['text that is no JSON', '<html></html>', 200, /JSON|Unexpected/],
  ])(
    'fires error once for %s, with the cause, over an empty canvas',
    async (_, body, status, cause) => {
      const viewer = mountViewer();
      viewer.value = USERS_FILE;
      const { loads, errors } = listen(viewer);
      viewer.src = 'fixture.erd.json';
      await settle();

      requests[0].respond(body, status);
      await settle();

      expect(errors).toHaveLength(1);
      expect(String(errors[0].detail)).toMatch(cause);
      expect(loads).toHaveLength(0);
      expect(tableIdsOf(viewer)).toEqual([]);
      expect(noticeOf(viewer)?.getAttribute('role')).toBe('alert');
      expect(noticeOf(viewer)?.textContent).toBe(en['viewer.loadError']);

      viewer.value = ORDERS_FILE;
      await flush();
      expect(noticeOf(viewer)).toBeNull();
      expect(tableIdsOf(viewer)).toEqual(['orders']);
    }
  );

  it('aborts the fetch a new src replaces, whose late answer lands on nothing', async () => {
    const viewer = mountViewer({ src: 'first.erd.json' });
    const { loads } = listen(viewer);
    await settle();

    viewer.setAttribute('src', 'second.erd.json');
    await settle();

    expect(requests.map(({ url }) => url)).toEqual([
      'first.erd.json',
      'second.erd.json',
    ]);
    expect(requests[0].signal.aborted).toBe(true);

    requests[1].respond(ORDERS_FILE);
    await settle();
    requests[0].respond(USERS_FILE);
    await settle();

    expect(tableIdsOf(viewer)).toEqual(['orders']);
    expect(loads).toHaveLength(1);
  });

  it('aborts the fetch running as the element leaves the page, and fetches again as it returns', async () => {
    const viewer = mountViewer({ src: 'fixture.erd.json' });
    const { loads } = listen(viewer);
    await settle();

    viewer.remove();
    expect(requests[0].signal.aborted).toBe(true);

    document.body.append(viewer);
    await settle();

    expect(requests).toHaveLength(2);
    requests[1].respond(USERS_FILE);
    await settle();
    expect(loads).toHaveLength(1);

    viewer.remove();
    document.body.append(viewer);
    await settle();
    expect(requests).toHaveLength(2);
  });

  it('stops following a src that is removed, the document left as it was', async () => {
    const viewer = mountViewer({ src: 'fixture.erd.json' });
    await settle();
    requests[0].respond(USERS_FILE);
    await settle();

    viewer.setAttribute('src', 'next.erd.json');
    await settle();
    viewer.removeAttribute('src');
    await settle();

    expect(requests[1].signal.aborted).toBe(true);
    expect(tableIdsOf(viewer)).toEqual(['users']);
    expect(noticeOf(viewer)).toBeNull();
  });
});

describe('<erd-viewer> value and src, the later winning', () => {
  it('takes a src set after a value', async () => {
    const viewer = mountViewer();
    viewer.value = USERS_FILE;
    viewer.src = 'orders.erd.json';
    await settle();

    requests[0].respond(ORDERS_FILE);
    await settle();

    expect(tableIdsOf(viewer)).toEqual(['orders']);
  });

  it('keeps a value set after a src, cancelling its fetch', async () => {
    const viewer = mountViewer({ src: 'orders.erd.json' });
    const { loads } = listen(viewer);
    await settle();

    viewer.value = USERS_FILE;
    expect(requests[0].signal.aborted).toBe(true);
    requests[0].respond(ORDERS_FILE);
    await settle();

    expect(tableIdsOf(viewer)).toEqual(['users']);
    expect(loads).toHaveLength(0);
  });

  it('keeps a value set after a src before the change is heard, fetching nothing', async () => {
    const viewer = mountViewer();
    await settle();

    viewer.src = 'orders.erd.json';
    viewer.value = USERS_FILE;
    await settle();

    expect(requests).toEqual([]);
    expect(tableIdsOf(viewer)).toEqual(['users']);

    viewer.remove();
    document.body.append(viewer);
    await settle();
    expect(requests).toEqual([]);
  });

  const writeSrc = {
    property: (viewer: ErdViewerElement, url: string) => {
      viewer.src = url;
    },
    attribute: (viewer: ErdViewerElement, url: string) => {
      viewer.setAttribute('src', url);
    },
  };

  /** A viewer that took the document of orders.erd.json, then a value in its place. */
  async function valueOverSrc() {
    const viewer = mountViewer({ src: 'orders.erd.json' });
    await settle();
    requests[0].respond(ORDERS_FILE);
    await settle();
    viewer.value = USERS_FILE;
    return viewer;
  }

  const urls = () => requests.map(({ url }) => url);

  it.each(Object.entries(writeSrc))(
    'fetches a src the %s writes again after a value, the url unchanged',
    async (_, write) => {
      const viewer = await valueOverSrc();

      write(viewer, 'orders.erd.json');
      await settle();
      expect(urls()).toEqual(['orders.erd.json', 'orders.erd.json']);

      requests[1].respond(ORDERS_FILE);
      await settle();
      expect(tableIdsOf(viewer)).toEqual(['orders']);
    }
  );

  it.each(Object.entries(writeSrc))(
    'fetches the src the %s comes back to within one task after a value',
    async (_, write) => {
      const viewer = await valueOverSrc();

      write(viewer, 'other.erd.json');
      write(viewer, 'orders.erd.json');
      await settle();

      expect(urls()).toEqual(['orders.erd.json', 'orders.erd.json']);
    }
  );

  it.each(Object.entries(writeSrc))(
    'keeps a value set after the %s writes the same src again',
    async (_, write) => {
      const viewer = await valueOverSrc();

      write(viewer, 'orders.erd.json');
      viewer.value = USERS_FILE;
      await settle();

      expect(urls()).toEqual(['orders.erd.json']);
      expect(tableIdsOf(viewer)).toEqual(['users']);
    }
  );

  it.each(Object.entries(writeSrc))(
    'fetches nothing for the same src the %s writes again over its own document',
    async (_, write) => {
      const viewer = mountViewer({ src: 'orders.erd.json' });
      await settle();
      requests[0].respond(ORDERS_FILE);
      await settle();

      write(viewer, 'orders.erd.json');
      await settle();

      expect(urls()).toEqual(['orders.erd.json']);
    }
  );
});

describe('<erd-viewer> name view', () => {
  const shownLabel = (viewer: ErdViewerElement) =>
    shadowOf(viewer).querySelector('.name-view-trigger [aria-hidden="false"]')
      ?.textContent;

  it('shows the view name-view names over the document, which value never writes', async () => {
    const viewer = mountViewer({ 'name-view': 'logical' });
    viewer.value = USERS_FILE;
    await flush();
    const saved = JSON.parse(viewer.value).settings.nameViewMode;

    expect(lastApp().store.state.settings.nameViewMode).toBe('logical');
    expect(shownLabel(viewer)).toBe(en['common.logicalNames']);
    expect(saved).toBeUndefined();

    viewer.setAttribute('name-view', 'both');
    await flush();
    expect(lastApp().store.state.settings.nameViewMode).toBe('both');
    expect(JSON.parse(viewer.value).settings.nameViewMode).toBe(saved);

    viewer.removeAttribute('name-view');
    await flush();
    expect(lastApp().store.state.settings.nameViewMode).toBe('physical');
    expect(JSON.parse(viewer.value).settings.nameViewMode).toBe(saved);
  });

  it('keeps the attribute over each document loaded after it', async () => {
    const viewer = mountViewer({ 'name-view': 'both' });
    viewer.value = USERS_FILE;
    viewer.value = ORDERS_FILE;
    await flush();

    expect(lastApp().store.state.settings.nameViewMode).toBe('both');
  });

  /** A file whose name view lock is off, which a switch made with an editor writes. */
  const unlockedFile = (nameViewMode?: string) =>
    JSON.stringify({
      version: '3.0.0',
      settings: {
        lockSettings: LockSettingType.unlockNameViewMode,
        ...(nameViewMode ? { nameViewMode } : {}),
      },
      doc: { tableIds: ['users'] },
      collections: {
        tableEntities: { users: { id: 'users', name: 'users' } },
      },
    });

  const savedNameView = (viewer: ErdViewerElement) =>
    JSON.parse(viewer.value).settings.nameViewMode;

  const click = (element: Element) =>
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  /** Picks a view off the controls bar's Name View list, as a reader does. */
  async function pickNameView(viewer: ErdViewerElement, label: string) {
    click(shadowOf(viewer).querySelector('.name-view-trigger')!);
    await flush();
    const row = Array.from(
      shadowOf(viewer).querySelectorAll<HTMLElement>(
        '.name-view-menu .context-menu-content > [data-id]'
      )
    ).find(item => item.textContent?.trim() === label);
    click(row!);
    await flush();
  }

  it.each([undefined, NameViewMode.both])(
    'writes an unlocked file its own name view, %s, under the attribute and the list alike',
    async nameViewMode => {
      const viewer = mountViewer();
      viewer.value = unlockedFile(nameViewMode);
      await flush();
      const saved = savedNameView(viewer);
      expect(saved).toBe(nameViewMode);

      viewer.setAttribute('name-view', NameViewMode.logical);
      await flush();
      expect(lastApp().store.state.settings.nameViewMode).toBe(
        NameViewMode.logical
      );
      expect(savedNameView(viewer)).toBe(saved);

      viewer.removeAttribute('name-view');
      await flush();
      await pickNameView(viewer, en['common.logicalNames']);
      expect(lastApp().store.state.settings.nameViewMode).toBe(
        NameViewMode.logical
      );
      expect(savedNameView(viewer)).toBe(saved);

      viewer.destroy();
      expect(savedNameView(viewer)).toBe(saved);
    }
  );
});

describe('<erd-viewer> first load', () => {
  /** A ResizeObserver that reports the size given as soon as it observes. */
  function stubResizeObserver(width: number, height: number) {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(target: Element) {
          this.callback(
            [{ target, contentRect: { width, height } } as any],
            this as any
          );
        }
        unobserve() {}
        disconnect = disconnect;
      }
    );
    return disconnect;
  }

  /** The zoom and origin a fit of the document into that screen opens at. */
  const fitOf = (app: AppContext) => {
    const { state } = app.store;
    const content = getContentRect(state)!;
    const zoomLevel = previewZoomLevel(
      content,
      state.editor.viewport,
      CANVAS_ZOOM_MAX
    );
    return { zoomLevel, ...centreOf(state, content, zoomLevel) };
  };

  const centreOf = (
    state: AppContext['store']['state'],
    content: { x: number; y: number; width: number; height: number },
    zoomLevel: number
  ) => {
    const origin = getScrollToCenter(
      { ...getViewTransform(state), zoomLevel },
      { x: content.x + content.width / 2, y: content.y + content.height / 2 }
    );
    return { originX: origin.x, originY: origin.y };
  };

  const viewOf = (app: AppContext) => {
    const { zoomLevel, originX, originY } = app.store.state.settings;
    return { zoomLevel, originX, originY };
  };

  /** The view a fit opens, its origin as the store rounds it. */
  const expectFitted = (app: AppContext) => {
    const view = viewOf(app);
    const fit = fitOf(app);
    expect(view.zoomLevel).toBe(fit.zoomLevel);
    expect(view.originX).toBeCloseTo(fit.originX, 2);
    expect(view.originY).toBeCloseTo(fit.originY, 2);
  };

  it('fits a document handed over before the view is measured once it is, the file zoom left aside', async () => {
    let report: (() => void) | null = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(target: Element) {
          report = () =>
            this.callback(
              [{ target, contentRect: { width: 800, height: 600 } } as any],
              this as any
            );
        }
        unobserve() {}
        disconnect() {}
      }
    );
    const viewer = mountViewer();
    viewer.value = USERS_FILE;
    await flush();
    const app = lastApp();
    const unmeasured = viewOf(app);

    report!();
    await flush();

    expect(app.store.state.editor.viewport).toEqual({
      width: 800,
      height: 600,
    });
    expect(viewOf(app)).not.toEqual(unmeasured);
    expectFitted(app);

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    app.store.dispatchSync(changeViewportAction({ width: 640, height: 480 }));
    expect(app.store.state.settings.zoomLevel).toBe(0.5);
  });

  it('fits each document loaded into a view already measured', async () => {
    stubResizeObserver(800, 600);
    const viewer = mountViewer();
    await flush();
    const app = lastApp();

    viewer.value = USERS_FILE;
    expectFitted(app);

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    viewer.value = ORDERS_FILE;
    expectFitted(app);
  });
});

describe('<erd-viewer> theme and language', () => {
  const lightPreset = createTheme({
    grayColor: GrayColor.slate,
    accentColor: AccentColor.indigo,
    appearance: Appearance.light,
  });
  const darkPreset = createTheme({
    grayColor: GrayColor.slate,
    accentColor: AccentColor.indigo,
    appearance: Appearance.dark,
  });

  /** The theme's tokens, in the sheet of the shadow root's own its theme adopts first. */
  const styleOf = (viewer: ErdViewerElement) =>
    Array.from(shadowOf(viewer).adoptedStyleSheets[0]?.cssRules ?? [])
      .map(rule => rule.cssText)
      .join('');

  it('follows the page color scheme by default, and takes a preset a page sets', async () => {
    const viewer = mountViewer();
    await flush();

    expect(styleOf(viewer)).toContain(lightPreset.canvasBackground);
    expect(styleOf(viewer)).not.toContain(darkPreset.canvasBackground);

    viewer.setSystemAppearance(Appearance.dark);
    await flush();
    expect(styleOf(viewer)).toContain(darkPreset.canvasBackground);

    viewer.setPresetTheme({ appearance: Appearance.light });
    viewer.setTheme({ canvasBackground: '#123456' });
    await flush();
    expect(styleOf(viewer)).toContain('#123456');
  });

  const fitTitle = (viewer: ErdViewerElement) =>
    shadowOf(viewer).querySelector('.view-fit')?.getAttribute('title');

  it('reads English from the first frame on an English page, loading no dictionary', async () => {
    const viewer = mountViewer();
    await flush();

    expect(fitTitle(viewer)).toBe(en['visualization.fit']);
    expect(
      shadowOf(viewer).querySelector('.erd-view')?.getAttribute('lang')
    ).toBe('en');
  });

  it('loads the language the html lang names, once, as it connects', async () => {
    document.documentElement.lang = 'ko';
    const viewer = mountViewer();
    expect(fitTitle(viewer)).toBe(en['visualization.fit']);

    await vi.waitFor(() =>
      expect(fitTitle(viewer)).toBe(MESSAGES['ko-KR']['visualization.fit'])
    );
    expect(dictionaryRequests).toEqual(['ko-KR']);

    document.documentElement.lang = 'ja';
    viewer.remove();
    document.body.append(viewer);
    await flush();
    expect(fitTitle(viewer)).toBe(MESSAGES['ko-KR']['visualization.fit']);
  });

  it('switches to the language a page sets and to the tag it names for system', async () => {
    const viewer = mountViewer();

    await viewer.setLocale('ar-SA');
    await flush();
    const root = shadowOf(viewer).querySelector('.erd-view')!;
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(
      shadowOf(viewer).querySelector('.view-controls')?.getAttribute('dir')
    ).toBe('ltr');

    await viewer.setLocale('system');
    await viewer.setSystemLocale('de');
    await flush();
    expect(fitTitle(viewer)).toBe(MESSAGES['de-DE']['visualization.fit']);
    expect(root.getAttribute('dir')).toBe('ltr');
  });
});

describe('<erd-viewer> destroy', () => {
  it('lets every observer, listener and fetch go, and stays empty when appended again', async () => {
    const resizeDisconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect = resizeDisconnect;
      }
    );
    const mutationObservers: Array<{
      targets: Array<[Node, MutationObserverInit | undefined]>;
      disconnected: boolean;
    }> = [];
    vi.stubGlobal(
      'MutationObserver',
      class {
        private readonly record = {
          targets: [] as Array<[Node, MutationObserverInit | undefined]>,
          disconnected: false,
        };
        constructor() {
          mutationObservers.push(this.record);
        }
        observe(target: Node, options?: MutationObserverInit) {
          this.record.targets.push([target, options]);
        }
        disconnect() {
          this.record.disconnected = true;
        }
        takeRecords() {
          return [];
        }
      }
    );
    const observerOf = (
      observes: (target: Node, options?: MutationObserverInit) => boolean
    ) =>
      mutationObservers.find(({ targets }) =>
        targets.some(([target, options]) => observes(target, options))
      );
    const mediaListeners = new Set<unknown>();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_: string, listener: unknown) =>
        mediaListeners.add(listener),
      removeEventListener: (_: string, listener: unknown) =>
        mediaListeners.delete(listener),
    }));

    const viewer = mountViewer({ src: 'fixture.erd.json' });
    const { loads, errors } = listen(viewer);
    await settle();
    expect(mediaListeners.size).toBe(1);

    viewer.destroy();
    await flush();

    expect(requests[0].signal.aborted).toBe(true);
    expect(resizeDisconnect).toHaveBeenCalled();
    // The src attribute's observer and the theme override watch on head are
    // two instances, so each one is asked whether it was let go.
    expect(
      observerOf(
        (target, options) =>
          target === viewer &&
          options?.attributeFilter?.includes('src') === true
      )?.disconnected
    ).toBe(true);
    expect(observerOf(target => target === document.head)?.disconnected).toBe(
      true
    );
    expect(mediaListeners.size).toBe(0);
    expect(shadowOf(viewer).querySelector('.erd-view')).toBeNull();
    expect(lastApp().lifecycle.destroyed).toBe(true);

    viewer.remove();
    expect(() => document.body.append(viewer)).not.toThrow();
    await settle();

    expect(requests).toHaveLength(1);
    expect(mediaListeners.size).toBe(0);
    expect(shadowOf(viewer).querySelector('.erd-view')).toBeNull();
    expect(loads).toHaveLength(0);
    expect(errors).toHaveLength(0);
    expect(() => viewer.destroy()).not.toThrow();
  });

  it('reads no language and asks for no dictionary once destroyed, on a first connect or a setter', async () => {
    document.documentElement.lang = 'ko';
    const viewer = createViewer();

    viewer.destroy();
    document.body.append(viewer);
    await viewer.setLocale('ja-JP');
    await settle();

    expect(dictionaryRequests).toEqual([]);
  });

  it('keeps the document it held for the value it reads back', async () => {
    const viewer = mountViewer();
    viewer.value = USERS_FILE;
    await flush();

    viewer.destroy();

    expect(tableIdsOf(viewer)).toEqual(['users']);
  });

  it.each([
    [
      'destroyed and removed in one task',
      (viewer: ErdViewerElement) => {
        viewer.destroy();
        viewer.remove();
      },
    ],
    [
      'removed first, as a framework drops a node',
      (viewer: ErdViewerElement) => {
        viewer.remove();
        viewer.destroy();
      },
    ],
  ])('takes the view down at once when %s', async (_, end) => {
    const resizeDisconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect = resizeDisconnect;
      }
    );
    const before = {
      editors: countRelationshipHighlights().editors,
      stages: stages.length,
    };
    const viewer = mountViewer();
    viewer.value = USERS_FILE;
    await flush();
    const app = lastApp();
    const { id } = app.store.state.editor;
    setRelationshipHighlight(id, 'users.fk');
    transitionTo(transitionKey(id, 'table', 'users'), 1);
    expect(countRelationshipHighlights().editors).toBe(before.editors + 1);
    expect(countTransitions(id)).toBe(1);
    expect(stages.length).toBeGreaterThan(before.stages);

    end(viewer);

    expect(resizeDisconnect).toHaveBeenCalled();
    expect(app.lifecycle.destroyed).toBe(true);
    expect(countRelationshipHighlights().editors).toBe(before.editors);
    expect(countTransitions(id)).toBe(0);
    expect(stages.length).toBe(before.stages);
    expect(shadowOf(viewer).querySelector('.erd-view')).toBeNull();

    await settle();
    expect(shadowOf(viewer).querySelector('.erd-view')).toBeNull();
    expect(tableIdsOf(viewer)).toEqual(['users']);
  });
});
