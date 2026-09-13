// The placement of the Flow view, all of it through the one authority: what
// each display set asks ELK for (AC-46), the landing a return to the whole
// stands back on (AC-47), and the loop that asks again for what went stale.

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { focusFlowView, showAllFlowView } from '@/components/flowCenters';
import {
  ensureFlowPlaced,
  keepFlowPlaced,
} from '@/components/visualization/flowLayout';
import { CANVAS_ZOOM_MAX, RelationshipType } from '@/constants/schema';
import { TablePlacement } from '@/constants/tablePlacement';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ShowMode, ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeShowModeAction,
  viewChangeZoomLevelAction,
  viewMoveTableAction,
  viewOpenAction,
  viewScrollToAction,
  viewStreamScrollToAction,
  viewStreamZoomLevelAction,
} from '@/engine/modules/editor/view.actions';
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
import { getVisibleIds } from '@/konva/scene/viewLayout';

const hoisted = vi.hoisted(() => ({
  requests: [] as Array<{ placement: string; nodes: any[] }>,
  /** Set to hold the next answer back until the spec lets it go. */
  hold: false,
  release: [] as Array<() => void>,
  /** How far apart the row stands the tables, so a later landing is one the spec can tell apart. */
  stride: 400,
}));

/** ELK stood in for by a row, so a request is something the spec can count and a landing something it can predict. */
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
        x: index * hoisted.stride,
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

const apps: AppContext[] = [];
const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
  apps.splice(0).forEach(app => app.store.destroy());
  hoisted.requests.splice(0);
  hoisted.hold = false;
  hoisted.release.splice(0);
  hoisted.stride = 400;
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

/**
 * What the mount of the Flow scene does, which is the one entry every case
 * here is driven through: the one question asked once, and the loop that asks
 * it again for whatever changed what the view is placed over.
 */
function mountFlow(app: AppContext): () => void {
  ensureFlowPlaced(app);
  const teardown = keepFlowPlaced(app);
  teardowns.push(teardown);

  return () => {
    const at = teardowns.indexOf(teardown);
    if (at !== -1) teardowns.splice(at, 1);
    teardown();
  };
}

/** Lets an answer the row gives at once come back, land and fit. */
async function settle() {
  for (let round = 0; round < 3; round++) {
    await Promise.resolve();
  }
}

/** A document edit the way a peer's arrives, which is the one way an edit reaches the store under a view. */
const shared = (action: AnyAction): AnyAction => ({
  ...action,
  tags: Tag.shared,
});

const flowOf = (app: AppContext) => app.store.state.editor.views.flow;

const positionsOf = (app: AppContext) =>
  Object.fromEntries(
    Object.entries(flowOf(app)?.positions ?? {}).map(([id, { x, y }]) => [
      id,
      { x, y },
    ])
  );

/** Every table a request carries, the ones inside the group of unrelated tables included. */
const tableIdsOf = ({ nodes }: { nodes: any[] }): string[] => {
  const walk = (given: any[]): string[] =>
    given.flatMap(node =>
      node.children?.length ? walk(node.children) : [node.id]
    );

  return walk(nodes);
};

/** Where the row ELK is stood in for by lands the tables given, in the order they were asked. */
const landingOf = (ids: string[], stride = 400) =>
  Object.fromEntries(
    ids.map((id, index) => [id, { x: index * stride, y: (index % 2) * 200 }])
  );

const fitZoomOf = (app: AppContext) =>
  previewZoomLevel(
    getSceneContentRect(app.store.state, 'flow')!,
    VIEWPORT,
    CANVAS_ZOOM_MAX
  );

describe('the one authority that places the Flow view', () => {
  it('asks once on the mount, over the whole document with the tables nothing reaches grouped', async () => {
    const app = seed();
    mountFlow(app);
    await settle();

    expect(hoisted.requests).toHaveLength(1);
    expect(hoisted.requests[0].placement).toBe(TablePlacement.viewLayered);
    expect(tableIdsOf(hoisted.requests[0])).toEqual(['t1', 't2', 't3', 't4']);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't3', 't4']));
  });

  it('joins the ask still out on a return to the tab rather than asking again', async () => {
    const app = seed();
    hoisted.hold = true;
    const teardown = mountFlow(app);
    expect(hoisted.requests).toHaveLength(1);

    teardown();
    mountFlow(app);
    expect(hoisted.requests).toHaveLength(1);

    hoisted.release.shift()?.();
    await settle();
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't3', 't4']));
  });

  it('asks once for the tables left when the view narrows, and fits what came back (AC-46)', async () => {
    const app = seed();
    mountFlow(app);
    await settle();

    focusFlowView(app, ['t2']);
    await settle();

    expect(hoisted.requests).toHaveLength(2);
    expect(tableIdsOf(hoisted.requests[1])).toEqual(['t1', 't2', 't3']);
    expect(getVisibleIds(app.store.state, 'flow').tableIds).toEqual([
      't1',
      't2',
      't3',
    ]);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't3']));
    expect(flowOf(app)!.zoomLevel).toBe(fitZoomOf(app));
  });

  it('stands the whole back on the landing it already has, asking nothing (AC-47)', async () => {
    const app = seed();
    mountFlow(app);
    await settle();
    const whole = positionsOf(app);

    focusFlowView(app, ['t2']);
    await settle();
    expect(hoisted.requests).toHaveLength(2);

    showAllFlowView(app);
    await settle();

    expect(hoisted.requests).toHaveLength(2);
    expect(positionsOf(app)).toEqual(whole);
    expect(flowOf(app)!.zoomLevel).toBe(fitZoomOf(app));
  });

  it('asks for the whole once when the view was entered narrowed and has no landing for it (AC-47)', async () => {
    const app = seed();
    app.store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow, centerIds: ['t2'] })
    );
    mountFlow(app);
    await settle();
    expect(hoisted.requests).toHaveLength(1);
    expect(tableIdsOf(hoisted.requests[0])).toEqual(['t1', 't2', 't3']);

    showAllFlowView(app);
    await settle();

    expect(hoisted.requests).toHaveLength(2);
    expect(tableIdsOf(hoisted.requests[1])).toEqual(['t1', 't2', 't3', 't4']);
    expect(getVisibleIds(app.store.state, 'flow').tableIds).toEqual([
      't1',
      't2',
      't3',
      't4',
    ]);
  });

  it('drops an answer computed over what the view no longer stands on', async () => {
    const app = seed();
    hoisted.hold = true;
    const teardown = mountFlow(app);
    expect(hoisted.requests).toHaveLength(1);

    // The tab leaves while ELK answers and the document changes with no loop
    // to ask again, so the answer that comes back was computed over another
    // document than the one it would land on.
    teardown();
    app.store.dispatchSync(
      shared(addTableAction({ id: 't5', ui: { x: 0, y: 0, zIndex: 5 } }))
    );
    hoisted.release.shift()?.();
    await settle();

    expect(positionsOf(app)).toEqual({});

    hoisted.hold = false;
    mountFlow(app);
    await settle();
    expect(hoisted.requests).toHaveLength(2);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't3', 't4', 't5']));
  });

  it('lets go of the ask still out when the view stands back on a landing it kept', async () => {
    const app = seed();
    mountFlow(app);
    await settle();

    hoisted.hold = true;
    focusFlowView(app, ['t2']);
    await settle();
    expect(hoisted.requests).toHaveLength(2);

    // Back on the whole, which has its landing: the narrowed ask is answering
    // a question nobody is waiting on, and its placing toast would outlive it.
    showAllFlowView(app);
    await settle();
    expect(hoisted.requests).toHaveLength(2);

    // Let go of rather than merely ignored, which a return to the narrowed
    // view would otherwise join instead of asking again.
    focusFlowView(app, ['t2']);
    await settle();
    expect(hoisted.requests).toHaveLength(3);
  });

  it('keeps the viewport the reader left when the tab stands the landing back up', async () => {
    const app = seed();
    const teardown = mountFlow(app);
    await settle();
    const whole = positionsOf(app);

    // The reader reads one corner up close, which the fit on the way in
    // never chose and a return to the tab is not theirs to undo.
    app.store.dispatchSync(
      viewChangeZoomLevelAction({ value: 1, kind: ViewKind.flow }),
      viewScrollToAction({ originX: 300, originY: 200, kind: ViewKind.flow })
    );
    teardown();
    mountFlow(app);
    await settle();

    expect(hoisted.requests).toHaveLength(1);
    expect(positionsOf(app)).toEqual(whole);
    expect(flowOf(app)!.zoomLevel).toBe(1);
    expect(flowOf(app)!.originX).toBe(300);
    expect(flowOf(app)!.originY).toBe(200);
  });

  it('asks again on a Tidy up though the display set has its landing, and stands on the answer', async () => {
    const app = seed();
    mountFlow(app);
    await settle();
    const whole = positionsOf(app);

    // The toolbar's own call, the one caller that ignores the cache. The row
    // is spread wider first, so the second answer is one the view can be seen
    // to take rather than one that reads the same either way.
    hoisted.stride = 500;
    ensureFlowPlaced(app, { force: true });
    await settle();

    expect(hoisted.requests).toHaveLength(2);
    expect(positionsOf(app)).not.toEqual(whole);
    expect(positionsOf(app)).toEqual(landingOf(['t1', 't2', 't3', 't4'], 500));
    expect(flowOf(app)!.zoomLevel).toBe(fitZoomOf(app));
  });
});

describe('the loop that keeps the Flow view placed', () => {
  it('asks nothing of a pan, a zoom, a drag or the landing itself', async () => {
    const app = seed();
    mountFlow(app);
    await settle();
    expect(hoisted.requests).toHaveLength(1);

    app.store.dispatchSync(
      viewScrollToAction({ originX: 40, originY: 40, kind: ViewKind.flow }),
      viewStreamScrollToAction({
        movementX: 1,
        movementY: 1,
        kind: ViewKind.flow,
      }),
      viewStreamZoomLevelAction({ value: 0.1, kind: ViewKind.flow })
    );
    app.store.dispatchSync(
      viewMoveTableAction({
        ids: ['t2'],
        movementX: 10,
        movementY: 10,
        kind: ViewKind.flow,
      })
    );
    await settle();

    expect(hoisted.requests).toHaveLength(1);
  });

  it('asks again on a show mode and on a change of centers, and not on an edit that changed neither', async () => {
    const app = seed();
    mountFlow(app);
    await settle();

    app.store.dispatchSync(
      viewChangeShowModeAction({
        value: ShowMode.allFields,
        kind: ViewKind.flow,
      })
    );
    await settle();
    expect(hoisted.requests).toHaveLength(2);

    focusFlowView(app, ['t2']);
    await settle();
    expect(hoisted.requests).toHaveLength(3);

    app.store.dispatchSync(
      shared(changeTableNameAction({ id: 't1', value: 'users' }))
    );
    await settle();
    expect(hoisted.requests).toHaveLength(3);
  });

  // The contrast is the peer's edit below, which replaces the placement under
  // a screen the reader set and leaves that screen where it was. A row display
  // redraws every card at another size, so the screen follows it instead.
  it('fits again on a change of the row display, which resizes every card it placed', async () => {
    const app = seed();
    mountFlow(app);
    await settle();

    app.store.dispatchSync(
      viewChangeZoomLevelAction({ value: 1, kind: ViewKind.flow }),
      viewScrollToAction({ originX: 300, originY: 200, kind: ViewKind.flow })
    );
    app.store.dispatchSync(
      viewChangeShowModeAction({
        value: ShowMode.allFields,
        kind: ViewKind.flow,
      })
    );
    await settle();

    expect(hoisted.requests).toHaveLength(2);
    expect(flowOf(app)!.zoomLevel).toBe(fitZoomOf(app));
    expect(flowOf(app)!.zoomLevel).not.toBe(1);
    expect(flowOf(app)!.originX).not.toBe(300);
    expect(flowOf(app)!.originY).not.toBe(200);
  });

  it('asks again without a neighbour a peer removed', async () => {
    const app = seed();
    mountFlow(app);
    await settle();

    focusFlowView(app, ['t2']);
    await settle();
    expect(hoisted.requests).toHaveLength(2);

    app.store.dispatchSync(shared(removeRelationshipAction({ id: 'r23' })));
    await settle();

    expect(hoisted.requests).toHaveLength(3);
    expect(tableIdsOf(hoisted.requests[2])).toEqual(['t1', 't2']);
  });

  it('asks again for a table added outside what the narrowed view shows, which the key is coarse enough to catch', async () => {
    const app = seed();
    mountFlow(app);
    await settle();

    focusFlowView(app, ['t2']);
    await settle();
    expect(hoisted.requests).toHaveLength(2);

    app.store.dispatchSync(
      shared(addTableAction({ id: 't5', ui: { x: 0, y: 0, zIndex: 5 } }))
    );
    await settle();

    // Intended: the key names the document's own lists rather than the shown
    // ones, since the shown ones read the positions this loop writes.
    expect(hoisted.requests).toHaveLength(3);
    expect(tableIdsOf(hoisted.requests[2])).toEqual(['t1', 't2', 't3']);
  });

  it("places again under a peer's edit without moving the screen the reader set", async () => {
    const app = seed();
    mountFlow(app);
    await settle();
    const whole = positionsOf(app);

    app.store.dispatchSync(
      viewChangeZoomLevelAction({ value: 1, kind: ViewKind.flow }),
      viewScrollToAction({ originX: 300, originY: 200, kind: ViewKind.flow })
    );
    app.store.dispatchSync(
      shared(addTableAction({ id: 't5', ui: { x: 0, y: 0, zIndex: 5 } }))
    );
    await settle();

    expect(hoisted.requests).toHaveLength(2);
    expect(positionsOf(app)).not.toEqual(whole);
    expect(flowOf(app)!.zoomLevel).toBe(1);
    expect(flowOf(app)!.originX).toBe(300);
    expect(flowOf(app)!.originY).toBe(200);
  });

  it('asks nothing once torn down, and stands on what it placed', async () => {
    const app = seed();
    const teardown = mountFlow(app);
    await settle();
    const whole = positionsOf(app);

    teardown();
    app.store.dispatchSync(shared(removeTableAction({ id: 't4' })));
    await settle();

    expect(hoisted.requests).toHaveLength(1);
    expect(positionsOf(app)).toEqual(whole);
  });
});
