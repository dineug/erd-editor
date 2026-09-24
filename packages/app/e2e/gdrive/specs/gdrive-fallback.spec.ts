import { expect, test } from '@playwright/test';

import { installFakeAuth } from '../../support/gdrive/fakeAuth';
import {
  ACCOUNT,
  type FakeGoogle,
  installFakeGoogle,
} from '../../support/gdrive/fakeGoogle';
import { GdrivePage } from '../../support/gdrive/GdrivePage';

const DOCUMENT = JSON.stringify({
  version: '3.0.0',
  doc: { tableIds: [], relationshipIds: [], indexIds: [], memoIds: [] },
});

let google: FakeGoogle;

test.beforeEach(async ({ context }) => {
  google = await installFakeGoogle(context);
  google.add({ id: 'file-1', name: 'shop.erd.json', content: DOCUMENT });
});

function continueButton(app: GdrivePage) {
  return app.page.getByRole('button', { name: 'Continue with Google' });
}

async function continueWithGoogle(app: GdrivePage) {
  await expect(continueButton(app)).toBeEnabled();
  await continueButton(app).click();
  await expect(app.sidebar()).toBeVisible();
}

test.describe('the fallback to Google’s token client', () => {
  for (const mode of ['html200', 'tooMany429'] as const) {
    test(`takes over when the relay answers ${mode}, and asks it nothing until sign-out`, async ({
      context,
    }) => {
      const auth = await installFakeAuth(context, mode);
      const app = await GdrivePage.open(context);

      await continueWithGoogle(app);
      await expect(app.fileItem('shop.erd.json')).toBeVisible();
      expect(google.gisRequests).toEqual([
        { prompt: 'select_account', loginHint: '' },
      ]);
      await app.page.reload();
      await continueWithGoogle(app);

      // The visit's one token request decided; nothing more reached the relay.
      expect(auth.paths).toEqual(['/api/auth/token']);

      await app.signOut();
      expect(google.gisRevoked).toHaveLength(1);
      expect(auth.count('/api/auth/logout')).toBe(1);
      expect(auth.count('/api/auth/start')).toBe(0);
    });
  }

  for (const mode of ['limitPage', 'spaFallback'] as const) {
    test(`closes a popup that lands on ${mode}, asks once and offers Continue with Google`, async ({
      context,
    }) => {
      const auth = await installFakeAuth(context, mode);
      const app = await GdrivePage.open(context);

      await app.throughPopup(app.signInButton());

      await expect(continueButton(app)).toBeVisible();
      expect(auth.paths).toEqual([
        '/api/auth/token',
        '/api/auth/start',
        '/api/auth/token',
      ]);
      await continueWithGoogle(app);
      expect(google.gisRequests).toHaveLength(1);
      expect(auth.paths).toHaveLength(3);
    });
  }

  test('asks for Reconnect Google once the hour is over, with the token client alone', async ({
    context,
  }) => {
    const auth = await installFakeAuth(context, 'html200');
    // Past its last ten seconds a token goes to no Drive call, so this one
    // serves five, asks for Reconnect Google at five and ends at fifteen.
    google.gisExpiresIn = 15;
    const app = await GdrivePage.open(context);
    await continueWithGoogle(app);
    await expect(app.fileItem('shop.erd.json')).toBeVisible();
    await expect(
      app.page.getByText('Your Google session ends soon.')
    ).toBeVisible({ timeout: 20_000 });

    await expect(
      app.page.getByText('Your Google session ended, so saving is paused.')
    ).toBeVisible({ timeout: 20_000 });
    google.gisExpiresIn = 3600;
    await app.page.getByRole('button', { name: 'Reconnect Google' }).click();

    await expect(
      app.page.getByRole('button', { name: 'Reconnect Google' })
    ).toHaveCount(0);
    expect(google.gisRequests).toEqual([
      { prompt: 'select_account', loginHint: '' },
      { prompt: '', loginHint: ACCOUNT.sub },
    ]);
    expect(auth.count('/api/auth/start')).toBe(0);
    expect(auth.paths).toEqual(['/api/auth/token']);
  });

  test('renews on a click outside the editor, never while typing in it', async ({
    context,
  }) => {
    await installFakeAuth(context, 'html200');
    google.gisExpiresIn = 120;
    const app = await GdrivePage.open(context);
    await continueWithGoogle(app);
    await app.openFile('shop.erd.json');

    await expect(
      app.page.getByText('Your Google session ends soon.')
    ).toBeVisible({ timeout: 20_000 });
    // Clicks and keys inside the editor, whose own fields the page cannot see.
    await app.addTable();
    await app.page.keyboard.type('users');
    await app.page.waitForTimeout(500);
    expect(google.gisRequests).toHaveLength(1);

    google.gisExpiresIn = 3600;
    await app.sidebar().getByText(ACCOUNT.email).click();

    await expect.poll(() => google.gisRequests.length).toBe(2);
    expect(google.gisRequests[1]).toEqual({
      prompt: '',
      loginHint: ACCOUNT.sub,
    });
    await expect(
      app.page.getByText('Your Google session ends soon.')
    ).toHaveCount(0);
  });
});
