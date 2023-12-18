import {
  debounceTime,
  fromEvent,
  map,
  merge,
  takeUntil,
  throttleTime,
} from 'rxjs';

export const fromShadowDraggable = <R>(
  elements: HTMLElement[],
  prepare: (el: HTMLElement) => R
) =>
  merge(
    ...elements.map(el =>
      fromEvent<DragEvent>(el, 'dragover').pipe(
        throttleTime(300),
        map(() => prepare(el))
      )
    )
  ).pipe(
    debounceTime(50),
    takeUntil(merge(...elements.map(el => fromEvent<DragEvent>(el, 'dragend'))))
  );
