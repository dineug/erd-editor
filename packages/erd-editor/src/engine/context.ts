import { Clock } from './clock';

export type EngineContext = {
  toWidth: (text: string) => number;
  /**
   * False in a store that draws nothing, a peer's or a replica's: its load
   * places each relationship's anchors and routes no connector, which only a
   * drawing reads. Any other store routes them.
   */
  routes?: boolean;
  clock: Clock;
};

export type InjectEngineContext = Omit<EngineContext, 'clock'>;

export function createEngineContext(ctx: InjectEngineContext): EngineContext {
  return {
    ...ctx,
    clock: new Clock(),
  };
}
