import type { Download } from '@playwright/test';

import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
  RelationshipType,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// The Schema SQL tab's options panel in the real element: what it opens on,
// the choices this window keeps and the scripts the document saves, where it
// folds away, and the Export path that opens it rather than saving at once.

/** Bare canvas clear of both tables, high enough for the menu to fit. */
const MENU_ORIGIN = { x: 600, y: 60 };

/** A member table and a post table holding its key, in the database named shop. */
const shop = (): ErdDocument =>
  createSchema({
    databaseName: 'shop',
    tables: [
      {
        id: 'member',
        name: 'member',
        x: 160,
        y: 160,
        columns: [
          {
            id: 'member_id',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
            keys: ColumnUIKey.primaryKey,
          },
        ],
      },
      {
        id: 'post',
        name: 'post',
        x: 760,
        y: 420,
        columns: [
          {
            id: 'post_id',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
            keys: ColumnUIKey.primaryKey,
          },
          {
            id: 'post_member_id',
            name: 'member_id',
            dataType: 'INT',
            options: ColumnOption.notNull,
            keys: ColumnUIKey.foreignKey,
          },
        ],
      },
    ],
    relationships: [
      {
        id: 'member_post',
        relationshipType: RelationshipType.OneN,
        startTableId: 'member',
        startColumnIds: ['member_id'],
        endTableId: 'post',
        endColumnIds: ['post_member_id'],
      },
    ],
  });

const panelOf = (erd: ErdEditorPage) =>
  erd.host.locator('aside.schema-sql-options');

/** The code the tab shows, as the code block's field holds it. */
const codeOf = async (erd: ErdEditorPage) =>
  (
    await erd.host
      .getByRole('textbox', { name: 'Code', exact: true })
      .inputValue()
  ).trimStart();

const segment = (erd: ErdEditorPage, group: string, name: string) =>
  panelOf(erd)
    .getByRole('group', { name: group, exact: true })
    .getByRole('button', { name, exact: true });

const showButton = (erd: ErdEditorPage) =>
  erd.host.getByRole('button', { name: 'Show options', exact: true });

const saveButton = (erd: ErdEditorPage) =>
  panelOf(erd).getByRole('button', { name: 'Save file', exact: true });

async function openTab(erd: ErdEditorPage) {
  await erd.toolbarButton('Schema SQL').click();
  await expect(
    erd.host.getByRole('textbox', { name: 'Code', exact: true })
  ).toBeVisible();
}

/** A fresh element in a window this wide, on the shop document. */
async function reopen(erd: ErdEditorPage, width: number) {
  await erd.page.setViewportSize({ width, height: 900 });
  await erd.goto();
  await erd.seed(shop());
}

test.describe('the Schema SQL options panel', () => {
  test('opens beside the code on a wide editor, the code checking first and creating the database', async ({
    erd,
  }) => {
    await reopen(erd, 1280);
    await openTab(erd);

    await expect(panelOf(erd)).toBeVisible();
    await expect(showButton(erd)).toHaveCount(0);
    expect(await codeOf(erd)).toMatch(
      /^CREATE DATABASE IF NOT EXISTS shop;\nUSE shop;\n\nSET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;\n\nCREATE TABLE IF NOT EXISTS member/
    );
    await expect(segment(erd, 'Statements', 'If not exists')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(segment(erd, 'Header', 'CREATE + USE')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('drops and re-creates once asked, warning of the tables, and keeps that until the page reloads', async ({
    erd,
  }) => {
    await erd.seed(shop());
    await openTab(erd);

    await segment(erd, 'Statements', 'Drop & re-create').click();

    await expect(panelOf(erd).getByRole('note')).toHaveText(
      'Drops member and post before creating them. Their rows are lost.'
    );
    expect(await codeOf(erd)).toContain('DROP TABLE IF EXISTS member;');

    await erd.toolbarButton('Entity Relationship Diagram').click();
    await openTab(erd);
    await expect(
      segment(erd, 'Statements', 'Drop & re-create')
    ).toHaveAttribute('aria-pressed', 'true');

    await erd.goto();
    await erd.seed(shop());
    await openTab(erd);
    await expect(segment(erd, 'Statements', 'If not exists')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(await codeOf(erd)).not.toContain('DROP TABLE');
  });

  test('dims what a database lacks and keeps the pick for the next one that has it', async ({
    erd,
  }) => {
    await erd.seed(shop());
    await openTab(erd);
    const database = panelOf(erd).getByRole('combobox', {
      name: 'Database',
      exact: true,
    });

    await database.selectOption({ label: 'Oracle' });

    const ifNotExists = segment(erd, 'Statements', 'If not exists');
    await expect(ifNotExists).toHaveAttribute('aria-disabled', 'true');
    await expect(ifNotExists).toHaveAttribute('title', 'Not in Oracle');
    await expect(segment(erd, 'Statements', 'Create')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect((await erd.settings()).database).toBe(8);

    // A dimmed segment still takes a press, which it ignores.
    await ifNotExists.click({ force: true });
    await expect(segment(erd, 'Statements', 'Create')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await database.selectOption({ label: 'MySQL' });

    await expect(ifNotExists).toHaveAttribute('aria-pressed', 'true');
  });

  test("saves a script in the document as the field loses the focus, which the ERD tab's undo takes back", async ({
    erd,
  }) => {
    await erd.seed(shop());
    await openTab(erd);
    const before = panelOf(erd).getByRole('textbox', {
      name: 'Before tables',
      exact: true,
    });

    await before.click();
    await erd.page.keyboard.type('SET NAMES utf8mb4;');
    expect((await erd.value()).settings.ddlScripts).toBeUndefined();
    await panelOf(erd).getByText('Schema SQL', { exact: true }).click();

    await expect
      .poll(async () => (await erd.value()).settings.ddlScripts)
      .toEqual({ before: 'SET NAMES utf8mb4;', after: '' });
    expect(await codeOf(erd)).toContain('USE shop;\n\nSET NAMES utf8mb4;\n\n');

    await erd.toolbarButton('Entity Relationship Diagram').click();
    await erd.undo();

    await expect
      .poll(async () => (await erd.value()).settings.ddlScripts)
      .toBeUndefined();
    await openTab(erd);
    await expect(before).toHaveValue('');
    expect(await codeOf(erd)).not.toContain('SET NAMES');
  });

  test('starts folded on an editor under 640 px, and stays open once shown', async ({
    erd,
  }) => {
    await reopen(erd, 600);
    await openTab(erd);

    await expect(panelOf(erd)).toHaveCount(0);
    await expect(showButton(erd)).toBeVisible();

    await showButton(erd).click();
    await expect(panelOf(erd)).toBeVisible();
    await expect(
      panelOf(erd).getByRole('button', { name: 'Hide options', exact: true })
    ).toBeFocused();

    await erd.toolbarButton('Entity Relationship Diagram').click();
    await openTab(erd);
    await expect(panelOf(erd)).toBeVisible();
  });

  test('opens from Export rather than saving, Save file focused, which saves the file named after the database', async ({
    erd,
  }) => {
    await erd.seed(shop());
    const downloads: Download[] = [];
    erd.page.on('download', download => downloads.push(download));

    await erd.openContextMenuAt(MENU_ORIGIN.x, MENU_ORIGIN.y);
    await erd.contextMenu.getByText('Export', { exact: true }).hover();
    await erd.contextMenu.getByText('Schema SQL', { exact: true }).click();

    await expect(saveButton(erd)).toBeFocused();
    expect((await erd.settings()).canvasType).toContain('builtin-schema-sql');
    expect(downloads).toEqual([]);

    const download = erd.page.waitForEvent('download');
    await erd.page.keyboard.press('Enter');
    const file = await download;

    expect(file.suggestedFilename()).toMatch(
      /^shop-\d{4}-\d{2}-\d{2}T\d{2}_\d{2}_\d{2}\.sql$/
    );
    expect(downloads).toHaveLength(1);
  });

  test("offers six rows in the code's menu and four in the palette", async ({
    erd,
  }) => {
    await erd.seed(shop());
    await openTab(erd);
    const code = erd.host.getByRole('textbox', { name: 'Code', exact: true });

    await code.click({ button: 'right', position: { x: 200, y: 200 } });
    const rows = erd.contextMenu.first().locator(':scope > div');
    await expect(rows).toHaveText([
      'Database',
      'Bracket',
      'Statements',
      'Header',
      'Options panel',
      'Save file…',
    ]);

    await erd.page.keyboard.press('Escape');
    await expect(erd.contextMenu).toHaveCount(0);
    await erd.focusHost();
    await erd.press(Shortcut.search);
    const palette = erd.host.locator('.quick-search');
    for (const name of [
      'Schema SQL: Statements',
      'Schema SQL: Header',
      'Schema SQL: Options panel',
      'Export: Schema SQL',
    ]) {
      await expect(palette.getByText(name, { exact: true })).toHaveCount(1);
    }
  });

  test("keeps a readonly editor's scripts from typing, the window's statements still its own", async ({
    erd,
  }) => {
    await erd.seed(shop());
    await erd.page.evaluate(() => {
      document.querySelector('erd-editor')!.readonly = true;
    });
    await openTab(erd);
    const before = panelOf(erd).getByRole('textbox', {
      name: 'Before tables',
      exact: true,
    });

    await expect(before).toHaveAttribute('readonly', '');
    await before.click();
    await erd.page.keyboard.type('SET x = 1;');
    await expect(before).toHaveValue('');

    await segment(erd, 'Statements', 'Create').click();
    await expect(segment(erd, 'Statements', 'Create')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(await codeOf(erd)).toContain('CREATE TABLE member');
  });
});
