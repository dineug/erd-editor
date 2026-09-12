// The placement of a Focus view: what it asks ELK for (AC-32), where the
// answer lands and the fit that follows (AC-25), the asks a walk, a reach, a
// show mode, a set change or a Tidy up make anew (AC-13, AC-28, AC-31), and the answers dropped.

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  cancelFocusLayout,
  createFocusLayoutRequest,
  isFocusLayoutPending,
  keepFocusPlaced,
  placeFocusView,
} from '@/components/focus-view/focusLayout';
import { FOCUS_BAR_HEIGHT } from '@/constants/layout';
import { CANVAS_ZOOM_MAX, RelationshipType } from '@/constants/schema';
import { TablePlacement } from '@/constants/tablePlacement';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ShowMode, ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeHopAction,
  viewChangeShowModeAction,
  viewHistoryMoveAction,
  viewMoveTableAction,
  viewScrollToAction,
  viewSetCentersAction,
  viewStreamScrollToAction,
  viewStreamZoomLevelAction,
} from '@/engine/modules/editor/view.actions';
import {
  closeFocusViewAction$,
  openFocusViewAction$,
} from '@/engine/modules/editor/view.generator.actions';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { Tag } from '@/engine/tag';
import { getSceneContentRect } from '@/konva/scene/contentBounds';
import { previewZoomLevel } from '@/konva/scene/fitZoom';
import { getTableRect } from '@/konva/scene/metrics';
import { getVisibleIds } from '@/konva/scene/viewLayout';
import {
  elkLayoutOptions,
  elkNodeLayoutOptions,
} from '@/services/elk-layout/elkLayoutOptions';

const hoisted = vi.hoisted(() => ({
  requests: [] as Array<{ placement: string; nodes: any[] }>,
  /** Set to hold the next answer back until the spec lets it go. */
  hold: false,
  /** Set to have the next answer fail instead. */
  fail: false,
  release: [] as Array<() => void>,
  /** What each ask handed over to be called once the wait has run long. */
  onSlow: [] as Array<(() => void) | undefined>,
}));

/** ELK stood in for by a row, so a request is something the spec can count and a landing something it can predict. */
vi.mock('@/services/elk-layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/elk-layout')>();

  return {
    ...actual,
    createElkLayout: (request: any, onSlow?: () => void) => {
      hoisted.requests.push(request);
      hoisted.onSlow.push(onSlow);
      if (hoisted.fail) {
        return Promise.reject(new Error('no answer'));
      }

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

/** The reach, spied on so a spec can tell which batches were read for what they show. */
vi.mock('@/konva/scene/viewLayout', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/konva/scene/viewLayout')>();

  return { ...actual, getVisibleIds: vi.fn(actual.getVisibleIds) };
});

const VIEWPORT = { width: 1000, height: 600 };

const SCREEN = {
  width: VIEWPORT.width,
  height: VIEWPORT.height - FOCUS_BAR_HEIGHT,
};

const apps: AppContext[] = [];

afterEach(() => {
  apps.splice(0).forEach(app => app.store.destroy());
  hoisted.requests.splice(0);
  hoisted.hold = false;
  hoisted.fail = false;
  hoisted.release.splice(0);
  hoisted.onSlow.splice(0);
});

const link = (id: string, start: string, end: string) =>
  addRelationshipAction({
    id,
    relationshipType: RelationshipType.ZeroN,
    start: { tableId: start, columnIds: [] },
    end: { tableId: end, columnIds: [] },
  });

/** A chain t1 - t2 - t3 and a table t4 nothing reaches, with a key on t1 so its key rows are fewer than all of them. */
function seed(): AppContext {
  const app = createTestAppContext();
  apps.push(app);
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 1 } }),
    addTableAction({ id: 't2', ui: { x: 700, y: 100, zIndex: 2 } }),
    addTableAction({ id: 't3', ui: { x: 400, y: 400, zIndex: 3 } }),
    addTableAction({ id: 't4', ui: { x: 1300, y: 100, zIndex: 4 } }),
    addColumnAction({ id: 'c1', tableId: 't1' }),
    addColumnAction({ id: 'c2', tableId: 't1' }),
    changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true }),
    link('r12', 't1', 't2'),
    link('r23', 't2', 't3')
  );

  return app;
}

/** A document edit the way a peer's arrives, which is the one way an edit reaches the store under a view. */
const shared = (action: AnyAction): AnyAction => ({
  ...action,
  tags: Tag.shared,
});

const focusOf = (app: AppContext) => app.store.state.editor.views.focus;

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

const documentPlacement = (app: AppContext) => {
  const { originX, originY, zoomLevel } = app.store.state.settings;
  return { originX, originY, zoomLevel };
};

describe('createFocusLayoutRequest (AC-32)', () => {
  it('asks for the tables the view reaches in document order, at the size the key rows draw them, under the preset liam places with', () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t2']));
    const { state } = app.store;

    const request = createFocusLayoutRequest(state);

    expect(request.placement).toBe(TablePlacement.liamLayered);
    expect(request.nodes.map(node => node.id)).toEqual(['t1', 't2', 't3']);
    expect(request.nodes.every(node => !node.children)).toBe(true);
    expect(request.edges).toEqual([
      { source: 't1', target: 't2', sourceRow: -1, targetRow: -1 },
      { source: 't2', target: 't3', sourceRow: -1, targetRow: -1 },
    ]);

    const t1 = state.collections.tableEntities.t1;
    expect(request.nodes[0].height).toBe(
      getTableRect(state, t1, 'focus').height
    );
    expect(request.nodes[0].height).toBeLessThan(
      getTableRect(state, t1).height
    );
  });

  it('is placed with the options liam hands ELK, option for option, and the node aligned left', () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));

    const { placement } = createFocusLayoutRequest(app.store.state);

    expect(elkLayoutOptions(placement)).toEqual({
      'elk.algorithm': 'layered',
      'elk.layered.spacing.baseValue': '40',
      'elk.spacing.componentComponent': '80',
      'elk.layered.spacing.edgeNodeBetweenLayers': '120',
      'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
      'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
      'elk.layered.mergeEdges': 'true',
      'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
      'elk.layered.layering.strategy': 'INTERACTIVE',
    });
    expect(elkNodeLayoutOptions(placement)).toEqual({
      'elk.alignment': 'LEFT',
    });
  });

  it('asks for nothing with no view open', () => {
    const app = seed();

    expect(createFocusLayoutRequest(app.store.state).nodes).toEqual([]);
  });
});

describe('placeFocusView', () => {
  it('lands the answer in the Focus slot and fits it below the bar, and moves the document not at all (AC-25)', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    const document = documentPlacement(app);

    await placeFocusView(app);

    expect(hoisted.requests).toHaveLength(1);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2']));

    const content = getSceneContentRect(app.store.state, 'focus')!;
    expect(focusOf(app)!.zoomLevel).toBe(
      previewZoomLevel(content, SCREEN, CANVAS_ZOOM_MAX)
    );
    expect(documentPlacement(app)).toEqual(document);
  });

  it('asks nothing with no view open', async () => {
    const app = seed();

    await placeFocusView(app);

    expect(hoisted.requests).toHaveLength(0);
  });

  it('drops an answer that comes back after the view closed', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    hoisted.hold = true;
    const placed = placeFocusView(app);
    expect(isFocusLayoutPending(app.store.state)).toBe(true);

    app.store.dispatchSync(closeFocusViewAction$());
    hoisted.release.shift()?.();
    await placed;

    expect(focusOf(app)).toBeNull();
  });

  it('asks anew in place of the ask still out, and lands the later answer alone (AC-31)', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    hoisted.hold = true;
    const first = placeFocusView(app);
    const second = placeFocusView(app);
    expect(hoisted.requests).toHaveLength(2);

    hoisted.release.shift()?.();
    await first;
    expect(positionsOf(app)).toEqual({});
    expect(isFocusLayoutPending(app.store.state)).toBe(true);

    hoisted.release.shift()?.();
    await second;
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2']));
    expect(isFocusLayoutPending(app.store.state)).toBe(false);
  });

  it('lands nothing once cancelled, and lets the next ask through', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    hoisted.hold = true;
    const placed = placeFocusView(app);

    cancelFocusLayout(focusOf(app)!);
    expect(isFocusLayoutPending(app.store.state)).toBe(false);
    hoisted.release.shift()?.();
    await placed;
    expect(positionsOf(app)).toEqual({});

    hoisted.hold = false;
    await placeFocusView(app);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2']));
  });

  it('says so when no layout comes back, and leaves the view where it stands', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    const openToast = vi.fn();
    app.emitter.on({ openToast });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    hoisted.fail = true;

    await placeFocusView(app);

    expect(openToast).toHaveBeenCalledTimes(1);
    expect(positionsOf(app)).toEqual({});
    expect(focusOf(app)).not.toBeNull();
    warn.mockRestore();
  });

  it('raises the placing toast once the ask has run long, takes it down with the landing, and raises none for an ask cancelled first (AC-59)', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    const openToast = vi.fn();
    app.emitter.on({ openToast });
    hoisted.hold = true;

    const placed = placeFocusView(app);
    expect(openToast).not.toHaveBeenCalled();

    hoisted.onSlow[0]!();
    expect(openToast).toHaveBeenCalledTimes(1);
    const { close, message } = openToast.mock.calls[0][0].payload;
    expect(message).toBeDefined();
    let closed = false;
    close.then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);

    hoisted.release.shift()?.();
    await placed;
    await Promise.resolve();
    expect(closed).toBe(true);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2']));

    const cancelled = placeFocusView(app);
    cancelFocusLayout(focusOf(app)!);
    hoisted.onSlow[1]!();
    hoisted.release.shift()?.();
    await cancelled;
    expect(openToast).toHaveBeenCalledTimes(1);
  });
});

describe('keepFocusPlaced', () => {
  it('places the view now, and again on a walk, a step on the trail, a reach or a show mode, whatever they show (AC-28, AC-29)', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    const teardown = keepFocusPlaced(app);
    expect(hoisted.requests).toHaveLength(1);

    app.store.dispatchSync(
      viewSetCentersAction({ tableIds: ['t2'], push: true })
    );
    expect(hoisted.requests).toHaveLength(2);

    app.store.dispatchSync(viewHistoryMoveAction({ delta: -1 }));
    expect(hoisted.requests).toHaveLength(3);

    app.store.dispatchSync(viewChangeHopAction({ value: 2 }));
    expect(hoisted.requests).toHaveLength(4);

    app.store.dispatchSync(
      viewChangeShowModeAction({
        value: ShowMode.allFields,
        kind: ViewKind.focus,
      })
    );
    expect(hoisted.requests).toHaveLength(5);

    await Promise.resolve();
    teardown();
  });

  it('asks nothing of a step that took nothing, a reach or rows it already has, or a show mode aimed at the Flow view', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    const teardown = keepFocusPlaced(app);
    expect(hoisted.requests).toHaveLength(1);

    app.store.dispatchSync(viewHistoryMoveAction({ delta: -1 }));
    app.store.dispatchSync(viewChangeHopAction({ value: 1 }));
    app.store.dispatchSync(
      viewChangeShowModeAction({
        value: ShowMode.keysOnly,
        kind: ViewKind.focus,
      })
    );
    app.store.dispatchSync(
      viewChangeShowModeAction({
        value: ShowMode.allFields,
        kind: ViewKind.flow,
      })
    );
    expect(hoisted.requests).toHaveLength(1);

    await Promise.resolve();
    teardown();
  });

  it('places the view again without a neighbour a peer removed (AC-13)', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    const teardown = keepFocusPlaced(app);
    expect(hoisted.requests).toHaveLength(1);

    app.store.dispatchSync(shared(removeTableAction({ id: 't2' })));

    expect(hoisted.requests).toHaveLength(2);
    expect(hoisted.requests[1].nodes.map(node => node.id)).toEqual(['t1']);

    await Promise.resolve();
    teardown();
  });

  it('places the view again after an edit that changed what it reaches, and not after one that did not (AC-13)', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    const teardown = keepFocusPlaced(app);
    expect(hoisted.requests).toHaveLength(1);

    app.store.dispatchSync(shared(link('r14', 't1', 't4')));
    expect(hoisted.requests).toHaveLength(2);
    expect(hoisted.requests[1].nodes.map(node => node.id)).toEqual([
      't1',
      't2',
      't4',
    ]);

    app.store.dispatchSync(shared(removeRelationshipAction({ id: 'r12' })));
    expect(hoisted.requests).toHaveLength(3);
    expect(hoisted.requests[2].nodes.map(node => node.id)).toEqual([
      't1',
      't4',
    ]);

    // Outside what the view reaches, or in it without changing it: no ask.
    app.store.dispatchSync(shared(link('r34', 't3', 't4')));
    app.store.dispatchSync(
      shared(changeTableNameAction({ id: 't1', value: 'users' }))
    );
    app.store.dispatchSync(
      shared(addTableAction({ id: 't5', ui: { x: 0, y: 0, zIndex: 5 } }))
    );
    expect(hoisted.requests).toHaveLength(3);

    await Promise.resolve();
    teardown();
  });

  it('asks nothing of a pan, a zoom, a drag or the landing itself', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    const teardown = keepFocusPlaced(app);
    await Promise.resolve();
    await Promise.resolve();
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2']));

    const read = vi.mocked(getVisibleIds).mock.calls.length;
    app.store.dispatchSync(
      viewScrollToAction({ originX: 40, originY: 40, kind: ViewKind.focus }),
      viewStreamScrollToAction({
        movementX: 1,
        movementY: 1,
        kind: ViewKind.focus,
      }),
      viewStreamZoomLevelAction({ value: 0.1, kind: ViewKind.focus })
    );
    // A batch of nothing but these is let by without reading what the view
    // reaches; a drag is too, though the connector sort it wakes reads it once.
    expect(vi.mocked(getVisibleIds).mock.calls.length).toBe(read);

    app.store.dispatchSync(
      viewMoveTableAction({
        ids: ['t2'],
        movementX: 10,
        movementY: 10,
        kind: ViewKind.focus,
      })
    );
    expect(vi.mocked(getVisibleIds).mock.calls.length).toBe(read + 1);

    expect(hoisted.requests).toHaveLength(1);
    teardown();
  });

  it('ends the ask still out on its teardown, which is the overlay coming down', async () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    hoisted.hold = true;
    const teardown = keepFocusPlaced(app);
    const view = focusOf(app)!;
    expect(isFocusLayoutPending(app.store.state)).toBe(true);

    teardown();
    expect(isFocusLayoutPending(app.store.state)).toBe(false);

    hoisted.release.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(view.positions).toEqual({});

    // Torn down: a walk after it asks nothing.
    app.store.dispatchSync(
      viewSetCentersAction({ tableIds: ['t2'], push: true })
    );
    expect(hoisted.requests).toHaveLength(1);
  });
});
