// @vitest-environment node
/// <reference types="node" />

// Node, not happy-dom: happy-dom's Request drops the Origin and Cookie headers,
// which would let every guard and cookie case below pass against nothing.

import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  AUTH_ENV,
  cookiePair,
  createFakeGoogle,
  DRIVE_FILE,
  jsonReply,
} from '@/__test-utils__/googleOAuth';
import { type AuthEnv, type AuthEvent, handleAuthRequest } from '@/server/auth';
import {
  AUTH_CHANNEL,
  CALLBACK_MARKER,
  type CallbackError,
  renderCallbackPage,
  toCallbackError,
} from '@/server/auth/callbackPage';
import { parseCookieKey } from '@/server/auth/config';
import {
  REFRESH_COOKIE,
  STATE_COOKIE,
  STATE_COOKIE_AAD,
} from '@/server/auth/cookie';
import { importCookieKey, sealValue } from '@/server/auth/cookieCrypto';
import { onRequest } from '@/server/auth/pages';

const ORIGIN = 'https://erd-editor.test';
const ATTEMPT = 'AbCdEfGhIjKlMnOpQrStUv';
const XHR = { Origin: ORIGIN, 'X-Requested-With': 'XMLHttpRequest' };
const CALLBACK_ERRORS: CallbackError[] = [
  'access_denied',
  'state_mismatch',
  'invalid_grant',
  'scope_missing',
  'upstream',
  'unknown',
];

type Call = {
  method?: string;
  cookie?: string;
  headers?: Record<string, string>;
};

function setup(env: AuthEnv = AUTH_ENV) {
  const google = createFakeGoogle();
  const events: AuthEvent[] = [];
  const clock = { now: Date.UTC(2026, 8, 25, 12) };

  function call(path: string, { method = 'GET', cookie, headers }: Call = {}) {
    return handleAuthRequest(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
      }),
      env,
      {
        fetch: google.fetch,
        tokenUrl: google.tokenUrl,
        revokeUrl: google.revokeUrl,
        now: () => clock.now,
        log: event => events.push(event),
      }
    );
  }

  const post = (
    path: string,
    cookie?: string,
    headers: Record<string, string> = XHR
  ) => call(path, { method: 'POST', cookie, headers });

  /** Start, Google's consent, then the callback, the way the popup walks it. */
  async function signIn({
    attempt = ATTEMPT,
    scope,
  }: { attempt?: string; scope?: string } = {}) {
    const start = await call(`/api/auth/start?attempt=${attempt}`);
    const location = new URL(start.headers.get('Location') ?? '');
    const code = google.issueCode(
      location.searchParams.get('code_challenge') ?? '',
      scope
    );
    const state = location.searchParams.get('state');
    const callback = await call(
      `/api/auth/callback?state=${state}&code=${code}`,
      { cookie: cookiePair(start, STATE_COOKIE) }
    );
    return { start, location, code, callback };
  }

  async function signedIn() {
    const { callback } = await signIn();
    return cookiePair(callback, REFRESH_COOKIE);
  }

  return { google, events, clock, call, post, signIn, signedIn };
}

function setCookie(response: Response, name: string): string {
  return (
    response.headers
      .getSetCookie()
      .find(cookie => cookie.startsWith(`${name}=`)) ?? ''
  );
}

function marker(body: string) {
  const document = new new Window().DOMParser().parseFromString(
    body,
    'text/html'
  );
  const meta = document.querySelector(`meta[name="${CALLBACK_MARKER}"]`);
  return {
    ok: meta?.getAttribute('data-ok'),
    error: meta?.getAttribute('data-error'),
    attempt: meta?.getAttribute('data-attempt'),
  };
}

/** Seals a state cookie value with the test key, as only the relay could. */
async function sealState(plaintext: string): Promise<string> {
  const key = await importCookieKey(
    parseCookieKey(AUTH_ENV.COOKIE_KEY) ?? new Uint8Array(32)
  );
  return sealValue(key, plaintext, STATE_COOKIE_AAD);
}

/** Changes a character in the middle of a cookie value, where every bit counts. */
function tamper(pair: string): string {
  const at = pair.length - 10;
  return `${pair.slice(0, at)}${pair[at] === 'A' ? 'B' : 'A'}${pair.slice(at + 1)}`;
}

function count(text: string, part: string): number {
  return text.split(part).length - 1;
}

function expectNoCors(response: Response) {
  for (const name of response.headers.keys()) {
    expect(name).not.toMatch(/^access-control-/);
  }
}

describe('start', () => {
  it('sends the popup to Google with consent, offline access and PKCE', async () => {
    const { call, events } = setup();

    const response = await call(`/api/auth/start?attempt=${ATTEMPT}`);

    expect(response.status).toBe(302);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const location = new URL(response.headers.get('Location') ?? '');
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth'
    );
    const params = Object.fromEntries(location.searchParams);
    expect(params).toEqual({
      client_id: AUTH_ENV.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: `${ORIGIN}/api/auth/callback`,
      response_type: 'code',
      scope: `${DRIVE_FILE} https://www.googleapis.com/auth/drive.install openid email`,
      access_type: 'offline',
      prompt: 'consent select_account',
      include_granted_scopes: 'true',
      code_challenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      code_challenge_method: 'S256',
      state: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    expect(params).not.toHaveProperty('response_mode');
    expect(params).not.toHaveProperty('login_hint');
    expect(events).toEqual(['auth.start']);
  });

  it('seals state, verifier and attempt into a Lax __Host- cookie for ten minutes', async () => {
    const { call } = setup();

    const response = await call(`/api/auth/start?attempt=${ATTEMPT}`);

    const cookie = setCookie(response, STATE_COOKIE);
    const attributes = cookie.split('; ').slice(1);
    expect(attributes.sort()).toEqual(
      ['HttpOnly', 'Max-Age=600', 'Path=/', 'SameSite=Lax', 'Secure'].sort()
    );
    const value = cookie.split(';')[0].slice(`${STATE_COOKIE}=`.length);
    expect(value).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    const state = new URL(response.headers.get('Location') ?? '').searchParams;
    expect(value).not.toContain(state.get('state'));
    expect(value).not.toContain(ATTEMPT);
  });

  it('draws a new state and challenge for every sign-in', async () => {
    const { call } = setup();

    const [first, second] = await Promise.all([
      call('/api/auth/start'),
      call('/api/auth/start'),
    ]);

    const params = (response: Response) =>
      new URL(response.headers.get('Location') ?? '').searchParams;
    expect(params(first).get('state')).not.toBe(params(second).get('state'));
    expect(params(first).get('code_challenge')).not.toBe(
      params(second).get('code_challenge')
    );
  });

  it.each(['1234567890123456789012', 'someone@example.com'])(
    'passes login_hint %s to Google and skips the account chooser',
    async hint => {
      const { call } = setup();

      const response = await call(
        `/api/auth/start?attempt=${ATTEMPT}&login_hint=${encodeURIComponent(hint)}`
      );

      const params = new URL(response.headers.get('Location') ?? '')
        .searchParams;
      expect(params.get('login_hint')).toBe(hint);
      expect(params.get('prompt')).toBe('consent');
    }
  );

  it.each([
    ['a short attempt', 'attempt=abc'],
    ['a long attempt', `attempt=${ATTEMPT}x`],
    ['an attempt outside base64url', 'attempt=AbCdEfGhIjKlMnOpQrSt%3D%3D'],
    ['an empty attempt', 'attempt='],
    ['markup as a hint', 'login_hint=%3Cscript%3E'],
    ['a hint with a space', 'login_hint=some%20one%40example.com'],
    [
      'a hint over 256 characters',
      `login_hint=${'a'.repeat(250)}%40example.com`,
    ],
    ['an empty hint', 'login_hint='],
  ])('refuses %s with 400 JSON and no cookie', async (_, query) => {
    const { call, events } = setup();

    const response = await call(`/api/auth/start?${query}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(events).toEqual([]);
  });
});

describe('callback', () => {
  it('sets the refresh cookie and reports success to its own attempt', async () => {
    const { google, events, signIn } = setup();

    const { callback, code } = await signIn();

    expect(callback.status).toBe(200);
    expect(google.requests).toHaveLength(1);
    const exchange = google.requests[0].params;
    expect(exchange.get('grant_type')).toBe('authorization_code');
    expect(exchange.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback`);
    expect(exchange.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const refresh = setCookie(callback, REFRESH_COOKIE);
    expect(refresh.split('; ').slice(1).sort()).toEqual(
      [
        'HttpOnly',
        'Max-Age=15552000',
        'Path=/',
        'SameSite=Strict',
        'Secure',
      ].sort()
    );
    expect(refresh).not.toContain('refresh-token-');
    expect(setCookie(callback, STATE_COOKIE)).toContain('Max-Age=0');

    const body = await callback.text();
    expect(marker(body)).toEqual({ ok: 'true', error: '', attempt: ATTEMPT });
    expect(body).not.toContain('access-token-');
    expect(body).not.toContain('refresh-token-');
    expect(body).not.toContain(code);
    expect(events).toEqual(['auth.start', 'auth.callback.ok']);
  });

  it('answers with a page that runs one nonce script and leaks no referrer', async () => {
    const { signIn } = setup();

    const { callback } = await signIn();

    const body = await callback.text();
    const nonce = /<script nonce="([A-Za-z0-9_-]{22})">/.exec(body)?.[1];
    expect(nonce).toBeDefined();
    expect(callback.headers.get('Content-Security-Policy')).toBe(
      `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    );
    expect(callback.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(callback.headers.get('Cache-Control')).toBe('no-store');
    expect(callback.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(callback.headers.get('Content-Type')).toBe(
      'text/html; charset=utf-8'
    );
    expect(count(body, '<script')).toBe(1);
    expectNoCors(callback);
  });

  it.each<
    [string, (flow: Flow & { refreshCookie: string }) => Promise<Response>]
  >([
    [
      'without a state cookie',
      ({ call, state, code }) =>
        call(`/api/auth/callback?state=${state}&code=${code}`),
    ],
    [
      'with another state',
      ({ call, cookie, code }) =>
        call(`/api/auth/callback?state=forged&code=${code}`, { cookie }),
    ],
    [
      'without a state',
      ({ call, cookie, code }) =>
        call(`/api/auth/callback?code=${code}`, { cookie }),
    ],
    [
      'with a tampered cookie',
      ({ call, cookie, state, code }) =>
        call(`/api/auth/callback?state=${state}&code=${code}`, {
          cookie: tamper(cookie),
        }),
    ],
    [
      'after the cookie has expired',
      ({ call, cookie, state, code, clock }) => {
        clock.now += 600_001;
        return call(`/api/auth/callback?state=${state}&code=${code}`, {
          cookie,
        });
      },
    ],
    [
      'with the refresh cookie in its place',
      ({ call, state, code, refreshCookie }) =>
        call(`/api/auth/callback?state=${state}&code=${code}`, {
          cookie: refreshCookie.replace(REFRESH_COOKIE, STATE_COOKIE),
        }),
    ],
    [
      'with a sealed cookie that is not JSON',
      async ({ call, state, code }) =>
        call(`/api/auth/callback?state=${state}&code=${code}`, {
          cookie: `${STATE_COOKIE}=${await sealState('not json')}`,
        }),
    ],
    [
      'with a sealed cookie of another shape',
      async ({ call, state, code }) =>
        call(`/api/auth/callback?state=${state}&code=${code}`, {
          cookie: `${STATE_COOKIE}=${await sealState(JSON.stringify({ state, verifier: 1 }))}`,
        }),
    ],
  ])('stops as state_mismatch %s, telling no opener', async (_, callback) => {
    const flow = {
      ...(await beginFlow()),
      refreshCookie: await setup().signedIn(),
    };

    const response = await callback(flow);

    expect(response.status).toBe(400);
    expect(marker(await response.text())).toEqual({
      ok: 'false',
      error: 'state_mismatch',
      attempt: '',
    });
    expect(flow.google.requests).toEqual([]);
    expect(setCookie(response, REFRESH_COOKIE)).toBe('');
    expect(setCookie(response, STATE_COOKIE)).toContain('Max-Age=0');
    expect(flow.events.at(-1)).toBe('auth.callback.state_mismatch');
  });

  it.each<[string, CallbackError, (flow: Flow) => string]>([
    ['Google denied access', 'access_denied', () => 'error=access_denied'],
    ['Google reported another error', 'unknown', () => 'error=server_error'],
    ['no code came back', 'unknown', () => ''],
    ['the code does not exchange', 'invalid_grant', () => 'code=unknown-code'],
  ])(
    'reports %s as %s to the attempt, without a refresh cookie',
    async (_, error, query) => {
      const flow = await beginFlow();

      const response = await flow.call(
        `/api/auth/callback?state=${flow.state}&${query(flow)}`,
        { cookie: flow.cookie }
      );

      expect(response.status).toBe(400);
      expect(marker(await response.text())).toEqual({
        ok: 'false',
        error,
        attempt: ATTEMPT,
      });
      expect(setCookie(response, REFRESH_COOKIE)).toBe('');
      expect(flow.events.at(-1)).toBe(`auth.callback.${error}`);
    }
  );

  it('sets no refresh cookie when Drive was left unchecked on the consent screen', async () => {
    const { signIn, events } = setup();

    const { callback } = await signIn({
      scope: 'openid https://www.googleapis.com/auth/userinfo.email',
    });

    expect(marker(await callback.text())).toEqual({
      ok: 'false',
      error: 'scope_missing',
      attempt: ATTEMPT,
    });
    expect(setCookie(callback, REFRESH_COOKIE)).toBe('');
    expect(events.at(-1)).toBe('auth.callback.scope_missing');
  });

  it('reports upstream when Google fails twice, and retries once before that', async () => {
    const flow = await beginFlow();
    flow.google.queue(
      jsonReply({ error: 'backend_error' }, 503),
      'network-error'
    );

    const response = await flow.call(
      `/api/auth/callback?state=${flow.state}&code=${flow.code}`,
      { cookie: flow.cookie }
    );

    expect(marker(await response.text()).error).toBe('upstream');
    expect(flow.google.requests).toHaveLength(2);
    expect(flow.events.slice(-2)).toEqual([
      'auth.upstream.retry',
      'auth.callback.upstream',
    ]);
  });

  it('signs in when the first exchange hits a 5xx and the retry succeeds', async () => {
    const flow = await beginFlow();
    flow.google.queue(jsonReply({ error: 'backend_error' }, 500));

    const response = await flow.call(
      `/api/auth/callback?state=${flow.state}&code=${flow.code}`,
      { cookie: flow.cookie }
    );

    expect(marker(await response.text()).ok).toBe('true');
    expect(setCookie(response, REFRESH_COOKIE)).not.toBe('');
  });

  it.each<[string, Response]>([
    [
      'no refresh token',
      jsonReply({ access_token: 'a', expires_in: 1, scope: DRIVE_FILE }),
    ],
    ['a token response without expiry', jsonReply({ access_token: 'a' })],
    ['a success that is not JSON', new Response('<html></html>')],
  ])('reports upstream for %s', async (_, reply) => {
    const flow = await beginFlow();
    flow.google.queue(reply);

    const response = await flow.call(
      `/api/auth/callback?state=${flow.state}&code=${flow.code}`,
      { cookie: flow.cookie }
    );

    expect(marker(await response.text()).error).toBe('upstream');
    expect(setCookie(response, REFRESH_COOKIE)).toBe('');
  });

  it.each([
    ['closes a script', '</script><script>alert(1)</script>'],
    [
      'opens a refresh meta',
      '"><meta http-equiv=refresh content="0;url=https://evil.example">',
    ],
    ['breaks a string', "';alert(1)//"],
  ])('renders nothing of an error that %s', async (_, payload) => {
    const flow = await beginFlow();
    const query = `error=${encodeURIComponent(payload)}&error_description=${encodeURIComponent('<img src=x onerror=alert(1)>')}`;

    for (const response of [
      await flow.call(`/api/auth/callback?${query}`),
      await flow.call(`/api/auth/callback?state=${flow.state}&${query}`, {
        cookie: flow.cookie,
      }),
    ]) {
      const body = await response.text();
      expect(body).not.toContain(payload);
      expect(body).not.toContain('onerror');
      expect(count(body, '<script')).toBe(1);
      expect(count(body, 'http-equiv')).toBe(0);
      expect(CALLBACK_ERRORS).toContain(marker(body).error);
    }
  });

  it('logs event names only, never the code or the URL', async () => {
    const { signIn, events } = setup();

    const { code } = await signIn();

    for (const event of events) {
      expect(event).toMatch(/^auth\.[a-z_.]+$/);
      expect(event).not.toContain(code);
    }
  });
});

describe('renderCallbackPage', () => {
  it('escapes every attribute, though only enums and checked ids reach it', () => {
    const body = renderCallbackPage(
      { ok: false, error: 'unknown', attempt: `"><script>&'` },
      'nonce'
    );

    expect(body).toContain('data-attempt="&quot;&gt;&lt;script&gt;&amp;&#39;"');
    expect(count(body, '<script')).toBe(1);
  });

  it('keeps Google error values other than access_denied out', () => {
    expect(toCallbackError('access_denied')).toBe('access_denied');
    expect(toCallbackError('invalid_scope')).toBe('unknown');
  });
});

describe('the callback script', () => {
  function run(body: string) {
    const window = new Window();
    const document = new window.DOMParser().parseFromString(body, 'text/html');
    const messages: { channel: string; message: unknown }[] = [];
    const close = vi.fn();
    class Channel {
      constructor(private channel: string) {}
      postMessage(message: unknown) {
        messages.push({ channel: this.channel, message });
      }
    }
    const script = document.querySelector('script')?.textContent ?? '';
    new Function('document', 'window', 'BroadcastChannel', script)(
      document,
      { close },
      Channel
    );
    return { messages, close };
  }

  it('posts oauth-done to its attempt on the auth channel and closes the popup', async () => {
    const { signIn } = setup();
    const { callback } = await signIn();

    const { messages, close } = run(await callback.text());

    expect(messages).toEqual([
      {
        channel: AUTH_CHANNEL,
        message: {
          type: 'oauth-done',
          attempt: ATTEMPT,
          ok: true,
          error: null,
        },
      },
    ]);
    expect(close).toHaveBeenCalledOnce();
  });

  it('carries a failure with its error', async () => {
    const flow = await beginFlow();
    const response = await flow.call(
      `/api/auth/callback?state=${flow.state}&error=access_denied`,
      { cookie: flow.cookie }
    );

    const { messages } = run(await response.text());

    expect(messages.map(({ message }) => message)).toEqual([
      {
        type: 'oauth-done',
        attempt: ATTEMPT,
        ok: false,
        error: 'access_denied',
      },
    ]);
  });

  it('posts nothing without an attempt but still closes', async () => {
    const { call } = setup();
    const response = await call('/api/auth/callback?error=access_denied');

    const { messages, close } = run(await response.text());

    expect(messages).toEqual([]);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('token', () => {
  it('trades the cookie for an access token and renews it for 180 days', async () => {
    const { post, signedIn, google } = setup();
    const cookie = await signedIn();

    const response = await post('/api/auth/token', cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      access_token: expect.stringMatching(/^access-token-/),
      expires_in: 3599,
      scope: google.refreshScope,
    });
    expect(google.requests.at(-1)?.params.get('grant_type')).toBe(
      'refresh_token'
    );
    expect(google.requests.at(-1)?.params.get('refresh_token')).toBe(
      [...google.liveTokens][0]
    );
    const renewed = setCookie(response, REFRESH_COOKIE);
    expect(renewed).toContain('Max-Age=15552000');
    expect(renewed.split(';')[0]).not.toBe(cookie);

    const again = await post('/api/auth/token', renewed.split(';')[0]);
    expect(again.status).toBe(200);
  });

  it('swaps in the new refresh token when Google rotates it', async () => {
    const { post, signedIn, google } = setup();
    const cookie = await signedIn();
    google.rotate = true;

    const rotated = await post('/api/auth/token', cookie);
    const next = cookiePair(rotated, REFRESH_COOKIE);

    expect((await post('/api/auth/token', cookie)).status).toBe(401);
    expect((await post('/api/auth/token', next)).status).toBe(200);
  });

  it('passes on a scope without Drive for the client to act on', async () => {
    const { post, signedIn, google } = setup();
    const cookie = await signedIn();
    google.refreshScope = 'openid';

    const response = await post('/api/auth/token', cookie);

    expect(await response.json()).toMatchObject({ scope: 'openid' });
  });

  it('clears the cookie with JSON 401 on invalid_grant', async () => {
    const { post, signedIn, google, events } = setup();
    const cookie = await signedIn();
    google.liveTokens.clear();

    const response = await post('/api/auth/token', cookie);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_grant' });
    expect(setCookie(response, REFRESH_COOKIE)).toContain('Max-Age=0');
    expect(events.at(-1)).toBe('auth.token.invalid_grant');
  });

  it.each([
    ['not sealed', `${REFRESH_COOKIE}=plain-refresh-token`],
    ['sealed by another key', 'other-key'],
  ])(
    'clears a cookie %s with JSON 401 and asks Google nothing',
    async (_, cookie) => {
      const other = setup({ ...AUTH_ENV, COOKIE_KEY: btoa('k'.repeat(32)) });
      const value = cookie === 'other-key' ? await other.signedIn() : cookie;
      const { post, google, events } = setup();

      const response = await post('/api/auth/token', value);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'invalid_cookie' });
      expect(setCookie(response, REFRESH_COOKIE)).toContain('Max-Age=0');
      expect(google.requests).toEqual([]);
      expect(events).toEqual(['auth.token.unreadable_cookie']);
    }
  );

  it.each<[string, AuthEnv]>([
    ['configured', AUTH_ENV],
    ['not configured', {}],
  ])('answers JSON 401 without a cookie when %s', async (_, env) => {
    const { post } = setup(env);

    const response = await post('/api/auth/token');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'signed_out' });
    expect(response.headers.get('Content-Type')).toBe(
      'application/json; charset=utf-8'
    );
  });

  it.each<[string, AuthEnv]>([
    ['no secret', { ...AUTH_ENV, GOOGLE_CLIENT_SECRET: ' ' }],
    ['no client id', { ...AUTH_ENV, VITE_GOOGLE_CLIENT_ID: '' }],
    ['a short key', { ...AUTH_ENV, COOKIE_KEY: btoa('short') }],
  ])('answers 503 JSON to a cookie when it has %s', async (_, env) => {
    const cookie = await setup().signedIn();
    const { post, events } = setup(env);

    const response = await post('/api/auth/token', cookie);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'not_configured' });
    expect(events).toEqual(['auth.not_configured']);
  });

  it('answers 502 JSON after one retry and keeps the cookie', async () => {
    const { post, signedIn, google, events } = setup();
    const cookie = await signedIn();
    google.queue('network-error', jsonReply({}, 502));

    const response = await post('/api/auth/token', cookie);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'upstream' });
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(events.at(-1)).toBe('auth.upstream.retry');
  });

  it('answers 502 JSON to a 4xx other than invalid_grant', async () => {
    const { post, signedIn, google } = setup();
    const cookie = await signedIn();
    google.queue(jsonReply({ error: 'invalid_client' }, 401));

    const response = await post('/api/auth/token', cookie);

    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe('logout', () => {
  it('revokes the refresh token and clears the cookie', async () => {
    const { post, signedIn, google, events } = setup();
    const cookie = await signedIn();
    const [refreshToken] = google.liveTokens;

    const response = await post('/api/auth/logout', cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, revoked: true });
    expect(google.requests.at(-1)).toEqual({
      url: google.revokeUrl,
      params: new URLSearchParams({ token: refreshToken }),
    });
    expect(google.liveTokens.size).toBe(0);
    expect(setCookie(response, REFRESH_COOKIE)).toContain('Max-Age=0');
    expect(events.at(-1)).toBe('auth.logout');
  });

  it('counts a token Google already dropped as revoked', async () => {
    const { post, signedIn, google } = setup();
    const cookie = await signedIn();
    google.liveTokens.clear();

    const response = await post('/api/auth/logout', cookie);

    expect(await response.json()).toEqual({ ok: true, revoked: true });
  });

  it('still clears the cookie when Google cannot be reached', async () => {
    const { post, signedIn, google } = setup();
    const cookie = await signedIn();
    google.queue('network-error', 'network-error');

    const response = await post('/api/auth/logout', cookie);

    expect(await response.json()).toEqual({ ok: true, revoked: false });
    expect(setCookie(response, REFRESH_COOKIE)).toContain('Max-Age=0');
  });

  it('reports a refusal other than invalid_token as not revoked', async () => {
    const { post, signedIn, google } = setup();
    const cookie = await signedIn();
    google.queue(new Response('Bad Request', { status: 400 }));

    const response = await post('/api/auth/logout', cookie);

    expect(await response.json()).toEqual({ ok: true, revoked: false });
  });

  it.each<[string, AuthEnv, string | undefined]>([
    ['without a cookie', AUTH_ENV, undefined],
    ['with an unreadable cookie', AUTH_ENV, `${REFRESH_COOKIE}=v1.AAAA`],
    ['when not configured', {}, 'signed-in'],
  ])('clears the cookie %s without calling Google', async (_, env, cookie) => {
    const value = cookie === 'signed-in' ? await setup().signedIn() : cookie;
    const { post, google } = setup(env);

    const response = await post('/api/auth/logout', value);

    expect(await response.json()).toEqual({ ok: true, revoked: false });
    expect(setCookie(response, REFRESH_COOKIE)).toContain('Max-Age=0');
    expect(google.requests).toEqual([]);
  });
});

describe('routing and the POST guard', () => {
  it.each(['/api/auth/token', '/api/auth/logout'])(
    'refuses %s with 403 JSON unless Origin and X-Requested-With match',
    async path => {
      const { post, signedIn, google } = setup();
      const cookie = await signedIn();
      const calls = google.requests.length;

      for (const headers of [
        {},
        { 'X-Requested-With': 'XMLHttpRequest' },
        { Origin: 'null', 'X-Requested-With': 'XMLHttpRequest' },
        {
          Origin: 'https://evil.example',
          'X-Requested-With': 'XMLHttpRequest',
        },
        {
          Origin: 'http://erd-editor.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        { Origin: `${ORIGIN}:8443`, 'X-Requested-With': 'XMLHttpRequest' },
        { Origin: ORIGIN },
        { Origin: ORIGIN, 'X-Requested-With': 'fetch' },
      ] as Record<string, string>[]) {
        const response = await post(path, cookie, headers);

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: 'forbidden' });
        expect(response.headers.getSetCookie()).toEqual([]);
        expectNoCors(response);
      }
      expect(google.requests).toHaveLength(calls);
    }
  );

  it.each([
    ['GET', '/api/auth/token', 'POST'],
    ['OPTIONS', '/api/auth/logout', 'POST'],
    ['POST', '/api/auth/start', 'GET'],
    ['POST', '/api/auth/callback', 'GET'],
  ])('answers %s %s with 405 JSON allowing %s', async (method, path, allow) => {
    const { call } = setup();

    const response = await call(path, { method, headers: XHR });

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe(allow);
    expect(await response.json()).toEqual({ error: 'method_not_allowed' });
    expectNoCors(response);
  });

  it.each([
    '/api/auth',
    '/api/auth/',
    '/api/auth/exchange',
    '/api/auth/token/',
  ])('answers %s with 404 JSON', async path => {
    const { call } = setup();

    const response = await call(path);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(['/api/auth/start', '/api/auth/callback'])(
    'answers %s with 503 JSON when not configured',
    async path => {
      const { call, events } = setup({});

      const response = await call(path);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'not_configured' });
      expect(events).toEqual(['auth.not_configured']);
    }
  );

  it('turns a thrown error into 500 JSON and logs no detail', async () => {
    const events: AuthEvent[] = [];

    const response = await handleAuthRequest(
      new Request(`${ORIGIN}/api/auth/start`),
      AUTH_ENV,
      {
        fetch: createFakeGoogle().fetch,
        now: () => {
          throw new Error('clock failed with a secret');
        },
        log: event => events.push(event),
      }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'internal' });
    expect(events).toEqual(['auth.error']);
  });
});

describe('onRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls Google through the global fetch without a receiver', async () => {
    const google = createFakeGoogle();
    vi.stubGlobal('fetch', google.fetch);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const request = (path: string, init: RequestInit = {}) =>
      onRequest({
        request: new Request(`${ORIGIN}${path}`, init),
        env: AUTH_ENV,
      });

    const start = await request(`/api/auth/start?attempt=${ATTEMPT}`);
    const location = new URL(start.headers.get('Location') ?? '').searchParams;
    const code = google.issueCode(location.get('code_challenge') ?? '');
    const callback = await request(
      `/api/auth/callback?state=${location.get('state')}&code=${code}`,
      { headers: { Cookie: cookiePair(start, STATE_COOKIE) } }
    );
    const token = await request('/api/auth/token', {
      method: 'POST',
      headers: { ...XHR, Cookie: cookiePair(callback, REFRESH_COOKIE) },
    });

    expect(token.status).toBe(200);
    expect(google.requests.map(({ url }) => url)).toEqual([
      'https://oauth2.googleapis.com/token',
      'https://oauth2.googleapis.com/token',
    ]);
    expect(log.mock.calls).toEqual([['auth.start'], ['auth.callback.ok']]);
  });

  it('is checked by a fake that refuses a call through another object', () => {
    const google = createFakeGoogle();
    const deps = { fetch: google.fetch };

    expect(() => deps.fetch('https://oauth2.fake.test/token')).toThrow(
      'Illegal invocation'
    );
  });
});

type Flow = Awaited<ReturnType<typeof beginFlow>>;

/** A started sign-in whose callback the case sends itself. */
async function beginFlow() {
  const context = setup();
  const start = await context.call(`/api/auth/start?attempt=${ATTEMPT}`);
  const location = new URL(start.headers.get('Location') ?? '').searchParams;
  return {
    ...context,
    cookie: cookiePair(start, STATE_COOKIE),
    state: location.get('state') ?? '',
    code: context.google.issueCode(location.get('code_challenge') ?? ''),
  };
}
