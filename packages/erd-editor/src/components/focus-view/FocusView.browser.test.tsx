// The Focus overlay as the editor root mounts it: one component whichever tab
// is up, drawn only while a Focus view is open, providing its source to the
// scene inside its box alone, placed by ELK as it opens and walks, and left for the ERD.

import { type AnyAction, FC, render, useProvider } from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  flush,
  mount,
  type Mounted,
  movePointer,
  moveScenePointer,
  releasePointer,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import * as erdStyles from '@/components/erd/Erd.styles';
import FocusView from '@/components/focus-view/FocusView';
import * as styles from '@/components/focus-view/FocusView.styles';
import QuickSearch from '@/components/quick-search/QuickSearch';
import { useSceneSource } from '@/components/sceneSourceContext';
import { themeContext } from '@/components/themeContext';
import ToastContainer from '@/components/toast-container/ToastContainer';
import * as toastStyles from '@/components/toast-container/ToastContainer.styles';
import Toolbar from '@/components/toolbar/Toolbar';
import { FOCUS_BAR_HEIGHT } from '@/constants/layout';
import { Open } from '@/constants/open';
import {
  CANVAS_ZOOM_MAX,
  CanvasType,
  RelationshipType,
} from '@/constants/schema';
import { TablePlacement } from '@/constants/tablePlacement';
import {
  changeOpenMapAction,
  changeViewportAction,
  clearAction,
} from '@/engine/modules/editor/atom.actions';
import { ShowMode, ViewKind } from '@/engine/modules/editor/state';
import {
  viewMoveTableAction,
  viewSetCentersAction,
} from '@/engine/modules/editor/view.actions';
import { openFocusViewAction$ } from '@/engine/modules/editor/view.generator.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  changeCanvasTypeAction,
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { Tag } from '@/engine/tag';
import type { Point } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { getSceneContentRect } from '@/konva/scene/contentBounds';
import { previewZoomLevel } from '@/konva/scene/fitZoom';
import { getTableRect } from '@/konva/scene/metrics';
import { toScreenPoint } from '@/konva/scene/viewport';
import { closeColorPickerAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { toZoomFormat } from '@/utils/validation';

const hoisted = vi.hoisted(() => ({
  requests: [] as Array<{ placement: string; nodes: any[]; edges: any[] }>,
  /** Set to hold the next answer back until the spec lets it go. */
  hold: false,
  release: [] as Array<() => void>,
}));

/**
 * ELK answers from a shared worker the spec does not wait on: the one call
 * across that boundary is stood in for by a row, so a request is something the
 * spec can count and the landing something it can predict.
 */
vi.mock('@/services/elk-layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/elk-layout')>();

  return {
    ...actual,
    createElkLayout: (request: any) => {
      hoisted.requests.push(request);
      const points = request.nodes.map((node: any, index: number) => ({
        id: node.id,
        x: index * 400,
        y: (index % 2) * 200,
      }));
      if (!hoisted.hold) return Promise.resolve(points);

      return new Promise(resolve => {
        hoisted.release.push(() => resolve(points));
      });
    },
  };
});

const VIEWPORT = { width: 1000, height: 630 };

/** The screen a Focus fit has: the viewport less the bar drawn over its top. */
const SCREEN = {
  width: VIEWPORT.width,
  height: VIEWPORT.height - FOCUS_BAR_HEIGHT,
};

/** Where the document stands its tables, all on the first screen. */
const DOCUMENT_POINTS: Record<string, Point> = {
  t1: { x: 100, y: 100 },
  t2: { x: 700, y: 100 },
  t3: { x: 400, y: 400 },
  t4: { x: 1300, y: 100 },
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  hoisted.requests.splice(0);
  hoisted.hold = false;
  hoisted.release.splice(0);
  await whenDrawn();
});

type ProbeProps = { id: string };

/** A root-level neighbour of the overlay, saying which source it resolves to. */
const Probe: FC<ProbeProps> = (props, ctx) => {
  const sourceRef = useSceneSource(ctx);

  return () => (
    <div
      class="source-probe"
      data-probe={props.id}
      data-source={sourceRef.value}
    ></div>
  );
};

const link = (id: string, start: string, end: string) =>
  addRelationshipAction({
    id,
    relationshipType: RelationshipType.ZeroN,
    start: { tableId: start, columnIds: [] },
    end: { tableId: end, columnIds: [] },
  });

/**
 * A chain t1 - t2 - t3, a table t4 nothing reaches, a memo, and a key on the
 * first three tables so their key rows differ from all of their rows and a
 * type cell can say whether a table is lit.
 */
function seed(app: AppContext) {
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    ...Object.entries(DOCUMENT_POINTS).map(([id, point], index) =>
      addTableAction({ id, ui: { ...point, zIndex: index + 1 } })
    ),
    changeTableNameAction({ id: 't1', value: 'users' }),
    changeTableNameAction({ id: 't2', value: 'orders' }),
    changeTableNameAction({ id: 't3', value: 'items' }),
    changeTableNameAction({ id: 't4', value: 'logs' }),
    addColumnAction({ id: 'c1', tableId: 't1' }),
    addColumnAction({ id: 'c2', tableId: 't1' }),
    addColumnAction({ id: 'c3', tableId: 't2' }),
    addColumnAction({ id: 'c4', tableId: 't2' }),
    addColumnAction({ id: 'c5', tableId: 't3' }),
    changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'id' }),
    changeColumnNameAction({ tableId: 't1', id: 'c2', value: 'name' }),
    changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true }),
    changeColumnPrimaryKeyAction({ tableId: 't2', id: 'c3', value: true }),
    changeColumnPrimaryKeyAction({ tableId: 't3', id: 'c5', value: true }),
    link('r12', 't1', 't2'),
    link('r23', 't2', 't3'),
    addMemoAction({ id: 'm1', ui: { x: 100, y: 500, zIndex: 9 } })
  );
}

/** A document edit the way a peer's arrives, which is the one way an edit reaches the store under a view. */
const shared = (action: AnyAction): AnyAction => ({
  ...action,
  tags: Tag.shared,
});

/**
 * The editor root the way ErdEditor lays it out: the toolbar, the overlay,
 * the toasts and the search as siblings of one root, none of them in a scene,
 * with a probe on either side of the overlay to read what reaches a sibling.
 */
async function mountEditorRoot(app: AppContext): Promise<Mounted> {
  const mounted = mount(
    <div
      class="root"
      style={{
        position: 'relative',
        width: `${VIEWPORT.width}px`,
        height: `${VIEWPORT.height}px`,
      }}
    >
      <Toolbar enableThemeBuilder={false} readonly={false} />
      <Probe id="before" />
      <FocusView />
      <ToastContainer />
      <QuickSearch />
      <Probe id="after" />
    </div>,
    app
  );
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  await settle();

  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
  });

  return mounted;
}

/** Two rounds: the layout lands in a microtask after the first, and the fit after it. */
const settle = async () => {
  await flush();
  await whenDrawn();
  await flush();
  await whenDrawn();
};

const stageRegistry = (): Record<string, Stage> =>
  Reflect.get(globalThis, '__erdStages') ?? {};

const focusStage = () => stageRegistry().canvas;

const overlayOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>('.focus-view');

const sceneBoxOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>(
    `.focus-view > .${String(erdStyles.root)}`
  )!;

const barOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>('.focus-bar')!;

const menuOf = (mounted: Mounted, title: string) =>
  mounted.container.querySelector<HTMLElement>(
    `.focus-bar [title="${title}"]`
  )!;

const menuStartingWith = (mounted: Mounted, title: string) =>
  mounted.container.querySelector<HTMLElement>(
    `.focus-bar [title^="${title}"]`
  )!;

const click = (el: Element | null) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const probeSourceOf = (root: ParentNode, id: string) =>
  root
    .querySelector<HTMLElement>(`.source-probe[data-probe="${id}"]`)
    ?.getAttribute('data-source');

/** A probe rendered now, into the element given, so it resolves against the providers as they stand. */
function probeInto(host: HTMLElement, id: string): string | null {
  const mountPoint = document.createElement('div');
  host.append(mountPoint);
  render(mountPoint, <Probe id={id} />);
  teardowns.push(() => {
    render(mountPoint, null);
    mountPoint.remove();
  });

  return probeSourceOf(mountPoint, id) ?? null;
}

const tableOf = (id: string) =>
  focusStage().findOne<Group>(`#table-${id}`) as Group | undefined;

const drawnTableIds = () =>
  focusStage()
    .find('.table')
    .filter(node => node.visible())
    .map(node => node.id().replace('table-', ''))
    .sort();

const drawnConnectorIds = (ids: string[]) =>
  ids.filter(id => focusStage().findOne(`.${id}`) !== undefined);

const rowCountOf = (id: string) => tableOf(id)!.find('.column-row').length;

const typeOpacityOf = (id: string) =>
  tableOf(id)!
    .find('.columnDataType')
    .map(node => node.opacity());

const focusOf = (app: AppContext) => app.store.state.editor.views.focus;

/** A plain copy of where the view stands each table, read off the observable. */
const positionsOf = (app: AppContext) =>
  Object.fromEntries(
    Object.entries(focusOf(app)?.positions ?? {}).map(([id, { x, y }]) => [
      id,
      { x, y },
    ])
  );

/** Where the row ELK is stood in for by lands the tables given, in the order they were asked. */
const landingOf = (ids: string[]) =>
  Object.fromEntries(
    ids.map((id, index) => [id, { x: index * 400, y: (index % 2) * 200 }])
  );

const chord = (app: AppContext, type: KeyBindingName) =>
  app.shortcut$.next({
    type,
    event: new KeyboardEvent('keydown'),
  });

/** Opens a Focus view on the tables given and waits for the placement to land and the fit to follow. */
async function openOn(app: AppContext, tableIds: string[]) {
  app.store.dispatchSync(openFocusViewAction$(tableIds));
  await settle();
}

/**
 * A press and a release on one table without moving, which is what the Focus
 * scene walks on. The scene redraws between the two, as it does under a real
 * click: the press selects the table, which rebuilds its node before the release.
 */
async function clickTable(id: string, init: MouseEventInit = {}) {
  const at = { clientX: 10, clientY: 10, ...init };

  fireScenePointer(tableOf(id)!, 'mousedown', at);
  await settle();
  fireScenePointer(tableOf(id)!, 'mouseup', at);
  await settle();
}

/** Where the pointer lands to hover one table, in the stage's own coordinates. */
async function hoverTable(id: string) {
  await whenPainted();
  const stage = focusStage();
  const box = tableOf(id)!.getClientRect({ relativeTo: stage });
  moveScenePointer(stage, box.x + box.width / 2, box.y + box.height - 4);
  await settle();
}

/** The corners of what the view shows, where they land on the screen. */
function shownCornersOf(app: AppContext) {
  const view = focusOf(app)!;
  const content = getSceneContentRect(app.store.state, 'focus')!;

  return {
    content,
    topLeft: toScreenPoint(view, { x: content.x, y: content.y }),
    bottomRight: toScreenPoint(view, {
      x: content.x + content.width,
      y: content.y + content.height,
    }),
  };
}

describe('the Focus overlay at the editor root', () => {
  it('draws nothing until a Focus view opens, and takes the overlay down when it closes (AC-44)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);

    expect(overlayOf(mounted)).toBeNull();
    expect(focusStage()).toBeUndefined();

    await openOn(app, ['t1']);

    expect(overlayOf(mounted)).not.toBeNull();
    expect(focusStage()).toBeDefined();
    expect(app.store.state.editor.openMap[Open.focus]).toBe(true);

    click(menuStartingWith(mounted, 'Close'));
    await settle();

    expect(focusOf(app)).toBeNull();
    expect(overlayOf(mounted)).toBeNull();
    expect(focusStage()).toBeUndefined();
    expect(app.store.state.editor.openMap[Open.focus]).toBe(false);
  });

  it('closes on the stop chord the way the button does, and only while it is up (AC-35 half)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);

    // Nothing subscribed yet: the chord with no view open changes nothing.
    chord(app, KeyBindingName.stop);
    await settle();
    expect(focusOf(app)).toBeNull();

    await openOn(app, ['t1']);
    chord(app, KeyBindingName.stop);
    await settle();

    expect(focusOf(app)).toBeNull();
    expect(overlayOf(mounted)).toBeNull();
  });

  it('leaves the view up on a stop chord that closes the search over it, and takes it down on the next', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    chord(app, KeyBindingName.search);
    await settle();
    expect(app.store.state.editor.openMap[Open.search]).toBe(true);

    chord(app, KeyBindingName.stop);
    await settle();

    expect(app.store.state.editor.openMap[Open.search]).toBe(false);
    expect(focusOf(app)).not.toBeNull();
    expect(overlayOf(mounted)).not.toBeNull();

    chord(app, KeyBindingName.stop);
    await settle();

    expect(focusOf(app)).toBeNull();
    expect(overlayOf(mounted)).toBeNull();
  });

  it('leaves the view up on a stop chord while the theme builder is open, which closes on the same chord', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    await openOn(app, ['t1']);

    app.store.dispatchSync(changeOpenMapAction({ [Open.themeBuilder]: true }));
    chord(app, KeyBindingName.stop);
    await settle();
    expect(focusOf(app)).not.toBeNull();

    app.store.dispatchSync(changeOpenMapAction({ [Open.themeBuilder]: false }));
    chord(app, KeyBindingName.stop);
    await settle();
    expect(focusOf(app)).toBeNull();
  });

  // AC-43: the ERD gates read the overlay flag, so a document replaced under
  // the overlay has to lower the flag with the view or the ERD stays inert.
  it('comes down with the document replaced under it, and lowers the flag the ERD gates read', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);
    expect(app.store.state.editor.openMap[Open.focus]).toBe(true);

    app.store.dispatchSync(clearAction());
    await settle();

    expect(focusOf(app)).toBeNull();
    expect(overlayOf(mounted)).toBeNull();
    expect(focusStage()).toBeUndefined();
    expect(app.store.state.editor.openMap[Open.focus]).toBe(false);
  });

  it('closes a colour picker left open on the ERD as it comes up', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    const closeColorPicker = vi.fn();
    teardowns.push(app.emitter.on({ closeColorPicker }));

    await openOn(app, ['t1']);

    expect(closeColorPicker).toHaveBeenCalledWith(closeColorPickerAction());
  });

  it('is the one overlay, kept through every tab change under it (AC-34)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const overlay = overlayOf(mounted)!;
    const stage = focusStage();
    const root = mounted.container.querySelector('.root')!;
    const toasts = mounted.container.querySelector(
      `.${String(toastStyles.root)}`
    )!;

    expect(overlay.parentElement).toBe(root);
    expect(
      overlay.compareDocumentPosition(toasts) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    for (const value of [
      CanvasType.visualization,
      CanvasType.schemaSQL,
      CanvasType.generatorCode,
      CanvasType.settings,
      CanvasType.ERD,
    ]) {
      app.store.dispatchSync(changeCanvasTypeAction({ value }));
      await settle();

      expect(overlayOf(mounted)).toBe(overlay);
      expect(focusStage()).toBe(stage);
      expect(focusOf(app)).not.toBeNull();
    }
    // A tab change moves nothing the view shows, so it asks nothing more.
    expect(hoisted.requests).toHaveLength(1);
  });

  it('sizes the overlay to the viewport, which is the root less the toolbar', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    const overlay = overlayOf(mounted)!;
    expect(overlay.style.width).toBe(`${VIEWPORT.width}px`);
    expect(overlay.style.height).toBe(`${VIEWPORT.height}px`);

    app.store.dispatchSync(changeViewportAction({ width: 800, height: 500 }));
    await settle();

    expect(overlay.style.width).toBe('800px');
    expect(overlay.style.height).toBe('500px');
    expect(focusStage().width()).toBe(800);
    expect(focusStage().height()).toBe(500);
  });
});

describe('the provider boundary of the overlay (AC-72)', () => {
  it('provides the Focus source to the scene in its box alone, and leaves every root sibling on the document', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const root = mounted.container.querySelector<HTMLElement>('.root')!;

    // The scene leaves resolve the view: its tables at the view points ELK
    // landed them on, the key rows alone, and nothing the view leaves out.
    const landing = landingOf(['t1', 't2']);
    expect(drawnTableIds()).toEqual(['t1', 't2']);
    expect(tableOf('t1')!.position()).toEqual(landing.t1);
    expect(tableOf('t2')!.position()).toEqual(landing.t2);
    expect(rowCountOf('t1')).toBe(1);
    expect(focusStage().find('.memo')).toHaveLength(0);

    // The siblings, mounted before and after the overlay, keep the default.
    expect(probeSourceOf(root, 'before')).toBe('document');
    expect(probeSourceOf(root, 'after')).toBe('document');

    // Resolved now, with the provider up: a probe beside the overlay is on
    // the document, and one inside the scene box is in the view.
    expect(probeInto(root, 'late-beside')).toBe('document');
    expect(probeInto(sceneBoxOf(mounted), 'late-inside')).toBe('focus');
    expect(barOf(mounted).closest(`.${String(erdStyles.root)}`)).toBeNull();
  });

  it('takes the undo, redo and time travel off the toolbar while it is up, as every panel over the ERD does', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    const undoRedo = () =>
      mounted.container.querySelectorAll('.toolbar .undo-redo');
    expect(undoRedo()).toHaveLength(3);

    await openOn(app, ['t1']);
    expect(undoRedo()).toHaveLength(0);

    click(menuStartingWith(mounted, 'Close'));
    await settle();
    expect(undoRedo()).toHaveLength(3);
  });

  it('lets the toolbar beside it show the Focus zoom, read off the active view rather than any provider', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    click(menuOf(mounted, 'Fit'));
    await settle();

    const { zoomLevel } = focusOf(app)!;
    const input = mounted.container.querySelector<HTMLInputElement>(
      '.toolbar input[title="zoom level"]'
    )!;

    expect(zoomLevel).not.toBe(1);
    expect(input.value).toBe(toZoomFormat(zoomLevel));
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });
});

describe('the placement of the view', () => {
  it('shows one center, its neighbours a hop out and the connectors between them, and nothing else (AC-22)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    await openOn(app, ['t1']);

    expect(drawnTableIds()).toEqual(['t1', 't2']);
    expect(drawnConnectorIds(['r12', 'r23'])).toEqual(['r12']);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2']));
  });

  it('asks ELK for what it shows, at the size the key rows draw it, under the preset liam places with (AC-32)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const { state } = app.store;

    expect(hoisted.requests).toHaveLength(1);
    const [request] = hoisted.requests;
    expect(request.placement).toBe(TablePlacement.liamLayered);
    expect(request.nodes.map(node => node.id)).toEqual(['t1', 't2']);
    expect(request.nodes.every(node => !node.children)).toBe(true);
    expect(request.edges.map(({ source, target }) => [source, target])).toEqual(
      [['t1', 't2']]
    );

    const t1 = state.collections.tableEntities.t1;
    expect(request.nodes[0].height).toBe(
      getTableRect(state, t1, 'focus').height
    );
    expect(request.nodes[0].height).toBeLessThan(
      getTableRect(state, t1).height
    );
  });

  it('shows the union of what several centers reach (AC-24)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    await openOn(app, ['t1', 't4']);

    expect(drawnTableIds()).toEqual(['t1', 't2', 't4']);
    expect(drawnConnectorIds(['r12', 'r23'])).toEqual(['r12']);
    expect(hoisted.requests[0].nodes.map(node => node.id)).toEqual([
      't1',
      't2',
      't4',
    ]);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't4']));
  });

  it('fits what it shows into the screen below the bar as it opens (AC-25)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    await openOn(app, ['t1', 't4']);

    const { content, topLeft, bottomRight } = shownCornersOf(app);
    expect(focusOf(app)!.zoomLevel).toBe(
      previewZoomLevel(content, SCREEN, CANVAS_ZOOM_MAX)
    );
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(topLeft.y).toBeGreaterThanOrEqual(FOCUS_BAR_HEIGHT);
    expect(bottomRight.x).toBeLessThanOrEqual(VIEWPORT.width);
    expect(bottomRight.y).toBeLessThanOrEqual(VIEWPORT.height);
    expect(app.store.state.settings).toMatchObject({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
    });
  });

  it('lights the type cells of the centers and their hop, and of the hovered table and its hop (AC-27)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    click(menuOf(mounted, '2 hops'));
    await settle();
    expect(drawnTableIds()).toEqual(['t1', 't2', 't3']);
    expect(typeOpacityOf('t1')).toEqual([1]);
    expect(typeOpacityOf('t2')).toEqual([1]);
    expect(typeOpacityOf('t3')).toEqual([0]);

    await hoverTable('t3');

    expect(typeOpacityOf('t3')).toEqual([1]);
    expect(typeOpacityOf('t2')).toEqual([1]);
  });

  it('places the view again when an edit changes what a center reaches, and not when it does not (AC-13)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    await openOn(app, ['t1']);
    expect(hoisted.requests).toHaveLength(1);

    app.store.dispatchSync(shared(link('r14', 't1', 't4')));
    await settle();

    expect(drawnTableIds()).toEqual(['t1', 't2', 't4']);
    expect(hoisted.requests).toHaveLength(2);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't4']));

    app.store.dispatchSync(shared(removeRelationshipAction({ id: 'r12' })));
    await settle();

    expect(drawnTableIds()).toEqual(['t1', 't4']);
    expect(hoisted.requests).toHaveLength(3);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't4']));

    app.store.dispatchSync(
      shared(changeTableNameAction({ id: 't2', value: 'sales' }))
    );
    await settle();
    expect(hoisted.requests).toHaveLength(3);
  });

  it('places the view anew on Tidy up, dropping what a drag moved (AC-31)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const landing = landingOf(['t1', 't2']);

    app.store.dispatchSync(
      viewMoveTableAction({
        ids: ['t2'],
        movementX: 120,
        movementY: 60,
        kind: ViewKind.focus,
      })
    );
    await settle();
    expect(positionsOf(app).t2).toEqual({
      x: landing.t2.x + 120,
      y: landing.t2.y + 60,
    });
    expect(hoisted.requests).toHaveLength(1);

    click(menuOf(mounted, 'Tidy Up'));
    await settle();

    expect(hoisted.requests).toHaveLength(2);
    expect(positionsOf(app)).toEqual(landing);
    expect(tableOf('t2')!.position()).toEqual(landing.t2);
  });

  it('lands nothing from an ask still out when the overlay comes down before the answer', async () => {
    const app = createTestAppContext();
    seed(app);
    hoisted.hold = true;
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);
    expect(hoisted.requests).toHaveLength(1);
    expect(positionsOf(app)).toEqual({});

    click(menuStartingWith(mounted, 'Close'));
    await settle();
    expect(overlayOf(mounted)).toBeNull();

    hoisted.release.shift()?.();
    await settle();

    expect(focusOf(app)).toBeNull();
    expect(overlayOf(mounted)).toBeNull();
  });
});

describe('the bar over the overlay', () => {
  // The rule that sets them down is pinned in FocusView.styles.test.ts; what
  // the DOM has to hold is the three hooks it names, as children of the box.
  it('has the map, its frame and its handle as children of the scene box, where the bar rule sets them down', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const box = sceneBoxOf(mounted);

    expect(box.className).toContain(String(styles.scene));
    for (const name of ['minimap', 'minimap-border', 'minimap-viewport']) {
      expect(box.querySelector(`:scope > .${name}`), name).not.toBeNull();
    }
  });

  it('names the centers and counts the neighbours, and follows the reach', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    expect(barOf(mounted).querySelector('.focus-centers')!.textContent).toBe(
      'users'
    );
    expect(barOf(mounted).querySelector('.focus-neighbours')!.textContent).toBe(
      '1 neighbour'
    );

    app.store.dispatchSync(
      viewSetCentersAction({ tableIds: ['t1', 't2', 't3'] })
    );
    await settle();

    expect(barOf(mounted).querySelector('.focus-centers')!.textContent).toBe(
      'users and 2 more'
    );
    expect(barOf(mounted).querySelector('.focus-neighbours')!.textContent).toBe(
      '0 neighbours'
    );
  });

  it('widens the reach to two hops and back, and the scene follows (AC-23)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    expect(menuOf(mounted, '1 hop').className).toContain('active');
    expect(drawnTableIds()).toEqual(['t1', 't2']);

    // The reach it already has: nothing placed anew.
    click(menuOf(mounted, '1 hop'));
    await settle();
    expect(hoisted.requests).toHaveLength(1);

    click(menuOf(mounted, '2 hops'));
    await settle();

    expect(focusOf(app)!.hop).toBe(2);
    expect(menuOf(mounted, '2 hops').className).toContain('active');
    expect(menuOf(mounted, '1 hop').className).not.toContain('active');
    expect(drawnTableIds()).toEqual(['t1', 't2', 't3']);
    expect(barOf(mounted).querySelector('.focus-neighbours')!.textContent).toBe(
      '2 neighbours'
    );
    // The reach placed anew, and fitted, over the three it now shows.
    expect(hoisted.requests).toHaveLength(2);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't3']));

    click(menuOf(mounted, '1 hop'));
    await settle();

    expect(focusOf(app)!.hop).toBe(1);
    expect(drawnTableIds()).toEqual(['t1', 't2']);
    expect(hoisted.requests).toHaveLength(3);
  });

  it('opens on the key rows and toggles to every field and back (AC-26)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    expect(focusOf(app)!.showMode).toBe(ShowMode.keysOnly);
    expect(menuOf(mounted, 'Keys only').className).toContain('active');
    expect(rowCountOf('t1')).toBe(1);

    // The rows it already shows: nothing placed anew.
    click(menuOf(mounted, 'Keys only'));
    await settle();
    expect(hoisted.requests).toHaveLength(1);

    click(menuOf(mounted, 'All fields'));
    await settle();

    expect(focusOf(app)!.showMode).toBe(ShowMode.allFields);
    expect(menuOf(mounted, 'All fields').className).toContain('active');
    expect(rowCountOf('t1')).toBe(2);

    click(menuOf(mounted, 'Keys only'));
    await settle();

    expect(focusOf(app)!.showMode).toBe(ShowMode.keysOnly);
    expect(rowCountOf('t1')).toBe(1);
  });

  it('walks the trail back and forward, and is disabled at either end (AC-52)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    expect(menuOf(mounted, 'Back').className).toContain('disabled');
    expect(menuOf(mounted, 'Forward').className).toContain('disabled');

    click(menuOf(mounted, 'Back'));
    await settle();
    expect(focusOf(app)!.history.cursor).toBe(0);

    app.store.dispatchSync(
      viewSetCentersAction({ tableIds: ['t2'], push: true })
    );
    await settle();

    expect(menuOf(mounted, 'Back').className).not.toContain('disabled');
    expect(menuOf(mounted, 'Forward').className).toContain('disabled');

    click(menuOf(mounted, 'Back'));
    await settle();

    expect(focusOf(app)!.centerIds).toEqual(['t1']);
    expect(focusOf(app)!.history.cursor).toBe(0);
    expect(menuOf(mounted, 'Back').className).toContain('disabled');
    expect(menuOf(mounted, 'Forward').className).not.toContain('disabled');

    click(menuOf(mounted, 'Forward'));
    await settle();

    expect(focusOf(app)!.centerIds).toEqual(['t2']);
    expect(focusOf(app)!.history.cursor).toBe(1);
  });

  it('fits what the view shows into the screen at the zoom the view allows', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const {
      originX,
      originY,
      zoomLevel: documentZoom,
    } = app.store.state.settings;

    click(menuOf(mounted, 'Fit'));
    await settle();

    const view = focusOf(app)!;
    const content = getSceneContentRect(app.store.state, 'focus')!;
    const centre = toScreenPoint(view, {
      x: content.x + content.width / 2,
      y: content.y + content.height / 2,
    });

    expect(view.zoomLevel).toBe(
      previewZoomLevel(content, SCREEN, CANVAS_ZOOM_MAX)
    );
    expect(centre.x).toBeCloseTo(SCREEN.width / 2, 3);
    expect(centre.y).toBeCloseTo(FOCUS_BAR_HEIGHT + SCREEN.height / 2, 3);
    expect(app.store.state.settings).toMatchObject({
      originX,
      originY,
      zoomLevel: documentZoom,
    });
  });

  it('keeps the reach, the rows and the trail through a Tidy up', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    click(menuOf(mounted, '2 hops'));
    click(menuOf(mounted, 'All fields'));
    app.store.dispatchSync(
      viewSetCentersAction({ tableIds: ['t2'], push: true })
    );
    await settle();
    const view = focusOf(app)!;

    click(menuOf(mounted, 'Tidy Up'));
    await settle();

    expect(focusOf(app)).toBe(view);
    expect(view).toMatchObject({
      centerIds: ['t2'],
      hop: 2,
      showMode: ShowMode.allFields,
      history: { entries: [['t1'], ['t2']], cursor: 1 },
    });
  });
});

describe('the walk through the view', () => {
  it('makes a clicked neighbour the one center, and places and fits what it reaches (AC-28)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const before = focusOf(app)!.zoomLevel;

    await clickTable('t2');

    const view = focusOf(app)!;
    expect(view.centerIds).toEqual(['t2']);
    expect(view.history).toEqual({ entries: [['t1'], ['t2']], cursor: 1 });
    expect(drawnTableIds()).toEqual(['t1', 't2', 't3']);
    expect(hoisted.requests).toHaveLength(2);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't3']));

    const { content, topLeft, bottomRight } = shownCornersOf(app);
    expect(view.zoomLevel).toBe(
      previewZoomLevel(content, SCREEN, CANVAS_ZOOM_MAX)
    );
    expect(view.zoomLevel).not.toBe(before);
    expect(topLeft.y).toBeGreaterThanOrEqual(FOCUS_BAR_HEIGHT);
    expect(bottomRight.x).toBeLessThanOrEqual(VIEWPORT.width);
    expect(app.store.state.settings).toMatchObject({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
    });
  });

  it('stands on a click of its one center, a click with the modifier or another button, or a press that dragged', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const landing = landingOf(['t1', 't2']);

    await clickTable('t1');
    expect(focusOf(app)!.centerIds).toEqual(['t1']);
    expect(focusOf(app)!.history.entries).toEqual([['t1']]);

    await clickTable('t2', { ctrlKey: true, metaKey: true });
    expect(focusOf(app)!.centerIds).toEqual(['t1']);

    await clickTable('t2', { button: 2 });
    await clickTable('t2', { button: 1 });
    expect(focusOf(app)!.centerIds).toEqual(['t1']);
    expect(focusOf(app)!.history.entries).toEqual([['t1']]);

    const node = tableOf('t2')!;
    fireScenePointer(node, 'mousedown', { clientX: 10, clientY: 10 });
    movePointer(60, 40);
    fireScenePointer(node, 'mouseup', { clientX: 60, clientY: 40 });
    await settle();

    expect(focusOf(app)!.centerIds).toEqual(['t1']);
    expect(positionsOf(app).t2).not.toEqual(landing.t2);
    expect(hoisted.requests).toHaveLength(1);

    // A press the view closed under, lifted on the view opened next, walks nowhere.
    fireScenePointer(tableOf('t2')!, 'mousedown', { clientX: 10, clientY: 10 });
    await settle();
    chord(app, KeyBindingName.stop);
    await settle();
    await openOn(app, ['t1']);
    fireScenePointer(tableOf('t2')!, 'mouseup', { clientX: 10, clientY: 10 });
    await settle();

    expect(focusOf(app)!.centerIds).toEqual(['t1']);
    expect(focusOf(app)!.history.entries).toEqual([['t1']]);
  });

  it('walks back to the centers it stood on, all of them, and forward again, placing each (AC-29, AC-46)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1', 't3', 't4']);
    expect(drawnTableIds()).toEqual(['t1', 't2', 't3', 't4']);

    await clickTable('t2');
    expect(focusOf(app)!.centerIds).toEqual(['t2']);
    expect(drawnTableIds()).toEqual(['t1', 't2', 't3']);
    expect(hoisted.requests).toHaveLength(2);

    click(menuOf(mounted, 'Back'));
    await settle();

    expect(focusOf(app)!.centerIds).toEqual(['t1', 't3', 't4']);
    expect(drawnTableIds()).toEqual(['t1', 't2', 't3', 't4']);
    expect(hoisted.requests).toHaveLength(3);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't3', 't4']));
    expect(menuOf(mounted, 'Forward').className).not.toContain('disabled');

    click(menuOf(mounted, 'Forward'));
    await settle();

    expect(focusOf(app)!.centerIds).toEqual(['t2']);
    expect(drawnTableIds()).toEqual(['t1', 't2', 't3']);
    expect(hoisted.requests).toHaveLength(4);
  });
});

describe('the way out of the view', () => {
  /** Scrolls the document so that no table is on screen, since a center that is stays where it is on the way out. */
  const AWAY = { originX: -3000, originY: -3000 };

  it('leaves for the ERD tab on the stop chord with the last center selected in the middle of the screen, at the zoom the document had (AC-35, AC-39)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    app.store.dispatchSync(
      changeZoomLevelAction({ value: 0.8 }),
      scrollToAction(AWAY)
    );
    await openOn(app, ['t1']);
    await clickTable('t2');
    expect(focusOf(app)!.centerIds).toEqual(['t2']);

    chord(app, KeyBindingName.stop);
    await settle();

    const { state } = app.store;
    expect(overlayOf(mounted)).toBeNull();
    expect(focusStage()).toBeUndefined();
    expect(focusOf(app)).toBeNull();
    expect(state.settings.canvasType).toBe(CanvasType.ERD);
    expect(state.settings.zoomLevel).toBe(0.8);
    expect(Object.keys(state.editor.selectedMap)).toEqual(['t2']);

    const rect = getTableRect(state, state.collections.tableEntities.t2);
    const centre = toScreenPoint(state.settings, {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    expect(centre.x).toBeCloseTo(VIEWPORT.width / 2, 3);
    expect(centre.y).toBeCloseTo(VIEWPORT.height / 2, 3);
  });

  it('leaves the same way from the close button, and from any other tab', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization }),
      scrollToAction(AWAY)
    );
    await openOn(app, ['t3']);

    click(menuStartingWith(mounted, 'Close'));
    await settle();

    const { state } = app.store;
    expect(overlayOf(mounted)).toBeNull();
    expect(state.settings.canvasType).toBe(CanvasType.ERD);
    expect(state.settings.zoomLevel).toBe(1);
    expect(Object.keys(state.editor.selectedMap)).toEqual(['t3']);
    expect(state.settings.originX).not.toBe(AWAY.originX);
  });

  it('leaves a center still on screen where it stands, and the document with it (AC-40)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);

    chord(app, KeyBindingName.stop);
    await settle();

    const { state } = app.store;
    expect(overlayOf(mounted)).toBeNull();
    expect(Object.keys(state.editor.selectedMap)).toEqual(['t1']);
    expect(state.settings).toMatchObject({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
    });
  });
});

describe('the gestures on the overlay', () => {
  // The ERD's zoom chords are gated off under the overlay, and the plan has
  // the keyboard zoom land in the view, so the overlay takes the chords itself.
  it('zooms the Focus view on the zoom chords, and the document not at all', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const document = { ...app.store.state.settings };
    const fitted = focusOf(app)!.zoomLevel;

    chord(app, KeyBindingName.zoomIn);
    chord(app, KeyBindingName.zoomIn);
    await settle();
    expect(focusOf(app)!.zoomLevel).toBeCloseTo(fitted + 0.08, 5);

    chord(app, KeyBindingName.zoomOut);
    await settle();
    expect(focusOf(app)!.zoomLevel).toBeCloseTo(fitted + 0.04, 5);

    chord(app, KeyBindingName.zoomReset);
    await settle();
    expect(focusOf(app)!.zoomLevel).toBe(1);

    expect(app.store.state.settings).toMatchObject({
      zoomLevel: document.zoomLevel,
      originX: document.originX,
      originY: document.originY,
    });
  });

  it('zooms the Focus view on a wheel over its box, and the document not at all (AC-7 half)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditorRoot(app);
    await openOn(app, ['t1']);
    const before = focusOf(app)!.zoomLevel;
    const box = sceneBoxOf(mounted);
    const rect = box.getBoundingClientRect();

    box.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 100,
        clientY: rect.top + 100,
        deltaY: -100,
      })
    );
    await settle();

    expect(focusOf(app)!.zoomLevel).toBeGreaterThan(before);
    expect(app.store.state.settings.zoomLevel).toBe(1);
    expect(app.store.state.settings).toMatchObject({ originX: 0, originY: 0 });
  });
});
