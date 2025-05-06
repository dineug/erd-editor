import { type Draft, produce } from 'immer';
import { distinctUntilChanged, map, Observable, Subject } from 'rxjs';

import type { LWW } from './lww';

export type SegmentOptions<T> = {
  initialState: T;
};

export type SegmentMapType<T = any> = {
  [P in keyof T]: T[P] extends SegmentOptions<infer U> ? U : unknown;
};

export class Segment<T> {
  #entity: T;
  #notifier = new Subject<T>();
  #key: string;
  #options: SegmentOptions<T>;
  #lww: LWW;

  get key(): string {
    return this.#key;
  }

  constructor(key: string, options: SegmentOptions<T>, lww: LWW) {
    this.#key = key;
    this.#options = options;
    this.#entity = this.#options.initialState;
    this.#lww = lww;
  }

  #dispatch = (): this => {
    this.#notifier.next(this.#entity);
    return this;
  };

  readonly get = (): T => {
    return this.#entity;
  };

  readonly set = (recipe: (draft: Draft<T>) => void): this => {
    const nextEntity = produce(this.#entity, draft => {
      recipe(draft);
    });

    if (this.#entity !== nextEntity) {
      this.#entity = nextEntity;
      this.#dispatch();
    }

    return this;
  };

  readonly toObservable: {
    <R>(selector: (value: T) => R): Observable<R>;
    (): Observable<T>;
  } = (selector?: (value: T) => unknown): Observable<any> => {
    const obs = new Observable<T>(subscriber => {
      subscriber.next(this.get());

      return this.#notifier.subscribe({
        next: value => subscriber.next(value),
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
    });

    return selector
      ? obs.pipe(map(selector), distinctUntilChanged())
      : obs.pipe(distinctUntilChanged());
  };

  readonly replaceOperator = (
    path: string,
    version: number | undefined,
    recipe: () => void
  ): this => {
    this.#lww.replace(this.key, path, version, recipe);
    return this;
  };
}

export function createSegment<T>(
  options: SegmentOptions<T>
): SegmentOptions<T> {
  return options;
}
