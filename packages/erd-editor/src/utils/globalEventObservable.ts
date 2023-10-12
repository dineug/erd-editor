import { filter, fromEvent, map, merge, takeUntil } from 'rxjs';

export const mousedown$ = fromEvent<MouseEvent>(window, 'mousedown');
export const mousemove$ = fromEvent<MouseEvent>(window, 'mousemove');
export const mouseup$ = fromEvent<MouseEvent>(window, 'mouseup');
export const touchstart$ = fromEvent<TouchEvent>(window, 'touchstart');
export const touchmove$ = fromEvent<TouchEvent>(window, 'touchmove');
export const touchend$ = fromEvent<TouchEvent>(window, 'touchend');

export type DragMove = {
  movementX: number;
  movementY: number;
  x: number;
  y: number;
  event: MouseEvent | TouchEvent;
};

let touchX = 0;
let touchY = 0;
const subscription = touchstart$.subscribe(event => {
  touchX = event.touches[0].clientX;
  touchY = event.touches[0].clientY;
});

export const move$ = merge(
  mousemove$.pipe(
    map(event => {
      let movementX = event.movementX;
      let movementY = event.movementY;
      // bug: OS windows10 - event.movementX / window.devicePixelRatio
      // if (isRatio) {
      //   movementX = event.movementX / window.devicePixelRatio;
      //   movementY = event.movementY / window.devicePixelRatio;
      // }
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

export const moveStart$ = merge(mousedown$, touchstart$);
export const moveEnd$ = merge(mouseup$, touchend$);
export const drag$ = move$.pipe(takeUntil(moveEnd$));
