import { expect, type Page, test } from '@playwright/test';

import {
  ACCOUNT,
  type FakeGoogle,
  installFakeGoogle,
  oauthServerState,
  OTHER_ACCOUNT,
  resetOAuthServer,
  setTokenLifetime,
} from '../../support/gdrive/fakeGoogle';
import { GdrivePage } from '../../support/gdrive/GdrivePage';
import { GDRIVE_BASE_URL } from '../../support/gdrive/server';

const REFRESH_COOKIE = '__Host-erd_gdrive_rt';
const DOCUMENT = JSON.stringify({
  version: '3.0.0',
  doc: { tableIds: [], relationshipIds: [], indexIds: [], memoIds: [] },
});

let google: FakeGoogle;

test.beforeEach(async ({ context }) => {
  await resetOAuthServer();
  google = await installFakeGoogle(context);
  google.add({ id: 'file-1', name: 'shop.erd.json', content: DOCUMENT });
  google.add({ id: 'file-2', name: 'blog.erd', content: DOCUMENT });
});

test.describe('signing in through the relay', () => {
  test('opens the popup, sets the refresh cookie and lists the files', async ({
    context,
  }) => {
    const app = await GdrivePage.open(context);
    await app.signIn();

    await expect(app.fileItem('shop.erd.json')).toBeVisible();
    await expect(app.fileItem('blog.erd')).toBeVisible();
    await expect(app.sidebar().getByText(ACCOUNT.email)).toBeVisible();

    const cookie = (await context.cookies()).find(
      entry => entry.name === REFRESH_COOKIE
    );
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
    });
    const days = (cookie!.expires * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(179);
    expect(days).toBeLessThanOrEqual(180);
    expect((await oauthServerState()).exchanges).toBe(1);
  });

  test('renews five seconds after a short token, once between two tabs', async ({
    context,
  }) => {
    const first = await GdrivePage.open(context);
    await first.signIn();
    await setTokenLifetime(305);
    const before = (await oauthServerState()).refreshes;

    const tokenRequests: Array<{ at: number; page: Page | null }> = [];
    context.on('request', request => {
      if (new URL(request.url()).pathname !== '/api/auth/token') return;
      let page: Page | null = null;
      try {
        page = request.frame().page();
      } catch {
        // A service worker's request has no frame.
      }
      tokenRequests.push({ at: Date.now(), page });
    });
    await first.page.reload();
    await expect(first.sidebar()).toBeVisible();
    await first.page.waitForTimeout(2000);
    const second = await GdrivePage.open(context);
    await expect(second.sidebar()).toBeVisible();

    // The first tab's visit, then one renewal five seconds after it; the
    // second tab took the visit's token over the channel, asking nothing.
    await expect.poll(() => tokenRequests.length, { timeout: 20_000 }).toBe(2);
    const [visit, renewal] = tokenRequests;
    expect(visit.page).toBe(first.page);
    expect(renewal.at - visit.at).toBeGreaterThan(4500);
    await second.page.waitForTimeout(1500);
    expect(tokenRequests).toHaveLength(2);
    expect((await oauthServerState()).refreshes).toBe(before + 2);
  });

  test('signs out: revokes the grant, clears the cookie, shows Sign in', async ({
    context,
  }) => {
    const app = await GdrivePage.open(context);
    await app.signIn();

    await app.signOut();

    // Sign in shows first; the relay's logout finishes after it.
    await expect.poll(async () => (await oauthServerState()).revokes).toBe(1);
    await expect
      .poll(async () =>
        (await context.cookies()).some(entry => entry.name === REFRESH_COOKIE)
      )
      .toBe(false);
    await app.page.reload();
    await expect(app.signInButton()).toBeVisible();
  });

  test('keeps the state from Drive through the sign-in and replaces it after', async ({
    context,
  }) => {
    const state = JSON.stringify({ action: 'open', ids: ['file-2'] });
    const app = await GdrivePage.open(
      context,
      `/gdrive?state=${encodeURIComponent(state)}`
    );
    await expect(app.signInButton()).toBeVisible();
    expect(new URL(app.page.url()).searchParams.get('state')).toBe(state);

    await app.signIn();
    await app.waitForEditor();

    await expect(app.page).toHaveURL(/\/gdrive\?file=file-2$/);
  });

  test('signs in with the account Drive used as the hint', async ({
    context,
  }) => {
    // Drive shows each account the files it opened with erd-editor alone.
    google.files.get('file-1')!.accounts = [OTHER_ACCOUNT.sub];
    const state = JSON.stringify({
      action: 'open',
      ids: ['file-1'],
      userId: OTHER_ACCOUNT.sub,
    });
    const app = await GdrivePage.open(
      context,
      `/gdrive?state=${encodeURIComponent(state)}`
    );

    await app.throughPopup(app.signInButton());

    expect(google.authorizeRequests).toHaveLength(1);
    expect(google.authorizeRequests[0].searchParams.get('login_hint')).toBe(
      OTHER_ACCOUNT.sub
    );
    expect(google.authorizeRequests[0].searchParams.get('prompt')).toBe(
      'consent'
    );
    await app.waitForEditor();
    await expect(app.sidebar().getByText(OTHER_ACCOUNT.email)).toBeVisible();
    await expect(app.page).toHaveURL(/\/gdrive\?file=file-1$/);
  });

  test('asks for the account Drive used and switches with it as the hint', async ({
    context,
  }) => {
    google.files.get('file-1')!.accounts = [OTHER_ACCOUNT.sub];
    const state = JSON.stringify({
      action: 'open',
      ids: ['file-1'],
      userId: OTHER_ACCOUNT.sub,
    });
    // Signed in already, with the account Drive did not use.
    const first = await GdrivePage.open(context);
    await first.signIn();
    await first.close();
    const app = await GdrivePage.open(
      context,
      `/gdrive?state=${encodeURIComponent(state)}`
    );
    await expect(
      app.page.getByText('Google Drive sent this for another account')
    ).toBeVisible();

    await app.throughPopup(
      app.page.getByRole('button', { name: 'Switch account' })
    );

    expect(
      google.authorizeRequests.at(-1)?.searchParams.get('login_hint')
    ).toBe(OTHER_ACCOUNT.sub);
    await app.waitForEditor();
    await expect(app.sidebar().getByText(OTHER_ACCOUNT.email)).toBeVisible();
    await expect(app.page).toHaveURL(/\/gdrive\?file=file-1$/);
    await expect.poll(() => app.fileNames()).toEqual(['shop.erd.json']);
  });

  test("leaves a state for another account for this account's files, or signs out there", async ({
    context,
  }) => {
    google.files.get('file-1')!.accounts = [OTHER_ACCOUNT.sub];
    const path = `/gdrive?state=${encodeURIComponent(
      JSON.stringify({
        action: 'open',
        ids: ['file-1'],
        userId: OTHER_ACCOUNT.sub,
      })
    )}`;
    const mismatch = (page: Page) =>
      page.getByText('Google Drive sent this for another account');
    const first = await GdrivePage.open(context);
    await first.signIn();
    await first.close();
    const app = await GdrivePage.open(context, path);
    await expect(mismatch(app.page)).toBeVisible();

    await app.page.getByRole('button', { name: 'Show my files' }).click();

    await expect(app.sidebar().getByText(ACCOUNT.email)).toBeVisible();
    await expect(app.page).toHaveURL(/\/gdrive$/);
    await expect.poll(() => app.fileNames()).toEqual(['blog.erd']);

    const again = await GdrivePage.open(context, path);
    await expect(mismatch(again.page)).toBeVisible();
    await again.page.getByRole('button', { name: 'Sign out' }).click();
    await expect(again.signInScreen()).toBeVisible();
    await expect.poll(async () => (await oauthServerState()).revokes).toBe(1);
  });

  test('says so when Drive access was left out, keeps no cookie, and tries again', async ({
    context,
  }) => {
    google.authorizeMode = 'denyDriveFile';
    const app = await GdrivePage.open(context);

    await app.throughPopup(app.signInButton());

    await expect(
      app.page.getByText('Google Drive access was not granted')
    ).toBeVisible();
    expect(
      (await context.cookies()).some(entry => entry.name === REFRESH_COOKIE)
    ).toBe(false);

    google.authorizeMode = 'success';
    const requests = google.authorizeRequests.length;
    await app.throughPopup(app.page.getByRole('button', { name: 'Try again' }));
    await expect(app.sidebar()).toBeVisible();
    expect(google.authorizeRequests).toHaveLength(requests + 1);
  });

  test('runs nothing from a callback link and reaches no waiting tab', async ({
    context,
  }) => {
    const app = await GdrivePage.open(context);
    await expect(app.signInButton()).toBeVisible();
    await app.page.evaluate(() => {
      const scope = window as any;
      scope.__messages = [];
      new BroadcastChannel('@dineug/erd-editor-app/gdrive-auth').onmessage = (
        event: MessageEvent
      ) => scope.__messages.push(event.data);
    });

    const stray = await context.newPage();
    await stray.goto(
      '/api/auth/callback?error=%3C/script%3E%3Cscript%3Ewindow.__x=1%3C/script%3E'
    );

    expect(await stray.evaluate(() => (window as any).__x)).toBeUndefined();
    expect(await stray.content()).not.toContain('window.__x=1');
    await app.page.waitForTimeout(500);
    expect(await app.page.evaluate(() => (window as any).__messages)).toEqual(
      []
    );
  });

  test('says a preview deploy cannot sign in, and offers nothing to click', async ({
    context,
  }) => {
    // A pages.dev preview, served by the dev server behind the fake origin.
    const preview = 'https://preview.erd-editor.pages.dev';
    await context.route(`${preview}/**`, async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: `${GDRIVE_BASE_URL}${url.pathname}${url.search}`,
      });
      await route.fulfill({ response });
    });
    const page = await context.newPage();

    await page.goto(`${preview}/gdrive`);

    await expect(
      page.getByRole('heading', { name: "Google Drive isn't available here" })
    ).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(0);
    expect(google.authorizeRequests).toEqual([]);
  });

  test('answers a POST without a cookie as JSON 401, and one without its header as 403', async ({
    request,
    baseURL,
  }) => {
    const signedOut = await request.post('/api/auth/token', {
      headers: { Origin: baseURL!, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(signedOut.status()).toBe(401);
    expect(await signedOut.json()).toEqual({ error: 'signed_out' });

    const refused = await request.post('/api/auth/token', {
      headers: { Origin: baseURL! },
    });
    expect(refused.status()).toBe(403);
    expect(refused.headers()['content-type']).toContain('application/json');
  });
});
