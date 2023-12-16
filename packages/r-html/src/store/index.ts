import { asap, safeCallback } from '@/helpers/fn';
import { isFunction } from '@/helpers/is-type';
import { createSubject } from '@/helpers/subject';
import { observable, Unsubscribe } from '@/observable';

export type Action<K extends keyof M, M> = {
  type: K;
  payload: M[K];
  timestamp: number;
  tags?: number;
};
export type AnyAction<P = any> = {
  type: string;
  payload: P;
  timestamp: number;
  tags?: number;
};

export type GeneratorAction<T = AnyAction> = Generator<
  | T
  | GeneratorAction<T>
  | GeneratorActionCreator<T>
  | Array<T | GeneratorAction<T> | GeneratorActionCreator<T>>
>;
export type GeneratorActionCreator<T = AnyAction, S = any, C = any> = (
  state: S,
  ctx: C
) => GeneratorAction<T>;
export type CompositionAction =
  | AnyAction
  | GeneratorAction
  | GeneratorActionCreator
  | Array<CompositionAction>;
export type CompositionActions = Array<CompositionAction>;

export type Reducer<S, K extends keyof M, M, C = {}> = (
  state: S,
  action: Action<K, M>,
  ctx: C
) => void;

type ReducerRecord<S, K extends keyof M, M, C> = {
  [P in K]: Reducer<S, P, M, C>;
};

type Options<S, M, C> = {
  context: C;
  state: S;
  reducers: ReducerRecord<S, keyof M, M, C>;
};

export type DispatchOperator = (
  source: Generator<Array<AnyAction>>
) => Generator<Array<AnyAction>>;

export type Store<S, C = {}> = {
  context: C;
  state: S;
  dispatch(...compositionActions: CompositionActions): void;
  dispatchSync(...compositionActions: CompositionActions): void;
  subscribe(observer: (value: Array<AnyAction>) => void): Unsubscribe;
  pipe(...operators: DispatchOperator[]): Unsubscribe;
  destroy(): void;
};

export function createAction<P = void>(type: string) {
  function actionCreator(payload: P): AnyAction<P> {
    return {
      type,
      payload,
      timestamp: Date.now(),
    };
  }

  actionCreator.toString = () => `${type}`;
  actionCreator.type = type;
  return actionCreator;
}

function* compositionActionsFlat$<S, C = {}>(
  state: S,
  ctx: C,
  iterator: any[]
): Generator<AnyAction> {
  for (const value of iterator) {
    if (value?.[Symbol.iterator]) {
      yield* compositionActionsFlat$(state, ctx, value);
    } else if (isFunction(value)) {
      yield* compositionActionsFlat$(state, ctx, value(state, ctx));
    } else {
      yield value;
    }
  }
}

export const compositionActionsFlat = <S, C = {}>(
  state: S,
  ctx: C,
  compositionActions: CompositionActions
): AnyAction[] => [...compositionActionsFlat$(state, ctx, compositionActions)];

const pipe =
  (...operators: DispatchOperator[]) =>
  (initSource: Generator<Array<AnyAction>>) =>
    operators.reduce((source, operator) => operator(source), initSource);

function* createSource(actions: AnyAction[]) {
  yield actions;
}

const notEmptyActions: DispatchOperator = function* (source) {
  for (const actions of source) {
    if (actions.length) {
      yield actions;
    }
  }
};

export function createStore<S, M, C = {}>({
  context,
  state: initialState,
  reducers,
}: Options<S, M, C>): Store<S, C> {
  const state = observable(initialState);
  const beforeSubject = createSubject<Array<AnyAction>>();
  const subject = createSubject<Array<AnyAction>>();
  let operator: DispatchOperator = pipe(notEmptyActions);

  const runReducer = (action: AnyAction) => {
    const reducer = Reflect.get(reducers, action.type, reducers);
    safeCallback(reducer as any, state, action, context);
  };

  const dispatchSync = (...compositionActions: CompositionActions) => {
    const actions = compositionActionsFlat(state, context, compositionActions);
    beforeSubject.next(actions);
  };

  const dispatch = (...compositionActions: CompositionActions) => {
    asap(() => dispatchSync(...compositionActions));
  };

  const connectUnsubscribe = beforeSubject.subscribe(actions => {
    const iter = operator(createSource(actions));
    for (const value of iter) {
      subject.next(value);
    }
  });

  const unsubscribe = subject.subscribe(actions => actions.forEach(runReducer));

  const _pipe = (...operators: DispatchOperator[]): Unsubscribe => {
    operator = pipe(...operators, notEmptyActions);

    return () => {
      operator = pipe(notEmptyActions);
    };
  };

  const destroy = () => {
    connectUnsubscribe();
    unsubscribe();
  };

  return {
    context,
    state,
    dispatch,
    dispatchSync,
    subscribe: subject.subscribe,
    pipe: _pipe,
    destroy,
  };
}
