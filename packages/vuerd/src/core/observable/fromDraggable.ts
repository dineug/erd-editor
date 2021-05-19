import { merge, fromEvent } from 'rxjs';
import { throttleTime, debounceTime, takeUntil } from 'rxjs/operators';

export const fromDraggable = (elements: Element[]) =>
  merge(
    ...elements.map(el =>
      fromEvent<DragEvent>(el, 'dragover').pipe(throttleTime(300))
    )
  ).pipe(
    debounceTime(50),
    takeUntil(merge(...elements.map(el => fromEvent<DragEvent>(el, 'dragend'))))
  );
