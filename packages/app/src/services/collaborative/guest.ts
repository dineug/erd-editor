import { debounce } from 'es-toolkit';

import {
  NICKNAME_ANNOUNCE_DELAY,
  Participant,
  readNickname,
  readParticipants,
} from '@/services/collaborative/participants';
import {
  CollaborativeRoom,
  joinCollaborativeRoom,
  Role,
  sendQuietly,
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
  /**
   * Everyone in the session as far as this guest knows, itself last. A host
   * from before the list never sends one, so then it is the hosts and itself.
   */
  onParticipants?: (participants: Participant[], selfId: string) => void;
};

export type CollaborativeGuest = {
  dispatch: (actions: any) => Promise<void>;
  /** Takes effect on the next hello, and re-announces once the typing settles. */
  setNickname: (nickname: string) => void;
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
  /** Every host that said hello, by peer id, with the nickname it gave. */
  const hostPeerMap = new Map<string, string | undefined>();
  let hostParticipants: Participant[] | null = null;
  let nickname = '';
  let room: CollaborativeRoom | null = null;
  let key: CryptoKey | null = null;
  let closed = false;
  let notifyHostFound: (() => void) | null = null;

  // Sent even when empty: a nickname is how a host knows this build reads the
  // list it sends back.
  const hello = () => ({ role: Role.guest, nickname });

  const announceNickname = debounce(() => {
    room && sendQuietly(room.hello, hello());
  }, NICKNAME_ANNOUNCE_DELAY);

  const emitParticipants = () => {
    if (!room) return;

    const { selfId } = room;
    const listed: Participant[] =
      hostParticipants ??
      Array.from(hostPeerMap, ([peerId, hostNickname]) => ({
        peerId,
        role: Role.host,
        nickname: hostNickname,
      }));

    handlers.onParticipants?.(
      [
        ...listed.filter(participant => participant.peerId !== selfId),
        { peerId: selfId, role: Role.guest, nickname },
      ],
      selfId
    );
  };

  const handleHostJoin = (peerId: string, hostNickname: string | undefined) => {
    const isFirstHost = hostPeerMap.size === 0;
    hostPeerMap.set(peerId, hostNickname);
    notifyHostFound?.();
    isFirstHost && handlers.onHostJoin();
    emitParticipants();
  };

  // Only the last host leaving ends the session; other guests come and go.
  const handlePeerLeave = (peerId: string) => {
    if (!hostPeerMap.delete(peerId) || hostPeerMap.size) return;
    hostParticipants = null;
    handlers.onHostLeave();
    emitParticipants();
  };

  const attach = (next: CollaborativeRoom) => {
    next.room.onPeerJoin = peerId => {
      sendQuietly(next.hello, hello(), { target: peerId });
    };
    next.room.onPeerLeave = handlePeerLeave;

    next.hello.onMessage = (payload, { peerId }) => {
      if (payload?.role !== Role.host) return;
      handleHostJoin(peerId, readNickname(payload.nickname));
    };

    // Every peer holds the key, so any can claim to be host and edit anything
    // anyway: taking the list from a host alone keeps a buggy guest's list out,
    // not a hostile one. A list that cannot be read costs the list alone.
    next.participants.onMessage = async (value, { peerId }) => {
      if (!key || closed || !hostPeerMap.has(peerId)) return;

      try {
        hostParticipants = readParticipants(
          JSON.parse(await decryptFromJson(value, key))
        );
      } catch (error) {
        console.error(error);
        return;
      }
      emitParticipants();
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
      if (hostPeerMap.size) return resolve(true);

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
      room && sendQuietly(room.dispatch, value);
    },
    setNickname: next => {
      if (next === nickname) return;

      nickname = next;
      emitParticipants();
      // Before a relay is joined there is nobody to tell; the first hello will.
      room && announceNickname();
    },
    close: () => {
      closed = true;
      announceNickname.cancel();
      notifyHostFound?.();
      hostPeerMap.clear();
      room?.leave();
      room = null;
    },
  };
}
