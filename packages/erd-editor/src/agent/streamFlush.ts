import type { RxStore } from '@/engine/rx-store';
import type { SharedStore } from '@/engine/shared-store';

export type StreamFlusher = {
  /** History first, then the outbound pipe, so a batch never precedes its undo entry. */
  flush: () => void;
};

/**
 * Closes both stores' stream buffers now. Each store knows how many ticks its
 * own pipe needs, so this knows neither the tick count nor any rxjs type.
 */
export function createStreamFlusher(
  rxStore: Pick<RxStore, 'flushStreamBuffers'>,
  sharedStore: Pick<SharedStore, 'flushStreamBuffers'>
): StreamFlusher {
  return Object.freeze({
    flush: () => {
      rxStore.flushStreamBuffers();
      sharedStore.flushStreamBuffers();
    },
  });
}
