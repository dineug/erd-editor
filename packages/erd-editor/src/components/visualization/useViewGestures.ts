import type { Ref } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { sceneHit } from '@/components/erd/hitTest';
import { WHEEL_ZOOM_STEP } from '@/constants/zoom';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import { sceneStreamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { streamZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import { Ctx } from '@/internal-types';
import { clearViewPinnedTable } from '@/konva/scene/viewLayout';
import { isPlainPress, onClickRelease } from '@/utils/clickGesture';
import {
  editorRootOf,
  isMouseEvent,
  suppressSelection,
} from '@/utils/domEvent';
import type { ViewSource } from '@/utils/draw-relationship/geometrySource';
import { dragSelectStartAction } from '@/utils/emitter';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

export type ViewGestureOptions = {
  /** The box the scene hangs in, which a press and a wheel are measured against. */
  root: Ref<HTMLDivElement>;
  /** The Stage container, which says whether a press landed on a table. */
  canvas: Ref<HTMLDivElement>;
  /** The view the gestures land in, named so they never reach the active one. */
  source: ViewSource;
};

/**
 * The gestures a view scene takes on its box: the wheel moves the screen and
 * with the modifier zooms it, a press on the background pans, and with the
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

  /**
   * The wheel the ERD tab reads, in the view named: it moves the screen, the
   * shift swaps the axis it moves along, and the modifier zooms instead. The
   * canvas has no end, so nothing here is clamped to one.
   */
  const handleWheel = (event: WheelEvent) => {
    const { store } = app.value;
    if (!store.state.editor.views[source]) return;
    event.preventDefault();

    const $mod = isMod(event);
    const isReverse =
      event.shiftKey && event.deltaX === 0 && event.deltaY !== 0;

    store.dispatch(
      $mod
        ? streamZoomLevelAction$(
            event.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP,
            source
          )
        : sceneStreamScrollToAction(
            source,
            isReverse
              ? {
                  movementX: event.deltaY * -1,
                  movementY: event.deltaX * -1,
                }
              : {
                  movementX: event.deltaX * -1,
                  movementY: event.deltaY * -1,
                }
          )
    );
  };

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    if (movementX === 0 && movementY === 0) return;

    const { store } = app.value;
    store.dispatch(sceneStreamScrollToAction(source, { movementX, movementY }));
  };

  /**
   * The press on the background that lets the pin go, read the way the card
   * that took it reads its own second press: main button, no modifier, and
   * lifted where it went down, so a pan and a marquee both leave the pin standing.
   */
  const unpinOnClick = (event: MouseEvent | TouchEvent) => {
    if (!isPlainPress(event)) return;

    const { store } = app.value;
    const view = store.state.editor.views[source];
    if (!view) return;

    onClickRelease(event, () => {
      const { store } = app.value;
      if (store.state.editor.views[source] !== view) return;

      clearViewPinnedTable(store.state, source);
    });
  };

  /**
   * A press on the background pans, or with the modifier opens the marquee of
   * this scene; a press on a table is that table's own drag. Nothing else is
   * drawn over this scene, and the bar under the tab is its sibling rather than its child.
   */
  const handleMousedown = (event: MouseEvent | TouchEvent) => {
    if (!event.target) return;

    const hit = sceneHit(canvas.value, event);
    if (hit?.kind === 'table') return;

    const { store, emitter } = app.value;
    store.dispatch(unselectAllAction$());
    unpinOnClick(event);

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
