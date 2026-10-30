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

/** How deliver hands a peer its batches, each as a transport might. */
export type DeliverOptions = {
  /** Hands each batch over twice in a row, as a transport that sends one again does. */
  duplicate?: true;
  /**
   * Interleaves the senders' batches in an order the seed picks, each sender's
   * own still in the order it sent them, as one channel per sender keeps them.
   */
  shuffle?: number;
};

export type Mesh = {
  peers: MeshPeer[];
  /** Every batch each peer sent, presence off, copied as it left. */
  sent: AnyAction[][][];
  /** Each peer's replica by index, none unless the mesh was built with them. */
  replicas: ReplicationStore[];
  /**
   * Hands the peer every batch the senders sent since it last heard from them,
   * sender after sender in the order given unless shuffled, the hooks run after
   * each batch.
   */
  deliver: (
    to: number,
    from?: number[],
    options?: DeliverOptions
  ) => Promise<void>;
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

/** A seeded generator of numbers from 0 up to 1, so an order a spec shuffles is the same on every run. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

  /** The senders of the pending batches, one entry per batch, in an order the seed picks. */
  const shuffledTurns = (to: number, from: number[], seed: number) => {
    const turns = from.flatMap(sender =>
      sender === to
        ? []
        : Array.from(
            { length: sent[sender].length - heard[to][sender] },
            () => sender
          )
    );
    const random = seededRandom(seed);
    for (let index = turns.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [turns[index], turns[other]] = [turns[other], turns[index]];
    }
    return turns;
  };

  const deliver = async (
    to: number,
    from: number[] = peers.map((_, index) => index),
    { duplicate, shuffle }: DeliverOptions = {}
  ) => {
    const handOver = async (sender: number) => {
      const batch = sent[sender][heard[to][sender]++];
      receive(to, batch);
      await settle();
      if (duplicate) {
        receive(to, batch);
        await settle();
      }
    };

    if (shuffle === undefined) {
      for (const sender of from) {
        if (sender === to) continue;

        while (heard[to][sender] < sent[sender].length) {
          await handOver(sender);
        }
      }
      return;
    }

    let turns = shuffledTurns(to, from, shuffle);
    while (turns.length) {
      for (const sender of turns) await handOver(sender);
      turns = shuffledTurns(to, from, shuffle);
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
