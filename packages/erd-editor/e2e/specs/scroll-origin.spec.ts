import { expect, test } from '../support/fixtures';
import { type ErdEditorPage } from '../support/ErdEditorPage';
import { CANVAS_SIZE, createSchema, type ErdDocument } from '../support/schema';

// The document carries two views: settings.originX/originY, which the editor
// draws with, and settings.scrollLeft/scrollTop, which only the migration
// reads. Nothing writes the second, so a file survives a trip through both.

const ZOOM = 0.5;

/**
 * A legacy pair chosen so the origin it migrates to is inside the travel the
 * viewport allows at this zoom. A pair outside it would be pulled into range on
 * load, and the assertions would be measuring the clamp instead.
 */
const LEGACY = { scrollLeft: -300, scrollTop: -400 };

/** A table far enough inside the screen to stay drawn at every step here. */
const TABLE = { x: 600, y: 400 };

/**
 * The origin the shipped editor drew a legacy document at: the scroll it stored
 * plus the half of the canvas box the css transform-origin shrank away.
 */
const migrated = (scroll: number) => scroll + (CANVAS_SIZE * (1 - ZOOM)) / 2;

function tableSeed() {
  return [
    {
      id: 'users',
      name: 'users',
      x: TABLE.x,
      y: TABLE.y,
      columns: [{ id: 'users_id', name: 'id', dataType: 'int' }],
    },
  ];
}

/** A document from before the origin fields existed: only the legacy pair. */
function legacyDocument(): ErdDocument {
  return createSchema({
    zoomLevel: ZOOM,
    ...LEGACY,
    tables: tableSeed(),
  });
}

/**
 * Where the table's own group sits on the canvas container. The group is placed
 * at the table's document coordinates inside the scene layer, so its absolute
 * position is the whole scene transform applied to one known point.
 */
async function tablePlacement(erd: ErdEditorPage, id: string) {
  const handle = await erd.page.waitForFunction(tableId => {
    const stage = Reflect.get(window, '__erdStages')?.canvas;
    const node: any = stage?.findOne(`#table-${tableId}`);
    if (!node) return null;

    const { x, y } = node.getAbsolutePosition();
    return { x, y };
  }, id);

  return (await handle.jsonValue()) as { x: number; y: number };
}

test.describe('the origin pair and the legacy scroll pair', () => {
  test('draws a legacy document where the editor that wrote it did', async ({
    erd,
  }) => {
    await erd.seed(legacyDocument());

    const placement = await tablePlacement(erd, 'users');

    // The formula the released editor drew with, written out: scale about the
    // middle of the canvas box, then carry the result by the stored scroll.
    expect(placement.x).toBeCloseTo(
      TABLE.x * ZOOM + LEGACY.scrollLeft + (CANVAS_SIZE * (1 - ZOOM)) / 2,
      1
    );
    expect(placement.y).toBeCloseTo(
      TABLE.y * ZOOM + LEGACY.scrollTop + (CANVAS_SIZE * (1 - ZOOM)) / 2,
      1
    );
  });

  test('hands the legacy pair back untouched, beside the origin it migrated to', async ({
    erd,
  }) => {
    await erd.seed(legacyDocument());

    const settings = await erd.settings();
    expect([settings.scrollLeft, settings.scrollTop]).toEqual([
      LEGACY.scrollLeft,
      LEGACY.scrollTop,
    ]);
    expect(settings.originX).toBeCloseTo(migrated(LEGACY.scrollLeft), 4);
    expect(settings.originY).toBeCloseTo(migrated(LEGACY.scrollTop), 4);
  });

  test('moves only the origin when the reader scrolls', async ({ erd }) => {
    await erd.seed(legacyDocument());

    const before = await erd.settings();
    await erd.wheel(200);
    await expect
      .poll(async () => (await erd.settings()).originY)
      .toBeLessThan(before.originY);

    const after = await erd.settings();
    expect([after.scrollLeft, after.scrollTop]).toEqual([
      LEGACY.scrollLeft,
      LEGACY.scrollTop,
    ]);
    expect(after.originX).toBe(before.originX);
    expect(after.originY).toBeCloseTo(before.originY - 200, 1);

    // And the scene followed the origin rather than the pair it left behind.
    const placement = await tablePlacement(erd, 'users');
    expect(placement.y).toBeCloseTo(TABLE.y * ZOOM + after.originY, 1);
  });

  test('takes the origin fields over a legacy pair that disagrees', async ({
    erd,
  }) => {
    const origin = { originX: 240, originY: 120 };
    await erd.seed(
      createSchema({
        zoomLevel: ZOOM,
        scrollLeft: 0,
        scrollTop: 0,
        ...origin,
        tables: tableSeed(),
      })
    );

    const settings = await erd.settings();
    expect([settings.originX, settings.originY]).toEqual([
      origin.originX,
      origin.originY,
    ]);
    expect([settings.scrollLeft, settings.scrollTop]).toEqual([0, 0]);

    // Migrating that legacy pair would have drawn the scene at origin 500 on
    // both axes, 260px and 380px away from the origin the document names, so
    // the placement says which of the two the editor read.
    const placement = await tablePlacement(erd, 'users');
    expect(placement.x).toBeCloseTo(TABLE.x * ZOOM + origin.originX, 1);
    expect(placement.y).toBeCloseTo(TABLE.y * ZOOM + origin.originY, 1);
  });
});
