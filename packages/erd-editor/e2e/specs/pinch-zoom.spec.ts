import { expect, test } from '../support/fixtures';
import { type ErdEditorPage, type Point } from '../support/ErdEditorPage';
import { twoTables } from '../support/schema';

// A pinch holds the scene point it began over under where it is centred, which
// is the whole of what these read back: the point, through the drawn layer,
// against the place on the page it has to land on.

/** The middle of the canvas, clear of the two seeded tables in its top left. */
async function middleOfCanvas(erd: ErdEditorPage): Promise<Point> {
  const box = await erd.canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');

  return { x: box.x + box.width * 0.6, y: box.y + box.height * 0.6 };
}

/** Polls until the drawn layer puts the scene point given on the page point given. */
async function expectLandsOn(erd: ErdEditorPage, scene: Point, page: Point) {
  await expect
    .poll(async () => {
      const landed = await erd.pointAt(scene.x, scene.y);
      return Math.hypot(landed.x - page.x, landed.y - page.y);
    })
    .toBeLessThan(0.5);
}

test.describe('a trackpad pinch', () => {
  test('zooms about the pointer rather than the middle of the screen', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.panBy(-120, -40);

    const at = await middleOfCanvas(erd);
    const scene = await erd.scenePointAt(at);

    // The ctrl wheel a browser turns a pinch into, deltaY = -100 ln(scale).
    await erd.page.mouse.move(at.x, at.y);
    await erd.page.keyboard.down('Control');
    await erd.page.mouse.wheel(0, -100 * Math.log(1.08));
    await erd.page.keyboard.up('Control');

    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(1.08, 5);
    await expectLandsOn(erd, scene, at);
  });
});

test.describe('two fingers', () => {
  test.use({ hasTouch: true });

  test('zoom about their midpoint and pan as it travels', async ({ erd }) => {
    await erd.seed(twoTables());

    const middle = await middleOfCanvas(erd);
    const scene = await erd.scenePointAt(middle);
    const travel = { x: 40, y: 30 };

    // From 200 apart to 100 apart, the midpoint carried by the travel.
    await erd.touchPinch(
      [
        { x: middle.x - 100, y: middle.y },
        { x: middle.x + 100, y: middle.y },
      ],
      [
        { x: middle.x - 50 + travel.x, y: middle.y + travel.y },
        { x: middle.x + 50 + travel.x, y: middle.y + travel.y },
      ]
    );

    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(0.5, 5);
    await expectLandsOn(erd, scene, {
      x: middle.x + travel.x,
      y: middle.y + travel.y,
    });
    // Nothing of the pinch reached the page, which would have zoomed with it.
    expect(await erd.page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  });

  test('is one undo entry, however many moves it took', async ({ erd }) => {
    await erd.seed(twoTables());

    const middle = await middleOfCanvas(erd);
    await erd.touchPinch(
      [
        { x: middle.x - 60, y: middle.y },
        { x: middle.x + 60, y: middle.y },
      ],
      [
        { x: middle.x - 90, y: middle.y - 50 },
        { x: middle.x + 90, y: middle.y - 50 },
      ],
      20
    );
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeCloseTo(1.5, 5);

    await erd.undo();

    await expect
      .poll(async () => {
        const { originX, originY, zoomLevel } = await erd.settings();
        // Plus zero, so an undo that lands on -0 still reads as the origin.
        return [originX, originY, zoomLevel].map(
          value => Number(value.toFixed(2)) + 0
        );
      })
      .toEqual([0, 0, 1]);
  });
});
