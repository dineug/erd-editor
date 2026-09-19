import { vi } from 'vite-plus/test';

import {
  CollaborativeRoom,
  HelloPayload,
  Strategy,
} from '@/services/collaborative/room';
import { EncryptJson } from '@/utils/crypto';

type FakeAction<T> = {
  send: ReturnType<typeof vi.fn>;
  onMessage: ((data: T, context: { peerId: string }) => void) | null;
  onReceiveProgress: null;
};

export type FakeCollaborativeRoom = CollaborativeRoom & {
  hello: FakeAction<HelloPayload>;
  schema: FakeAction<EncryptJson>;
  dispatch: FakeAction<EncryptJson>;
  participants: FakeAction<EncryptJson>;
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
 * Makes an action's sends reject from now on, as they do once its data channel
 * closes, and returns a mock of the calls. A mock send would settle the promise
 * it returns itself and so hide a rejection that nothing else handles.
 */
export function rejectSends<T>(action: FakeAction<T>, error: unknown) {
  const calls = vi.fn();

  action.send = ((...args: unknown[]) => {
    calls(...args);
    return Promise.reject(error);
  }) as FakeAction<T>['send'];
  return calls;
}

/**
 * A stand-in for a joined trystero room. Tests drive it by invoking the handlers
 * the service under test assigned — room.onPeerJoin('peer-1'),
 * dispatch.onMessage(payload, { peerId }), and so on.
 */
export function createFakeRoom(
  strategy: Strategy,
  selfId = 'self'
): FakeCollaborativeRoom {
  const room = {
    onPeerJoin: null,
    onPeerLeave: null,
    onPeerStream: null,
    onPeerTrack: null,
  } as unknown as CollaborativeRoom['room'];

  const fake = {
    strategy,
    selfId,
    room,
    hello: createFakeAction<HelloPayload>(),
    schema: createFakeAction<EncryptJson>(),
    dispatch: createFakeAction<EncryptJson>(),
    participants: createFakeAction<EncryptJson>(),
    leave: vi.fn(() => {
      room.onPeerJoin = null;
      room.onPeerLeave = null;
      fake.hello.onMessage = null;
      fake.schema.onMessage = null;
      fake.dispatch.onMessage = null;
      fake.participants.onMessage = null;
    }),
  };

  return fake as unknown as FakeCollaborativeRoom;
}
