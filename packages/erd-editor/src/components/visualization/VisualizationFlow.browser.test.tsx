// The Flow mode of the visualization tab: the mode kept for the session, every
// table as a name box placed once by ELK and kept across a tab leave, a drag
// that never reaches that landing, and the hover that fades the rest.

import { type AnyAction, useProvider } from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Layer } from 'konva/lib/Layer';
import type { Rect } from 'konva/lib/shapes/Rect';
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
  releasePointer,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  PARTICLE_COUNT,
  PARTICLE_EDGE_MAX,
} from '@/components/focus-view/particles/particlePath';
import { themeContext } from '@/components/themeContext';
import Visualization from '@/components/visualization/Visualization';
import { TABLE_BORDER } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType } from '@/constants/schema';
import { TablePlacement } from '@/constants/tablePlacement';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ViewKind, VisualizationMode } from '@/engine/modules/editor/state';
import { viewMoveTableAction } from '@/engine/modules/editor/view.actions';
import {
  closeFocusViewAction$,
  openFocusViewAction$,
} from '@/engine/modules/editor/view.generator.actions';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { Tag } from '@/engine/tag';
import { whenDrawn } from '@/konva/batchDraw';
import { DIM_OPACITY } from '@/konva/scene/viewLayout';
import { getSceneTransform, toScenePoint } from '@/konva/scene/viewport';
import { calcTableHeight } from '@/utils/calcTable';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const hoisted = vi.hoisted(() => ({
  requests: [] as Array<{ placement: string; nodes: any[] }>,
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
  const flatten = (nodes: any[]): any[] =>
    nodes.flatMap(node =>
      node.children?.length ? flatten(node.children) : [node]
    );

  return {
    ...actual,
    createElkLayout: (request: any) => {
      hoisted.requests.push(request);
      const points = flatten(request.nodes).map((node, index) => ({
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

const VIEWPORT = { width: 1000, height: 600 };

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  hoisted.requests.splice(0);
  hoisted.hold = false;
  hoisted.release.splice(0);
  await whenDrawn();
});

const stageRegistry = (): Record<string, Stage> =>
  Reflect.get(globalThis, '__erdStages') ?? {};

const graphStage = () => stageRegistry().visualization;

const flowStage = () => stageRegistry().canvas;

const link = (id: string, start: string, end: string) =>
  addRelationshipAction({
    id,
    relationshipType: RelationshipType.ZeroN,
    start: { tableId: start, columnIds: [] },
    end: { tableId: end, columnIds: [] },
  });

/**
 * A chain a - b - c and a table d nothing reaches, spread far apart in the
 * document so a Flow drawn there would be nothing like the row ELK answers,
 * with a carrying rows a name box must not draw.
 */
function seed(app: AppContext) {
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableAction({ id: 'a', ui: { x: 0, y: 0, zIndex: 1 } }),
    addTableAction({ id: 'b', ui: { x: 5000, y: 5000, zIndex: 2 } }),
    addTableAction({ id: 'c', ui: { x: 100, y: 900, zIndex: 3 } }),
    addTableAction({ id: 'd', ui: { x: 2000, y: 0, zIndex: 4 } }),
    changeTableNameAction({ id: 'a', value: 'users' }),
    changeTableNameAction({ id: 'b', value: 'orders' }),
    changeTableNameAction({ id: 'c', value: 'items' }),
    changeTableNameAction({ id: 'd', value: 'logs' }),
    addColumnAction({ id: 'a1', tableId: 'a' }),
    addColumnAction({ id: 'a2', tableId: 'a' }),
    addColumnAction({ id: 'a3', tableId: 'a' }),
    link('ab', 'a', 'b'),
    link('bc', 'b', 'c')
  );
}

async function mountVisualization(
  app = createTestAppContext()
): Promise<Mounted> {
  app.store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization })
  );
  const mounted = mount(<Visualization />, app);
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  await settle();

  const teardown = () => {
    mounted.unmount();
    themeProvider.destroy();
  };
  teardowns.push(teardown);

  return {
    ...mounted,
    unmount: () => {
      const at = teardowns.indexOf(teardown);
      if (at !== -1) teardowns.splice(at, 1);
      teardown();
    },
  };
}

/** Two rounds: the layout lands in a microtask after the first, and the fit after it. */
const settle = async () => {
  await flush();
  await whenDrawn();
  await flush();
  await whenDrawn();
};

const menuOf = (mounted: Mounted, title: string) =>
  mounted.container.querySelector<HTMLElement>(
    `.visualization-toolbar [title="${title}"]`
  );

const click = (el: Element | null) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

async function enterFlow(mounted: Mounted) {
  click(menuOf(mounted, 'Flow'));
  await settle();
}

/** Leaves the tab and comes back, which unmounts the tab and mounts it again on the same store. */
async function leaveAndReturn(mounted: Mounted): Promise<Mounted> {
  const { app } = mounted;
  mounted.unmount();
  app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
  await flush();

  return mountVisualization(app);
}

const tableOf = (id: string) =>
  flowStage().findOne<Group>(`#table-${id}`) as Group | undefined;

const bodyOf = (id: string) =>
  tableOf(id)!.findOne<Rect>('.table-body') as Rect;

const connectorOf = (id: string) =>
  flowStage().findOne<Group>(`.${id}`) as Group;

const particleLayer = () =>
  flowStage().findOne<Layer>('.view-particles') as Layer;

/** The connectors carrying particles, by the id each group of six is named with. */
const particleIdsOf = () =>
  particleLayer()
    .find<Group>('.particle-edge')
    .map(group => group.name().replace('particle-edge ', ''))
    .sort();

/** A document edit the way a peer's arrives, which is the one way an edit reaches the store under a view. */
const shared = (action: AnyAction): AnyAction => ({
  ...action,
  tags: Tag.shared,
});

/** A plain copy of where the view stands each table, read off the observable. */
const positionsOf = (app: AppContext) => {
  const positions = app.store.state.editor.views.flow?.positions;
  if (!positions) return null;

  return Object.fromEntries(
    Object.entries(positions).map(([id, { x, y }]) => [id, { x, y }])
  );
};

/** Every table a request carries, the ones inside the group of unrelated tables included. */
const tableIdsOf = ({ nodes }: { nodes: any[] }): string[] => {
  const walk = (given: any[]): string[] =>
    given.flatMap(node =>
      node.children?.length ? walk(node.children) : [node.id]
    );

  return walk(nodes);
};

/**
 * A press and a lift on the same point of a box, the click the scene reads as
 * one. The node is looked up again for the lift, since the press selects the
 * table and the scene rebuilds it on another layer before the release lands.
 */
async function clickTable(id: string, init: MouseEventInit = {}) {
  const at = { clientX: 10, clientY: 10, ...init };

  fireScenePointer(bodyOf(id), 'mousedown', at);
  await settle();
  fireScenePointer(bodyOf(id), 'mouseup', at);
  await settle();
}

const flowRootOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>('[data-testid="erd-canvas"]')!;

describe('the Flow mode of the visualization tab', () => {
  it('opens on Graph, keeps Flow across a leave and a return, and a new session opens on Graph again', async () => {
    const app = createTestAppContext();
    seed(app);
    let mounted = await mountVisualization(app);

    expect(app.store.state.editor.visualizationMode).toBe(
      VisualizationMode.graph
    );
    expect(graphStage()).toBeDefined();
    expect(flowStage()).toBeUndefined();
    expect(menuOf(mounted, 'Graph')?.className).toContain('active');
    expect(menuOf(mounted, 'Fit')).toBeNull();

    await enterFlow(mounted);

    expect(app.store.state.editor.visualizationMode).toBe(
      VisualizationMode.flow
    );
    expect(graphStage()).toBeUndefined();
    expect(flowStage()).toBeDefined();
    expect(menuOf(mounted, 'Flow')?.className).toContain('active');
    expect(menuOf(mounted, 'Fit')).not.toBeNull();
    expect(menuOf(mounted, 'Tidy Up')).not.toBeNull();

    mounted = await leaveAndReturn(mounted);

    expect(app.store.state.editor.visualizationMode).toBe(
      VisualizationMode.flow
    );
    expect(flowStage()).toBeDefined();
    expect(graphStage()).toBeUndefined();

    click(menuOf(mounted, 'Graph'));
    await settle();
    expect(graphStage()).toBeDefined();
    expect(flowStage()).toBeUndefined();

    const fresh = createTestAppContext();
    seed(fresh);
    mounted.unmount();
    await mountVisualization(fresh);

    expect(fresh.store.state.editor.visualizationMode).toBe(
      VisualizationMode.graph
    );
    expect(graphStage()).toBeDefined();
  });

  it('draws every table as a name box the height of its header', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountVisualization(app);
    await enterFlow(mounted);

    const drawn = flowStage()
      .find<Group>('.table')
      .map(node => node.id())
      .sort();
    expect(drawn).toEqual(['table-a', 'table-b', 'table-c', 'table-d']);
    expect(flowStage().find('.column-row')).toHaveLength(0);

    for (const id of ['a', 'b', 'c', 'd']) {
      const table = app.store.state.collections.tableEntities[id];
      expect({ id, height: bodyOf(id).height() + TABLE_BORDER }).toEqual({
        id,
        height: calcTableHeight(table, 0),
      });
    }
    expect(bodyOf('a').height()).toBe(bodyOf('d').height());
  });

  it('asks ELK once on entry, and nothing on a return to the tab, standing where it stood', async () => {
    const app = createTestAppContext();
    seed(app);
    let mounted = await mountVisualization(app);
    expect(hoisted.requests).toHaveLength(0);

    await enterFlow(mounted);

    expect(hoisted.requests).toHaveLength(1);
    expect(hoisted.requests[0].placement).toBe(TablePlacement.liamLayered);
    const landed = positionsOf(app);
    expect(Object.keys(landed ?? {}).sort()).toEqual(['a', 'b', 'c', 'd']);
    // Where ELK put them rather than where the document has them.
    expect(landed?.b).not.toEqual({ x: 5000, y: 5000 });

    // Moved off the landing first, so standing there again is something the
    // return has to do rather than something nothing disturbed.
    app.store.dispatchSync(
      viewMoveTableAction({
        kind: ViewKind.flow,
        ids: ['b'],
        movementX: 70,
        movementY: -30,
      })
    );
    expect(positionsOf(app)).not.toEqual(landed);

    mounted = await leaveAndReturn(mounted);

    expect(hoisted.requests).toHaveLength(1);
    expect(positionsOf(app)).toEqual(landed);
    expect(tableOf('b')).toBeDefined();
  });

  it('asks nothing more on a leave and a return while the first answer is still out', async () => {
    const app = createTestAppContext();
    seed(app);
    hoisted.hold = true;
    let mounted = await mountVisualization(app);

    await enterFlow(mounted);
    expect(hoisted.requests).toHaveLength(1);
    expect(positionsOf(app)).toEqual({});

    mounted = await leaveAndReturn(mounted);
    expect(hoisted.requests).toHaveLength(1);

    hoisted.release.splice(0).forEach(release => release());
    await settle();

    expect(hoisted.requests).toHaveLength(1);
    expect(Object.keys(positionsOf(app) ?? {}).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(flowStage().find('.table')).toHaveLength(4);

    mounted = await leaveAndReturn(mounted);
    expect(hoisted.requests).toHaveLength(1);
  });

  it('asks again on a return to the tab once the ask was cancelled, and drops the cancelled answer', async () => {
    const app = createTestAppContext();
    seed(app);
    hoisted.hold = true;
    let mounted = await mountVisualization(app);

    await enterFlow(mounted);
    expect(hoisted.requests).toHaveLength(1);

    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });
    await flush();

    mounted = await leaveAndReturn(mounted);
    expect(hoisted.requests).toHaveLength(2);

    // The first answer, cancelled, lands nowhere; the second is the landing.
    hoisted.release.shift()?.();
    await settle();
    expect(positionsOf(app)).toEqual({});
    expect(flowStage().find('.table')).toHaveLength(0);

    hoisted.release.shift()?.();
    await settle();
    expect(Object.keys(positionsOf(app) ?? {}).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(flowStage().find('.table')).toHaveLength(4);
  });

  it('keeps the ask out through a stop chord that closes a Focus overlay over the tab', async () => {
    const app = createTestAppContext();
    seed(app);
    hoisted.hold = true;
    let mounted = await mountVisualization(app);

    await enterFlow(mounted);
    expect(hoisted.requests).toHaveLength(1);

    app.store.dispatchSync(openFocusViewAction$(['a']));
    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });
    await flush();
    app.store.dispatchSync(closeFocusViewAction$());
    await flush();

    // Still out: a return to the tab asks nothing more, and the answer lands.
    mounted = await leaveAndReturn(mounted);
    expect(hoisted.requests).toHaveLength(1);

    hoisted.release.shift()?.();
    await settle();
    expect(Object.keys(positionsOf(app) ?? {}).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('asks anew on a Tidy up while the first answer is out, and lands the later answer alone', async () => {
    const app = createTestAppContext();
    seed(app);
    hoisted.hold = true;
    let mounted = await mountVisualization(app);

    await enterFlow(mounted);
    expect(hoisted.requests).toHaveLength(1);

    mounted.unmount();
    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    app.store.dispatchSync(
      addTableAction({ id: 'e', ui: { x: 300, y: 300, zIndex: 5 } })
    );
    await flush();
    mounted = await mountVisualization(app);
    // The ask still out was made over another document, so the return takes
    // its place rather than joining it.
    expect(hoisted.requests).toHaveLength(2);

    click(menuOf(mounted, 'Tidy Up'));
    await settle();

    expect(hoisted.requests).toHaveLength(3);
    expect(tableIdsOf(hoisted.requests[2])).toContain('e');

    // The two earlier answers are earlier asks' and land nowhere.
    hoisted.release.shift()?.();
    hoisted.release.shift()?.();
    await settle();
    expect(positionsOf(app)).toEqual({});

    hoisted.release.shift()?.();
    await settle();
    expect(Object.keys(positionsOf(app) ?? {}).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(tableOf('e')).toBeDefined();
    expect(flowStage().find('.table')).toHaveLength(5);
  });

  it('fits the landing into the screen on the view alone', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountVisualization(app);
    await enterFlow(mounted);

    const view = app.store.state.editor.views.flow!;
    // The row is wider than the screen, so the fit zooms out to hold it.
    expect(view.zoomLevel).toBeLessThan(1);
    expect(view.originX).not.toBe(0);
    expect(app.store.state.settings.zoomLevel).toBe(1);
    expect(app.store.state.settings.originX).toBe(0);
    expect(app.store.state.settings.originY).toBe(0);
  });

  it('places a table added to the document on the return to the tab, and asks nothing while away', async () => {
    const app = createTestAppContext();
    seed(app);
    let mounted = await mountVisualization(app);
    await enterFlow(mounted);

    // Added from the ERD tab, where the document takes edits, in a dispatch
    // of its own: the tab is away and its loop is down, so nothing is asked
    // until the tab is back.
    mounted.unmount();
    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    app.store.dispatchSync(
      addTableAction({ id: 'e', ui: { x: 300, y: 300, zIndex: 5 } })
    );
    await flush();
    expect(app.store.state.doc.tableIds).toContain('e');
    expect(hoisted.requests).toHaveLength(1);

    const screen = {
      zoomLevel: app.store.state.editor.views.flow!.zoomLevel,
      originX: app.store.state.editor.views.flow!.originX,
      originY: app.store.state.editor.views.flow!.originY,
    };
    mounted = await mountVisualization(app);

    // The landing it kept was computed over the document as it was, so the
    // return asks again rather than standing back on it. The screen is the
    // reader's own by then, and nothing here is them asking to be moved.
    expect(hoisted.requests).toHaveLength(2);
    expect(tableOf('e')).toBeDefined();
    expect(flowStage().find('.table')).toHaveLength(5);
    expect(app.store.state.editor.views.flow!.zoomLevel).toBe(screen.zoomLevel);
    expect(app.store.state.editor.views.flow!.originX).toBe(screen.originX);
    expect(app.store.state.editor.views.flow!.originY).toBe(screen.originY);
  });

  it('stands a dragged table back on the landing on a return to the tab', async () => {
    const app = createTestAppContext();
    seed(app);
    let mounted = await mountVisualization(app);
    await enterFlow(mounted);
    const landed = positionsOf(app)!;
    const document = { ...app.store.state.collections.tableEntities.a.ui };

    fireScenePointer(bodyOf('a'), 'mousedown', { clientX: 100, clientY: 100 });
    movePointer(160, 180);
    releasePointer();
    await settle();

    const moved = positionsOf(app)!;
    expect(moved.a).not.toEqual(landed.a);
    expect(moved.b).toEqual(landed.b);
    expect(app.store.state.collections.tableEntities.a.ui.x).toBe(document.x);
    expect(app.store.state.collections.tableEntities.a.ui.y).toBe(document.y);

    mounted = await leaveAndReturn(mounted);

    expect(positionsOf(app)).toEqual(landed);
    expect(hoisted.requests).toHaveLength(1);
    expect(tableOf('a')!.x()).toBe(landed.a.x);
    expect(tableOf('a')!.y()).toBe(landed.a.y);
  });

  it('opens the Focus view on the box that was clicked (AC-20)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountVisualization(app);
    await enterFlow(mounted);
    const landed = positionsOf(app)!;

    await clickTable('a');

    expect(app.store.state.editor.views.focus?.centerIds).toEqual(['a']);
    expect(app.store.state.editor.openMap[Open.focus]).toBe(true);
    expect(app.store.state.editor.views.flow).not.toBeNull();
    expect(positionsOf(app)).toEqual(landed);
    expect(hoisted.requests).toHaveLength(1);
  });

  it('opens nothing on a drag of a box, or on a click carrying the modifier (AC-20)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountVisualization(app);
    await enterFlow(mounted);

    fireScenePointer(bodyOf('a'), 'mousedown', { clientX: 100, clientY: 100 });
    movePointer(160, 180);
    releasePointer();
    await settle();

    expect(app.store.state.editor.views.focus).toBeNull();

    await clickTable('b', { ctrlKey: true, metaKey: true });
    expect(app.store.state.editor.views.focus).toBeNull();
  });

  it('lights the hovered table, its neighbours and the connectors between, and fades the rest', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountVisualization(app);
    await enterFlow(mounted);

    const opacities = () => ({
      a: tableOf('a')!.opacity(),
      b: tableOf('b')!.opacity(),
      c: tableOf('c')!.opacity(),
      d: tableOf('d')!.opacity(),
      ab: connectorOf('ab').opacity(),
      bc: connectorOf('bc').opacity(),
    });

    expect(opacities()).toEqual({ a: 1, b: 1, c: 1, d: 1, ab: 1, bc: 1 });

    fireScenePointer(tableOf('a')!, 'mouseenter');
    await settle();

    expect(opacities()).toEqual({
      a: 1,
      b: 1,
      c: DIM_OPACITY,
      d: DIM_OPACITY,
      ab: 1,
      bc: DIM_OPACITY,
    });

    fireScenePointer(tableOf('a')!, 'mouseleave');
    fireScenePointer(tableOf('b')!, 'mouseenter');
    await settle();

    expect(opacities()).toEqual({
      a: 1,
      b: 1,
      c: 1,
      d: DIM_OPACITY,
      ab: 1,
      bc: 1,
    });

    fireScenePointer(tableOf('b')!, 'mouseleave');
    await settle();

    expect(opacities()).toEqual({ a: 1, b: 1, c: 1, d: 1, ab: 1, bc: 1 });
  });

  it('zooms the view about the pointer on a wheel, and the document not at all', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountVisualization(app);
    await enterFlow(mounted);
    const root = flowRootOf(mounted);
    const rect = root.getBoundingClientRect();
    const point = { x: 200, y: 150 };
    const before = toScenePoint(
      getSceneTransform(app.store.state, 'flow'),
      point
    );
    const zoomBefore = app.store.state.editor.views.flow!.zoomLevel;

    root.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
        deltaY: -100,
      })
    );
    await settle();

    const view = app.store.state.editor.views.flow!;
    expect(view.zoomLevel).toBeGreaterThan(zoomBefore);
    const after = toScenePoint(
      getSceneTransform(app.store.state, 'flow'),
      point
    );
    expect(after.x).toBeCloseTo(before.x, 2);
    expect(after.y).toBeCloseTo(before.y, 2);
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });

  it('pans the view on a drag over the background', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountVisualization(app);
    await enterFlow(mounted);
    const { originX, originY } = app.store.state.editor.views.flow!;
    const root = flowRootOf(mounted);
    const rect = root.getBoundingClientRect();

    root.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 900,
        clientY: rect.top + 500,
      })
    );
    movePointer(rect.left + 930, rect.top + 550);
    releasePointer();
    await settle();

    const view = app.store.state.editor.views.flow!;
    expect(view.originX).toBe(originX + 30);
    expect(view.originY).toBe(originY + 50);
    expect(app.store.state.settings.originX).toBe(0);
    expect(app.store.state.settings.originY).toBe(0);
  });

  it('runs particles on the connectors a hover lights, and none while nothing is hovered (AC-33)', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountVisualization(app);
    await enterFlow(mounted);
    await whenPainted();

    expect(particleLayer()).toBeDefined();
    expect(particleLayer().find('Circle')).toHaveLength(0);

    fireScenePointer(tableOf('a')!, 'mouseenter');
    await settle();
    await whenPainted();

    expect(particleIdsOf()).toEqual(['ab']);
    expect(particleLayer().find('Circle')).toHaveLength(PARTICLE_COUNT);

    fireScenePointer(tableOf('a')!, 'mouseleave');
    fireScenePointer(tableOf('b')!, 'mouseenter');
    await settle();
    await whenPainted();

    expect(particleIdsOf()).toEqual(['ab', 'bc']);
    expect(particleLayer().find('Circle')).toHaveLength(2 * PARTICLE_COUNT);

    fireScenePointer(tableOf('b')!, 'mouseleave');
    await settle();
    await whenPainted();

    expect(particleIdsOf()).toEqual([]);
    expect(particleLayer().find('Circle')).toHaveLength(0);
  });

  it('leaves the particles off past sixty lit connectors, and keeps the fade and the highlight (AC-51)', async () => {
    const app = createTestAppContext();
    const spokes = PARTICLE_EDGE_MAX + 1;
    const half = Math.floor(spokes / 2);
    const spoke = (index: number) => [
      addTableAction({ id: `s${index}`, ui: { x: 0, y: 0, zIndex: index } }),
      link(`r${index}`, 'hub', `s${index}`),
    ];
    // The hub and the lone table sit mid-row, where the fit leaves them
    // drawn, with the spokes spread to either side of them.
    app.store.dispatchSync(
      changeViewportAction(VIEWPORT),
      ...Array.from({ length: half }, (_, at) => spoke(at + 1)).flat(),
      addTableAction({ id: 'hub', ui: { x: 0, y: 0, zIndex: 100 } }),
      addTableAction({ id: 'lone', ui: { x: 0, y: 0, zIndex: 101 } }),
      ...Array.from({ length: spokes - half }, (_, at) =>
        spoke(half + at + 1)
      ).flat()
    );
    const mounted = await mountVisualization(app);
    await enterFlow(mounted);
    await whenPainted();

    fireScenePointer(tableOf('hub')!, 'mouseenter');
    await settle();
    await whenPainted();

    expect(particleLayer().find('Circle')).toHaveLength(0);
    expect(tableOf('lone')!.opacity()).toBe(DIM_OPACITY);
    expect(tableOf(`s${half}`)!.opacity()).toBe(1);
    expect(connectorOf(`r${half}`).opacity()).toBe(1);

    // One connector fewer is exactly the cap, and every one of them runs.
    app.store.dispatchSync(
      shared(removeRelationshipAction({ id: `r${spokes}` }))
    );
    await settle();
    await whenPainted();

    expect(particleIdsOf()).toHaveLength(PARTICLE_EDGE_MAX);
    expect(particleLayer().find('Circle')).toHaveLength(
      PARTICLE_EDGE_MAX * PARTICLE_COUNT
    );
    expect(tableOf('lone')!.opacity()).toBe(DIM_OPACITY);
  });
});
