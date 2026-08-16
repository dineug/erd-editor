import { vi } from 'vite-plus/test';

import { CollaborativeRoom, Strategy } from '@/services/collaborative/room';
import { EncryptJson } from '@/utils/crypto';

type FakeAction<T> = {
  send: ReturnType<typeof vi.fn>;
  onMessage: ((data: T, context: { peerId: string }) => void) | null;
  onReceiveProgress: null;
};

export type FakeCollaborativeRoom = CollaborativeRoom & {
  hello: FakeAction<{ role: string }>;
  schema: FakeAction<EncryptJson>;
  dispatch: FakeAction<EncryptJson>;
  leave: ReturnType<typeof vi.fn>;
};

function createFakeAction<T>(): FakeAction<T> {
  return {
    send: vi.fn(async () => {}),
    onMessage: null,
    onReceiveProgress: null,
  };
}

/**
 * A stand-in for a joined trystero room. Tests drive it by invoking the handlers
 * the service under test assigned — `room.onPeerJoin('peer-1')`,
 * `dispatch.onMessage(payload, { peerId })`, and so on.
 */
export function createFakeRoom(strategy: Strategy): FakeCollaborativeRoom {
  const room = {
    onPeerJoin: null,
    onPeerLeave: null,
    onPeerStream: null,
    onPeerTrack: null,
  } as unknown as CollaborativeRoom['room'];

  const fake = {
    strategy,
    room,
    hello: createFakeAction<{ role: string }>(),
    schema: createFakeAction<EncryptJson>(),
    dispatch: createFakeAction<EncryptJson>(),
    leave: vi.fn(() => {
      room.onPeerJoin = null;
      room.onPeerLeave = null;
      fake.hello.onMessage = null;
      fake.schema.onMessage = null;
      fake.dispatch.onMessage = null;
    }),
  };

  return fake as unknown as FakeCollaborativeRoom;
}
