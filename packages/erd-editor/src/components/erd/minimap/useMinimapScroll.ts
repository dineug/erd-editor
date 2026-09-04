import { observable } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  getMinimapRatio,
  toScrollMovement,
} from '@/components/erd/minimap/minimapGeometry';
import {
  getScrollRanges,
  type ScrollRange,
  streamScrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { Ctx } from '@/internal-types';
import { isMouseEvent } from '@/utils/domEvent';
import { drag$, DragMove } from '@/utils/globalEventObservable';

/**
 * How much of this step of the drag is the handle's to take. The room is read
 * off the scroll as it stands rather than off where the step would land, so the
 * last partial step reaches the reducer and is clamped instead of dropped.
 */
const takeMovement = (
  movement: number,
  pointer: number,
  origin: number,
  scroll: number,
  { min, max }: ScrollRange
) => {
  const backwards = movement < 0;
  const hasRoom = backwards ? scroll < max : scroll > min;
  const behindPointer = backwards ? pointer < origin : pointer > origin;

  return hasRoom && behindPointer ? movement : 0;
};

export function useMinimapScroll(ctx: Ctx) {
  const app = useAppContext(ctx);
  const state = observable({
    selected: false,
  });

  let clientX = 0;
  let clientY = 0;

  /**
   * Minimap travel as the scroll the canvas has to take to follow it. The
   * minimap is drawn at a fixed ratio, so the canvas distance is zoom free; the
   * scroll that covers it is not, because a scroll pixel is a screen pixel.
   */
  const absoluteMovement = (movement: number) => {
    const { store } = app.value;
    const {
      settings: { width, zoomLevel },
    } = store.state;

    return toScrollMovement(movement, getMinimapRatio(width), zoomLevel);
  };

  const getMovementX = ({ movementX, x }: DragMove) => {
    const { store } = app.value;
    const {
      settings,
      editor: { viewport },
    } = store.state;
    const movement = takeMovement(
      movementX,
      x,
      clientX,
      settings.scrollLeft,
      getScrollRanges(settings, viewport).left
    );

    clientX += movement;
    return movement;
  };

  const getMovementY = ({ movementY, y }: DragMove) => {
    const { store } = app.value;
    const {
      settings,
      editor: { viewport },
    } = store.state;
    const movement = takeMovement(
      movementY,
      y,
      clientY,
      settings.scrollTop,
      getScrollRanges(settings, viewport).top
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

    const { store } = app.value;
    store.dispatch(
      streamScrollToAction({
        movementX: absoluteMovement(movementX),
        movementY: absoluteMovement(movementY),
      })
    );
  };

  const onScrollStart = (event: MouseEvent | TouchEvent) => {
    state.selected = true;

    clientX = isMouseEvent(event) ? event.clientX : event.touches[0].clientX;
    clientY = isMouseEvent(event) ? event.clientY : event.touches[0].clientY;

    drag$.subscribe({
      next: handleScroll,
      complete: () => {
        state.selected = false;
      },
    });
  };

  return {
    state,
    onScrollStart,
  };
}
