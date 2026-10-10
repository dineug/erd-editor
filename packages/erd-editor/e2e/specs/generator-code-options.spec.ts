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

// The Code Generator tab's options panel in the real element: where it opens
// and folds away, the settings it changes and the code written again from
// them, and the file Save file names after the database and the language.

/** The settings' numbers for what the specs pick by name. */
const Language = { Zod: 1048576 } as const;
const Database = { MySQL: 4, SQLite: 32 } as const;

/** A member table and a post table holding its key and a price, in the database named shop. */
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
          {
            id: 'post_price',
            name: 'price',
            dataType: 'DECIMAL(10,2)',
            options: ColumnOption.notNull,
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
  erd.host.locator('aside.generator-code-options');

const codeBox = (erd: ErdEditorPage) =>
  erd.host.getByRole('textbox', { name: 'Code', exact: true });

/** The code the tab shows, as the code block's field holds it. */
const codeOf = async (erd: ErdEditorPage) =>
  (await codeBox(erd).inputValue()).trimStart();

const setting = (erd: ErdEditorPage, name: string) =>
  panelOf(erd).getByRole('combobox', { name, exact: true });

const showButton = (erd: ErdEditorPage) =>
  erd.host.getByRole('button', { name: 'Show options', exact: true });

const hideButton = (erd: ErdEditorPage) =>
  panelOf(erd).getByRole('button', { name: 'Hide options', exact: true });

/** The file name every export writes: the database's name, the time, the extension. */
const fileNamed = (extension: string) =>
  new RegExp(`^shop-\\d{4}-\\d{2}-\\d{2}T\\d{2}_\\d{2}_\\d{2}\\.${extension}$`);

async function openTab(erd: ErdEditorPage) {
  await erd.toolbarButton('Code Generator').click();
  await expect(codeBox(erd)).toBeVisible();
}

/** A fresh element in a window this wide, on the shop document. */
async function reopen(erd: ErdEditorPage, width: number) {
  await erd.page.setViewportSize({ width, height: 900 });
  await erd.goto();
  await erd.seed(shop());
}

test.describe('the Code Generator options panel', () => {
  test('opens beside the code on a wide editor, folds behind Show options and stays as set across tabs', async ({
    erd,
  }) => {
    await reopen(erd, 1280);
    await openTab(erd);

    await expect(panelOf(erd)).toBeVisible();
    await expect(showButton(erd)).toHaveCount(0);
    await expect(setting(erd, 'Language')).toHaveValue('1');
    expect(await codeOf(erd)).toMatch(/^scalar Decimal\n\ntype Member \{/);

    await hideButton(erd).click();
    await expect(panelOf(erd)).toHaveCount(0);
    await expect(showButton(erd)).toBeFocused();

    await erd.toolbarButton('Entity Relationship Diagram').click();
    await openTab(erd);
    await expect(panelOf(erd)).toHaveCount(0);

    await showButton(erd).click();
    await expect(panelOf(erd)).toBeVisible();
    await expect(hideButton(erd)).toBeFocused();
  });

  test('starts folded on an editor under 640 px, apart from the Schema SQL panel', async ({
    erd,
  }) => {
    await reopen(erd, 600);
    await openTab(erd);

    await expect(panelOf(erd)).toHaveCount(0);
    await expect(showButton(erd)).toBeVisible();

    await showButton(erd).click();
    await expect(panelOf(erd)).toBeVisible();

    await erd.toolbarButton('Schema SQL').click();
    await expect(erd.host.locator('aside.schema-sql-options')).toHaveCount(0);
    await expect(showButton(erd)).toBeVisible();
  });

  test('writes the code again for a new language or database, offering only the settings the language reads', async ({
    erd,
  }) => {
    await erd.seed(shop());
    await openTab(erd);

    await setting(erd, 'Language').selectOption({ label: 'TypeScript' });
    await expect.poll(() => codeOf(erd)).toMatch(/^export interface Member \{/);
    await expect(setting(erd, 'Bracket')).toHaveCount(0);

    await setting(erd, 'Language').selectOption({ label: 'Zod' });
    await expect.poll(() => codeOf(erd)).toContain('price: z.string(),');
    expect((await erd.settings()).language).toBe(Language.Zod);

    // SQLite's NUMERIC affinity stores a decimal as a number, which its JSON
    // then carries, so only the database tells the two schemas apart.
    await setting(erd, 'Database').selectOption({ label: 'SQLite' });
    await expect.poll(() => codeOf(erd)).toContain('price: z.number(),');
    expect((await erd.settings()).database).toBe(Database.SQLite);

    await setting(erd, 'Database').selectOption({ label: 'MySQL' });
    await expect.poll(() => codeOf(erd)).toContain('price: z.string(),');
    expect((await erd.settings()).database).toBe(Database.MySQL);

    await setting(erd, 'Language').selectOption({ label: 'Doctrine' });
    await expect(setting(erd, 'Bracket')).toBeVisible();

    await setting(erd, 'Language').selectOption({ label: 'JPA' });
    await expect.poll(() => codeOf(erd)).toContain('@Entity');
    await expect(setting(erd, 'Bracket')).toBeVisible();

    await setting(erd, 'Language').selectOption({ label: 'Mermaid' });
    await expect.poll(() => codeOf(erd)).toMatch(/^erDiagram/);
    await expect(
      panelOf(erd).getByText('Not used by Mermaid', { exact: true })
    ).toHaveCount(2);
    await expect(setting(erd, 'Database')).toHaveAttribute(
      'aria-describedby',
      'generator-code-database-unused'
    );
  });

  test("saves the code under the database's name with its language's extension, from the panel and the code's menu", async ({
    erd,
  }) => {
    await erd.seed(shop());
    await openTab(erd);
    const downloads: Download[] = [];
    erd.page.on('download', download => downloads.push(download));

    await setting(erd, 'Language').selectOption({ label: 'Swift' });
    await expect.poll(() => codeOf(erd)).toMatch(/^import Foundation/);

    const fromPanel = erd.page.waitForEvent('download');
    await panelOf(erd)
      .getByRole('button', { name: 'Save file', exact: true })
      .click();
    expect((await fromPanel).suggestedFilename()).toMatch(fileNamed('swift'));

    await setting(erd, 'Language').selectOption({ label: 'JSON Schema' });
    await expect.poll(() => codeOf(erd)).toMatch(/^\{\n {2}"\$schema"/);

    await codeBox(erd).click({ button: 'right', position: { x: 200, y: 200 } });
    const rows = erd.contextMenu.first().locator(':scope > div');
    await expect(rows).toHaveText([
      'Language',
      'Database',
      'Table Name Case',
      'Column Name Case',
      'Options panel',
      'Save file…',
    ]);

    const fromMenu = erd.page.waitForEvent('download');
    await erd.contextMenu.getByText('Save file…', { exact: true }).click();
    expect((await fromMenu).suggestedFilename()).toMatch(fileNamed('json'));
    expect(downloads).toHaveLength(2);
  });
});
