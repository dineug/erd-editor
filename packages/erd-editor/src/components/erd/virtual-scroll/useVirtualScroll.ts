import { observable } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  getScrollRanges,
  ScrollRange,
  streamScrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { Ctx } from '@/internal-types';
import { drag$, DragMove } from '@/utils/globalEventObservable';

/** One scrollbar as drawn: a track a viewport wide over the content behind it. */
export type ScrollbarTrack = {
  range: ScrollRange;
  ratio: number;
  thumb: number;
  offset: number;
  scrollable: boolean;
};

/**
 * The bar for one axis, sized from the travel the engine allows rather than from
 * the canvas box. The content behind the track is a viewport plus that travel,
 * which is the only place the zoom enters, and at zoom 1 the two read the same.
 */
export function getScrollbarTrack(
  range: ScrollRange,
  scroll: number,
  viewportLength: number
): ScrollbarTrack {
  const travel = range.max - range.min;
  const content = viewportLength + travel;
  const ratio = content > 0 ? viewportLength / content : 1;

  return {
    range,
    ratio,
    thumb: viewportLength * ratio,
    offset: (range.max - scroll) * ratio,
    scrollable: travel > 0,
  };
}

/** The scroll that centres the viewport on a point pressed on a track. */
export function trackPointToScroll(
  { range, ratio }: ScrollbarTrack,
  point: number,
  viewportLength: number
): number {
  return range.max - (point / ratio - viewportLength / 2);
}

export function useVirtualScroll(ctx: Ctx) {
  const app = useAppContext(ctx);
  const state = observable({
    selected: null as null | 'horizontal' | 'vertical',
  });

  let clientX = 0;
  let clientY = 0;

  const getHorizontalTrack = (): ScrollbarTrack => {
    const { store } = app.value;
    const {
      settings,
      editor: { viewport },
    } = store.state;

    return getScrollbarTrack(
      getScrollRanges(settings, viewport).left,
      settings.scrollLeft,
      viewport.width
    );
  };

  const getVerticalTrack = (): ScrollbarTrack => {
    const { store } = app.value;
    const {
      settings,
      editor: { viewport },
    } = store.state;

    return getScrollbarTrack(
      getScrollRanges(settings, viewport).top,
      settings.scrollTop,
      viewport.height
    );
  };

  const getWidthRatio = () => getHorizontalTrack().ratio;
  const getHeightRatio = () => getVerticalTrack().ratio;

  const absoluteMovement = (movement: number, ratio: number) => {
    return -1 * (movement / ratio);
  };

  /**
   * Whether this step of the drag is the thumb's to take. The room is read off
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
    const isVertical = state.selected === 'vertical';
    const isHorizontal = state.selected === 'horizontal';
    const movementX = getMovementX(dragMove);
    const movementY = getMovementY(dragMove);
    const { store } = app.value;

    if (isVertical && movementY !== 0) {
      store.dispatch(
        streamScrollToAction({
          movementX: 0,
          movementY: absoluteMovement(movementY, getHeightRatio()),
        })
      );
    } else if (isHorizontal && movementX !== 0) {
      store.dispatch(
        streamScrollToAction({
          movementX: absoluteMovement(movementX, getWidthRatio()),
          movementY: 0,
        })
      );
    }
  };

  const onScrollLeftStart = (event: MouseEvent) => {
    state.selected = 'horizontal';
    clientX = event.clientX;

    drag$.subscribe({
      next: handleScroll,
      complete: () => {
        state.selected = null;
      },
    });
  };

  const onScrollTopStart = (event: MouseEvent) => {
    state.selected = 'vertical';
    clientY = event.clientY;

    drag$.subscribe({
      next: handleScroll,
      complete: () => {
        state.selected = null;
      },
    });
  };

  return {
    state,
    onScrollLeftStart,
    onScrollTopStart,
    getWidthRatio,
    getHeightRatio,
    getHorizontalTrack,
    getVerticalTrack,
  };
}
