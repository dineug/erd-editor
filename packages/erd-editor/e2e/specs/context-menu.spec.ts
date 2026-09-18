import type { Locator } from '@playwright/test';

import type { Box, ErdEditorPage, Point } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  type ErdDocument,
  oneTable,
  RelationshipType,
  twoTables,
} from '../support/schema';

// AC-I4. The menu itself stayed dom, so what the port has to prove is the
// routing: a right click reaches the same three answers a closest chain gave —
// the table under the pointer, the connector under it, or neither.

const RELATIONSHIP_ID = 'users_posts';

/** twoTables with one connector between them, laid out side by side. */
function linkedTables(): ErdDocument {
  const document = twoTables();
  const posts = document.collections.tableEntities.posts;
  posts.ui.x = 760;
  posts.ui.y = 160;

  document.collections.tableColumnEntities.posts_title.ui.keys = 2;
  document.collections.relationshipEntities[RELATIONSHIP_ID] = {
    id: RELATIONSHIP_ID,
    identification: false,
    relationshipType: RelationshipType.ZeroN,
    startRelationshipType: 2,
    start: {
      tableId: 'users',
      columnIds: ['users_id'],
      x: 0,
      y: 0,
      direction: 1,
    },
    end: {
      tableId: 'posts',
      columnIds: ['posts_title'],
      x: 0,
      y: 0,
      direction: 1,
    },
    meta: { updateAt: 0, createAt: 0 },
  };
  document.doc.relationshipIds = [RELATIONSHIP_ID];

  return document;
}

/**
 * A viewport point that really lands on a connector. The route is a polyline
 * inside a much larger box, so the box centre usually misses it and the scene
 * is sampled for a point the hit test answers with instead.
 */
async function relationshipPoint(page: any, id: string) {
  const handle = await page.waitForFunction((relationshipId: string) => {
    const stage = Reflect.get(window, '__erdStages')?.canvas;
    const group = stage?.findOne(`.${relationshipId}`);
    if (!group) return null;

    const rect = group.getClientRect({ relativeTo: stage });
    const origin = stage.container().getBoundingClientRect();

    for (let dy = 0; dy <= rect.height; dy += 2) {
      for (let dx = 0; dx <= rect.width; dx += 2) {
        const point = { x: rect.x + dx, y: rect.y + dy };
        const hit = stage.getIntersection(point);
        let node = hit;

        while (node) {
          if (node.name?.().includes(relationshipId)) {
            return { x: origin.x + point.x, y: origin.y + point.y };
          }
          node = node.getParent();
        }
      }
    }

    return null;
  }, id);

  return (await handle.jsonValue()) as { x: number; y: number };
}

test.describe('context menu routing', () => {
  test('right-clicking bare canvas offers the erd menu', async ({ erd }) => {
    await erd.seed(twoTables());

    const point = await erd.emptyPoint();
    await erd.clickAt(point, { button: 'right' });

    await expect(erd.contextMenu.first()).toBeVisible();
    await expect(erd.contextMenuItem('New Table')).toBeVisible();
    await expect(erd.contextMenuItem('Primary Key')).toHaveCount(0);
  });

  test('right-clicking a table offers its own menu and opens the colour picker', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    await erd.clickAt(await erd.tableHeaderPoint('users'), { button: 'right' });

    await expect(erd.contextMenu.first()).toBeVisible();
    await expect(erd.contextMenuItem('Primary Key')).toBeVisible();
    await expect(erd.contextMenuItem('Table Properties')).toBeVisible();
    await expect(erd.contextMenuItem('New Table')).toHaveCount(0);

    await erd.contextMenu.getByText('Color', { exact: true }).click();
    await expect(erd.host.locator('.color-picker')).toBeVisible();
  });

  test('right-clicking a relationship offers its type and deletes it', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());
    expect(await erd.relationshipIds()).toEqual([RELATIONSHIP_ID]);

    const point = await relationshipPoint(erd.page, RELATIONSHIP_ID);
    await erd.clickAt(point, { button: 'right' });

    await expect(erd.contextMenu.first()).toBeVisible();
    await expect(erd.contextMenuItem('Relationship Type')).toBeVisible();
    await expect(erd.contextMenuItem('New Table')).toHaveCount(0);

    await erd.contextMenu.getByText('Delete', { exact: true }).click();
    await expect.poll(() => erd.relationshipIds()).toEqual([]);
  });
});

/** The part two screen boxes share, or null where they do not meet. */
function overlapOf(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  return right > x && bottom > y
    ? { x, y, width: right - x, height: bottom - y }
    : null;
}

/**
 * Whether the element a pointer at this point would reach is inside a menu,
 * asked of the shadow root, since the document answers with the host alone.
 */
const menuTakesPointAt = (erd: ErdEditorPage, point: Point) =>
  erd.page.evaluate(({ x, y }) => {
    const root = Reflect.get(window, '__erdShadowRoot') as ShadowRoot;
    return Boolean(
      root.elementFromPoint(x, y)?.closest('.context-menu-content')
    );
  }, point);

/** The titles of the toolbar buttons standing active. */
const activeTools = (erd: ErdEditorPage) =>
  erd.floatingToolbar
    .locator('.active')
    .evaluateAll(els => els.map(el => el.getAttribute('title')));

test.describe('context menu stacking', () => {
  test('a menu opened over the floating toolbar takes the pointer where they cross', async ({
    erd,
    page,
  }) => {
    await erd.seed(oneTable());
    const bar = await erd.floatingToolbar.boundingBox();
    if (!bar) throw new Error('the floating toolbar has no box');

    const at = { x: bar.x + bar.width / 2, y: bar.y - 60 };
    await erd.hoverAt(at);
    await erd.clickAt(at, { button: 'right' });

    const menu = erd.host.locator('.context-menu-content[data-id="root"]');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    const overlap = box && overlapOf(box, bar);
    if (!overlap) throw new Error('the menu does not cross the toolbar');

    const mid = {
      x: overlap.x + overlap.width / 2,
      y: overlap.y + overlap.height / 2,
    };
    expect(await menuTakesPointAt(erd, mid)).toBe(true);

    const before = await activeTools(erd);
    await page.mouse.move(mid.x, mid.y, { steps: 8 });
    await page.mouse.down();
    await page.mouse.up();

    expect(await activeTools(erd)).toEqual(before);
  });
});

const EDGE_VIEWPORT = { width: 960, height: 540 };

type MenuBoxes = {
  left: number;
  top: number;
  right: number;
  bottom: number;
}[];

/**
 * Samples every menu box on each animation frame until the call it returns
 * stops it, so a menu painted once where it opened before it moves is caught.
 */
async function recordMenuFrames(erd: ErdEditorPage) {
  await erd.page.evaluate(() => {
    const frames: MenuBoxes[] = [];
    const tick = () => {
      if (Reflect.get(window, '__menuFrames') !== frames) return;

      const root = Reflect.get(window, '__erdShadowRoot') as ShadowRoot;
      const menus = root.querySelectorAll('.context-menu-content');
      frames.push(
        Array.from(menus, el => {
          const { left, top, right, bottom } = el.getBoundingClientRect();
          return { left, top, right, bottom };
        })
      );
      requestAnimationFrame(tick);
    };

    Reflect.set(window, '__menuFrames', frames);
    requestAnimationFrame(tick);
  });

  return async () => {
    const frames = await erd.page.evaluate(() => {
      const recorded = Reflect.get(window, '__menuFrames') as MenuBoxes[];
      Reflect.set(window, '__menuFrames', null);
      return recorded;
    });
    expect(frames.some(menus => menus.length)).toBe(true);

    return frames.flat();
  };
}

/** Every box that crosses an edge of the window. */
const offScreen = (boxes: MenuBoxes) =>
  boxes.filter(
    box =>
      box.left < 0 ||
      box.top < 0 ||
      box.right > EDGE_VIEWPORT.width ||
      box.bottom > EDGE_VIEWPORT.height
  );

async function expectOnScreen(menu: Locator) {
  const box = await menu.boundingBox();
  if (!box) throw new Error('the menu has no box');

  const { x: left, y: top } = box;
  const right = left + box.width;
  const bottom = top + box.height;
  expect(offScreen([{ left, top, right, bottom }])).toEqual([]);

  return box;
}

const rootMenu = (erd: ErdEditorPage) =>
  erd.host.locator('.context-menu-content[data-id="root"]');

const rowOf = (menu: Locator, name: string) =>
  menu.locator(':scope > div:not(.context-menu-content)', { hasText: name });

test.describe('context menu at the window edge', () => {
  test.use({ viewport: EDGE_VIEWPORT });

  test('a canvas menu opened at the right edge opens its Auto Layout submenu on screen', async ({
    erd,
    page,
  }) => {
    await erd.seed(oneTable());
    const stop = await recordMenuFrames(erd);

    const at = { x: 900, y: 230 };
    await erd.hoverAt(at);
    await erd.clickAt(at, { button: 'right' });
    await expect(erd.contextMenuItem('New Table')).toBeVisible();
    const root = await expectOnScreen(rootMenu(erd));

    // Down the outside of the menu's left edge, so no other row opens its
    // submenu on the way, then into the row.
    const row = await rowOf(rootMenu(erd), 'Auto Layout').boundingBox();
    if (!row) throw new Error('no Auto Layout row');
    const rowY = row.y + row.height / 2;
    await page.mouse.move(root.x - 6, at.y, { steps: 4 });
    await page.mouse.move(root.x - 6, rowY, { steps: 8 });
    await page.mouse.move(row.x + 20, rowY, { steps: 8 });

    const submenu = erd.host.locator(
      '.context-menu-content:not([data-id="root"])'
    );
    await expect(submenu).toHaveCount(1);
    const sub = await expectOnScreen(submenu);
    expect(sub.x + sub.width).toBeLessThanOrEqual(row.x);

    const flow = rowOf(submenu, 'Flow');
    const flowBox = await flow.boundingBox();
    if (!flowBox) throw new Error('no Flow row');
    const flowAt = {
      x: flowBox.x + flowBox.width / 2,
      y: flowBox.y + flowBox.height / 2,
    };
    await page.mouse.move(row.x - 20, rowY, { steps: 4 });
    await page.mouse.move(flowAt.x, flowAt.y, { steps: 8 });

    expect(await menuTakesPointAt(erd, flowAt)).toBe(true);
    expect(await flow.evaluate(el => el.matches(':hover'))).toBe(true);
    expect(offScreen(await stop())).toEqual([]);
  });

  test('a canvas menu opened in the bottom right corner stands inside the window', async ({
    erd,
  }) => {
    await erd.seed(oneTable());
    const stop = await recordMenuFrames(erd);

    const at = { x: 880, y: 500 };
    await erd.hoverAt(at);
    await erd.clickAt(at, { button: 'right' });
    await expect(erd.contextMenuItem('New Table')).toBeVisible();

    await expectOnScreen(rootMenu(erd));
    expect(offScreen(await stop())).toEqual([]);
  });

  test('a table menu opened on a header at the right edge stands inside the window', async ({
    erd,
  }) => {
    const document = oneTable();
    document.collections.tableEntities.users.ui.x = 720;
    document.collections.tableEntities.users.ui.y = 300;
    await erd.seed(document);
    const stop = await recordMenuFrames(erd);

    const header = await erd.sceneBox('#table-users');
    const at = {
      x: Math.min(header.x + header.width - 16, 940),
      y: header.y + 8,
    };
    await erd.hoverAt(at);
    await erd.clickAt(at, { button: 'right' });
    await expect(erd.contextMenuItem('Primary Key')).toBeVisible();

    await expectOnScreen(rootMenu(erd));
    expect(offScreen(await stop())).toEqual([]);
  });

  test('a click that has not moved runs no row a corner menu was pushed under it', async ({
    erd,
    page,
  }) => {
    await erd.seed(oneTable());

    const at = { x: 850, y: 258 };
    await erd.hoverAt(at);
    await erd.clickAt(at, { button: 'right' });
    await expect(erd.contextMenuItem('New Table')).toBeVisible();
    await expectOnScreen(rootMenu(erd));
    const row = await rowOf(rootMenu(erd), 'New Table').boundingBox();
    if (!row) throw new Error('no New Table row');
    expect(at.y).toBeGreaterThan(row.y);
    expect(at.y).toBeLessThan(row.y + row.height);

    await page.mouse.down();
    await page.mouse.up();
    await erd.whenDrawn();
    expect(await erd.tableIds()).toHaveLength(1);
    await expect(rootMenu(erd)).toBeVisible();

    await page.mouse.move(at.x - 12, at.y, { steps: 4 });
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => erd.tableIds()).toHaveLength(2);
  });

  test('a submenu row a corner menu was pushed under the pointer opens only once it moves', async ({
    erd,
    page,
  }) => {
    await erd.seed(oneTable());

    const at = { x: 800, y: 400 };
    await erd.hoverAt(at);
    await erd.clickAt(at, { button: 'right' });
    await expect(erd.contextMenuItem('New Table')).toBeVisible();
    await expectOnScreen(rootMenu(erd));
    expect(await menuTakesPointAt(erd, at)).toBe(true);

    const submenus = erd.host.locator(
      '.context-menu-content:not([data-id="root"])'
    );
    // Past the hover Chromium re-runs once the menu has moved under the pointer.
    await page.waitForTimeout(400);
    await expect(submenus).toHaveCount(0);

    const row = await rowOf(rootMenu(erd), 'Export').boundingBox();
    if (!row) throw new Error('no Export row');
    await page.mouse.move(at.x, row.y + row.height / 2, { steps: 4 });
    await expect(submenus).toHaveCount(1);
    await expect(submenus.getByText('json', { exact: false })).toBeVisible();
  });

  test.describe('in a window shorter than the menu', () => {
    const SHORT_VIEWPORT = { width: 960, height: 250 };
    test.use({ viewport: SHORT_VIEWPORT });

    test('a wheel over the canvas menu scrolls its last row into the window and leaves the canvas', async ({
      erd,
      page,
    }) => {
      await erd.seed(oneTable());

      const at = { x: 700, y: 60 };
      await erd.hoverAt(at);
      await erd.clickAt(at, { button: 'right' });
      await expect(erd.contextMenuItem('New Table')).toBeVisible();
      const menu = rootMenu(erd);
      const box = await menu.boundingBox();
      if (!box) throw new Error('the menu has no box');
      const { originX, originY } = await erd.settings();

      await page.mouse.move(box.x + box.width - 16, at.y, { steps: 4 });
      await page.mouse.wheel(0, 200);

      await expect
        .poll(() => menu.evaluate(el => el.scrollTop))
        .toBeGreaterThan(0);
      await erd.whenDrawn();
      expect(await erd.settings()).toMatchObject({ originX, originY });

      const last = await menu
        .locator(':scope > div:not(.context-menu-content)')
        .last()
        .boundingBox();
      if (!last) throw new Error('the menu has no last row');
      expect(last.y + last.height).toBeLessThanOrEqual(SHORT_VIEWPORT.height);
      expect(
        await menuTakesPointAt(erd, {
          x: last.x + last.width / 2,
          y: last.y + last.height / 2,
        })
      ).toBe(true);
    });
  });
});
