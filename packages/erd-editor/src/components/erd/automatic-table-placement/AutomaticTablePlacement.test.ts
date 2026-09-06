import { toJson } from '@dineug/erd-editor-schema';
import { createRef, DOMTemplateLiterals, html } from '@dineug/r-html';
import { round } from 'es-toolkit/compat';
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
import AutomaticTablePlacement, {
  FIT_PADDING,
  PREVIEW_ZOOM_MAX,
  previewZoomLevel,
  TablePoint,
} from '@/components/erd/automatic-table-placement/AutomaticTablePlacement';
import * as styles from '@/components/erd/automatic-table-placement/AutomaticTablePlacement.styles';
import {
  getMinimapHandleRect,
  getMinimapLayout,
  getScrollToCenter,
  getViewTransform,
  getVisibleCanvasRect,
} from '@/components/erd/minimap/minimapGeometry';
import { MINIMAP_MARGIN } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CANVAS_ZOOM_MIN } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { getContentRect } from '@/konva/scene/contentBounds';
import type { Rect } from '@/konva/scene/metrics';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const hoisted = vi.hoisted(() => ({
  simulations: [] as any[],
  throwOnCreate: false,
}));

/**
 * Wraps the real simulation so the test can drive ticks deterministically —
 * the d3 timer would otherwise keep running across tests.
 */
vi.mock(
  '@/components/erd/automatic-table-placement/createAutomaticTablePlacement',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/components/erd/automatic-table-placement/createAutomaticTablePlacement')
      >();

    return {
      placementProgress: actual.placementProgress,
      createAutomaticTablePlacement: (state: any) => {
        if (hoisted.throwOnCreate) {
          throw new Error('simulation failed');
        }
        const simulation = actual.createAutomaticTablePlacement(state);
        simulation.stop();
        hoisted.simulations.push(simulation);
        return simulation;
      },
    };
  }
);

type Toast = { message: DOMTemplateLiterals; close?: Promise<void> };

let mounted: Mounted | null = null;
let toastContainer: Mounted | null = null;

const contexts: AppContext[] = [];

function createOrigin(): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
  contexts.push(app);
  return app;
}

function addTable(
  app: AppContext,
  id: string,
  name: string,
  ui: { x: number; y: number } = { x: 10, y: 20 }
) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { ...ui, zIndex: 2 } }),
    changeTableNameAction({ id, value: name })
  );
}

const centerOf = (rect: Rect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/**
 * A store placed as the overlay places its own: the same document, fitted once
 * to the viewport it opened with and centred on the content. What the overlay
 * builds is unreachable from here, so the minimap it draws is compared to this.
 */
function createPreview(app: AppContext): AppContext {
  const state = app.store.state;
  const content = getContentRect(state) as Rect;
  const { viewport } = state.editor;
  const zoomLevel = previewZoomLevel(content, viewport);
  const origin = getScrollToCenter(
    { ...getViewTransform(state), zoomLevel },
    centerOf(content)
  );
  const preview = createTestAppContext();

  preview.store.dispatchSync(
    initialLoadJsonAction$(toJson(state)),
    changeViewportAction({ ...viewport }),
    changeZoomLevelAction({ value: zoomLevel }),
    scrollToAction({ originX: origin.x, originY: origin.y })
  );
  contexts.push(preview);

  return preview;
}

/** The minimap handle that store draws, as Viewport lays it out in the dom. */
function handleStyle(preview: AppContext) {
  const state = preview.store.state;
  const layout = getMinimapLayout(state);
  const rect = getMinimapHandleRect(layout, getViewTransform(state));
  const { box, offset } = layout;

  return {
    width: rect.width,
    height: rect.height,
    top: MINIMAP_MARGIN + offset.y + rect.y,
    right: MINIMAP_MARGIN + offset.x + (box.width - rect.x - rect.width),
  };
}

/** The same four lengths off the element, which the dom keeps to six places. */
function elementStyle(element: HTMLElement) {
  return {
    width: Number.parseFloat(element.style.width),
    height: Number.parseFloat(element.style.height),
    top: Number.parseFloat(element.style.top),
    right: Number.parseFloat(element.style.right),
  };
}

function listenToasts(app: AppContext): Toast[] {
  const toasts: Toast[] = [];
  app.emitter.on({
    openToast: action => {
      toasts.push(action.payload as Toast);
    },
  });
  return toasts;
}

async function open(app: AppContext, onChange: (tables: TablePoint[]) => void) {
  const appRef = createRef(app);
  mounted = mount(
    html`<${AutomaticTablePlacement} app=${appRef} .onChange=${onChange} />`,
    app
  );
  await flush();
  return mounted;
}

/** Render a captured toast template so its buttons can be clicked. */
async function renderToast(toast: Toast) {
  toastContainer = mount(html`${toast.message}`);
  await flush();
  return toastContainer.container;
}

function clickButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    el => el.textContent?.trim() === text
  );
  if (!button) {
    throw new Error(`button not found: ${text}`);
  }
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

beforeEach(() => {
  hoisted.simulations.length = 0;
  hoisted.throwOnCreate = false;
});

afterEach(() => {
  contexts.splice(0).forEach(app => app.store.destroy());
  toastContainer?.unmount();
  toastContainer = null;
  mounted?.unmount();
  mounted = null;
  hoisted.simulations.splice(0).forEach(simulation => simulation.stop());
});

describe('AutomaticTablePlacement', () => {
  describe('without tables', () => {
    it('renders nothing and closes itself right away', async () => {
      const app = createOrigin();
      const onChange = vi.fn();

      const { container } = await open(app, onChange);

      expect(container.querySelector(`.${styles.root}`)).toBeNull();
      expect(container.querySelector('.minimap')).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
      expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
        false
      );
    });

    it('toasts that no tables were found, without any action buttons', async () => {
      const app = createOrigin();
      const toasts = listenToasts(app);

      await open(app, vi.fn());

      expect(toasts).toHaveLength(1);
      expect(toasts[0].close).toBeUndefined();

      const container = await renderToast(toasts[0]);
      expect(container.textContent).toContain('No tables to place');
      expect(container.querySelectorAll('button')).toHaveLength(0);
    });

    it('never starts a simulation', async () => {
      const app = createOrigin();

      await open(app, vi.fn());

      expect(hoisted.simulations).toHaveLength(0);
    });
  });

  describe('with tables', () => {
    it('renders the overlay, the preview canvas and the minimap', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      addTable(app, 't2', 'posts');

      const { container } = await open(app, vi.fn());

      const root = container.querySelector(`.${styles.root}`);
      expect(root).toBeTruthy();
      expect(root?.querySelector(`.${styles.container}`)).toBeTruthy();
      expect(container.querySelector('.minimap')).toBeTruthy();
      expect(container.querySelector('.minimap-viewport')).toBeTruthy();
      expect(
        container.querySelector('[data-testid="erd-canvas"]')
      ).toBeTruthy();
    });

    it('fits the whole content into the preview and centres it on it', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users', { x: 0, y: 0 });
      addTable(app, 't2', 'posts', { x: 4_000, y: 3_000 });
      const content = getContentRect(app.store.state) as Rect;

      const { container } = await open(app, vi.fn());

      // The origin is the preview store's, and the minimap viewport rectangle
      // is where it reaches the dom: the scene's own copy of it went onto the
      // konva layer, which no unit environment can build.
      const viewport = container.querySelector(
        '.minimap-viewport'
      ) as HTMLElement;
      const preview = createPreview(app);
      const style = handleStyle(preview);
      const drawn = elementStyle(viewport);

      expect(drawn.top).toBeCloseTo(style.top, 5);
      expect(drawn.right).toBeCloseTo(style.right, 5);
      expect(drawn.width).toBeCloseTo(style.width, 5);
      expect(drawn.height).toBeCloseTo(style.height, 5);

      // What makes that placement a fit: the screen reaches past the content on
      // both axes, and the middle of what it reaches is the middle of the content.
      const visible = getVisibleCanvasRect(
        getViewTransform(preview.store.state)
      );
      expect(visible.width).toBeGreaterThan(content.width);
      expect(visible.height).toBeGreaterThan(content.height);
      expect(centerOf(visible).x).toBeCloseTo(centerOf(content).x, 6);
      expect(centerOf(visible).y).toBeCloseTo(centerOf(content).y, 6);
    });

    it('mirrors the origin viewport into the preview store', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users', { x: 0, y: 0 });
      addTable(app, 't2', 'posts', { x: 4_000, y: 3_000 });
      const { container } = await open(app, vi.fn());
      const viewport = container.querySelector(
        '.minimap-viewport'
      ) as HTMLElement;
      const preview = createPreview(app);

      expect(elementStyle(viewport).height).toBeCloseTo(
        handleStyle(preview).height,
        5
      );

      // The fit is taken once, so a viewport that changes afterwards moves the
      // handle without re-zooming: the preview store is told only the new screen.
      app.store.dispatchSync(
        changeViewportAction({ width: 1000, height: 400 })
      );
      preview.store.dispatchSync(
        changeViewportAction({ width: 1000, height: 400 })
      );
      await flush();

      expect(elementStyle(viewport).height).toBeCloseTo(
        handleStyle(preview).height,
        5
      );
      expect(elementStyle(viewport).width).toBeCloseTo(
        handleStyle(preview).width,
        5
      );
    });

    it('opens a closable toast offering Apply and Cancel', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const toasts = listenToasts(app);

      await open(app, vi.fn());

      expect(toasts).toHaveLength(1);
      expect(toasts[0].close).toBeInstanceOf(Promise);

      const container = await renderToast(toasts[0]);
      expect(container.textContent).toContain('Placing tables… 0%');
      expect(
        Array.from(container.querySelectorAll('button')).map(el =>
          el.textContent?.trim()
        )
      ).toEqual(['Apply', 'Cancel']);
    });

    it('shows how far the placement has run as the simulation cools', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const toasts = listenToasts(app);

      await open(app, vi.fn());
      const simulation = hoisted.simulations[0];
      const container = await renderToast(toasts[0]);
      const bar = container.querySelector(
        '[role="progressbar"]'
      ) as HTMLElement;
      expect(bar.getAttribute('aria-valuenow')).toBe('0');

      // tick() brings the heat down without dispatching, so the listener is
      // called here the way the simulation's own timer would call it.
      for (let tick = 0; tick < 150; tick++) simulation.tick();
      simulation.on('tick.progress').call(simulation);
      await flush();

      const percent = Number(/(\d+)%/.exec(container.textContent ?? '')?.[1]);
      expect(percent).toBeGreaterThan(40);
      expect(percent).toBeLessThan(60);
      expect(Number(bar.getAttribute('aria-valuenow')) * 100).toBeCloseTo(
        percent,
        0
      );
    });

    it('reports the simulated table positions when Apply is pressed', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      addTable(app, 't2', 'posts');
      const toasts = listenToasts(app);
      const onChange = vi.fn();

      await open(app, onChange);

      const simulation = hoisted.simulations[0];
      const nodes = simulation.nodes();
      nodes[0].x = 500;
      nodes[0].y = 600;
      nodes[1].x = 900;
      nodes[1].y = 1000;
      simulation.on('tick').call(simulation);

      const container = await renderToast(toasts[0]);
      clickButton(container, 'Apply');

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual([
        { id: 't1', x: 500 - nodes[0].r, y: 600 - nodes[0].r },
        { id: 't2', x: 900 - nodes[1].r, y: 1000 - nodes[1].r },
      ]);
      await expect(toasts[0].close).resolves.toBeUndefined();
      await flush();
      expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
        false
      );
    });

    it('closes without reporting anything when Cancel is pressed', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const toasts = listenToasts(app);
      const onChange = vi.fn();

      await open(app, onChange);
      const container = await renderToast(toasts[0]);
      clickButton(container, 'Cancel');

      expect(onChange).not.toHaveBeenCalled();
      await expect(toasts[0].close).resolves.toBeUndefined();
      await flush();
      expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
        false
      );
    });

    it('ignores an Apply that arrives after the overlay was cancelled', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const toasts = listenToasts(app);
      const onChange = vi.fn();

      await open(app, onChange);
      const container = await renderToast(toasts[0]);
      clickButton(container, 'Cancel');
      clickButton(container, 'Apply');

      expect(onChange).not.toHaveBeenCalled();
    });

    it('reports the positions when the simulation settles on its own', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const onChange = vi.fn();

      await open(app, onChange);
      const simulation = hoisted.simulations[0];
      simulation.on('end').call(simulation);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual([{ id: 't1', x: 10, y: 20 }]);
    });

    it('cancels on the stop key binding', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const onChange = vi.fn();

      await open(app, onChange);
      app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown', { key: 'Escape' }),
      });
      await flush();

      expect(onChange).not.toHaveBeenCalled();
      expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
        false
      );
    });

    it('ignores key bindings other than stop', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const onChange = vi.fn();

      await open(app, onChange);
      app.shortcut$.next({
        type: KeyBindingName.selectAllTable,
        event: new KeyboardEvent('keydown', { key: 'a' }),
      });
      await flush();

      expect(
        app.store.state.editor.openMap[Open.automaticTablePlacement]
      ).toBeUndefined();
    });

    it('stops mirroring the viewport once unmounted', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const { container } = await open(app, vi.fn());
      const viewport = container.querySelector(
        '.minimap-viewport'
      ) as HTMLElement;
      const before = viewport.style.width;

      mounted?.unmount();
      mounted = null;

      expect(() => {
        app.store.dispatchSync(
          changeViewportAction({ width: 1234, height: 567 })
        );
      }).not.toThrow();
      await flush();

      expect(viewport.isConnected).toBe(false);
      expect(viewport.style.width).toBe(before);
    });
  });

  describe('when the simulation cannot be built', () => {
    it('closes and renders nothing instead of surfacing the error', async () => {
      hoisted.throwOnCreate = true;
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const toasts = listenToasts(app);
      const onChange = vi.fn();

      const { container } = await open(app, onChange);

      expect(container.querySelector(`.${styles.root}`)).toBeNull();
      expect(toasts).toHaveLength(0);
      expect(onChange).not.toHaveBeenCalled();
      expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
        false
      );
    });

    it('also closes when a relationship points at a missing table', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      app.store.dispatchSync(
        addRelationshipAction({
          id: 'r1',
          relationshipType: 4,
          start: { tableId: 't1', columnIds: [] },
          end: { tableId: 'missing', columnIds: [] },
        })
      );
      const onChange = vi.fn();

      const { container } = await open(app, onChange);

      expect(container.querySelector(`.${styles.root}`)).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
      expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
        false
      );
    });
  });
});

describe('previewZoomLevel', () => {
  const viewport = { width: 1200, height: 675 };
  const rect = (width: number, height: number): Rect => ({
    x: 0,
    y: 0,
    width,
    height,
  });

  /** The fit before it is rounded or held, written out longhand. */
  const rawFit = ({ width, height }: Rect) =>
    Math.min(
      viewport.width / (width + FIT_PADDING),
      viewport.height / (height + FIT_PADDING)
    );

  it('opens no closer than the ceiling on content the screen dwarfs', () => {
    const content = rect(200, 100);

    expect(rawFit(content)).toBeGreaterThan(PREVIEW_ZOOM_MAX);
    expect(previewZoomLevel(content, viewport)).toBe(PREVIEW_ZOOM_MAX);
  });

  it('opens no farther than the floor every zoom has on content the screen cannot hold', () => {
    const content = rect(20_000, 20_000);

    expect(rawFit(content)).toBeLessThan(CANVAS_ZOOM_MIN);
    expect(previewZoomLevel(content, viewport)).toBe(CANVAS_ZOOM_MIN);
  });

  it('is the fit itself, rounded to two places, in between', () => {
    for (const content of [
      rect(2_000, 1_500),
      rect(700, 1_800),
      rect(3_333, 300),
    ]) {
      const zoomLevel = previewZoomLevel(content, viewport);
      const fit = rawFit(content);

      expect(fit).toBeGreaterThan(CANVAS_ZOOM_MIN);
      expect(fit).toBeLessThan(PREVIEW_ZOOM_MAX);
      expect(zoomLevel).toBe(round(zoomLevel, 2));
      expect(Math.abs(zoomLevel - fit)).toBeLessThanOrEqual(0.005);
    }
  });

  it('fits the tighter axis, so the whole content is on screen either way', () => {
    const wide = rect(4_000, 100);
    const tall = rect(100, 4_000);

    expect(previewZoomLevel(wide, viewport)).toBe(
      round(viewport.width / (wide.width + FIT_PADDING), 2)
    );
    expect(previewZoomLevel(tall, viewport)).toBe(
      round(viewport.height / (tall.height + FIT_PADDING), 2)
    );
  });
});
