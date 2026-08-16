import { describe, expect, it } from 'vite-plus/test';

import {
  decryptFromJson,
  encryptToJson,
  exportKey,
  generateKey,
  importKey,
} from '@/utils/crypto';

/**
 * Captured before `encryptToJson` switched from `base64.encode(iv)` to
 * `base64.encode(iv.buffer)`, using the exact call the old code made. The two
 * forms agree only while the view covers its whole buffer — `generateIv`
 * allocates 12 bytes and never subarrays them, so it does — but "agree today"
 * is a fact about the current implementation, not a guarantee.
 *
 * Every document a user has already stored was encoded the old way. If the iv
 * is ever derived or sliced differently, `encode` starts emitting a different
 * string and the only symptom in production is that existing rooms silently
 * stop decrypting. Here it goes red instead.
 */
const FROZEN = {
  key: 'LFSozsFn8wg1ReEXTqTBEA',
  plaintext: 'erd-editor collaborative document · 한글 · 0123456789',
  encrypted:
    'Be7hoe7rTlZ9KpbXvjytEojwID4cfgDRlqUYrjrIySo42DsR5+An3OuTgaKhu/dB50/cscm0n1o4sN8xG5u4IqDQ27kOzUSyPg==',
  iv: 'gdmVySX0Y9TTkYMI',
} as const;

describe('crypto', () => {
  it('decrypts a document encoded before the iv change', async () => {
    const key = await importKey(FROZEN.key);

    const value = await decryptFromJson(
      { encrypted: FROZEN.encrypted, iv: FROZEN.iv },
      key
    );

    expect(value).toBe(FROZEN.plaintext);
  });

  it('encodes the iv as exactly 12 bytes', async () => {
    const key = await generateKey();

    const { iv } = await encryptToJson('value', key);

    // base64 of 12 bytes is 16 characters with no padding. Encoding the backing
    // buffer of a subarray — rather than the 12-byte view — lands on a different
    // length here, which is the failure the `.buffer` change could have introduced.
    expect(iv).toHaveLength(16);
  });

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
