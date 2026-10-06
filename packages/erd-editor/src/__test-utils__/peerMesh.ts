import type { AnyAction } from '@dineug/r-html';
import { cloneDeep } from 'es-toolkit';

import { createSeedValue } from '@/__test-utils__/peerSeed';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';

export type MeshPeerOptions = {
  /**
   * The action types this peer drops on arrival, its clock still taking their
   * versions, as an editor built before them passes over a type it has no
   * reducer for.
   */
  unknownTypes?: ReadonlyArray<string>;
};

export type Mesh = {
  peers: PeerStore[];
  /** Every batch each peer sent, presence off, copied as it left. */
  sent: AnyAction[][][];
  /**
   * Hands the peer every batch the senders sent since it last heard from them,
   * sender after sender in the order given, the hooks run after each batch.
   */
  deliver: (to: number, from?: number[]) => Promise<void>;
  /** Delivers until every peer has heard every batch, peer by peer in order. */
  deliverAll: () => Promise<void>;
  /** Opens one more peer on the value, as one that joins the session later. */
  join: (value: string, options?: MeshPeerOptions) => number;
  destroy: () => void;
};

export type MeshOptions = {
  value?: string;
  /** Lets the hooks a batch woke run, which a spec drives with fake timers. */
  settle: () => Promise<void>;
  /** Per peer by index, what it is built with. */
  peers?: MeshPeerOptions[];
};

/**
 * Peer stores on one value whose batches wait for the spec to deliver them, so
 * concurrent edits are made before anyone has heard the others and each peer
 * can hear them in an order of its own, every peer wired to every other one.
 */
export function createMesh(
  count: number,
  { value = createSeedValue(), settle, peers: options = [] }: MeshOptions
): Mesh {
  const peers: PeerStore[] = [];
  const sent: AnyAction[][][] = [];
  const unknown: Array<ReadonlySet<string>> = [];
  /** heard[to][from]: how many of from's batches to has received. */
  const heard: number[][] = [];
  const unsubscribes: Array<() => void> = [];

  const join = (initialValue: string, peerOptions: MeshPeerOptions = {}) => {
    const index = peers.length;
    const peer = createPeerStore({
      nickname: `peer${index}`,
      presence: false,
    });
    peer.setInitialValue(initialValue);

    peers.push(peer);
    sent.push([]);
    unknown.push(new Set(peerOptions.unknownTypes ?? []));
    heard.forEach(row => row.push(0));
    heard.push(peers.map(() => 0));
    unsubscribes.push(
      peer.subscribe(actions => sent[index].push(cloneDeep(actions)))
    );

    return index;
  };

  const receive = (to: number, batch: AnyAction[]) => {
    const peer = peers[to];
    const dropped = batch.filter(({ type }) => unknown[to].has(type));
    dropped.forEach(({ version }) => {
      if (version !== undefined) peer.mergeClock(version);
    });

    const kept = batch.filter(({ type }) => !unknown[to].has(type));
    if (kept.length) peer.receive(cloneDeep(kept));
  };

  const deliver = async (
    to: number,
    from: number[] = peers.map((_, index) => index)
  ) => {
    for (const sender of from) {
      if (sender === to) continue;

      while (heard[to][sender] < sent[sender].length) {
        receive(to, sent[sender][heard[to][sender]++]);
        await settle();
      }
    }
  };

  const pending = () =>
    heard.some((row, to) =>
      row.some((count, from) => from !== to && count < sent[from].length)
    );

  const deliverAll = async () => {
    while (pending()) {
      for (let to = 0; to < peers.length; to++) {
        await deliver(to);
      }
    }
  };

  for (let index = 0; index < count; index++) {
    join(value, options[index]);
  }

  return {
    peers,
    sent,
    deliver,
    deliverAll,
    join,
    destroy: () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
      peers.forEach(peer => peer.destroy());
    },
  };
}
