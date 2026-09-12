import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as styles from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import VisualizationToolbar from '@/components/visualization/visualization-toolbar/VisualizationToolbar';
import { CANVAS_ZOOM_MAX } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ViewKind, VisualizationMode } from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewMoveTableAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
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
  Array.from(root.querySelectorAll<HTMLElement>(`.${String(styles.menu)}`));

const byTitle = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[title="${name}"]`);

const click = (el: Element | null) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const isActive = (el: Element | null) =>
  Boolean(el?.className.includes('active'));

describe('VisualizationToolbar', () => {
  it('draws the two modes with Graph up, and no Flow tool while Graph is up', async () => {
    const { root } = await setup();

    expect(root.className).toContain(String(styles.root));
    expect(menus(root).map(menu => menu.getAttribute('title'))).toEqual([
      'Graph',
      'Flow',
    ]);
    expect(isActive(byTitle(root, 'Graph'))).toBe(true);
    expect(isActive(byTitle(root, 'Flow'))).toBe(false);
  });

  it('switches the mode on a click, and draws the fit and Tidy up while Flow is up', async () => {
    const { app, root } = await setup();

    click(byTitle(root, 'Flow'));
    await flush();

    expect(app.store.state.editor.visualizationMode).toBe(
      VisualizationMode.flow
    );
    expect(isActive(byTitle(root, 'Flow'))).toBe(true);
    expect(menus(root).map(menu => menu.getAttribute('title'))).toEqual([
      'Graph',
      'Flow',
      'Fit',
      'Tidy Up',
    ]);

    click(byTitle(root, 'Graph'));
    await flush();

    expect(app.store.state.editor.visualizationMode).toBe(
      VisualizationMode.graph
    );
    expect(byTitle(root, 'Fit')).toBeNull();
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
    const app = createTestAppContext();
    app.store.dispatchSync(
      changeViewportAction({ width: 800, height: 600 }),
      changeVisualizationModeAction({ value: VisualizationMode.flow }),
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } }),
      addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 2 } }),
      viewOpenAction({ kind: ViewKind.flow })
    );
    app.store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 0, y: 0 }, t2: { x: 3000, y: 0 } },
      })
    );
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
