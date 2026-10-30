import { createPeerStore, type PeerStore } from '@dineug/erd-editor/peer.js';
import type * as Y from 'yjs';

import { createFakeRoom, type FakeRoom } from '@/__test-utils__/fakeProvider';
import {
  bindPeerStore,
  type ErdYjsPeerBinding,
  type PeerBindOptions,
} from '@/binding';

export type Harness = {
  room: FakeRoom;
  peer: (nickname: string, options?: { presence?: boolean }) => PeerStore;
  bind: (
    peer: PeerStore,
    doc: Y.Doc,
    options?: PeerBindOptions
  ) => ErdYjsPeerBinding;
  /** Destroys every binding, peer and room it made, the latest first. */
  cleanup: () => void;
};

/** A room and the peers and bindings a spec makes in it, all let go together. */
export function createHarness(): Harness {
  const cleanups: Array<() => void> = [];
  const room = createFakeRoom();
  cleanups.push(room.destroy);

  return {
    room,
    peer: (nickname, { presence = false } = {}) => {
      const peer = createPeerStore({ nickname, presence });
      cleanups.push(peer.destroy);
      return peer;
    },
    bind: (peer, doc, options) => {
      const binding = bindPeerStore(peer, doc, options);
      cleanups.push(binding.destroy);
      return binding;
    },
    cleanup: () => {
      while (cleanups.length) cleanups.pop()!();
    },
  };
}
