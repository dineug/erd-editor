import { createRef, DOMTemplateLiterals, html } from '@dineug/r-html';
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
  TablePoint,
} from '@/components/erd/automatic-table-placement/AutomaticTablePlacement';
import * as styles from '@/components/erd/automatic-table-placement/AutomaticTablePlacement.styles';
import { MINIMAP_MARGIN, MINIMAP_SIZE } from '@/constants/layout';
import { Open } from '@/constants/open';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
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

function createOrigin(): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
  return app;
}

function addTable(app: AppContext, id: string, name: string) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { x: 10, y: 20, zIndex: 2 } }),
    changeTableNameAction({ id, value: name })
  );
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

    it('centers the preview scroll on the origin viewport', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const { width, height } = app.store.state.settings;

      const { container } = await open(app, vi.fn());

      // The scroll is the preview store's, and the minimap viewport rectangle
      // is where it reaches the dom: the scene's own copy of it went onto the
      // konva layer, which no unit environment can build.
      const viewport = container.querySelector(
        '.minimap-viewport'
      ) as HTMLElement;
      const ratio = MINIMAP_SIZE / width;
      const zoomLevel = 800 / width;
      const scrollTop = -1 * (height / 2 - 600 / 2);
      // The rectangle is the canvas the screen reaches, not the screen's own
      // size, so the preview zoom divides into both. Horizontally that is the
      // whole 2000 box, which is the map, and the offset from its left is nil.
      const top =
        (-1 * (scrollTop + (height - height * zoomLevel) / 2)) / zoomLevel;

      expect(viewport.style.top).toBe(`${MINIMAP_MARGIN + top * ratio}px`);
      expect(viewport.style.right).toBe(`${MINIMAP_MARGIN}px`);
    });

    it('mirrors the origin viewport into the preview store', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const { width } = app.store.state.settings;
      const { container } = await open(app, vi.fn());
      const viewport = container.querySelector(
        '.minimap-viewport'
      ) as HTMLElement;
      const ratio = MINIMAP_SIZE / width;

      // The preview is zoomed to 0.4 so the whole canvas fits, so the screen
      // reaches 800 / 0.4 across, which is the canvas box and therefore the
      // whole map. Only the height leaves room to grow with the viewport.
      const zoomLevel = 800 / width;

      expect(viewport.style.width).toBe(`${MINIMAP_SIZE}px`);
      expect(viewport.style.height).toBe(`${(600 / zoomLevel) * ratio}px`);

      app.store.dispatchSync(
        changeViewportAction({ width: 1000, height: 400 })
      );
      await flush();

      expect(viewport.style.width).toBe(`${MINIMAP_SIZE}px`);
      expect(viewport.style.height).toBe(`${(400 / zoomLevel) * ratio}px`);
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
