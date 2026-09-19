import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vite-plus/test';

import { collectUnhandledRejections } from '@/__test-utils__/rejections';
import {
  createFakeRoom,
  FakeCollaborativeRoom,
  rejectSends,
} from '@/__test-utils__/room';
import {
  createCollaborativeGuest,
  GuestHandlers,
} from '@/services/collaborative/guest';
import { NICKNAME_ANNOUNCE_DELAY } from '@/services/collaborative/participants';
import { joinCollaborativeRoom, Strategy } from '@/services/collaborative/room';
import { encryptToJson, exportKey, generateKey } from '@/utils/crypto';

vi.mock('@/services/collaborative/room', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/services/collaborative/room')>();

  return { ...actual, joinCollaborativeRoom: vi.fn() };
});

const joinMock = vi.mocked(joinCollaborativeRoom);

/** Long enough that a relay stays put for the whole test. */
const PATIENT = 1000 * 30;
/** Short enough to watch the guest give up on a relay. */
const IMPATIENT = 20;

type OnParticipants = NonNullable<GuestHandlers['onParticipants']>;

function createHandlers(): GuestHandlers & {
  onParticipants: Mock<OnParticipants>;
} {
  return {
    onSchema: vi.fn(),
    onDispatch: vi.fn(),
    onHostJoin: vi.fn(),
    onHostLeave: vi.fn(),
    onNotFoundHost: vi.fn(),
    onError: vi.fn(),
    onParticipants: vi.fn<OnParticipants>(),
  };
}

describe('createCollaborativeGuest', () => {
  let secretKey: string;
  let key: CryptoKey;
  let handlers: ReturnType<typeof createHandlers>;

  beforeEach(async () => {
    key = await generateKey();
    secretKey = (await exportKey(key)).k!;
    handlers = createHandlers();
    joinMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const connect = (rooms: FakeCollaborativeRoom[], relayTimeout = PATIENT) => {
    rooms.forEach(room => joinMock.mockResolvedValueOnce(room));

    return createCollaborativeGuest('room-1', secretKey, handlers, {
      relayTimeout,
    });
  };

  const joined = (times: number) =>
    vi.waitFor(() => expect(joinMock).toHaveBeenCalledTimes(times), {
      interval: 5,
    });

  const announceHost = (
    room: FakeCollaborativeRoom,
    peerId = 'host-1',
    nickname?: string
  ) => {
    room.hello.onMessage?.({ role: 'host', nickname } as any, { peerId });
  };

  it('reaches for the nostr relay before the mqtt one', async () => {
    const guest = connect([createFakeRoom(Strategy.nostr)]);
    await joined(1);

    expect(joinMock).toHaveBeenCalledWith(Strategy.nostr, 'room-1', secretKey);
    guest.close();
  });

  it('announces itself as a guest to every peer that joins', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const guest = connect([nostr]);
    await joined(1);

    nostr.room.onPeerJoin?.('peer-1');

    // The nickname goes out even blank: it tells the host this guest reads the
    // participants list.
    expect(nostr.hello.send).toHaveBeenCalledWith(
      { role: 'guest', nickname: '' },
      { target: 'peer-1' }
    );
    guest.close();
  });

  it('settles on the first relay a host answers on', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const guest = connect([nostr, createFakeRoom(Strategy.mqtt)], IMPATIENT);
    await joined(1);

    announceHost(nostr);
    await new Promise(resolve => setTimeout(resolve, IMPATIENT * 5));

    expect(handlers.onHostJoin).toHaveBeenCalledTimes(1);
    expect(joinMock).toHaveBeenCalledTimes(1);
    expect(nostr.leave).not.toHaveBeenCalled();
    guest.close();
  });

  it('falls back to the mqtt relay when no host answers on nostr', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const mqtt = createFakeRoom(Strategy.mqtt);
    const guest = connect([nostr, mqtt], IMPATIENT);
    await joined(2);

    // Leaving the dead relay is what keeps a guest from meeting the same host
    // twice, once per mesh.
    expect(nostr.leave).toHaveBeenCalledTimes(1);
    expect(joinMock).toHaveBeenLastCalledWith(
      Strategy.mqtt,
      'room-1',
      secretKey
    );
    guest.close();
  });

  it('reports that no host was found once every relay is exhausted', async () => {
    const guest = connect(
      [createFakeRoom(Strategy.nostr), createFakeRoom(Strategy.mqtt)],
      IMPATIENT
    );

    await vi.waitFor(() => expect(handlers.onNotFoundHost).toHaveBeenCalled(), {
      interval: 5,
    });
    expect(handlers.onHostJoin).not.toHaveBeenCalled();
    guest.close();
  });

  it('moves on to the next relay when one fails to connect at all', async () => {
    joinMock.mockRejectedValueOnce(new Error('relay unreachable'));
    const mqtt = createFakeRoom(Strategy.mqtt);
    joinMock.mockResolvedValueOnce(mqtt);

    const guest = createCollaborativeGuest('room-1', secretKey, handlers, {
      relayTimeout: PATIENT,
    });
    await joined(2);

    announceHost(mqtt);

    expect(handlers.onHostJoin).toHaveBeenCalledTimes(1);
    guest.close();
  });

  it('ignores a hello from another guest', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const guest = connect([nostr]);
    await joined(1);

    nostr.hello.onMessage?.({ role: 'guest' } as any, { peerId: 'guest-2' });

    expect(handlers.onHostJoin).not.toHaveBeenCalled();
    guest.close();
  });

  it('signals the host only once when several hosts are reachable', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const guest = connect([nostr]);
    await joined(1);

    announceHost(nostr, 'host-1');
    announceHost(nostr, 'host-2');

    expect(handlers.onHostJoin).toHaveBeenCalledTimes(1);
    guest.close();
  });

  it('holds the session open until the last host leaves', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const guest = connect([nostr]);
    await joined(1);

    announceHost(nostr, 'host-1');
    announceHost(nostr, 'host-2');

    nostr.room.onPeerLeave?.('host-1');
    expect(handlers.onHostLeave).not.toHaveBeenCalled();

    nostr.room.onPeerLeave?.('host-2');
    expect(handlers.onHostLeave).toHaveBeenCalledTimes(1);
    guest.close();
  });

  it('does not end the session when a fellow guest leaves', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const guest = connect([nostr]);
    await joined(1);

    announceHost(nostr);
    nostr.room.onPeerLeave?.('guest-2');

    expect(handlers.onHostLeave).not.toHaveBeenCalled();
    guest.close();
  });

  it('decrypts the schema snapshot pushed by the host', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const guest = connect([nostr]);
    await joined(1);

    await nostr.schema.onMessage?.(await encryptToJson('{"version":3}', key), {
      peerId: 'host-1',
    });

    expect(handlers.onSchema).toHaveBeenCalledWith('{"version":3}');
    guest.close();
  });

  it('decrypts and parses an inbound action batch', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const actions = [{ type: 'table.add', payload: { id: 'a' } }];
    const guest = connect([nostr]);
    await joined(1);

    await nostr.dispatch.onMessage?.(
      await encryptToJson(JSON.stringify(actions), key),
      { peerId: 'host-1' }
    );

    expect(handlers.onDispatch).toHaveBeenCalledWith(actions);
    guest.close();
  });

  it('surfaces a snapshot it cannot decrypt instead of seeding the editor', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const otherKey = await generateKey();
    const guest = connect([nostr]);
    await joined(1);

    await nostr.schema.onMessage?.(await encryptToJson('{}', otherKey), {
      peerId: 'host-1',
    });

    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onSchema).not.toHaveBeenCalled();
    guest.close();
  });

  it('surfaces a payload it cannot decrypt instead of throwing', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const otherKey = await generateKey();
    const guest = connect([nostr]);
    await joined(1);

    await nostr.dispatch.onMessage?.(await encryptToJson('{}', otherKey), {
      peerId: 'host-1',
    });

    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onDispatch).not.toHaveBeenCalled();
    guest.close();
  });

  it('encrypts what it sends to the room', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const guest = connect([nostr]);
    await joined(1);

    await guest.dispatch([{ type: 'table.add' }]);

    const [value] = nostr.dispatch.send.mock.calls[0];
    expect(value).toMatchObject({
      encrypted: expect.any(String),
      iv: expect.any(String),
    });
    expect(JSON.stringify(value)).not.toContain('table.add');
    guest.close();
  });

  it('lets a send fail quietly when its data channel closes as the host leaves', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const closed = new Error('data channel closed');
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const hello = rejectSends(nostr.hello, closed);
    const dispatch = rejectSends(nostr.dispatch, closed);
    const guest = connect([nostr]);
    await joined(1);

    const unhandled = await collectUnhandledRejections(async () => {
      nostr.room.onPeerJoin?.('host-1');
      await guest.dispatch([{ type: 'table.add' }]);
    });

    expect(hello).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled();
    expect(unhandled).toEqual([]);
    expect(debug).toHaveBeenCalledTimes(2);
    guest.close();
  });

  it('drops outbound actions while no relay is connected', async () => {
    joinMock.mockImplementation(() => new Promise(() => {}));
    const guest = createCollaborativeGuest('room-1', secretKey, handlers, {
      relayTimeout: PATIENT,
    });

    await expect(
      guest.dispatch([{ type: 'table.add' }])
    ).resolves.toBeUndefined();
    guest.close();
  });

  it('leaves the room and goes quiet once closed', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    const guest = connect([nostr]);
    await joined(1);
    announceHost(nostr);

    guest.close();

    expect(nostr.leave).toHaveBeenCalledTimes(1);

    await nostr.dispatch.onMessage?.(await encryptToJson('[]', key), {
      peerId: 'host-1',
    });
    await guest.dispatch([{ type: 'table.add' }]);

    expect(handlers.onDispatch).not.toHaveBeenCalled();
    expect(nostr.dispatch.send).not.toHaveBeenCalled();
  });

  it('abandons a relay that resolves after the guest was closed', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    let resolveJoin: (room: FakeCollaborativeRoom) => void = () => {};
    joinMock.mockReturnValueOnce(
      new Promise(resolve => {
        resolveJoin = resolve as any;
      })
    );

    const guest = createCollaborativeGuest('room-1', secretKey, handlers, {
      relayTimeout: PATIENT,
    });
    await joined(1);

    guest.close();
    resolveJoin(nostr);

    await vi.waitFor(() => expect(nostr.leave).toHaveBeenCalledTimes(1), {
      interval: 5,
    });
    expect(handlers.onNotFoundHost).not.toHaveBeenCalled();
  });

  describe('participants', () => {
    const encryptList = async (list: unknown) =>
      await encryptToJson(JSON.stringify(list), key);

    const lastParticipants = () =>
      handlers.onParticipants.mock.calls[
        handlers.onParticipants.mock.calls.length - 1
      ];

    afterEach(() => {
      vi.useRealTimers();
    });

    it('carries a nickname set before joining in its first hello, with no extra one', async () => {
      vi.useFakeTimers();
      const nostr = createFakeRoom(Strategy.nostr);
      const guest = connect([nostr]);
      guest.setNickname('Ann');
      await joined(1);

      nostr.room.onPeerJoin?.('host-1');
      vi.advanceTimersByTime(NICKNAME_ANNOUNCE_DELAY);

      expect(nostr.hello.send).toHaveBeenCalledTimes(1);
      expect(nostr.hello.send).toHaveBeenCalledWith(
        { role: 'guest', nickname: 'Ann' },
        { target: 'host-1' }
      );
      guest.close();
    });

    it('re-announces a changed nickname to the room once the typing settles', async () => {
      const nostr = createFakeRoom(Strategy.nostr);
      const guest = connect([nostr]);
      await joined(1);
      announceHost(nostr);

      vi.useFakeTimers();
      guest.setNickname('A');
      guest.setNickname('An');
      guest.setNickname('Ann');
      guest.setNickname('Ann');
      expect(nostr.hello.send).not.toHaveBeenCalled();

      vi.advanceTimersByTime(NICKNAME_ANNOUNCE_DELAY);

      expect(nostr.hello.send).toHaveBeenCalledTimes(1);
      expect(nostr.hello.send).toHaveBeenCalledWith({
        role: 'guest',
        nickname: 'Ann',
      });
      guest.close();
    });

    it('drops a pending announcement once closed', async () => {
      const nostr = createFakeRoom(Strategy.nostr);
      const guest = connect([nostr]);
      await joined(1);
      announceHost(nostr);

      vi.useFakeTimers();
      guest.setNickname('Ann');
      guest.close();
      vi.advanceTimersByTime(NICKNAME_ANNOUNCE_DELAY);

      expect(nostr.hello.send).not.toHaveBeenCalled();
    });

    it('lists the hosts it has heard from, then itself, until a host sends a list', async () => {
      const nostr = createFakeRoom(Strategy.nostr, 'guest-self');
      const guest = connect([nostr]);
      await joined(1);

      announceHost(nostr, 'host-1', ' Hana ');

      expect(handlers.onParticipants).toHaveBeenLastCalledWith(
        [
          { peerId: 'host-1', role: 'host', nickname: 'Hana' },
          { peerId: 'guest-self', role: 'guest', nickname: '' },
        ],
        'guest-self'
      );
      guest.close();
    });

    it('falls back to the role for a host on an old build', async () => {
      const nostr = createFakeRoom(Strategy.nostr);
      const guest = connect([nostr]);
      await joined(1);

      nostr.hello.onMessage?.({ role: 'host' } as any, { peerId: 'host-1' });

      expect(lastParticipants()[0]).toEqual([
        { peerId: 'host-1', role: 'host', nickname: undefined },
        { peerId: 'self', role: 'guest', nickname: '' },
      ]);
      guest.close();
    });

    it("takes the host's list, keeping its own nickname current", async () => {
      const nostr = createFakeRoom(Strategy.nostr);
      const guest = connect([nostr]);
      await joined(1);
      announceHost(nostr, 'host-1', 'Hana');
      guest.setNickname('Ann');

      await nostr.participants.onMessage?.(
        await encryptList([
          { peerId: 'host-1', role: 'host', nickname: 'Hana' },
          { peerId: 'self', role: 'guest', nickname: 'stale' },
          { peerId: 'guest-2', role: 'guest', nickname: 'Bob' },
        ]),
        { peerId: 'host-1' }
      );

      expect(lastParticipants()).toEqual([
        [
          { peerId: 'host-1', role: 'host', nickname: 'Hana' },
          { peerId: 'guest-2', role: 'guest', nickname: 'Bob' },
          { peerId: 'self', role: 'guest', nickname: 'Ann' },
        ],
        'self',
      ]);
      guest.close();
    });

    it('shows its own new nickname at once, before any peer hears of it', async () => {
      const nostr = createFakeRoom(Strategy.nostr);
      const guest = connect([nostr]);
      await joined(1);
      announceHost(nostr, 'host-1', 'Hana');

      guest.setNickname('Ann');

      expect(lastParticipants()[0]).toContainEqual({
        peerId: 'self',
        role: 'guest',
        nickname: 'Ann',
      });
      guest.close();
    });

    it('takes a list from a host only, since every guest holds the key', async () => {
      const nostr = createFakeRoom(Strategy.nostr);
      const guest = connect([nostr]);
      await joined(1);
      announceHost(nostr, 'host-1');
      handlers.onParticipants.mockClear();

      await nostr.participants.onMessage?.(
        await encryptList([{ peerId: 'mallory', role: 'host' }]),
        { peerId: 'guest-2' }
      );

      expect(handlers.onParticipants).not.toHaveBeenCalled();
      guest.close();
    });

    it('logs a list it cannot read without ending the session', async () => {
      const nostr = createFakeRoom(Strategy.nostr);
      const otherKey = await generateKey();
      const guest = connect([nostr]);
      await joined(1);
      announceHost(nostr, 'host-1');
      handlers.onParticipants.mockClear();

      await nostr.participants.onMessage?.(
        await encryptToJson('[]', otherKey),
        { peerId: 'host-1' }
      );

      expect(console.error).toHaveBeenCalled();
      expect(handlers.onError).not.toHaveBeenCalled();
      expect(handlers.onParticipants).not.toHaveBeenCalled();
      guest.close();
    });

    it("forgets the host's list once the last host leaves", async () => {
      const nostr = createFakeRoom(Strategy.nostr);
      const guest = connect([nostr]);
      await joined(1);
      announceHost(nostr, 'host-1', 'Hana');
      await nostr.participants.onMessage?.(
        await encryptList([
          { peerId: 'host-1', role: 'host', nickname: 'Hana' },
          { peerId: 'guest-2', role: 'guest', nickname: 'Bob' },
        ]),
        { peerId: 'host-1' }
      );

      nostr.room.onPeerLeave?.('host-1');

      expect(lastParticipants()[0]).toEqual([
        { peerId: 'self', role: 'guest', nickname: '' },
      ]);
      guest.close();
    });

    it('stays quiet about participants after it is closed', async () => {
      const nostr = createFakeRoom(Strategy.nostr);
      const guest = connect([nostr]);
      await joined(1);
      guest.close();
      handlers.onParticipants.mockClear();

      guest.setNickname('Ann');

      expect(handlers.onParticipants).not.toHaveBeenCalled();
    });
  });
});
