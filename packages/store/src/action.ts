import { isFunction, isObject, isString } from './is-types';

export type Action<P = any, T extends string = string> = {
  type: T;
  payload: P;
  version?: number;
  tags?: number;
  meta?: Record<string, any>;
};
type GeneratorAction = Generator<
  | Action
  | GeneratorAction
  | GeneratorActionCreator
  | Array<Action | GeneratorAction | GeneratorActionCreator>
>;
export type GeneratorActionCreator<S = any, C = any> = (
  store: S,
  ctx: C
) => GeneratorAction;
export type CompositionAction =
  | Action
  | GeneratorAction
  | GeneratorActionCreator
  | Array<CompositionAction>;

export function createAction<P = void, T extends string = string>(type: T) {
  function actionCreator(payload: P): Action<P, T> {
    return { type, payload };
  }

  actionCreator.match = isAction<P, T>;
  actionCreator.toString = (): T => type;
  actionCreator.type = type;
  return actionCreator;
}

export function isAction<P = any, T extends string = string>(
  value: unknown
): value is Action<P, T> {
  return isObject(value) && isString(value.type);
}

export const compositionActionsFlat = <S, C>(
  store: S,
  ctx: C,
  compositionActions: CompositionAction[]
): Action[] => [...compositionActionsFlat$(store, ctx, compositionActions)];

function* compositionActionsFlat$<S, C>(
  store: S,
  ctx: C,
  iterator: any[]
): Generator<Action> {
  for (const value of iterator) {
    if (value?.[Symbol.iterator]) {
      yield* compositionActionsFlat$(store, ctx, value);
    } else if (isFunction(value)) {
      yield* compositionActionsFlat$(store, ctx, value(store, ctx));
    } else {
      yield value;
    }
  }
}
