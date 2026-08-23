import { expect, test } from '../support/fixtures';
import type { ErdEditorPage, Point } from '../support/ErdEditorPage';
import { createSchema, twoTables } from '../support/schema';
import { Shortcut } from '../support/shortcuts';

/**
 * Alt+drag duplicate, in a real browser.
 *
 * The unit suite runs under happy-dom, which has no layout engine, so it can
 * only assert the ghost's DOM ancestry and its inline `left`/`top` strings. The
 * question those cannot answer — whether the ghost actually lands on top of the
 * entity it stands for once the canvas transform has been applied — is what
 * this spec exists for.
 *
 * A ghost rendered outside `translate(scroll…) scale(zoom)` still looks right at
 * the default zoom 1 / scroll 0, so every geometry assertion here runs at
 * `zoomLevel: 0.5` with a non-zero scroll.
 */

/** Pointer coordinates land on whole device pixels, at both drag endpoints. */
const PIXEL_TOLERANCE = 2;

/** `constants/layout.ts` — the offset for an Alt+click that never travelled. */
const START_ADD = 50;

// The marker is a `display: contents` wrapper carrying the identity
// attributes, so it has no layout box of its own — the entity inside it is
// the real `<Table>`/`<Memo>` and the thing with geometry.
const GHOST = '[data-testid="duplicate-ghost"] > *';

function expectClose(actual: number, expected: number, label: string) {
  expect(
    Math.abs(actual - expected),
    `${label}: expected ${actual} to be within ${PIXEL_TOLERANCE} of ${expected}`
  ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
}

const ghosts = (erd: ErdEditorPage) => erd.canvas.locator(GHOST);

async function originOf(erd: ErdEditorPage, selector: string): Promise<Point> {
  const box = await erd.canvas.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} has no bounding box`);
  return { x: box.x, y: box.y };
}

/**
 * Holds Alt, presses on a table header and walks the pointer to `to`, leaving
 * the button down so the ghost can be measured mid-gesture.
 */
async function startAltDrag(erd: ErdEditorPage, tableId: string, to?: Point) {
  const from = await erd.tableHeaderPoint(tableId);

  await erd.page.keyboard.down('Alt');
  await erd.page.mouse.move(from.x, from.y);
  await erd.page.mouse.down();
  // one settled frame with the button down and no travel yet
  await erd.page.mouse.move(from.x, from.y);

  if (to) {
    for (let step = 1; step <= 8; step++) {
      await erd.page.mouse.move(
        from.x + ((to.x - from.x) * step) / 8,
        from.y + ((to.y - from.y) * step) / 8
      );
    }
  }

  return from;
}

async function endAltDrag(erd: ErdEditorPage) {
  await erd.page.mouse.up();
  await erd.page.keyboard.up('Alt');
}

/** The ids the document gained, in document order. */
function addedIds(before: string[], after: string[]) {
  const had = new Set(before);
  return after.filter(id => !had.has(id));
}

const zoomedTwoTables = () => {
  const schema = twoTables();
  schema.settings.zoomLevel = 0.5;
  schema.settings.scrollLeft = -120;
  schema.settings.scrollTop = -80;
  return schema;
};

test.describe('Alt+drag duplicate', () => {
  // AC-36 (d): the ghost is drawn from document coordinates, so it is only in
  // the right place if it renders inside the canvas transform. Compared as
  // top-left origins with a tolerance — a table's outer box is its width plus
  // its two 1px borders, so the sizes are deliberately not compared.
  test('draws the ghost over the table it stands for at zoom 0.5 and non-zero scroll', async ({
    erd,
  }) => {
    await erd.seed(zoomedTwoTables());

    await startAltDrag(erd, 'users');

    await expect(ghosts(erd)).toHaveCount(1);
    const ghostOrigin = await originOf(erd, GHOST);
    const tableOrigin = await originOf(erd, ':scope > .table[data-id="users"]');

    expectClose(ghostOrigin.x, tableOrigin.x, 'ghost left');
    expectClose(ghostOrigin.y, tableOrigin.y, 'ghost top');

    await endAltDrag(erd);
  });

  // AC-36 (d): and it tracks the pointer one-for-one on screen, which is what
  // says the per-frame `/= zoomLevel` and the `scale(zoomLevel)` cancel out.
  test('moves the ghost with the pointer, one screen pixel per screen pixel', async ({
    erd,
  }) => {
    await erd.seed(zoomedTwoTables());

    const before = await originOf(erd, ':scope > .table[data-id="users"]');
    const from = await erd.tableHeaderPoint('users');
    await startAltDrag(erd, 'users', { x: from.x + 120, y: from.y + 60 });

    const ghostOrigin = await originOf(erd, GHOST);
    expectClose(ghostOrigin.x, before.x + 120, 'ghost left after travel');
    expectClose(ghostOrigin.y, before.y + 60, 'ghost top after travel');

    await endAltDrag(erd);
  });

  // AC-20: the copy follows the cursor while the original stays where it was,
  // and the committed copy lands where the ghost was let go.
  test('leaves the original in place and commits the copy at the drop point', async ({
    erd,
  }) => {
    await erd.seed(zoomedTwoTables());
    const original = await erd.table('users');

    const from = await erd.tableHeaderPoint('users');
    await startAltDrag(erd, 'users', { x: from.x + 100, y: from.y + 50 });

    // still two tables in the document: the preview never reaches the store
    expect(await erd.tableIds()).toEqual(['users', 'posts']);
    expect((await erd.table('users')).ui).toMatchObject({
      x: original.ui.x,
      y: original.ui.y,
    });

    await endAltDrag(erd);

    await expect.poll(() => erd.tableIds()).toHaveLength(3);
    await expect(ghosts(erd)).toHaveCount(0);

    const [copyId] = addedIds(['users', 'posts'], await erd.tableIds());
    const copy = await erd.table(copyId);

    expect((await erd.table('users')).ui).toMatchObject({
      x: original.ui.x,
      y: original.ui.y,
    });
    expect(copy.name).toBe('users');
    // 100 x 50 screen pixels at zoom 0.5 is 200 x 100 canvas units
    expectClose(copy.ui.x, original.ui.x + 200, 'copy x');
    expectClose(copy.ui.y, original.ui.y + 100, 'copy y');
  });

  // AC-21: every selected entity is duplicated and the group keeps its shape.
  test('duplicates the whole selection and keeps the relative layout', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.focusCanvas();
    await erd.press(Shortcut.selectAllTable);
    await expect(erd.selectedTables()).toHaveCount(2);

    const users = await erd.table('users');
    const posts = await erd.table('posts');

    const from = await erd.tableHeaderPoint('users');
    await startAltDrag(erd, 'users', { x: from.x + 80, y: from.y + 40 });
    await expect(ghosts(erd)).toHaveCount(2);
    await endAltDrag(erd);

    await expect.poll(() => erd.tableIds()).toHaveLength(4);

    const copyIds = addedIds(['users', 'posts'], await erd.tableIds());
    const copies = await Promise.all(copyIds.map(id => erd.table(id)));
    const usersCopy = copies.find(table => table.name === 'users')!;
    const postsCopy = copies.find(table => table.name === 'posts')!;

    expect(postsCopy.ui.x - usersCopy.ui.x).toBe(posts.ui.x - users.ui.x);
    expect(postsCopy.ui.y - usersCopy.ui.y).toBe(posts.ui.y - users.ui.y);
    expectClose(usersCopy.ui.x, users.ui.x + 80, 'users copy x');
  });

  // AC-23: the duplicate is one history command, colour included — a
  // `table.changeColor` in the batch would be buffered into a second command
  // and one undo would then restore only the colour.
  test('undoes a coloured duplicate in a single step', async ({ erd }) => {
    await erd.seed(
      createSchema({
        tables: [
          { id: 'users', name: 'users', x: 200, y: 200, color: '#ff0000' },
        ],
      })
    );

    const from = await erd.tableHeaderPoint('users');
    await startAltDrag(erd, 'users', { x: from.x + 90, y: from.y + 45 });
    await endAltDrag(erd);

    await expect.poll(() => erd.tableIds()).toHaveLength(2);
    const [copyId] = addedIds(['users'], await erd.tableIds());
    expect((await erd.table(copyId)).ui.color).toBe('#ff0000');

    // past the 200ms colour buffer, so a split batch has had time to land
    await erd.page.waitForTimeout(400);
    await erd.focusCanvas();
    await erd.press(Shortcut.undo);

    await expect.poll(() => erd.tableIds()).toEqual(['users']);
    expect((await erd.table('users')).ui.color).toBe('#ff0000');
  });

  // AC-34: an Alt+click that never travels still produces a copy, offset so it
  // is not hidden underneath its original, and still only one undo step.
  test('offsets an Alt+click that never moved', async ({ erd }) => {
    await erd.seed(
      createSchema({ tables: [{ id: 'users', name: 'users', x: 200, y: 200 }] })
    );
    const original = await erd.table('users');

    await startAltDrag(erd, 'users');
    await endAltDrag(erd);

    await expect.poll(() => erd.tableIds()).toHaveLength(2);

    const [copyId] = addedIds(['users'], await erd.tableIds());
    const copy = await erd.table(copyId);

    expect(copy.ui.x).toBe(original.ui.x + START_ADD);
    expect(copy.ui.y).toBe(original.ui.y + START_ADD);

    await erd.page.waitForTimeout(400);
    await erd.focusCanvas();
    await erd.press(Shortcut.undo);
    await expect.poll(() => erd.tableIds()).toEqual(['users']);
  });

  // AC-22: without Alt the same gesture still moves the table and creates
  // nothing — the entry check is the only thing that separates them.
  test('still moves the table when Alt is not held', async ({ erd }) => {
    await erd.seed(twoTables());
    const original = await erd.table('users');

    await erd.moveTable('users', 100, 60);

    await expect
      .poll(async () => (await erd.table('users')).ui.x)
      .not.toBe(original.ui.x);
    expect(await erd.tableIds()).toEqual(['users', 'posts']);
    await expect(ghosts(erd)).toHaveCount(0);
  });
});
