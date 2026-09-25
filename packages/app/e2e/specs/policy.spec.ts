import { expect, test } from '@playwright/test';

import { AppPage } from '../support/AppPage';
import { expectResourceLinks } from '../support/resourceLinks';

const ISSUES_URL = 'https://github.com/dineug/erd-editor/issues';
// Anything shaped like an email address: GitHub Issues is the only contact.
const EMAIL_ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

const PAGES = [
  {
    path: '/privacy',
    heading: 'Privacy Policy',
    // The eight points the policy has to make, one entry each, in the page's
    // own words; a point with several parts pins each part.
    phrases: [
      ['drive.file'],
      [
        'named ERD Editor, which ERD Editor creates in your My Drive',
        'makes a new one if the folder is deleted, in the trash, moved to a shared drive, owned by someone else',
        'never in an ERD Editor folder someone else shares with you',
        'after you sign out of ERD Editor or remove its access from your Google Account',
        'the earlier folder and the files in it stay in your Google Drive, but ERD Editor can no longer list them',
      ],
      ['never pass through an ERD Editor server'],
      ['encrypted with a key only the relay holds', 'It has no database'],
      [
        "Signing out of ERD Editor revokes ERD Editor's access at Google",
        'every other device where you use ERD Editor',
      ],
      [
        'Google Analytics is not loaded on the Google Drive pages',
        'file IDs, which become a placeholder',
        "never carry your Drive files' content or names",
      ],
      ['including the Limited Use requirements'],
      ['Effective date:'],
    ].flat(),
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
      const requested: URL[] = [];
      page.on('request', request => requested.push(new URL(request.url())));
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

      // The two policies link each other and nothing else of the site, / and /gdrive included.
      const paths = await page.locator('a[href]').evaluateAll(anchors =>
        anchors
          .map(anchor => new URL((anchor as HTMLAnchorElement).href))
          .filter(url => url.origin === location.origin)
          .map(url => url.pathname)
      );
      expect([...new Set(paths)].sort()).toEqual(['/privacy', '/terms']);

      // Nothing from another host, which a review may block: no font or image.
      await page.waitForLoadState('networkidle');
      const origin = new URL(page.url()).origin;
      expect(
        requested.filter(url => url.origin !== origin).map(url => url.href)
      ).toEqual([]);
    });

    test(`${path} follows the system theme with CSS alone`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(path);
      const body = page.locator('body');
      await expect(body).toHaveCSS('background-color', 'rgb(252, 252, 253)');

      await page.emulateMedia({ colorScheme: 'dark' });
      await expect(body).toHaveCSS('background-color', 'rgb(17, 17, 19)');
    });
  }

  test('/ links both from its static markup', async ({ page }) => {
    await page.goto('/');

    for (const { path, heading } of PAGES) {
      await expect(
        page.getByRole('link', { name: heading, exact: true })
      ).toHaveAttribute('href', path);
    }
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

test.describe('the local empty viewer', () => {
  test('links the Editing Guide and GitHub in a new tab, under its buttons', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await expect(app.page.getByText('No schema open')).toBeVisible();
    await expectResourceLinks(app.page);
  });
});
