import { observable } from '@dineug/r-html';
import { Subscription } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { useSceneSource } from '@/components/sceneSourceContext';
import {
  clampScrollMovement,
  getScrollRanges,
  sceneStreamScrollToAction,
  ScrollRange,
} from '@/engine/modules/settings/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Ctx } from '@/internal-types';
import { freezeView, thawView } from '@/konva/scene/viewFreeze';
import { getSceneTransform } from '@/konva/scene/viewport';
import { drag$, DragMove } from '@/utils/globalEventObservable';

/** The thumb never draws thinner than this, however long the travel behind it. */
export const SCROLLBAR_THUMB_MIN = 24;

/** One scrollbar as drawn: a track a viewport long over the travel behind it. */
export type ScrollbarTrack = {
  range: ScrollRange;
  /** Thumb pixels per origin pixel: the room the thumb has over the travel. */
  ratio: number;
  thumb: number;
  offset: number;
  scrollable: boolean;
};

/**
 * The bar for one axis, sized from the travel the engine allows. The thumb is
 * the screen's share of a screen plus that travel, floored so a long travel
 * still leaves something to grab, and slides over the room the floor leaves it.
 */
export function getScrollbarTrack(
  range: ScrollRange,
  scroll: number,
  viewportLength: number
): ScrollbarTrack {
  const travel = range.max - range.min;
  const content = viewportLength + travel;
  const share = content > 0 ? viewportLength / content : 1;
  const thumb = Math.min(
    viewportLength,
    Math.max(SCROLLBAR_THUMB_MIN, viewportLength * share)
  );
  const room = viewportLength - thumb;
  const scrollable = travel > 0 && room > 0;
  const ratio = scrollable ? room / travel : 1;

  return {
    range,
    ratio,
    thumb,
    offset: scrollable ? (range.max - scroll) * ratio : 0,
    scrollable,
  };
}

/**
 * The origin that centres the thumb on a point pressed on the track, kept to
 * the travel: a press at either end parks the thumb against it.
 */
export function trackPointToScroll(
  { range, ratio, thumb }: ScrollbarTrack,
  point: number,
  viewportLength: number
): number {
  const room = viewportLength - thumb;
  const offset = Math.min(Math.max(point - thumb / 2, 0), room);

  return room > 0 ? range.max - offset / ratio : range.max;
}

export function useVirtualScroll(ctx: Ctx) {
  const app = useAppContext(ctx);
  const sourceRef = useSceneSource(ctx);
  const { addUnsubscribe } = useUnmounted();
  const state = observable({
    selected: null as null | 'horizontal' | 'vertical',
  });

  let clientX = 0;
  let clientY = 0;
  let drag: Subscription | null = null;
  addUnsubscribe(() => drag?.unsubscribe());

  const getHorizontalTrack = (): ScrollbarTrack => {
    const { store } = app.value;
    const source = sourceRef.value;
    const { viewport } = store.state.editor;

    return getScrollbarTrack(
      getScrollRanges(store.state, source).left,
      getSceneTransform(store.state, source).originX,
      viewport.width
    );
  };

  const getVerticalTrack = (): ScrollbarTrack => {
    const { store } = app.value;
    const source = sourceRef.value;
    const { viewport } = store.state.editor;

    return getScrollbarTrack(
      getScrollRanges(store.state, source).top,
      getSceneTransform(store.state, source).originY,
      viewport.height
    );
  };

  const getWidthRatio = () => getHorizontalTrack().ratio;
  const getHeightRatio = () => getVerticalTrack().ratio;

  const absoluteMovement = (movement: number, ratio: number) => {
    return ratio > 0 ? -1 * (movement / ratio) : 0;
  };

  /**
   * Whether this step of the drag is the thumb's to take. The room is read off
   * the origin as it stands rather than off where the step would land, so the
   * last partial step is taken and cut to the end of the travel instead of dropped.
   */
  const getMovementX = ({ movementX, x }: DragMove) => {
    const { store } = app.value;
    const source = sourceRef.value;
    const { originX } = getSceneTransform(store.state, source);
    const { min, max } = getScrollRanges(store.state, source).left;
    const toLeft = movementX < 0;
    const hasRoom = toLeft ? originX < max : originX > min;
    const behindPointer = toLeft ? x < clientX : x > clientX;

    if (!hasRoom || !behindPointer) {
      return 0;
    }

    clientX += movementX;
    return movementX;
  };

  const getMovementY = ({ movementY, y }: DragMove) => {
    const { store } = app.value;
    const source = sourceRef.value;
    const { originY } = getSceneTransform(store.state, source);
    const { min, max } = getScrollRanges(store.state, source).top;
    const toTop = movementY < 0;
    const hasRoom = toTop ? originY < max : originY > min;
    const behindPointer = toTop ? y < clientY : y > clientY;

    if (!hasRoom || !behindPointer) {
      return 0;
    }

    clientY += movementY;
    return movementY;
  };

  const scrollBy = (movementX: number, movementY: number) => {
    const { store } = app.value;
    const source = sourceRef.value;

    // The reducer takes a step as it is, so the thumb is what keeps its drag
    // inside the travel it is drawn over: the step is cut to the hull here.
    store.dispatch(
      sceneStreamScrollToAction(
        source,
        clampScrollMovement(store.state, { movementX, movementY }, source)
      )
    );
  };

  const handleScroll = (dragMove: DragMove) => {
    const { event } = dragMove;
    event.type === 'mousemove' && event.preventDefault();
    const isVertical = state.selected === 'vertical';
    const isHorizontal = state.selected === 'horizontal';
    const movementX = getMovementX(dragMove);
    const movementY = getMovementY(dragMove);

    if (isVertical && movementY !== 0) {
      scrollBy(0, absoluteMovement(movementY, getHeightRatio()));
    } else if (isHorizontal && movementX !== 0) {
      scrollBy(absoluteMovement(movementX, getWidthRatio()), 0);
    }
  };

  /**
   * The drag scales against the travel as it stood on the press. Held for its
   * duration, so the thumb cannot grow under the pointer as the origin closes
   * in on the content, which would change what the next pixel is worth.
   */
  const startDrag = (selected: 'horizontal' | 'vertical') => {
    const { store } = app.value;
    state.selected = selected;
    const source = sourceRef.value;
    freezeView(store.state, source);

    // A finalizer runs on the release and on an unmount mid-drag alike, where
    // a complete handler would run on the release alone and leave the view held.
    const subscription = drag$.subscribe(handleScroll);
    subscription.add(() => {
      if (drag === subscription) drag = null;
      state.selected = null;
      thawView(store.state, source);
    });
    drag = subscription;
  };

  const onScrollLeftStart = (event: MouseEvent) => {
    clientX = event.clientX;
    startDrag('horizontal');
  };

  const onScrollTopStart = (event: MouseEvent) => {
    clientY = event.clientY;
    startDrag('vertical');
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
