import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { createFakeRoom, FakeCollaborativeRoom } from '@/__test-utils__/room';
import {
  createCollaborativeGuest,
  GuestHandlers,
} from '@/services/collaborative/guest';
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

function createHandlers(): GuestHandlers & Record<string, any> {
  return {
    onSchema: vi.fn(),
    onDispatch: vi.fn(),
    onHostJoin: vi.fn(),
    onHostLeave: vi.fn(),
    onNotFoundHost: vi.fn(),
    onError: vi.fn(),
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

  const announceHost = (room: FakeCollaborativeRoom, peerId = 'host-1') => {
    room.hello.onMessage?.({ role: 'host' } as any, { peerId });
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

    expect(nostr.hello.send).toHaveBeenCalledWith(
      { role: 'guest' },
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
});
