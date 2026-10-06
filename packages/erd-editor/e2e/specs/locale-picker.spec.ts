import type { Page } from '@playwright/test';

import { koKR } from '../../src/i18n/messages/ko-KR';
import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { Shortcut } from '../support/shortcuts';

// The display language in the real element: the toolbar's language button and
// its panel, the palette's Display Language and Theme, the event a host saves
// on, and a right-to-left language laid out around a canvas that stays LTR.

/** The element's events of one kind, in the order they fired. */
async function recordEvents(page: Page, type: string) {
  await page.evaluate(eventType => {
    const events: unknown[] = [];
    Reflect.set(window, `__${eventType}`, events);
    window.document
      .querySelector('erd-editor')!
      .addEventListener(eventType, event =>
        events.push((event as CustomEvent).detail)
      );
  }, type);

  return () =>
    page.evaluate(eventType => Reflect.get(window, `__${eventType}`), type);
}

const pickerOf = (erd: ErdEditorPage) => erd.host.locator('.locale-picker');
const rowOf = (erd: ErdEditorPage, option: string) =>
  pickerOf(erd).locator(`button[role="option"][data-locale="${option}"]`);
const rootOf = (erd: ErdEditorPage) => erd.host.locator('.root');
const searchTitleOf = (erd: ErdEditorPage) =>
  erd.toolbar.locator('.toolbar-search').getAttribute('title');

async function openPicker(erd: ErdEditorPage) {
  await erd.toolbar.locator('.toolbar-locale').click();
  await expect(pickerOf(erd)).toBeVisible();
}

async function pick(erd: ErdEditorPage, option: string) {
  await openPicker(erd);
  await rowOf(erd, option).click();
  await expect(pickerOf(erd)).toHaveCount(0);
}

test.describe('locale picker', () => {
  test('shows no language button while the element leaves the picker off', async ({
    erd,
  }) => {
    await expect(erd.toolbar.locator('.toolbar-locale')).toHaveCount(0);
    await expect(rootOf(erd)).toHaveAttribute('lang', 'en');
  });

  test('opens from the toolbar on System and 25 languages, System checked', async ({
    erd,
  }) => {
    await erd.enable({ enableLocalePicker: true });
    await openPicker(erd);

    const rows = pickerOf(erd).locator('button[role="option"]');
    await expect(rows).toHaveCount(26);
    await expect(rows.first()).toHaveAttribute('data-locale', 'system');
    await expect(rowOf(erd, 'system')).toHaveAttribute('aria-selected', 'true');
    await expect(rowOf(erd, 'system')).toBeFocused();
    await expect(rowOf(erd, 'ko-KR')).toHaveText('한국어');
  });

  test('switches to Korean on 한국어, telling the host, and hands the keyboard back', async ({
    erd,
    page,
  }) => {
    await erd.enable({ enableLocalePicker: true });
    const changes = await recordEvents(page, 'changeLocale');

    await openPicker(erd);
    await pickerOf(erd).getByText('한국어', { exact: true }).click();

    await expect(pickerOf(erd)).toHaveCount(0);
    await expect(rootOf(erd)).toHaveAttribute('lang', 'ko-KR');
    await expect(rootOf(erd)).toHaveAttribute('dir', 'ltr');
    const search = koKR['common.search'];
    await expect
      .poll(async () => (await searchTitleOf(erd))?.slice(0, search.length))
      .toBe(search);
    expect(await changes()).toEqual([{ locale: 'ko-KR' }]);
    await erd.expectKeyboardFocusInside();

    await openPicker(erd);
    await expect(rowOf(erd, 'ko-KR')).toHaveAttribute('aria-selected', 'true');
  });

  test('lays the editor out right to left in Arabic, the canvas staying left to right', async ({
    erd,
  }) => {
    await erd.enable({ enableLocalePicker: true });
    await pick(erd, 'ar-SA');

    await expect(rootOf(erd)).toHaveAttribute('lang', 'ar-SA');
    await expect(rootOf(erd)).toHaveAttribute('dir', 'rtl');

    const search = await erd.toolbar.locator('.toolbar-search').boundingBox();
    const find = await erd.toolbar
      .locator('.toolbar-search + div')
      .boundingBox();
    expect(search!.x).toBeGreaterThan(find!.x);

    const stage = erd.host.locator('[data-testid="erd-canvas"] canvas').first();
    expect(
      await stage.evaluate(canvas => getComputedStyle(canvas).direction)
    ).toBe('ltr');

    // The panel hangs from the side a line starts from, the right here.
    await openPicker(erd);
    const root = await rootOf(erd).boundingBox();
    const panel = await pickerOf(erd).boundingBox();
    expect(root!.x + root!.width - (panel!.x + panel!.width)).toBeCloseTo(
      16,
      0
    );
  });

  test('returns to English on System, which follows the browser', async ({
    erd,
    page,
  }) => {
    await erd.enable({ enableLocalePicker: true });
    const changes = await recordEvents(page, 'changeLocale');

    await pick(erd, 'ja-JP');
    await expect(rootOf(erd)).toHaveAttribute('lang', 'ja-JP');

    await pick(erd, 'system');
    await expect(rootOf(erd)).toHaveAttribute('lang', 'en');
    expect(await changes()).toEqual([
      { locale: 'ja-JP' },
      { locale: 'system' },
    ]);
  });

  test('moves with the arrows and picks with Enter, and Escape closes it', async ({
    erd,
    page,
  }) => {
    await erd.enable({ enableLocalePicker: true });
    const changes = await recordEvents(page, 'changeLocale');

    await openPicker(erd);
    await erd.press('ArrowDown');
    await expect(rowOf(erd, 'en')).toBeFocused();
    await erd.press('End');
    await expect(rowOf(erd, 'ko-KR')).toBeFocused();
    await erd.press('ArrowDown');
    await expect(rowOf(erd, 'system')).toBeFocused();
    await erd.press('ArrowUp');
    await erd.press('ArrowUp');
    await expect(rowOf(erd, 'zh-TW')).toBeFocused();
    await erd.press('Enter');

    await expect(pickerOf(erd)).toHaveCount(0);
    await expect(rootOf(erd)).toHaveAttribute('lang', 'zh-TW');

    await openPicker(erd);
    await expect(rowOf(erd, 'zh-TW')).toBeFocused();
    await erd.press(Shortcut.stop);
    await expect(pickerOf(erd)).toHaveCount(0);
    await erd.expectKeyboardFocusInside();
    expect(await changes()).toEqual([{ locale: 'zh-TW' }]);
  });

  test('closes on a press outside it and trades places with the theme builder', async ({
    erd,
  }) => {
    await erd.enable({ enableLocalePicker: true, enableThemeBuilder: true });

    await openPicker(erd);
    await erd.toolbar.locator('.toolbar-theme').click();
    await expect(erd.host.locator('.theme-builder')).toBeVisible();
    await expect(pickerOf(erd)).toHaveCount(0);

    await openPicker(erd);
    await expect(erd.host.locator('.theme-builder')).toHaveCount(0);

    await erd.focusCanvas();
    await expect(pickerOf(erd)).toHaveCount(0);
  });

  test('gives Korean from the palette, through Display Language', async ({
    erd,
    page,
  }) => {
    await erd.enable({ enableLocalePicker: true });
    const changes = await recordEvents(page, 'changeLocale');
    const palette = erd.host.locator('.quick-search');

    await erd.focusCanvas();
    await erd.press(Shortcut.search);
    await page.keyboard.type('Display Language');
    await palette.getByText('Display Language', { exact: true }).click();
    await palette.getByText('한국어', { exact: true }).click();

    await expect(palette).toHaveCount(0);
    await expect(rootOf(erd)).toHaveAttribute('lang', 'ko-KR');
    expect(await changes()).toEqual([{ locale: 'ko-KR' }]);
  });

  test('turns the theme Light from the palette, leaving its gray and accent alone', async ({
    erd,
    page,
  }) => {
    await erd.enable({ enableThemeBuilder: true });
    await page.evaluate(() => {
      window.document.querySelector('erd-editor')!.setPresetTheme({
        appearance: 'dark',
        grayColor: 'sand',
        accentColor: 'tomato',
      });
    });
    const themes = await recordEvents(page, 'changePresetTheme');
    const palette = erd.host.locator('.quick-search');

    await erd.focusCanvas();
    await erd.press(Shortcut.search);
    await page.keyboard.type('Theme');
    await palette.getByText('Theme', { exact: true }).click();
    await palette.getByText('Light', { exact: true }).click();

    await expect(palette).toHaveCount(0);
    expect(await themes()).toEqual([
      { appearance: 'light', grayColor: 'sand', accentColor: 'tomato' },
    ]);
  });
});

test.describe('locale picker under a Korean browser', () => {
  test.use({ locale: 'ko-KR' });

  test('stays English with the picker off and follows the browser once it is on', async ({
    erd,
  }) => {
    await expect(rootOf(erd)).toHaveAttribute('lang', 'en');

    await erd.enable({ enableLocalePicker: true });
    await expect(rootOf(erd)).toHaveAttribute('lang', 'ko-KR');

    await openPicker(erd);
    await expect(rowOf(erd, 'system').locator('[lang="ko-KR"]')).toHaveText(
      '한국어'
    );
  });
});
