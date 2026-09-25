// @vitest-environment node
/// <reference types="node" />

import { describe, expect, it } from 'vite-plus/test';

import { AUTH_ENV } from '@/__test-utils__/googleOAuth';
import { decodeBase64Url, encodeBase64Url } from '@/server/auth/base64url';
import { parseAuthEnv, parseCookieKey } from '@/server/auth/config';
import { REFRESH_COOKIE_AAD, STATE_COOKIE_AAD } from '@/server/auth/cookie';
import {
  importCookieKey,
  openValue,
  sealValue,
} from '@/server/auth/cookieCrypto';

const REFRESH_TOKEN = '1//0g-refresh-token-that-must-never-show';

async function key(fill = 7) {
  return importCookieKey(new Uint8Array(32).fill(fill));
}

/** Base64 of the plaintext in both alphabets, and a run of it, none of which may show. */
function traces(plaintext: string): string[] {
  const base64 = btoa(plaintext);
  return [
    plaintext,
    base64.replace(/=+$/, ''),
    encodeBase64Url(new TextEncoder().encode(plaintext)),
  ].map(value => value.slice(0, 16));
}

describe('sealValue and openValue', () => {
  it('round-trip a refresh token', async () => {
    const cookieKey = await key();

    const sealed = await sealValue(
      cookieKey,
      REFRESH_TOKEN,
      REFRESH_COOKIE_AAD
    );

    expect(await openValue(cookieKey, sealed, REFRESH_COOKIE_AAD)).toBe(
      REFRESH_TOKEN
    );
  });

  it('write v1, then iv, ciphertext and tag in one base64url body', async () => {
    const sealed = await sealValue(
      await key(),
      REFRESH_TOKEN,
      REFRESH_COOKIE_AAD
    );

    const [version, body] = sealed.split('.');
    expect(version).toBe('v1');
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBase64Url(body)?.length).toBe(12 + REFRESH_TOKEN.length + 16);
  });

  it('keep neither the plaintext nor its base64 in the value', async () => {
    const sealed = await sealValue(
      await key(),
      REFRESH_TOKEN,
      REFRESH_COOKIE_AAD
    );

    for (const trace of traces(REFRESH_TOKEN)) {
      expect(sealed).not.toContain(trace);
    }
  });

  it('draw a fresh iv for every seal', async () => {
    const cookieKey = await key();

    const first = await sealValue(cookieKey, REFRESH_TOKEN, REFRESH_COOKIE_AAD);
    const second = await sealValue(
      cookieKey,
      REFRESH_TOKEN,
      REFRESH_COOKIE_AAD
    );

    expect(first).not.toBe(second);
  });

  it('refuse a value sealed for the other cookie, in both directions', async () => {
    const cookieKey = await key();
    const refresh = await sealValue(cookieKey, 'x', REFRESH_COOKIE_AAD);
    const state = await sealValue(cookieKey, 'x', STATE_COOKIE_AAD);

    expect(await openValue(cookieKey, refresh, STATE_COOKIE_AAD)).toBeNull();
    expect(await openValue(cookieKey, state, REFRESH_COOKIE_AAD)).toBeNull();
  });

  it('refuse a value sealed by another key', async () => {
    const sealed = await sealValue(await key(1), 'x', REFRESH_COOKIE_AAD);

    expect(
      await openValue(await key(2), sealed, REFRESH_COOKIE_AAD)
    ).toBeNull();
  });

  it('refuse a tampered or malformed value', async () => {
    const cookieKey = await key();
    const sealed = await sealValue(
      cookieKey,
      REFRESH_TOKEN,
      REFRESH_COOKIE_AAD
    );
    const middle = Math.floor(sealed.length / 2);
    const flipped = `${sealed.slice(0, middle)}${sealed[middle] === 'A' ? 'B' : 'A'}${sealed.slice(middle + 1)}`;

    for (const value of [
      flipped,
      sealed.slice(0, -4),
      sealed.replace('v1.', 'v2.'),
      `${sealed}.extra`,
      sealed.replace('v1.', ''),
      'v1.',
      'v1.AAAA',
      'v1.not base64!',
      'v1.A',
      '',
    ]) {
      expect(await openValue(cookieKey, value, REFRESH_COOKIE_AAD)).toBeNull();
    }
  });
});

describe('base64url', () => {
  it('round-trips every length without padding', () => {
    for (let length = 0; length < 8; length++) {
      const bytes = Uint8Array.from({ length }, (_, index) => 250 + index);

      const encoded = encodeBase64Url(bytes);

      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(decodeBase64Url(encoded)).toEqual(bytes);
    }
  });

  it.each(['a+b/', 'abc=', 'a b', 'A'])('refuses %s', value => {
    expect(decodeBase64Url(value)).toBeNull();
  });
});

describe('parseCookieKey', () => {
  const bytes = new Uint8Array(32).fill(0xfb);
  const base64 = btoa(String.fromCharCode(...bytes));

  it.each([
    ['padded base64', base64],
    ['base64url', encodeBase64Url(bytes)],
    ['a value with surrounding space', ` ${base64}\n`],
  ])('reads 32 bytes from %s', (_, value) => {
    expect(parseCookieKey(value)).toEqual(bytes);
  });

  it.each([
    ['31 bytes', btoa('a'.repeat(31))],
    ['33 bytes', btoa('a'.repeat(33))],
    ['text that is not base64', 'not a key'],
    ['an empty value', ''],
    ['no value', undefined],
  ])('refuses %s', (_, value) => {
    expect(parseCookieKey(value)).toBeNull();
  });
});

describe('parseAuthEnv', () => {
  it('reads a complete configuration, trimmed', () => {
    expect(
      parseAuthEnv({
        ...AUTH_ENV,
        VITE_GOOGLE_CLIENT_ID: ` ${AUTH_ENV.VITE_GOOGLE_CLIENT_ID} `,
      })
    ).toEqual({
      clientId: AUTH_ENV.VITE_GOOGLE_CLIENT_ID,
      clientSecret: AUTH_ENV.GOOGLE_CLIENT_SECRET,
      cookieKey: new Uint8Array(32).fill(7),
    });
  });

  it.each([
    'VITE_GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'COOKIE_KEY',
  ] as const)('is null without %s, or with it blank', name => {
    expect(parseAuthEnv({ ...AUTH_ENV, [name]: undefined })).toBeNull();
    expect(parseAuthEnv({ ...AUTH_ENV, [name]: '  ' })).toBeNull();
  });
});
