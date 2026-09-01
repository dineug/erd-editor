import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
  RelationshipType,
} from '../support/schema';

// AC-I3. The dom scene got hover for nothing: a css rule matched :hover and the
// browser repainted. Konva has neither, so each case here is the stage turning
// a real pointermove into the enter and leave a scene node listens for.

/**
 * What konva is handed for a shape the scene paints nothing with. Both a hidden
 * icon and an unlit row carry it, and neither is a colour: it is the keyword the
 * dom scene reached by leaving the rule unmatched.
 */
const UNPAINTED = 'transparent';

/** Where an icon keeps its colour, since a lucide glyph is a run of paths. */
const glyph = (...path: string[]) => [...path, 'Path'];

const RELATIONSHIP_ID = 'users_posts';

/** Two tables joined by one connector, with a key badge at each end. */
function linkedTables(): ErdDocument {
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
          { id: 'users_name', name: 'name', dataType: 'varchar(255)' },
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 760,
        y: 160,
        columns: [
          { id: 'posts_id', name: 'id', dataType: 'int' },
          {
            id: 'posts_user_id',
            name: 'user_id',
            dataType: 'int',
            keys: ColumnUIKey.foreignKey,
          },
        ],
      },
    ],
    memos: [{ id: 'note', value: 'a memo', x: 300, y: 560 }],
    relationships: [
      {
        id: RELATIONSHIP_ID,
        relationshipType: RelationshipType.ZeroN,
        startTableId: 'users',
        startColumnIds: ['users_id'],
        endTableId: 'posts',
        endColumnIds: ['posts_user_id'],
      },
    ],
  });
}

test.describe('scene hover', () => {
  test('a table shows its header buttons only while the pointer is on it', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());

    const add = glyph('#table-users', '.table-add-column');
    const remove = glyph('#table-users', '.table-remove');
    const resting = await erd.themeToken('--foreground');

    expect(await erd.sceneAttr(add, 'stroke')).toBe(UNPAINTED);
    expect(await erd.sceneAttr(remove, 'stroke')).toBe(UNPAINTED);

    // A moved pointer, never a fired event. This group exists because the
    // buttons once stayed invisible in the browser while every spec that
    // dispatched enter straight on the node went green.
    await erd.hoverAt(await erd.tableHeaderPoint('users'));

    await expect.poll(() => erd.sceneAttr(add, 'stroke')).toBe(resting);
    await expect.poll(() => erd.sceneAttr(remove, 'stroke')).toBe(resting);

    await erd.hoverAway();

    await expect.poll(() => erd.sceneAttr(add, 'stroke')).toBe(UNPAINTED);
    await expect.poll(() => erd.sceneAttr(remove, 'stroke')).toBe(UNPAINTED);
  });

  test('hovering one header button lifts it out of the pair', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());

    const add = glyph('#table-users', '.table-add-column');
    const remove = glyph('#table-users', '.table-remove');
    const resting = await erd.themeToken('--foreground');
    const lifted = await erd.themeToken('--active');

    expect(lifted).not.toBe(resting);

    await erd.hoverScene(['#table-users', '.table-add-column']);

    await expect.poll(() => erd.sceneAttr(add, 'stroke')).toBe(lifted);
    await expect.poll(() => erd.sceneAttr(remove, 'stroke')).toBe(resting);

    await erd.hoverScene(['#table-users', '.table-remove']);

    await expect.poll(() => erd.sceneAttr(add, 'stroke')).toBe(resting);
    await expect.poll(() => erd.sceneAttr(remove, 'stroke')).toBe(lifted);
  });

  test('a column row lights up and shows its own remove button', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());

    const background = ['#column-users_name', '.column-row-background'];
    const remove = glyph('#column-users_name', '.column-remove');
    const lit = await erd.themeToken('--column-hover');
    const resting = await erd.themeToken('--foreground');

    expect(await erd.sceneAttr(background, 'fill')).toBe(UNPAINTED);
    expect(await erd.sceneAttr(remove, 'stroke')).toBe(UNPAINTED);

    await erd.hoverScene('#column-users_name');

    await expect.poll(() => erd.sceneAttr(background, 'fill')).toBe(lit);
    await expect.poll(() => erd.sceneAttr(remove, 'stroke')).toBe(resting);

    await erd.hoverAway();

    await expect.poll(() => erd.sceneAttr(background, 'fill')).toBe(UNPAINTED);
    await expect.poll(() => erd.sceneAttr(remove, 'stroke')).toBe(UNPAINTED);
  });

  test('hovering a connector highlights it and both columns it joins', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());

    const route = [`.${RELATIONSHIP_ID}`, '.relationship-route'];
    const startRow = ['#column-users_id', '.column-row-background'];
    const endRow = ['#column-posts_user_id', '.column-row-background'];
    const resting = await erd.themeToken('--key-fk');
    const hovered = await erd.themeToken('--relationship-hover');
    const lit = await erd.themeToken('--column-hover');

    expect(hovered).not.toBe(resting);
    expect(await erd.sceneAttr(route, 'stroke')).toBe(resting);

    await erd.hoverAt(await erd.sceneHitPoint(RELATIONSHIP_ID));

    await expect.poll(() => erd.sceneAttr(route, 'stroke')).toBe(hovered);
    await expect.poll(() => erd.sceneAttr(startRow, 'fill')).toBe(lit);
    await expect.poll(() => erd.sceneAttr(endRow, 'fill')).toBe(lit);

    await erd.hoverAway();

    await expect.poll(() => erd.sceneAttr(route, 'stroke')).toBe(resting);
    await expect.poll(() => erd.sceneAttr(startRow, 'fill')).toBe(UNPAINTED);
    await expect.poll(() => erd.sceneAttr(endRow, 'fill')).toBe(UNPAINTED);
  });

  test('hovering a key badge lights the connector that column belongs to', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());

    const route = [`.${RELATIONSHIP_ID}`, '.relationship-route'];
    const startRow = ['#column-users_id', '.column-row-background'];
    const lit = await erd.themeToken('--column-hover');
    const hovered = await erd.themeToken('--relationship-hover');

    await erd.hoverScene(['#column-posts_user_id', '.column-key']);

    // The badge is on the foreign key end, and the highlight travels the
    // relationship to the column at the other end of it.
    await expect.poll(() => erd.sceneAttr(route, 'stroke')).toBe(hovered);
    await expect.poll(() => erd.sceneAttr(startRow, 'fill')).toBe(lit);

    await erd.hoverAway();

    await expect
      .poll(() => erd.sceneAttr(route, 'stroke'))
      .toBe(await erd.themeToken('--key-fk'));
    await expect.poll(() => erd.sceneAttr(startRow, 'fill')).toBe(UNPAINTED);
  });

  test('a memo shows its remove button only while the pointer is on it', async ({
    erd,
  }) => {
    await erd.seed(linkedTables());

    const remove = glyph('#memo-note', '.memo-remove');
    const resting = await erd.themeToken('--foreground');
    const lifted = await erd.themeToken('--active');

    expect(await erd.sceneAttr(remove, 'stroke')).toBe(UNPAINTED);

    const box = await erd.sceneBox('#memo-note');
    await erd.hoverAt({ x: box.x + 20, y: box.y + 8 });

    await expect.poll(() => erd.sceneAttr(remove, 'stroke')).toBe(resting);

    await erd.hoverScene(['#memo-note', '.memo-remove']);

    await expect.poll(() => erd.sceneAttr(remove, 'stroke')).toBe(lifted);

    await erd.hoverAway();

    await expect.poll(() => erd.sceneAttr(remove, 'stroke')).toBe(UNPAINTED);
  });
});
