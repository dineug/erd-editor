import type { AnyAction } from '@dineug/r-html';
import { cloneDeep } from 'es-toolkit';

import { type AgentPeer, createAgentPeer } from '@/agent/peer';

import { createSeedValue, createUserStore, type SeededStore } from './peerSeed';

export {
  comparable,
  createImportValue,
  createSeedValue,
  createUserStore,
  SEED,
  type SeededStore,
  settle,
} from './peerSeed';

export type Session = {
  peer: AgentPeer;
  user: SeededStore;
  /**
   * Every batch the peer sent, presence included, copied as it left: a store
   * stamps a missing version onto the very object it was handed.
   */
  sent: AnyAction[][];
  /** Hands over what each side sent since the last call, both ways, until quiet. */
  deliver: () => void;
  destroy: () => void;
};

/**
 * An agent peer and a user store on the same seed, cross wired the way the
 * presence e2e wires two editors. Held, each side's batches wait for
 * deliver(), so two edits can be made before either side has seen the other's.
 */
export function createSession({
  held = false,
  presence = false,
  value = createSeedValue(),
  userToWidth,
}: {
  held?: boolean;
  presence?: boolean;
  value?: string;
  /** The user side's text measure, which a canvas makes unlike the peer's. */
  userToWidth?: (text: string) => number;
} = {}): Session {
  const user = createUserStore(value, userToWidth);
  const peer = createAgentPeer({ nickname: 'agent', presence });
  peer.setInitialValue(value);

  const sent: AnyAction[][] = [];
  const toUser: AnyAction[][] = [];
  const toPeer: AnyAction[][] = [];

  const deliver = () => {
    while (toUser.length || toPeer.length) {
      toUser
        .splice(0)
        .forEach(actions => user.sharedStore.dispatchSync(actions));
      toPeer.splice(0).forEach(actions => peer.dispatch(actions));
    }
  };

  const unsubscribeUser = user.sharedStore.subscribe(actions =>
    held ? toPeer.push(actions) : peer.dispatch(actions)
  );
  const unsubscribePeer = peer.subscribe(actions => {
    sent.push(cloneDeep(actions));
    held ? toUser.push(actions) : user.sharedStore.dispatch(actions);
  });

  return {
    peer,
    user,
    sent,
    deliver,
    destroy: () => {
      unsubscribeUser();
      unsubscribePeer();
      peer.destroy();
      user.destroy();
    },
  };
}
