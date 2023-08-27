import { Actions, actions } from '@/engine/actions';

export type EngineContext = {
  actions: Actions;
  toWidth: (text: string) => number;
};

export type InjectEngineContext = Pick<EngineContext, 'toWidth'>;

export function createEngineContext(ctx: InjectEngineContext): EngineContext {
  return {
    ...ctx,
    actions,
  };
}
