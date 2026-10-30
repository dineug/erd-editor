import type { PeerStore } from '@dineug/erd-editor/peer.js';

import type { PortAction } from '@/port';

export type InstrumentedPeer = {
  /** A stand-in for the peer store, to bind in its place. */
  store: PeerStore;
  /** Every batch the binding handed the store, in order. */
  received: PortAction[][];
  /** Every batch the store sent the binding, in order. */
  sent: PortAction[][];
  /**
   * Holds back each outbound batch holding one of these types until the next
   * flushStreamBuffers, as the element's shared store holds a drag or a stroke.
   */
  holdBack: (types: ReadonlyArray<string>) => void;
  heldBatches: () => number;
};

/**
 * Wraps a peer store, whose frozen object no spy can patch, in one that
 * records what passes and can hold outbound batches back as the element does.
 */
export function instrumentPeer(peer: PeerStore): InstrumentedPeer {
  const received: PortAction[][] = [];
  const sent: PortAction[][] = [];
  let holding = new Set<string>();
  let held: PortAction[][] = [];
  const listeners = new Set<(actions: PortAction[]) => void>();
  let subscribed = false;

  const emit = (actions: PortAction[]) => {
    sent.push(actions);
    listeners.forEach(listener => listener(actions));
  };

  const onPeer = (actions: PortAction[]) => {
    if (actions.some(action => holding.has(action.type))) {
      held.push(actions);
    } else {
      emit(actions);
    }
  };

  const store = {
    get editorId() {
      return peer.editorId;
    },
    get value() {
      return peer.value;
    },
    get runtimeValue() {
      return peer.runtimeValue;
    },
    get state() {
      return peer.state;
    },
    get isDestroyed() {
      return peer.isDestroyed;
    },
    setInitialValue: peer.setInitialValue,
    getLWW: peer.getLWW,
    mergeLWW: peer.mergeLWW,
    getVersion: peer.getVersion,
    forgetPeer: peer.forgetPeer,
    reseed: peer.reseed,
    dispatch: peer.dispatch,
    undo: peer.undo,
    redo: peer.redo,
    receive: (actions: PortAction[] | PortAction) => {
      received.push(Array.isArray(actions) ? actions : [actions]);
      peer.receive(actions);
    },
    subscribe: (listener: (actions: PortAction[]) => void) => {
      listeners.add(listener);
      // One subscription of the peer's, as the store hands each batch out once.
      if (!subscribed) {
        subscribed = true;
        peer.subscribe(onPeer);
      }
      return () => listeners.delete(listener);
    },
    flushStreamBuffers: () => {
      peer.flushStreamBuffers();
      const release = held;
      held = [];
      release.forEach(emit);
    },
  } as unknown as PeerStore;

  return {
    store,
    received,
    sent,
    holdBack: types => {
      holding = new Set(types);
    },
    heldBatches: () => held.length,
  };
}
