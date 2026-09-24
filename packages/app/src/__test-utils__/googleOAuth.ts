export const CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const CLIENT_SECRET = 'test-client-secret';

/** 32 bytes of 0x07, the COOKIE_KEY every relay test seals with. */
export const COOKIE_KEY = btoa(String.fromCharCode(...new Array(32).fill(7)));

export const AUTH_ENV = {
  VITE_GOOGLE_CLIENT_ID: CLIENT_ID,
  GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
  COOKIE_KEY,
};

export const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file';
export const GRANTED_SCOPE = [
  DRIVE_FILE,
  'https://www.googleapis.com/auth/drive.install',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

type Reply = Response | 'network-error';

export type GoogleRequest = { url: string; params: URLSearchParams };

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Google takes a form POST only; a string body sent without the header goes as text/plain. */
function isFormPost(init: RequestInit | undefined): boolean {
  const type = new Headers(init?.headers).get('Content-Type') ?? '';
  return (
    init?.method === 'POST' &&
    type.split(';')[0].trim() === 'application/x-www-form-urlencoded'
  );
}

/**
 * Google's token and revoke endpoints by path on any host: form POSTs only,
 * codes bound to their PKCE challenge, live refresh tokens. Its fetch throws on
 * a receiver other than undefined or globalThis, as workerd and Chrome do.
 */
export function createFakeGoogle() {
  const requests: GoogleRequest[] = [];
  const replies: Reply[] = [];
  const codes = new Map<string, { challenge: string; scope: string }>();
  const liveTokens = new Set<string>();
  let issued = 0;

  const google = {
    tokenUrl: 'https://oauth2.fake.test/token',
    revokeUrl: 'https://oauth2.fake.test/revoke',
    requests,
    liveTokens,
    /** Refreshes hand out a new refresh token and retire the old one. */
    rotate: false,
    /** What a refresh reports as granted. */
    refreshScope: GRANTED_SCOPE,
    /** Codes exchange without a refresh token, as for a returning grant without consent. */
    omitRefreshToken: false,

    /** A code Google would send back for this challenge. */
    issueCode(challenge: string, scope = GRANTED_SCOPE): string {
      const code = `code-${codes.size + 1}-${challenge.slice(0, 6)}`;
      codes.set(code, { challenge, scope });
      return code;
    },

    /** Answers the next calls, in order, with these before the default behaviour. */
    queue(...next: Reply[]) {
      replies.push(...next);
    },

    fetch(this: unknown, input: string, init?: RequestInit): Promise<Response> {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      const params = new URLSearchParams(String(init?.body ?? ''));
      requests.push({ url: input, params });
      if (!isFormPost(init)) {
        return Promise.resolve(reply({ error: 'invalid_request' }, 400));
      }
      const queued = replies.shift();
      if (queued === 'network-error') {
        return Promise.reject(new TypeError('fetch failed'));
      }
      if (queued) return Promise.resolve(queued);
      return new URL(input).pathname.endsWith('/revoke')
        ? Promise.resolve(revoke(params))
        : answerToken(params);
    },
  };

  function issueRefreshToken(): string {
    const token = `refresh-token-${++issued}`;
    liveTokens.add(token);
    return token;
  }

  function revoke(params: URLSearchParams): Response {
    const token = params.get('token') ?? '';
    if (!liveTokens.delete(token))
      return reply({ error: 'invalid_token' }, 400);
    return reply({});
  }

  async function answerToken(params: URLSearchParams): Promise<Response> {
    if (
      params.get('client_id') !== CLIENT_ID ||
      params.get('client_secret') !== CLIENT_SECRET
    ) {
      return reply({ error: 'invalid_client' }, 401);
    }

    if (params.get('grant_type') === 'authorization_code') {
      const entry = codes.get(params.get('code') ?? '');
      codes.delete(params.get('code') ?? '');
      const verifier = params.get('code_verifier') ?? '';
      if (!entry || (await s256(verifier)) !== entry.challenge) {
        return reply({ error: 'invalid_grant' }, 400);
      }
      return reply({
        access_token: `access-token-${++issued}`,
        expires_in: 3599,
        scope: entry.scope,
        token_type: 'Bearer',
        id_token: 'header.payload.signature',
        ...(google.omitRefreshToken
          ? {}
          : { refresh_token: issueRefreshToken() }),
      });
    }

    const refreshToken = params.get('refresh_token') ?? '';
    if (!liveTokens.has(refreshToken)) {
      return reply({ error: 'invalid_grant' }, 400);
    }
    if (google.rotate) liveTokens.delete(refreshToken);
    return reply({
      access_token: `access-token-${++issued}`,
      expires_in: 3599,
      scope: google.refreshScope,
      token_type: 'Bearer',
      ...(google.rotate ? { refresh_token: issueRefreshToken() } : {}),
    });
  }

  return google;
}

export type FakeGoogle = ReturnType<typeof createFakeGoogle>;

/** The name=value pair of a Set-Cookie line, ready for a Cookie header. */
export function cookiePair(response: Response, name: string): string {
  const line = response.headers
    .getSetCookie()
    .find(cookie => cookie.startsWith(`${name}=`));
  if (!line) throw new Error(`no Set-Cookie for ${name}`);
  return line.split(';')[0];
}

export function jsonReply(body: unknown, status = 200): Response {
  return reply(body, status);
}
