import { type Action, createAction } from './action';
import type { CollectionOptions } from './collection';
import type { SegmentOptions } from './segment';
import type { Store } from './store';

type CreateAction<P = void, T extends string = string> = ReturnType<
  typeof createAction<P, T>
>;

type SliceOptions<
  Namespace extends string,
  Collections extends Record<string, CollectionOptions<any>>,
  Segments extends Record<string, SegmentOptions<any>>,
  Reducers extends ReducersType<Store<Collections, Segments>, any, Context>,
  Context,
> = {
  name: Namespace;
  collections?: Collections;
  segments?: Segments;
  reducers: Reducers;
  context?: Context;
};

type ReducersType<S, T = any, Context = any> = {
  [P in keyof T]: Reducer<S, Context>;
};

export type Reducer<S, Context> = (
  store: S,
  action: Action,
  ctx: Context
) => void;

type Slice<
  Namespace extends string,
  Collections extends Record<string, CollectionOptions<any>>,
  Segments extends Record<string, SegmentOptions<any>>,
  Reducers extends ReducersType<Store<Collections, Segments>, any, Context>,
  Context,
> = {
  name: Namespace;
  reducer: Reducer<Store<Collections, Segments>, Context>;
  actions: Actions<Namespace, Reducers>;
};

type Actions<
  Namespace extends string,
  Reducers extends ReducersType<any, any, any>,
> = {
  [P in keyof Reducers]: CreateAction<
    Parameters<Reducers[P]>[1] extends Action
      ? Parameters<Reducers[P]>[1]['payload']
      : void,
    P extends string ? `${Namespace}/${P}` : 'unknown'
  >;
};

export function createSlice<
  Namespace extends string,
  Collections extends Record<string, CollectionOptions<any>>,
  Segments extends Record<string, SegmentOptions<any>>,
  Reducers extends ReducersType<Store<Collections, Segments>, any, Context>,
  Context = any,
>({
  name,
  reducers,
}: SliceOptions<Namespace, Collections, Segments, Reducers, Context>): Slice<
  Namespace,
  Collections,
  Segments,
  Reducers,
  Context
> {
  const reducerMap = new Map<
    string,
    Reducer<Store<Collections, Segments>, Context>
  >(
    Object.entries(reducers).map(([key, reducer]) => [
      `${name}/${key}`,
      reducer,
    ])
  );

  const reducer: Reducer<Store<Collections, Segments>, Context> = (
    store,
    action,
    ctx
  ) => {
    const reducer = reducerMap.get(action.type);
    reducer?.(store, action, ctx);
  };

  const actions = Object.keys(reducers).reduce<
    Record<string, CreateAction<any>>
  >((acc, key) => {
    acc[key] = createAction<any>(`${name}/${key}`);

    return acc;
  }, {}) as Actions<Namespace, Reducers>;

  return {
    name,
    reducer,
    actions,
  };
}
