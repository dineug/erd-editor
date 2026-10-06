import type { Locator } from '@playwright/test';

import type { ErdEditorPage, Point } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema, twoTables } from '../support/schema';
import { MOD_KEY, Shortcut } from '../support/shortcuts';

// The welcome screen an empty diagram shows once a host turns it on: the menu
// that starts a document, the pointer it lets through to the canvas, where it
// steps aside, and the hints that point at the tools and turn round with RTL.

/** How far off its button an arrow's tip may land, for the stroke's rounding. */
const TIP_TOLERANCE = 2;

const welcome = (erd: ErdEditorPage) => erd.host.locator('.welcome-screen');

const row = (erd: ErdEditorPage, label: string) =>
  erd.host.locator('.welcome-screen-item', {
    has: erd.page.locator('span', { hasText: new RegExp(`^${label}$`) }),
  });

const hint = (erd: ErdEditorPage, name: string) =>
  erd.host.locator(`.welcome-screen-hint-${name}`);

async function centerOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('the element is not laid out');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Where an arrow's shaft ends on the page, which is its tip. */
const tipOf = (hint: Locator) =>
  hint
    .locator('.welcome-screen-arrow path')
    .first()
    .evaluate((shaft: SVGPathElement) => {
      const end = shaft.getPointAtLength(shaft.getTotalLength());
      const point = new DOMPoint(end.x, end.y).matrixTransform(
        shaft.getScreenCTM()!
      );
      return { x: point.x, y: point.y };
    });

/** Where the scene's origin stands on the page, which a pan moves and a zoom keeps. */
const sceneScale = async (erd: ErdEditorPage) => {
  const origin = await erd.pointAt(0, 0);
  const across = await erd.pointAt(100, 0);
  return (across.x - origin.x) / 100;
};

test.describe('the welcome screen', () => {
  test('stays off until the host turns it on, then stands over the empty document', async ({
    erd,
  }) => {
    await expect(welcome(erd)).toHaveCount(0);

    await erd.enable({ enableWelcomeScreen: true });

    await expect(welcome(erd)).toHaveCount(1);
    await expect(erd.host.locator('.welcome-screen-heading')).toHaveText(
      'Right-click the canvas for every action.'
    );
    await expect(erd.host.locator('.welcome-screen-item')).toHaveCount(5);
    await expect(hint(erd, 'palette')).toBeVisible();
    await expect(hint(erd, 'tools')).toBeVisible();
    await expect(hint(erd, 'preferences')).toHaveCount(0);
  });

  test('adds a table from New Table, goes with it and comes back on the undo', async ({
    erd,
  }) => {
    await erd.enable({ enableWelcomeScreen: true });

    await row(erd, 'New Table').click();

    await expect.poll(() => erd.tableIds()).toHaveLength(1);
    const [id] = await erd.tableIds();
    await expect(erd.tableEl(id)).toHaveCount(1);
    await expect(welcome(erd)).toHaveCount(0);
    await erd.expectKeyboardFocusInside();

    await erd.undo();

    await expect.poll(() => erd.tableIds()).toEqual([]);
    await expect(welcome(erd)).toHaveCount(1);
  });

  test('lets a drag over the heading pan and a modifier wheel over a row zoom', async ({
    erd,
  }) => {
    // An empty document with its view unlocked, so the value reports the pan.
    await erd.seed(createSchema({ originX: 0, originY: 0 }));
    await erd.enable({ enableWelcomeScreen: true });
    await expect(welcome(erd)).toHaveCount(1);

    const from = await centerOf(erd.host.locator('.welcome-screen-heading'));
    await erd.drag(from, { x: from.x - 120, y: from.y - 80 });

    await expect
      .poll(async () => {
        const { originX, originY } = await erd.settings();
        return Math.max(Math.abs(originX + 120), Math.abs(originY + 80));
      })
      .toBeLessThanOrEqual(1);

    const before = await sceneScale(erd);
    const over = await centerOf(row(erd, 'New Memo'));
    await erd.page.mouse.move(over.x, over.y);
    await erd.page.keyboard.down(MOD_KEY);
    await erd.page.mouse.wheel(0, -100);
    await erd.page.keyboard.up(MOD_KEY);

    await expect.poll(() => sceneScale(erd)).toBeGreaterThan(before);
    expect(await erd.memoIds()).toEqual([]);
  });

  test('imports a json file from the formats Import swaps in, then steps aside', async ({
    erd,
  }) => {
    await erd.enable({ enableWelcomeScreen: true });

    await row(erd, 'Import').click();
    await expect(row(erd, 'Back')).toBeFocused();
    await expect(erd.host.locator('.welcome-screen-item')).toHaveCount(6);

    const chooser = erd.page.waitForEvent('filechooser');
    await row(erd, 'json').click();
    await (
      await chooser
    ).setFiles({
      name: 'two-tables.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(twoTables())),
    });

    await expect.poll(() => erd.tableIds()).toEqual(twoTables().doc.tableIds);
    await expect(welcome(erd)).toHaveCount(0);

    // The load took the focused Import row away; the keyboard stays with the editor.
    await erd.expectKeyboardFocusInside();
    await erd.press(Shortcut.addTable);
    await expect.poll(() => erd.tableIds()).toHaveLength(3);
  });

  test('keeps the keyboard in the editor when a chord on a focused row adds the first table', async ({
    erd,
  }) => {
    await erd.enable({ enableWelcomeScreen: true });
    await row(erd, 'Import').focus();

    await erd.press(Shortcut.addTable);
    await expect.poll(() => erd.tableIds()).toHaveLength(1);
    await expect(welcome(erd)).toHaveCount(0);
    await erd.expectKeyboardFocusInside();

    await erd.press(Shortcut.addTable);
    await expect.poll(() => erd.tableIds()).toHaveLength(2);
  });

  test('goes back from the formats on Escape, and on Back', async ({ erd }) => {
    await erd.enable({ enableWelcomeScreen: true });

    await row(erd, 'Import').click();
    await expect(row(erd, 'Back')).toBeFocused();
    await erd.press(Shortcut.stop);

    await expect(row(erd, 'Import')).toBeFocused();
    await expect(erd.host.locator('.welcome-screen-item')).toHaveCount(5);

    await row(erd, 'Import').click();
    await row(erd, 'Back').click();
    await expect(row(erd, 'Import')).toBeFocused();
  });

  test('opens the command palette and the Shortcuts page of the Settings tab', async ({
    erd,
  }) => {
    await erd.enable({ enableWelcomeScreen: true });

    await row(erd, 'Command Palette').click();
    await expect(erd.host.locator('.quick-search')).toBeVisible();
    await erd.press(Shortcut.stop);
    await expect(erd.host.locator('.quick-search')).toHaveCount(0);

    // A new document locks its tab, so the value keeps naming the ERD tab
    // while the screen shows Settings; the page is what is asserted.
    await row(erd, 'Shortcuts').click();
    await expect(
      erd.host.getByRole('columnheader', { name: 'Keybinding' })
    ).toBeVisible();
    await expect(welcome(erd)).toHaveCount(0);
  });

  test('steps aside in a read-only editor and in zen mode', async ({ erd }) => {
    await erd.enable({ enableWelcomeScreen: true });
    await expect(welcome(erd)).toHaveCount(1);

    await erd.page.evaluate(() => {
      window.document.querySelector('erd-editor')!.readonly = true;
    });
    await expect(welcome(erd)).toHaveCount(0);

    await erd.page.evaluate(() => {
      window.document.querySelector('erd-editor')!.readonly = false;
    });
    await expect(welcome(erd)).toHaveCount(1);

    await erd.focusHost();
    await erd.press(Shortcut.zenMode);
    await expect(welcome(erd)).toHaveCount(0);
  });

  test('keeps the menu and drops the hints on a small screen', async ({
    erd,
  }) => {
    await erd.page.setViewportSize({ width: 700, height: 500 });
    await erd.enable({ enableWelcomeScreen: true });

    await expect(erd.host.locator('.welcome-screen-menu')).toBeVisible();
    await expect(erd.host.locator('.welcome-screen-hint')).toHaveCount(0);
  });

  for (const locale of ['en', 'ar-SA'] as const) {
    test(`lands each toolbar arrow on its button in ${locale}, the labels on the side the text starts`, async ({
      erd,
    }) => {
      await erd.setLocale(locale);
      await erd.enable({
        enableWelcomeScreen: true,
        enableThemeBuilder: true,
        enableLocalePicker: true,
      });
      await expect(hint(erd, 'preferences')).toBeVisible();

      const search = await centerOf(erd.host.locator('.toolbar-search'));
      const theme = await centerOf(erd.host.locator('.toolbar-theme'));
      const language = await centerOf(erd.host.locator('.toolbar-locale'));
      const palette = await tipOf(hint(erd, 'palette'));
      const preferences = await tipOf(hint(erd, 'preferences'));

      expect(Math.abs(palette.x - search.x)).toBeLessThanOrEqual(TIP_TOLERANCE);
      expect(
        Math.abs(preferences.x - (theme.x + language.x) / 2)
      ).toBeLessThanOrEqual(TIP_TOLERANCE);

      const paletteLabel = await hint(erd, 'palette')
        .locator('span')
        .boundingBox();
      const paletteArrow = await hint(erd, 'palette')
        .locator('svg')
        .boundingBox();
      const labelLeftOfArrow = paletteLabel!.x < paletteArrow!.x;

      // The palette's label sits where the text starts: left in English,
      // right in Arabic, with Search on the other side of the bar.
      expect(labelLeftOfArrow).toBe(locale === 'en');
      expect(search.x < theme.x).toBe(locale === 'en');
    });
  }
});
