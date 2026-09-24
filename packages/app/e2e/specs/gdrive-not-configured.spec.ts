import { expect, test } from '@playwright/test';

// This run's dev server has no Google client id (playwright.config.ts sets it
// empty), which is what a local build, a preview or a fork has.
test.describe('without a Google client id', () => {
  test('/gdrive says it is not configured', async ({ page }) => {
    await page.goto('/gdrive');

    await expect(
      page.getByRole('heading', {
        name: 'Google Drive integration is not configured',
      })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in with Google' })
    ).toHaveCount(0);
  });

  test('/ loads no Drive module and no Google sign-in script', async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on('request', request => requested.push(request.url()));

    await page.goto('/');
    await expect(
      page.getByRole('navigation', { name: 'Schemas' })
    ).toBeVisible();
    // The lazy chunks a route would pull have had their chance by now.
    await page.waitForTimeout(1000);

    expect(
      requested.filter(
        url =>
          url.includes('/src/components/gdrive/') ||
          url.includes('/src/services/gdrive/') ||
          url.includes('accounts.google.com/gsi/client')
      )
    ).toEqual([]);
  });
});
