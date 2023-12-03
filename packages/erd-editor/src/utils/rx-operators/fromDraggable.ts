import { debounceTime, fromEvent, merge, takeUntil, throttleTime } from 'rxjs';

export const fromDraggable = (elements: Element[]) =>
  merge(
    ...elements.map(el =>
      fromEvent<DragEvent>(el, 'dragover').pipe(throttleTime(300))
    )
  ).pipe(
    debounceTime(50),
    takeUntil(merge(...elements.map(el => fromEvent<DragEvent>(el, 'dragend'))))
  );
