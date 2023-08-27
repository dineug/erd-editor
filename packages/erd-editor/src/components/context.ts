import { createContext, reduxDevtools, useContext } from '@dineug/r-html';

import {
  createEngineContext,
  EngineContext,
  InjectEngineContext,
} from '@/engine/context';
import { createRxStore, RxStore } from '@/engine/rx-store';

export type AppContext = EngineContext & {
  store: RxStore;
};

export type InjectAppContext = InjectEngineContext;

export function createAppContext(ctx: InjectAppContext): AppContext {
  const engineContext = createEngineContext(ctx);
  const store = createRxStore(engineContext);

  if (import.meta.env.DEV) {
    reduxDevtools(store);
  }

  return Object.freeze({
    ...engineContext,
    store,
  });
}

export const appContext = createContext<AppContext>({} as AppContext);

export const useAppContext = (ctx: Parameters<typeof useContext>[0]) =>
  useContext(ctx, appContext);
