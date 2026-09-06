import { expect, test } from '../support/fixtures';
import {
  CANVAS_ZOOM_MIN,
  createSchema,
  type ErdDocument,
} from '../support/schema';
import { WHEEL_ZOOM_STEP } from '../support/shortcuts';
import { type ErdEditorPage } from '../support/ErdEditorPage';

/**
 * Far enough west to stay off the screen at every zoom, so the document spans
 * far more than one screen and the view has travel to lose on the way out and
 * find again on the way back.
 */
const WEST_X = -20_000;
const WEST_Y = 900;

function strandedWest(): ErdDocument {
  return createSchema({
    tables: [
      {
        id: 'home',
        name: 'home',
        x: 400,
        y: 300,
        columns: [{ id: 'home_id', name: 'id', dataType: 'int' }],
      },
      {
        id: 'west',
        name: 'west',
        x: WEST_X,
        y: WEST_Y,
        columns: [{ id: 'west_id', name: 'id', dataType: 'int' }],
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

/** A run of $mod+wheel notches delivered without releasing the modifier. */
async function wheelZoom(erd: ErdEditorPage, notches: number, deltaY: number) {
  const modKey = await erd.pointerModKey();

  await erd.page.mouse.move(900, 600);
  await erd.page.keyboard.down(modKey);
  for (let notch = 0; notch < notches; notch++) {
    await erd.page.mouse.wheel(0, deltaY);
  }
  await erd.page.keyboard.up(modKey);
}

test.describe('a zoom out and back in', () => {
  test('returns the origin to where the reader left it', async ({ erd }) => {
    await erd.seed(strandedWest());
    await erd.panBy(-200, -300);

    const before = await erd.settings();
    expect(before.originX).toBeCloseTo(-200, 0);
    expect(before.originY).toBeCloseTo(-300, 0);

    // Twenty notches is zoom 0.4. There is no clamp to gather this into any
    // view any more — a pan goes anywhere, and the aids only draw the content
    // — so the walk back is the whole of the proof.
    await wheelZoom(erd, 20, 120);
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(1 - 20 * WHEEL_ZOOM_STEP, 5);

    await wheelZoom(erd, 20, -120);
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(1, 5);

    // Every notch holds the middle of the screen still, so forty of them
    // compose to the identity and what is left is the four decimals each
    // movement is rounded to rather than a drift the reader can see.
    const after = await erd.settings();
    expect(Math.abs(after.originX - before.originX)).toBeLessThan(0.05);
    expect(Math.abs(after.originY - before.originY)).toBeLessThan(0.05);
  });

  /**
   * The same walk asked for in one step. The toolbar box carries no notches to
   * average the error out over, so this is where the reader saw it: a trip to
   * a tenth and straight back used to land hundreds of pixels away.
   */
  test('returns the origin when the toolbar box does the zooming', async ({
    erd,
  }) => {
    await erd.seed(strandedWest());
    await erd.panBy(-200, -300);

    const before = await erd.settings();

    for (const percent of [10, 40, 150]) {
      await toolbarZoom(erd, percent);
      await toolbarZoom(erd, 100);

      const after = await erd.settings();
      expect(Math.abs(after.originX - before.originX)).toBeLessThan(0.05);
      expect(Math.abs(after.originY - before.originY)).toBeLessThan(0.05);
    }
  });

  test('keeps two different views apart all the way to the zoom floor', async ({
    erd,
  }) => {
    await erd.seed(strandedWest());

    const atFloor: number[] = [];
    for (const pan of [-120, -420]) {
      await erd.page.reload();
      await expect(erd.canvas).toBeAttached();
      await erd.seed(strandedWest());
      await erd.panBy(pan, 0);

      await wheelZoom(erd, 40, 120);
      await expect
        .poll(async () => (await erd.settings()).zoomLevel)
        .toBeCloseTo(CANVAS_ZOOM_MIN, 5);

      atFloor.push((await erd.settings()).originX);
    }

    // Two readers who panned differently still see different things at the
    // floor. The view the box used to gather them into is not a place any more.
    expect(atFloor[0]).not.toBeCloseTo(atFloor[1], 0);
  });
});
