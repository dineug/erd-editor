import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as floating from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import VisualizationToolbar from '@/components/visualization/visualization-toolbar/VisualizationToolbar';
import * as styles from '@/components/visualization/visualization-toolbar/VisualizationToolbar.styles';
import { CANVAS_ZOOM_MAX } from '@/constants/schema';
import { ZOOM_STEP } from '@/constants/zoom';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewMoveTableAction,
  viewOpenAction,
  viewScrollToAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { PREVIEW_ZOOM_MAX } from '@/konva/scene/fitZoom';

const hoisted = vi.hoisted(() => ({ requests: 0 }));

/**
 * ELK answers from a shared worker this environment runs none of, so Tidy up's
 * one call is counted here and answered with a row, the group a Flow request
 * packs its unrelated tables into unfolded the way the service unfolds it.
 */
vi.mock('@/services/elk-layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/elk-layout')>();
  const flatten = (nodes: any[]): any[] =>
    nodes.flatMap(node =>
      node.children?.length ? flatten(node.children) : [node]
    );

  return {
    ...actual,
    createElkLayout: (request: any) => {
      hoisted.requests += 1;
      return Promise.resolve(
        flatten(request.nodes).map((node, index) => ({
          id: node.id,
          x: index * 300,
          y: 0,
        }))
      );
    },
  };
});

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  hoisted.requests = 0;
});

async function setup(app: AppContext = createTestAppContext()) {
  mounted = await mountAndFlush(html`<${VisualizationToolbar} />`, app);
  const root = mounted.container.querySelector(
    '.visualization-toolbar'
  ) as HTMLDivElement;

  return { app, root };
}

const menus = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(`.${String(floating.menu)}`));

const titles = (root: HTMLElement) =>
  menus(root).map(menu => menu.getAttribute('title'));

const byTitle = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[title="${name}"]`);

const readoutOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(`.${String(styles.readout)}`)?.textContent;

const click = (el: Element | null) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const isActive = (el: Element | null) =>
  Boolean(el?.className.includes('active'));

/** A Flow view over two tables, placed apart, with the viewport a fit is solved against. */
function seedFlow(app: AppContext, centerIds: string[] = []) {
  app.store.dispatchSync(
    changeViewportAction({ width: 800, height: 600 }),
    changeVisualizationModeAction({ value: VisualizationMode.flow }),
    addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } }),
    addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 2 } }),
    // Named, or a bar that printed the centre's name would print the empty
    // string and the case below would pass on nothing being there to print.
    changeTableNameAction({ id: 't1', value: 'customers' }),
    changeTableNameAction({ id: 't2', value: 'orders' }),
    viewOpenAction({ kind: ViewKind.flow, centerIds })
  );
  app.store.dispatchSync(
    viewSetLayoutAction({
      kind: ViewKind.flow,
      positions: { t1: { x: 0, y: 0 }, t2: { x: 3000, y: 0 } },
    })
  );

  return app;
}

describe('VisualizationToolbar', () => {
  it('stands on its own style module, not the ERD toolbar root (AC-1)', async () => {
    const { root } = await setup();

    expect(root.className).toContain(String(styles.root));
    expect(root.className).not.toContain(String(floating.root));
  });

  it('draws the Graph order: modes, zoom, fit — and no Flow tool (AC-4, AC-5, AC-55)', async () => {
    const { app, root } = await setup();

    expect(app.store.state.editor.visualizationMode).toBe(
      VisualizationMode.graph
    );
    expect(titles(root)).toEqual([
      'Graph',
      'Flow',
      'Zoom out',
      'Zoom in',
      'Fit',
    ]);
    expect(isActive(byTitle(root, 'Graph'))).toBe(true);
    expect(byTitle(root, 'Tidy Up')).toBeNull();
    expect(byTitle(root, 'Keys only')).toBeNull();
    expect(byTitle(root, 'Show all')).toBeNull();
  });

  /**
   * The button is hidden by two conditions at once, and a bar with no centers
   * anywhere hides it on the second alone. Narrowing the Flow view first is
   * what leaves the mode half of the guard as the only thing holding it back.
   */
  it('keeps show all off the Graph bar while the Flow view stands narrowed (AC-5)', async () => {
    const app = seedFlow(createTestAppContext(), ['t1']);
    app.store.dispatchSync(
      changeVisualizationModeAction({ value: VisualizationMode.graph })
    );
    const { root } = await setup(app);

    expect(app.store.state.editor.views.flow!.centerIds).toEqual(['t1']);
    expect(byTitle(root, 'Show all')).toBeNull();
  });

  it('draws the Flow order: modes, zoom, placement, show mode (AC-4, AC-56)', async () => {
    const { app, root } = await setup();

    click(byTitle(root, 'Flow'));
    await flush();

    expect(app.store.state.editor.visualizationMode).toBe(
      VisualizationMode.flow
    );
    expect(isActive(byTitle(root, 'Flow'))).toBe(true);
    expect(titles(root)).toEqual([
      'Graph',
      'Flow',
      'Zoom out',
      'Zoom in',
      'Fit',
      'Tidy Up',
      'Name only',
      'Keys only',
      'All fields',
    ]);

    click(byTitle(root, 'Graph'));
    await flush();

    expect(byTitle(root, 'Tidy Up')).toBeNull();
  });

  // A guard rather than a measurement: the bar has never carried the centre's
  // name or a count of its neighbours, and this is the pin that keeps it so.
  it('names no center and counts no neighbour (AC-9)', async () => {
    const { root } = await setup(seedFlow(createTestAppContext(), ['t1']));

    expect(root.textContent).not.toMatch(
      /t1|customers|neighbour|neighbor|table/i
    );
    expect(titles(root)).not.toContain('Back');
    expect(titles(root)).not.toContain('Forward');
  });

  it('steps the Flow zoom on the two buttons and prints it as a percentage (AC-6)', async () => {
    const app = seedFlow(createTestAppContext());
    const { root } = await setup(app);
    app.store.dispatchSync(
      viewScrollToAction({ originX: 0, originY: 0, kind: ViewKind.flow })
    );
    await flush();

    expect(readoutOf(root)).toBe('100%');

    click(byTitle(root, 'Zoom in'));
    await flush();

    const zoomedIn = app.store.state.editor.views.flow!.zoomLevel;
    expect(zoomedIn).toBeCloseTo(1 + ZOOM_STEP, 5);
    expect(readoutOf(root)).toBe(`${Math.round(zoomedIn * 100)}%`);

    click(byTitle(root, 'Zoom out'));
    await flush();

    expect(app.store.state.editor.views.flow!.zoomLevel).toBeCloseTo(1, 5);
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });

  it('holds the Graph readout at rest while no graph is mounted beside it', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
    const { root } = await setup(app);

    expect(readoutOf(root)).toBe('100%');

    click(byTitle(root, 'Zoom in'));
    await flush();

    // No graph is mounted beside this bar, so the resting handle is what it
    // reaches: the readout holds and the document is not touched either way.
    expect(readoutOf(root)).toBe('100%');
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });

  it('shows the whole document again from the show all button, which only a narrowed view has (AC-7)', async () => {
    const app = seedFlow(createTestAppContext(), ['t1']);
    const { root } = await setup(app);

    expect(titles(root)).toEqual([
      'Graph',
      'Flow',
      'Zoom out',
      'Zoom in',
      'Fit',
      'Tidy Up',
      'Name only',
      'Keys only',
      'All fields',
      'Show all',
    ]);

    click(byTitle(root, 'Show all'));
    await flush();

    expect(app.store.state.editor.views.flow!.centerIds).toEqual([]);
    expect(byTitle(root, 'Show all')).toBeNull();
  });

  it('walks the three show modes and marks the one in use (AC-25)', async () => {
    const app = seedFlow(createTestAppContext());
    const { root } = await setup(app);

    expect(app.store.state.editor.views.flow!.showMode).toBe(ShowMode.nameOnly);
    expect(isActive(byTitle(root, 'Name only'))).toBe(true);

    click(byTitle(root, 'Keys only'));
    await flush();

    expect(app.store.state.editor.views.flow!.showMode).toBe(ShowMode.keysOnly);
    expect(isActive(byTitle(root, 'Keys only'))).toBe(true);
    expect(isActive(byTitle(root, 'Name only'))).toBe(false);

    click(byTitle(root, 'All fields'));
    await flush();

    expect(app.store.state.editor.views.flow!.showMode).toBe(
      ShowMode.allFields
    );
    expect(isActive(byTitle(root, 'All fields'))).toBe(true);
  });

  it('hides the compass while the screen holds content and offers it once it does not (AC-8)', async () => {
    const app = seedFlow(createTestAppContext());
    const { root } = await setup(app);

    click(byTitle(root, 'Fit'));
    await flush();

    expect(byTitle(root, 'Go to content')).toBeNull();

    app.store.dispatchSync(
      viewScrollToAction({
        originX: -90_000,
        originY: -90_000,
        kind: ViewKind.flow,
      })
    );
    await flush();

    const compass = byTitle(root, 'Go to content');
    expect(compass).not.toBeNull();
    expect(titles(root)).toEqual([
      'Graph',
      'Flow',
      'Zoom out',
      'Zoom in',
      'Fit',
      'Tidy Up',
      'Name only',
      'Keys only',
      'All fields',
      'Go to content',
    ]);

    click(compass);
    await flush();

    expect(byTitle(root, 'Go to content')).toBeNull();
  });

  it('asks ELK for the placement again on Tidy up, over every table of the document', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      changeVisualizationModeAction({ value: VisualizationMode.flow }),
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } }),
      addTableAction({ id: 't2', ui: { x: 500, y: 0, zIndex: 2 } })
    );
    const { root } = await setup(app);

    click(byTitle(root, 'Tidy Up'));
    await flush();

    expect(hoisted.requests).toBe(1);
    expect(
      Object.keys(app.store.state.editor.views.flow?.positions ?? {}).sort()
    ).toEqual(['t1', 't2']);
  });

  it('fits what the Flow view shows into the screen, on the view alone', async () => {
    const app = seedFlow(createTestAppContext());
    const { root } = await setup(app);
    const before = app.store.state.editor.views.flow!;
    expect(before.zoomLevel).toBe(1);

    click(byTitle(root, 'Fit'));
    await flush();

    const view = app.store.state.editor.views.flow!;
    expect(view.zoomLevel).toBeLessThan(1);
    expect(view.originX).not.toBe(0);
    expect(app.store.state.settings.zoomLevel).toBe(1);
    expect(app.store.state.settings.originX).toBe(0);
    expect(hoisted.requests).toBe(0);
  });

  // Plan step 27: a view is read up close, so its fit is not held to the
  // ceiling a placement preview of the whole document opens under.
  it('fits two tables standing close past the ceiling a preview stops at', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      changeViewportAction({ width: 1600, height: 1200 }),
      changeVisualizationModeAction({ value: VisualizationMode.flow }),
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } }),
      addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 2 } }),
      viewOpenAction({ kind: ViewKind.flow })
    );
    app.store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 0, y: 0 }, t2: { x: 0, y: 120 } },
      })
    );
    const { root } = await setup(app);

    click(byTitle(root, 'Fit'));
    await flush();

    const view = app.store.state.editor.views.flow!;
    expect(view.zoomLevel).toBeGreaterThan(PREVIEW_ZOOM_MAX);
    expect(view.zoomLevel).toBeLessThanOrEqual(CANVAS_ZOOM_MAX);
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });

  it('leaves a moved table where the drag put it on a fit, and asks ELK nothing', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      changeVisualizationModeAction({ value: VisualizationMode.flow }),
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } }),
      viewOpenAction({ kind: ViewKind.flow })
    );
    app.store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 0, y: 0 } },
      }),
      viewMoveTableAction({
        ids: ['t1'],
        movementX: 40,
        movementY: 20,
        kind: ViewKind.flow,
      })
    );
    const { root } = await setup(app);

    click(byTitle(root, 'Fit'));
    await flush();

    expect(app.store.state.editor.views.flow!.positions.t1).toEqual({
      x: 40,
      y: 20,
    });
    expect(hoisted.requests).toBe(0);
  });
});
