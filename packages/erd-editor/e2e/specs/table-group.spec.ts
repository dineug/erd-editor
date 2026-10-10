import type { ErdEditorPage, Point } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
  Show,
  type TableSeed,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// Table groups in the real element: made from the canvas menu or the selection,
// joined and left only by a drop, worn on a member's header, carried by the
// title, hidden by View Option and choosing what the Schema SQL tab writes.

const GROUP = 'accounts';

/** An opaque hex, which a member's header band is filled with as it is. */
const COLOR = '#3498db';

/** The box the seeded group stores: users and posts inside it, tags to its right. */
const GROUP_RECT = { x: 120, y: 100, width: 760, height: 560 };

const table = (id: string, x: number, y: number, groupId?: string) =>
  ({
    id,
    name: id,
    x,
    y,
    ...(groupId ? { groupId } : {}),
    columns: [
      {
        id: `${id}_id`,
        name: 'id',
        dataType: 'INT',
        options: ColumnOption.primaryKey | ColumnOption.notNull,
        keys: ColumnUIKey.primaryKey,
      },
      { id: `${id}_label`, name: 'label', dataType: 'VARCHAR(255)' },
    ],
  }) satisfies TableSeed;

/** Three tables in no group, users and posts side by side and tags below them to the right. */
const ungrouped = (): ErdDocument =>
  createSchema({
    tables: [
      table('users', 160, 160),
      table('posts', 520, 160),
      table('tags', 1000, 420),
    ],
  });

/** The same tables, users and posts in a colored group whose box holds them. */
const grouped = (): ErdDocument =>
  createSchema({
    tables: [
      table('users', 160, 160, GROUP),
      table('posts', 520, 160, GROUP),
      table('tags', 1000, 420),
    ],
    tableGroups: [{ id: GROUP, name: GROUP, color: COLOR, ...GROUP_RECT }],
  });

/** The group a table is in, as the document saves it: '' for none. */
const groupOf = async (erd: ErdEditorPage, tableId: string) =>
  (await erd.table(tableId)).groupId ?? '';

const groupIds = async (erd: ErdEditorPage) =>
  (await erd.value()).doc.tableGroupIds ?? [];

const groupEntity = async (erd: ErdEditorPage, id: string) => {
  const entity = (await erd.value()).collections.tableGroupEntities?.[id];
  if (!entity) throw new Error(`no table group ${id}`);
  return entity;
};

/** The fill of a table's header band, which a member takes from its group. */
const bandFill = (erd: ErdEditorPage, tableId: string) =>
  erd.sceneAttr([`#table-${tableId}`, '.table-header-band'], 'fill');

/** The live field the name editor opens over a group's title bar. */
const nameInput = (erd: ErdEditorPage) =>
  erd.host.locator('.edit-overlay input.table-group-name-input');

/** A point on a group's title bar clear of its name, which is what carries the group. */
async function titlePoint(erd: ErdEditorPage, id: string): Promise<Point> {
  const box = await erd.sceneBox([`#table-group-${id}`, '.table-group-title']);
  return { x: box.x + box.width - 24, y: box.y + box.height / 2 };
}

/** Every table's and the group's stored point, which a move changes. */
async function positions(erd: ErdEditorPage) {
  const { collections } = await erd.value();
  const at = ({ ui }: { ui: { x: number; y: number } }) => ({
    x: ui.x,
    y: ui.y,
  });

  return {
    users: at(collections.tableEntities.users),
    posts: at(collections.tableEntities.posts),
    tags: at(collections.tableEntities.tags),
    group: at(await groupEntity(erd, GROUP)),
  };
}

/** View Option ▸ Table Groups, from the canvas menu over bare canvas. */
async function toggleGroups(erd: ErdEditorPage) {
  await erd.clickAt(await erd.emptyPoint(), { button: 'right' });
  await erd.contextMenu.getByText('View Option', { exact: true }).hover();
  await erd.contextMenu
    .nth(1)
    .getByText('Table Groups', { exact: true })
    .click();
}

/** The code the Schema SQL tab shows. */
const codeOf = async (erd: ErdEditorPage) =>
  (
    await erd.host
      .getByRole('textbox', { name: 'Code', exact: true })
      .inputValue()
  ).trim();

const tableChoice = (erd: ErdEditorPage, name: string) =>
  erd.host
    .locator('aside.schema-sql-options')
    .getByRole('group', { name: 'Tables', exact: true })
    .getByRole('checkbox', { name, exact: true });

test.describe('table groups', () => {
  test('New Table Group draws a group round the tables in the box, and its name editor names it', async ({
    erd,
    page,
  }) => {
    await erd.seed(ungrouped());
    await expect(erd.canvas.locator('.table-group')).toHaveCount(0);

    await erd.clickAt(await erd.emptyPoint(), { button: 'right' });
    await erd.contextMenu.getByText('New Table Group', { exact: true }).click();
    await expect(erd.contextMenu).toHaveCount(0);

    // The box holds the centres of users and posts and not that of tags.
    await erd.drag(await erd.pointAt(120, 100), await erd.pointAt(880, 380));

    await expect(nameInput(erd)).toBeFocused();
    await page.keyboard.type(GROUP);
    await page.keyboard.press('Enter');
    await expect(nameInput(erd)).toHaveCount(0);

    await expect.poll(() => groupIds(erd)).toHaveLength(1);
    const [id] = await groupIds(erd);
    const group = await groupEntity(erd, id);
    expect(group.name).toBe(GROUP);
    for (const [key, expected] of Object.entries({
      x: 120,
      y: 100,
      width: 760,
      height: 280,
    })) {
      expect(
        Math.abs(group.ui[key as keyof typeof group.ui] - expected)
      ).toBeLessThanOrEqual(1);
    }
    expect(await groupOf(erd, 'users')).toBe(id);
    expect(await groupOf(erd, 'posts')).toBe(id);
    expect(await groupOf(erd, 'tags')).toBe('');

    const box = erd.canvas.locator(`.table-group[data-id="${id}"]`);
    await expect(box).toHaveCount(1);
    await expect(box.locator('.table-group-name')).toHaveText(GROUP);
  });

  test('Group selected tables wraps the selection, and Remove from group takes one table out', async ({
    erd,
  }) => {
    await erd.seed(ungrouped());
    await erd.marqueeSelect({ x: 120, y: 120 }, { x: 900, y: 340 });
    await expect(erd.selectedTables()).toHaveCount(2);

    await erd.clickAt(await erd.tableHeaderPoint('users'), {
      button: 'right',
    });
    await erd.contextMenu
      .getByText('Group selected tables', { exact: true })
      .click();

    // The editor opens on the new group, and Escape leaves it unnamed.
    await expect(nameInput(erd)).toBeFocused();
    await erd.press(Shortcut.stop);
    await expect(nameInput(erd)).toHaveCount(0);

    await expect.poll(() => groupIds(erd)).toHaveLength(1);
    const [id] = await groupIds(erd);
    expect((await groupEntity(erd, id)).name).toBe('');
    expect(await groupOf(erd, 'users')).toBe(id);
    expect(await groupOf(erd, 'posts')).toBe(id);
    expect(await groupOf(erd, 'tags')).toBe('');

    await erd.clickTableHeader('posts');
    await erd.clickAt(await erd.tableHeaderPoint('posts'), {
      button: 'right',
    });
    await erd.contextMenu
      .getByText('Remove from group', { exact: true })
      .click();

    await expect.poll(() => groupOf(erd, 'posts')).toBe('');
    expect(await groupOf(erd, 'users')).toBe(id);
  });

  test('a table dropped in a group joins it and wears its colour, and one dropped outside leaves it', async ({
    erd,
    page,
  }) => {
    await erd.seed(grouped());
    const plain = await bandFill(erd, 'tags');
    expect(await bandFill(erd, 'users')).toBe(COLOR);
    expect(plain).not.toBe(COLOR);

    // Held over the group, the drag outlines the group the drop lands it in.
    const from = await erd.tableHeaderPoint('tags');
    const to = { x: from.x - 480, y: from.y };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(
        from.x + ((to.x - from.x) * step) / 12,
        from.y + ((to.y - from.y) * step) / 12
      );
    }
    await expect(
      erd.canvas.locator('.table-group-drop-target')
    ).not.toHaveCount(0);
    await page.mouse.up();

    await expect.poll(() => groupOf(erd, 'tags')).toBe(GROUP);
    await expect.poll(() => bandFill(erd, 'tags')).toBe(COLOR);
    await expect(erd.canvas.locator('.table-group-drop-target')).toHaveCount(0);

    await erd.moveTable('posts', 480, 0);

    await expect.poll(() => groupOf(erd, 'posts')).toBe('');
    await expect.poll(() => bandFill(erd, 'posts')).toBe(plain);
    expect(await groupOf(erd, 'users')).toBe(GROUP);
  });

  test('dragging the title moves the group with its tables, and one undo puts them back', async ({
    erd,
  }) => {
    await erd.seed(grouped());
    const before = await positions(erd);
    const shift = (point: Point) => ({ x: point.x + 120, y: point.y + 80 });

    const from = await titlePoint(erd, GROUP);
    await erd.drag(from, shift(from));

    await expect
      .poll(() => positions(erd))
      .toEqual({
        users: shift(before.users),
        posts: shift(before.posts),
        tags: before.tags,
        group: shift(before.group),
      });
    await expect(
      erd.canvas.locator(`.table-group[data-id="${GROUP}"]`)
    ).toHaveAttribute('data-selected');
    expect(await groupOf(erd, 'users')).toBe(GROUP);
    expect(await groupOf(erd, 'posts')).toBe(GROUP);

    await erd.undo();

    await expect.poll(() => positions(erd)).toEqual(before);
  });

  test('View Option hides the groups and their colour, and a table dragged meanwhile keeps its group', async ({
    erd,
  }) => {
    await erd.seed(grouped());
    const plain = await bandFill(erd, 'tags');
    await expect(erd.canvas.locator('.table-group')).toHaveCount(1);

    await toggleGroups(erd);

    await expect(erd.canvas.locator('.table-group')).toHaveCount(0);
    await expect
      .poll(async () => (await erd.settings()).show & Show.hideTableGroup)
      .toBe(Show.hideTableGroup);
    await expect.poll(() => bandFill(erd, 'users')).toBe(plain);

    // Below the box, where a drop would take it out of the group were groups shown.
    await erd.moveTable('users', 0, 500);
    await expect
      .poll(async () => (await erd.table('users')).ui.y)
      .toBe(160 + 500);
    expect(await groupOf(erd, 'users')).toBe(GROUP);

    await toggleGroups(erd);

    await expect(erd.canvas.locator('.table-group')).toHaveCount(1);
    await expect.poll(() => bandFill(erd, 'users')).toBe(COLOR);
    // The box grows round the member rather than letting it out.
    const groupBox = await erd.sceneBox(`#table-group-${GROUP}`);
    const usersBox = await erd.sceneBox('#table-users');
    expect(groupBox.y + groupBox.height).toBeGreaterThan(
      usersBox.y + usersBox.height
    );
  });

  test('Schema SQL writes only the tables of the groups checked under Tables', async ({
    erd,
  }) => {
    await erd.seed(grouped());
    await erd.toolbarButton('Schema SQL').click();

    await expect(tableChoice(erd, 'All')).toBeChecked();
    await expect(tableChoice(erd, GROUP)).toBeChecked();
    await expect(tableChoice(erd, 'No group')).toBeChecked();
    await expect.poll(() => codeOf(erd)).toMatch(/\busers\b/);
    let code = await codeOf(erd);
    expect(code).toMatch(/\bposts\b/);
    expect(code).toMatch(/\btags\b/);

    await tableChoice(erd, GROUP).uncheck();

    await expect.poll(() => codeOf(erd)).not.toMatch(/\busers\b/);
    code = await codeOf(erd);
    expect(code).not.toMatch(/\bposts\b/);
    expect(code).toMatch(/\btags\b/);
    await expect(tableChoice(erd, 'All')).not.toBeChecked();
    expect(
      await tableChoice(erd, 'All').evaluate(
        element => (element as HTMLInputElement).indeterminate
      )
    ).toBe(true);

    await tableChoice(erd, 'No group').uncheck();

    await expect(
      erd.host.getByText('No tables chosen. Check some under Tables.', {
        exact: true,
      })
    ).toBeVisible();
    await expect.poll(() => codeOf(erd)).toBe('');

    await tableChoice(erd, 'All').check();

    await expect(tableChoice(erd, GROUP)).toBeChecked();
    await expect.poll(() => codeOf(erd)).toMatch(/\busers\b/);
    code = await codeOf(erd);
    expect(code).toMatch(/\bposts\b/);
    expect(code).toMatch(/\btags\b/);
  });
});
