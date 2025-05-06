import { Subject } from 'rxjs';

import {
  type Action,
  type CompositionAction,
  compositionActionsFlat,
  isAction,
} from './action';
import { Clock } from './clock';
import {
  Collection,
  type CollectionMapType,
  type CollectionOptions,
} from './collection';
import { isNill } from './is-types';
import { LWW } from './lww';
import { Segment, SegmentMapType, SegmentOptions } from './segment';
import { type Reducer } from './slice';

type StoreOptions<
  C extends Record<string, CollectionOptions<any>>,
  S extends Record<string, SegmentOptions<any>>,
  R extends Record<string, Reducer<any, Context>>,
  Context,
> = {
  collections?: C;
  segments?: S;
  reducer?: R;
  context?: Context;
};

export class Store<
  Collections extends Record<string, CollectionOptions<any>>,
  Segments extends Record<string, SegmentOptions<any>>,
> {
  #collections = new Map<string, Collection<any>>();
  #segments = new Map<string, Segment<any>>();
  #options: StoreOptions<
    Collections,
    Segments,
    Record<string, Reducer<any, any>>,
    any
  >;
  #reducers: Array<[string, Reducer<any, any>]>;
  #context: any;
  #notifier = new Subject<Array<Action>>();
  #clock = new Clock();
  #lww = new LWW();

  get clock() {
    return this.#clock;
  }

  get lww() {
    return this.#lww;
  }

  constructor(
    options: StoreOptions<
      Collections,
      Segments,
      Record<string, Reducer<any, any>>,
      any
    >
  ) {
    this.#options = options;
    this.#reducers = Object.entries(options.reducer ?? {});
    this.#context = options.context ?? {};
  }

  readonly collection = <K extends Extract<keyof Collections, string>>(
    key: K
  ): Collection<CollectionMapType<Collections>[K]> => {
    const coll = this.#collections.get(key);
    if (coll) return coll;

    if (!this.#options.collections?.[key]) {
      throw new Error(`Not found collection: ${key}`);
    }

    const newColl = new Collection<CollectionMapType<Collections>[K]>(
      key,
      {
        ...this.#options.collections[key],
      },
      this.lww
    );
    this.#collections.set(key, newColl);
    return newColl;
  };

  readonly exportCollections = <
    K extends Extract<keyof Collections, string>,
  >(): Record<K, Record<string, CollectionMapType<Collections>[K]>> => {
    return [...this.#collections.keys()].reduce(
      (acc: Record<string, Record<string, any>>, key) => {
        const coll = this.collection(key as K);
        acc[key] = coll.selectEntities();
        return acc;
      },
      {}
    );
  };

  readonly segment = <K extends Extract<keyof Segments, string>>(
    key: K
  ): Segment<SegmentMapType<Segments>[K]> => {
    const segment = this.#segments.get(key);
    if (segment) return segment;

    if (!this.#options.segments?.[key]) {
      throw new Error(`Not found segment: ${key}`);
    }

    const newSegment = new Segment<SegmentMapType<Segments>[K]>(
      key,
      {
        ...this.#options.segments[key],
      },
      this.lww
    );
    this.#segments.set(key, newSegment);
    return newSegment;
  };

  readonly exportSegments = <
    K extends Extract<keyof Segments, string>,
  >(): Record<K, SegmentMapType<Segments>[K]> => {
    return [...this.#segments.keys()].reduce(
      (acc: Record<string, SegmentMapType<Segments>[K]>, key) => {
        const segment = this.segment(key as K);
        acc[key] = segment.get();
        return acc;
      },
      {}
    );
  };

  readonly toActions = (
    ...compositionActions: CompositionAction[]
  ): Action[] => {
    const version = this.clock.getNextVersion();
    return compositionActionsFlat(this, this.#context, compositionActions).map(
      action => {
        if (isNill(action.version)) {
          action.version = version;
        }
        return action;
      }
    );
  };

  readonly dispatch = (...compositionActions: CompositionAction[]) => {
    const actions = this.toActions(compositionActions);

    actions.forEach(action => {
      if (!isAction(action)) return;

      this.#reducers.forEach(([key, reducer]) => {
        if (!action.type.startsWith(key)) return;

        reducer(this, action, this.#context);
        this.clock.merge(action.version);
      });
    });

    this.#notifier.next(actions);
  };

  readonly toObservable = () => {
    return this.#notifier.asObservable();
  };
}

export function createStore<
  C extends Record<string, CollectionOptions<any>>,
  S extends Record<string, SegmentOptions<any>>,
  R extends Record<string, Reducer<any, Context>>,
  Context = any,
>(options: StoreOptions<C, S, R, Context>): Store<C, S> {
  return new Store({ ...options });
}
