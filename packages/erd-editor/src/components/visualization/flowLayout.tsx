import type { AppContext } from '@/components/appContext';
import { PlacingToast } from '@/components/erd/automatic-table-placement/runElkPlacement';
import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import Toast from '@/components/primitives/toast/Toast';
import { CANVAS_ZOOM_MAX } from '@/constants/schema';
import { TablePlacement } from '@/constants/tablePlacement';
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
import {
  createElkLayout,
  createElkLayoutRequest,
  type ElkLayoutPoint,
  toViewPoints,
} from '@/services/elk-layout';
import { openToastAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { closePromise } from '@/utils/promise';

/** The slot the Flow scene reads and the kind every placement here names. */
const FLOW = ViewKind.flow;

/**
 * The landing ELK gave each Flow view, by the view it was computed for. A drag
 * moves the view's own placement and never this, so a return to the tab
 * stands the view back here; a view the document replaces takes its entry with it.
 */
const layouts = new WeakMap<SceneView, Record<string, Point>>();

/**
 * The ask each Flow view is waiting on. A return to the tab while ELK answers
 * finds no landing yet and waits on this rather than asking again; a Tidy up
 * or a cancel ends it, so the answer, when it comes, lands nowhere and the next ask is a new one.
 */
const asks = new WeakMap<SceneView, { cancel: () => void }>();

/** Whether the open Flow view has a landing to stand back on, which a return to the tab reads. */
export function hasFlowLayout(state: RootState): boolean {
  const view = state.editor.views.flow;

  return view !== null && layouts.has(view);
}

/** Whether the open Flow view is waiting on an ask, which a return to the tab joins rather than repeats. */
export function isFlowLayoutPending(state: RootState): boolean {
  const view = state.editor.views.flow;

  return view !== null && asks.has(view);
}

/** Stands the Flow view back on the layout ELK gave it, dropping whatever a drag moved. */
export function restoreFlowLayout(store: RxStore): void {
  const view = store.state.editor.views.flow;
  const positions = view ? layouts.get(view) : undefined;
  if (!positions) return;

  store.dispatchSync(viewSetLayoutAction({ kind: FLOW, positions }));
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
 * Lands a layout in the view it was asked for and fits it. The answer comes
 * back later, and the view it was asked for may have gone with the document
 * in the meantime, in which case it is dropped rather than landed on another.
 */
function landFlowLayout(
  store: RxStore,
  view: SceneView,
  points: ElkLayoutPoint[]
): void {
  if (store.state.editor.views.flow !== view) return;

  const positions = Object.fromEntries(
    points.map(({ id, x, y }) => [id, { x, y }])
  );

  layouts.set(view, positions);
  store.dispatchSync(viewSetLayoutAction({ kind: FLOW, positions }));
  fitFlowView(store);
}

/**
 * Places every table of the document in the Flow view by ELK: on entry, and
 * again on Tidy up. One new request per call, over the tables the document has
 * now and in place of any still out; a return to the tab asks nothing and reads the two above.
 *
 * @example
 * hasFlowLayout(store.state) ? restoreFlowLayout(store) : placeFlowView(app);
 */
export function placeFlowView(app: AppContext): Promise<void> {
  const { store } = app;

  if (!store.state.editor.views.flow) {
    store.dispatchSync(viewOpenAction({ kind: FLOW }));
  }

  // Read after the open: the sizes the request carries come from the show
  // mode of the view that is open, and with none open they would be the document's.
  const view = store.state.editor.views.flow;
  if (!view) return Promise.resolve();

  asks.get(view)?.cancel();

  return requestFlowLayout(app, view);
}

/** One request for the view given, from the ask to the landing or the toast that says it failed. */
async function requestFlowLayout(
  app: AppContext,
  view: SceneView
): Promise<void> {
  const { store, emitter, shortcut$ } = app;
  const request = createElkLayoutRequest(
    store.state,
    TablePlacement.liamLayered,
    { source: FLOW, groupUnrelated: true }
  );

  if (!request.nodes.length) {
    landFlowLayout(store, view, []);
    return;
  }

  const [close, onClose] = closePromise();
  let cancelled = false;
  // The chord is the Focus overlay's to close while one is up over the tab,
  // and the ask under it stays out so the Flow has its landing when the overlay is down.
  const subscription = shortcut$.subscribe(({ type }) => {
    type === KeyBindingName.stop && !store.state.editor.views.focus && cancel();
  });
  // The ask is the view's until it lands, fails or is cancelled, and a later
  // ask for the same view takes its place, so each of these lets go only of its own.
  const ask = { cancel };
  const finish = () => {
    subscription.unsubscribe();
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

    landFlowLayout(store, view, toViewPoints(request, points));
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
