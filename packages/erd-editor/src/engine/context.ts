import { Actions, actions } from '@/engine/actions';

export type EngineContext = {
  actions: Actions;
};

export function createEngineContext(): EngineContext {
  return {
    actions,
  };
}
