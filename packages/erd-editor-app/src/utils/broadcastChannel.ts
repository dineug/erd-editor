import { isObject, safeCallback } from '@dineug/shared';

import { AnyAction, ReducerRecord, ValuesType } from '@/internal-types';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';

const BridgeActionType = {
  replicationSchemaEntity: 'replicationSchemaEntity',
  addSchemaEntity: 'addSchemaEntity',
  updateSchemaEntity: 'updateSchemaEntity',
  deleteSchemaEntity: 'deleteSchemaEntity',
  startSession: 'startSession',
  stopSession: 'stopSession',
} as const;
type BridgeActionType = ValuesType<typeof BridgeActionType>;

type BridgeActionMap = {
  [BridgeActionType.replicationSchemaEntity]: {
    id: string;
    actions: any;
  };
  [BridgeActionType.addSchemaEntity]: {
    value: SchemaEntity;
  };
  [BridgeActionType.updateSchemaEntity]: {
    id: string;
    entityValue: Partial<{ name: string }>;
  };
  [BridgeActionType.deleteSchemaEntity]: {
    id: string;
  };
  [BridgeActionType.startSession]: {
    schemaId: string;
    roomId: string;
    secretKey: string;
  };
  [BridgeActionType.stopSession]: {
    schemaId: string;
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

export const replicationSchemaEntityAction = createAction<
  BridgeActionMap[typeof BridgeActionType.replicationSchemaEntity]
>(BridgeActionType.replicationSchemaEntity);

export const addSchemaEntityAction = createAction<
  BridgeActionMap[typeof BridgeActionType.addSchemaEntity]
>(BridgeActionType.addSchemaEntity);

export const updateSchemaEntityAction = createAction<
  BridgeActionMap[typeof BridgeActionType.updateSchemaEntity]
>(BridgeActionType.updateSchemaEntity);

export const deleteSchemaEntityAction = createAction<
  BridgeActionMap[typeof BridgeActionType.deleteSchemaEntity]
>(BridgeActionType.deleteSchemaEntity);

export const startSessionAction = createAction<
  BridgeActionMap[typeof BridgeActionType.startSession]
>(BridgeActionType.startSession);

export const stopSessionAction = createAction<
  BridgeActionMap[typeof BridgeActionType.stopSession]
>(BridgeActionType.stopSession);
