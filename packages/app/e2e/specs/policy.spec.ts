import { expect, test } from '@playwright/test';

import { AppPage } from '../support/AppPage';

const ISSUES_URL = 'https://github.com/dineug/erd-editor/issues';
// Anything shaped like an email address: GitHub Issues is the only contact.
const EMAIL_ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

const PAGES = [
  {
    path: '/privacy',
    heading: 'Privacy Policy',
    // The seven points the policy has to make, in the page's own words.
    phrases: [
      'drive.file',
      'never pass through an erd-editor server',
      'It has no database',
      "Signing out of erd-editor revokes erd-editor's access at Google",
      'every other device where you use erd-editor',
      'Google Analytics is not loaded on the Google Drive pages',
      'file IDs, which become a placeholder',
      'including the Limited Use requirements',
      'Effective date:',
    ],
  },
  {
    path: '/terms',
    heading: 'Terms of Service',
    phrases: [
      'erd-editor.io is run by dineug',
      'provided "as is"',
      'belong to you',
      'Limitation of liability',
      'Effective date:',
    ],
  },
];

test.describe('the policy pages', () => {
  // They must open for Google's reviewers and crawlers without any script.
  test.use({ javaScriptEnabled: false });

  for (const { path, heading, phrases } of PAGES) {
    test(`${path} is a static page that says what it must`, async ({
      page,
    }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole('heading', { level: 1, name: heading })
      ).toBeVisible();
      await expect(page.locator('script')).toHaveCount(0);

      const text = await page.locator('body').innerText();
      for (const phrase of phrases) expect(text).toContain(phrase);
      expect(text.toLowerCase()).not.toContain('governing law');

      expect(await page.content()).not.toMatch(EMAIL_ADDRESS);
      await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
      await expect(page.locator(`a[href="${ISSUES_URL}"]`)).toHaveCount(1);
    });
  }

  test('follow the system theme with CSS alone', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/privacy');
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(252, 252, 253)');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(body).toHaveCSS('background-color', 'rgb(17, 17, 19)');
  });
});

test.describe('the local sidebar', () => {
  test('links Privacy and Terms in a new tab, and nothing of /gdrive', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    const links = [
      { name: 'Privacy', path: '/privacy' },
      { name: 'Terms', path: '/terms' },
    ];

    for (const { name, path } of links) {
      const link = app.sidebar().getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', path);
      await expect(link).toHaveAttribute('target', '_blank');
    }

    const opened = context.waitForEvent('page');
    await app.sidebar().getByRole('link', { name: 'Terms' }).click();
    const terms = await opened;
    await expect(
      terms.getByRole('heading', { level: 1, name: 'Terms of Service' })
    ).toBeVisible();
    // The local app stays where it was.
    await expect(app.page).toHaveURL(/\/$/);

    expect(
      await app.page.locator('a[href]').evaluateAll(anchors =>
        anchors
          .map(anchor => new URL((anchor as HTMLAnchorElement).href))
          .filter(url => url.origin === location.origin)
          .map(url => decodeURI(url.pathname).toLowerCase())
          .filter(pathname => pathname.startsWith('/gdrive'))
      )
    ).toEqual([]);
  });
});
