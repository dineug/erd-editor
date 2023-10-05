import {
  createContext,
  observable,
  reduxDevtools,
  useContext,
} from '@dineug/r-html';

import { Actions, actions } from '@/engine/actions';
import {
  createEngineContext,
  EngineContext,
  InjectEngineContext,
} from '@/engine/context';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { createKeyBindingMap, KeyBindingMap } from '@/keyboard-shortcut';

export type AppContext = EngineContext & {
  actions: Actions;
  store: RxStore;
  keyBindingMap: KeyBindingMap;
};

export type InjectAppContext = InjectEngineContext;

export function createAppContext(ctx: InjectAppContext): AppContext {
  const engineContext = createEngineContext(ctx);
  const store = createRxStore(engineContext);
  const keyBindingMap = observable(createKeyBindingMap(), { shallow: true });

  if (import.meta.env.DEV) {
    reduxDevtools(store);
  }

  return Object.freeze({
    ...engineContext,
    actions,
    store,
    keyBindingMap,
  });
}

export const appContext = createContext<AppContext>({} as AppContext);

export const useAppContext = (ctx: Parameters<typeof useContext>[0]) =>
  useContext(ctx, appContext);
