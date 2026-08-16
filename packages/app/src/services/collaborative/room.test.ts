import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  joinCollaborativeRoom,
  Role,
  STRATEGIES,
  Strategy,
} from '@/services/collaborative/room';

const leave = vi.fn(async () => {});

const createRoom = () => ({
  makeAction: vi.fn((name: string) => ({
    name,
    send: vi.fn(),
    onMessage: null,
    onReceiveProgress: null,
  })),
  leave,
  onPeerJoin: null,
  onPeerLeave: null,
});

const nostrJoinRoom = vi.fn((config: any, roomId: string) => createRoom());
const mqttJoinRoom = vi.fn((config: any, roomId: string) => createRoom());

vi.mock('@trystero-p2p/nostr', () => ({
  joinRoom: (config: any, roomId: string) => nostrJoinRoom(config, roomId),
}));
vi.mock('@trystero-p2p/mqtt', () => ({
  joinRoom: (config: any, roomId: string) => mqttJoinRoom(config, roomId),
}));

/** Room state is module-level, so every test works in its own room. */
let roomSeq = 0;
const nextRoomId = () => `room-${(roomSeq += 1)}`;

const makeActionNames = (join: typeof nostrJoinRoom) =>
  join.mock.results
    .flatMap(result => (result.value as any).makeAction.mock.calls)
    .map(([name]: [string]) => name);

describe('joinCollaborativeRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tries nostr first and falls back to mqtt', () => {
    expect(STRATEGIES).toEqual([Strategy.nostr, Strategy.mqtt]);
  });

  it('names the two roles a peer can announce', () => {
    expect(Role).toEqual({ host: 'host', guest: 'guest' });
  });

  it('passes the secret key as the trystero password', async () => {
    const roomId = nextRoomId();
    const room = await joinCollaborativeRoom(Strategy.nostr, roomId, 'secret');

    expect(nostrJoinRoom).toHaveBeenCalledWith(
      { appId: 'io.erd-editor', password: 'secret' },
      roomId
    );
    room.leave();
  });

  it('routes the mqtt strategy to the mqtt relay', async () => {
    const room = await joinCollaborativeRoom(
      Strategy.mqtt,
      nextRoomId(),
      'secret'
    );

    expect(mqttJoinRoom).toHaveBeenCalledTimes(1);
    expect(nostrJoinRoom).not.toHaveBeenCalled();
    expect(room.strategy).toBe(Strategy.mqtt);
    room.leave();
  });

  it('registers the hello/schema/dispatch actions on both sides of a session', async () => {
    const room = await joinCollaborativeRoom(
      Strategy.nostr,
      nextRoomId(),
      'secret'
    );

    expect(makeActionNames(nostrJoinRoom)).toEqual([
      'hello',
      'schema',
      'dispatch',
    ]);
    room.leave();
  });

  it("keeps every action name inside trystero's 32-byte limit", async () => {
    const room = await joinCollaborativeRoom(
      Strategy.nostr,
      nextRoomId(),
      'secret'
    );

    makeActionNames(nostrJoinRoom).forEach(name => {
      expect(new TextEncoder().encode(name).byteLength).toBeLessThanOrEqual(32);
    });
    room.leave();
  });

  it('detaches every handler before leaving so a stale room cannot fire', async () => {
    const room = await joinCollaborativeRoom(
      Strategy.nostr,
      nextRoomId(),
      'secret'
    );

    room.room.onPeerJoin = vi.fn();
    room.room.onPeerLeave = vi.fn();
    room.hello.onMessage = vi.fn();
    room.schema.onMessage = vi.fn();
    room.dispatch.onMessage = vi.fn();

    room.leave();

    expect(room.room.onPeerJoin).toBeNull();
    expect(room.room.onPeerLeave).toBeNull();
    expect(room.hello.onMessage).toBeNull();
    expect(room.schema.onMessage).toBeNull();
    expect(room.dispatch.onMessage).toBeNull();
    expect(leave).toHaveBeenCalledTimes(1);
  });

  /**
   * Trystero returns the *same* room object for a given appId + roomId, so a
   * second join must not be able to tear the first one's peers down.
   */
  describe('when the same room is joined twice', () => {
    it('reuses the single underlying trystero room', async () => {
      const roomId = nextRoomId();
      const [first, second] = await Promise.all([
        joinCollaborativeRoom(Strategy.nostr, roomId, 'secret'),
        joinCollaborativeRoom(Strategy.nostr, roomId, 'secret'),
      ]);

      expect(nostrJoinRoom).toHaveBeenCalledTimes(1);
      expect(second.room).toBe(first.room);
      expect(second.dispatch).toBe(first.dispatch);

      first.leave();
      second.leave();
    });

    it('keeps the room alive until the last holder leaves', async () => {
      const roomId = nextRoomId();
      const first = await joinCollaborativeRoom(Strategy.nostr, roomId, 'k');
      const second = await joinCollaborativeRoom(Strategy.nostr, roomId, 'k');

      first.dispatch.onMessage = vi.fn();
      first.leave();

      expect(leave).not.toHaveBeenCalled();
      expect(second.dispatch.onMessage).not.toBeNull();

      second.leave();
      expect(leave).toHaveBeenCalledTimes(1);
    });

    it('ignores a repeated leave from the same holder', async () => {
      const roomId = nextRoomId();
      const first = await joinCollaborativeRoom(Strategy.nostr, roomId, 'k');
      const second = await joinCollaborativeRoom(Strategy.nostr, roomId, 'k');

      first.leave();
      first.leave();

      expect(leave).not.toHaveBeenCalled();
      second.leave();
      expect(leave).toHaveBeenCalledTimes(1);
    });
  });

  it('waits for a teardown to finish before rejoining the same room', async () => {
    const roomId = nextRoomId();
    let finishLeave: () => void = () => {};
    leave.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishLeave = resolve;
        })
    );

    const first = await joinCollaborativeRoom(Strategy.nostr, roomId, 'k');
    first.leave();

    let rejoined = false;
    const rejoining = joinCollaborativeRoom(Strategy.nostr, roomId, 'k').then(
      room => {
        rejoined = true;
        return room;
      }
    );

    await Promise.resolve();
    expect(rejoined).toBe(false);
    expect(nostrJoinRoom).toHaveBeenCalledTimes(1);

    finishLeave();
    (await rejoining).leave();
    expect(nostrJoinRoom).toHaveBeenCalledTimes(2);
  });

  it('does not strand the room when the relay fails to load', async () => {
    const roomId = nextRoomId();
    nostrJoinRoom.mockImplementationOnce(() => {
      throw new Error('relay unreachable');
    });

    await expect(
      joinCollaborativeRoom(Strategy.nostr, roomId, 'k')
    ).rejects.toThrow('relay unreachable');

    const retried = await joinCollaborativeRoom(Strategy.nostr, roomId, 'k');
    expect(retried.room).toBeDefined();
    retried.leave();
  });

  describe('with private relays configured', () => {
    const withPrivateRelays = async (urls: string) => {
      vi.stubEnv('NOSTR_RELAY_URLS', urls);
      vi.resetModules();

      return await import('@/services/collaborative/room');
    };

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('signals through them instead of the public relays', async () => {
      const { joinCollaborativeRoom: join, Strategy: S } =
        await withPrivateRelays(' ws://localhost:4444 , ws://localhost:4445 ');

      const room = await join(S.nostr, 'private-room', 'secret');

      expect(nostrJoinRoom).toHaveBeenCalledWith(
        {
          appId: 'io.erd-editor',
          password: 'secret',
          relayConfig: { urls: ['ws://localhost:4444', 'ws://localhost:4445'] },
        },
        'private-room'
      );
      room.leave();
    });

    it('drops the public mqtt fallback along with the public nostr relays', async () => {
      const { STRATEGIES: strategies } = await withPrivateRelays(
        'ws://localhost:4444'
      );

      expect(strategies).toEqual([Strategy.nostr]);
    });
  });
});
