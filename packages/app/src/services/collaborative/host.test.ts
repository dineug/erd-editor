import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createFakeRoom, FakeCollaborativeRoom } from '@/__test-utils__/room';
import { CollaborativeHostService } from '@/services/collaborative/host';
import { joinCollaborativeRoom, Strategy } from '@/services/collaborative/room';
import { getAppDatabaseService } from '@/services/indexeddb';
import { bridge, collaborativeDispatchAction } from '@/utils/broadcastChannel';
import {
  decryptFromJson,
  encryptToJson,
  exportKey,
  generateKey,
} from '@/utils/crypto';

vi.mock('@/services/collaborative/room', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/services/collaborative/room')>();

  return { ...actual, joinCollaborativeRoom: vi.fn() };
});

let leader = true;
let elect: (() => void) | null = null;
const releaseLeadership = vi.fn();
const requestLeadershipMock = vi.fn((onElected: () => void) => {
  elect = onElected;
  return releaseLeadership;
});

vi.mock('@/services/collaborative/leader', () => ({
  isLeader: () => leader,
  requestLeadership: (onElected: () => void) =>
    requestLeadershipMock(onElected),
}));

vi.mock('@/services/indexeddb', () => ({
  getAppDatabaseService: vi.fn(),
}));

const joinMock = vi.mocked(joinCollaborativeRoom);
const getAppDatabaseServiceMock = vi.mocked(getAppDatabaseService);

describe('CollaborativeHostService', () => {
  let service: CollaborativeHostService;
  let secretKey: string;
  let key: CryptoKey;
  let db: { getSchemaEntity: any; replicationSchemaEntity: any };

  const openRooms = async (
    schemaId = 'schema-1',
    roomId = 'room-1'
  ): Promise<[FakeCollaborativeRoom, FakeCollaborativeRoom]> => {
    const nostr = createFakeRoom(Strategy.nostr);
    const mqtt = createFakeRoom(Strategy.mqtt);
    joinMock.mockResolvedValueOnce(nostr).mockResolvedValueOnce(mqtt);

    service.start();
    service.setSessions({ [schemaId]: [roomId, secretKey] });
    await vi.waitFor(() => expect(joinMock).toHaveBeenCalledTimes(2), {
      interval: 5,
    });

    return [nostr, mqtt];
  };

  beforeEach(async () => {
    key = await generateKey();
    secretKey = (await exportKey(key)).k!;
    db = {
      getSchemaEntity: vi.fn(async () => ({
        id: 'schema-1',
        name: 'schema',
        value: '{"version":3}',
        createAt: 0,
        updateAt: 0,
      })),
      replicationSchemaEntity: vi.fn(),
    };

    leader = true;
    elect = null;
    joinMock.mockReset();
    requestLeadershipMock.mockClear();
    releaseLeadership.mockClear();
    getAppDatabaseServiceMock.mockReturnValue(db as any);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    service = new CollaborativeHostService();
  });

  afterEach(() => {
    service.stop();
    vi.restoreAllMocks();
  });

  it('stands for leadership exactly once no matter how often it is started', () => {
    service.start();
    service.start();

    expect(requestLeadershipMock).toHaveBeenCalledTimes(1);
  });

  it('holds off on opening a room until this tab wins the lock', async () => {
    leader = false;
    service.start();
    service.setSessions({ 'schema-1': ['room-1', secretKey] });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(joinMock).not.toHaveBeenCalled();

    leader = true;
    elect?.();

    await vi.waitFor(() => expect(joinMock).toHaveBeenCalledTimes(2), {
      interval: 5,
    });
  });

  it('announces itself on every relay so either mesh can reach it', async () => {
    await openRooms();

    expect(joinMock).toHaveBeenNthCalledWith(
      1,
      Strategy.nostr,
      'room-1',
      secretKey
    );
    expect(joinMock).toHaveBeenNthCalledWith(
      2,
      Strategy.mqtt,
      'room-1',
      secretKey
    );
  });

  it('keeps serving on one relay when the other cannot be reached', async () => {
    const mqtt = createFakeRoom(Strategy.mqtt);
    joinMock
      .mockRejectedValueOnce(new Error('relay unreachable'))
      .mockResolvedValueOnce(mqtt);

    service.start();
    service.setSessions({ 'schema-1': ['room-1', secretKey] });
    await vi.waitFor(
      () => expect(mqtt.room.onPeerJoin).toBeTypeOf('function'),
      {
        interval: 5,
      }
    );
  });

  it('gives up on a session whose secret key is unusable', async () => {
    service.start();
    service.setSessions({ 'schema-1': ['room-1', 'not-a-key!!'] });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(joinMock).not.toHaveBeenCalled();

    // The dead session is dropped, so a later sync can retry from scratch.
    const nostr = createFakeRoom(Strategy.nostr);
    const mqtt = createFakeRoom(Strategy.mqtt);
    joinMock.mockResolvedValueOnce(nostr).mockResolvedValueOnce(mqtt);
    service.setSessions({ 'schema-1': ['room-1', secretKey] });

    await vi.waitFor(() => expect(joinMock).toHaveBeenCalledTimes(2), {
      interval: 5,
    });
  });

  it('greets a joining peer as the host and hands it an encrypted snapshot', async () => {
    const [nostr] = await openRooms();

    nostr.room.onPeerJoin?.('guest-1');
    await vi.waitFor(() => expect(nostr.schema.send).toHaveBeenCalled(), {
      interval: 5,
    });

    expect(nostr.hello.send).toHaveBeenCalledWith(
      { role: 'host' },
      { target: 'guest-1' }
    );

    const [payload, options] = nostr.schema.send.mock.calls[0];
    expect(options).toEqual({ target: 'guest-1' });
    expect(JSON.stringify(payload)).not.toContain('version');
    await expect(decryptFromJson(payload, key)).resolves.toBe('{"version":3}');
  });

  it('says nothing when the schema is gone from the database', async () => {
    db.getSchemaEntity.mockResolvedValueOnce(undefined);
    const [nostr] = await openRooms();

    nostr.room.onPeerJoin?.('guest-1');
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(nostr.schema.send).not.toHaveBeenCalled();
  });

  it('replicates an inbound batch into storage and every open tab', async () => {
    const [nostr] = await openRooms();
    const actions = [{ type: 'table.add', payload: { id: 'a' } }];
    const onReplication = vi.fn();
    const unsubscribe = bridge.on({ replicationSchemaEntity: onReplication });

    await nostr.dispatch.onMessage?.(
      await encryptToJson(JSON.stringify(actions), key),
      { peerId: 'guest-1' }
    );
    await vi.waitFor(() => expect(onReplication).toHaveBeenCalled(), {
      interval: 5,
    });

    expect(db.replicationSchemaEntity).toHaveBeenCalledWith(
      'schema-1',
      actions
    );
    expect(onReplication).toHaveBeenCalledWith({
      type: 'replicationSchemaEntity',
      payload: { id: 'schema-1', actions },
    });
    unsubscribe();
  });

  it('bridges an inbound batch to the other relay, never back to its source', async () => {
    const [nostr, mqtt] = await openRooms();
    const value = await encryptToJson('[]', key);

    await nostr.dispatch.onMessage?.(value, { peerId: 'guest-1' });
    await vi.waitFor(() => expect(mqtt.dispatch.send).toHaveBeenCalled(), {
      interval: 5,
    });

    expect(mqtt.dispatch.send).toHaveBeenCalledWith(value);
    expect(nostr.dispatch.send).not.toHaveBeenCalled();
  });

  it('ignores a batch it cannot decrypt', async () => {
    const [nostr, mqtt] = await openRooms();
    const otherKey = await generateKey();

    await nostr.dispatch.onMessage?.(await encryptToJson('[]', otherKey), {
      peerId: 'guest-1',
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(db.replicationSchemaEntity).not.toHaveBeenCalled();
    expect(mqtt.dispatch.send).not.toHaveBeenCalled();
  });

  it('encrypts a local edit onto every relay it is serving', async () => {
    const [nostr, mqtt] = await openRooms();
    const actions = [{ type: 'table.add', payload: { id: 'a' } }];

    bridge.emit(collaborativeDispatchAction({ schemaId: 'schema-1', actions }));
    await vi.waitFor(() => expect(nostr.dispatch.send).toHaveBeenCalled(), {
      interval: 5,
    });

    const [value] = nostr.dispatch.send.mock.calls[0];
    expect(JSON.stringify(value)).not.toContain('table.add');
    await expect(decryptFromJson(value, key)).resolves.toBe(
      JSON.stringify(actions)
    );
    expect(mqtt.dispatch.send).toHaveBeenCalledWith(value);
  });

  it('drops a local edit for a schema that has no session', async () => {
    const [nostr] = await openRooms();

    bridge.emit(
      collaborativeDispatchAction({ schemaId: 'other', actions: [] })
    );
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(nostr.dispatch.send).not.toHaveBeenCalled();
  });

  it('leaves every relay when the session is stopped', async () => {
    const [nostr, mqtt] = await openRooms();

    service.setSessions({});

    expect(nostr.leave).toHaveBeenCalledTimes(1);
    expect(mqtt.leave).toHaveBeenCalledTimes(1);
  });

  it('re-opens the room when the session credentials are rotated', async () => {
    const [nostr] = await openRooms();
    joinMock
      .mockResolvedValueOnce(createFakeRoom(Strategy.nostr))
      .mockResolvedValueOnce(createFakeRoom(Strategy.mqtt));

    service.setSessions({ 'schema-1': ['room-2', secretKey] });

    expect(nostr.leave).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(joinMock).toHaveBeenCalledTimes(4), {
      interval: 5,
    });
    expect(joinMock).toHaveBeenLastCalledWith(
      Strategy.mqtt,
      'room-2',
      secretKey
    );
  });

  it('does not re-open a room that is already serving the same session', async () => {
    await openRooms();

    service.setSessions({ 'schema-1': ['room-1', secretKey] });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(joinMock).toHaveBeenCalledTimes(2);
  });

  it('abandons a relay that connects after the session was stopped', async () => {
    const nostr = createFakeRoom(Strategy.nostr);
    let resolveJoin: (room: FakeCollaborativeRoom) => void = () => {};
    joinMock.mockReturnValueOnce(
      new Promise(resolve => {
        resolveJoin = resolve as any;
      })
    );

    service.start();
    service.setSessions({ 'schema-1': ['room-1', secretKey] });
    await vi.waitFor(() => expect(joinMock).toHaveBeenCalledTimes(1), {
      interval: 5,
    });

    service.setSessions({});
    resolveJoin(nostr);

    await vi.waitFor(() => expect(nostr.leave).toHaveBeenCalledTimes(1), {
      interval: 5,
    });
  });

  it('hands the lock back and closes every room when it shuts down', async () => {
    const [nostr, mqtt] = await openRooms();

    service.stop();

    expect(releaseLeadership).toHaveBeenCalledTimes(1);
    expect(nostr.leave).toHaveBeenCalledTimes(1);
    expect(mqtt.leave).toHaveBeenCalledTimes(1);

    // The bridge subscription goes with it, so a late edit reaches nothing.
    bridge.emit(
      collaborativeDispatchAction({ schemaId: 'schema-1', actions: [] })
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(nostr.dispatch.send).not.toHaveBeenCalled();
  });

  it('can be started again after being stopped', async () => {
    service.start();
    service.stop();
    service.start();

    expect(requestLeadershipMock).toHaveBeenCalledTimes(2);
  });
});
