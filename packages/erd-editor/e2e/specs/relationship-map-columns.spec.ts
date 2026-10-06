import type { Locator } from '@playwright/test';

import {
  type Box,
  type ErdEditorPage,
  type Point,
} from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  type ColumnSeed,
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
  ReferentialAction,
  type RelationshipSeed,
  RelationshipType,
  type TableSeed,
} from '../support/schema';
import { Shortcut, ZOOM_STEP } from '../support/shortcuts';

// The buttons a relationship draw shows beside the table it would end on, and
// Map Columns, which links a parent's key to columns the child already has and
// changes a relationship's columns later from the relationship menu.

/** Both buttons and their padding, the size the stylesheet gives them. */
const PILL = { width: 36, height: 64 };

/** Room between the buttons and the table. */
const PILL_MARGIN = 8;

const KEY = ColumnOption.primaryKey | ColumnOption.notNull;

const keyColumn = (id: string, name = 'id', dataType = 'int'): ColumnSeed => ({
  id,
  name,
  dataType,
  options: KEY,
  keys: ColumnUIKey.primaryKey,
});

const column = (id: string, name: string, dataType = 'int'): ColumnSeed => ({
  id,
  name,
  dataType,
});

/**
 * A parent, users, and a child, posts, with columns a key can be mapped onto,
 * beside the tables and relationships given.
 */
const usersAndPosts = (
  tables: TableSeed[] = [],
  relationships: RelationshipSeed[] = []
) =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 160,
        y: 160,
        columns: [
          keyColumn('users_id'),
          column('users_name', 'name', 'varchar(255)'),
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 760,
        y: 420,
        columns: [
          keyColumn('posts_id'),
          {
            ...column('posts_user_id', 'user_id'),
            keys: relationships.length ? ColumnUIKey.foreignKey : 0,
          },
          column('posts_author_id', 'author_id', 'varchar(36)'),
          column('posts_title', 'title', 'varchar(255)'),
        ],
      },
      ...tables,
    ],
    relationships,
  });

/** usersAndPosts with posts.user_id already linked to users.id. */
const linkedPosts = (onDelete?: number): ErdDocument =>
  usersAndPosts(
    [],
    [
      {
        id: 'users_posts',
        relationshipType: RelationshipType.OneN,
        startTableId: 'users',
        startColumnIds: ['users_id'],
        endTableId: 'posts',
        endColumnIds: ['posts_user_id'],
        onDelete,
      },
    ]
  );

const pillOf = (erd: ErdEditorPage) => erd.host.locator('.draw-target-buttons');

const mapButtonOf = (erd: ErdEditorPage) =>
  erd.host.locator('.draw-target-map');

const newButtonOf = (erd: ErdEditorPage) =>
  erd.host.locator('.draw-target-new');

const outlineOf = (erd: ErdEditorPage) =>
  erd.host.locator('.draw-target-outline');

const dialogOf = (erd: ErdEditorPage) =>
  erd.host.getByRole('dialog', { name: 'Map Columns' });

const button = (dialog: Locator, name: string) =>
  dialog.getByRole('button', { name, exact: true });

/** The child column list of each row, in row order. */
const childSelects = (dialog: Locator) =>
  dialog.getByRole('combobox', { name: 'Foreign key column' });

const referencesOf = (dialog: Locator) =>
  dialog.getByRole('combobox', { name: 'References' });

/** The text of the option each select shows picked. */
const pickedLabels = (selects: Locator) =>
  selects.evaluateAll(elements =>
    elements.map(
      element =>
        (element as HTMLSelectElement).selectedOptions[0]?.textContent ?? ''
    )
  );

const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('no bounding box');
  return box;
};

const centre = (box: Box): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

const expectBoxClose = (actual: Box, expected: Box) => {
  expect(actual.x).toBeCloseTo(expected.x, 0);
  expect(actual.y).toBeCloseTo(expected.y, 0);
  expect(actual.width).toBeCloseTo(expected.width, 0);
  expect(actual.height).toBeCloseTo(expected.height, 0);
};

/** Whether two boxes share any area, touching edges aside. */
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const tableBox = (erd: ErdEditorPage, id: string) =>
  erd.sceneBox(`#table-${id}`);

/**
 * Arms a draw and presses its start table, leaving the preview in flight. The
 * canvas takes the keyboard from a press at the scene point given, else from
 * one at a point clear of every table.
 */
async function startDraw(
  erd: ErdEditorPage,
  startId: string,
  { focusAt }: { focusAt?: Point } = {}
) {
  await erd.focusCanvas(focusAt);
  await erd.press(Shortcut.relationshipZeroN);
  await erd.clickTableHeader(startId);
  await expect(erd.drawPreview).toBeVisible();
}

/** Points at the table's middle and waits for the buttons beside it. */
async function hoverTarget(erd: ErdEditorPage, id: string) {
  await erd.hoverScene(`#table-${id}`);
  await expect(pillOf(erd)).toBeVisible();
}

/** Draws from one table to the other and opens Map Columns with the buttons. */
async function openMapFromDraw(
  erd: ErdEditorPage,
  startId: string,
  endId: string
) {
  await startDraw(erd, startId);
  await hoverTarget(erd, endId);
  await mapButtonOf(erd).click();

  const dialog = dialogOf(erd);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Opens Map Columns on a relationship from its own menu. */
async function openMapFromMenu(erd: ErdEditorPage, relationshipId: string) {
  await erd.clickAt(await erd.sceneHitPoint(relationshipId), {
    button: 'right',
  });
  await erd.contextMenu.getByText('Map Columns', { exact: true }).click();

  const dialog = dialogOf(erd);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The relationships a spec added, read back from the document. */
async function addedRelationships(erd: ErdEditorPage, before: string[]) {
  const document = await erd.value();
  return document.doc.relationshipIds
    .filter(id => !before.includes(id))
    .map(id => document.collections.relationshipEntities[id]);
}

const hasForeignKeyMark = async (erd: ErdEditorPage, columnId: string) =>
  ((await erd.column(columnId)).ui.keys & ColumnUIKey.foreignKey) !== 0;

test.describe('the buttons beside the table a relationship is drawn to', () => {
  test('hovering the target table shows the two buttons on its left and outlines it', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await startDraw(erd, 'users');
    await expect(pillOf(erd)).toHaveCount(0);

    await hoverTarget(erd, 'posts');

    const card = await tableBox(erd, 'posts');
    const pill = await boxOf(pillOf(erd));
    await expect(pillOf(erd)).toHaveAttribute('data-side', 'left');
    expect(pill.width).toBeCloseTo(PILL.width, 0);
    expect(pill.height).toBeCloseTo(PILL.height, 0);
    expect(pill.x + pill.width).toBeCloseTo(card.x - PILL_MARGIN, 0);
    expect(pill.y).toBeCloseTo(card.y, 0);
    await expect(mapButtonOf(erd)).toHaveAttribute(
      'title',
      'Map to existing columns'
    );
    await expect(newButtonOf(erd)).toHaveAttribute(
      'title',
      'Create new columns'
    );
    expectBoxClose(await boxOf(outlineOf(erd)), card);

    await erd.press(Shortcut.stop);

    await expect(pillOf(erd)).toHaveCount(0);
    await expect(outlineOf(erd)).toHaveCount(0);
  });

  test('the draw preview keeps following the pointer over the buttons', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await startDraw(erd, 'users');
    await hoverTarget(erd, 'posts');

    const pill = await boxOf(pillOf(erd));
    const aim = {
      x: Math.round(pill.x + pill.width / 2),
      y: Math.round(pill.y + 4),
    };
    await erd.hoverAt(aim);

    const expected = await erd.scenePointAt(aim);
    await expect
      .poll(async () => {
        const data = String(
          await erd.sceneAttr(
            ['#draw-relationship', '.draw-relationship-preview'],
            'data'
          )
        );
        const match = /L\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/.exec(data);
        return match ? [Math.round(+match[1]), Math.round(+match[2])] : null;
      })
      .toEqual([Math.round(expected.x), Math.round(expected.y)]);
    await expect(pillOf(erd)).toBeVisible();
  });

  test('of two overlapping tables at the same z-index the one drawn on top is outlined and a press there links it', async ({
    erd,
  }) => {
    const document = usersAndPosts([
      {
        id: 'under',
        name: 'under',
        x: 700,
        y: 160,
        zIndex: 2,
        columns: [keyColumn('under_id')],
      },
      {
        id: 'over',
        name: 'over',
        x: 760,
        y: 190,
        zIndex: 2,
        columns: [keyColumn('over_id')],
      },
    ]);
    await erd.seed(document);
    await startDraw(erd, 'users');

    const under = await tableBox(erd, 'under');
    const over = await tableBox(erd, 'over');
    const aim = {
      x: Math.round(over.x + 10),
      y: Math.round(Math.min(under.y + under.height, over.y + over.height) - 4),
    };
    expect(aim.x).toBeLessThan(under.x + under.width);
    await erd.hoverAt(aim);

    await expect(pillOf(erd)).toBeVisible();
    expectBoxClose(await boxOf(outlineOf(erd)), over);

    await erd.page.mouse.down();
    await erd.page.mouse.up();

    const [relationship] = await addedRelationships(erd, []);
    expect(relationship.end.tableId).toBe('over');
  });

  test('the plus button draws what a press on the table draws', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await startDraw(erd, 'users');
    await hoverTarget(erd, 'posts');

    await newButtonOf(erd).click();

    const [relationship] = await addedRelationships(erd, []);
    expect(relationship.relationshipType).toBe(RelationshipType.ZeroN);
    expect(relationship.start).toMatchObject({
      tableId: 'users',
      columnIds: ['users_id'],
    });
    const columnIds = await erd.columnIds('posts');
    const minted = columnIds[columnIds.length - 1];
    expect(columnIds).toHaveLength(5);
    expect(relationship.end).toMatchObject({
      tableId: 'posts',
      columnIds: [minted],
    });
    expect(await erd.column(minted)).toMatchObject({
      name: 'users_id',
      dataType: 'int',
      options: ColumnOption.notNull,
    });
    await expect(pillOf(erd)).toHaveCount(0);
    await expect(erd.drawPreview).toHaveCount(0);

    await erd.undo();

    await expect.poll(() => erd.relationshipIds()).toEqual([]);
    expect(await erd.columnIds('posts')).toHaveLength(4);
  });

  test('a click on the table after the buttons show still mints new columns', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await startDraw(erd, 'users');
    await hoverTarget(erd, 'posts');

    await erd.clickTableHeader('posts');

    const [relationship] = await addedRelationships(erd, []);
    const columnIds = await erd.columnIds('posts');
    expect(columnIds).toHaveLength(5);
    expect(relationship.end.columnIds).toEqual([
      columnIds[columnIds.length - 1],
    ]);
    await expect(pillOf(erd)).toHaveCount(0);
  });
});

test.describe('Map Columns', () => {
  test('Map links existing columns in one undo and renames nothing', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    const columnsBefore = await erd.columnIds('posts');
    const dialog = await openMapFromDraw(erd, 'users', 'posts');
    const [child] = await childSelects(dialog).all();

    await expect(dialog.locator('.map-columns-subtitle')).toHaveText(
      'users → posts · Zero N'
    );
    expect(await pickedLabels(childSelects(dialog))).toEqual(['Pick a column']);
    await expect(button(dialog, 'Map')).toBeDisabled();

    await child.selectOption({ label: 'user_id (int)' });
    await button(dialog, 'Map').click();

    await expect(dialog).toHaveCount(0);
    const [relationship] = await addedRelationships(erd, []);
    expect(relationship).toMatchObject({
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: 'users', columnIds: ['users_id'] },
      end: { tableId: 'posts', columnIds: ['posts_user_id'] },
    });
    expect(await erd.columnIds('posts')).toEqual(columnsBefore);
    expect((await erd.column('posts_user_id')).name).toBe('user_id');
    await expect.poll(() => hasForeignKeyMark(erd, 'posts_user_id')).toBe(true);

    await erd.undo();

    await expect.poll(() => erd.relationshipIds()).toEqual([]);
    expect(await erd.columnIds('posts')).toEqual(columnsBefore);
    await expect
      .poll(() => hasForeignKeyMark(erd, 'posts_user_id'))
      .toBe(false);
  });

  test('a composite key maps row by row, prefilled where exactly one name matches', async ({
    erd,
  }) => {
    await erd.seed(
      createSchema({
        tables: [
          {
            id: 'orders',
            name: 'orders',
            x: 160,
            y: 160,
            columns: [
              keyColumn('orders_tenant_id', 'tenant_id'),
              keyColumn('orders_id'),
            ],
          },
          {
            id: 'items',
            name: 'order_items',
            x: 760,
            y: 420,
            columns: [
              keyColumn('items_id'),
              column('items_tenant_id', 'tenant_id'),
              column('items_order_id', 'order_id'),
              column('items_quantity', 'quantity'),
            ],
          },
        ],
      })
    );
    const dialog = await openMapFromDraw(erd, 'orders', 'items');

    expect(await pickedLabels(childSelects(dialog))).toEqual([
      'tenant_id (int)',
      'Pick a column',
    ]);
    await expect(childSelects(dialog).nth(1)).toBeFocused();

    await childSelects(dialog).nth(1).selectOption({ label: 'order_id (int)' });
    await button(dialog, 'Map').click();

    const [relationship] = await addedRelationships(erd, []);
    expect(relationship.start.columnIds).toEqual([
      'orders_tenant_id',
      'orders_id',
    ]);
    expect(relationship.end.columnIds).toEqual([
      'items_tenant_id',
      'items_order_id',
    ]);
  });

  test('References lists a unique column only when the parent has one', async ({
    erd,
  }) => {
    await erd.seed(
      usersAndPosts([
        {
          id: 'vehicle',
          name: 'vehicle',
          x: 160,
          y: 520,
          columns: [
            keyColumn('vehicle_id'),
            {
              ...column('vehicle_vin', 'vin', 'varchar(17)'),
              options: ColumnOption.unique,
            },
          ],
        },
        {
          id: 'sales',
          name: 'sales',
          x: 760,
          y: 120,
          columns: [
            keyColumn('sales_id'),
            column('sales_vin', 'vin', 'varchar(17)'),
          ],
        },
      ])
    );

    const plain = await openMapFromDraw(erd, 'users', 'posts');
    await expect(referencesOf(plain)).toHaveCount(0);
    await button(plain, 'Cancel').click();
    await expect(plain).toHaveCount(0);

    const dialog = await openMapFromDraw(erd, 'vehicle', 'sales');
    const references = referencesOf(dialog);
    await expect(references.locator('option')).toHaveText([
      'Primary Key',
      'Unique: vin',
    ]);
    expect(await pickedLabels(childSelects(dialog))).toEqual(['Pick a column']);

    await references.selectOption({ label: 'Unique: vin' });

    expect(await pickedLabels(childSelects(dialog))).toEqual([
      'vin (varchar(17))',
    ]);
    await button(dialog, 'Map').click();

    const [relationship] = await addedRelationships(erd, []);
    expect(relationship.start.columnIds).toEqual(['vehicle_vin']);
    expect(relationship.end.columnIds).toEqual(['sales_vin']);
  });

  test('a self reference shows the buttons once the pointer travels 24 px', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await erd.focusCanvas();
    await erd.press(Shortcut.relationshipZeroN);
    const press = await erd.tableHeaderPoint('users');
    await erd.clickAt(press);
    await expect(erd.drawPreview).toBeVisible();

    await erd.hoverAt({ x: press.x + 12, y: press.y + 10 });
    await erd.whenDrawn();
    await expect(pillOf(erd)).toHaveCount(0);

    await erd.hoverAt({ x: press.x, y: press.y + 40 });

    await expect(pillOf(erd)).toBeVisible();
    expectBoxClose(await boxOf(outlineOf(erd)), await tableBox(erd, 'users'));
  });

  test('a press before that travel draws today’s self reference', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await erd.focusCanvas();
    await erd.press(Shortcut.relationshipZeroN);
    // Below the header and on the first row, two shapes, so the second press
    // is no double click; 10 px apart, short of the travel the buttons wait for.
    const row = await erd.sceneBox('#column-users_id');
    const first = { x: row.x + 30, y: row.y - 4 };
    const second = { x: row.x + 30, y: row.y + 6 };

    await erd.clickAt(first);
    await expect(erd.drawPreview).toBeVisible();
    await erd.hoverAt(second);
    await erd.whenDrawn();
    await expect(pillOf(erd)).toHaveCount(0);
    await erd.clickAt(second);

    const [relationship] = await addedRelationships(erd, []);
    const columnIds = await erd.columnIds('users');
    expect(relationship.start.tableId).toBe('users');
    expect(relationship.end).toMatchObject({
      tableId: 'users',
      columnIds: [columnIds[columnIds.length - 1]],
    });
    expect(columnIds).toHaveLength(3);
  });

  test('a shared tenant_id self reference maps (tenant_id, manager_id)', async ({
    erd,
  }) => {
    await erd.seed(
      createSchema({
        tables: [
          {
            id: 'employee',
            name: 'employee',
            x: 300,
            y: 200,
            columns: [
              keyColumn('employee_tenant_id', 'tenant_id'),
              keyColumn('employee_id'),
              column('employee_manager_id', 'manager_id'),
              column('employee_name', 'name', 'varchar(255)'),
            ],
          },
        ],
      })
    );
    await erd.focusCanvas();
    await erd.press(Shortcut.relationshipZeroN);
    const press = await erd.tableHeaderPoint('employee');
    await erd.clickAt(press);
    await erd.hoverAt({ x: press.x, y: press.y + 60 });
    await expect(pillOf(erd)).toBeVisible();
    await mapButtonOf(erd).click();
    const dialog = dialogOf(erd);
    await expect(dialog).toBeVisible();

    // Nothing is offered for a column to reference itself.
    expect(await pickedLabels(childSelects(dialog))).toEqual([
      'Pick a column',
      'Pick a column',
    ]);
    await childSelects(dialog)
      .nth(0)
      .selectOption({ label: 'tenant_id (int)' });
    await childSelects(dialog)
      .nth(1)
      .selectOption({ label: 'manager_id (int)' });
    await button(dialog, 'Map').click();

    const [relationship] = await addedRelationships(erd, []);
    expect(relationship).toMatchObject({
      start: {
        tableId: 'employee',
        columnIds: ['employee_tenant_id', 'employee_id'],
      },
      end: {
        tableId: 'employee',
        columnIds: ['employee_tenant_id', 'employee_manager_id'],
      },
    });
  });

  test('the relationship menu edits the mapping in place: id, type and ON DELETE stay, one undo', async ({
    erd,
  }) => {
    await erd.seed(linkedPosts(ReferentialAction.cascade));
    const dialog = await openMapFromMenu(erd, 'users_posts');

    await expect(dialog.locator('.map-columns-subtitle')).toHaveText(
      'users → posts · One N'
    );
    expect(await pickedLabels(childSelects(dialog))).toEqual(['user_id (int)']);
    await expect(button(dialog, 'Save')).toBeDisabled();

    await childSelects(dialog).selectOption({
      label: 'author_id (varchar(36))',
    });
    await button(dialog, 'Save').click();

    await expect(dialog).toHaveCount(0);
    expect(await erd.relationshipIds()).toEqual(['users_posts']);
    expect(await erd.relationship('users_posts')).toMatchObject({
      relationshipType: RelationshipType.OneN,
      onDelete: ReferentialAction.cascade,
      end: { tableId: 'posts', columnIds: ['posts_author_id'] },
    });

    await erd.undo();

    await expect
      .poll(async () => (await erd.relationship('users_posts')).end.columnIds)
      .toEqual(['posts_user_id']);
    expect((await erd.column('posts_author_id')).dataType).toBe('varchar(36)');
  });

  test('the column a mapping no longer uses stays and loses its FK mark', async ({
    erd,
  }) => {
    await erd.seed(linkedPosts());
    await expect(erd.columnKey('posts_user_id', 'fk')).toBeVisible();
    const dialog = await openMapFromMenu(erd, 'users_posts');

    await childSelects(dialog).selectOption({
      label: 'author_id (varchar(36))',
    });
    await button(dialog, 'Save').click();

    await expect(erd.columnKey('posts_author_id', 'fk')).toBeVisible();
    await expect(erd.columnKey('posts_user_id', 'fk')).toHaveCount(0);
    expect(await erd.columnIds('posts')).toContain('posts_user_id');
    expect(await erd.column('posts_user_id')).toMatchObject({
      name: 'user_id',
      dataType: 'int',
    });
  });

  test('a removed column shows as (removed) and blocks Save until another is picked', async ({
    erd,
  }) => {
    const document = linkedPosts();
    const { tableColumnEntities, relationshipEntities } = document.collections;
    tableColumnEntities.posts_old = {
      ...tableColumnEntities.posts_user_id,
      id: 'posts_old',
      name: 'old_user_id',
    };
    relationshipEntities.users_posts.end.columnIds = ['posts_old'];
    tableColumnEntities.posts_user_id.ui.keys = 0;
    await erd.seed(document);
    const dialog = await openMapFromMenu(erd, 'users_posts');

    expect(await pickedLabels(childSelects(dialog))).toEqual(['(removed)']);
    await expect(button(dialog, 'Save')).toBeDisabled();

    await childSelects(dialog).selectOption({ label: 'user_id (int)' });
    await expect(button(dialog, 'Save')).toBeEnabled();
    await button(dialog, 'Save').click();

    await expect
      .poll(async () => (await erd.relationship('users_posts')).end.columnIds)
      .toEqual(['posts_user_id']);
  });
});

test.describe('where the buttons stand', () => {
  /**
   * users drawn to posts with a neighbour, tags, flush against posts' left
   * edge at the zoom given, so the strip beside the buttons lies over it.
   */
  async function seedNeighbour(erd: ErdEditorPage, zoomLevel: number) {
    const tags = (x: number): TableSeed => ({
      id: 'tags',
      name: 'tags',
      x,
      y: 420,
      zIndex: 2,
      columns: [keyColumn('tags_id'), column('tags_label', 'label', 'text')],
    });
    const layout = (x: number) => {
      const document = usersAndPosts([tags(x)]);
      document.settings.zoomLevel = zoomLevel;
      document.settings.originX = 0;
      document.settings.originY = 0;
      document.collections.tableEntities.posts.ui.zIndex = 2;
      return document;
    };

    await erd.seed(layout(300));
    const width = (await tableBox(erd, 'tags')).width / zoomLevel;
    await erd.seed(layout(760 - width));
  }

  for (const zoomLevel of [1, 0.3]) {
    test(`a press over the gutter on a neighbour creates nothing, a press on the neighbour past it targets it, at zoom ${zoomLevel}`, async ({
      erd,
    }) => {
      await seedNeighbour(erd, zoomLevel);
      await startDraw(erd, 'users');
      await hoverTarget(erd, 'posts');

      const posts = await tableBox(erd, 'posts');
      const tags = await tableBox(erd, 'tags');
      const pill = await boxOf(pillOf(erd));
      const y = Math.round(posts.y + Math.min(20, posts.height / 2));
      const overGutter = { x: Math.round(posts.x - 4), y };
      expect(overGutter.x).toBeGreaterThan(tags.x);

      await erd.hoverAt(overGutter);
      await erd.page.mouse.down();
      await erd.page.mouse.up();

      expect(await erd.relationshipIds()).toEqual([]);
      await expect(erd.drawPreview).toBeVisible();
      // A table drawn by its name alone is a little narrower than the box the
      // outline and the target read, so its corner is what both share.
      const outline = await boxOf(outlineOf(erd));
      expect(outline.x).toBeCloseTo(posts.x, 0);
      expect(outline.y).toBeCloseTo(posts.y, 0);

      const pastGutter = { x: Math.round(pill.x - 10), y };
      expect(pastGutter.x).toBeGreaterThan(tags.x);
      await erd.hoverAt(pastGutter);
      await expect
        .poll(async () => (await boxOf(outlineOf(erd))).x)
        .toBeCloseTo(tags.x, 0);
      await erd.page.mouse.down();
      await erd.page.mouse.up();

      const [relationship] = await addedRelationships(erd, []);
      expect(relationship.end.tableId).toBe('tags');
    });
  }

  test('a press over the gutter on the start table draws no self reference', async ({
    erd,
  }) => {
    const layout = (x: number) => {
      const document = usersAndPosts();
      Object.assign(document.collections.tableEntities.users.ui, { x, y: 420 });
      return document;
    };
    await erd.seed(layout(160));
    await erd.seed(layout(760 - (await tableBox(erd, 'users')).width));
    await startDraw(erd, 'users');
    await hoverTarget(erd, 'posts');

    const posts = await tableBox(erd, 'posts');
    await erd.hoverAt({
      x: Math.round(posts.x - 4),
      y: Math.round(posts.y + 20),
    });
    await erd.page.mouse.down();
    await erd.page.mouse.up();

    expect(await erd.relationshipIds()).toEqual([]);
    expect(await erd.columnIds('users')).toEqual(['users_id', 'users_name']);
    await expect(erd.drawPreview).toBeVisible();
    expectBoxClose(await boxOf(outlineOf(erd)), posts);
  });

  for (const zoomLevel of [0.5, 0.3]) {
    test(`the buttons keep their screen size beside zoomed out tables at ${zoomLevel}`, async ({
      erd,
    }) => {
      const document = usersAndPosts();
      document.settings.zoomLevel = zoomLevel;
      await erd.seed(document);
      await startDraw(erd, 'users');

      await hoverTarget(erd, 'posts');

      const pill = await boxOf(pillOf(erd));
      const card = await tableBox(erd, 'posts');
      expect(pill.width).toBeCloseTo(PILL.width, 0);
      expect(pill.height).toBeCloseTo(PILL.height, 0);
      expect(pill.x + pill.width).toBeCloseTo(card.x - PILL_MARGIN, 0);
    });
  }

  test('a table taller than the canvas keeps its buttons in view', async ({
    erd,
  }) => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      column(`log_${index}`, `field_${index}`)
    );
    const document = usersAndPosts([
      { id: 'log', name: 'log', x: 1100, y: -300, columns: rows },
    ]);
    document.settings.originX = 0;
    document.settings.originY = 0;
    await erd.seed(document);
    const root = await boxOf(erd.host.locator('[data-testid="erd-canvas"]'));
    const card = await tableBox(erd, 'log');
    expect(card.y).toBeLessThan(root.y);
    expect(card.y + card.height).toBeGreaterThan(root.y + root.height);

    // Clear of the scrollbar, where the first free point beside so tall a
    // table would be, whose track a press scrolls.
    await startDraw(erd, 'users', { focusAt: { x: 640, y: 120 } });
    await erd.hoverAt({
      x: Math.round(card.x + card.width / 2),
      y: Math.round(root.y + root.height / 2),
    });

    await expect(pillOf(erd)).toBeVisible();
    const pill = await boxOf(pillOf(erd));
    expect(pill.y).toBeCloseTo(root.y + PILL_MARGIN, 0);
    expect(pill.x + pill.width).toBeCloseTo(card.x - PILL_MARGIN, 0);
  });

  test('the buttons flip right when the left edge has no room and stay clear of the minimap', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    const opening = await boxOf(erd.minimap);
    // Under the minimap's left part, from a little below its top to well past
    // its foot, so the buttons' place beside the table's top would cover it.
    const corner = await erd.scenePointAt({
      x: opening.x + 60,
      y: opening.y + 20,
    });
    await erd.seed(
      usersAndPosts([
        {
          id: 'edge',
          name: 'edge',
          x: 20,
          y: 560,
          columns: [keyColumn('edge_id')],
        },
        {
          id: 'corner',
          name: 'corner',
          x: Math.round(corner.x),
          y: Math.round(corner.y),
          columns: Array.from({ length: 12 }, (_, index) =>
            column(`corner_${index}`, `field_${index}`)
          ),
        },
      ])
    );
    await startDraw(erd, 'users');

    await hoverTarget(erd, 'edge');

    const edge = await tableBox(erd, 'edge');
    await expect(pillOf(erd)).toHaveAttribute('data-side', 'right');
    const flipped = await boxOf(pillOf(erd));
    expect(flipped.x).toBeCloseTo(edge.x + edge.width + PILL_MARGIN, 0);

    const card = await tableBox(erd, 'corner');
    const map = await boxOf(erd.minimap);
    const beside = {
      x: card.x - PILL_MARGIN - PILL.width,
      y: card.y,
      ...PILL,
    };
    expect(overlaps(beside, map)).toBe(true);
    await erd.hoverAt({
      x: Math.round(card.x + 20),
      y: Math.round(map.y + map.height + 20),
    });
    await expect
      .poll(async () => (await boxOf(outlineOf(erd))).x)
      .toBeCloseTo(card.x, 0);

    const pill = await boxOf(pillOf(erd));
    expect(overlaps(pill, map)).toBe(false);
    expect(pill.y).toBeCloseTo(map.y + map.height, 0);
    expect(pill.x + pill.width).toBeCloseTo(card.x - PILL_MARGIN, 0);
  });
});

test.describe('what holds the buttons and the dialog back', () => {
  test('readonly shows neither the buttons nor the menu item', async ({
    erd,
  }) => {
    await erd.seed(linkedPosts());
    await erd.page.evaluate(() => {
      document.querySelector('erd-editor')!.readonly = true;
    });
    await erd.focusCanvas();
    await erd.press(Shortcut.relationshipZeroN);
    await erd.clickTableHeader('users');
    await erd.hoverScene('#table-posts');
    await erd.whenDrawn();

    await expect(pillOf(erd)).toHaveCount(0);

    await erd.press(Shortcut.stop);
    await erd.clickAt(await erd.sceneHitPoint('users_posts'), {
      button: 'right',
    });
    await expect(
      erd.contextMenu.getByText('On Delete', { exact: true })
    ).toBeVisible();
    await expect(
      erd.contextMenu.getByText('Map Columns', { exact: true })
    ).toHaveCount(0);
  });

  test('with sync on the child takes the parent type in the same undo; with sync off it keeps its own', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    const synced = await openMapFromDraw(erd, 'users', 'posts');
    await childSelects(synced).selectOption({
      label: 'author_id (varchar(36))',
    });
    await expect(synced.locator('.map-columns-note')).toHaveText(
      'author_id becomes int'
    );
    await button(synced, 'Map').click();

    await expect
      .poll(async () => (await erd.column('posts_author_id')).dataType)
      .toBe('int');

    await erd.undo();

    await expect.poll(() => erd.relationshipIds()).toEqual([]);
    expect((await erd.column('posts_author_id')).dataType).toBe('varchar(36)');

    const unsynced = usersAndPosts();
    unsynced.settings.relationshipDataTypeSync = false;
    await erd.seed(unsynced);
    const dialog = await openMapFromDraw(erd, 'users', 'posts');
    await childSelects(dialog).selectOption({
      label: 'author_id (varchar(36))',
    });
    await expect(dialog.locator('.map-columns-note')).toHaveText(
      'Types differ: int and varchar(36)'
    );
    await button(dialog, 'Map').click();

    await expect.poll(async () => (await erd.relationshipIds()).length).toBe(1);
    expect((await erd.column('posts_author_id')).dataType).toBe('varchar(36)');
  });

  test('Cmd+F and Cmd+K close Map Columns for Find and Replace and the palette, and Escape closes it writing nothing', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    const before = await erd.value();

    const dialog = await openMapFromDraw(erd, 'users', 'posts');
    await expect(childSelects(dialog)).toBeFocused();
    await erd.press(Shortcut.findReplace);

    await expect(dialog).toHaveCount(0);
    const panel = erd.host.locator('.find-replace');
    await expect(panel.locator('.find-input')).toBeFocused();
    await erd.press(Shortcut.stop);
    await expect(panel).toHaveCount(0);

    await openMapFromDraw(erd, 'users', 'posts');
    await erd.press(Shortcut.search);

    await expect(dialog).toHaveCount(0);
    const palette = erd.host.locator('.quick-search');
    await expect(palette).toBeVisible();
    await erd.press(Shortcut.stop);
    await expect(palette).toHaveCount(0);

    await openMapFromDraw(erd, 'users', 'posts');
    await erd.press(Shortcut.stop);

    await expect(dialog).toHaveCount(0);
    await expect(erd.drawPreview).toHaveCount(0);
    await erd.expectKeyboardFocusInside();
    const after = await erd.value();
    expect(after.doc).toEqual(before.doc);
    expect(after.collections.tableEntities.posts.columnIds).toEqual(
      before.collections.tableEntities.posts.columnIds
    );
  });

  test('opening Map Columns from the relationship menu while a draw is armed ends the draw', async ({
    erd,
  }) => {
    await erd.seed(linkedPosts());
    await startDraw(erd, 'users');

    const dialog = await openMapFromMenu(erd, 'users_posts');

    await expect(erd.drawPreview).toHaveCount(0);
    await erd.press(Shortcut.stop);
    await expect(dialog).toHaveCount(0);
    await erd.hoverScene('#table-posts');
    await erd.whenDrawn();
    await expect(pillOf(erd)).toHaveCount(0);
    expect(await erd.canvasCursor()).toBe('auto');
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  /** A real tap: the browser delivers the press, the lift and the mouse events it makes up after them. */
  async function tap(erd: ErdEditorPage, point: Point) {
    await erd.touchStart(point);
    await erd.touchEnd();
  }

  /** Arms Zero N from the floating toolbar and taps the table the draw starts from. */
  async function startDrawByTap(erd: ErdEditorPage, startId: string) {
    const notation = erd.floatingToolbar.locator('[title^="Zero N"]');
    await tap(erd, centre(await boxOf(notation)));
    await expect(notation).toHaveClass(/active/);

    await tap(erd, await erd.tableHeaderPoint(startId));
    await expect(erd.drawPreview).toBeVisible();
  }

  /** Records whether the buttons or the outline ever show, which a look at the end would miss. */
  async function watchDrawTarget(erd: ErdEditorPage) {
    await erd.page.evaluate(() => {
      const root = window.document.querySelector('erd-editor')!.shadowRoot!;
      const seen = () => Boolean(root.querySelector('.draw-target-layer'));
      Reflect.set(window, '__drawTargetShown', seen());

      new MutationObserver(() => {
        if (seen()) Reflect.set(window, '__drawTargetShown', true);
      }).observe(root, { childList: true, subtree: true });
    });
  }

  const drawTargetShown = (erd: ErdEditorPage) =>
    erd.page.evaluate(
      () => Reflect.get(window, '__drawTargetShown') as boolean
    );

  const gutterOf = (erd: ErdEditorPage) =>
    erd.host.locator('.draw-target-gutter');

  /** The new key column a draw added to posts, the last of its columns. */
  async function expectNewColumnOnPosts(erd: ErdEditorPage) {
    await expect.poll(() => erd.relationshipIds()).toHaveLength(1);
    const [relationship] = await addedRelationships(erd, []);
    const columnIds = await erd.columnIds('posts');

    expect(relationship.start.tableId).toBe('users');
    expect(relationship.end.tableId).toBe('posts');
    expect(columnIds).toHaveLength(5);
    expect(relationship.end.columnIds).toEqual([
      columnIds[columnIds.length - 1],
    ]);
  }

  test('a tap on the target table mints new columns at once and no buttons ever show', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await watchDrawTarget(erd);
    await startDrawByTap(erd, 'users');

    await tap(erd, await erd.tableHeaderPoint('posts'));

    await expectNewColumnOnPosts(erd);
    await expect(erd.drawPreview).toHaveCount(0);
    await erd.whenDrawn();
    expect(await drawTargetShown(erd)).toBe(false);
  });

  test('a tap on empty canvas leaves no pointer, so a pan that brings a table under it shows nothing', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await startDrawByTap(erd, 'users');
    const canvas = await boxOf(erd.host.locator('[data-testid="erd-canvas"]'));
    const empty = {
      x: Math.round(canvas.x + 30),
      y: Math.round(canvas.y + canvas.height - 220),
    };
    await tap(erd, empty);
    await erd.whenDrawn();
    await watchDrawTarget(erd);

    const posts = centre(await tableBox(erd, 'posts'));
    const from = { x: empty.x + 10, y: empty.y - 10 };
    await erd.touchDrag(from, {
      x: from.x + empty.x - posts.x,
      y: from.y + empty.y - posts.y,
    });
    await erd.whenDrawn();

    expect(
      overlaps(await tableBox(erd, 'posts'), { ...empty, width: 1, height: 1 })
    ).toBe(true);
    expect(await drawTargetShown(erd)).toBe(false);
    await expect(pillOf(erd)).toHaveCount(0);
    await expect(outlineOf(erd)).toHaveCount(0);
    await expect(gutterOf(erd)).toHaveCount(0);
    expect(await erd.relationshipIds()).toEqual([]);

    // The draw is still armed: a mouse over the table shows the buttons.
    await hoverTarget(erd, 'posts');
  });

  test('a tap on empty canvas leaves no pointer, so a zoom from the keyboard that brings a table under it shows nothing', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await startDrawByTap(erd, 'users');
    const before = (await erd.settings()).zoomLevel;
    const canvas = await boxOf(erd.host.locator('[data-testid="erd-canvas"]'));
    const posts = await tableBox(erd, 'posts');

    // Just past the side of posts farther from the centre a zoom holds, which
    // a zoom in pushes over the point. No touch moves the canvas here, so only
    // the mouse events the browser makes up after the tap could leave a pointer.
    const right = posts.x + posts.width / 2 > canvas.x + canvas.width / 2;
    const beside = {
      x: Math.round(right ? posts.x + posts.width + 8 : posts.x - 8),
      y: Math.round(posts.y + posts.height / 2),
    };
    await tap(erd, beside);
    await erd.whenDrawn();
    await watchDrawTarget(erd);

    await erd.focusHost();
    for (let press = 0; press < 3; press++) {
      await erd.press(Shortcut.zoomIn);
    }
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(before + 3 * ZOOM_STEP, 5);
    await erd.whenDrawn();

    expect(
      overlaps(await tableBox(erd, 'posts'), { ...beside, width: 1, height: 1 })
    ).toBe(true);
    expect(await drawTargetShown(erd)).toBe(false);
    await expect(pillOf(erd)).toHaveCount(0);
    await expect(outlineOf(erd)).toHaveCount(0);
    expect(await erd.relationshipIds()).toEqual([]);
  });

  test('a pinch whose first finger lands on a table draws to it with new columns, as a tap there does, and still zooms', async ({
    erd,
  }) => {
    await erd.seed(usersAndPosts());
    await watchDrawTarget(erd);
    await startDrawByTap(erd, 'users');
    const before = await erd.value();

    const first = await erd.tableHeaderPoint('posts');
    const second = { x: first.x + 140, y: first.y + 200 };
    await erd.touchPinch(
      [first, second],
      [
        { x: first.x - 60, y: first.y - 80 },
        { x: second.x + 60, y: second.y + 80 },
      ]
    );
    await erd.whenDrawn();

    await expectNewColumnOnPosts(erd);
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeGreaterThan(before.settings.zoomLevel);
    const { ui } = await erd.table('posts');
    expect([ui.x, ui.y]).toEqual([
      before.collections.tableEntities.posts.ui.x,
      before.collections.tableEntities.posts.ui.y,
    ]);
    await expect(erd.drawPreview).toHaveCount(0);
    expect(await drawTargetShown(erd)).toBe(false);
  });
});
