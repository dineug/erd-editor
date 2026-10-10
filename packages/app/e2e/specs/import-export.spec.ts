import { readFile } from 'node:fs/promises';

import { expect, type Page, test } from '@playwright/test';

import { AppPage, type StoredSchema } from '../support/AppPage';
import { holdConversion } from '../support/conversion';
import { expectFanPlaced, FAN_SQL } from '../support/placement';

const DBML = `Table users {
  id integer [pk]
  name varchar
}

Table orders {
  id integer [pk]
  user_id integer [ref: > users.id]
}
`;

const SQL = `CREATE TABLE authors (id INT PRIMARY KEY, name VARCHAR(80));
CREATE TABLE posts (
  id INT PRIMARY KEY,
  author_id INT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES authors (id)
);
`;

const storedTableCount = ({ value }: StoredSchema) =>
  value ? JSON.parse(value).doc.tableIds.length : 0;

const storedSettings = ({ value }: StoredSchema) => JSON.parse(value).settings;

/** The fields each stored connector end holds. */
const storedEnds = ({ value }: StoredSchema): string[][] => {
  const { doc, collections } = JSON.parse(value);
  return doc.relationshipIds.flatMap((id: string) => {
    const { start, end } = collections.relationshipEntities[id];
    return [Object.keys(start), Object.keys(end)];
  });
};

/**
 * Drags a file over the window and hands back the drop effect the app chose
 * and the drop. The transfer stands in for a DataTransfer, on which Chrome
 * ignores a drop effect set outside a real drag; the app reads no more of it.
 */
async function dragFile(page: Page, name: string, text: string) {
  const transfer = await page.evaluateHandle(
    ([name, text]) => ({
      types: ['Files'],
      files: [new File([text], name, { type: 'text/plain' })],
      dropEffect: '',
    }),
    [name, text]
  );
  const fire = (type: string) =>
    transfer.evaluate((transfer, type) => {
      const event = new DragEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: transfer });
      document.body.dispatchEvent(event);
    }, type);
  await fire('dragenter');
  await fire('dragover');

  return {
    dropEffect: () => transfer.evaluate(transfer => transfer.dropEffect),
    drop: () => fire('drop'),
  };
}

test.describe('import and export', () => {
  test('keeps what an imported DBML file parsed to across a reload', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.importFiles([
      { name: 'shop.dbml', mimeType: 'text/plain', buffer: Buffer.from(DBML) },
    ]);

    await expect(app.importNotice()).toHaveText('Imported 1 schema');
    await expect(app.schemaItem('shop')).toHaveAttribute(
      'aria-current',
      'page'
    );
    await app.waitForEditor();
    await expect.poll(async () => (await app.tableIds()).length).toBe(2);
    // The editor parses the source, and the replica stores what it made of it.
    await expect
      .poll(async () => storedTableCount(await app.storedSchema('shop')))
      .toBe(2);

    await app.page.reload();
    await app.waitForEditor();
    await expect.poll(async () => (await app.tableIds()).length).toBe(2);
  });

  test('stores every source of one import before any is opened', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.importFiles([
      { name: 'blog.sql', mimeType: 'text/plain', buffer: Buffer.from(SQL) },
      { name: 'shop.dbml', mimeType: 'text/plain', buffer: Buffer.from(DBML) },
    ]);

    await expect(app.importNotice()).toHaveText('Imported 2 schemas');
    await expect(app.schemaItem('shop')).toHaveAttribute(
      'aria-current',
      'page'
    );
    // Both are stored parsed, the one never opened included.
    const blog = await app.storedSchema('blog');
    expect(storedTableCount(blog)).toBe(2);
    expect(storedTableCount(await app.storedSchema('shop'))).toBe(2);
    // Stored in the file form, which writes no connector anchor.
    expect(storedEnds(blog)).toEqual([
      ['tableId', 'columnIds'],
      ['tableId', 'columnIds'],
    ]);
    // A source converts to a new document, every setting locked.
    expect(storedSettings(blog).lockSettings).toBe(63);

    await app.page.reload();
    await app.selectSchema('blog');
    await expect.poll(async () => (await app.tableIds()).length).toBe(2);
    await app.zoomIn();

    // What opening derived stays out of the file, as the locked zoom does.
    const opened = await app.storedSchema('blog');
    expect(opened.value).toBe(blog.value);
    expect(opened.updateAt).toBe(blog.updateAt);
    expect(storedSettings(opened)).toMatchObject({
      lockSettings: 63,
      zoomLevel: 1,
    });
  });

  test('stores an SQL source with its tables placed by their relationships', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    await app.importFiles([
      { name: 'fan.sql', mimeType: 'text/plain', buffer: Buffer.from(FAN_SQL) },
    ]);

    await expect(app.importNotice()).toHaveText('Imported 1 schema');
    expectFanPlaced((await app.storedSchema('fan')).value);
  });

  test('shows an import under way on its controls and refuses a drop until it ends', async ({
    context,
  }) => {
    const app = await AppPage.open(context);
    const conversion = await holdConversion(app.page);
    // Not exact: while loading, Radix keeps a hidden copy of the label beside it.
    const importButton = app.page.getByRole('button', { name: 'Import files' });
    const importItem = async () => {
      await app
        .sidebar()
        .getByRole('button', { name: 'Import and export' })
        .click();
      return app.page.getByRole('menuitem', { name: 'Import files' });
    };

    const chooser = app.page.waitForEvent('filechooser');
    await importButton.click();
    await (
      await chooser
    ).setFiles({
      name: 'fan.sql',
      mimeType: 'text/plain',
      buffer: Buffer.from(FAN_SQL),
    });
    await conversion.requested;

    await expect(importButton).toBeDisabled();
    await expect(importButton.locator('.rt-Spinner')).toBeVisible();
    await expect(await importItem()).toHaveAttribute('aria-disabled', 'true');
    await app.page.keyboard.press('Escape');

    const early = await dragFile(app.page, 'extra.dbml', DBML);
    await expect(app.page.getByText('Importing files…')).toBeVisible();
    expect(await early.dropEffect()).toBe('none');
    await early.drop();
    await expect(app.page.getByText('Importing files…')).toHaveCount(0);

    conversion.release();
    await expect(app.importNotice()).toHaveText('Imported 1 schema');
    await expect(app.schemaItem('fan')).toHaveAttribute('aria-current', 'page');
    await expect(app.page).toHaveURL(/\?schema=/);
    await app.waitForEditor();

    // Back on no schema, the empty viewer shows its Import files again.
    await app.page.goBack();
    await expect(app.page).not.toHaveURL(/\?schema=/);
    await expect(app.page.getByText('No schema open')).toBeVisible();
    await expect(importButton).toBeEnabled();
    await expect(importButton.locator('.rt-Spinner')).toHaveCount(0);
    await expect(await importItem()).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await app.page.keyboard.press('Escape');

    const late = await dragFile(app.page, 'extra.dbml', DBML);
    await expect(app.page.getByText('Drop to import')).toBeVisible();
    expect(await late.dropEffect()).toBe('copy');
    await late.drop();

    // The file dropped while fan.sql was imported was refused, not queued.
    await expect
      .poll(async () => (await app.schemaNames()).sort())
      .toEqual(['extra', 'fan']);
  });

  test('exports a backup that imports back as copies', async ({ context }) => {
    const app = await AppPage.open(context);
    await app.importFiles([
      { name: 'shop.dbml', mimeType: 'text/plain', buffer: Buffer.from(DBML) },
    ]);
    await expect
      .poll(async () => storedTableCount(await app.storedSchema('shop')))
      .toBe(2);
    // The import opened shop, and its editor takes the keyboard as it mounts,
    // which would close a name field opened before it.
    await app.waitForEditor();
    await app.createSchema('notes');

    const download = await app.exportBackup();
    expect(download.suggestedFilename()).toMatch(
      /^erd-editor-backup-\d{4}-\d{2}-\d{2}\.json$/
    );
    const text = await readFile(await download.path(), 'utf8');
    const backup = JSON.parse(text);
    expect(backup).toMatchObject({
      format: 'erd-editor-app-backup',
      version: 1,
    });
    expect(backup.schemas.map(({ name }: StoredSchema) => name)).toEqual([
      'notes',
      'shop',
    ]);

    const originals = await app.storedSchemas();
    await app.importFiles([
      {
        name: download.suggestedFilename(),
        mimeType: 'application/json',
        buffer: Buffer.from(text),
      },
    ]);

    await expect(app.importNotice()).toHaveText('Imported 2 schemas');
    await expect
      .poll(() => app.schemaNames())
      .toEqual(['notes', 'notes', 'shop', 'shop']);

    // New ids beside the originals, never over them, with the same times.
    const stored = await app.storedSchemas();
    expect(stored).toHaveLength(4);
    expect(new Set(stored.map(({ id }) => id)).size).toBe(4);
    for (const original of originals) {
      const copy = stored.find(
        schema => schema.name === original.name && schema.id !== original.id
      );
      expect(copy).toMatchObject({
        createAt: original.createAt,
        updateAt: original.updateAt,
      });
      expect(storedTableCount(copy!)).toBe(storedTableCount(original));
    }
  });
});
