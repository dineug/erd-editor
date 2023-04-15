import { createEngineContext, EngineContext } from '@/engine/context';
import { createRxStore, RxStore } from '@/engine/rx-store';

export type AppContext = EngineContext & {
  store: RxStore;
};

export function createAppContext(): AppContext {
  const engineCtx = createEngineContext();
  const store = createRxStore(engineCtx);

  return {
    ...engineCtx,
    store,
  };
}
