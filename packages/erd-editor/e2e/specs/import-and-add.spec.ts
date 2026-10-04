import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { Shortcut } from '../support/shortcuts';
import { createSchema, type ErdDocument, twoTables } from '../support/schema';

// Import and Add from the outside: the menu that asks for a file, the block it
// lands below the diagram, the tables it leaves alone and the one undo that
// takes it back. It reads the built package, as the placement spec does.

/** Bare canvas clear of both seeded tables, high enough for the menu to fit. */
const MENU_ORIGIN = { x: 500, y: 60 };

/** ELK is megabytes of script the worker parses before it answers anything. */
const PLACEMENT_TIMEOUT = 45_000;

/** A fan, one parent and two children, which Flow stands in two layers. */
const FAN_SQL = `
CREATE TABLE users (id INT NOT NULL, PRIMARY KEY (id));
CREATE TABLE posts (
  id INT NOT NULL,
  user_id INT,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE TABLE photos (
  id INT NOT NULL,
  user_id INT,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);
`;

/** Two tables 600 apart and a memo under them, its database named theirs. */
const accounts = (): ErdDocument =>
  createSchema({
    databaseName: 'theirs',
    tables: [
      { id: 'accounts', name: 'accounts', x: 40, y: 40, columns: [] },
      { id: 'roles', name: 'roles', x: 640, y: 40, columns: [] },
    ],
    memos: [{ id: 'note', value: 'added', x: 40, y: 400 }],
  });

async function importAndAdd(
  erd: ErdEditorPage,
  format: string,
  file: { name: string; mimeType: string; text: string }
) {
  await erd.openContextMenuAt(MENU_ORIGIN.x, MENU_ORIGIN.y);
  await erd.contextMenu.getByText('Import and Add', { exact: true }).hover();

  const item = erd.contextMenu.getByText(format, { exact: true });
  await expect(item).toBeVisible();
  const chooser = erd.page.waitForEvent('filechooser');
  await item.click();
  await (
    await chooser
  ).setFiles({
    name: file.name,
    mimeType: file.mimeType,
    buffer: Buffer.from(file.text),
  });
}

/** Each table the document holds by name, with its corner. */
async function cornersByName(erd: ErdEditorPage) {
  const { doc, collections } = await erd.value();

  return Object.fromEntries(
    doc.tableIds.map(id => {
      const table = collections.tableEntities[id];
      return [table.name, { id, x: table.ui.x, y: table.ui.y }];
    })
  );
}

/** The tables the scene draws selected, read off each card's own attr. */
const selectedIdsOf = (erd: ErdEditorPage) =>
  erd.page.evaluate(() => {
    const stage: any = Reflect.get(window, '__erdStages')?.canvas;
    return (stage?.find('.table') ?? [])
      .filter((node: any) => node.getAttr('selected'))
      .map((node: any) => node.id().replace('table-', ''))
      .sort() as string[];
  });

/** One table low on the screen, so a block added below it lands out of sight. */
const lowTable = (): ErdDocument =>
  createSchema({
    tables: [{ id: 'base', name: 'base', x: 160, y: 760, columns: [] }],
  });

/** The tabs besides a Flow view the owner named for an append, and how to open each. */
const OTHER_TABS: Array<[string, (erd: ErdEditorPage) => Promise<void>]> = [
  [
    'Graph mode',
    async erd => {
      await erd.toolbarButton('Visualization').click();
      await erd.host.locator('.visualization-toolbar [title="Graph"]').click();
      await expect(
        erd.host.locator('.visualization-toolbar [title="Graph"].active')
      ).toBeVisible();
    },
  ],
  ['Schema SQL', erd => erd.toolbarButton('Schema SQL').click()],
  ['Code Generator', erd => erd.toolbarButton('Code Generator').click()],
];

/** Whether the scene draws the table whole inside the canvas. */
async function isOnScreen(erd: ErdEditorPage, id: string) {
  const canvas = await erd.host
    .locator('[data-testid="erd-canvas"]')
    .boundingBox();
  const box = await erd.sceneBox(`#table-${id}`);
  return (
    canvas !== null &&
    box.x >= canvas.x &&
    box.y >= canvas.y &&
    box.x + box.width <= canvas.x + canvas.width &&
    box.y + box.height <= canvas.y + canvas.height
  );
}

test.describe('Import and Add', () => {
  test('adds an SQL file below the diagram, placed by Flow and selected, and one undo takes it away', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    const before = await erd.value();

    await importAndAdd(erd, 'Schema SQL', {
      name: 'fan.sql',
      mimeType: 'application/sql',
      text: FAN_SQL,
    });
    await expect
      .poll(async () => (await erd.tableIds()).length, {
        timeout: PLACEMENT_TIMEOUT,
      })
      .toBe(5);

    // The file names two of its tables as the diagram already does, and both
    // pairs stay, as a paste would leave them.
    const { doc, collections } = await erd.value();
    const added = doc.tableIds
      .filter(id => !before.doc.tableIds.includes(id))
      .map(id => collections.tableEntities[id]);
    const at = Object.fromEntries(added.map(({ name, ui }) => [name, ui]));
    const seeded = Object.values(before.collections.tableEntities);
    expect(Object.keys(at).sort()).toEqual(['photos', 'posts', 'users']);
    expect(Math.min(...added.map(({ ui }) => ui.y))).toBeGreaterThan(
      Math.max(...seeded.map(({ ui }) => ui.y))
    );
    expect(Math.min(...added.map(({ ui }) => ui.x))).toBe(
      Math.min(...seeded.map(({ ui }) => ui.x))
    );
    expect(at.posts.x).toBeGreaterThan(at.users.x);
    expect(at.photos.x).toBe(at.posts.x);
    expect((await erd.table('users')).ui).toMatchObject({ x: 160, y: 160 });
    expect((await erd.table('posts')).ui).toMatchObject({ x: 760, y: 420 });
    await expect
      .poll(() => selectedIdsOf(erd))
      .toEqual(added.map(({ id }) => id).sort());

    await erd.press(Shortcut.undo);

    await expect.poll(() => erd.tableIds()).toEqual(['users', 'posts']);
    expect((await erd.value()).doc).toEqual(before.doc);
  });

  test('adds a json document as new tables and memos apart as the file has them, its settings left out', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    await importAndAdd(erd, 'json', {
      name: 'accounts.json',
      mimeType: 'application/json',
      text: JSON.stringify(accounts()),
    });
    await expect.poll(async () => (await erd.tableIds()).length).toBe(4);

    const { doc, collections, settings } = await erd.value();
    const corners = await cornersByName(erd);
    const memo = collections.memoEntities[doc.memoIds[0]];
    expect(settings.databaseName).toBe('e2e');
    expect(corners.accounts.id).not.toBe('accounts');
    expect(corners.roles.x - corners.accounts.x).toBe(600);
    expect(corners.roles.y).toBe(corners.accounts.y);
    expect(memo.value).toBe('added');
    expect(memo.ui.y - corners.accounts.y).toBe(360);
  });

  test('brings the ERD tab up from a Flow view before it adds', async ({
    erd,
  }) => {
    test.setTimeout(120_000);
    await erd.seed(twoTables());
    await erd.toolbarButton('Visualization').click();
    await erd.host.locator('.visualization-toolbar [title="Flow"]').click();
    await expect(
      erd.host.locator('.visualization-toolbar [title="Tidy Up"]')
    ).toBeVisible({ timeout: PLACEMENT_TIMEOUT });

    await erd.page.evaluate(() => {
      const editor = window.document.querySelector('erd-editor');
      if (!editor) throw new Error('erd-editor is not mounted');
      editor.setSchemaSQL('CREATE TABLE tags (id INT);', { mode: 'append' });
    });

    expect((await erd.settings()).canvasType).toBe('ERD');
    expect(Object.keys(await cornersByName(erd)).sort()).toEqual([
      'posts',
      'tags',
      'users',
    ]);
  });

  for (const [tab, open] of OTHER_TABS) {
    test(`brings the ERD tab up from ${tab}, the added table selected and on screen`, async ({
      erd,
    }) => {
      await erd.seed(lowTable());
      const { originY } = await erd.settings();
      await open(erd);
      expect((await erd.settings()).canvasType).not.toBe('ERD');

      await erd.page.evaluate(() => {
        const editor = window.document.querySelector('erd-editor');
        if (!editor) throw new Error('erd-editor is not mounted');
        editor.setSchemaSQL('CREATE TABLE tags (id INT);', { mode: 'append' });
      });

      const settings = await erd.settings();
      const { tags } = await cornersByName(erd);
      expect(settings.canvasType).toBe('ERD');
      expect(settings.originY).not.toBe(originY);
      await expect.poll(() => selectedIdsOf(erd)).toEqual([tags.id]);
      await expect.poll(() => isOnScreen(erd, tags.id)).toBe(true);
    });
  }

  test('offers no Import and Add in a read-only editor, in the palette or the menu', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());
    await page.evaluate(() => {
      document.querySelector('erd-editor')!.readonly = true;
    });

    await erd.focusHost();
    await erd.press(Shortcut.search);
    const palette = erd.host.locator('.quick-search');
    await expect(palette).toContainText('Import');
    await expect(palette).not.toContainText('Import and Add');
    await erd.press('Escape');
    await expect(palette).toHaveCount(0);

    await erd.openContextMenuAt(MENU_ORIGIN.x, MENU_ORIGIN.y);
    await expect(
      erd.contextMenu.getByText('Import', { exact: true })
    ).toBeVisible();
    await expect(
      erd.contextMenu.getByText('Import and Add', { exact: true })
    ).toHaveCount(0);
  });
});
