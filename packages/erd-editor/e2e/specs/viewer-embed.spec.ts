import type { Point } from '../support/ErdEditorPage';
import type { ErdViewerPage } from '../support/ErdViewerPage';
import { expect, test } from '../support/fixtures';
import { relatedTables } from '../support/schema';
import { MOD_KEY, Shortcut } from '../support/shortcuts';

// A viewer embedded in a page that scrolls around it, the long page: before it
// holds the focus the page keeps the wheel and the keys, and after the focus
// leaves it, the palette closing included, the page has them back.

const scrollY = (viewer: ErdViewerPage) =>
  viewer.page.evaluate(() => window.scrollY);

/** A point on the page text below the viewer, where a press takes the focus out of it. */
async function belowTheViewer(viewer: ErdViewerPage): Promise<Point> {
  const box = await viewer.host.boundingBox();
  if (!box) throw new Error('the viewer has no bounding box');

  return { x: box.x + 40, y: box.y + box.height + 40 };
}

/**
 * Wheels over the viewer's bare canvas and resolves once the page has
 * scrolled, which only a wheel the viewer leaves to the page does.
 */
async function expectThePageScrolls(viewer: ErdViewerPage) {
  const before = await scrollY(viewer);
  const view = await viewer.viewTransform();

  await viewer.wheel(await viewer.emptyPoint(), { deltaY: 120 });

  await expect.poll(() => scrollY(viewer)).toBeGreaterThan(before);
  expect(await viewer.viewTransform()).toEqual(view);
}

/**
 * Wheels and mod-wheels over the viewer's bare canvas and resolves once the
 * view has panned and zoomed for them, the page left where it stood.
 */
async function expectTheViewTakesTheWheel(viewer: ErdViewerPage) {
  const at = await viewer.emptyPoint();
  const before = await scrollY(viewer);
  const view = await viewer.viewTransform();

  await viewer.wheel(at, { deltaY: 120 });
  await expect
    .poll(async () => (await viewer.viewTransform()).y)
    .not.toBe(view.y);

  await viewer.wheel(at, { deltaY: 120 }, [MOD_KEY]);
  await expect
    .poll(async () => (await viewer.viewTransform()).zoom)
    .not.toBe(view.zoom);

  expect(await scrollY(viewer)).toBe(before);
}

/**
 * Waits for a scroll the page has begun to stop, then scrolls the viewer to
 * the middle of the window at once. Space and a wheel scroll the page smoothly
 * over the frames after them, so a point read on the viewer sooner slides off.
 */
async function centerTheViewer(viewer: ErdViewerPage) {
  await viewer.page.evaluate(
    () =>
      new Promise<void>(resolve => {
        let last = window.scrollY;
        let still = 0;
        const frame = () => {
          still = window.scrollY === last ? still + 1 : 0;
          last = window.scrollY;
          if (still < 3) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      })
  );
  await viewer.host.evaluate(host =>
    host.scrollIntoView({ block: 'center', behavior: 'instant' })
  );
}

/** Opens the palette from the focused viewer and closes it with Escape, which hands the focus to no one. */
async function openAndCloseThePalette(viewer: ErdViewerPage) {
  await viewer.page.keyboard.press(Shortcut.search);
  await expect(viewer.palette).toBeVisible();
  await expect(viewer.palette.locator('input')).toBeFocused();

  await viewer.page.keyboard.press(Shortcut.stop);
  await expect(viewer.palette).toHaveCount(0);
  expect(await viewer.hasFocus()).toBe(false);
  expect(
    await viewer.page.evaluate(
      () => window.document.activeElement === window.document.body
    )
  ).toBe(true);
}

/**
 * Centers the viewer and focuses it with a click on its bare canvas, picks a
 * table from the palette, which selects it, and focuses the view again, which
 * the palette closing never does, so a key reaches it with a table selected.
 */
async function selectFromThePalette(viewer: ErdViewerPage, tableId: string) {
  await centerTheViewer(viewer);
  const bare = await viewer.emptyPoint();
  await viewer.page.mouse.click(bare.x, bare.y);
  await viewer.page.keyboard.press(Shortcut.search);
  await viewer.palette.locator('input').fill(`#${tableId}`);
  await viewer.palette
    .locator('.quick-search-row', { hasText: new RegExp(`^${tableId}`) })
    .click();
  await expect(viewer.palette).toHaveCount(0);

  await viewer.focus();
  expect(await viewer.hasFocus()).toBe(true);
}

/** What a listener on the window saw of each keydown: whether something below it had prevented it. */
type KeyRecord = { code: string; prevented: boolean };

/**
 * Starts recording every keydown but a modifier's as the window hears it,
 * after the viewer's own listeners, and hands back what it has heard since
 * the last read.
 */
async function recordKeys(viewer: ErdViewerPage) {
  await viewer.page.evaluate(() => {
    const heard: Array<{ code: string; prevented: boolean }> = [];
    Reflect.set(window, '__erdKeysHeard', heard);
    window.addEventListener('keydown', event => {
      if (/^(Alt|Control|Meta|Shift)(Left|Right)$/.test(event.code)) return;
      heard.push({ code: event.code, prevented: event.defaultPrevented });
    });
  });

  return () =>
    viewer.page.evaluate(() =>
      (Reflect.get(window, '__erdKeysHeard') as KeyRecord[]).splice(0)
    );
}

test.describe('a viewer embedded in a page that scrolls', () => {
  test('leaves the wheel to the page until a click or the Tab key focuses it, and again once the focus leaves (AC-V10)', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('long');
    await viewer.seed(relatedTables());

    // Mounting and loading take no focus.
    expect(await viewer.hasFocus()).toBe(false);
    expect(
      await page.evaluate(
        () => window.document.activeElement === window.document.body
      )
    ).toBe(true);

    const zoom = await viewer.zoomLevel();
    await expectThePageScrolls(viewer);
    expect(await viewer.zoomLevel()).toBe(zoom);

    await page.keyboard.press('Tab');
    expect(await viewer.hasFocus()).toBe(true);
    await expectTheViewTakesTheWheel(viewer);

    const outside = await belowTheViewer(viewer);
    await page.mouse.click(outside.x, outside.y);
    expect(await viewer.hasFocus()).toBe(false);
    await expectThePageScrolls(viewer);

    const bare = await viewer.emptyPoint();
    await page.mouse.click(bare.x, bare.y);
    expect(await viewer.hasFocus()).toBe(true);
    await expectTheViewTakesTheWheel(viewer);

    await openAndCloseThePalette(viewer);
    await expectThePageScrolls(viewer);
  });

  test('answers no key before it holds the focus, and after it only the view keys, editing no table it selected (AC-V11)', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('long');
    await viewer.seed(relatedTables());
    const heard = await recordKeys(viewer);
    const zoom = await viewer.zoomLevel();

    const beforeFocus = [
      'Delete',
      'Backspace',
      'Space',
      'ControlOrMeta+KeyA',
      'ControlOrMeta+KeyF',
      Shortcut.search,
    ];
    for (const key of beforeFocus) await page.keyboard.press(key);

    expect(await heard()).toEqual(
      ['Delete', 'Backspace', 'Space', 'KeyA', 'KeyF', 'KeyK'].map(code => ({
        code,
        prevented: false,
      }))
    );
    expect(await viewer.zoomLevel()).toBe(zoom);
    await expect(viewer.palette).toHaveCount(0);

    // Space, left to the page, scrolls it by about a screen, which can carry
    // the viewer off it.
    await expect.poll(() => scrollY(viewer)).toBeGreaterThan(0);
    await centerTheViewer(viewer);

    const bare = await viewer.emptyPoint();
    await page.mouse.click(bare.x, bare.y);
    expect(await viewer.hasFocus()).toBe(true);

    await page.keyboard.press(Shortcut.zoomOut);
    await expect.poll(() => viewer.zoomLevel()).toBeLessThan(zoom);
    await page.keyboard.press(Shortcut.zoomReset);
    await expect.poll(() => viewer.zoomLevel()).toBe(1);
    await page.keyboard.press(Shortcut.zoomIn);
    await expect.poll(() => viewer.zoomLevel()).toBeGreaterThan(1);

    await openAndCloseThePalette(viewer);
    await expectThePageScrolls(viewer);

    // A selected table, which the editor's chords would add a column to,
    // open a cell of or remove.
    await selectFromThePalette(viewer, 'users');
    const selected = viewer.canvas.locator('.table[data-id="users"]');
    await expect(selected).toHaveAttribute('data-selected', '');
    const value = await viewer.host.evaluate(host =>
      String(Reflect.get(host, 'value'))
    );
    await heard();

    const edits = [
      Shortcut.addColumn,
      Shortcut.edit,
      Shortcut.removeSelection,
      'Backspace',
      Shortcut.addTable,
      Shortcut.addMemo,
    ];
    for (const key of edits) await page.keyboard.press(key);

    expect(await heard()).toEqual(
      ['Enter', 'Enter', 'Delete', 'Backspace', 'KeyN', 'KeyM'].map(code => ({
        code,
        prevented: false,
      }))
    );
    await expect(viewer.host.locator('.edit-overlay')).toHaveCount(0);
    expect(
      await viewer.host.evaluate(host => String(Reflect.get(host, 'value')))
    ).toBe(value);
    await expect(selected).toHaveAttribute('data-selected', '');
  });
});

test.describe('a finger on a viewer embedded in a page that scrolls', () => {
  test.use({ hasTouch: true });

  test('leaves a finger on bare canvas to the page until the viewer holds the focus, which then takes it and pans the view', async ({
    viewer,
  }) => {
    await viewer.goto('long');
    await viewer.seed(relatedTables());
    const point = await viewer.emptyPoint();

    // What lets the browser scroll the page for the finger: no element under
    // it bars panning, and no handler prevents the touch.
    const still = await viewer.viewTransform();
    expect(await viewer.touchActionsAt(point)).not.toContain('none');
    expect(await viewer.touchDrag(point, { x: 0, y: -160 })).toEqual([]);
    expect(await viewer.viewTransform()).toEqual(still);
    expect(await viewer.hasFocus()).toBe(false);

    await viewer.focus();
    const view = await viewer.viewTransform();
    expect(await viewer.touchActionsAt(point)).toContain('none');
    await viewer.touchDrag(point, { x: 0, y: -160 });
    await expect
      .poll(async () => (await viewer.viewTransform()).y)
      .toBeLessThan(view.y);
  });

  test('scrolls the page from bare canvas, moving no view, until the viewer holds the focus, which then pans the view for the finger', async ({
    viewer,
  }) => {
    // Headless Chromium on Linux turns no synthesized touch gesture into a
    // scroll, on a page that holds nothing else either, where macOS's does; the
    // case above holds the viewer's side of it on every platform.
    test.skip(
      process.platform === 'linux',
      'headless Chromium on Linux synthesizes no touch scroll'
    );

    await viewer.goto('long');
    await viewer.seed(relatedTables());

    const before = await scrollY(viewer);
    const still = await viewer.viewTransform();
    await viewer.swipe(await viewer.emptyPoint(), { x: 0, y: -160 });
    await expect.poll(() => scrollY(viewer)).toBeGreaterThan(before);
    expect(await viewer.viewTransform()).toEqual(still);
    expect(await viewer.hasFocus()).toBe(false);

    await viewer.focus();
    const held = await scrollY(viewer);
    const view = await viewer.viewTransform();
    await viewer.swipe(await viewer.emptyPoint(), { x: 0, y: -160 });
    await expect
      .poll(async () => (await viewer.viewTransform()).y)
      .toBeLessThan(view.y);
    expect(await scrollY(viewer)).toBe(held);
  });
});
