import { filter, fromEvent, map, merge, takeUntil } from 'rxjs';

import { isMouseEvent } from '@/utils/domEvent';
import { forwardMoveStartEvent } from '@/utils/internalEvents';

export const keyup$ = fromEvent<KeyboardEvent>(window, 'keyup');

export const mousedown$ = fromEvent<MouseEvent>(window, 'mousedown');
export const mousemove$ = fromEvent<MouseEvent>(window, 'mousemove');
export const mouseup$ = fromEvent<MouseEvent>(window, 'mouseup');

export const touchstart$ = fromEvent<TouchEvent>(window, 'touchstart');
export const touchmove$ = fromEvent<TouchEvent>(window, 'touchmove');
export const touchend$ = fromEvent<TouchEvent>(window, 'touchend');

const forwardMoveStartEvent$ = fromEvent<
  CustomEvent<ReturnType<typeof forwardMoveStartEvent>['detail']>
>(window, forwardMoveStartEvent.type).pipe(
  map(event => event.detail.originEvent)
);

export const moveStart$ = merge(
  mousedown$,
  touchstart$,
  forwardMoveStartEvent$
);
export const moveEnd$ = merge(mouseup$, touchend$);

let prevX = 0;
let prevY = 0;

const subscription = moveStart$.subscribe(event => {
  if (isMouseEvent(event)) {
    prevX = event.clientX;
    prevY = event.clientY;
  } else {
    prevX = event.touches[0].clientX;
    prevY = event.touches[0].clientY;
  }
});

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
