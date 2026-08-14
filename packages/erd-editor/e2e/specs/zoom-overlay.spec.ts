import { expect, test } from '../support/fixtures';
import { CANVAS_ZOOM_MIN, twoTables } from '../support/schema';
import { Shortcut, WHEEL_ZOOM_STEP, ZOOM_STEP } from '../support/shortcuts';

/**
 * Zoom, scroll and the overlays that sit on top of the canvas.
 *
 * The common thread is `zoomLevel` starting at its own maximum: every zoom
 * gesture here has to go down before it can go anywhere.
 */
test.describe('zoom, scroll and overlays', () => {
  test('$mod+wheel zooms out in 0.03 steps and the toolbar shows the percentage', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    const zoom = erd.toolbar.locator('input[title="zoom level"]');
    await expect(zoom).toHaveValue('100%');

    const before = await erd.tableEl('users').boundingBox();

    // Wheeling down (positive deltaY) zooms out; wheeling up is a no-op here
    // because the editor already sits at the 1.0 ceiling. The modifier comes
    // from the page, not from `MOD_KEY` — `Erd.ts#handleWheel` asks `isMod()`,
    // which reads the UA rather than the keyboard layout tinykeys uses.
    const modKey = await erd.pointerModKey();
    for (let notch = 0; notch < 4; notch++) {
      await erd.wheel(120, { modifiers: [modKey] });
    }

    // `streamZoomLevelAction$` batches, so the notches settle a tick after the
    // last one is delivered — poll rather than read straight through.
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(1 - 4 * WHEEL_ZOOM_STEP, 5);
    await expect(zoom).toHaveValue('88%');

    // The canvas is `scale()`d, so the zoom is visible as a smaller table: the
    // box shrinks by exactly the zoom factor.
    const after = await erd.tableEl('users').boundingBox();
    expect(after!.width / before!.width).toBeCloseTo(0.88, 2);
    expect(after!.height / before!.height).toBeCloseTo(0.88, 2);
  });

  test('$mod+Minus / $mod+Equal step by 0.04 and clamp at both ends', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.focusCanvas();
    const zoom = erd.toolbar.locator('input[title="zoom level"]');

    // A fresh editor is already at the ceiling, so zooming in changes nothing.
    // The proof is transitive and comes one step later: if this press had gone
    // through to 1.04, the single zoomOut below would land on 100%, not 96%.
    await erd.press(Shortcut.zoomIn);
    await expect(zoom).toHaveValue('100%');

    await erd.press(Shortcut.zoomOut);
    await expect(zoom).toHaveValue('96%');
    expect((await erd.settings()).zoomLevel).toBeCloseTo(1 - ZOOM_STEP, 5);

    await erd.press(Shortcut.zoomIn);
    await expect(zoom).toHaveValue('100%');
    expect((await erd.settings()).zoomLevel).toBe(1);

    // From 1.0, 23 steps of 0.04 would land at 0.08; the range clamps to 0.1.
    for (let step = 0; step < 23; step++) {
      await erd.press(Shortcut.zoomOut);
    }
    await expect(zoom).toHaveValue('10%');
    expect((await erd.settings()).zoomLevel).toBe(CANVAS_ZOOM_MIN);

    await erd.press(Shortcut.zoomOut);
    await expect(zoom).toHaveValue('10%');
    expect((await erd.settings()).zoomLevel).toBe(CANVAS_ZOOM_MIN);
  });

  test('a plain wheel scrolls the canvas, Shift+wheel scrolls it sideways, and the editor consumes the event', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    const before = await erd.tableEl('users').boundingBox();

    // `handleWheel` calls `preventDefault`, so every wheel that reaches window
    // — window is above the editor root, where the handler is bound — must
    // already be cancelled. This is the direct signal; the host document not
    // scrolling is not, since the fixture page sets `overflow: hidden` anyway.
    await erd.page.evaluate(() => {
      (window as any).__wheelPrevented = [];
      window.addEventListener('wheel', event => {
        (window as any).__wheelPrevented.push(event.defaultPrevented);
      });
    });

    await erd.wheel(200);
    await expect
      .poll(async () => (await erd.settings()).scrollTop)
      .toBeLessThan(0);

    const scrolled = await erd.settings();
    const afterY = await erd.tableEl('users').boundingBox();
    expect(scrolled.scrollLeft).toBe(0);
    // `scrollTop` is applied as a canvas translate, so the table moves with it.
    expect(afterY!.y - before!.y).toBeCloseTo(scrolled.scrollTop, 0);
    expect(afterY!.x).toBeCloseTo(before!.x, 0);

    // Shift maps the vertical notch onto the horizontal axis. Chromium keeps
    // deltaY and sets shiftKey rather than pre-swapping the axes, so it is
    // `handleWheel`'s `isReverse` branch that runs; both branches land here.
    await erd.wheel(200, { modifiers: ['Shift'] });
    await expect
      .poll(async () => (await erd.settings()).scrollLeft)
      .toBeLessThan(0);

    const scrolledX = await erd.settings();
    const afterX = await erd.tableEl('users').boundingBox();
    expect(scrolledX.scrollTop).toBe(scrolled.scrollTop);
    expect(afterX!.x - before!.x).toBeCloseTo(scrolledX.scrollLeft, 0);
    expect(afterX!.y).toBeCloseTo(afterY!.y, 0);

    expect(
      await erd.page.evaluate(() => (window as any).__wheelPrevented)
    ).toEqual([true, true]);
  });

  test('crossing zoomLevel 0.7 swaps tables to the high-level render', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.clickTableHeader('users');
    await expect(erd.selectedTables()).toHaveCount(1);
    await expect(erd.canvas.locator('.column-row')).toHaveCount(4);

    // 7 shortcut steps of 0.04 from 1.0 → 0.72, still one step above the
    // `isHighLevelTable` threshold of 0.7.
    for (let step = 0; step < 7; step++) {
      await erd.press(Shortcut.zoomOut);
    }
    expect((await erd.settings()).zoomLevel).toBeCloseTo(0.72, 5);
    await expect(erd.canvas.locator('.column-row')).toHaveCount(4);

    // 0.68 — `isHighLevelTable` flips and `Canvas` swaps every `Table` for a
    // `HighLevelTable`: same nodes, same selection, no column rows.
    await erd.press(Shortcut.zoomOut);
    expect((await erd.settings()).zoomLevel).toBeCloseTo(0.68, 5);
    await expect(erd.canvas.locator('.column-row')).toHaveCount(0);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    await expect(erd.tableEl('users')).toContainText('users');
    await expect(erd.selectedTables()).toHaveCount(1);

    // Surprising but real, and asserted as-is: `useErdShortcut` gates only the
    // focus/traversal branch on `showHighLevelTable`, so `addColumn` still
    // fires. The column is appended to the store with nothing on screen to
    // show for it until the zoom comes back up.
    await erd.press(Shortcut.addColumn);
    await expect.poll(() => erd.columnIds('users')).toHaveLength(3);
    await expect(erd.canvas.locator('.column-row')).toHaveCount(0);

    // Back above the threshold: 2 rows for posts plus the 3 users now has.
    for (let step = 0; step < 8; step++) {
      await erd.press(Shortcut.zoomIn);
    }
    await expect(erd.canvas.locator('.column-row')).toHaveCount(5);
    await expect(erd.tableEl('users').locator('.column-row')).toHaveCount(3);
  });

  test('the canvas context menu creates a table and closes', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    // Canvas coordinates: above both seeded tables (y 160 and 420) and well
    // inside the 1440x900 viewport, so the right-click lands on bare canvas.
    await erd.openContextMenuAt(500, 60);

    for (const label of [
      'New Table',
      'New Memo',
      'Relationship',
      'View Option',
      'Database',
      'Import',
      'Export',
    ]) {
      await expect(
        erd.contextMenu.getByText(label, { exact: true })
      ).toBeVisible();
    }

    await erd.contextMenu.getByText('New Table', { exact: true }).click();

    await expect(erd.contextMenu).toHaveCount(0);
    await expect(erd.canvas.locator('.table')).toHaveCount(3);
    expect(await erd.tableIds()).toHaveLength(3);
  });

  test('hovering a parent item opens a submenu panel and hovering a leaf closes it', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.openContextMenuAt(500, 60);
    await expect(erd.contextMenu).toHaveCount(1);

    await erd.contextMenu.getByText('Relationship', { exact: true }).hover();
    await expect(erd.contextMenu).toHaveCount(2);
    await expect(
      erd.contextMenu.nth(1).getByText('One Only', { exact: true })
    ).toBeVisible();

    // `ContextMenuItem` closes a sibling's submenu as soon as another item in
    // the same panel is entered — even one that has no submenu of its own.
    await erd.contextMenu
      .first()
      .getByText('New Memo', { exact: true })
      .hover();
    await expect(erd.contextMenu).toHaveCount(1);
  });

  test('$mod+KeyK opens quick search, which lists commands and the seeded tables', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.focusCanvas();

    const quickSearch = erd.host.locator('.quick-search');
    const rows = quickSearch.locator('.scrollbar > div');

    await erd.press(Shortcut.search);
    await expect(quickSearch).toBeVisible();
    await expect(quickSearch.locator('input')).toBeFocused();

    // Membership only — the list is fuse.js ranked and its order is not part of
    // the contract. `createScopeActions` mixes fixed commands with one row per
    // table in the document, so the seed shows up here too.
    for (const label of ['New Table', 'New Memo', 'users', 'posts']) {
      await expect(quickSearch.getByText(label, { exact: true })).toBeVisible();
    }

    // 'memo' matches exactly one action: fuse.js searches `name` + `keywords`,
    // and no other entry carries either token.
    await erd.page.keyboard.type('memo');
    await expect(rows).toHaveCount(1);
    await expect(rows).toHaveText(/New Memo/);
    await expect(
      quickSearch.getByText('New Table', { exact: true })
    ).toHaveCount(0);

    await erd.press(Shortcut.stop);
    await expect(quickSearch).toHaveCount(0);
  });

  test('quick search suppresses editor shortcuts while it is open', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.focusCanvas();
    const quickSearch = erd.host.locator('.quick-search');

    await erd.press(Shortcut.search);
    await expect(quickSearch).toBeVisible();

    // `erdShortcutPerformCheck` drops every shortcut while `Open.search` is on.
    await erd.press(Shortcut.addTable);
    await erd.press(Shortcut.stop);
    await expect(quickSearch).toHaveCount(0);
    // Closing the overlay hands focus back asynchronously; a key pressed inside
    // that gap is delivered to <body> and lost.
    await erd.expectKeyboardFocusInside();

    // The memo is the barrier: it is dispatched after the suppressed press, so
    // once it has rendered anything that press would have done has had its turn.
    await erd.press(Shortcut.addMemo);
    await expect(erd.canvas.locator('.memo')).toHaveCount(1);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    expect(await erd.tableIds()).toHaveLength(2);

    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(3);
    expect(await erd.tableIds()).toHaveLength(3);
  });

  test('table properties suppresses editor shortcuts while it is open', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.clickTableHeader('users');
    await expect(erd.selectedTables()).toHaveCount(1);

    const tableProperties = erd.host.locator('.table-properties');
    await erd.press(Shortcut.tableProperties);
    await expect(tableProperties).toBeVisible();

    await erd.press(Shortcut.addTable);
    await erd.press(Shortcut.stop);
    await expect(tableProperties).toHaveCount(0);
    await erd.expectKeyboardFocusInside();

    // Same barrier as the quick-search case: a later, allowed shortcut proves
    // the suppressed one never landed.
    await erd.press(Shortcut.addMemo);
    await expect(erd.canvas.locator('.memo')).toHaveCount(1);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    expect(await erd.tableIds()).toHaveLength(2);

    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(3);
    expect(await erd.tableIds()).toHaveLength(3);
  });

  test('switching canvas type swaps the ERD out and restores it intact', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await expect(erd.canvas.locator('.table')).toHaveCount(2);

    await erd.toolbarButton('Settings').click();
    // `cache()` detaches the ERD subtree rather than hiding it.
    await expect(erd.canvas).toHaveCount(0);
    await expect(erd.toolbarButton('Settings')).toHaveClass(/\bactive\b/);
    // 'Preferences' names both the LNB entry and the heading of the panel it
    // opens, so the panel is identified by a row only it renders.
    await expect(
      erd.host.getByText('Preferences', { exact: true })
    ).toHaveCount(2);
    await expect(
      erd.host.getByText('Relationship DataType Sync', { exact: true })
    ).toBeVisible();
    expect((await erd.settings()).canvasType).toBe('settings');

    await erd.toolbarButton('Entity Relationship Diagram').click();
    await expect(erd.canvas).toHaveCount(1);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    await expect(erd.canvas.locator('.column-row')).toHaveCount(4);
    expect(await erd.tableIds()).toEqual(['users', 'posts']);
  });
});
