import { fromEvent, merge } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

import { GlobalEventObservable } from '@/internal-types/event.helper';

export type DragMove = {
  event: MouseEvent | TouchEvent;
  movementX: number;
  movementY: number;
  x: number;
  y: number;
};

export function createGlobalEventObservable(): GlobalEventObservable {
  const mousedown$ = fromEvent<MouseEvent>(window, 'mousedown');
  const mousemove$ = fromEvent<MouseEvent>(window, 'mousemove');
  const mouseup$ = fromEvent<MouseEvent>(window, 'mouseup');
  const touchstart$ = fromEvent<TouchEvent>(window, 'touchstart');
  const touchmove$ = fromEvent<TouchEvent>(window, 'touchmove');
  const touchend$ = fromEvent<TouchEvent>(window, 'touchend');

  let touchX = 0;
  let touchY = 0;
  const subscription = touchstart$.subscribe(event => {
    touchX = event.touches[0].clientX;
    touchY = event.touches[0].clientY;
  });

  const move$ = merge(
    mousemove$.pipe(
      map(event => {
        const movementX = event.movementX;
        const movementY = event.movementY;
        return {
          event,
          movementX,
          movementY,
          x: event.clientX,
          y: event.clientY,
        };
      })
    ),
    touchmove$.pipe(
      filter(event => event.touches.length === 1),
      map(event => {
        const movementX = event.touches[0].clientX - touchX;
        const movementY = event.touches[0].clientY - touchY;
        touchX = event.touches[0].clientX;
        touchY = event.touches[0].clientY;
        return {
          event,
          movementX,
          movementY,
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      })
    )
  );
  const moveStart$ = merge(mousedown$, touchstart$);
  const moveEnd$ = merge(mouseup$, touchend$);
  const drag$ = move$.pipe(takeUntil(moveEnd$));

  return {
    mousedown$,
    mouseup$,
    mousemove$,
    touchstart$,
    touchend$,
    touchmove$,
    moveStart$,
    moveEnd$,
    move$,
    drag$,
    destroy() {
      subscription.unsubscribe();
    },
  };
}
