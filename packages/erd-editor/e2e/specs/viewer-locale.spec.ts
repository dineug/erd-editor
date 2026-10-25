import type { ErdViewerPage } from '../support/ErdViewerPage';
import { expect, test } from '../support/fixtures';
import { relatedTables } from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// What a viewer takes from its page beside the document: the OS color scheme
// and the theme a page sets, the language the page and the browser name, and
// the direction that language reads in.

/** The Fit button's title, a string a reader sees from the first frame, per language. */
const FIT = { en: 'Fit', ko: '화면에 맞춤', ja: '画面に合わせる' } as const;

/** A dictionary module whatever the language, a request the dev server would serve. */
const ANY_DICTIONARY = /\/src\/i18n\/messages\/(?!en\/)/;

const fitTitle = (viewer: ErdViewerPage) =>
  viewer.controls.locator('.view-fit').getAttribute('title');

/** The table body's fill, the paint the scene takes from the theme, which no stylesheet reaches. */
const tableFill = (viewer: ErdViewerPage) =>
  viewer.sceneAttr(['#table-users', '.table-body'], 'fill');

/** The theme token the table body is painted with and the fill the scene drew, which follow each other. */
async function expectPainted(viewer: ErdViewerPage, color: string) {
  await expect.poll(() => viewer.themeToken('--table-background')).toBe(color);
  await expect.poll(() => tableFill(viewer)).toBe(color);
}

test.describe('the viewer’s appearance (AC-V15)', () => {
  test('follows the OS color scheme until a page names its own light or dark, a preset or tokens', async ({
    viewer,
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await viewer.goto('viewer');
    await viewer.seed(relatedTables());
    const dark = await viewer.themeToken('--table-background');
    await expectPainted(viewer, dark);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect
      .poll(() => viewer.themeToken('--table-background'))
      .not.toBe(dark);
    const light = await viewer.themeToken('--table-background');
    await expectPainted(viewer, light);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expectPainted(viewer, dark);

    const call = (method: string, ...args: unknown[]) =>
      viewer.host.evaluate(
        (host, [name, values]) =>
          Reflect.get(host, name as string).apply(host, values),
        [method, args] as const
      );

    await call('setSystemAppearance', 'light');
    await expectPainted(viewer, light);
    await call('setSystemAppearance', null);
    await expectPainted(viewer, dark);

    await call('setPresetTheme', { appearance: 'light' });
    await expectPainted(viewer, light);

    await call('setTheme', { tableBackground: '#123456' });
    await expectPainted(viewer, '#123456');

    // A page's own custom property wins over both, and reaches the canvas.
    await viewer.host.evaluate(host =>
      (host as HTMLElement).style.setProperty(
        '--erd-editor-table-background',
        '#654321'
      )
    );
    await expectPainted(viewer, '#654321');
  });
});

test.describe('the viewer’s language (AC-V16)', () => {
  test('draws English from the first frame on an English page and loads no dictionary', async ({
    viewer,
  }) => {
    await viewer.goto('viewer');

    expect(await fitTitle(viewer)).toBe(FIT.en);
    await viewer.seed(relatedTables());

    expect(await fitTitle(viewer)).toBe(FIT.en);
    expect(viewer.requests(ANY_DICTIONARY)).toEqual([]);
  });

  test('loads the one dictionary the html lang names, then speaks it', async ({
    viewer,
  }) => {
    await viewer.goto('lang', { lang: 'ko' });

    await expect.poll(() => fitTitle(viewer)).toBe(FIT.ko);
    expect(viewer.dictionaryRequests()).toEqual(['ko-KR']);
  });

  test('loads one more dictionary for a language a page sets later', async ({
    viewer,
  }) => {
    await viewer.goto('viewer');
    await viewer.setLocale('ja-JP');

    expect(await fitTitle(viewer)).toBe(FIT.ja);
    expect(viewer.dictionaryRequests()).toEqual(['ja-JP']);
  });

  test('stays in English when the dictionary fails to load', async ({
    viewer,
    page,
  }) => {
    await page.route(/\/src\/i18n\/messages\/ko-KR/, route => route.abort());
    const failed = page.waitForEvent('requestfailed', request =>
      /\/src\/i18n\/messages\/ko-KR/.test(request.url())
    );
    await viewer.goto('lang', { lang: 'ko-KR' });
    await failed;

    expect(await fitTitle(viewer)).toBe(FIT.en);
    expect(viewer.dictionaryRequests()).toEqual(['ko-KR']);
  });

  test.describe('in a browser whose language the viewer has no dictionary for', () => {
    test.use({ locale: 'th-TH' });

    test('stays in English and asks for no dictionary', async ({ viewer }) => {
      await viewer.goto('lang', { lang: 'th' });
      await viewer.whenDrawn();

      expect(await fitTitle(viewer)).toBe(FIT.en);
      expect(viewer.requests(ANY_DICTIONARY)).toEqual([]);
    });
  });
});

test.describe('the viewer in a right-to-left language (AC-V19)', () => {
  test('lays its palette and its notice out right to left, and its controls, compass, scrollbars and canvas left to right', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('lang', { lang: 'ar-SA' });
    await viewer.seed(relatedTables());

    const rtl = { attribute: 'rtl', computed: 'rtl' };
    const ltr = { attribute: 'ltr', computed: 'ltr' };

    // The page's language, put in force as the viewer connected.
    await expect.poll(() => viewer.direction('.erd-view')).toEqual(rtl);
    expect(viewer.dictionaryRequests()).toEqual(['ar-SA']);

    expect(await viewer.direction('.view-controls')).toEqual(ltr);
    expect(await viewer.direction('[data-testid="erd-canvas"]')).toEqual(ltr);
    await expect(viewer.host.locator('.virtual-scroll')).toHaveCount(2);
    for (const track of await viewer.host.locator('.virtual-scroll').all()) {
      expect(
        await track.evaluate(el => ({
          attribute: el.closest('[dir]')?.getAttribute('dir') ?? null,
          computed: getComputedStyle(el).direction,
        }))
      ).toEqual(ltr);
    }

    // Off every entity, so the compass shows.
    const at = await viewer.emptyPoint();
    await page.mouse.click(at.x, at.y);
    await viewer.wheel(at, { deltaX: 3_000, deltaY: 2_500 });
    await expect(viewer.controls.locator('.content-compass')).toBeVisible();
    expect(await viewer.direction('.content-compass')).toEqual(ltr);

    await page.keyboard.press(Shortcut.search);
    await expect(viewer.palette).toBeVisible();
    expect(await viewer.direction('.quick-search')).toEqual(rtl);
    await page.keyboard.press(Shortcut.stop);
    await expect(viewer.palette).toHaveCount(0);

    // A src the server cannot answer leaves the notice of a failed load.
    await page.route(/\/missing\.erd\.json$/, route =>
      route.fulfill({ status: 404, body: '' })
    );
    await viewer.host.evaluate(host =>
      host.setAttribute('src', '/missing.erd.json')
    );
    await expect(
      viewer.host.locator('.view-status[role="alert"]')
    ).toBeVisible();
    expect(await viewer.direction('.view-status')).toEqual(rtl);
  });
});
