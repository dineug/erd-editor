import { expect, test } from '../support/fixtures';
import { CANVAS_SIZE, createSchema, type ErdDocument } from '../support/schema';

// AC-I6. The markers stayed dom, and what the port has to keep is the round
// trip: a scene node that culling has dropped is still an entity the editor
// knows where to put back, and clicking its marker is how that is asked for.

/**
 * A table off the top-left corner and a memo off the bottom-right one. Both sit
 * beyond the screen of margin the culling rect keeps, so each is a marker with
 * no scene node behind it rather than a node merely out of view.
 */
function strandedEntities(): ErdDocument {
  return createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: -1800,
        y: -1600,
        columns: [{ id: 'users_id', name: 'id', dataType: 'int' }],
      },
      {
        id: 'home',
        name: 'home',
        x: 400,
        y: 300,
        columns: [{ id: 'home_id', name: 'id', dataType: 'int' }],
      },
    ],
    memos: [{ id: 'note', value: 'a memo', x: 2400, y: 2400 }],
  });
}

test.describe('off-canvas markers', () => {
  test('only the entities outside the canvas get a marker', async ({ erd }) => {
    await erd.seed(strandedEntities());

    await expect(erd.hideSigns()).toHaveCount(2);
    await expect(erd.hideSign('users')).toHaveCount(1);
    await expect(erd.hideSign('Memo')).toHaveCount(1);
    await expect(erd.hideSign('home')).toHaveCount(0);

    // The table that never left is drawn, and the two that did are not.
    // Both rules are in play here and they are not the same rule: the marker
    // asks about the canvas box, the node asks about the screen and its margin.
    expect(await erd.hasSceneNode('#table-home')).toBe(true);
    expect(await erd.hasSceneNode('#table-users')).toBe(false);
    expect(await erd.hasSceneNode('#memo-note')).toBe(false);
  });

  test('clicking a marker brings its table back and selects it', async ({
    erd,
  }) => {
    await erd.seed(strandedEntities());

    await erd.hideSign('users').click();

    const table = await erd.table('users');
    expect(table.ui.x).toBeGreaterThanOrEqual(0);
    expect(table.ui.y).toBeGreaterThanOrEqual(0);
    expect(table.ui.x).toBeLessThan(CANVAS_SIZE);
    expect(table.ui.y).toBeLessThan(CANVAS_SIZE);

    await expect.poll(() => erd.hasSceneNode('#table-users')).toBe(true);
    await expect
      .poll(() => erd.sceneAttr('#table-users', 'selected'))
      .toBe(true);
    await expect(erd.hideSign('users')).toHaveCount(0);
    await expect(erd.selectedTables()).toHaveCount(1);
  });

  test('clicking a marker brings its memo back and selects it', async ({
    erd,
  }) => {
    await erd.seed(strandedEntities());

    await erd.hideSign('Memo').click();

    const memo = await erd.memo('note');
    expect(memo.ui.x).toBeLessThan(CANVAS_SIZE);
    expect(memo.ui.y).toBeLessThan(CANVAS_SIZE);

    await expect.poll(() => erd.hasSceneNode('#memo-note')).toBe(true);
    await expect.poll(() => erd.sceneAttr('#memo-note', 'selected')).toBe(true);
    await expect(erd.hideSigns()).toHaveCount(1);
  });
});
