import {
  debounceTime,
  fromEvent,
  map,
  merge,
  takeUntil,
  throttleTime,
} from 'rxjs';

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
