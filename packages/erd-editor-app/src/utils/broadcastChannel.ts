import { isObject, safeCallback } from '@dineug/shared';

import { AnyAction, ReducerRecord, ValuesType } from '@/internal-types';

const BridgeActionType = {
  replicationValue: 'replicationValue',
} as const;
type BridgeActionType = ValuesType<typeof BridgeActionType>;

type BridgeActionMap = {
  [BridgeActionType.replicationValue]: {
    id: string;
    actions: any;
  };
};

function createAction<P = void>(type: string) {
  function actionCreator(payload: P): AnyAction<P> {
    return { type, payload };
  }

  actionCreator.toString = () => `${type}`;
  actionCreator.type = type;
  return actionCreator;
}

export class Emitter<M extends BridgeActionMap> {
  #observers = new Set<Partial<ReducerRecord<keyof M, M>>>();

  on(reducers: Partial<ReducerRecord<keyof M, M>>) {
    this.#observers.has(reducers) || this.#observers.add(reducers);

    return () => {
      this.#observers.delete(reducers);
    };
  }

  emit(action: AnyAction) {
    if (!isObject(action)) return;
    this.#observers.forEach(reducers => {
      const reducer = Reflect.get(reducers, action.type);
      safeCallback(reducer, action);
    });
  }
}

const channel = new BroadcastChannel('@@bridge');
export const bridge = new Emitter();

export function dispatch(action: AnyAction) {
  channel.postMessage(action);
}

channel.addEventListener('message', event => {
  const action = event.data;
  bridge.emit(action);
});

export const replicationValueAction = createAction<
  BridgeActionMap[typeof BridgeActionType.replicationValue]
>(BridgeActionType.replicationValue);
