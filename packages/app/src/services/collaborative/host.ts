import { isLeader, requestLeadership } from '@/services/collaborative/leader';
import {
  CollaborativeRoom,
  joinCollaborativeRoom,
  Role,
  STRATEGIES,
} from '@/services/collaborative/room';
import { getAppDatabaseService } from '@/services/indexeddb';
import {
  bridge,
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

export type SessionMap = Record<SchemaId, [RoomId, SecretKey]>;

type Session = {
  schemaId: SchemaId;
  roomId: RoomId;
  secretKey: SecretKey;
  key: CryptoKey | null;
  rooms: CollaborativeRoom[];
  closed: boolean;
};

/**
 * Hosts the live collaboration sessions owned by this browser.
 *
 * `RTCPeerConnection` does not exist inside a worker, so unlike the rest of the
 * schema plumbing this service runs on the main thread. Only the tab that wins the
 * leadership lock actually joins the rooms; the others forward their editor action
 * streams to it over the BroadcastChannel bridge.
 */
export class CollaborativeHostService {
  #sessionMap = new Map<SchemaId, Session>();
  #sessions: SessionMap = {};
  #unsubscribeSet = new Set<() => void>();
  #releaseLeadership: (() => void) | null = null;

  start() {
    if (this.#releaseLeadership) return;

    this.#unsubscribeSet.add(
      bridge.on({
        collaborativeDispatch: ({ payload: { schemaId, actions } }) => {
          this.#dispatch(schemaId, actions);
        },
      })
    );
    this.#releaseLeadership = requestLeadership(() => this.#sync());
  }

  stop() {
    this.#releaseLeadership?.();
    this.#releaseLeadership = null;

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
      closed: false,
    };
    // Registered up-front so a re-entrant sync() does not open the room twice.
    this.#sessionMap.set(schemaId, session);

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
    this.#sessionMap.delete(schemaId);
  }

  #attach(session: Session, room: CollaborativeRoom) {
    room.room.onPeerJoin = peerId => {
      room.hello.send({ role: Role.host }, { target: peerId });
      this.#sendSchema(session, room, peerId);
    };
    room.dispatch.onMessage = value => {
      this.#receive(session, room, value);
    };
  }

  async #sendSchema(session: Session, room: CollaborativeRoom, peerId: string) {
    const service = getAppDatabaseService();
    if (!service || !session.key) return;

    const entity = await service.getSchemaEntity(session.schemaId);
    if (!entity || session.closed || !session.key) return;

    room.schema.send(await encryptToJson(entity.value, session.key), {
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
      .forEach(room => room.dispatch.send(value));
  }

  // TODO: disconnect buffer. Unlike a guest — whose shared store buffers while
  // disconnected and flushes on reconnect — a batch dispatched before the rooms
  // are open is dropped, so an edit made in the seconds after a leadership
  // handover never reaches the guests.
  async #dispatch(schemaId: SchemaId, actions: any) {
    const session = this.#sessionMap.get(schemaId);
    if (!session?.key || !session.rooms.length) return;

    const value = await encryptToJson(JSON.stringify(actions), session.key);
    if (session.closed) return;

    session.rooms.forEach(room => room.dispatch.send(value));
  }
}

export const collaborativeHostService = new CollaborativeHostService();
