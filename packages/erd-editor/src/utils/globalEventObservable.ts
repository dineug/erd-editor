import {
  animationFrames,
  defer,
  filter,
  fromEvent,
  map,
  merge,
  Observable,
  share,
  takeUntil,
} from 'rxjs';

import { isMouseEvent } from '@/utils/domEvent';
import { forwardMoveStartEvent } from '@/utils/internalEvents';

/**
 * Reads the global at subscription time instead of at module evaluation, so a
 * realm without a window can still import this module. defer and fromEvent are
 * both cold, so a subscriber still adds one listener and drops it on teardown.
 */
function windowEvent$<T extends Event>(type: string): Observable<T> {
  return defer(() => fromEvent<T>(window, type));
}

export const keyup$ = windowEvent$<KeyboardEvent>('keyup');

export const mousedown$ = windowEvent$<MouseEvent>('mousedown');
export const mousemove$ = windowEvent$<MouseEvent>('mousemove');
export const mouseup$ = windowEvent$<MouseEvent>('mouseup');

export const touchstart$ = windowEvent$<TouchEvent>('touchstart');
export const touchmove$ = windowEvent$<TouchEvent>('touchmove');
export const touchend$ = windowEvent$<TouchEvent>('touchend');

export const animationFrames$ = animationFrames().pipe(share());

const forwardMoveStartEvent$ = windowEvent$<
  CustomEvent<ReturnType<typeof forwardMoveStartEvent>['detail']>
>(forwardMoveStartEvent.type).pipe(map(event => event.detail.originEvent));

export const moveStart$ = merge(
  mousedown$,
  touchstart$,
  forwardMoveStartEvent$
);
export const moveEnd$ = merge(mouseup$, touchend$);

let prevX = 0;
let prevY = 0;

// The one subscription this module opens itself, and the only reason importing
// it has an effect at all. It anchors the deltas below and stays open for the
// life of the realm, so the guard is what a realm without a window skips.
if (typeof window !== 'undefined') {
  moveStart$.subscribe(event => {
    if (isMouseEvent(event)) {
      prevX = event.clientX;
      prevY = event.clientY;
    } else {
      prevX = event.touches[0].clientX;
      prevY = event.touches[0].clientY;
    }
  });
}

export type DragMove = {
  movementX: number;
  movementY: number;
  x: number;
  y: number;
  event: MouseEvent | TouchEvent;
};

export const move$ = merge(
  mousemove$.pipe(
    map(event => {
      const x = event.clientX;
      const y = event.clientY;
      const movementX = x - prevX;
      const movementY = y - prevY;
      prevX = x;
      prevY = y;
      return {
        event,
        movementX,
        movementY,
        x,
        y,
      };
    })
  ),
  touchmove$.pipe(
    filter(event => event.touches.length === 1),
    map(event => {
      const x = event.touches[0].clientX;
      const y = event.touches[0].clientY;
      const movementX = x - prevX;
      const movementY = y - prevY;
      prevX = x;
      prevY = y;
      return {
        event,
        movementX,
        movementY,
        x,
        y,
      };
    })
  )
);

export const drag$ = move$.pipe(takeUntil(moveEnd$));
