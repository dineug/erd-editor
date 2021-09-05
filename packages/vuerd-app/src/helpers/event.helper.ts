import { fromEvent, merge } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

export interface Move {
  movementX: number;
  movementY: number;
  x: number;
  y: number;
  event: MouseEvent | TouchEvent;
}

const userAgent = window.navigator.userAgent.toLowerCase();
const isRatio = ['macintosh', 'firefox'].every(
  target => userAgent.indexOf(target) === -1
);

function createGlobalEventObservable() {
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
        let movementX = event.movementX;
        let movementY = event.movementY;
        if (isRatio) {
          movementX = event.movementX / window.devicePixelRatio;
          movementY = event.movementY / window.devicePixelRatio;
        }
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

export const globalEvent = createGlobalEventObservable();
