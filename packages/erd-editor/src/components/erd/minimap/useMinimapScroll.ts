import { observable } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  getMinimapRatio,
  toScrollMovement,
} from '@/components/erd/minimap/minimapGeometry';
import {
  getScrollRanges,
  streamScrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { Ctx } from '@/internal-types';
import { isMouseEvent } from '@/utils/domEvent';
import { drag$, DragMove } from '@/utils/globalEventObservable';

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

  /**
   * Whether this step of the drag is the handle's to take. The room is read off
   * the scroll as it stands rather than off where the step would land, so the
   * last partial step reaches the reducer and is clamped instead of dropped.
   */
  const getMovementX = ({ movementX, x }: DragMove) => {
    const { store } = app.value;
    const {
      settings,
      editor: { viewport },
    } = store.state;
    const { min, max } = getScrollRanges(settings, viewport).left;
    const toLeft = movementX < 0;
    const hasRoom = toLeft
      ? settings.scrollLeft < max
      : settings.scrollLeft > min;
    const behindPointer = toLeft ? x < clientX : x > clientX;

    if (!hasRoom || !behindPointer) {
      return 0;
    }

    clientX += movementX;
    return movementX;
  };

  const getMovementY = ({ movementY, y }: DragMove) => {
    const { store } = app.value;
    const {
      settings,
      editor: { viewport },
    } = store.state;
    const { min, max } = getScrollRanges(settings, viewport).top;
    const toTop = movementY < 0;
    const hasRoom = toTop ? settings.scrollTop < max : settings.scrollTop > min;
    const behindPointer = toTop ? y < clientY : y > clientY;

    if (!hasRoom || !behindPointer) {
      return 0;
    }

    clientY += movementY;
    return movementY;
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
