import { describe, expect, it } from 'vitest';

import {
  decryptFromJson,
  encryptToJson,
  exportKey,
  generateKey,
  importKey,
} from '@/utils/crypto';

describe('crypto', () => {
  it('round-trips a payload through export/import of the shared secret', async () => {
    const key = await generateKey();
    const jwk = await exportKey(key);
    const peerKey = await importKey(jwk.k!);
    const value = JSON.stringify({ type: 'table.add', payload: { id: 'a' } });

    const encrypted = await encryptToJson(value, key);

    expect(encrypted.encrypted).toEqual(expect.any(String));
    expect(encrypted.iv).toEqual(expect.any(String));
    expect(await decryptFromJson(encrypted, peerKey)).toBe(value);
  });

  it('uses a fresh iv per call so identical payloads never repeat', async () => {
    const key = await generateKey();

    const first = await encryptToJson('same', key);
    const second = await encryptToJson('same', key);

    expect(first.iv).not.toBe(second.iv);
    expect(first.encrypted).not.toBe(second.encrypted);
    expect(await decryptFromJson(second, key)).toBe('same');
  });

  it('generates an extractable AES-GCM 128 key', async () => {
    const key = await generateKey();
    const jwk = await exportKey(key);

    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 128 });
    expect(jwk).toMatchObject({ kty: 'oct', alg: 'A128GCM' });
  });

  it('fails to decrypt with a key from another session', async () => {
    const key = await generateKey();
    const otherKey = await generateKey();
    const encrypted = await encryptToJson('secret', key);

    await expect(decryptFromJson(encrypted, otherKey)).rejects.toThrow();
  });
});
