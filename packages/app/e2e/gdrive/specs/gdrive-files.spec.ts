import { expect, test } from '@playwright/test';

import { dateGroupLabel, daysAgo } from '../../support/backup';
import {
  documentWithTable,
  FOREIGN_ERD,
  tableNames,
  version2Document,
} from '../../support/gdrive/documents';
import {
  ACCOUNT,
  APP_FOLDER_PROPERTIES,
  type FakeGoogle,
  FOLDER_MIME,
  installFakeGoogle,
  resetOAuthServer,
} from '../../support/gdrive/fakeGoogle';
import { GdrivePage } from '../../support/gdrive/GdrivePage';

let google: FakeGoogle;

test.beforeEach(async ({ context }) => {
  await resetOAuthServer();
  google = await installFakeGoogle(context);
});

async function signedIn(context: Parameters<typeof GdrivePage.open>[0]) {
  const app = await GdrivePage.open(context);
  await app.signIn();
  return app;
}

/** The one ERD Editor folder the app made in My Drive. */
function onlyAppFolder() {
  const folders = google.appFolders();
  expect(folders).toHaveLength(1);
  expect(folders[0]).toMatchObject({
    name: 'ERD Editor',
    mimeType: FOLDER_MIME,
    parents: ['root'],
    appProperties: APP_FOLDER_PROPERTIES,
    trashed: false,
  });
  return folders[0];
}

/** The names under each date group, top to bottom. */
async function fileGroups(app: GdrivePage) {
  return await app
    .sidebar()
    .locator('[data-schema-list] [role="group"]')
    .evaluateAll(groups =>
      groups.map(group => ({
        label:
          document.getElementById(group.getAttribute('aria-labelledby')!)
            ?.textContent ?? '',
        names: Array.from(
          group.querySelectorAll('[data-schema-item]'),
          item => item.textContent ?? ''
        ),
      }))
    );
}

test.describe('the Drive list', () => {
  test('lists the four extensions newest first, in date groups, and searches them', async ({
    context,
  }) => {
    const now = new Date();
    const seeds = [
      { id: 'a', name: 'today.erd', days: 0 },
      { id: 'b', name: 'yesterday.vuerd', days: 1 },
      { id: 'c', name: 'week.erd.json', days: 3 },
      { id: 'd', name: 'month.vuerd.json', days: 15 },
    ];
    for (const { id, name, days } of seeds) {
      google.add({ id, name, modifiedTime: daysAgo(days, now) });
    }
    google.add({ id: 'folder', name: 'folder.erd', mimeType: FOLDER_MIME });
    google.add({
      id: 'shortcut',
      name: 'shortcut.erd',
      mimeType: 'application/vnd.google-apps.shortcut',
    });
    google.add({ id: 'text', name: 'notes.txt', mimeType: 'text/plain' });
    google.add({ id: 'json', name: 'data.json' });

    const app = await signedIn(context);

    await expect.poll(() => app.fileNames()).toHaveLength(4);
    expect(await fileGroups(app)).toEqual(
      seeds.map(({ name, days }) => ({
        label: dateGroupLabel(days, now),
        names: [name],
      }))
    );
    // Every page was read: the fake answers two files at a time.
    expect(google.calls('GET', '/drive/v3/files').length).toBeGreaterThan(3);

    await app.sidebar().getByLabel('Search files').fill('VUERD');
    await expect
      .poll(() => app.fileNames())
      .toEqual(['yesterday.vuerd', 'month.vuerd.json']);
  });

  test('opens each of the four extensions', async ({ context }) => {
    const files = [
      { id: 'a', name: 'a.erd', table: 'alpha' },
      { id: 'b', name: 'b.vuerd', table: 'beta' },
      { id: 'c', name: 'c.erd.json', table: 'gamma' },
      { id: 'd', name: 'd.vuerd.json', table: 'delta' },
    ];
    for (const { id, name, table } of files) {
      google.add({
        id,
        name,
        content:
          id === 'b' ? version2Document(table) : documentWithTable(table),
      });
    }
    const app = await signedIn(context);

    for (const { name, table } of files) {
      await app.openFile(name);
      await expect(app.page).toHaveTitle(`${name} · ERD Editor`);
      // The last file's canvas stays until the new one mounts: read its tables.
      await expect
        .poll(async () => tableNames(await app.editorValue()))
        .toEqual([table]);
    }
    await app.openFile('b.vuerd');
    await expect
      .poll(async () => tableNames(await app.editorValue()))
      .toEqual(['beta']);
  });

  test('replaces an open state with the file, adding no history entry', async ({
    context,
  }) => {
    google.add({
      id: 'shared',
      name: 'shared.erd',
      content: documentWithTable('x'),
    });
    const app = await signedIn(context);
    const state = JSON.stringify({
      action: 'open',
      ids: ['shared'],
      userId: ACCOUNT.sub,
    });

    const length = await app.page.evaluate(() => history.length);
    await app.page.goto(`/gdrive?state=${encodeURIComponent(state)}`);
    await app.waitForEditor();

    // The visit is the one new entry; ?file= replaced ?state= in it.
    await expect(app.page).toHaveURL(/\/gdrive\?file=shared$/);
    expect(await app.page.evaluate(() => history.length)).toBe(length + 1);
  });
});

test.describe('creating from Google Drive', () => {
  test('names the folder, creates there, opens it and never twice', async ({
    context,
  }) => {
    google.add({ id: 'projects', name: 'Projects', mimeType: FOLDER_MIME });
    const app = await signedIn(context);
    const state = JSON.stringify({ action: 'create', folderId: 'projects' });

    await app.page.goto(`/gdrive?state=${encodeURIComponent(state)}`);
    const dialog = app.page.getByRole('dialog', {
      name: 'New file in Google Drive',
    });
    await expect(dialog.getByText('In the folder “Projects”')).toBeVisible();
    await dialog.getByLabel('File name').fill('orders');
    await expect(dialog.getByText('Saved as orders.erd.json')).toBeVisible();
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();

    await app.waitForEditor();
    await expect(app.page).toHaveURL(/\/gdrive\?file=created-1$/);
    expect(google.files.get('created-1')).toMatchObject({
      name: 'orders.erd.json',
      parents: ['projects'],
      mimeType: 'application/json',
    });

    await app.page.reload();
    await app.waitForEditor();
    expect(google.calls('POST')).toHaveLength(1);
    await expect(
      app.page.getByText("This file isn't an ERD Editor document")
    ).toHaveCount(0);
  });

  test("says when it can't see the folder, and creates in the ERD Editor folder instead", async ({
    context,
  }) => {
    google.add({
      id: 'hidden',
      name: 'Secret',
      mimeType: FOLDER_MIME,
      hidden: true,
    });
    const app = await signedIn(context);
    const state = JSON.stringify({ action: 'create', folderId: 'hidden' });

    await app.page.goto(`/gdrive?state=${encodeURIComponent(state)}`);
    const dialog = app.page.getByRole('dialog');
    await expect(
      dialog.getByText("In a folder ERD Editor can't see")
    ).toBeVisible();
    await dialog.getByLabel('File name').fill('orders');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(
      dialog.getByText("ERD Editor can't create files in this folder.", {
        exact: false,
      })
    ).toBeVisible();

    expect(google.appFolders()).toEqual([]);
    await dialog
      .getByRole('button', { name: 'Create in the ERD Editor folder' })
      .click();

    await app.waitForEditor();
    const folder = onlyAppFolder();
    expect(google.files.get('created-1')?.parents).toEqual([folder.id]);
  });
});

test.describe('the sidebar', () => {
  test('renames keeping the extension, and not a file it may not rename', async ({
    context,
  }) => {
    google.add({ id: 'a', name: 'shop.erd', content: documentWithTable('x') });
    google.add({ id: 'b', name: 'locked.erd.json', canRename: false });
    const app = await signedIn(context);

    await app.renameFile('shop.erd', 'market.erd.json');

    await expect(app.fileItem('market.erd')).toBeVisible();
    await expect.poll(() => google.files.get('a')?.name).toBe('market.erd');

    const menu = await app.fileMenu('locked.erd.json');
    await expect(
      menu.getByRole('menuitem', { name: 'Rename' })
    ).toHaveAttribute('aria-disabled', 'true');
  });

  test('creates a new file in one ERD Editor folder, which the next reuses, after a reload, a rename and a move too, and the list leaves out', async ({
    context,
  }) => {
    google.add({ id: 'projects', name: 'Projects', mimeType: FOLDER_MIME });
    const app = await signedIn(context);
    const lookups = () =>
      google
        .calls('GET', '/drive/v3/files')
        .filter(request =>
          request.url.searchParams.get('q')?.includes('appProperties has')
        );
    const newFile = async (name: string) => {
      await app.sidebar().getByRole('button', { name: 'New file' }).click();
      const input = app.sidebar().getByLabel('New file name');
      await input.fill(name);
      await input.press('Enter');
    };

    await newFile('orders');
    await expect(app.page).toHaveURL(/\/gdrive\?file=created-1$/);
    await app.waitForEditor();
    const folder = onlyAppFolder();
    expect(google.files.get('created-1')).toMatchObject({
      name: 'orders.erd.json',
      parents: [folder.id],
    });

    await newFile('invoices');
    await expect(app.page).toHaveURL(/\/gdrive\?file=created-2$/);
    expect(onlyAppFolder().id).toBe(folder.id);
    expect(google.files.get('created-2')?.parents).toEqual([folder.id]);

    // A new page knows no folder: it finds the one it made by its marker alone.
    folder.name = 'Diagrams';
    folder.parents = ['projects'];
    await app.page.reload();
    await app.waitForEditor();
    await expect
      .poll(async () => (await app.fileNames()).sort())
      .toEqual(['invoices.erd.json', 'orders.erd.json']);
    const looked = lookups().length;

    await newFile('customers');
    await expect(app.page).toHaveURL(/\/gdrive\?file=created-3$/);
    expect(google.files.get('created-3')?.parents).toEqual([folder.id]);
    expect(lookups()).toHaveLength(looked + 1);
    expect(google.appFolders()).toHaveLength(1);
    expect(google.calls('POST', '/drive/v3/files')).toHaveLength(1);
  });

  test('imports documents as new .erd.json files and refuses a backup', async ({
    context,
  }) => {
    const app = await signedIn(context);
    const backup = JSON.stringify({
      format: 'erd-editor-app-backup',
      version: 1,
      exportedAt: 0,
      schemas: [],
    });

    await app.sidebar().getByRole('button', { name: 'Import' }).click();
    const chooser = app.page.waitForEvent('filechooser');
    await app.page.getByRole('menuitem', { name: 'Import files' }).click();
    await (
      await chooser
    ).setFiles([
      {
        name: 'shop.sql',
        mimeType: 'text/plain',
        buffer: Buffer.from('CREATE TABLE users (id INT PRIMARY KEY);'),
      },
      {
        name: 'foo.erd.json',
        mimeType: 'application/json',
        buffer: Buffer.from(documentWithTable('foo')),
      },
      {
        name: 'erd-editor-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(backup),
      },
    ]);

    await expect(
      app.page
        .getByRole('status')
        .filter({ hasText: 'Imported 2 files to Google Drive' })
    ).toHaveText(
      'Imported 2 files to Google Drive · Skipped 1 backup: backups stay in the local app'
    );
    const folder = onlyAppFolder();
    const imported = [...google.files.values()].filter(
      file => file.mimeType !== FOLDER_MIME
    );
    expect(imported.map(file => file.name).sort()).toEqual([
      'foo.erd.json',
      'shop.erd.json',
    ]);
    for (const file of imported) expect(file.parents).toEqual([folder.id]);
    const shop = imported.find(file => file.name === 'shop.erd.json')!;
    expect(tableNames(shop.content)).toEqual(['users']);
    await app.waitForEditor();

    await app.sidebar().getByRole('button', { name: 'Import' }).click();
    const again = app.page.waitForEvent('filechooser');
    await app.page.getByRole('menuitem', { name: 'Import files' }).click();
    await (
      await again
    ).setFiles({
      name: 'bar.erd.json',
      mimeType: 'application/json',
      buffer: Buffer.from(documentWithTable('bar')),
    });
    await expect(
      app.page
        .getByRole('status')
        .filter({ hasText: 'Imported 1 file to Google Drive' })
    ).toBeVisible();
    expect(onlyAppFolder().id).toBe(folder.id);
    expect(google.files.get('created-3')).toMatchObject({
      name: 'bar.erd.json',
      parents: [folder.id],
    });

    // The list Drive gives a new page holds the folder, which the sidebar leaves out.
    await app.page.reload();
    await app.waitForEditor();
    await expect
      .poll(async () => (await app.fileNames()).sort())
      .toEqual(['bar.erd.json', 'foo.erd.json', 'shop.erd.json']);
  });

  test('shows the account, Sign out and the policy links, and links to nothing of /', async ({
    context,
  }) => {
    const app = await signedIn(context);

    await expect(app.sidebar().getByText(ACCOUNT.email)).toBeVisible();
    await expect(
      app.sidebar().getByRole('button', { name: 'Sign out' })
    ).toBeVisible();
    for (const [name, path] of [
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
    ]) {
      const link = app.sidebar().getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', path);
      // A new tab, so following one leaves the open file where it is.
      await expect(link).toHaveAttribute('target', '_blank');
    }
    // The local app's routes; the policy pages may be linked.
    expect(
      await app.page.locator('a[href]').evaluateAll(links =>
        links
          .map(link => new URL((link as HTMLAnchorElement).href))
          .filter(url => url.origin === location.origin)
          .map(url => url.pathname)
          .filter(pathname => pathname === '/' || pathname.startsWith('/live'))
      )
    ).toEqual([]);
  });
});

test.describe('what is never saved', () => {
  test('saves a version 2 file only once edited, as version 3, under its name', async ({
    context,
  }) => {
    google.add({
      id: 'old',
      name: 'legacy.vuerd',
      content: version2Document('users'),
    });
    const app = await signedIn(context);
    await app.openFile('legacy.vuerd');
    await expect
      .poll(async () => tableNames(await app.editorValue()))
      .toEqual(['users']);

    await app.page.waitForTimeout(3500);
    expect(google.patches('old')).toHaveLength(0);

    await app.addTable();
    await expect.poll(() => google.patches('old').length).toBe(1);

    expect(JSON.parse(google.patches('old')[0].body!).version).toBe('3.0.0');
    expect(google.files.get('old')?.name).toBe('legacy.vuerd');
    expect(google.calls('PATCH', '/drive/v3/files/old')).toHaveLength(0);
  });

  test('leaves a file that is not a document, and one it may not edit', async ({
    context,
  }) => {
    google.add({ id: 'foreign', name: 'designer.erd', content: FOREIGN_ERD });
    google.add({
      id: 'viewer',
      name: 'shared.erd',
      content: documentWithTable('users'),
      canEdit: false,
    });
    const app = await signedIn(context);

    await app.fileItem('designer.erd').click();
    await expect(
      app.page.getByText("This file isn't an ERD Editor document")
    ).toBeVisible();
    await expect(app.page.locator('erd-editor')).toHaveCount(0);

    await app.openFile('shared.erd');
    await app.expectSaveState('readonly');
    await expect(app.saveStatus()).toHaveText('View only');
    // Read-only from the start stops nothing, so no banner offers the edits.
    await expect(app.page.getByRole('alert')).toHaveCount(0);
    expect(
      await app.page.evaluate(
        () => (document.querySelector('erd-editor') as any).readonly
      )
    ).toBe(true);
    const menu = await app.fileMenu('shared.erd');
    await expect(
      menu.getByRole('menuitem', { name: 'Rename' })
    ).toHaveAttribute('aria-disabled', 'true');
    await app.page.keyboard.press('Escape');

    await app.page.waitForTimeout(3000);
    expect(google.patches('foreign')).toHaveLength(0);
    expect(google.patches('viewer')).toHaveLength(0);
  });
});
