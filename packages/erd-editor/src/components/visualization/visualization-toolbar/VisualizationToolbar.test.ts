import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  formatDistance,
  getContentCompass,
} from '@/components/erd/content-compass/compassGeometry';
import * as floating from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import * as menuStyles from '@/components/primitives/context-menu/menu/Menu.styles';
import { getIcon, type IconName } from '@/components/primitives/icon/icons';
import VisualizationToolbar from '@/components/visualization/visualization-toolbar/VisualizationToolbar';
import * as styles from '@/components/visualization/visualization-toolbar/VisualizationToolbar.styles';
import { Open } from '@/constants/open';
import { CANVAS_ZOOM_MAX } from '@/constants/schema';
import { ZOOM_STEP } from '@/constants/zoom';
import {
  changeOpenMapAction,
  changeViewportAction,
} from '@/engine/modules/editor/atom.actions';
import {
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeShowModeAction,
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
import { KeyBindingName } from '@/utils/keyboard-shortcut';

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
  const container = mounted.container;
  const root = container.querySelector(
    '.visualization-toolbar'
  ) as HTMLDivElement;

  return { app, container, root };
}

// The row display trigger and the compass each wear a widened copy of the same
// pill rather than the pill class itself, so the order the bar draws is read
// off all three.
const menus = (root: HTMLElement) =>
  Array.from(
    root.querySelectorAll<HTMLElement>(
      [floating.menu, styles.showModeTrigger, styles.compass]
        .map(name => `.${String(name)}`)
        .join(', ')
    )
  );

const titles = (root: HTMLElement) =>
  menus(root).map(menu => menu.getAttribute('title'));

const byTitle = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[title="${name}"]`);

const readoutOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(`.${String(styles.readout)}`)?.textContent;

const distanceOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(`.${String(styles.compassDistance)}`)
    ?.textContent;

const click = (el: Element | null) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

// The menu closes on a press rather than on a click, and the stream it listens
// on is the window's, which a bubbling event from inside the bar reaches.
const press = (el: Element | null) =>
  el?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

/** The stop chord, as the editor's own key handler would put it on the stream. */
const escape = (app: AppContext) =>
  app.shortcut$.next({
    type: KeyBindingName.stop,
    event: new KeyboardEvent('keydown', { key: 'Escape' }),
  });

const isActive = (el: Element | null) =>
  Boolean(el?.className.includes('active'));

const triggerOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(`.${String(styles.showModeTrigger)}`);

const menuOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(
    '.visualization-show-mode-menu .context-menu-content'
  );

/** One element per option, in the order the menu lists them. */
const optionsOf = (container: HTMLElement) =>
  Array.from(
    (menuOf(container)?.children ?? []) as HTMLCollectionOf<HTMLElement>
  );

/** What the option prints, which is the only name it carries. */
const labelOf = (option: HTMLElement) => option.textContent?.trim();

// The tick stands in the icon slot of the option's outer row, the first of the
// two rows an option nests, and that slot is empty on the two unmarked ones.
const isMarked = (option: HTMLElement) =>
  Boolean(
    option.querySelector<HTMLElement>(`.${String(menuStyles.icon)}`)
      ?.firstElementChild
  );

const optionLabels = (container: HTMLElement) =>
  optionsOf(container).map(labelOf);

const markedOption = (container: HTMLElement) => {
  const option = optionsOf(container).find(isMarked);
  return option ? labelOf(option) : undefined;
};

const optionByLabel = (container: HTMLElement, name: string) =>
  optionsOf(container).find(option => labelOf(option) === name) ?? null;

/** The shapes the glyph draws, which is what tells one icon from another. */
const pathsOf = (el: Element | null | undefined) =>
  Array.from(el?.querySelectorAll('svg path') ?? []).map(path =>
    path.getAttribute('d')
  );

const iconPaths = (name: IconName) =>
  (getIcon(name)?.node ?? [])
    .filter(([tag]) => tag === 'path')
    .map(([, attrs]) => attrs.d ?? null);

const labelTextOf = (root: HTMLElement) =>
  triggerOf(root)?.querySelector<HTMLElement>(
    `.${String(styles.showModeLabel)}`
  )?.textContent;

/** The glyph the trigger leads with, which is the mode's own, not the chevron. */
const glyphOf = (root: HTMLElement) =>
  pathsOf(triggerOf(root)?.firstElementChild);

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
    expect(triggerOf(root)).toBeNull();
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
      'Row display: Name only',
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
      'Row display: Keys only',
      'Show all',
    ]);

    click(byTitle(root, 'Show all'));
    await flush();

    expect(app.store.state.editor.views.flow!.centerIds).toEqual([]);
    expect(byTitle(root, 'Show all')).toBeNull();
  });

  it('names the show mode in use on its own trigger, closed (AC-25)', async () => {
    const app = seedFlow(createTestAppContext());
    const { container, root } = await setup(app);

    expect(app.store.state.editor.views.flow!.showMode).toBe(ShowMode.nameOnly);
    expect(triggerOf(root)?.getAttribute('title')).toBe(
      'Row display: Name only'
    );
    // Printed on the bar rather than left to a tooltip, and led by the glyph
    // the menu marks, so the closed bar states the mode it stands on.
    expect(labelTextOf(root)).toBe('Name only');
    expect(glyphOf(root)).toEqual(iconPaths('case-sensitive'));
    expect(menuOf(container)).toBeNull();

    app.store.dispatchSync(
      viewChangeShowModeAction({
        value: ShowMode.allFields,
        kind: ViewKind.flow,
      })
    );
    await flush();

    expect(triggerOf(root)?.getAttribute('title')).toBe(
      'Row display: All fields'
    );
    expect(labelTextOf(root)).toBe('All fields');
    expect(glyphOf(root)).toEqual(iconPaths('table'));
    expect(iconPaths('table')).not.toEqual(iconPaths('case-sensitive'));
  });

  it('opens the three show modes from that trigger and marks the one in use (AC-25)', async () => {
    const app = seedFlow(createTestAppContext());
    const { container, root } = await setup(app);

    click(triggerOf(root));
    await flush();

    expect(menuOf(container)).not.toBeNull();
    expect(isActive(triggerOf(root))).toBe(true);
    expect(optionLabels(container)).toEqual([
      'Name only',
      'Keys only',
      'All fields',
    ]);
    expect(markedOption(container)).toBe('Name only');
  });

  it('walks the three show modes from the menu, closing on each choice (AC-25)', async () => {
    const app = seedFlow(createTestAppContext());
    const { container, root } = await setup(app);

    click(triggerOf(root));
    await flush();
    click(optionByLabel(container, 'Keys only'));
    await flush();

    expect(app.store.state.editor.views.flow!.showMode).toBe(ShowMode.keysOnly);
    expect(menuOf(container)).toBeNull();
    expect(triggerOf(root)?.getAttribute('title')).toBe(
      'Row display: Keys only'
    );
    expect(labelTextOf(root)).toBe('Keys only');
    expect(glyphOf(root)).toEqual(iconPaths('key-round'));

    click(triggerOf(root));
    await flush();

    expect(markedOption(container)).toBe('Keys only');

    click(optionByLabel(container, 'All fields'));
    await flush();

    expect(app.store.state.editor.views.flow!.showMode).toBe(
      ShowMode.allFields
    );
    expect(menuOf(container)).toBeNull();

    click(triggerOf(root));
    await flush();
    click(optionByLabel(container, 'Name only'));
    await flush();

    expect(app.store.state.editor.views.flow!.showMode).toBe(ShowMode.nameOnly);
  });

  it('closes the show mode menu on the trigger again, on Escape and on a press outside it', async () => {
    const app = seedFlow(createTestAppContext());
    const { container, root } = await setup(app);

    click(triggerOf(root));
    await flush();
    click(triggerOf(root));
    await flush();

    expect(menuOf(container)).toBeNull();

    click(triggerOf(root));
    await flush();
    escape(app);
    await flush();

    expect(menuOf(container)).toBeNull();
    expect(app.store.state.editor.views.flow!.showMode).toBe(ShowMode.nameOnly);

    click(triggerOf(root));
    await flush();
    press(menuOf(container));
    await flush();

    expect(menuOf(container)).not.toBeNull();

    press(document.body);
    await flush();

    expect(menuOf(container)).toBeNull();
  });

  it('carries the show mode menu off the bar with the Flow mode (AC-5)', async () => {
    const app = seedFlow(createTestAppContext());
    const { container, root } = await setup(app);

    click(triggerOf(root));
    await flush();
    expect(menuOf(container)).not.toBeNull();

    click(byTitle(root, 'Graph'));
    await flush();

    expect(app.store.state.editor.visualizationMode).toBe(
      VisualizationMode.graph
    );
    expect(triggerOf(root)).toBeNull();
    expect(menuOf(container)).toBeNull();
  });

  /**
   * The bar's own Graph button closes the menu before it dispatches, so the
   * guard on the menu answers a mode changed from anywhere else. Dispatched
   * straight at the store, which is the hand the button is not.
   */
  it('carries the show mode menu off a bar the mode leaves by another hand (AC-5)', async () => {
    const app = seedFlow(createTestAppContext());
    const { container, root } = await setup(app);

    click(triggerOf(root));
    await flush();
    expect(menuOf(container)).not.toBeNull();

    app.store.dispatchSync(
      changeVisualizationModeAction({ value: VisualizationMode.graph })
    );
    await flush();

    expect(menuOf(container)).toBeNull();
  });

  it('leaves the menu standing on the stop chord quick search owns', async () => {
    const app = seedFlow(createTestAppContext());
    const { container, root } = await setup(app);

    click(triggerOf(root));
    await flush();
    app.store.dispatchSync(changeOpenMapAction({ [Open.search]: true }));
    escape(app);
    await flush();

    expect(menuOf(container)).not.toBeNull();

    app.store.dispatchSync(changeOpenMapAction({ [Open.search]: false }));
    escape(app);
    await flush();

    expect(menuOf(container)).toBeNull();
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
      'Row display: Name only',
      'Go to content',
    ]);

    click(compass);
    await flush();

    expect(byTitle(root, 'Go to content')).toBeNull();
  });

  it('says how far that content lies as well as which way', async () => {
    const app = seedFlow(createTestAppContext());
    const { root } = await setup(app);

    click(byTitle(root, 'Fit'));
    await flush();
    expect(distanceOf(root)).toBeUndefined();

    app.store.dispatchSync(
      viewScrollToAction({
        originX: -90_000,
        originY: -90_000,
        kind: ViewKind.flow,
      })
    );
    await flush();

    const compass = getContentCompass(app.store.state, ViewKind.flow)!;
    expect(compass).not.toBeNull();
    expect(distanceOf(root)).toBe(formatDistance(compass.distance));
    expect(distanceOf(root)).not.toBe('0');
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
