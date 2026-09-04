import { expect, test } from '../support/fixtures';
import {
  createSchema,
  type ErdDocument,
  RelationshipType,
} from '../support/schema';

// AC-S5 and the e2e half of AC-G14. Konva builds only what is asked for: what
// was never on screen has no node, a table that scrolled off stays built but
// hidden for a while, and the minimap, the map of the rest, keeps all of it.

/** A canvas wide enough that the scroll can leave a screen behind. */
const CANVAS = 6000;

/** How far the far group sits from the origin, in canvas units. */
const FAR_X = 4200;

function spreadDocument(): ErdDocument {
  return createSchema({
    width: CANVAS,
    height: CANVAS,
    tables: [
      {
        id: 'near',
        name: 'near',
        x: 200,
        y: 260,
        columns: [{ id: 'near_id', name: 'id', dataType: 'int' }],
      },
      {
        id: 'far_a',
        name: 'far_a',
        x: FAR_X,
        y: 300,
        columns: [{ id: 'far_a_id', name: 'id', dataType: 'int' }],
      },
      {
        id: 'far_b',
        name: 'far_b',
        x: FAR_X,
        y: 900,
        columns: [{ id: 'far_b_id', name: 'id', dataType: 'int' }],
      },
    ],
    memos: [{ id: 'far_note', value: 'far away', x: FAR_X, y: 1400 }],
    relationships: [
      {
        id: 'far_link',
        relationshipType: RelationshipType.ZeroN,
        startTableId: 'far_a',
        startColumnIds: ['far_a_id'],
        endTableId: 'far_b',
        endColumnIds: ['far_b_id'],
      },
    ],
  });
}

test.describe('virtual viewport', () => {
  test('what is off screen has no node, and the minimap keeps all of it', async ({
    erd,
  }) => {
    await erd.seed(spreadDocument());

    expect(await erd.hasSceneNode('#table-near')).toBe(true);
    expect(await erd.hasSceneNode('#table-far_a')).toBe(false);
    expect(await erd.hasSceneNode('#table-far_b')).toBe(false);
    expect(await erd.hasSceneNode('#memo-far_note')).toBe(false);
    expect(await erd.hasSceneNode('.far_link')).toBe(false);

    await expect(erd.canvas.locator('.table')).toHaveCount(1);
    await expect(erd.canvas.locator('.memo')).toHaveCount(0);
    await expect(erd.canvas.locator('.relationship')).toHaveCount(0);

    // The thumbnail is the map of where the rest of the document is, so it
    // draws every box whatever the scroll is — and no connectors at all.
    await expect(erd.minimap.locator('.table')).toHaveCount(3);
    await expect(erd.minimap.locator('.memo')).toHaveCount(1);
    await expect(erd.minimapTable('far_a')).toHaveCount(1);
    await expect(erd.minimap.locator('.relationship')).toHaveCount(0);
  });

  test('scrolling the far group into view builds it and hides the near one', async ({
    erd,
  }) => {
    await erd.seed(spreadDocument());

    await erd.wheel(0, { deltaX: 2900 });
    await expect
      .poll(async () => Math.round((await erd.settings()).scrollLeft))
      .toBe(-2900);
    await erd.whenDrawn();

    await expect.poll(() => erd.sceneNodeDrawn('#table-far_a')).toBe(true);
    expect(await erd.sceneNodeDrawn('#table-far_b')).toBe(true);
    expect(await erd.hasSceneNode('#memo-far_note')).toBe(true);
    expect(await erd.hasSceneNode('.far_link')).toBe(true);

    // The table that scrolled off is kept built, so a scroll back finds it
    // rather than building it again; the mirror, like the paint, skips it.
    expect(await erd.hasSceneNode('#table-near')).toBe(true);
    expect(await erd.sceneNodeDrawn('#table-near')).toBe(false);

    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    await expect(erd.minimap.locator('.table')).toHaveCount(3);

    await erd.wheel(0, { deltaX: -2900 });
    await expect
      .poll(async () => Math.round((await erd.settings()).scrollLeft))
      .toBe(0);
    await erd.whenDrawn();

    await expect.poll(() => erd.sceneNodeDrawn('#table-near')).toBe(true);
    expect(await erd.hasSceneNode('#table-far_a')).toBe(true);
    expect(await erd.sceneNodeDrawn('#table-far_a')).toBe(false);
    await expect(erd.canvas.locator('.table')).toHaveCount(1);

    // Only tables are kept: a memo or a connector that left is gone.
    expect(await erd.hasSceneNode('#memo-far_note')).toBe(false);
    expect(await erd.hasSceneNode('.far_link')).toBe(false);
  });

  test('a table dropped from the scene is still in the document', async ({
    erd,
  }) => {
    await erd.seed(spreadDocument());

    // Culling is a drawing decision and nothing else: the store still holds
    // every id, and the connector between two dropped tables survives with it.
    expect(await erd.tableIds()).toEqual(['near', 'far_a', 'far_b']);
    expect(await erd.relationshipIds()).toEqual(['far_link']);
    expect((await erd.table('far_a')).ui.x).toBe(FAR_X);
  });
});
