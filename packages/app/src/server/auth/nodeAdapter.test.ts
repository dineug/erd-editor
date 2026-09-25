// @vitest-environment node
/// <reference types="node" />

import {
  createServer,
  type IncomingMessage,
  request as httpRequest,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  AUTH_ENV,
  createFakeGoogle,
  type FakeGoogle,
} from '@/__test-utils__/googleOAuth';
import type { AuthEnv } from '@/server/auth';
import { REFRESH_COOKIE, STATE_COOKIE } from '@/server/auth/cookie';
import {
  type AuthDevMiddlewareOptions,
  createAuthDevMiddleware,
} from '@/server/auth/nodeAdapter';

const ATTEMPT = 'AbCdEfGhIjKlMnOpQrStUv';
const OAUTH_BASE_URL = 'http://127.0.0.1:1/fake-google';

type Middleware = ReturnType<typeof createAuthDevMiddleware>;
type Reply = {
  status: number;
  headers: IncomingMessage['headers'];
  body: string;
};

const servers: Server[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    servers
      .splice(0)
      .map(server => new Promise(resolve => server.close(resolve)))
  );
});

/**
 * A node:http server running the middleware the way Vite does: after a cors
 * middleware has set its headers, with no mount path, or under /api/auth,
 * where connect cuts the prefix from req.url and keeps it in originalUrl.
 */
async function listen(
  middleware: Middleware,
  { mount }: { mount?: string } = {}
) {
  const errors: unknown[] = [];
  const server = createServer(
    (req: IncomingMessage & { originalUrl?: string }, res: ServerResponse) => {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
      res.setHeader('Vary', 'Origin');
      if (mount) {
        if (!req.url?.startsWith(mount)) return fallback(res);
        req.originalUrl = req.url;
        req.url = req.url.slice(mount.length) || '/';
      }
      middleware(req, res, error => {
        if (error) errors.push(error);
        fallback(res);
      });
    }
  );
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  function send(
    path: string,
    {
      method = 'GET',
      headers = {},
    }: { method?: string; headers?: Record<string, string> } = {}
  ): Promise<Reply> {
    return new Promise((resolve, reject) => {
      const req = httpRequest(`${origin}${path}`, { method, headers }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => (body += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body })
        );
      });
      req.on('error', reject);
      req.end();
    });
  }

  const xhr = { Origin: origin, 'X-Requested-With': 'XMLHttpRequest' };
  return { origin, send, xhr, errors };
}

function fallback(res: ServerResponse) {
  res.statusCode = 299;
  res.end('fell through');
}

function middleware(
  google: FakeGoogle,
  options: Partial<AuthDevMiddlewareOptions> = {}
): Middleware {
  vi.stubGlobal('fetch', google.fetch);
  return createAuthDevMiddleware({
    getEnv: () => AUTH_ENV,
    oauthBaseUrl: OAUTH_BASE_URL,
    ...options,
  });
}

function pair(headers: IncomingMessage['headers'], name: string): string {
  const line = headers['set-cookie']?.find(cookie =>
    cookie.startsWith(`${name}=`)
  );
  return line?.split(';')[0] ?? '';
}

describe('createAuthDevMiddleware', () => {
  it('signs in through start and callback, forwarding 302 and every Set-Cookie', async () => {
    const google = createFakeGoogle();
    const { send, xhr } = await listen(middleware(google));

    const start = await send(`/api/auth/start?attempt=${ATTEMPT}`);
    expect(start.status).toBe(302);
    expect(start.headers['cache-control']).toBe('no-store');
    expect(start.headers['access-control-allow-origin']).toBeUndefined();
    expect(start.headers.vary).toBeUndefined();
    const location = new URL(start.headers.location ?? '').searchParams;
    const code = google.issueCode(location);

    const callback = await send(
      `/api/auth/callback?state=${location.get('state')}&code=${code}`,
      { headers: { Cookie: pair(start.headers, STATE_COOKIE) } }
    );
    expect(callback.status).toBe(200);
    expect(callback.headers['set-cookie']).toHaveLength(2);
    expect(callback.body).toContain('data-ok="true"');

    const token = await send('/api/auth/token', {
      method: 'POST',
      headers: { ...xhr, Cookie: pair(callback.headers, REFRESH_COOKIE) },
    });
    expect(token.status).toBe(200);
    expect(JSON.parse(token.body)).toMatchObject({ expires_in: 3599 });
    expect(google.requests.map(({ url }) => url)).toEqual([
      `${OAUTH_BASE_URL}/token`,
      `${OAUTH_BASE_URL}/token`,
    ]);
  });

  it('builds the redirect_uri from the Host the browser used', async () => {
    const { send, origin } = await listen(middleware(createFakeGoogle()));

    const start = await send('/api/auth/start');

    const location = new URL(start.headers.location ?? '').searchParams;
    expect(location.get('redirect_uri')).toBe(`${origin}/api/auth/callback`);
  });

  it('passes the guard headers through, so a bare POST is refused', async () => {
    const { send, xhr } = await listen(middleware(createFakeGoogle()));

    const guarded = await send('/api/auth/token', {
      method: 'POST',
      headers: xhr,
    });
    const bare = await send('/api/auth/token', { method: 'POST' });

    expect(guarded.status).toBe(401);
    expect(guarded.headers['access-control-allow-origin']).toBeUndefined();
    expect(JSON.parse(guarded.body)).toEqual({ error: 'signed_out' });
    expect(guarded.headers['content-type']).toBe(
      'application/json; charset=utf-8'
    );
    expect(bare.status).toBe(403);
  });

  it('still answers when mounted under /api/auth, reading originalUrl', async () => {
    const { send, xhr } = await listen(middleware(createFakeGoogle()), {
      mount: '/api/auth',
    });

    const token = await send('/api/auth/token', {
      method: 'POST',
      headers: xhr,
    });
    const root = await send('/api/auth');

    expect(token.status).toBe(401);
    expect(root.status).toBe(404);
  });

  it.each([
    '/',
    '/gdrive?state=%7B%7D',
    '/api/other',
    '/api/authx/token',
    '/src/api/auth/x',
  ])('leaves %s to the next middleware', async path => {
    const { send } = await listen(middleware(createFakeGoogle()));

    const response = await send(path);

    expect(response.status).toBe(299);
    expect(response.body).toBe('fell through');
    expect(response.headers.vary).toBe('Origin');
  });

  it("talks to Google's own endpoints without oauthBaseUrl", async () => {
    const google = createFakeGoogle();
    const { send, xhr } = await listen(
      middleware(google, { oauthBaseUrl: undefined })
    );
    const start = await send(`/api/auth/start?attempt=${ATTEMPT}`);
    const location = new URL(start.headers.location ?? '').searchParams;
    const code = google.issueCode(location);

    const callback = await send(
      `/api/auth/callback?state=${location.get('state')}&code=${code}`,
      { headers: { Cookie: pair(start.headers, STATE_COOKIE) } }
    );
    await send('/api/auth/logout', {
      method: 'POST',
      headers: { ...xhr, Cookie: pair(callback.headers, REFRESH_COOKIE) },
    });

    expect(google.requests.map(({ url }) => url)).toEqual([
      'https://oauth2.googleapis.com/token',
      'https://oauth2.googleapis.com/revoke',
    ]);
  });

  it('reads the env on every request', async () => {
    let env: AuthEnv = {};
    const { send } = await listen(
      middleware(createFakeGoogle(), { getEnv: () => env })
    );

    const before = await send('/api/auth/start');
    env = AUTH_ENV;
    const after = await send('/api/auth/start');

    expect(before.status).toBe(503);
    expect(after.status).toBe(302);
  });

  it('hands a thrown error to next', async () => {
    const { send, errors } = await listen(
      middleware(createFakeGoogle(), {
        getEnv: () => {
          throw new Error('env unreadable');
        },
      })
    );

    const response = await send('/api/auth/start');

    expect(response.status).toBe(299);
    expect(errors).toEqual([new Error('env unreadable')]);
  });
});
