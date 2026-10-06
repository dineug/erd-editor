import { expect, type Page, test } from '@playwright/test';

import { AppPage } from '../support/AppPage';

// The display language: the app turns on the editor's language picker and its
// welcome screen, keeps a pick in localStorage, and every tab follows it.

const LOCALE_KEY = '@locale';

/** The editor's root, which carries the language it shows. */
function editorRoot(page: Page) {
  return page.locator('erd-editor .root');
}

function picker(page: Page) {
  return page.locator('erd-editor .locale-picker');
}

async function storedLocale(page: Page) {
  return await page.evaluate(key => localStorage.getItem(key), LOCALE_KEY);
}

/** Picks a language from the toolbar's language button, as a person does. */
async function pickLocale(page: Page, option: string) {
  await page.locator('erd-editor .toolbar-locale').click();
  await expect(picker(page)).toBeVisible();
  await picker(page)
    .locator(`button[role="option"][data-locale="${option}"]`)
    .click();
  await expect(picker(page)).toHaveCount(0);
}

test.describe('the display language', () => {
  test.describe('on a German browser', () => {
    test.use({ locale: 'de-DE' });

    test('follows the browser while nothing is picked', async ({ context }) => {
      const app = await AppPage.open(context);
      await app.createSchema('Browser language');

      await expect(editorRoot(app.page)).toHaveAttribute('lang', 'de-DE');
      await expect(editorRoot(app.page)).toHaveAttribute('dir', 'ltr');
      expect(await storedLocale(app.page)).toBeNull();
    });
  });

  test('stores a pick, which survives a reload and reaches the other tabs', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.createSchema('Picked language');
    const other = await AppPage.open(context);
    await other.selectSchema('Picked language');
    await expect(editorRoot(other.page)).toHaveAttribute('lang', 'en');

    await pickLocale(app.page, 'ko-KR');

    await expect(editorRoot(app.page)).toHaveAttribute('lang', 'ko-KR');
    expect(await storedLocale(app.page)).toBe('"ko-KR"');
    await expect(editorRoot(other.page)).toHaveAttribute('lang', 'ko-KR');

    await app.page.reload();
    await app.waitForEditor();
    await expect(editorRoot(app.page)).toHaveAttribute('lang', 'ko-KR');
  });

  test('stores System as system, which follows the browser again', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.createSchema('System language');

    await pickLocale(app.page, 'ko-KR');
    await expect(editorRoot(app.page)).toHaveAttribute('lang', 'ko-KR');

    await pickLocale(app.page, 'system');
    await expect(editorRoot(app.page)).toHaveAttribute('lang', 'en');
    expect(await storedLocale(app.page)).toBe('"system"');
  });

  test('shows the welcome screen on a new schema until its first table', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.createSchema('Welcome');
    const welcome = app.page.locator('erd-editor .welcome-screen');

    await expect(welcome).toBeVisible();

    await app.addTable();

    await expect(welcome).toHaveCount(0);
  });
});
