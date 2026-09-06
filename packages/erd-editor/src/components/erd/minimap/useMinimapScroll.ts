import { observable } from '@dineug/r-html';
import { Subscription } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import {
  getMinimapLayout,
  toScrollMovement,
} from '@/components/erd/minimap/minimapGeometry';
import {
  clampScrollMovement,
  getScrollRanges,
  type ScrollRange,
  streamScrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Ctx } from '@/internal-types';
import { freezeView, thawView } from '@/konva/scene/viewFreeze';
import { isMouseEvent } from '@/utils/domEvent';
import { drag$, DragMove } from '@/utils/globalEventObservable';

/**
 * How much of this step of the drag is the handle's to take. The room is read
 * off the origin as it stands rather than off where the step would land, so the
 * last partial step is taken and cut to the end of the travel instead of dropped.
 */
const takeMovement = (
  movement: number,
  pointer: number,
  start: number,
  origin: number,
  { min, max }: ScrollRange
) => {
  const backwards = movement < 0;
  const hasRoom = backwards ? origin < max : origin > min;
  const behindPointer = backwards ? pointer < start : pointer > start;

  return hasRoom && behindPointer ? movement : 0;
};

export function useMinimapScroll(ctx: Ctx) {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const state = observable({
    selected: false,
  });

  let clientX = 0;
  let clientY = 0;
  let drag: Subscription | null = null;
  addUnsubscribe(() => drag?.unsubscribe());

  /**
   * Minimap travel as the origin travel the canvas has to take to follow it.
   * The map is held still for the drag, so its ratio is the one the press saw;
   * the travel that covers it carries the zoom, as an origin pixel is a screen pixel.
   */
  const absoluteMovement = (movement: number) => {
    const { store } = app.value;
    const { zoomLevel } = store.state.settings;

    return toScrollMovement(
      movement,
      getMinimapLayout(store.state).ratio,
      zoomLevel
    );
  };

  const getMovementX = ({ movementX, x }: DragMove) => {
    const { store } = app.value;
    const movement = takeMovement(
      movementX,
      x,
      clientX,
      store.state.settings.originX,
      getScrollRanges(store.state).left
    );

    clientX += movement;
    return movement;
  };

  const getMovementY = ({ movementY, y }: DragMove) => {
    const { store } = app.value;
    const movement = takeMovement(
      movementY,
      y,
      clientY,
      store.state.settings.originY,
      getScrollRanges(store.state).top
    );

    clientY += movement;
    return movement;
  };

  const handleScroll = (dragMove: DragMove) => {
    const { event } = dragMove;
    event.type === 'mousemove' && event.preventDefault();
    const movementX = getMovementX(dragMove);
    const movementY = getMovementY(dragMove);

    if (movementX === 0 && movementY === 0) {
      return;
    }

    // The reducer takes a step as it is, so the handle is what keeps its drag
    // on the map it is drawn over: the step is cut to the hull here.
    const { store } = app.value;
    store.dispatch(
      streamScrollToAction(
        clampScrollMovement(store.state, {
          movementX: absoluteMovement(movementX),
          movementY: absoluteMovement(movementY),
        })
      )
    );
  };

  /**
   * Holds the view as it stands on the press. A press on the thumbnail has
   * landed its own jump by now, so the map held is one that holds the screen
   * where the press sent it, and the drop is where it lays out again.
   */
  const onScrollStart = (event: MouseEvent | TouchEvent) => {
    // A touch is followed by a compatibility mouse press at the same pixel, and
    // the handle has moved by then, so that press would land on the thumbnail.
    if (!isMouseEvent(event)) event.preventDefault();

    const { store } = app.value;
    state.selected = true;

    clientX = isMouseEvent(event) ? event.clientX : event.touches[0].clientX;
    clientY = isMouseEvent(event) ? event.clientY : event.touches[0].clientY;

    freezeView(store.state);
    // A finalizer runs on the release and on an unmount mid-drag alike, where
    // a complete handler would run on the release alone and leave the view held.
    const subscription = drag$.subscribe(handleScroll);
    subscription.add(() => {
      if (drag === subscription) drag = null;
      state.selected = false;
      thawView(store.state);
    });
    drag = subscription;
  };

  return {
    state,
    onScrollStart,
  };
}
