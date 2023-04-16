import { createContext, reduxDevtools } from '@dineug/r-html';

import { createEngineContext, EngineContext } from '@/engine/context';
import { createRxStore, RxStore } from '@/engine/rx-store';

export type AppContext = EngineContext & {
  store: RxStore;
};

export function createAppContext(): AppContext {
  const engineContext = createEngineContext();
  const store = createRxStore(engineContext);

  if (import.meta.env.DEV) {
    reduxDevtools(store);
  }

  return {
    ...engineContext,
    store,
  };
}

export const appContext = createContext<AppContext>({} as AppContext);
