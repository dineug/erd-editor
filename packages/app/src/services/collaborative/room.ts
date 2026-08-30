import type { MessageAction, Room } from '@trystero-p2p/nostr';

import { ValuesType } from '@/internal-types';
import { EncryptJson } from '@/utils/crypto';

/**
 * Trystero derives its relay topics from appId + roomId, so this value is the
 * namespace every erd-editor session shares. Changing it partitions old links off
 * from new ones.
 */
const APP_ID = 'io.erd-editor';

const ActionName = {
  hello: 'hello',
  schema: 'schema',
  dispatch: 'dispatch',
} as const;

export const Strategy = {
  nostr: 'nostr',
  mqtt: 'mqtt',
} as const;
export type Strategy = ValuesType<typeof Strategy>;

export const Role = {
  host: 'host',
  guest: 'guest',
} as const;
export type Role = ValuesType<typeof Role>;

export type HelloPayload = {
  role: Role;
};

/**
 * Private nostr relays to use instead of the public ones, from
 * ERD_EDITOR_NOSTR_RELAY_URLS at build time. Self-hosting the signalling is also
 * how the e2e suite runs the mesh offline.
 */
const relayUrls = (import.meta.env.NOSTR_RELAY_URLS ?? '')
  .split(',')
  .map(url => url.trim())
  .filter(Boolean);

/**
 * A host announces itself on every relay it can reach; a guest walks the list and
 * settles on the first relay that answers. Pointing at a private nostr relay opts
 * out of the public mqtt fallback along with the public nostr ones.
 */
export const STRATEGIES: ReadonlyArray<Strategy> = relayUrls.length
  ? [Strategy.nostr]
  : [Strategy.nostr, Strategy.mqtt];

type JoinRoom = (
  config: {
    appId: string;
    password?: string;
    relayConfig?: { urls?: string[] };
  },
  roomId: string
) => Room;

const joinRoomLoaders: Record<Strategy, () => Promise<JoinRoom>> = {
  [Strategy.nostr]: () =>
    import('@trystero-p2p/nostr').then(module => module.joinRoom),
  [Strategy.mqtt]: () =>
    import('@trystero-p2p/mqtt').then(module => module.joinRoom),
};

export type CollaborativeRoom = {
  strategy: Strategy;
  room: Room;
  hello: MessageAction<HelloPayload>;
  schema: MessageAction<EncryptJson>;
  dispatch: MessageAction<EncryptJson>;
  leave: () => void;
};

type OpenRoom = Omit<CollaborativeRoom, 'strategy' | 'leave'>;

type Entry = {
  refCount: number;
  open: Promise<OpenRoom>;
};

/**
 * Trystero hands back the same room object per appId and roomId, and leave()
 * tears it down asynchronously, so joins are reference counted. The entry is
 * created synchronously, so a second caller shares it rather than racing.
 */
const entries = new Map<string, Entry>();
/** In-flight leave() per room, so a re-join waits for the teardown to finish. */
const teardowns = new Map<string, Promise<unknown>>();

async function open(
  strategy: Strategy,
  roomId: string,
  secretKey: string
): Promise<OpenRoom> {
  const joinRoom = await joinRoomLoaders[strategy]();
  const room = joinRoom(
    {
      appId: APP_ID,
      password: secretKey,
      ...(strategy === Strategy.nostr && relayUrls.length
        ? { relayConfig: { urls: relayUrls } }
        : null),
    },
    roomId
  );

  return {
    room,
    hello: room.makeAction<HelloPayload>(ActionName.hello),
    schema: room.makeAction<EncryptJson>(ActionName.schema),
    dispatch: room.makeAction<EncryptJson>(ActionName.dispatch),
  };
}

function detach(openRoom: OpenRoom) {
  openRoom.room.onPeerJoin = null;
  openRoom.room.onPeerLeave = null;
  openRoom.hello.onMessage = null;
  openRoom.schema.onMessage = null;
  openRoom.dispatch.onMessage = null;
}

/**
 * The secret key doubles as the trystero password, which encrypts the session
 * descriptions exchanged over the relay — a peer without the key cannot even
 * complete the WebRTC handshake, let alone read the payloads.
 */
export async function joinCollaborativeRoom(
  strategy: Strategy,
  roomId: string,
  secretKey: string
): Promise<CollaborativeRoom> {
  const key = `${strategy}:${roomId}`;
  let entry = entries.get(key);

  if (!entry) {
    const teardown = teardowns.get(key) ?? Promise.resolve();
    const created: Entry = {
      refCount: 0,
      open: teardown.then(() => open(strategy, roomId, secretKey)),
    };

    created.open.catch(() => {
      if (entries.get(key) === created) entries.delete(key);
    });
    entries.set(key, created);
    entry = created;
  }

  const current = entry;
  current.refCount += 1;

  const openRoom = await current.open;
  let released = false;

  return {
    strategy,
    ...openRoom,
    leave: () => {
      if (released) return;
      released = true;

      current.refCount -= 1;
      if (current.refCount > 0) return;
      if (entries.get(key) === current) entries.delete(key);

      // Detached synchronously so a message in flight cannot reach a handler
      // that belongs to a room nobody is holding any more.
      detach(openRoom);

      const teardown = Promise.resolve(openRoom.room.leave()).catch(() => {});
      teardowns.set(key, teardown);
      teardown.then(() => {
        if (teardowns.get(key) === teardown) teardowns.delete(key);
      });
    },
  };
}
