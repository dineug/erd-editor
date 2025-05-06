import { type Draft, produce } from 'immer';
import { distinctUntilChanged, map, Observable, Subject } from 'rxjs';

import type { LWW } from './lww';

export type CollectionOptions<T> = {
  selectId: (entity: T) => string;
};

export type CollectionMapType<T = any> = {
  [P in keyof T]: T[P] extends CollectionOptions<infer U> ? U : unknown;
};

export class Collection<T> {
  #entities = new Map<string, T>();
  #notifierMap = new Map<string, Subject<T | undefined>>();
  #key: string;
  #options: CollectionOptions<T>;
  #lww: LWW;

  get key(): string {
    return this.#key;
  }

  get #ids(): string[] {
    return [...this.#entities.keys()];
  }

  constructor(key: string, options: CollectionOptions<T>, lww: LWW) {
    this.#key = key;
    this.#options = options;
    this.#lww = lww;
  }

  #selectId = (entity: T): string => {
    return this.#options.selectId(entity);
  };

  #dispatch = (id: string): this => {
    const subject = this.#notifierMap.get(id);

    if (subject) {
      const entity = this.selectById(id);
      subject.next(entity);
    }

    return this;
  };

  readonly has = (id: string, predicate?: (value: T) => boolean): boolean => {
    if (!this.#entities.has(id)) {
      return false;
    }

    const entity = this.#entities.get(id) as T;
    return predicate ? predicate(entity) : true;
  };

  readonly selectById = (id: string): T | undefined => {
    return this.#entities.get(id);
  };

  readonly selectByIds = (ids: string[]): Array<T> => {
    const result: Array<T> = [];

    ids.forEach(id => {
      const entity = this.selectById(id);
      entity && result.push(entity);
    });

    return result;
  };

  readonly selectAll = (): Array<T> => {
    return this.selectByIds(this.#ids);
  };

  readonly selectEntities = (): Record<string, T> => {
    return [...this.#entities].reduce(
      (acc: Record<string, T>, [id, entity]) => {
        acc[id] = entity;
        return acc;
      },
      {}
    );
  };

  readonly removeOne = (id: string): this => {
    if (this.has(id)) {
      this.#entities.delete(id);
      this.#dispatch(id);
    }
    return this;
  };

  readonly removeMany = (ids: string[]): this => {
    ids.forEach(this.removeOne);
    return this;
  };

  readonly removeAll = (): this => {
    this.removeMany(this.#ids);
    return this;
  };

  readonly setOne = (entity: T): this => {
    const id = this.#selectId(entity);
    this.#entities.set(id, entity);
    this.#dispatch(id);
    return this;
  };

  readonly setMany = (entries: Array<T>): this => {
    entries.forEach(this.setOne);
    return this;
  };

  readonly setAll = (entries: Array<T>): this => {
    this.removeAll();
    this.setMany(entries);
    return this;
  };

  readonly addOne = (entity: T): this => {
    const id = this.#selectId(entity);
    !this.has(id) && this.setOne(entity);
    return this;
  };

  readonly addMany = (entries: Array<T>): this => {
    entries.forEach(this.addOne);
    return this;
  };

  readonly updateOne = (
    id: string,
    recipe: (draft: Draft<T>) => void
  ): this => {
    const entity = this.selectById(id);

    if (entity) {
      const nextEntity = produce(entity, draft => {
        recipe(draft);
      });
      entity !== nextEntity && this.setOne(nextEntity);
    }

    return this;
  };

  readonly updateMany = (
    ids: string[],
    recipe: (draft: Draft<T>) => void
  ): this => {
    ids.forEach(id => this.updateOne(id, recipe));
    return this;
  };

  readonly toObservable: {
    <R>(id: string, selector: (value: T) => R): Observable<R | undefined>;
    (id: string): Observable<T | undefined>;
  } = (id: string, selector?: (value: T) => unknown): Observable<any> => {
    const notifier = this.#notifierMap.get(id) ?? new Subject();

    if (!this.#notifierMap.has(id)) {
      this.#notifierMap.set(id, notifier);
    }

    const obs = new Observable<T | undefined>(subscriber => {
      subscriber.next(this.selectById(id));

      return notifier.subscribe({
        next: value => subscriber.next(value),
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
    });

    return selector
      ? obs.pipe(
          map(value => (value === undefined ? value : selector(value))),
          distinctUntilChanged()
        )
      : obs.pipe(distinctUntilChanged());
  };

  readonly addOperator = (
    id: string,
    version: number | undefined,
    recipe: () => void
  ): this => {
    this.#lww.add(id, version, recipe);
    return this;
  };

  readonly removeOperator = (
    id: string,
    version: number | undefined,
    recipe: () => void
  ): this => {
    this.#lww.remove(id, version, recipe);
    return this;
  };

  readonly replaceOperator = (
    id: string,
    path: string,
    version: number | undefined,
    recipe: () => void
  ): this => {
    this.#lww.replace(id, path, version, recipe);
    return this;
  };
}

export function createCollection<T>(
  options: CollectionOptions<T>
): CollectionOptions<T> {
  return options;
}
