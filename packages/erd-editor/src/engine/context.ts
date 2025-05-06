import { Clock } from './clock';

export type EngineContext = {
  toWidth: (text: string) => number;
  clock: Clock;
};

export type InjectEngineContext = Omit<EngineContext, 'clock'>;

export function createEngineContext(ctx: InjectEngineContext): EngineContext {
  return {
    ...ctx,
    clock: new Clock(),
  };
}
