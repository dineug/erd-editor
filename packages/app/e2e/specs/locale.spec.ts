import { expect, type Page, test } from '@playwright/test';

import { AppPage, reopenShadowRoots } from '../support/AppPage';

// The display language: the app's own text and the editor's follow one pick,
// made in the sidebar's menu or the editor's picker, kept in localStorage,
// and every tab follows it.

const LOCALE_KEY = '@locale';

/** The editor's root, which carries the language it shows. */
function editorRoot(page: Page) {
  return page.locator('erd-editor .root');
}

function picker(page: Page) {
  return page.locator('erd-editor .locale-picker');
}

/** The page root, which carries the language the app's own text shows. */
function pageRoot(page: Page) {
  return page.locator('html');
}

/** Picks a language from the sidebar's menu, named by the menu's own label. */
async function pickFromSidebar(
  app: AppPage,
  menu: string,
  language: string | RegExp
) {
  await app.page
    .getByRole('navigation')
    .getByRole('button', { name: menu, exact: true })
    .click();
  await app.page
    .getByRole('menuitemradio', { name: language, exact: true })
    .click();
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

    test('follows the browser while nothing is picked, the app too', async ({
      context,
    }) => {
      // The helpers find the sidebar by its English names, so the German
      // shell is driven by its own.
      const page = await context.newPage();
      await reopenShadowRoots(page);
      await page.goto('/');
      const sidebar = page.getByRole('navigation', { name: 'Schemas' });
      await sidebar
        .getByRole('button', { name: 'Neues Schema', exact: true })
        .click();
      const input = page.getByPlaceholder('Schemaname');
      await input.fill('Browser language');
      await input.press('Enter');
      await sidebar
        .getByRole('button', { name: 'Browser language', exact: true })
        .click();

      await expect(pageRoot(page)).toHaveAttribute('lang', 'de-DE');
      await expect(editorRoot(page)).toHaveAttribute('lang', 'de-DE');
      await expect(editorRoot(page)).toHaveAttribute('dir', 'ltr');
      await expect(
        page.getByRole('button', { name: /^Papierkorb/ })
      ).toBeVisible();
      expect(await storedLocale(page)).toBeNull();
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
    await expect(pageRoot(app.page)).toHaveAttribute('lang', 'ko-KR');
    expect(await storedLocale(app.page)).toBe('"ko-KR"');
    await expect(editorRoot(other.page)).toHaveAttribute('lang', 'ko-KR');
    await expect(pageRoot(other.page)).toHaveAttribute('lang', 'ko-KR');

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

  test('switches the app and the editor from the sidebar menu, right to left too', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.createSchema('Menu language');

    await pickFromSidebar(app, 'Display Language', '한국어');

    await expect(
      app.page.getByRole('navigation', { name: '스키마' })
    ).toBeVisible();
    await expect(pageRoot(app.page)).toHaveAttribute('lang', 'ko-KR');
    await expect(editorRoot(app.page)).toHaveAttribute('lang', 'ko-KR');
    expect(await storedLocale(app.page)).toBe('"ko-KR"');

    await pickFromSidebar(app, '표시 언어', 'العربية');

    await expect(pageRoot(app.page)).toHaveAttribute('dir', 'rtl');
    await expect(editorRoot(app.page)).toHaveAttribute('dir', 'rtl');
    await expect(
      app.page.getByRole('navigation', { name: 'المخططات' })
    ).toBeVisible();

    // System names the language it stands for beside itself.
    await pickFromSidebar(app, 'لغة العرض', /^النظام/);
    await expect(pageRoot(app.page)).toHaveAttribute('lang', 'en');
    await expect(pageRoot(app.page)).toHaveAttribute('dir', 'ltr');
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
