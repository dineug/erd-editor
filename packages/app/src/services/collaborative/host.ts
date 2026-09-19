import { debounce } from 'es-toolkit';

import { isLeader, requestLeadership } from '@/services/collaborative/leader';
import {
  NICKNAME_ANNOUNCE_DELAY,
  Participant,
  readNickname,
} from '@/services/collaborative/participants';
import {
  CollaborativeRoom,
  HelloPayload,
  joinCollaborativeRoom,
  Role,
  sendQuietly,
  STRATEGIES,
} from '@/services/collaborative/room';
import { getAppDatabaseService } from '@/services/indexeddb';
import {
  bridge,
  collaborativeParticipantsAction,
  dispatchAll,
  replicationSchemaEntityAction,
} from '@/utils/broadcastChannel';
import {
  decryptFromJson,
  EncryptJson,
  encryptToJson,
  importKey,
} from '@/utils/crypto';

type SchemaId = string;
type RoomId = string;
type SecretKey = string;
type PeerId = string;

export type SessionMap = Record<SchemaId, [RoomId, SecretKey]>;

type Guest = {
  /** Undefined for a guest on a build that cannot read the participants list. */
  nickname: string | undefined;
  /** Every relay the guest has said hello over; see #removeGuest. */
  rooms: Set<CollaborativeRoom>;
};

type Session = {
  schemaId: SchemaId;
  roomId: RoomId;
  secretKey: SecretKey;
  key: CryptoKey | null;
  rooms: CollaborativeRoom[];
  guests: Map<PeerId, Guest>;
  /** Bumped per list sent, so a slower encryption cannot overtake a newer list. */
  participantsVersion: number;
  closed: boolean;
};

/**
 * Hosts the live collaboration sessions owned by this browser. RTCPeerConnection
 * does not exist inside a worker, so this runs on the main thread, and only the
 * tab that wins the leadership lock actually joins the rooms.
 */
export class CollaborativeHostService {
  #sessionMap = new Map<SchemaId, Session>();
  #sessions: SessionMap = {};
  #unsubscribeSet = new Set<() => void>();
  #releaseLeadership: (() => void) | null = null;
  #nickname = '';

  #announceNickname = debounce(() => {
    this.#sessionMap.forEach(session => this.#sendParticipants(session));
  }, NICKNAME_ANNOUNCE_DELAY);

  start() {
    if (this.#releaseLeadership) return;

    this.#unsubscribeSet.add(
      bridge.on({
        collaborativeDispatch: ({ payload: { schemaId, actions } }) => {
          this.#dispatch(schemaId, actions);
        },
        // Only the leader holds sessions, so only the leader answers.
        collaborativeParticipantsRequest: () => {
          this.#sessionMap.forEach(session => this.#publishToTabs(session));
        },
      })
    );
    this.#releaseLeadership = requestLeadership(() => this.#sync());
  }

  stop() {
    this.#releaseLeadership?.();
    this.#releaseLeadership = null;
    this.#announceNickname.cancel();

    Array.from(this.#unsubscribeSet).forEach(unsubscribe => unsubscribe());
    this.#unsubscribeSet.clear();
    Array.from(this.#sessionMap.keys()).forEach(schemaId =>
      this.#close(schemaId)
    );
  }

  /**
   * The session registry lives in the IndexedDB worker and is mirrored into every
   * tab, so the leader reconciles against whatever the current tab last saw.
   */
  setSessions(sessions: SessionMap) {
    this.#sessions = sessions;
    this.#sync();
  }

  /** Every tab holds the same stored nickname, so the leader has it on hand. */
  setNickname(nickname: string) {
    if (nickname === this.#nickname) return;

    this.#nickname = nickname;
    this.#announceNickname();
  }

  #sync() {
    if (!isLeader()) return;

    Array.from(this.#sessionMap.entries()).forEach(([schemaId, session]) => {
      const next = this.#sessions[schemaId];
      if (!next || next[0] !== session.roomId) {
        this.#close(schemaId);
      }
    });

    Object.entries(this.#sessions).forEach(
      ([schemaId, [roomId, secretKey]]) => {
        if (this.#sessionMap.has(schemaId)) return;
        this.#open(schemaId, roomId, secretKey);
      }
    );
  }

  async #open(schemaId: SchemaId, roomId: RoomId, secretKey: SecretKey) {
    const session: Session = {
      schemaId,
      roomId,
      secretKey,
      key: null,
      rooms: [],
      guests: new Map(),
      participantsVersion: 0,
      closed: false,
    };
    // Registered up-front so a re-entrant sync() does not open the room twice.
    this.#sessionMap.set(schemaId, session);
    // A leader that went away without a word leaves its list in the other tabs.
    this.#publishToTabs(session);

    try {
      session.key = await importKey(secretKey);
    } catch (error) {
      console.error(error);
      this.#close(schemaId);
      return;
    }

    for (const strategy of STRATEGIES) {
      if (session.closed) return;

      try {
        const room = await joinCollaborativeRoom(strategy, roomId, secretKey);

        if (session.closed) {
          room.leave();
          return;
        }

        this.#attach(session, room);
        session.rooms.push(room);
      } catch (error) {
        console.error(`Failed to join the "${strategy}" relay`, error);
      }
    }
  }

  #close(schemaId: SchemaId) {
    const session = this.#sessionMap.get(schemaId);
    if (!session) return;

    session.closed = true;
    session.rooms.forEach(room => room.leave());
    session.rooms = [];
    session.guests.clear();
    this.#sessionMap.delete(schemaId);
    this.#publishToTabs(session);
  }

  #attach(session: Session, room: CollaborativeRoom) {
    room.room.onPeerJoin = peerId => {
      sendQuietly(
        room.hello,
        { role: Role.host, nickname: this.#nickname },
        { target: peerId }
      );
      this.#sendSchema(session, room, peerId);
    };
    room.room.onPeerLeave = peerId => {
      this.#removeGuest(session, room, peerId);
    };
    room.hello.onMessage = (payload, { peerId }) => {
      this.#addGuest(session, room, peerId, payload);
    };
    room.dispatch.onMessage = value => {
      this.#receive(session, room, value);
    };
  }

  #addGuest(
    session: Session,
    room: CollaborativeRoom,
    peerId: PeerId,
    payload: HelloPayload
  ) {
    if (payload?.role !== Role.guest) return;

    const nickname = readNickname(payload.nickname);
    const guest = session.guests.get(peerId);

    if (guest) {
      guest.rooms.add(room);
      if (guest.nickname === nickname) return;
      guest.nickname = nickname;
    } else {
      session.guests.set(peerId, { nickname, rooms: new Set([room]) });
    }

    this.#publishToTabs(session);
    this.#sendParticipants(session);
  }

  /**
   * Trystero's peer id is one per page, shared by both relays, so a guest that
   * fell back from nostr to mqtt can show up there before nostr notices it left.
   * It stays listed until the last relay it said hello over lets go of it.
   */
  #removeGuest(session: Session, room: CollaborativeRoom, peerId: PeerId) {
    const guest = session.guests.get(peerId);
    if (!guest?.rooms.delete(room) || guest.rooms.size) return;

    session.guests.delete(peerId);
    this.#publishToTabs(session);
    this.#sendParticipants(session);
  }

  #publishToTabs(session: Session) {
    dispatchAll(
      collaborativeParticipantsAction({
        schemaId: session.schemaId,
        participants: Array.from(session.guests, ([peerId, { nickname }]) => ({
          peerId,
          role: Role.guest,
          nickname,
        })),
      })
    );
  }

  /**
   * Guests reached over one relay cannot see those on the other, so the host
   * sends everyone the whole list — itself first — once per guest, over the
   * first relay that guest said hello on.
   */
  async #sendParticipants(session: Session) {
    const [room] = session.rooms;
    if (!session.key || !room) return;

    const targets = new Map<CollaborativeRoom, PeerId[]>();
    const participants: Participant[] = [
      { peerId: room.selfId, role: Role.host, nickname: this.#nickname },
    ];

    session.guests.forEach(({ nickname, rooms }, peerId) => {
      participants.push({ peerId, role: Role.guest, nickname });
      if (nickname === undefined) return;

      const [via] = rooms;
      targets.set(via, [...(targets.get(via) ?? []), peerId]);
    });
    if (!targets.size) return;

    const version = ++session.participantsVersion;
    const value = await encryptToJson(
      JSON.stringify(participants),
      session.key
    );
    if (session.closed || version !== session.participantsVersion) return;

    targets.forEach((peerIds, via) => {
      sendQuietly(via.participants, value, { target: peerIds });
    });
  }

  async #sendSchema(session: Session, room: CollaborativeRoom, peerId: string) {
    const service = getAppDatabaseService();
    if (!service || !session.key) return;

    const entity = await service.getSchemaEntity(session.schemaId);
    if (!entity || session.closed || !session.key) return;

    sendQuietly(room.schema, await encryptToJson(entity.value, session.key), {
      target: peerId,
    });
  }

  async #receive(
    session: Session,
    from: CollaborativeRoom,
    value: EncryptJson
  ) {
    if (!session.key) return;

    let actions: any;
    try {
      actions = JSON.parse(await decryptFromJson(value, session.key));
    } catch (error) {
      console.error(error);
      return;
    }
    if (session.closed) return;

    getAppDatabaseService()?.replicationSchemaEntity(session.schemaId, actions);
    dispatchAll(
      replicationSchemaEntityAction({ id: session.schemaId, actions })
    );

    // Guests reached over the nostr relay and guests reached over the mqtt relay
    // are in separate meshes; the host is the only peer that sees both.
    session.rooms
      .filter(room => room !== from)
      .forEach(room => sendQuietly(room.dispatch, value));
  }

  // TODO: disconnect buffer. A guest's shared store buffers and flushes on
  // reconnect, but a batch dispatched before the rooms are open is dropped, so
  // an edit made just after a leadership handover never reaches the guests.
  async #dispatch(schemaId: SchemaId, actions: any) {
    const session = this.#sessionMap.get(schemaId);
    if (!session?.key || !session.rooms.length) return;

    const value = await encryptToJson(JSON.stringify(actions), session.key);
    if (session.closed) return;

    session.rooms.forEach(room => sendQuietly(room.dispatch, value));
  }
}

export const collaborativeHostService = new CollaborativeHostService();
