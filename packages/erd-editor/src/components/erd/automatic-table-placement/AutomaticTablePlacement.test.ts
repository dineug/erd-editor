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
import { MINIMAP_SIZE } from '@/constants/layout';
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
      expect(container.textContent).toContain('Not found tables');
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
      expect(container.querySelectorAll('.table').length).toBeGreaterThan(0);
    });

    it('previews the document in its own store, zoomed and centered on the viewport', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const { width, height } = app.store.state.settings;

      const { container } = await open(app, vi.fn());

      const controller = container.querySelector(
        `.${styles.container} > div`
      ) as HTMLElement;
      const zoomLevel = 800 / width;
      const scrollLeft = -1 * (width / 2 - 800 / 2);
      const scrollTop = -1 * (height / 2 - 600 / 2);

      expect(controller.style.transform).toBe(
        `translate(${scrollLeft}px, ${scrollTop}px) scale(${zoomLevel})`
      );
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

      expect(viewport.style.width).toBe(`${800 * ratio}px`);
      expect(viewport.style.height).toBe(`${600 * ratio}px`);

      app.store.dispatchSync(
        changeViewportAction({ width: 1000, height: 400 })
      );
      await flush();

      expect(viewport.style.width).toBe(`${1000 * ratio}px`);
      expect(viewport.style.height).toBe(`${400 * ratio}px`);
    });

    it('opens a closable toast offering Stop and Cancel', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const toasts = listenToasts(app);

      await open(app, vi.fn());

      expect(toasts).toHaveLength(1);
      expect(toasts[0].close).toBeInstanceOf(Promise);

      const container = await renderToast(toasts[0]);
      expect(container.textContent).toContain('Automatic Table Placement...');
      expect(
        Array.from(container.querySelectorAll('button')).map(el =>
          el.textContent?.trim()
        )
      ).toEqual(['Stop', 'Cancel']);
    });

    it('reports the simulated table positions when Stop is pressed', async () => {
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
      clickButton(container, 'Stop');

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

    it('ignores a Stop that arrives after the overlay was cancelled', async () => {
      const app = createOrigin();
      addTable(app, 't1', 'users');
      const toasts = listenToasts(app);
      const onChange = vi.fn();

      await open(app, onChange);
      const container = await renderToast(toasts[0]);
      clickButton(container, 'Cancel');
      clickButton(container, 'Stop');

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
