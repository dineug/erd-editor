import type { AnyAction, CompositionActions } from '@dineug/r-html';
import { cloneDeep } from 'es-toolkit';

import { createLegacyPeer } from '@/__test-utils__/legacyPeer';
import { createSeedValue } from '@/__test-utils__/peerSeed';
import {
  createPeerStore,
  type DispatchReport,
  type PeerStore,
} from '@/engine/peer-store';
import {
  createReplicationStore,
  type ReplicationStore,
} from '@/engine/replication-store';
import { defaultToWidth } from '@/engine/to-width';

export type MeshPeerOptions = {
  /**
   * The action types this peer drops on arrival, its clock still taking their
   * versions, as an editor built before them passes over a type it has no
   * reducer for.
   */
  unknownTypes?: ReadonlyArray<string>;
  /**
   * Opens a peer of an editor built before the slot in place of a peer store:
   * its clock and its outbound pipe, over this tree's reducers (createLegacyPeer).
   */
  legacy?: true;
};

/** What the mesh and its specs drive a peer through, a peer store or a legacy peer. */
export type MeshPeer = Pick<
  PeerStore,
  | 'editorId'
  | 'value'
  | 'runtimeValue'
  | 'state'
  | 'setInitialValue'
  | 'mergeClock'
  | 'receive'
  | 'undo'
  | 'subscribe'
  | 'destroy'
> & {
  dispatch: (actions: CompositionActions) => DispatchReport;
};

export type Mesh = {
  peers: MeshPeer[];
  /** Every batch each peer sent, presence off, copied as it left. */
  sent: AnyAction[][][];
  /** Each peer's replica by index, none unless the mesh was built with them. */
  replicas: ReplicationStore[];
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
  /**
   * Gives each peer a replica, as a host gives each window, fed every batch
   * the peer sent and every one it took, in the order the peer met them.
   */
  replicas?: boolean;
};

/**
 * Peer stores on one value whose batches wait for the spec to deliver them, so
 * concurrent edits are made before anyone has heard the others and each peer
 * can hear them in an order of its own, every peer wired to every other one.
 */
export function createMesh(
  count: number,
  {
    value = createSeedValue(),
    settle,
    peers: options = [],
    replicas: withReplicas = false,
  }: MeshOptions
): Mesh {
  const peers: MeshPeer[] = [];
  const sent: AnyAction[][][] = [];
  const replicas: ReplicationStore[] = [];
  const unknown: Array<ReadonlySet<string>> = [];
  /** heard[to][from]: how many of from's batches to has received. */
  const heard: number[][] = [];
  const unsubscribes: Array<() => void> = [];

  const join = (initialValue: string, peerOptions: MeshPeerOptions = {}) => {
    const index = peers.length;
    const nickname = `peer${index}`;
    const peer = peerOptions.legacy
      ? createLegacyPeer({ nickname })
      : createPeerStore({ nickname, presence: false });
    peer.setInitialValue(initialValue);
    if (withReplicas) {
      const replica = createReplicationStore({ toWidth: defaultToWidth });
      replica.setInitialValue(initialValue);
      replicas.push(replica);
    }

    peers.push(peer);
    sent.push([]);
    unknown.push(new Set(peerOptions.unknownTypes ?? []));
    heard.forEach(row => row.push(0));
    heard.push(peers.map(() => 0));
    unsubscribes.push(
      peer.subscribe(actions => {
        sent[index].push(cloneDeep(actions));
        replicas[index]?.dispatchSync(cloneDeep(actions));
      })
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
    if (kept.length) {
      peer.receive(cloneDeep(kept));
      replicas[to]?.dispatchSync(cloneDeep(kept));
    }
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
    replicas,
    deliver,
    deliverAll,
    join,
    destroy: () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
      peers.forEach(peer => peer.destroy());
      replicas.forEach(replica => replica.destroy());
    },
  };
}
