import type { BrowserContext, Route } from '@playwright/test';

/**
 * How /api/auth/* fails its JSON contract: the app's HTML with a 200 (a
 * missing _routes.json), a 429, Cloudflare's 1027 page once a sign-in starts,
 * or the SPA itself where start should redirect (a fail-open deployment).
 */
export type FakeAuthMode =
  | 'html200'
  | 'tooMany429'
  | 'limitPage'
  | 'spaFallback';

const LIMIT_PAGE =
  '<!doctype html><title>Worker exceeded resource limits</title><h1>Error 1027</h1>';

/** The relay in a state the fallback has to take over from, for the fallback spec alone. */
export async function installFakeAuth(
  context: BrowserContext,
  mode: FakeAuthMode
) {
  const paths: string[] = [];
  let tokenCalls = 0;

  const html = (route: Route, body: string, status = 200) =>
    route.fulfill({ status, contentType: 'text/html', body });

  await context.route('**/api/auth/**', async route => {
    const url = new URL(route.request().url());
    paths.push(url.pathname);
    if (mode === 'html200') {
      return html(route, '<!doctype html><title>erd-editor</title>');
    }
    if (mode === 'tooMany429') return html(route, 'Too Many Requests', 429);
    // The page's first check finds no cookie; the sign-in is what hits the limit.
    if (url.pathname === '/api/auth/token' && tokenCalls++ === 0) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'signed_out' }),
      });
    }
    if (mode === 'limitPage') return html(route, LIMIT_PAGE);
    const app = await route.fetch({
      url: new URL('/', url).toString(),
      method: 'GET',
    });
    return route.fulfill({ response: app });
  });

  return {
    /** Every /api/auth/* path asked for, in order. */
    paths,
    count: (path?: string) =>
      path ? paths.filter(entry => entry === path).length : paths.length,
  };
}
