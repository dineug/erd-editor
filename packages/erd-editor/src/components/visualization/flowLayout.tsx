import type { AnyAction } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import { PlacingToast } from '@/components/erd/automatic-table-placement/runElkPlacement';
import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import Toast from '@/components/primitives/toast/Toast';
import { CANVAS_ZOOM_MAX } from '@/constants/schema';
import { TablePlacement } from '@/constants/tablePlacement';
import { SharedStreamActionTypes, StreamActionTypes } from '@/engine/actions';
import { ActionType } from '@/engine/modules/editor/actions';
import { type SceneView, ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeZoomLevelAction,
  viewOpenAction,
  viewScrollToAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { hasViewport } from '@/engine/modules/settings/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import type { Point } from '@/internal-types';
import { getSceneContentRect } from '@/konva/scene/contentBounds';
import { previewZoomLevel } from '@/konva/scene/fitZoom';
import { getVisibleIds } from '@/konva/scene/viewLayout';
import {
  createElkLayout,
  createElkLayoutRequest,
  type ElkLayoutPoint,
  type ElkLayoutRequest,
  toViewPoints,
} from '@/services/elk-layout';
import { arrayHas } from '@/utils/arrayHas';
import { openToastAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { closePromise } from '@/utils/promise';

/** The slot the Flow scene reads and the kind every placement here names. */
const FLOW = ViewKind.flow;

/** One display set of one view, placed: where ELK stood each table and the key that ask was made under. */
type Landing = { positions: Record<string, Point>; key: string };

/** The two display sets a Flow view stands in, and so the two landings it keeps. */
type FlowSlot = 'full' | 'focused';

type FlowLayouts = {
  full: Landing | null;
  focused: Landing | null;
  pending: { key: string } | null;
  stood: string | null;
};

/**
 * What each Flow view has been placed as, one landing per display set, beside
 * the key of the ask still out for it and the framing it currently stands in.
 * A drag moves the view's own placement and never this; a view the document replaces takes its entry.
 */
const layouts = new WeakMap<SceneView, FlowLayouts>();

/**
 * The ask each Flow view is waiting on. A return to the tab while ELK answers
 * joins it rather than asking again; a Tidy up, a change of what the view is
 * placed over or a cancel ends it, so the answer, when it comes, lands nowhere.
 */
const asks = new WeakMap<SceneView, { cancel: () => void }>();

/** What the view given has been placed as, made empty on the first read of it. */
function layoutsOf(view: SceneView): FlowLayouts {
  const entry = layouts.get(view) ?? {
    full: null,
    focused: null,
    pending: null,
    stood: null,
  };
  layouts.set(view, entry);

  return entry;
}

/** Which display set the view stands in: what its centers reach, or everything its layout placed. */
const slotOf = (view: SceneView): FlowSlot =>
  view.centerIds.length ? 'focused' : 'full';

/** The display set itself, named by its centers, which is the first term of the key below. */
const centersOf = (view: SceneView): string => view.centerIds.join(' ');

/**
 * How the view is framed: which tables it draws and how much of each card. A
 * change of either resizes the cards and spreads the layout differently, so
 * the screen has to follow it; the rest of the key below replaces the placement alone.
 */
const framingOf = (view: SceneView): string =>
  [centersOf(view), view.showMode].join('|');

/**
 * What a placement was computed over: the centers, the show mode, and the
 * document's own lists. Never the positions a landing writes, since the loop
 * reading this asks again on a change and would otherwise be reading its own answer.
 */
function placedKey(state: RootState): string {
  const view = state.editor.views.flow;
  if (!view) return '';

  const { doc } = state;

  return [
    centersOf(view),
    view.showMode,
    doc.tableIds.join(' '),
    doc.relationshipIds.join(' '),
  ].join('|');
}

/**
 * Fits what the Flow view shows into the screen, the way a placement preview
 * opens, with no ceiling but the zoom's own: a view is read up close as
 * readily as from afar, where a preview of the whole document is only ever the latter.
 */
export function fitFlowView(store: RxStore): void {
  const { state } = store;
  const { viewport } = state.editor;
  const content = getSceneContentRect(state, FLOW);
  if (!state.editor.views.flow || !content || !hasViewport(viewport)) return;

  const zoomLevel = previewZoomLevel(content, viewport, CANVAS_ZOOM_MAX);
  const origin = getScrollToCenter(
    { ...getViewTransform(state, FLOW), zoomLevel },
    { x: content.x + content.width / 2, y: content.y + content.height / 2 }
  );

  store.dispatchSync(
    viewChangeZoomLevelAction({ value: zoomLevel, kind: FLOW }),
    viewScrollToAction({ originX: origin.x, originY: origin.y, kind: FLOW })
  );
}

/**
 * Stands the view on the positions given, and moves the screen to them only
 * where the reader asked to be moved: a first placement, a framing they
 * changed, a Tidy up. A return to the tab and a peer's edit keep the viewport.
 */
function standFlowView(
  store: RxStore,
  entry: FlowLayouts,
  framing: string,
  positions: Record<string, Point>,
  forced: boolean
): void {
  const fits = forced || entry.stood !== framing;
  entry.stood = framing;

  store.dispatchSync(viewSetLayoutAction({ kind: FLOW, positions }));
  fits && fitFlowView(store);
}

/**
 * Lands a layout in the slot it was asked for. The answer comes back later,
 * and the view may have gone with the document or moved on to another display
 * set meanwhile, in which case it is dropped rather than landed on either.
 */
function landFlowLayout(
  store: RxStore,
  view: SceneView,
  slot: FlowSlot,
  key: string,
  points: ElkLayoutPoint[],
  forced: boolean
): void {
  if (store.state.editor.views.flow !== view) return;
  if (placedKey(store.state) !== key) return;

  const positions = Object.fromEntries(
    points.map(({ id, x, y }) => [id, { x, y }])
  );
  const entry = layoutsOf(view);

  entry[slot] = { positions, key };
  standFlowView(store, entry, framingOf(view), positions, forced);
}

/**
 * What ELK is asked for the display set the view stands in: the tables its
 * centers reach, every one of them joined to a center so nothing is grouped,
 * or the whole document with the tables nothing reaches gathered into a group.
 */
function flowLayoutRequest(state: RootState, slot: FlowSlot): ElkLayoutRequest {
  return slot === 'focused'
    ? createElkLayoutRequest(state, TablePlacement.viewLayered, {
        tableIds: getVisibleIds(state, FLOW).tableIds,
        source: FLOW,
      })
    : createElkLayoutRequest(state, TablePlacement.viewLayered, {
        source: FLOW,
        groupUnrelated: true,
      });
}

/**
 * The one place a Flow placement is asked for. The landing the display set
 * already has under this key is stood back on, an ask already out for it is
 * joined, and anything else is one new ask; a Tidy up forces that ask and its fit.
 *
 * @example
 * onMounted(() => ensureFlowPlaced(app.value));
 */
export function ensureFlowPlaced(
  app: AppContext,
  { force = false }: { force?: boolean } = {}
): Promise<void> {
  const { store } = app;

  if (!store.state.editor.views.flow) {
    store.dispatchSync(viewOpenAction({ kind: FLOW }));
  }

  // Read after the open: the sizes the request carries come from the show
  // mode of the view that is open, and with none open they would be the document's.
  const view = store.state.editor.views.flow;
  if (!view) return Promise.resolve();

  const entry = layoutsOf(view);
  const slot = slotOf(view);
  const key = placedKey(store.state);

  if (!force && entry.pending?.key === key) return Promise.resolve();

  // Whatever is still out was asked under another key, so its answer is
  // already bound to be dropped and only its toast would outlive this.
  asks.get(view)?.cancel();

  const landing = force ? null : entry[slot];
  if (landing?.key === key) {
    standFlowView(store, entry, framingOf(view), landing.positions, false);

    return Promise.resolve();
  }

  return requestFlowLayout(app, view, slot, key, force);
}

/** One request for the view and slot given, from the ask to the landing or the toast that says it failed. */
async function requestFlowLayout(
  app: AppContext,
  view: SceneView,
  slot: FlowSlot,
  key: string,
  forced: boolean
): Promise<void> {
  const { store, emitter, shortcut$ } = app;
  const request = flowLayoutRequest(store.state, slot);

  if (!request.nodes.length) {
    landFlowLayout(store, view, slot, key, [], forced);
    return;
  }

  const [close, onClose] = closePromise();
  const entry = layoutsOf(view);
  let cancelled = false;
  const subscription = shortcut$.subscribe(({ type }) => {
    type === KeyBindingName.stop && cancel();
  });
  // The ask is the view's until it lands, fails or is cancelled, and a later
  // ask for the same view takes its place, so each of these lets go only of
  // its own, and the mark a return to the tab reads goes with it.
  const ask = { cancel };
  const pending = { key };
  const finish = () => {
    subscription.unsubscribe();
    onClose();
    asks.get(view) === ask && asks.delete(view);
    entry.pending === pending && (entry.pending = null);
  };
  function cancel() {
    cancelled = true;
    finish();
  }
  asks.set(view, ask);
  entry.pending = pending;

  try {
    // The toast is the placement's own, raised only once the wait is long
    // enough to say so, and taken down before anything else is said.
    const points = await createElkLayout(request, () => {
      cancelled ||
        emitter.emit(
          openToastAction({
            close,
            message: <PlacingToast onCancel={cancel} />,
          })
        );
    });
    finish();
    if (cancelled) return;

    landFlowLayout(
      store,
      view,
      slot,
      key,
      toViewPoints(request, points),
      forced
    );
  } catch (error) {
    finish();
    console.warn('[visualization] no flow layout came back', error);
    if (cancelled) return;

    emitter.emit(
      openToastAction({
        message: <Toast description="Could not place tables" />,
      })
    );
  }
}

/**
 * The actions that move what is drawn and none of what is placed over: a pan,
 * a zoom, a drag or a landing, in the document or a view, and what a peer
 * streams. Each comes once a frame, so a batch of nothing else is let by unread.
 */
const isUnplacing = arrayHas<string>([
  ...StreamActionTypes,
  ...SharedStreamActionTypes,
  ActionType.viewScrollTo,
  ActionType.viewStreamScrollTo,
  ActionType.viewChangeZoomLevel,
  ActionType.viewStreamZoomLevel,
  ActionType.viewMoveTable,
  ActionType.viewSetLayout,
]);

const isUnplacingBatch = (actions: AnyAction[]) =>
  actions.every(({ type }) => isUnplacing(type));

/**
 * Keeps the Flow view placed for as long as the tab draws it: placed again
 * after any batch that changed what it is placed over, and never at the
 * subscription itself, which the mount has asked for already. Returns the teardown.
 *
 * @example
 * onMounted(() => addUnsubscribe(keepFlowPlaced(app.value)));
 */
export function keepFlowPlaced(app: AppContext): () => void {
  const { store } = app;
  let key = placedKey(store.state);

  // The ask outlives this loop on purpose: the view is the session's and the
  // tab is not, so a leave while ELK answers leaves the ask out for the return.
  return store.subscribe(actions => {
    const view = store.state.editor.views.flow;
    if (!view || isUnplacingBatch(actions)) return;

    const next = placedKey(store.state);
    const replace = key !== next;
    key = next;
    if (!replace) return;

    ensureFlowPlaced(app);
  });
}
