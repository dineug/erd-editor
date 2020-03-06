import { fromEvent, Observable } from "rxjs";

export interface WindowEventObservable {
  mouseup$: Observable<MouseEvent>;
  mousemove$: Observable<MouseEvent>;
  touchmove$: Observable<TouchEvent>;
  touchend$: Observable<TouchEvent>;
  keydown$: Observable<KeyboardEvent>;
}

export function createWindowEventObservable(): WindowEventObservable {
  return {
    mouseup$: fromEvent<MouseEvent>(window, "mouseup"),
    mousemove$: fromEvent<MouseEvent>(window, "mousemove"),
    touchmove$: fromEvent<TouchEvent>(window, "touchmove"),
    touchend$: fromEvent<TouchEvent>(window, "touchend"),
    keydown$: fromEvent<KeyboardEvent>(window, "keydown")
  };
}
