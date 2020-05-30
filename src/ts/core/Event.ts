import {
  fromEvent,
  Observable,
  merge,
  of,
  animationFrameScheduler,
} from "rxjs";
import { repeat, map } from "rxjs/operators";

export interface Move {
  movementX: number;
  movementY: number;
  x: number;
  y: number;
  event: MouseEvent | TouchEvent;
}
export interface WindowEventObservable {
  requestAnimationFrame$: Observable<null>;
  keydown$: Observable<KeyboardEvent>;
  mousedown$: Observable<MouseEvent>;
  mouseup$: Observable<MouseEvent>;
  mousemove$: Observable<MouseEvent>;
  touchstart$: Observable<TouchEvent>;
  touchend$: Observable<TouchEvent>;
  touchmove$: Observable<TouchEvent>;
  move$: Observable<Move>;
  moveEnd$: Observable<MouseEvent | TouchEvent>;
  destroy(): void;
}

export function createWindowEventObservable(): WindowEventObservable {
  const mousemove$ = fromEvent<MouseEvent>(window, "mousemove");
  const touchmove$ = fromEvent<TouchEvent>(window, "touchmove");
  const mouseup$ = fromEvent<MouseEvent>(window, "mouseup");
  const touchend$ = fromEvent<TouchEvent>(window, "touchend");
  const touchstart$ = fromEvent<TouchEvent>(window, "touchstart");
  let touchX = 0;
  let touchY = 0;
  const subTouchstart = touchstart$.subscribe((event) => {
    touchX = event.touches[0].clientX;
    touchY = event.touches[0].clientY;
  });
  return {
    requestAnimationFrame$: of(null, animationFrameScheduler).pipe(repeat()),
    keydown$: fromEvent<KeyboardEvent>(window, "keydown"),
    mousedown$: fromEvent<MouseEvent>(window, "mousedown"),
    mouseup$,
    mousemove$,
    touchstart$,
    touchend$,
    touchmove$,
    move$: merge(
      mousemove$.pipe(
        map((event) => {
          let movementX = event.movementX / window.devicePixelRatio;
          let movementY = event.movementY / window.devicePixelRatio;
          // firefox
          if (
            window.navigator.userAgent.toLowerCase().indexOf("firefox") !== -1
          ) {
            movementX = event.movementX;
            movementY = event.movementY;
          }
          return {
            movementX,
            movementY,
            x: event.clientX,
            y: event.clientY,
            event,
          };
        })
      ),
      touchmove$.pipe(
        map((event) => {
          const movementX = event.touches[0].clientX - touchX;
          const movementY = event.touches[0].clientY - touchY;
          touchX = event.touches[0].clientX;
          touchY = event.touches[0].clientY;
          return {
            movementX,
            movementY,
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
            event,
          };
        })
      )
    ),
    moveEnd$: merge(mouseup$, touchend$),
    destroy() {
      subTouchstart.unsubscribe();
    },
  };
}

export class EventBus {
  private bus = document.createElement("div");
  on(eventName: string): Observable<CustomEvent> {
    return new Observable<CustomEvent>((observer) => {
      const handler = (event: any) => observer.next(event);
      this.bus.addEventListener(eventName, handler);
      return () => this.bus.removeEventListener(eventName, handler);
    });
  }
  emit(eventName: string, detail?: any) {
    this.bus.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
      })
    );
  }
}

enum Editor {
  importErrorDDL = "Editor.importErrorDDL",
}

enum ERD {
  contextmenuEnd = "ERD.contextmenuEnd",
}

enum ColumnDataTypeHint {
  arrowUp = "ColumnDataTypeHint.arrowUp",
  arrowDown = "ColumnDataTypeHint.arrowDown",
  arrowRight = "ColumnDataTypeHint.arrowRight",
  arrowLeft = "ColumnDataTypeHint.arrowLeft",
  startFilter = "ColumnDataTypeHint.startFilter",
}

enum Visualization {
  startPreview = "Visualization.startPreview",
  endPreview = "Visualization.endPreview",
  dragStart = "Visualization.dragStart",
  dragEnd = "Visualization.dragEnd",
}

enum Table {
  moveValid = "Table.moveValid",
}

enum Memo {
  moveValid = "Memo.moveValid",
}

enum Help {
  close = "Help.close",
}

enum ImportErrorDDL {
  close = "ImportErrorDDL.close",
}

enum Setting {
  close = "Setting.close",
}

enum Menubar {
  filter = "Menubar.filter",
  find = "Menubar.find",
}

enum Filter {
  close = "Filter.close",
}

enum Find {
  close = "Find.close",
}

export const Bus = {
  Editor,
  ERD,
  ColumnDataTypeHint,
  Visualization,
  Table,
  Memo,
  Help,
  ImportErrorDDL,
  Setting,
  Menubar,
  Filter,
  Find,
};
