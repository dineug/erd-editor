import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { CollaborativeService } from '@/services/indexeddb/modules/collaborative/service';
import { encryptToJson, importKey } from '@/utils/crypto';

describe('CollaborativeService', () => {
  let service: CollaborativeService;

  beforeEach(() => {
    service = new CollaborativeService();
  });

  it('mints a room id and secret key for a new session', async () => {
    const { roomId, secretKey } = await service.startSession('schema-1');

    expect(roomId).toHaveLength(21);
    expect(secretKey).toEqual(expect.any(String));
    expect(secretKey.length).toBeGreaterThan(0);
  });

  it('mints a secret key that is a usable AES-GCM key', async () => {
    const { secretKey } = await service.startSession('schema-1');
    const key = await importKey(secretKey);

    await expect(encryptToJson('value', key)).resolves.toMatchObject({
      encrypted: expect.any(String),
      iv: expect.any(String),
    });
  });

  it('keeps the credentials stable when the same session is started twice', async () => {
    const first = await service.startSession('schema-1');
    const second = await service.startSession('schema-1');

    expect(second).toEqual(first);
  });

  it('gives every schema its own room', async () => {
    const first = await service.startSession('schema-1');
    const second = await service.startSession('schema-2');

    expect(second.roomId).not.toBe(first.roomId);
    expect(second.secretKey).not.toBe(first.secretKey);
  });

  it('reports every live session as a [roomId, secretKey] pair', async () => {
    const { roomId, secretKey } = await service.startSession('schema-1');

    await expect(service.sessionAll()).resolves.toEqual({
      'schema-1': [roomId, secretKey],
    });
  });

  it('forgets a session once it is stopped', async () => {
    await service.startSession('schema-1');
    await service.startSession('schema-2');
    await service.stopSession('schema-1');

    await expect(service.sessionAll()).resolves.toEqual({
      'schema-2': expect.any(Array),
    });
  });

  it('issues fresh credentials after a stop and restart', async () => {
    const first = await service.startSession('schema-1');
    await service.stopSession('schema-1');
    const second = await service.startSession('schema-1');

    expect(second.roomId).not.toBe(first.roomId);
  });

  it('ignores a stop for a session that was never started', async () => {
    await expect(service.stopSession('nope')).resolves.toBeUndefined();
    await expect(service.sessionAll()).resolves.toEqual({});
  });
});
