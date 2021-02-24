import { Observable } from 'rxjs';

export interface Move {
  movementX: number;
  movementY: number;
  x: number;
  y: number;
  event: MouseEvent | TouchEvent;
}

export interface GlobalEventObservable {
  mousedown$: Observable<MouseEvent>;
  mouseup$: Observable<MouseEvent>;
  mousemove$: Observable<MouseEvent>;
  touchstart$: Observable<TouchEvent>;
  touchend$: Observable<TouchEvent>;
  touchmove$: Observable<TouchEvent>;
  moveStart$: Observable<MouseEvent | TouchEvent>;
  moveEnd$: Observable<MouseEvent | TouchEvent>;
  move$: Observable<Move>;
  drag$: Observable<Move>;
  destroy(): void;
}
