import type { ErdEditorPage, Point } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { twoTables } from '../support/schema';

// A readonly editor on the served page, turned through the element's attribute
// as a host's markup turns it: the edit UI it leaves out and gives back, the
// pan a press makes, and the two tabs that keep a reader's choices to itself.

/** The settings' number for the language the seed's document is written in. */
const Language = { GraphQL: 1 } as const;

/** The digits toBeCloseTo keeps for a pan: half a pixel, as the store lands one in floating point. */
const HALF_PIXEL = 0;

/** One screen pixel of pointer rounding, doubled for the two ends of a drag. */
const PIXEL_TOLERANCE = 2;

/** The floating toolbar's editing tools, which a readonly editor leaves out, each titled with its chord. */
const EDIT_TOOLS = [
  'Hand',
  'Select',
  'New Table',
  'New Memo',
  'New Table Group',
  'Zero One',
  'Zero N',
  'One Only',
  'One N',
];

/** Turns the element readonly or writable through its attribute. */
const setReadonly = (erd: ErdEditorPage, readonly: boolean) =>
  erd.page.evaluate(value => {
    const editor = window.document.querySelector('erd-editor');
    if (!editor) throw new Error('erd-editor is not mounted');
    if (value) editor.setAttribute('readonly', '');
    else editor.removeAttribute('readonly');
  }, readonly);

/** The document the element saves, its file form. */
const savedValue = async (erd: ErdEditorPage) =>
  JSON.parse(
    await erd.page.evaluate(
      () => window.document.querySelector('erd-editor')!.value
    )
  );

/** A tool by its whole name, since New Table's title starts New Table Group's. */
const tool = (erd: ErdEditorPage, name: string) =>
  erd.floatingToolbar.locator(`[title^="${name} ("]`);

const editOverlay = (erd: ErdEditorPage) => erd.host.locator('.edit-overlay');

/** Where the scene draws its origin on the page, which a pan moves. */
const originOnPage = (erd: ErdEditorPage) => erd.pointAt(0, 0);

async function expectEditTools(erd: ErdEditorPage, count: 0 | 1) {
  for (const name of EDIT_TOOLS) {
    await expect(tool(erd, name), name).toHaveCount(count);
  }
}

/** Opens the menu at a point, checks the rows it holds and those it leaves out, and closes it. */
async function expectMenuAt(
  erd: ErdEditorPage,
  point: Point,
  rows: { shown: string[]; absent: string[] }
) {
  await erd.clickAt(point, { button: 'right' });
  for (const row of rows.shown) {
    await expect(erd.contextMenuItem(row), row).toBeVisible();
  }
  for (const row of rows.absent) {
    await expect(erd.contextMenuItem(row), row).toHaveCount(0);
  }
  await erd.press('Escape');
  await expect(erd.contextMenu).toHaveCount(0);
}

test.describe('a readonly editor', () => {
  test('leaves out the edit UI and pans for a drag that starts on a table, and edits again once writable', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await expect(editOverlay(erd)).toHaveCount(1);
    await expectEditTools(erd, 1);

    await setReadonly(erd, true);
    await expect(editOverlay(erd)).toHaveCount(0);
    await expectEditTools(erd, 0);
    await expect(tool(erd, 'Zen Mode')).toHaveCount(1);

    await erd.focusHost();
    await expectMenuAt(erd, await erd.emptyPoint(), {
      shown: ['Export', 'View Option'],
      absent: ['New Table', 'Import'],
    });
    await expectMenuAt(erd, await erd.tableHeaderPoint('users'), {
      shown: ['Table Properties'],
      absent: ['Primary Key', 'Delete'],
    });

    const origin = await originOnPage(erd);
    const from = await erd.tableHeaderPoint('users');
    await erd.drag(from, { x: from.x + 120, y: from.y + 60 });
    await expect
      .poll(async () => {
        const { x, y } = await originOnPage(erd);
        return [x - origin.x, y - origin.y];
      })
      .toEqual([
        expect.closeTo(120, HALF_PIXEL),
        expect.closeTo(60, HALF_PIXEL),
      ]);
    const users = await erd.table('users');
    expect([users.ui.x, users.ui.y]).toEqual([160, 160]);
    await expect(erd.selectedTables()).toHaveCount(0);

    await setReadonly(erd, false);
    await expect(editOverlay(erd)).toHaveCount(1);
    await expectEditTools(erd, 1);

    await erd.moveTable('users', 120, 60);
    await expect(erd.tableEl('users')).toHaveAttribute('data-selected', '');
    await expect
      .poll(async () => {
        const { ui } = await erd.table('users');
        return Math.max(Math.abs(ui.x - 280), Math.abs(ui.y - 220));
      })
      .toBeLessThanOrEqual(PIXEL_TOLERANCE);

    await erd.focusHost();
    await expectMenuAt(erd, await erd.emptyPoint(), {
      shown: ['New Table', 'Import'],
      absent: [],
    });
    await expectMenuAt(erd, await erd.tableHeaderPoint('users'), {
      shown: ['Primary Key', 'Table Properties'],
      absent: [],
    });
  });

  test('shows its Settings tab as a display, and as controls once writable', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await setReadonly(erd, true);
    await erd.toolbarButton('Settings').click();

    const badge = erd.host.getByText('Read only', { exact: true });
    const switches = erd.host.getByRole('switch');
    const locks = erd.host.locator(
      'button[title^="Lock "], button[title^="Unlock "]'
    );
    // The column order's rows, which only a writable editor lets a press drag.
    const orderRows = erd.host.locator('[draggable="true"][data-id]');
    await expect(badge).toBeVisible();
    await expect(switches).toHaveCount(2);
    await expect(locks).toHaveCount(7);
    for (const control of [...(await switches.all()), ...(await locks.all())]) {
      await expect(control).toBeDisabled();
    }
    await expect(orderRows).toHaveCount(0);

    await setReadonly(erd, false);
    await expect(badge).toHaveCount(0);
    for (const control of [...(await switches.all()), ...(await locks.all())]) {
      await expect(control).toBeEnabled();
    }
    await expect(orderRows.first()).toBeVisible();
  });

  test("turns the Code Generator's language on this screen alone, the saved document keeping its own", async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await setReadonly(erd, true);
    await erd.toolbarButton('Code Generator').click();

    const panel = erd.host.locator('aside.generator-code-options');
    const language = panel.getByRole('combobox', {
      name: 'Language',
      exact: true,
    });
    const code = erd.host.getByRole('textbox', { name: 'Code', exact: true });
    await expect(language).toHaveValue(String(Language.GraphQL));
    await expect.poll(async () => code.inputValue()).toContain('type Users {');

    await language.selectOption({ label: 'TypeScript' });
    await expect
      .poll(async () => code.inputValue())
      .toContain('export interface Users {');
    expect((await savedValue(erd)).settings.language).toBe(Language.GraphQL);

    // Turned writable, the screen takes the document's language back.
    await setReadonly(erd, false);
    await expect(language).toHaveValue(String(Language.GraphQL));
    await expect.poll(async () => code.inputValue()).toContain('type Users {');
    expect((await savedValue(erd)).settings.language).toBe(Language.GraphQL);
  });
});
