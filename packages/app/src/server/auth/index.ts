import { type AuthEnv, parseAuthEnv } from './config';
import { importCookieKey } from './cookieCrypto';
import { GOOGLE_REVOKE_URL, GOOGLE_TOKEN_URL } from './google';
import {
  type AuthHandler,
  handleCallback,
  handleLogout,
  handleStart,
  handleToken,
} from './handlers';
import { guardRequest, json } from './http';
import { type AuthDeps, type ResolvedAuthDeps } from './types';

export type { AuthEnv } from './config';
export type { AuthDeps, AuthEvent, FetchLike } from './types';

type Route = { method: 'GET' | 'POST'; handle: AuthHandler };

const ROUTES = new Map<string, Route>([
  ['/api/auth/start', { method: 'GET', handle: handleStart }],
  ['/api/auth/callback', { method: 'GET', handle: handleCallback }],
  ['/api/auth/token', { method: 'POST', handle: handleToken }],
  ['/api/auth/logout', { method: 'POST', handle: handleLogout }],
]);

function resolveDeps(deps: AuthDeps): ResolvedAuthDeps {
  return {
    fetch: deps.fetch,
    tokenUrl: deps.tokenUrl ?? GOOGLE_TOKEN_URL,
    revokeUrl: deps.revokeUrl ?? GOOGLE_REVOKE_URL,
    now: deps.now ?? (() => Date.now()),
    log: deps.log ?? (event => console.log(event)),
  };
}

/**
 * The relay behind /api/auth/*, on web standard APIs only, shared by the Pages
 * Function and the dev server. Every answer is JSON, the callback page or start's
 * redirect, never the app's HTML: how the client tells a relay from a fallback.
 */
export async function handleAuthRequest(
  request: Request,
  env: AuthEnv,
  deps: AuthDeps
): Promise<Response> {
  const route = ROUTES.get(new URL(request.url).pathname);
  if (!route) return json({ error: 'not_found' }, { status: 404 });
  if (request.method !== route.method) {
    return json(
      { error: 'method_not_allowed' },
      { status: 405, headers: { Allow: route.method } }
    );
  }
  const denied = route.method === 'POST' ? guardRequest(request) : null;
  if (denied) return denied;

  const resolved = resolveDeps(deps);
  try {
    const config = parseAuthEnv(env);
    const secrets = config && {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      key: await importCookieKey(config.cookieKey),
    };
    return await route.handle(request, secrets, resolved);
  } catch {
    resolved.log('auth.error');
    return json({ error: 'internal' }, { status: 500 });
  }
}
