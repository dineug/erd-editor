/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';

import { type AuthEnv, handleAuthRequest } from './index';

export type AuthDevMiddlewareOptions = {
  getEnv: () => AuthEnv;
  /** Replaces Google's token and revoke endpoints with oauthBaseUrl/token and /revoke. */
  oauthBaseUrl?: string;
};

type DevRequest = IncomingMessage & { originalUrl?: string };

function isAuthPath(path: string): boolean {
  const pathname = path.split('?')[0];
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

function toRequest(req: DevRequest, path: string): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const item of [value ?? []].flat()) headers.append(name, item);
  }
  return new Request(new URL(path, `http://${req.headers.host}`), {
    method: req.method,
    headers,
  });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  // Vite's cors middleware runs ahead of every plugin's and has set its headers
  // by now. The answer carries the handler's alone, as it does on Pages.
  for (const name of res.getHeaderNames()) res.removeHeader(name);
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') res.setHeader(name, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader('Set-Cookie', cookies);
  res.end(new Uint8Array(await response.arrayBuffer()));
}

/**
 * The relay under vp dev, as connect middleware added without a mount path so
 * it runs ahead of Vite's own and the SPA fallback. It reads originalUrl first,
 * which keeps working if something mounts it under a prefix after all.
 */
export function createAuthDevMiddleware({
  getEnv,
  oauthBaseUrl,
}: AuthDevMiddlewareOptions) {
  const endpoints = oauthBaseUrl
    ? { tokenUrl: `${oauthBaseUrl}/token`, revokeUrl: `${oauthBaseUrl}/revoke` }
    : {};

  return (
    req: DevRequest,
    res: ServerResponse,
    next: (error?: unknown) => void
  ): void => {
    const path = req.originalUrl ?? req.url ?? '/';
    if (!isAuthPath(path)) {
      next();
      return;
    }
    // No handler reads a body, so the stream is drained rather than forwarded.
    req.resume();
    const respond = async () =>
      send(
        res,
        await handleAuthRequest(toRequest(req, path), getEnv(), {
          ...endpoints,
          fetch: (input, init) => fetch(input, init),
        })
      );
    respond().catch(next);
  };
}
