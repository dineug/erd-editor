import {
  CollaborativeRoom,
  joinCollaborativeRoom,
  Role,
  STRATEGIES,
} from '@/services/collaborative/room';
import { decryptFromJson, encryptToJson, importKey } from '@/utils/crypto';

/** How long to wait for a host to answer on one relay before trying the next. */
export const RELAY_TIMEOUT = 1000 * 8;

export type GuestHandlers = {
  /** The host's snapshot of the document, decrypted. */
  onSchema: (value: string) => void;
  onDispatch: (actions: any) => void;
  /** The first host of the session became reachable. */
  onHostJoin: () => void;
  /** The last remaining host went away. */
  onHostLeave: () => void;
  /** Every relay was tried and no host answered on any of them. */
  onNotFoundHost: () => void;
  onError: (error: unknown) => void;
};

export type CollaborativeGuest = {
  dispatch: (actions: any) => Promise<void>;
  close: () => void;
};

export type GuestOptions = {
  relayTimeout?: number;
};

/**
 * Joins a live collaboration session as a guest. Relays are tried in order and
 * the first a host answers on wins; falling back leaves the previous relay
 * behind, so a guest never talks to one host across two meshes.
 */
export function createCollaborativeGuest(
  roomId: string,
  secretKey: string,
  handlers: GuestHandlers,
  { relayTimeout = RELAY_TIMEOUT }: GuestOptions = {}
): CollaborativeGuest {
  const hostPeerSet = new Set<string>();
  let room: CollaborativeRoom | null = null;
  let key: CryptoKey | null = null;
  let closed = false;
  let notifyHostFound: (() => void) | null = null;

  const handleHostJoin = (peerId: string) => {
    const isFirstHost = hostPeerSet.size === 0;
    hostPeerSet.add(peerId);
    notifyHostFound?.();
    isFirstHost && handlers.onHostJoin();
  };

  // Only the last host leaving ends the session; other guests come and go.
  const handlePeerLeave = (peerId: string) => {
    if (!hostPeerSet.delete(peerId) || hostPeerSet.size) return;
    handlers.onHostLeave();
  };

  const attach = (next: CollaborativeRoom) => {
    next.room.onPeerJoin = peerId => {
      next.hello.send({ role: Role.guest }, { target: peerId });
    };
    next.room.onPeerLeave = handlePeerLeave;

    next.hello.onMessage = (payload, { peerId }) => {
      if (payload?.role !== Role.host) return;
      handleHostJoin(peerId);
    };

    next.schema.onMessage = async value => {
      if (!key || closed) return;

      try {
        handlers.onSchema(await decryptFromJson(value, key));
      } catch (error) {
        handlers.onError(error);
      }
    };

    next.dispatch.onMessage = async value => {
      if (!key || closed) return;

      try {
        handlers.onDispatch(JSON.parse(await decryptFromJson(value, key)));
      } catch (error) {
        handlers.onError(error);
      }
    };
  };

  const waitForHost = () =>
    new Promise<boolean>(resolve => {
      if (hostPeerSet.size) return resolve(true);

      const timerId = setTimeout(() => {
        notifyHostFound = null;
        resolve(false);
      }, relayTimeout);

      notifyHostFound = () => {
        clearTimeout(timerId);
        notifyHostFound = null;
        resolve(true);
      };
    });

  const connect = async () => {
    key = await importKey(secretKey);
    if (closed) return;

    for (const strategy of STRATEGIES) {
      if (closed) return;

      let next: CollaborativeRoom;
      try {
        next = await joinCollaborativeRoom(strategy, roomId, secretKey);
      } catch (error) {
        console.error(`Failed to join the "${strategy}" relay`, error);
        continue;
      }

      if (closed) {
        next.leave();
        return;
      }

      room = next;
      attach(next);

      const found = await waitForHost();
      if (closed || found) return;

      next.leave();
      room = null;
    }

    handlers.onNotFoundHost();
  };

  connect().catch(handlers.onError);

  return {
    dispatch: async actions => {
      if (!room || !key) return;

      const value = await encryptToJson(JSON.stringify(actions), key);
      // close() may have landed while the payload was being encrypted.
      room?.dispatch.send(value);
    },
    close: () => {
      closed = true;
      notifyHostFound?.();
      hostPeerSet.clear();
      room?.leave();
      room = null;
    },
  };
}
