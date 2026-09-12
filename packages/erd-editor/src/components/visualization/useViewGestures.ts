import type { Ref } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { sceneHit } from '@/components/erd/hitTest';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import {
  viewChangeZoomLevelAction,
  viewScrollToAction,
} from '@/engine/modules/editor/view.actions';
import { sceneStreamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { Ctx } from '@/internal-types';
import {
  getOriginToPlace,
  getSceneTransform,
  toScenePoint,
} from '@/konva/scene/viewport';
import {
  editorRootOf,
  isMouseEvent,
  suppressSelection,
} from '@/utils/domEvent';
import type { ViewSource } from '@/utils/draw-relationship/geometrySource';
import { dragSelectStartAction } from '@/utils/emitter';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';
import { zoomLevelInRange } from '@/utils/validation';

import { wheelZoomFactor } from './visualizationView';

export type ViewGestureOptions = {
  /** The box the scene hangs in, which a press and a wheel are measured against. */
  root: Ref<HTMLDivElement>;
  /** The Stage container, which says whether a press landed on a table. */
  canvas: Ref<HTMLDivElement>;
  /** The view the gestures land in, named so they never reach the active one. */
  source: ViewSource;
};

/** The aids drawn over a view scene, each of which takes its own presses. */
const AID_SELECTORS = [
  '.minimap',
  '.minimap-viewport',
  '.virtual-scroll',
  '.content-compass',
];

/**
 * The gestures a view scene takes on its box, one set for Flow and Focus: the
 * wheel zooms about the pointer, a press on the background pans, and with the
 * modifier it opens the marquee of this scene. Every one lands in the view named.
 *
 * @example
 * const { handleWheel, handleMousedown } = useViewGestures(ctx, { root, canvas, source });
 */
export function useViewGestures(
  ctx: Ctx,
  { root, canvas, source }: ViewGestureOptions
) {
  const app = useAppContext(ctx);

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();

    const { store } = app.value;
    if (!store.state.editor.views[source]) return;

    const rect = root.value.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const transform = getSceneTransform(store.state, source);
    const anchor = toScenePoint(transform, point);
    const value = zoomLevelInRange(
      transform.zoomLevel * wheelZoomFactor(event.deltaY, event.deltaMode)
    );
    const origin = getOriginToPlace(value, anchor, point);

    store.dispatch(
      viewChangeZoomLevelAction({ value, kind: source }),
      viewScrollToAction({ originX: origin.x, originY: origin.y, kind: source })
    );
  };

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    if (movementX === 0 && movementY === 0) return;

    const { store } = app.value;
    store.dispatch(sceneStreamScrollToAction(source, { movementX, movementY }));
  };

  /**
   * A press on the background pans, or with the modifier opens the marquee of
   * this scene; a press on a table is that table's own drag. The aids over the
   * scene take their own presses, so none of them starts a pan.
   */
  const handleMousedown = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;
    if (AID_SELECTORS.some(selector => el.closest(selector))) return;

    const hit = sceneHit(canvas.value, event);
    if (hit?.kind === 'table') return;

    const { store, emitter } = app.value;
    store.dispatch(unselectAllAction$());

    if (isMouseEvent(event) && isMod(event)) {
      event.preventDefault();
      const { x, y } = root.value.getBoundingClientRect();
      emitter.emit(
        dragSelectStartAction({
          x: event.clientX - x,
          y: event.clientY - y,
          source,
        })
      );
      return;
    }

    // Before the first move: the selection a press starts is already there by
    // the time a mousemove could preventDefault it, and the native drag it
    // turns into is what eats the mouseup this ends on.
    const restoreSelection = suppressSelection(editorRootOf(root.value));

    drag$.subscribe({ next: handleMove }).add(restoreSelection);
  };

  return { handleWheel, handleMousedown };
}
