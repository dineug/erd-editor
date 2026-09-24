import { Settings } from 'luxon';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { htmlReply, jsonReply, receiverChecked } from '@/__test-utils__/gdrive';
import {
  browserStorage,
  classifyRelayResponse,
  isLogoutPending,
  LOGOUT_PENDING_KEY,
  nextUtcMidnight,
  recordLogoutPending,
  recordServerUnavailable,
  RELAY_LOGOUT_PATH,
  RELAY_TIMEOUT_MS,
  RELAY_TOKEN_PATH,
  requestRelayLogout,
  requestRelayToken,
  shouldTryServer,
  UNAVAILABLE_UNTIL_KEY,
} from '@/services/gdrive/authMode';

const TOKEN = { access_token: 'ya29.a', expires_in: 3599, scope: 'openid' };

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe('classifyRelayResponse', () => {
  it('reads a 200 of the JSON contract as a token, scope included', async () => {
    await expect(classifyRelayResponse(jsonReply(TOKEN))).resolves.toEqual({
      kind: 'token',
      token: { accessToken: 'ya29.a', expiresIn: 3599, scope: 'openid' },
    });
  });

  it('keeps a token whose answer carries no scope, with the scope unknown', async () => {
    await expect(
      classifyRelayResponse(jsonReply({ access_token: 'a', expires_in: 60 }))
    ).resolves.toEqual({
      kind: 'token',
      token: { accessToken: 'a', expiresIn: 60, scope: null },
    });
  });

  it('reads a 401 of the JSON contract as signed out', async () => {
    await expect(
      classifyRelayResponse(jsonReply({ error: 'invalid_grant' }, 401))
    ).resolves.toEqual({ kind: 'signed-out' });
  });

  it.each([
    ['a 429', () => jsonReply({ error: 'rate_limited' }, 429)],
    ['a 500', () => jsonReply({ error: 'internal' }, 500)],
    ['a 502', () => jsonReply({ error: 'upstream' }, 502)],
    ['a 503 of the unconfigured relay', () => jsonReply({ error: 'x' }, 503)],
    ['the app HTML with 200', () => htmlReply(200)],
    ['a 1027 page', () => htmlReply(403)],
    ['a 401 of HTML', () => htmlReply(401)],
    ['a 401 without an error', () => jsonReply({ message: 'no' }, 401)],
    ['a 200 without a token', () => jsonReply({ expires_in: 3599 })],
    [
      'a 200 with an empty token',
      () => jsonReply({ ...TOKEN, access_token: '' }),
    ],
    ['a 200 without a lifetime', () => jsonReply({ access_token: 'a' })],
    [
      'a 200 with a lifetime of zero',
      () => jsonReply({ ...TOKEN, expires_in: 0 }),
    ],
    [
      'a 200 with a lifetime as text',
      () => jsonReply({ ...TOKEN, expires_in: '3599' }),
    ],
    ['a 200 of a JSON list', () => jsonReply([TOKEN])],
    ['a 200 of JSON null', () => jsonReply(null)],
  ])('reads %s as an unavailable relay', async (_label, response) => {
    await expect(classifyRelayResponse(response())).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});

/** A fetch that answers nothing until its signal aborts. */
function stalledFetch(signals: AbortSignal[]) {
  return receiverChecked(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) signals.push(signal);
        signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        );
      })
  );
}

describe('requestRelayToken', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('POSTs past the CSRF gate, calling fetch without a receiver', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetch = receiverChecked(async (input, init) => {
      calls.push({ input, init });
      return jsonReply(TOKEN);
    });

    await expect(requestRelayToken({ fetch })).resolves.toMatchObject({
      kind: 'token',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe(RELAY_TOKEN_PATH);
    expect(calls[0].init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
  });

  it('reads a network error online as unavailable', async () => {
    const fetch = receiverChecked(() =>
      Promise.reject(new TypeError('failed'))
    );
    await expect(
      requestRelayToken({ fetch, isOnline: () => true })
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('holds its judgement offline', async () => {
    const fetch = receiverChecked(() =>
      Promise.reject(new TypeError('failed'))
    );
    await expect(
      requestRelayToken({ fetch, isOnline: () => false })
    ).resolves.toEqual({ kind: 'offline' });
  });

  it('reads the browser being offline by default', async () => {
    const fetch = receiverChecked(() =>
      Promise.reject(new TypeError('failed'))
    );
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(requestRelayToken({ fetch })).resolves.toEqual({
      kind: 'offline',
    });
  });

  it('gives up after the timeout and reads it as unavailable', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];

    const result = requestRelayToken({
      fetch: stalledFetch(signals),
      isOnline: () => true,
    });
    await vi.advanceTimersByTimeAsync(RELAY_TIMEOUT_MS);

    await expect(result).resolves.toEqual({ kind: 'unavailable' });
    expect(signals.map(signal => signal.aborted)).toEqual([true]);
  });
});

describe('requestRelayLogout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('POSTs past the CSRF gate and reads the relay confirming', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetch = receiverChecked(async (input, init) => {
      calls.push({ input, init });
      return jsonReply({ ok: true, revoked: true });
    });

    await expect(requestRelayLogout({ fetch })).resolves.toBe(true);
    expect(calls[0].input).toBe(RELAY_LOGOUT_PATH);
    expect(calls[0].init).toMatchObject({
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
  });

  it.each([
    ['an HTML answer', () => Promise.resolve(htmlReply(200))],
    [
      'a refusal',
      () => Promise.resolve(jsonReply({ error: 'forbidden' }, 403)),
    ],
    ['a network error', () => Promise.reject(new TypeError('failed'))],
  ])('reads %s as not logged out, without throwing', async (_label, reply) => {
    await expect(
      requestRelayLogout({ fetch: receiverChecked(reply) })
    ).resolves.toBe(false);
  });

  it('gives up after the timeout, so a sign-out never hangs', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];

    const result = requestRelayLogout({ fetch: stalledFetch(signals) });
    await vi.advanceTimersByTimeAsync(RELAY_TIMEOUT_MS);

    await expect(result).resolves.toBe(false);
    expect(signals.map(signal => signal.aborted)).toEqual([true]);
  });
});

describe('the pending logout', () => {
  it('is remembered until cleared', () => {
    const storage = memoryStorage();
    expect(isLogoutPending(storage)).toBe(false);

    recordLogoutPending(storage, true);
    expect(storage.items.get(LOGOUT_PENDING_KEY)).toBe('1');
    expect(isLogoutPending(storage)).toBe(true);

    recordLogoutPending(storage, false);
    expect(storage.items.has(LOGOUT_PENDING_KEY)).toBe(false);
    expect(isLogoutPending(storage)).toBe(false);
  });

  it('is never pending without a storage, or with one that throws', () => {
    const storage = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      removeItem: () => {},
    };
    recordLogoutPending(null, true);
    expect(isLogoutPending(null)).toBe(false);
    expect(() => recordLogoutPending(storage, true)).not.toThrow();
    expect(isLogoutPending(storage)).toBe(false);
  });
});

describe('nextUtcMidnight', () => {
  afterEach(() => {
    Settings.defaultZone = 'system';
  });

  it('is the coming UTC midnight, a second before it', () => {
    expect(nextUtcMidnight(Date.parse('2026-09-25T23:59:59Z'))).toBe(
      Date.parse('2026-09-26T00:00:00Z')
    );
  });

  it('is a full day ahead at midnight itself', () => {
    expect(nextUtcMidnight(Date.parse('2026-09-26T00:00:00Z'))).toBe(
      Date.parse('2026-09-27T00:00:00Z')
    );
  });

  it('does not move with the local time zone', () => {
    const now = Date.parse('2026-09-25T20:30:00Z');
    const results = ['Asia/Seoul', 'America/Los_Angeles', 'UTC'].map(zone => {
      Settings.defaultZone = zone;
      return nextUtcMidnight(now);
    });
    expect(new Set(results)).toEqual(
      new Set([Date.parse('2026-09-26T00:00:00Z')])
    );
  });
});

describe('the unavailable relay until midnight', () => {
  const beforeMidnight = Date.parse('2026-09-25T23:59:59Z');
  const midnight = Date.parse('2026-09-26T00:00:00Z');

  it('stops trying the relay until UTC midnight, then tries it first', () => {
    const storage = memoryStorage();
    expect(shouldTryServer(storage, beforeMidnight)).toBe(true);

    recordServerUnavailable(storage, beforeMidnight);

    expect(storage.items.get(UNAVAILABLE_UNTIL_KEY)).toBe(String(midnight));
    expect(shouldTryServer(storage, beforeMidnight + 500)).toBe(false);
    expect(shouldTryServer(storage, midnight)).toBe(true);
    expect(storage.items.has(UNAVAILABLE_UNTIL_KEY)).toBe(false);
  });

  it('drops a value more than a day ahead, as after the clock moved back', () => {
    const storage = memoryStorage();
    storage.setItem(UNAVAILABLE_UNTIL_KEY, String(midnight + 3 * 86_400_000));
    expect(shouldTryServer(storage, beforeMidnight)).toBe(true);
    expect(storage.items.has(UNAVAILABLE_UNTIL_KEY)).toBe(false);
  });

  it('drops a value that is no number', () => {
    const storage = memoryStorage();
    storage.setItem(UNAVAILABLE_UNTIL_KEY, 'soon');
    expect(shouldTryServer(storage, beforeMidnight)).toBe(true);
  });

  it('tries the relay every time without a storage', () => {
    recordServerUnavailable(null, beforeMidnight);
    expect(shouldTryServer(null, beforeMidnight)).toBe(true);
  });

  it('tries the relay when the storage throws', () => {
    const storage = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      removeItem: () => {},
    };
    expect(() =>
      recordServerUnavailable(storage, beforeMidnight)
    ).not.toThrow();
    expect(shouldTryServer(storage, beforeMidnight)).toBe(true);
  });
});

describe('browserStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is localStorage', () => {
    expect(browserStorage()).toBe(globalThis.localStorage);
  });

  it('is null where reading localStorage throws', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(browserStorage()).toBeNull();
  });
});
