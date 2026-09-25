import { DateTime } from 'luxon';

import type { FetchLike, StorageLike } from '@/services/gdrive/types';
import { asRecord } from '@/services/gdrive/util';

export const RELAY_START_PATH = '/api/auth/start';
export const RELAY_TOKEN_PATH = '/api/auth/token';
export const RELAY_LOGOUT_PATH = '/api/auth/logout';
export const RELAY_TIMEOUT_MS = 10_000;
export const UNAVAILABLE_UNTIL_KEY =
  '@dineug/erd-editor-app/gdrive-relay-unavailable-until';
export const LOGOUT_PENDING_KEY =
  '@dineug/erd-editor-app/gdrive-relay-logout-pending';

const DAY_MS = 24 * 60 * 60 * 1000;

export type RelayToken = {
  accessToken: string;
  expiresIn: number;
  /** What Google granted, space separated; null when the answer did not say. */
  scope: string | null;
};

/**
 * The relay's answer by its JSON contract, never by status alone: a 200 of the
 * app's HTML, a 429 or a 1027 page all mean it is unavailable, and offline
 * means nothing can be told yet.
 */
export type RelayTokenResult =
  | { kind: 'token'; token: RelayToken }
  | { kind: 'signed-out' }
  | { kind: 'unavailable' }
  | { kind: 'offline' };

export type RelayDeps = {
  /** Called without a receiver; bind it where the client is assembled. */
  fetch: FetchLike;
  isOnline?: () => boolean;
  timeoutMs?: number;
};

function browserIsOnline(): boolean {
  return globalThis.navigator?.onLine !== false;
}

/** localStorage, or null where reading it throws, as in a sandboxed frame. */
export function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

async function readJson(
  response: Response
): Promise<Record<string, unknown> | null> {
  try {
    return asRecord(await response.json());
  } catch {
    return null;
  }
}

export async function classifyRelayResponse(
  response: Response
): Promise<RelayTokenResult> {
  if (response.status !== 200 && response.status !== 401) {
    return { kind: 'unavailable' };
  }
  const body = await readJson(response);
  if (response.status === 401) {
    return typeof body?.error === 'string'
      ? { kind: 'signed-out' }
      : { kind: 'unavailable' };
  }

  const accessToken = body?.access_token;
  const expiresIn = body?.expires_in;
  if (
    typeof accessToken !== 'string' ||
    !accessToken ||
    typeof expiresIn !== 'number' ||
    !(expiresIn > 0)
  ) {
    return { kind: 'unavailable' };
  }
  return {
    kind: 'token',
    token: {
      accessToken,
      expiresIn,
      scope: typeof body?.scope === 'string' ? body.scope : null,
    },
  };
}

/** Calls run with a signal that aborts after timeoutMs, so a stalled answer gives up too. */
export async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** A POST the relay's CSRF gate lets through: the browser adds Origin, this adds the header. */
function relayPost(signal: AbortSignal): RequestInit {
  return {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  };
}

export async function requestRelayToken({
  fetch: send,
  isOnline = browserIsOnline,
  timeoutMs = RELAY_TIMEOUT_MS,
}: RelayDeps): Promise<RelayTokenResult> {
  try {
    return await withTimeout(timeoutMs, async signal =>
      classifyRelayResponse(await send(RELAY_TOKEN_PATH, relayPost(signal)))
    );
  } catch {
    return isOnline() ? { kind: 'unavailable' } : { kind: 'offline' };
  }
}

/**
 * What the relay's logout did: confirmed once it cleared the cookie, revoked
 * once Google ended the grant, which a missing cookie or Google's failure leaves
 * false.
 */
export type RelayLogoutResult = { confirmed: boolean; revoked: boolean };

/** The relay's logout; a failure, ten seconds of silence included, is not an error to the caller. */
export async function requestRelayLogout({
  fetch: send,
  timeoutMs = RELAY_TIMEOUT_MS,
}: Pick<RelayDeps, 'fetch' | 'timeoutMs'>): Promise<RelayLogoutResult> {
  try {
    return await withTimeout(timeoutMs, async signal => {
      const response = await send(RELAY_LOGOUT_PATH, relayPost(signal));
      const body = response.ok ? await readJson(response) : null;
      const confirmed = body?.ok === true;
      return { confirmed, revoked: confirmed && body?.revoked === true };
    });
  } catch {
    return { confirmed: false, revoked: false };
  }
}

/**
 * Remembers a sign-out the relay did not confirm, whose cookie may still sign
 * this browser in: the logout goes ahead of the next token request.
 */
export function recordLogoutPending(
  storage: StorageLike | null,
  pending: boolean
): void {
  try {
    if (pending) storage?.setItem(LOGOUT_PENDING_KEY, '1');
    else storage?.removeItem(LOGOUT_PENDING_KEY);
  } catch {
    // Without a storage the direct revoke at sign-out is all there is.
  }
}

export function isLogoutPending(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(LOGOUT_PENDING_KEY) != null;
  } catch {
    return false;
  }
}

/** When Workers' free quota resets, whatever the local time zone. */
export function nextUtcMidnight(now: number): number {
  return DateTime.fromMillis(now, { zone: 'utc' })
    .startOf('day')
    .plus({ days: 1 })
    .toMillis();
}

/** Remembers an unavailable relay until the next UTC midnight, in this browser's every tab. */
export function recordServerUnavailable(
  storage: StorageLike | null,
  now: number
): void {
  try {
    storage?.setItem(UNAVAILABLE_UNTIL_KEY, String(nextUtcMidnight(now)));
  } catch {
    // A storage that refuses writes leaves this tab to try the relay again.
  }
}

/**
 * False until the recorded midnight, so a fallen-back browser sends the relay
 * nothing. A value more than a day ahead, from a clock set back, is dropped.
 */
export function shouldTryServer(
  storage: StorageLike | null,
  now: number
): boolean {
  try {
    const until = Number(storage?.getItem(UNAVAILABLE_UNTIL_KEY) ?? NaN);
    if (!(now < until && until - now <= DAY_MS)) {
      storage?.removeItem(UNAVAILABLE_UNTIL_KEY);
      return true;
    }
    return false;
  } catch {
    return true;
  }
}
