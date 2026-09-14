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
