// @vitest-environment node

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createEngineContext } from '@/engine/context';
import {
  addMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
} from '@/engine/modules/table/atom.actions';
import { createRxStore, type RxStore } from '@/engine/rx-store';
import { createSharedStore, type SharedStore } from '@/engine/shared-store';
import { createStreamFlusher } from '@/engine/stream-flush';
import { defaultToWidth } from '@/engine/to-width';

const stores: Array<{ destroy: () => void }> = [];

afterEach(() => {
  stores.splice(0).forEach(store => store.destroy());
  vi.useRealTimers();
});

/** The peer's pair of stores, both closing their buffers only when told. */
function manualPair(): {
  rxStore: RxStore;
  sharedStore: SharedStore;
  batches: AnyAction[][];
} {
  const rxStore = createRxStore(
    createEngineContext({ toWidth: defaultToWidth }),
    { manualStreamFlush: true, observable: false }
  );
  const sharedStore = createSharedStore(rxStore, undefined, {
    manualStreamFlush: true,
  });
  stores.push(sharedStore, rxStore);

  const batches: AnyAction[][] = [];
  sharedStore.subscribe(actions => {
    if (actions.some(({ type }) => type !== 'editor.getLWW')) {
      batches.push(actions);
    }
  });

  return { rxStore, sharedStore, batches };
}

describe('stream flusher (AC-P1)', () => {
  it('closes the history before the outbound pipe', () => {
    const calls: string[] = [];
    const flusher = createStreamFlusher(
      { flushStreamBuffers: () => calls.push('history') },
      { flushStreamBuffers: () => calls.push('outbound') }
    );

    flusher.flush();

    expect(calls).toEqual(['history', 'outbound']);
  });

  it('sends a held color batch and its undo entry on one flush, with no timer run', () => {
    vi.useFakeTimers();
    const { rxStore, sharedStore, batches } = manualPair();
    rxStore.dispatchSync(
      addTableAction({ id: 't', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    batches.length = 0;
    const sizeBefore = rxStore.history.size;

    rxStore.dispatchSync(
      changeTableColorAction({ id: 't', color: '#123456', prevColor: '' })
    );

    expect(batches).toEqual([]);
    expect(rxStore.history.size).toBe(sizeBefore);

    createStreamFlusher(rxStore, sharedStore).flush();

    expect(batches).toHaveLength(1);
    expect(batches[0].map(({ type }) => type)).toEqual(['table.changeColor']);
    expect(rxStore.history.size).toBe(sizeBefore + 1);
  });

  it('sends exactly one batch for a stream action that makes no undo entry', () => {
    vi.useFakeTimers();
    const { rxStore, sharedStore, batches } = manualPair();
    rxStore.dispatchSync(
      addMemoAction({ id: 'm', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    batches.length = 0;
    const sizeBefore = rxStore.history.size;

    rxStore.dispatchSync(
      resizeMemoAction({ id: 'm', x: 0, y: 0, width: 300, height: 200 })
    );
    const flusher = createStreamFlusher(rxStore, sharedStore);
    flusher.flush();
    flusher.flush();

    expect(batches).toHaveLength(1);
    expect(batches[0].map(({ type }) => type)).toEqual(['memo.resize']);
    expect(rxStore.history.size).toBe(sizeBefore);
  });
});
