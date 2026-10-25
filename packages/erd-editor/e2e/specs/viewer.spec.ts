import type { Box, Point } from '../support/ErdEditorPage';
import type { ErdViewerPage } from '../support/ErdViewerPage';
import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
  RelationshipType,
  relatedTables,
  twoTables,
} from '../support/schema';
import {
  MOD_KEY,
  Shortcut,
  WHEEL_ZOOM_STEP,
  ZOOM_STEP,
} from '../support/shortcuts';

/** The digits toBeCloseTo keeps for a pan: half a pixel, as the store lands one in floating point. */
const HALF_PIXEL = 0;

/** The key column every seeded table opens with. */
const keyColumn = (tableId: string) => ({
  id: `${tableId}_id`,
  name: 'id',
  dataType: 'int',
  options: ColumnOption.primaryKey | ColumnOption.notNull,
  keys: ColumnUIKey.primaryKey,
});

/**
 * A document holding every kind of entity the scene draws, saved far from the
 * origin at a zoom of its own, so only a fit can put it on a reader's screen.
 */
const everyKind = (): ErdDocument =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 6040,
        y: 5040,
        groupId: 'accounts',
        columns: [keyColumn('users')],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 6640,
        y: 5320,
        columns: [
          keyColumn('posts'),
          {
            id: 'posts_user_id',
            name: 'user_id',
            dataType: 'int',
            keys: ColumnUIKey.foreignKey,
          },
        ],
      },
    ],
    tableGroups: [
      {
        id: 'accounts',
        name: 'accounts',
        x: 6000,
        y: 5000,
        width: 360,
        height: 220,
      },
    ],
    memos: [{ id: 'note', value: 'a memo', x: 6080, y: 5400 }],
    relationships: [
      {
        id: 'users_posts',
        relationshipType: RelationshipType.OneN,
        startTableId: 'users',
        startColumnIds: ['users_id'],
        endTableId: 'posts',
        endColumnIds: ['posts_user_id'],
      },
    ],
    zoomLevel: 0.3,
  });

/** Three tables to search, one column of users with a comment, and a memo. */
const searchable = (): ErdDocument =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 160,
        y: 160,
        columns: [
          keyColumn('users'),
          {
            id: 'users_email',
            name: 'email',
            dataType: 'varchar(255)',
            comment: 'login address',
          },
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 520,
        y: 160,
        columns: [keyColumn('posts')],
      },
      {
        id: 'orders',
        name: 'orders',
        x: 1000,
        y: 420,
        columns: [keyColumn('orders')],
      },
    ],
    memos: [{ id: 'note', value: 'shipping rules', x: 160, y: 460 }],
  });

/** Whether a box lies wholly inside another. */
const inside = (box: Box, frame: Box) =>
  box.x >= frame.x &&
  box.y >= frame.y &&
  box.x + box.width <= frame.x + frame.width &&
  box.y + box.height <= frame.y + frame.height;

/** Whether two boxes share any part of the screen. */
const overlaps = (box: Box, frame: Box) =>
  box.x < frame.x + frame.width &&
  box.x + box.width > frame.x &&
  box.y < frame.y + frame.height &&
  box.y + box.height > frame.y;

/** The middle of a box, where a press on a node lands. */
const middleOf = (box: Box): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/** Gives the viewer the focus the way a reader does, with a still click on its bare canvas. */
async function clickToFocus(viewer: ErdViewerPage) {
  const at = await viewer.emptyPoint();
  await viewer.page.mouse.click(at.x, at.y);
  await expect.poll(() => viewer.hasFocus()).toBe(true);
}

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

test.describe('a document in the viewer', () => {
  test('draws every kind of entity a value set before the element connects holds, fitted to the screen (AC-V1)', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('viewer');
    await page.evaluate(json => {
      const mounted = window.document.querySelector('erd-viewer')!;
      const created = window.document.createElement('erd-viewer');
      created.setAttribute('style', mounted.getAttribute('style') ?? '');
      Reflect.set(created, 'value', json);
      Reflect.get(mounted, 'destroy').call(mounted);
      mounted.replaceWith(created);
    }, JSON.stringify(everyKind()));

    await expect.poll(() => viewer.hasStage()).toBe(true);
    await viewer.whenDrawn();
    expect(await viewer.tableIds()).toEqual(['users', 'posts']);
    await expect(viewer.canvas.locator('.table')).toHaveCount(2);
    await expect(viewer.canvas.locator('.relationship')).toHaveCount(1);
    await expect(viewer.canvas.locator('.memo')).toHaveCount(1);
    await expect(viewer.canvas.locator('.table-group')).toHaveCount(1);

    // The file's own zoom and origin are left aside: the fit decides both,
    // once the view is measured, which a draw may come before.
    await expect
      .poll(async () => {
        const canvas = await viewer.canvasBox();
        return (await viewer.contentBoxes()).map(box => inside(box, canvas));
      })
      .toEqual([true, true, true, true]);
    expect((await viewer.viewTransform()).zoom).not.toBeCloseTo(0.3, 2);
  });
});

test.describe('moving around the viewer (AC-V5)', () => {
  test('pans for a drag wherever it starts, a table included, which stays where the document has it', async ({
    viewer,
  }) => {
    await viewer.goto('viewer');
    await viewer.seed(relatedTables());
    const before = await viewer.viewTransform();

    await viewer.panBy(-120, -60);
    await expect
      .poll(async () => {
        const { x, y } = await viewer.viewTransform();
        return [x - before.x, y - before.y];
      })
      .toEqual([
        expect.closeTo(-120, HALF_PIXEL),
        expect.closeTo(-60, HALF_PIXEL),
      ]);

    const panned = await viewer.viewTransform();
    const users = (await viewer.value()).collections.tableEntities.users.ui;
    await viewer.panBy(90, 40, middleOf(await viewer.sceneBox('#table-users')));
    await expect
      .poll(async () => {
        const { x, y } = await viewer.viewTransform();
        return [x - panned.x, y - panned.y];
      })
      .toEqual([
        expect.closeTo(90, HALF_PIXEL),
        expect.closeTo(40, HALF_PIXEL),
      ]);

    const after = (await viewer.value()).collections.tableEntities.users.ui;
    expect([after.x, after.y]).toEqual([users.x, users.y]);
    expect(await viewer.sceneAttr('#table-users', 'selected')).toBe(false);
  });

  test('pans for a wheel, across under Shift, and zooms for a mod wheel and a trackpad pinch once focused', async ({
    viewer,
  }) => {
    await viewer.goto('viewer');
    await viewer.seed(relatedTables());
    await clickToFocus(viewer);
    const at = await viewer.emptyPoint();
    const start = await viewer.viewTransform();

    await viewer.wheel(at, { deltaY: 100 });
    await expect
      .poll(async () => (await viewer.viewTransform()).y - start.y)
      .toBeCloseTo(-100, HALF_PIXEL);
    expect((await viewer.viewTransform()).x).toBeCloseTo(start.x, HALF_PIXEL);

    await viewer.wheel(at, { deltaY: 100 }, ['Shift']);
    await expect
      .poll(async () => (await viewer.viewTransform()).x - start.x)
      .toBeCloseTo(-100, HALF_PIXEL);

    // Downward, so a fit that stood at the ceiling still has room to move.
    await viewer.wheel(at, { deltaY: 100 }, [MOD_KEY]);
    await expect
      .poll(async () => (await viewer.viewTransform()).zoom)
      .toBeCloseTo(start.zoom - WHEEL_ZOOM_STEP, 5);

    // The ctrl wheel a browser turns a pinch into, deltaY = -100 ln(scale),
    // which the store keeps to two decimals.
    const notched = (await viewer.viewTransform()).zoom;
    await viewer.wheel(at, { deltaY: 100 * Math.log(1.08) }, ['Control']);
    await expect
      .poll(async () => (await viewer.viewTransform()).zoom)
      .toBeCloseTo(notched / 1.08, 2);
  });

  test('zooms from the controls bar, resets to 100% and fits the document again', async ({
    viewer,
  }) => {
    await viewer.goto('viewer');
    await viewer.seed(relatedTables());
    const fitted = (await viewer.viewTransform()).zoom;
    const zoom = async () => (await viewer.viewTransform()).zoom;

    await viewer.controls.getByTitle(/^Zoom out/).click();
    await expect.poll(zoom).toBeCloseTo(fitted - ZOOM_STEP, 5);

    await viewer.controls.getByTitle(/^Zoom in/).click();
    await expect.poll(zoom).toBeCloseTo(fitted, 5);

    await viewer.controls.locator('.zoom-level').click();
    await expect.poll(zoom).toBeCloseTo(1, 5);
    await expect(viewer.controls.locator('.zoom-level')).toHaveText('100%');

    await viewer.controls.locator('.view-fit').click();
    await expect.poll(zoom).toBeCloseTo(fitted, 5);
    const canvas = await viewer.canvasBox();
    for (const box of await viewer.contentBoxes()) {
      expect(inside(box, canvas)).toBe(true);
    }
  });

  test('moves the screen for a drag of the map’s handle', async ({
    viewer,
  }) => {
    await viewer.goto('viewer');
    await viewer.seed(relatedTables());
    const before = await viewer.viewTransform();
    const handle = await viewer.minimapViewport.boundingBox();
    expect(handle).not.toBeNull();

    const from = middleOf(handle!);
    await viewer.drag(from, { x: from.x + 24, y: from.y + 12 });

    await expect
      .poll(async () => {
        const { x, y } = await viewer.viewTransform();
        return [Math.sign(x - before.x), Math.sign(y - before.y)];
      })
      .toEqual([-1, -1]);
    expect((await viewer.viewTransform()).zoom).toBe(before.zoom);
  });
});

test.describe('the viewer palette (AC-V8)', () => {
  test('searches the document under the editor’s prefixes and lists no command', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('viewer');
    await viewer.seed(searchable());
    await clickToFocus(viewer);
    const { palette } = viewer;
    const rows = palette.locator('.quick-search-row');
    const input = palette.locator('input');

    await page.keyboard.press(Shortcut.search);
    await expect(palette).toBeVisible();
    await expect(input).toBeFocused();
    // An empty input names the prefixes, and the document has no command to list.
    await expect(palette.locator('.quick-search-hint button')).toHaveCount(4);
    await expect(rows).toHaveCount(0);

    await page.keyboard.type('export');
    await expect(palette.locator('.quick-search-empty')).toHaveText(
      'No commands match'
    );
    await expect(rows).toHaveText([
      /^#\s*Search tables for "export"$/,
      /^@\s*Search columns for "export"$/,
      /^:\s*Search comments & memos for "export"$/,
    ]);

    await input.fill('#');
    await expect(rows).toHaveCount(3);
    await expect(palette.getByText(/^users\s*Table$/)).toHaveCount(1);

    await input.fill('@users.em');
    await expect(
      palette.getByText('users.email · Column', { exact: true })
    ).toHaveCount(1);

    await input.fill(':login');
    await expect(
      palette.getByText('users.email · Column comment', { exact: true })
    ).toHaveCount(1);

    await input.fill(':shipping');
    await expect(rows.filter({ hasText: 'shipping rules' })).toHaveCount(1);
  });

  test('takes the reader to a table picked from it and marks it', async ({
    viewer,
    page,
  }) => {
    await viewer.goto('viewer');
    await viewer.seed(searchable());
    await clickToFocus(viewer);
    const canvas = await viewer.canvasBox();

    // Carried off the screen first, so only the jump can bring it back.
    await viewer.wheel(await viewer.emptyPoint(), {
      deltaX: -3_000,
      deltaY: 0,
    });
    await expect
      .poll(async () => inside(await viewer.sceneBox('#table-orders'), canvas))
      .toBe(false);

    await page.keyboard.press(Shortcut.search);
    await viewer.palette.locator('input').fill('#orders');
    await viewer.palette
      .locator('.quick-search-row', { hasText: /^orders/ })
      .click();

    await expect(viewer.palette).toHaveCount(0);
    await expect
      .poll(async () => inside(await viewer.sceneBox('#table-orders'), canvas))
      .toBe(true);
    await expect(
      viewer.canvas.locator('.table[data-id="orders"]')
    ).toHaveAttribute('data-selected', '');
  });
});

test.describe('the compass in the controls bar (AC-V9)', () => {
  test('shows once the screen is off every entity, and brings the nearest back', async ({
    viewer,
  }) => {
    await viewer.goto('viewer');
    await viewer.seed(relatedTables());
    const compass = viewer.controls.locator('.content-compass');
    await expect(compass).toHaveCount(0);

    await clickToFocus(viewer);
    await viewer.wheel(await viewer.emptyPoint(), {
      deltaX: 3_000,
      deltaY: 2_500,
    });
    await expect(compass).toBeVisible();
    const canvas = await viewer.canvasBox();
    const onScreen = async () =>
      (await viewer.contentBoxes()).some(box => overlaps(box, canvas));
    expect(await onScreen()).toBe(false);

    await compass.click();

    await expect(compass).toHaveCount(0);
    await expect.poll(onScreen).toBe(true);
  });
});
