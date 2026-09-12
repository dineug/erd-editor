import type { AnyAction } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import { PlacingToast } from '@/components/erd/automatic-table-placement/runElkPlacement';
import Toast from '@/components/primitives/toast/Toast';
import { TablePlacement } from '@/constants/tablePlacement';
import { SharedStreamActionTypes, StreamActionTypes } from '@/engine/actions';
import { ActionType } from '@/engine/modules/editor/actions';
import { type SceneView, ViewKind } from '@/engine/modules/editor/state';
import { viewSetLayoutAction } from '@/engine/modules/editor/view.actions';
import { refitFocusViewAction$ } from '@/engine/modules/editor/view.generator.actions';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
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
import { closePromise } from '@/utils/promise';

/** The slot the Focus scene reads and the kind every placement here names. */
const FOCUS = ViewKind.focus;

/**
 * The ask each Focus view is waiting on. A walk, a reach or a Tidy up while
 * ELK answers ends it and asks anew, so the earlier answer, when it comes,
 * lands nowhere; the overlay coming down ends it too, and the view it was for is gone.
 */
const asks = new WeakMap<SceneView, { cancel: () => void }>();

/** Whether the open Focus view is waiting on an ask, which a spec reads to know a landing is due. */
export function isFocusLayoutPending(state: RootState): boolean {
  const view = state.editor.views.focus;

  return view !== null && asks.has(view);
}

/** Ends the ask the view given is waiting on, if any, so its answer lands nowhere and its toast comes down. */
export function cancelFocusLayout(view: SceneView): void {
  asks.get(view)?.cancel();
}

/**
 * What ELK is asked to place for the Focus view: the tables it reaches, in
 * document order since the preset reads the order, at the size its show mode
 * draws them, under liam's preset. Every shown table is joined to a center, so nothing is grouped.
 *
 * @example
 * const points = await createElkLayout(createFocusLayoutRequest(store.state));
 */
export function createFocusLayoutRequest(state: RootState): ElkLayoutRequest {
  return createElkLayoutRequest(state, TablePlacement.liamLayered, {
    tableIds: getVisibleIds(state, FOCUS).tableIds,
    source: FOCUS,
  });
}

/**
 * Lands a layout in the view it was asked for and fits it, in two dispatches
 * since a fit reads the placement it lands on. The answer comes back later,
 * and the view may have closed in the meantime, in which case it is dropped.
 */
function landFocusLayout(
  store: RxStore,
  view: SceneView,
  points: ElkLayoutPoint[]
): void {
  if (store.state.editor.views.focus !== view) return;

  const positions = Object.fromEntries(
    points.map(({ id, x, y }) => [id, { x, y }])
  );

  store.dispatchSync(viewSetLayoutAction({ kind: FOCUS, positions }));
  store.dispatchSync(refitFocusViewAction$());
}

/**
 * Places what the Focus view shows by ELK and fits it: on opening, on every
 * change of what it shows, and on Tidy up, which is what drops whatever a
 * drag moved. One new request per call, in place of any still out for the view.
 *
 * @example
 * onMounted(() => placeFocusView(app.value));
 */
export function placeFocusView(app: AppContext): Promise<void> {
  const { store } = app;
  // Read as it stands: the view is open before any request is made, so the
  // sizes the request carries come from its show mode and not the document's.
  const view = store.state.editor.views.focus;
  if (!view) return Promise.resolve();

  asks.get(view)?.cancel();

  return requestFocusLayout(app, view);
}

/** One request for the view given, from the ask to the landing or the toast that says it failed. */
async function requestFocusLayout(
  app: AppContext,
  view: SceneView
): Promise<void> {
  const { store, emitter } = app;
  const request = createFocusLayoutRequest(store.state);

  if (!request.nodes.length) {
    landFocusLayout(store, view, []);
    return;
  }

  const [close, onClose] = closePromise();
  let cancelled = false;
  // The ask is the view's until it lands, fails or is cancelled, and a later
  // ask for the same view takes its place, so each of these lets go only of its own.
  const ask = { cancel };
  const finish = () => {
    onClose();
    asks.get(view) === ask && asks.delete(view);
  };
  function cancel() {
    cancelled = true;
    finish();
  }
  asks.set(view, ask);

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

    landFocusLayout(store, view, toViewPoints(request, points));
  } catch (error) {
    finish();
    console.warn('[focus-view] no focus layout came back', error);
    if (cancelled) return;

    emitter.emit(
      openToastAction({
        message: <Toast description="Could not place tables" />,
      })
    );
  }
}

/**
 * What a placement was computed over: the centers, the reach, the show mode,
 * and the tables shown with the connectors between them. Read off the state
 * and not off the batch, so a walk, a reach, a show mode or an edit counts when it took and only then.
 */
function placedKey(state: RootState): string {
  const view = state.editor.views.focus;
  if (!view) return '';

  const { tableIds, relationshipIds } = getVisibleIds(state, FOCUS);

  return [
    view.centerIds.join(' '),
    view.hop,
    view.showMode,
    tableIds.join(' '),
    relationshipIds.join(' '),
  ].join('|');
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
 * Keeps the Focus view placed for as long as the overlay is up: placed now,
 * and again after any batch that changed what it is placed over. Returns the
 * teardown, which ends the ask still out, since the view it was for is coming down with the overlay.
 *
 * @example
 * onMounted(() => addUnsubscribe(keepFocusPlaced(app.value)));
 */
export function keepFocusPlaced(app: AppContext): () => void {
  const { store } = app;
  let asked = store.state.editor.views.focus;
  let key = placedKey(store.state);
  placeFocusView(app);

  const unsubscribe = store.subscribe(actions => {
    const view = store.state.editor.views.focus;
    if (!view || isUnplacingBatch(actions)) return;

    const next = placedKey(store.state);
    const replace = key !== next;
    key = next;
    if (!replace) return;

    asked = view;
    placeFocusView(app);
  });

  return () => {
    unsubscribe();
    asked && cancelFocusLayout(asked);
  };
}
