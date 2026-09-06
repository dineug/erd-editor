import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { Shortcut } from '../support/shortcuts';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
  RelationshipType,
} from '../support/schema';

// The one layer that reads the built package rather than the sources. ELK is a
// commonjs bundle reached from a worker, and how a bundler orders that import
// against the realm stub before it is a question only a build can answer.

/** Bare canvas clear of every seeded table, high enough for the menu to fit. */
const MENU_ORIGIN = { x: 200, y: 200 };

/** ELK is megabytes of script the worker parses before it answers anything. */
const PLACEMENT_TIMEOUT = 45_000;

const column = (id: string, name: string, key = false) => ({
  id,
  name,
  dataType: 'int',
  ...(key
    ? {
        options: ColumnOption.primaryKey | ColumnOption.notNull,
        keys: ColumnUIKey.primaryKey,
      }
    : {}),
});

const relate = (id: string, start: string, end: string, endColumn: string) => ({
  id,
  relationshipType: RelationshipType.ZeroN,
  startTableId: start,
  startColumnIds: [`${start}_id`],
  endTableId: end,
  endColumnIds: [endColumn],
});

/**
 * Three tables in one chain, seeded in an order no layout would choose: the end
 * of the chain sits left of its middle, so a spec that never reached ELK cannot
 * pass by accident.
 */
const chainedTables = (): ErdDocument =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 700,
        y: 100,
        columns: [column('users_id', 'id', true)],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 1_300,
        y: 600,
        columns: [column('posts_id', 'id', true), column('posts_user', 'user')],
      },
      {
        id: 'comments',
        name: 'comments',
        x: 900,
        y: 1_100,
        columns: [
          column('comments_id', 'id', true),
          column('comments_post', 'post'),
        ],
      },
    ],
    relationships: [
      relate('users_posts', 'users', 'posts', 'posts_user'),
      relate('posts_comments', 'posts', 'comments', 'comments_post'),
    ],
  });

async function place(erd: ErdEditorPage, placement: string) {
  await erd.openContextMenuAt(MENU_ORIGIN.x, MENU_ORIGIN.y);
  await erd.contextMenu.getByText('Auto Layout', { exact: true }).hover();

  const item = erd.contextMenu.getByText(placement, { exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

/** Where each table sits, read back through the element's own value. */
async function cornersOf(erd: ErdEditorPage) {
  const { collections } = await erd.value();

  return Object.fromEntries(
    Object.values(collections.tableEntities).map(table => [
      table.id,
      { x: table.ui.x, y: table.ui.y },
    ])
  );
}

/** Waits for the placement to land, which is the only thing it waits for. */
async function placed(erd: ErdEditorPage, before: Record<string, unknown>) {
  await expect
    .poll(() => cornersOf(erd), { timeout: PLACEMENT_TIMEOUT })
    .not.toEqual(before);
}

test.describe('automatic table placement through the elk worker', () => {
  test('lays a chain out left to right, taking the layout as it lands', async ({
    erd,
  }) => {
    await erd.seed(chainedTables());
    const before = await cornersOf(erd);

    await place(erd, 'Tree - horizontal');
    await placed(erd, before);

    const after = await cornersOf(erd);
    expect(after.posts.x).toBeGreaterThan(after.users.x);
    expect(after.comments.x).toBeGreaterThan(after.posts.x);
  });

  test('lays the same chain top to bottom for the vertical placement', async ({
    erd,
  }) => {
    await erd.seed(chainedTables());
    const before = await cornersOf(erd);

    await place(erd, 'Tree - vertical');
    await placed(erd, before);

    const after = await cornersOf(erd);
    expect(after.posts.y).toBeGreaterThan(after.users.y);
    expect(after.comments.y).toBeGreaterThan(after.posts.y);
  });

  // What the overlay used to ask for with an Apply button, and the reason it
  // no longer does: a placement is one undo step like any other move.
  test('puts every table back on a single undo', async ({ erd }) => {
    await erd.seed(chainedTables());
    const before = await cornersOf(erd);

    await place(erd, 'Flow');
    await placed(erd, before);
    await erd.press(Shortcut.undo);

    await expect.poll(() => cornersOf(erd)).toEqual(before);
  });
});
