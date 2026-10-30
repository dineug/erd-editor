import { omit } from 'es-toolkit';

import { Clock } from './clock';

export type EngineContext = {
  toWidth: (text: string) => number;
  /**
   * False in a store that draws nothing, a peer's or a replica's: its load and
   * its sort after an edit place each relationship's anchors and route no
   * connector, which only a drawing reads. Any other store routes them.
   */
  routes?: boolean;
  clock: Clock;
};

/**
 * A replica's context, which alone sets remote: it strips the tags off what it
 * hears, so every step of a drag or a pan it takes is another store's and adds
 * outside the geometry registers. Kept off EngineContext, which peer.js exports.
 */
export type ReplicaEngineContext = EngineContext & { remote?: boolean };

export type InjectEngineContext = Omit<EngineContext, 'clock'>;

export function createEngineContext(ctx: InjectEngineContext): EngineContext {
  return {
    ...omit(ctx as ReplicaEngineContext, ['remote']),
    clock: new Clock(),
  };
}
