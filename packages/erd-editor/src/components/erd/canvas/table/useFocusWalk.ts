import type { Ref } from '@dineug/r-html';
import { take } from 'rxjs';

import type { AppContext } from '@/components/appContext';
import type { ScenePointerEvent } from '@/components/erd/canvas/sceneTokens';
import { type SceneView, ViewKind } from '@/engine/modules/editor/state';
import { viewSetCentersAction } from '@/engine/modules/editor/view.actions';
import { openFocusViewAction$ } from '@/engine/modules/editor/view.generator.actions';
import type { Point, Table } from '@/internal-types';
import { isMouseEvent } from '@/utils/domEvent';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { moveEnd$ } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

/** How far a press may travel before its release reads as a drag rather than a click, in screen pixels. */
const CLICK_SLOP = 4;

/** Where a pointer event landed: the mouse, or the touch it began with or lifted. */
function pointOf(evt: Event): Point | null {
  if (isMouseEvent(evt)) {
    return { x: evt.clientX, y: evt.clientY };
  }

  const { touches, changedTouches } = evt as TouchEvent;
  const touch = touches?.[0] ?? changedTouches?.[0];

  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/** The end of a gesture that is a lift, as against a native drag, a cancelled pointer or a blurred window. */
const isLift = ({ type }: Event) => type === 'mouseup' || type === 'touchend';

const isClick = (from: Point, to: Point) =>
  Math.abs(to.x - from.x) <= CLICK_SLOP &&
  Math.abs(to.y - from.y) <= CLICK_SLOP;

/**
 * The click a view scene takes on a table: pressed with the main button and
 * lifted without moving and without the modifier. In Focus it becomes the one
 * center, a step on the trail; in Flow it opens Focus. Documents take none.
 *
 * @example
 * const walk = useFocusWalk(app, props, sourceRef);
 */
export function useFocusWalk(
  app: Ref<AppContext>,
  props: { table: Table },
  source: Ref<GeometrySource>
) {
  const walkTo = (view: SceneView, id: string) => {
    const { store } = app.value;
    if (view.centerIds.length === 1 && view.centerIds[0] === id) return;

    store.dispatch(viewSetCentersAction({ tableIds: [id], push: true }));
  };

  const onPress = (event: ScenePointerEvent) => {
    const { evt } = event;
    const kind = source.value;
    if (
      kind === 'document' ||
      isMod(evt) ||
      (isMouseEvent(evt) && evt.button !== 0)
    ) {
      return;
    }

    const from = pointOf(evt);
    if (!from) return;

    // The release is read off the window, not off this node, since the press
    // selects the table and the scene rebuilds its node before the lift. It
    // answers for the view that took the press, which a reopen does not revive.
    const view = app.value.store.state.editor.views[kind];
    if (!view) return;

    const { id } = props.table;
    moveEnd$.pipe(take(1)).subscribe(end => {
      const to = isLift(end) ? pointOf(end) : null;
      if (!to || !isClick(from, to)) return;

      const { store } = app.value;
      if (store.state.editor.views[kind] !== view) return;

      kind === ViewKind.focus
        ? walkTo(view, id)
        : store.dispatch(openFocusViewAction$([id]));
    });
  };

  return { onPress };
}
