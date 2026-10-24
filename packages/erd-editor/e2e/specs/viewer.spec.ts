import { expect, test } from '../support/fixtures';
import { twoTables } from '../support/schema';

/**
 * The viewer fixture page itself: each mode mounts what it says, every viewer's
 * root is reachable by its host, a document goes in through value, and the Tab
 * key reaches each viewer, which takes no focus by loading.
 */
test.describe('viewer fixture', () => {
  test('mounts one viewer and publishes its shadow root by host', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('viewer');

    expect(await viewer.hasShadowRoot()).toBe(true);
    // The default page names no language, so a viewer's locale comes from the
    // browser rather than from the page.
    expect(
      await page.evaluate(() => document.documentElement.hasAttribute('lang'))
    ).toBe(false);
  });

  test('hands a document over through value', async ({ viewer }) => {
    await viewer.goto('viewer');
    await viewer.seed(twoTables());

    expect(await viewer.tableIds()).toEqual(['users', 'posts']);
  });

  test('mounts two viewers, each with a document and a root of its own', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('viewers');
    const second = viewer.at(1);

    expect(await viewer.tableIds()).toEqual(['users', 'posts']);
    expect(await second.tableIds()).toEqual(['orders']);
    expect(
      await page.evaluate(() => {
        const roots = Reflect.get(window, '__erdShadowRoots') as Map<
          Element,
          ShadowRoot
        >;
        const hosts = [...document.querySelectorAll('erd-viewer')];
        return new Set(hosts.map(host => roots.get(host))).size;
      })
    ).toBe(2);
  });

  test('takes no focus on load and lets the Tab key reach each viewer in turn', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('viewers');
    const focused = () =>
      page.evaluate(() => {
        const roots = Reflect.get(window, '__erdShadowRoots') as Map<
          Element,
          ShadowRoot
        >;
        const hosts = [...document.querySelectorAll('erd-viewer')];
        const host = document.activeElement;
        const inner = host ? roots.get(host)?.activeElement : null;
        return {
          viewer: hosts.findIndex(each => each === host),
          tabindex: inner?.getAttribute('tabindex') ?? null,
        };
      });

    expect(await focused()).toEqual({ viewer: -1, tabindex: null });

    await page.keyboard.press('Tab');
    expect(await focused()).toEqual({ viewer: 0, tabindex: '0' });

    await page.keyboard.press('Tab');
    expect(await focused()).toEqual({ viewer: 1, tabindex: '0' });
  });

  test('writes the html lang the lang mode names before the viewer connects', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('lang', { lang: 'ko-KR' });

    expect(await page.evaluate(() => document.documentElement.lang)).toBe(
      'ko-KR'
    );
  });

  test('scrolls the long page around the viewer', async ({ viewer, page }) => {
    await viewer.goto('long');
    const filler = page.locator('.filler').first();
    const box = await filler.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + 20, box!.y + 20);
    await page.mouse.wheel(0, 400);

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await expect(viewer.host).toBeAttached();
  });

  test('keeps a closed root closed and still publishes it', async ({
    viewer,
  }) => {
    await viewer.goto('viewer', { closedShadow: true });

    expect(await viewer.host.evaluate(host => host.shadowRoot)).toBeNull();
    expect(await viewer.hasShadowRoot()).toBe(true);
  });
});
