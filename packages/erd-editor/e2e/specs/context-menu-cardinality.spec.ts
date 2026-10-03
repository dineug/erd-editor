import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
  ReferentialAction,
  RelationshipType,
} from '../support/schema';

// AC-I4, the half the routing spec leaves open. A right click on a connector
// finds it by hit testing the scene, and the menu that opens is the one that
// rewrites the cardinality of the connector it found.

const RELATIONSHIP_ID = 'users_posts';

function linkedTables(
  actions: { onDelete?: number; onUpdate?: number } = {}
): ErdDocument {
  return createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 160,
        y: 160,
        columns: [
          {
            id: 'users_id',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
            keys: ColumnUIKey.primaryKey,
          },
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 760,
        y: 160,
        columns: [
          {
            id: 'posts_user_id',
            name: 'user_id',
            dataType: 'int',
            keys: ColumnUIKey.foreignKey,
          },
        ],
      },
    ],
    relationships: [
      {
        id: RELATIONSHIP_ID,
        relationshipType: RelationshipType.ZeroN,
        startTableId: 'users',
        startColumnIds: ['users_id'],
        endTableId: 'posts',
        endColumnIds: ['posts_user_id'],
        ...actions,
      },
    ],
  });
}

/** The four cardinalities the connector menu offers, in the order it lists them. */
const CARDINALITIES = [
  { label: 'Zero One', type: RelationshipType.ZeroOne },
  { label: 'Zero N', type: RelationshipType.ZeroN },
  { label: 'One Only', type: RelationshipType.OneOnly },
  { label: 'One N', type: RelationshipType.OneN },
];

test.describe('connector context menu', () => {
  test('the menu rewrites the cardinality of the connector under the pointer', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());

    expect((await erd.relationship(RELATIONSHIP_ID)).relationshipType).toBe(
      RelationshipType.ZeroN
    );

    await erd.clickAt(await erd.sceneHitPoint(RELATIONSHIP_ID), {
      button: 'right',
    });
    await expect(erd.contextMenu.first()).toBeVisible();

    await erd.contextMenu
      .getByText('Relationship Type', { exact: true })
      .hover();
    await expect(erd.contextMenu).toHaveCount(2);

    await erd.contextMenu.nth(1).getByText('One Only', { exact: true }).click();

    await expect
      .poll(
        async () => (await erd.relationship(RELATIONSHIP_ID)).relationshipType
      )
      .toBe(RelationshipType.OneOnly);

    // The menu is dom and the connector it rewrote is not, so the connector
    // has to still be a scene node afterwards rather than a redraw that lost it.
    expect(await erd.hasSceneNode(`.${RELATIONSHIP_ID}`)).toBe(true);
  });

  test('every cardinality the menu offers reaches the connector', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());

    for (const cardinality of CARDINALITIES) {
      await erd.clickAt(await erd.sceneHitPoint(RELATIONSHIP_ID), {
        button: 'right',
      });
      await erd.contextMenu
        .getByText('Relationship Type', { exact: true })
        .hover();
      await erd.contextMenu
        .nth(1)
        .getByText(cardinality.label, { exact: true })
        .click();

      await expect
        .poll(
          async () => (await erd.relationship(RELATIONSHIP_ID)).relationshipType
        )
        .toBe(cardinality.type);

      // Every rewrite keeps one connector on the scene: the group is rebuilt
      // from the new type rather than added beside the old one.
      await expect(erd.canvas.locator('.relationship')).toHaveCount(1);
    }
  });

  test('the menu sets the ON DELETE and ON UPDATE of the connector under the pointer', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());

    // The seed leaves both out, as a document saved before them does.
    expect(await erd.relationship(RELATIONSHIP_ID)).toMatchObject({
      onDelete: ReferentialAction.none,
      onUpdate: ReferentialAction.none,
    });

    for (const { label, field, choice, value } of [
      {
        label: 'On Delete',
        field: 'onDelete',
        choice: 'CASCADE',
        value: ReferentialAction.cascade,
      },
      {
        label: 'On Update',
        field: 'onUpdate',
        choice: 'SET NULL',
        value: ReferentialAction.setNull,
      },
    ] as const) {
      await erd.clickAt(await erd.sceneHitPoint(RELATIONSHIP_ID), {
        button: 'right',
      });
      await erd.contextMenu.getByText(label, { exact: true }).hover();
      await expect(erd.contextMenu).toHaveCount(2);
      // The seed is MySQL, whose DDL drops SET DEFAULT: the item says so.
      await expect(erd.contextMenu.nth(1)).toContainText(
        'Not setNO ACTIONCASCADESET NULLSET DEFAULTnot in MySQLRESTRICT'
      );

      await erd.contextMenu.nth(1).getByText(choice, { exact: true }).click();

      await expect
        .poll(async () => (await erd.relationship(RELATIONSHIP_ID))[field])
        .toBe(value);
    }

    // The first choice survives the second, each field its own register.
    expect(await erd.relationship(RELATIONSHIP_ID)).toMatchObject({
      onDelete: ReferentialAction.cascade,
      onUpdate: ReferentialAction.setNull,
    });
    await expect(erd.canvas.locator('.relationship')).toHaveCount(1);
  });

  test('the connector labels the actions it sets, spells them out on hover, and View Option hides the label', async ({
    erd,
    page,
  }) => {
    await erd.seed(
      linkedTables({
        onDelete: ReferentialAction.cascade,
        onUpdate: ReferentialAction.restrict,
      })
    );
    const label = erd.canvas.locator('.relationship-action-label');
    const title = () =>
      page.evaluate(() =>
        Reflect.get(window, '__erdStages')
          .canvas.container()
          .getAttribute('title')
      );

    await expect(label).toHaveText('D:C U:R');

    await erd.hoverAt(await erd.sceneHitPoint(RELATIONSHIP_ID));
    await expect.poll(title).toBe('ON DELETE CASCADE\nON UPDATE RESTRICT');
    await erd.hoverAway();
    await expect.poll(title).toBeNull();

    await erd.clickAt(await erd.emptyPoint(), { button: 'right' });
    await erd.contextMenu.getByText('View Option', { exact: true }).hover();
    await erd.contextMenu
      .nth(1)
      .getByText('Referential Actions', { exact: true })
      .click();

    await expect(label).toHaveCount(0);
    // The tooltip stays, as the label is only the glance.
    await erd.hoverAt(await erd.sceneHitPoint(RELATIONSHIP_ID));
    await expect.poll(title).toBe('ON DELETE CASCADE\nON UPDATE RESTRICT');
  });
});
