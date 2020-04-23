import { fromEvent, Observable } from "rxjs";

export interface WindowEventObservable {
  mousedown$: Observable<MouseEvent>;
  mouseup$: Observable<MouseEvent>;
  mousemove$: Observable<MouseEvent>;
  touchmove$: Observable<TouchEvent>;
  touchend$: Observable<TouchEvent>;
  keydown$: Observable<KeyboardEvent>;
}

export function createWindowEventObservable(): WindowEventObservable {
  return {
    mousedown$: fromEvent<MouseEvent>(window, "mousedown"),
    mouseup$: fromEvent<MouseEvent>(window, "mouseup"),
    mousemove$: fromEvent<MouseEvent>(window, "mousemove"),
    touchmove$: fromEvent<TouchEvent>(window, "touchmove"),
    touchend$: fromEvent<TouchEvent>(window, "touchend"),
    keydown$: fromEvent<KeyboardEvent>(window, "keydown"),
  };
}

export class EventBus {
  private bus = document.createElement("div");
  on(name: string, effect: (event: any) => void) {
    this.bus.addEventListener(name, effect);
  }
  off(name: string, effect: (event: any) => void) {
    this.bus.removeEventListener(name, effect);
  }
  emit(name: string, detail?: any) {
    this.bus.dispatchEvent(
      new CustomEvent(name, {
        detail,
      })
    );
  }
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

export const Bus = {
  ERD,
  ColumnDataTypeHint,
  Visualization,
};
