import { fromEvent, merge } from 'rxjs';
import { debounceTime, takeUntil, throttleTime } from 'rxjs/operators';

export const fromDraggable = (elements: Element[]) =>
  merge(
    ...elements.map(el =>
      fromEvent<DragEvent>(el, 'dragover').pipe(throttleTime(300))
    )
  ).pipe(
    debounceTime(50),
    takeUntil(merge(...elements.map(el => fromEvent<DragEvent>(el, 'dragend'))))
  );
