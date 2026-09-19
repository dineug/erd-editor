import { expect, test } from '@playwright/test';

import { AppPage } from '../support/AppPage';

const schemaUrl = (id: string | null) => (url: URL) =>
  url.pathname === '/' && url.searchParams.get('schema') === id;

/** The open schema lives in the query string, so a link or a reload reopens it. */
test.describe('the schema in the URL', () => {
  test('follows the selection, and brings it back on reload and through history', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.createSchema('one');
    await app.createSchema('two');
    const one = await app.storedSchema('one');
    const two = await app.storedSchema('two');

    await expect(app.page).toHaveURL(schemaUrl(two.id));
    await app.selectSchema('one');
    await expect(app.page).toHaveURL(schemaUrl(one.id));
    await expect(app.page).toHaveTitle('one · erd-editor');

    await app.page.reload();
    await app.waitForEditor();
    await expect(app.page).toHaveURL(schemaUrl(one.id));
    await expect(app.schemaItem('one')).toHaveAttribute('aria-current', 'page');
    await expect(app.page).toHaveTitle('one · erd-editor');

    await app.page.goBack();
    await expect(app.page).toHaveURL(schemaUrl(two.id));
    await expect(app.schemaItem('two')).toHaveAttribute('aria-current', 'page');
    await expect(app.page).toHaveTitle('two · erd-editor');

    await app.page.goForward();
    await expect(app.page).toHaveURL(schemaUrl(one.id));
    await expect(app.schemaItem('one')).toHaveAttribute('aria-current', 'page');
  });

  test('drops an id that names no schema, or one in the trash', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.createSchema('trashed');
    const { id } = await app.storedSchema('trashed');
    await app.moveToTrash('trashed');
    await expect(app.page).toHaveURL(schemaUrl(null));

    for (const param of ['no-such-schema', id]) {
      await app.page.goto(`/?schema=${param}`);
      await expect(app.page).toHaveURL(schemaUrl(null));
      await expect(app.page.getByText('No schema open')).toBeVisible();
      await expect(app.page).toHaveTitle('erd-editor');
    }
  });
});
