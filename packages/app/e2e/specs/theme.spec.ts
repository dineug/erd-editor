import { expect, test } from '@playwright/test';

import { AppPage } from '../support/AppPage';

// A light system, so a light page shows System, the default, over the dark
// markup a page without script keeps.
test.use({ colorScheme: 'light' });

test.describe('the theme', () => {
  test('follows the system by default, and keeps a pick over it', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    const html = app.page.locator('html');
    const theme = app.sidebar();

    await expect(theme.getByRole('radio', { name: 'System' })).toBeChecked();
    await expect(html).toHaveClass(/\blight-theme\b/);
    await expect(html).toHaveCSS('color-scheme', 'light');

    await app.page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveClass(/\bdark-theme\b/);
    await app.page.emulateMedia({ colorScheme: 'light' });
    await expect(html).toHaveClass(/\blight-theme\b/);

    await theme.getByRole('radio', { name: 'Dark' }).click();
    await expect(html).toHaveClass(/\bdark-theme\b/);
    await expect(html).toHaveCSS('color-scheme', 'dark');
  });

  test('paints a stored light preference before the app script runs', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    // A dark system, so only the stored pick can paint the page light.
    await app.page.emulateMedia({ colorScheme: 'dark' });
    await app.sidebar().getByRole('radio', { name: 'Light' }).click();
    await expect(app.page.locator('html')).toHaveClass(/\blight-theme\b/);

    // With the entry module refused, only the inline script in index.html
    // can have set the class: React never mounts.
    await app.page.route('**/src/main.tsx', route => route.abort());
    await app.page.reload();
    await expect(app.page.locator('#app')).toBeEmpty();
    await expect(app.page.locator('html')).toHaveClass(/\blight-theme\b/);
    await expect(app.page.locator('html')).not.toHaveClass(/\bdark-theme\b/);

    await app.page.unroute('**/src/main.tsx');
    await app.page.reload();
    await expect(
      app.sidebar().getByRole('radio', { name: 'Light' })
    ).toBeChecked();
    await expect(app.page.locator('html')).toHaveClass(/\blight-theme\b/);
  });
});
