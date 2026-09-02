import { expect, test } from '../support/fixtures';
import { CANVAS_SIZE, createSchema, type ErdDocument } from '../support/schema';
import { WHEEL_ZOOM_STEP } from '../support/shortcuts';
import { type ErdEditorPage } from '../support/ErdEditorPage';

/**
 * Zooming out and back in is a walk to nowhere: the offsets it pass through are
 * the editor's memory of where the reader was, and this is where a clamp that
 * narrowed with the canvas used to gather every one of them instead.
 */
const midpoint = (viewportLength: number) => (viewportLength - CANVAS_SIZE) / 2;

/**
 * Far enough west to stay off the canvas at every zoom. The box a marker is
 * measured against grows as the zoom shrinks, so a nearer table would drift in
 * and out of the marker list along the way and measure nothing.
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

/** The editor box a marker is pinned inside, and the marker's place in it. */
async function signPlacement(erd: ErdEditorPage, title: string) {
  return erd.hideSign(title).evaluate(el => {
    const box = el as HTMLElement;
    const parent = (box.offsetParent as HTMLElement).getBoundingClientRect();
    const rect = el.getBoundingClientRect();

    return {
      left: rect.x - parent.x,
      top: rect.y - parent.y,
      originX: parent.x,
      originY: parent.y,
    };
  });
}

/**
 * Where the scene layer puts a point, written out longhand. It is the css
 * transform the canvas replaced: scale the canvas box about its middle, then
 * carry it by the scroll, so half the shrink rides with the scroll.
 */
const onScreen = (
  scene: number,
  scroll: number,
  size: number,
  zoomLevel: number
) => scene * zoomLevel + scroll + (size * (1 - zoomLevel)) / 2;

test.describe('a zoom out and back in', () => {
  test('returns the scroll to where the reader left it', async ({ erd }) => {
    await erd.seed(strandedWest());
    await erd.panBy(-200, -300);

    const before = await erd.settings();
    expect(before.scrollLeft).toBeCloseTo(-200, 0);
    expect(before.scrollTop).toBeCloseTo(-300, 0);

    // Twenty notches is zoom 0.4, which draws the 2000 box smaller than either
    // axis of the screen. That is the regime the old clamp had no travel in.
    await wheelZoom(erd, 20, 120);
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(1 - 20 * WHEEL_ZOOM_STEP, 5);

    const viewport = erd.page.viewportSize()!;
    const shrunk = await erd.settings();
    expect(shrunk.scrollLeft).not.toBeCloseTo(midpoint(viewport.width), 0);

    await wheelZoom(erd, 20, -120);
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(1, 5);

    // Every notch holds the middle of the screen still, so forty of them
    // compose to the identity and what is left is the four decimals each
    // movement is rounded to rather than a drift the reader can see.
    const after = await erd.settings();
    expect(Math.abs(after.scrollLeft - before.scrollLeft)).toBeLessThan(0.05);
    expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThan(0.05);
  });

  /**
   * The same walk asked for in one step. The toolbar box carries no notches to
   * average the error out over, so this is where the reader saw it: a trip to
   * a tenth and straight back used to land hundreds of pixels away.
   */
  test('returns the scroll when the toolbar box does the zooming', async ({
    erd,
  }) => {
    await erd.seed(strandedWest());
    await erd.panBy(-200, -300);

    const before = await erd.settings();

    for (const percent of [10, 40, 150]) {
      await toolbarZoom(erd, percent);
      await toolbarZoom(erd, 100);

      const after = await erd.settings();
      expect(Math.abs(after.scrollLeft - before.scrollLeft)).toBeLessThan(0.05);
      expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThan(0.05);
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
        .toBeCloseTo(0.1, 5);

      atFloor.push((await erd.settings()).scrollLeft);
    }

    const viewport = erd.page.viewportSize()!;
    expect(atFloor[0]).not.toBeCloseTo(atFloor[1], 0);
    expect(atFloor[0]).not.toBeCloseTo(midpoint(viewport.width), 0);
    expect(atFloor[1]).not.toBeCloseTo(midpoint(viewport.width), 0);
  });
});

test.describe('an off-canvas marker', () => {
  test('sits where the scene layer would have drawn its table', async ({
    erd,
  }) => {
    await erd.seed(strandedWest());

    for (const notches of [0, 10, 20, -20, -15]) {
      if (notches !== 0) {
        await wheelZoom(erd, Math.abs(notches), notches > 0 ? 120 : -120);
      }

      const settings = await erd.settings();

      // The marker reads a debounced copy of the scroll, so the placement it
      // is asked for is the one that settles rather than the one mid-gesture.
      await expect
        .poll(async () => {
          const placement = await signPlacement(erd, 'west');
          return Math.round(placement.top);
        })
        .toBe(
          Math.round(
            onScreen(
              WEST_Y,
              settings.scrollTop,
              settings.height,
              settings.zoomLevel
            )
          )
        );

      const placement = await signPlacement(erd, 'west');
      expect(placement.left).toBeCloseTo(0, 1);
    }
  });

  test('brings its table back under the pointer that clicked it', async ({
    erd,
  }) => {
    await erd.seed(strandedWest());
    await wheelZoom(erd, 12, 120);
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(1 - 12 * WHEEL_ZOOM_STEP, 5);

    // The marker's own placement settles a beat after the gesture, and the
    // click has to land on it rather than where it was during the wheel.
    await erd.page.waitForTimeout(200);
    const placement = await signPlacement(erd, 'west');
    const box = (await erd.hideSign('west').boundingBox())!;

    // Whole pixels, because the browser delivers the press at whole ones and
    // the point being checked is the one the editor was actually handed.
    const at = {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
    };

    await erd.page.mouse.click(at.x, at.y);
    await expect.poll(() => erd.hasSceneNode('#table-west')).toBe(true);

    const settings = await erd.settings();
    const table = await erd.table('west');

    expect(
      onScreen(
        table.ui.x,
        settings.scrollLeft,
        settings.width,
        settings.zoomLevel
      )
    ).toBeCloseTo(at.x - placement.originX, 1);
    expect(
      onScreen(
        table.ui.y,
        settings.scrollTop,
        settings.height,
        settings.zoomLevel
      )
    ).toBeCloseTo(at.y - placement.originY, 1);
  });
});
