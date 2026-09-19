import { expect, type Locator, test } from '@playwright/test';

import { AppPage, type StoredSchema } from '../support/AppPage';
import { backupFile, dateGroupLabel, daysAgo } from '../support/backup';

/** A row of the trash dialog, by the exact name, which "Deleted …" never is. */
function trashRow(trash: Locator, name: string) {
  return trash
    .getByRole('listitem')
    .filter({ has: trash.page().getByText(name, { exact: true }) });
}

/** A schema a past session moved to the trash, at local noon some days ago. */
function trashedSchema(name: string, days: number, now: Date): StoredSchema {
  const deletedAt = daysAgo(days, now);
  return {
    id: `trashed-${days}`,
    name,
    value: '',
    createAt: deletedAt,
    updateAt: deletedAt,
    deletedAt,
  };
}

test.describe('the schema list', () => {
  test('puts the last edited schema on top, where zoom and rename move nothing', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.createSchema('first');
    await app.createSchema('second');
    await expect.poll(() => app.schemaNames()).toEqual(['second', 'first']);

    await app.selectSchema('first');
    await app.addTable();
    await expect.poll(() => app.schemaNames()).toEqual(['first', 'second']);

    await app.selectSchema('second');
    const { updateAt } = await app.storedSchema('second');
    await expect(app.zoomLevel()).toHaveText('100%');
    await app.zoomIn();
    await expect(app.zoomLevel()).not.toHaveText('100%');
    // The zoom is saved like an edit is, so once it is stored the list has
    // had every chance to move.
    await expect
      .poll(async () => {
        const { value } = await app.storedSchema('second');
        return value ? JSON.parse(value).settings.zoomLevel : 1;
      })
      .toBeGreaterThan(1);

    await app.renameSchema('second', 'renamed');
    await expect
      .poll(async () => (await app.storedSchemas()).map(({ name }) => name))
      .toContain('renamed');

    expect(await app.schemaNames()).toEqual(['first', 'renamed']);
    expect((await app.storedSchema('renamed')).updateAt).toBe(updateAt);
  });

  test('groups schemas by the calendar day of their last edit', async ({
    context,
  }) => {
    const now = new Date();
    const seeds = [0, 1, 3, 15, 45, 400].map(days => ({
      days,
      name: `${days} days ago`,
      updateAt: days ? daysAgo(days, now) : now.getTime(),
    }));
    const expected: Array<{ label: string; names: string[] }> = [];
    for (const { days, name } of seeds) {
      const label = dateGroupLabel(days, now);
      const last = expected.at(-1);
      if (last?.label === label) last.names.push(name);
      else expected.push({ label, names: [name] });
    }

    const app = await AppPage.open(context);
    await app.importFiles([backupFile(seeds)]);

    await expect(app.importNotice()).toHaveText('Imported 6 schemas');
    await expect.poll(() => app.schemaGroups()).toEqual(expected);
  });

  test('keeps a trashed schema until it is restored or deleted for good', async ({
    context,
  }) => {
    const now = new Date();
    const app = await AppPage.open(context);
    await app.importFiles([
      backupFile([
        { name: 'kept', updateAt: now.getTime() },
        { name: 'restored', updateAt: daysAgo(1, now) },
        { name: 'deleted', updateAt: daysAgo(3, now) },
        { name: 'emptied', updateAt: daysAgo(15, now) },
      ]),
    ]);
    await expect(app.trashButton()).toHaveText('Trash (0)');

    for (const name of ['restored', 'deleted', 'emptied']) {
      await app.moveToTrash(name);
    }
    await expect(app.trashButton()).toHaveText('Trash (3)');
    expect(await app.schemaNames()).toEqual(['kept']);

    // The dialog is modal, so the sidebar behind it is read once it closes.
    let trash = await app.openTrash();
    await expect(trash.getByRole('listitem')).toHaveCount(3);
    await expect(trashRow(trash, 'restored')).toContainText(
      'Deleted just now · deletes in 30 days'
    );

    await trashRow(trash, 'restored')
      .getByRole('button', { name: 'Restore' })
      .click();
    await expect(trashRow(trash, 'restored')).toHaveCount(0);

    await trashRow(trash, 'deleted')
      .getByRole('button', { name: 'Delete permanently' })
      .click();
    const confirmDelete = app.page.getByRole('alertdialog', {
      name: 'Delete permanently',
    });
    await confirmDelete.getByRole('button', { name: 'Delete' }).click();
    await expect(confirmDelete).toHaveCount(0);
    await expect(trash.getByRole('listitem')).toHaveCount(1);
    await expect(trashRow(trash, 'emptied')).toHaveCount(1);
    await app.closeDialog(trash);

    // Moving to the trash is no edit, so a restored schema is back in its group.
    await expect(app.trashButton()).toHaveText('Trash (1)');
    await expect
      .poll(() => app.schemaGroups())
      .toEqual([
        { label: 'Today', names: ['kept'] },
        { label: 'Yesterday', names: ['restored'] },
      ]);

    trash = await app.openTrash();
    await trash.getByRole('button', { name: 'Empty trash' }).click();
    const confirmEmpty = app.page.getByRole('alertdialog', {
      name: 'Empty trash',
    });
    await expect(confirmEmpty).toContainText('Permanently delete 1 schema?');
    await confirmEmpty.getByRole('button', { name: 'Empty trash' }).click();
    await expect(trash.getByText('The trash is empty.')).toBeVisible();
    await app.closeDialog(trash);
    await expect(app.trashButton()).toHaveText('Trash (0)');

    await app.page.reload();
    await expect.poll(() => app.schemaNames()).toEqual(['kept', 'restored']);
    await expect(app.trashButton()).toHaveText('Trash (0)');
    expect((await app.storedSchemas()).map(({ name }) => name).sort()).toEqual([
      'kept',
      'restored',
    ]);
  });

  test('deletes a schema for good once it has been in the trash for 30 days', async ({
    context,
  }) => {
    const now = new Date();
    const app = await AppPage.open(context);
    // The import has the app create its database, which the seed writes to.
    await app.importFiles([
      backupFile([{ name: 'kept', updateAt: now.getTime() }]),
    ]);
    await app.storeSchemas([
      trashedSchema('expired', 31, now),
      trashedSchema('expiring', 29, now),
    ]);

    await app.page.reload();

    await expect
      .poll(async () => (await app.storedSchemas()).map(({ name }) => name))
      .not.toContain('expired');
    expect((await app.storedSchemas()).map(({ name }) => name).sort()).toEqual([
      'expiring',
      'kept',
    ]);
    await expect(app.trashButton()).toHaveText('Trash (1)');
    expect(await app.schemaNames()).toEqual(['kept']);

    const trash = await app.openTrash();
    await expect(trash).toContainText(
      'Schemas in the trash are deleted permanently after 30 days.'
    );
    await expect(trash.getByRole('listitem')).toHaveCount(1);
    await expect(trashRow(trash, 'expiring')).toContainText('deletes tomorrow');
  });
});
