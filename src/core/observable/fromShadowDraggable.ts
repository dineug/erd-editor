import { merge, fromEvent } from 'rxjs';
import { throttleTime, debounceTime, takeUntil, map } from 'rxjs/operators';

export const fromShadowDraggable = (elements: HTMLElement[]) =>
  merge(
    ...elements.map(el =>
      fromEvent<DragEvent>(el, 'dragover').pipe(
        throttleTime(300),
        map(() => el.dataset.id as string)
      )
    )
  ).pipe(
    debounceTime(50),
    takeUntil(merge(...elements.map(el => fromEvent<DragEvent>(el, 'dragend'))))
  );
