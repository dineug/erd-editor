import { expect, test } from '../support/fixtures';
import { CANVAS_SIZE, createSchema, type ErdDocument } from '../support/schema';
import { type ErdEditorPage } from '../support/ErdEditorPage';

/**
 * A marker says the reader cannot get to the entity. The canvas raised the zoom
 * ceiling past 1, where the box the markers were measured against shrank with
 * the zoom and started pointing at tables that were plainly on screen.
 */
function corners(): ErdDocument {
  const column = (id: string) => [
    { id: `${id}_id`, name: 'id', dataType: 'int' },
  ];

  return createSchema({
    tables: [
      { id: 'corner', name: 'corner', x: 60, y: 60, columns: column('corner') },
      {
        id: 'far-corner',
        name: 'far-corner',
        x: 1_600,
        y: 1_700,
        columns: column('far'),
      },
      {
        id: 'east',
        name: 'east',
        x: CANVAS_SIZE + 600,
        y: 1_000,
        columns: column('east'),
      },
      {
        id: 'west',
        name: 'west',
        x: -CANVAS_SIZE - 600,
        y: 1_000,
        columns: column('west'),
      },
    ],
  });
}

/** The toolbar box, which asks for one zoom rather than a run of notches. */
async function toolbarZoom(erd: ErdEditorPage, percent: number) {
  const input = erd.toolbar.locator('input[title="zoom level"]');

  await input.click();
  await input.fill(String(percent));
  await input.press('Enter');
  await expect
    .poll(async () => (await erd.settings()).zoomLevel)
    .toBeCloseTo(percent / 100, 5);
}

/** Runs the scroll to one end of its travel, which a plain wheel is free to do. */
async function panToEnd(erd: ErdEditorPage, sign: number) {
  await erd.wheel(9_000 * sign, { deltaX: 9_000 * sign });
  await erd.page.waitForTimeout(200);
}

/** The titles of every marker the editor is pinning, in a stable order. */
const markers = (erd: ErdEditorPage) =>
  erd
    .hideSigns()
    .evaluateAll(els => els.map(el => el.getAttribute('title') ?? '').sort());

test.describe('off-canvas markers at a magnifying zoom', () => {
  test('leaves a corner of the document unmarked while it is on screen', async ({
    erd,
  }) => {
    await erd.seed(corners());
    await toolbarZoom(erd, 150);
    await panToEnd(erd, -1);

    const viewport = erd.page.viewportSize()!;
    const box = await erd.sceneBox('#table-corner');
    expect(box.x).toBeGreaterThan(0);
    expect(box.y).toBeGreaterThan(0);
    expect(box.x + box.width).toBeLessThan(viewport.width);
    expect(box.y + box.height).toBeLessThan(viewport.height);

    await expect.poll(() => markers(erd)).toEqual(['east', 'west']);
  });

  test('leaves the opposite corner unmarked once the scroll reaches it', async ({
    erd,
  }) => {
    await erd.seed(corners());
    await toolbarZoom(erd, 150);
    await panToEnd(erd, 1);

    const viewport = erd.page.viewportSize()!;
    const box = await erd.sceneBox('#table-far-corner');
    expect(box.x).toBeGreaterThan(0);
    expect(box.y).toBeGreaterThan(0);
    expect(box.x + box.width).toBeLessThan(viewport.width);
    expect(box.y + box.height).toBeLessThan(viewport.height);

    await expect.poll(() => markers(erd)).toEqual(['east', 'west']);
  });

  /**
   * The other half of the travel, which the port must leave as it was. A canvas
   * drawn smaller than the screen keeps the room the unzoomed box had, so what
   * the scroll reaches grows and the far tables come back in one at a time.
   */
  test('lets the far tables back in one zoom step at a time', async ({
    erd,
  }) => {
    await erd.seed(corners());
    await expect.poll(() => markers(erd)).toEqual(['east', 'west']);

    // At half the zoom the travel reaches -1000 to 3000, which holds the
    // table 600 past the east edge but not the one 600 past the west one.
    await toolbarZoom(erd, 50);
    await expect.poll(() => markers(erd)).toEqual(['west']);

    await toolbarZoom(erd, 10);
    await expect.poll(() => markers(erd)).toEqual([]);
  });
});
