import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { AppPage, type StoredSchema } from '../support/AppPage';

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

/** Where each stored connector starts and ends. */
const storedAnchors = ({ value }: StoredSchema): number[][] => {
  const { doc, collections } = JSON.parse(value);
  return doc.relationshipIds.map((id: string) => {
    const { start, end } = collections.relationshipEntities[id];
    return [start.x, start.y, end.x, end.y];
  });
};

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
    // Read straight after parsing, before the engine placed any connector.
    expect(storedAnchors(blog)).toEqual([[0, 0, 0, 0]]);

    await app.page.reload();
    await app.selectSchema('blog');
    await expect.poll(async () => (await app.tableIds()).length).toBe(2);
    await app.zoomIn();
    await expect
      .poll(
        async () =>
          JSON.parse((await app.storedSchema('blog')).value).settings.zoomLevel
      )
      .toBeGreaterThan(1);

    // Opening derived the connectors, and the zoom saved them, as no edit.
    const opened = await app.storedSchema('blog');
    expect(storedAnchors(opened)).not.toEqual([[0, 0, 0, 0]]);
    expect(opened.updateAt).toBe(blog.updateAt);
  });

  test('exports a backup that imports back as copies', async ({ context }) => {
    const app = await AppPage.open(context);
    await app.importFiles([
      { name: 'shop.dbml', mimeType: 'text/plain', buffer: Buffer.from(DBML) },
    ]);
    await expect
      .poll(async () => storedTableCount(await app.storedSchema('shop')))
      .toBe(2);
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
