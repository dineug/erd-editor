import { expect, test } from '../support/fixtures';
import {
  type ErdDocument,
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
