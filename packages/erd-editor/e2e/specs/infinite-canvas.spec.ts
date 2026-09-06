import { readFileSync } from 'node:fs';

import { type ErdEditorPage, type Point } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  createSchema,
  type ErdDocument,
  RelationshipType,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// The document has no box any more, and a pan has no edge: the content decides
// what the aids draw, never where the view may go. Every case here is a place
// the old box decided something, and now the entities do, or nothing does.

/** One screen pixel of pointer rounding, doubled for the two drag endpoints. */
const PIXEL_TOLERANCE = 2;

/** useVirtualScroll.ts — the width the drawn thumb never goes under. */
const SCROLLBAR_THUMB_MIN = 24;

/** constants/layout.ts — the square the minimap frame draws. */
const MINIMAP_SIZE = 150;

/**
 * minimap/minimapGeometry.ts — the scene units the map keeps clear around what
 * it holds, and the grid its edges snap outward to. Together they are the most
 * the map can reach past the screen at its corner.
 */
const MINIMAP_MAP_MARGIN = 100;
const MINIMAP_MAP_STEP = 500;

/** How many screens past the content a pan is carried before turning back. */
const SCREENS_BEYOND = 3;

/** constants/layout.ts — the screen point a new entity is placed at. */
const START_X = 200;
const START_Y = 100;

/** services/export-png/exportBox.ts — the margin the image leaves around the content. */
const EXPORT_MARGIN = 80;

/**
 * utils/calcMemo.ts — the frame a memo draws around the box its ui states, on
 * both sides. A memo is the only entity whose drawn size is in the seed rather
 * than measured from a font the runner happens to have.
 */
const MEMO_FRAME_WIDTH = 18;
const MEMO_FRAME_HEIGHT = 34;

/** The ui box every memo seeded here is given, so its drawn frame is known. */
const MEMO_BOX = { width: 100, height: 100 };

const memoWidth = MEMO_BOX.width + MEMO_FRAME_WIDTH;
const memoHeight = MEMO_BOX.height + MEMO_FRAME_HEIGHT;

/** Long enough for one export on the dev server, where the worker never starts. */
const EXPORT_TIMEOUT = 45_000;

type Box = { x: number; y: number; width: number; height: number };

function expectClose(actual: number, expected: number, tolerance: number) {
  expect(
    Math.abs(actual - expected),
    `expected ${actual} to be within ${tolerance} of ${expected}`
  ).toBeLessThanOrEqual(tolerance);
}

async function boxOf(target: {
  boundingBox: () => Promise<Box | null>;
}): Promise<Box> {
  const box = await target.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return box;
}

/**
 * Presses and steps the mouse to to without releasing, so a spec can assert on
 * the state that only exists mid-drag. The caller owns the mouse.up().
 */
async function dragHold(
  erd: ErdEditorPage,
  from: Point,
  to: Point,
  steps = 12
) {
  await erd.page.mouse.move(from.x, from.y);
  await erd.page.mouse.down();
  for (let step = 1; step <= steps; step++) {
    await erd.page.mouse.move(
      from.x + ((to.x - from.x) * step) / steps,
      from.y + ((to.y - from.y) * step) / steps
    );
  }
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

const column = (id: string) => ({
  id,
  name: 'id',
  dataType: 'int',
  options: ColumnOption.primaryKey | ColumnOption.notNull,
});

/** One table, placed where the caller wants it and nowhere near a box edge. */
function tableAt(id: string, x: number, y: number) {
  return { id, name: id, x, y, columns: [column(`${id}_id`)] };
}

test.describe('a canvas with no edges', () => {
  test('takes a table dragged past where the document used to begin', async ({
    erd,
  }) => {
    // The view starts scrolled so that scene coordinates left of and above zero
    // are on the screen, which is where the drag is heading.
    await erd.seed(
      createSchema({
        originX: 600,
        originY: 500,
        tables: [tableAt('users', 200, 200)],
      })
    );

    const before = await erd.settings();
    expect([before.originX, before.originY]).toEqual([600, 500]);

    await erd.moveTable('users', -400, -400);

    const users = await erd.table('users');
    expectClose(users.ui.x, -200, PIXEL_TOLERANCE);
    expectClose(users.ui.y, -200, PIXEL_TOLERANCE);

    // Negative is an ordinary coordinate: the table is still drawn, and the
    // view it was dragged in did not move to make room for it.
    expect(await erd.sceneNodeDrawn('#table-users')).toBe(true);
    await expect(erd.minimapTable('users')).toHaveCount(1);

    const after = await erd.settings();
    expect([after.originX, after.originY]).toEqual([600, 500]);
  });

  test('keeps scrolling past the content on every side', async ({ erd }) => {
    const NEAR = { x: 200, y: 200 };
    await erd.seed(
      createSchema({ tables: [tableAt('users', NEAR.x, NEAR.y)] })
    );

    const canvas = await boxOf(erd.host.locator('[data-testid="erd-canvas"]'));
    const canvasZero = await erd.pointAt(0, 0);
    const tracks = erd.host.locator('.virtual-scroll');
    const thumb = tracks.first().locator('.virtual-scroll-ghost-thumb');
    const upright = tracks.nth(1).locator('.virtual-scroll-ghost-thumb');
    await expect(tracks).toHaveCount(2);
    const home = {
      thumb: await boxOf(thumb),
      upright: await boxOf(upright),
      handle: await boxOf(erd.minimapViewport),
    };

    // At zoom 1 and origin 0 the drawn table is its scene rect, so its far
    // edges are where the content ends on each axis, taken whole so every
    // origin the wheel is asked for is a whole number of pixels.
    const drawn = await erd.sceneBox('#table-users');
    const far = {
      x: Math.ceil(NEAR.x + drawn.width),
      y: Math.ceil(NEAR.y + drawn.height),
    };
    const originOf = async () => {
      const { originX, originY } = await erd.settings();
      return { x: originX, y: originY };
    };
    const wheelTo = async (target: Point) => {
      const from = await originOf();
      // handleWheel turns a wheel delta into the opposite origin movement.
      await erd.wheel(-(target.y - from.y), { deltaX: -(target.x - from.x) });
      await expect.poll(originOf).toEqual(target);
    };
    const middleOf = (box: Box) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    // The map's ratio, read off the handle: the screen at zoom 1 is a canvas
    // wide in scene units, and the handle is that screen at the ratio.
    const ratioOf = (handle: Box) => handle.width / canvas.width;
    // How far the map can reach past the screen at the corner the view stands
    // in, in thumbnail pixels: the margin and one grid step, at the ratio.
    const cornerSlop = (handle: Box) =>
      (MINIMAP_MAP_MARGIN + MINIMAP_MAP_STEP) * ratioOf(handle) + 1;
    // How far the map reaches past the content at the opposite corner: the
    // aids draw the pure travel too, which ends a screen past the content, so
    // the mark stands a screen in from that corner, plus the margin and a step.
    const oppositeSlop = (handle: Box, screen: number) =>
      (screen + MINIMAP_MAP_MARGIN + MINIMAP_MAP_STEP) * ratioOf(handle) + 1;
    /**
     * Where the handle and the table's mark stand on the thumbnail: how far
     * each is in from every edge of the map, and their middles, so a corner
     * that fails names the edge that moved and by how much.
     */
    const corners = async () => {
      const thumbnail = await boxOf(erd.minimap);
      const handle = await boxOf(erd.minimapViewport);
      const mark = await boxOf(erd.minimapTable('users'));
      const inset = (box: Box) => ({
        left: box.x - thumbnail.x,
        top: box.y - thumbnail.y,
        right: thumbnail.x + thumbnail.width - (box.x + box.width),
        bottom: thumbnail.y + thumbnail.height - (box.y + box.height),
        middle: middleOf(box),
      });

      return {
        handle: inset(handle),
        mark: inset(mark),
        slop: cornerSlop(handle),
        across: {
          x: oppositeSlop(handle, canvas.width),
          y: oppositeSlop(handle, canvas.height),
        },
      };
    };
    // The map grew around the far screen once the handle, the screen at the
    // map's ratio, has shrunk from what it was at home.
    const whenMapGrew = () =>
      expect
        .poll(async () => (await boxOf(erd.minimapViewport)).width)
        .toBeLessThan(home.handle.width);

    await erd.wheel(0, { deltaX: -1000 });
    await expect.poll(originOf).toEqual({ x: 1000, y: 0 });

    // Scene coordinates the old box had no room for are on the screen now.
    const negative = await erd.pointAt(-500, 100);
    expectClose(negative.x, canvasZero.x + 1000 - 500, PIXEL_TOLERANCE);

    // Past the content's near edge on both axes by three screens: the pure
    // travel ended where that edge met the screen's far edge, and the wheel
    // goes on from there exactly as far as it is turned.
    const pastNear = {
      x: canvas.width - NEAR.x + SCREENS_BEYOND * canvas.width,
      y: canvas.height - NEAR.y + SCREENS_BEYOND * canvas.height,
    };
    await wheelTo(pastNear);

    // The travel behind each thumb grew by the screens the view went out, so
    // the screen's share of it, the thumb, shrank toward the floor.
    await expect
      .poll(async () => (await boxOf(thumb)).width)
      .toBeLessThan(home.thumb.width);
    expect((await boxOf(thumb)).width).toBeGreaterThanOrEqual(
      SCROLLBAR_THUMB_MIN
    );
    await expect
      .poll(async () => (await boxOf(upright)).height)
      .toBeLessThan(home.upright.height);
    expect((await boxOf(upright)).height).toBeGreaterThanOrEqual(
      SCROLLBAR_THUMB_MIN
    );

    // The view is up and left of the content, so the map grew that way: the
    // handle sits in its top left corner and the table's mark in the bottom right.
    await whenMapGrew();
    const upLeft = await corners();
    expect(upLeft.handle.left, 'handle in from the left').toBeLessThanOrEqual(
      upLeft.slop
    );
    expect(upLeft.handle.top, 'handle in from the top').toBeLessThanOrEqual(
      upLeft.slop
    );
    expect(upLeft.mark.right, 'mark in from the right').toBeLessThanOrEqual(
      upLeft.across.x
    );
    expect(upLeft.mark.bottom, 'mark in from the bottom').toBeLessThanOrEqual(
      upLeft.across.y
    );
    expect(upLeft.handle.middle.x, 'handle middle x').toBeLessThan(
      upLeft.mark.middle.x
    );
    expect(upLeft.handle.middle.y, 'handle middle y').toBeLessThan(
      upLeft.mark.middle.y
    );

    // Back to where it began, by the same wheel the other way.
    await wheelTo({ x: 0, y: 0 });
    await expect
      .poll(async () => (await boxOf(thumb)).width)
      .toBeCloseTo(home.thumb.width, 0);

    // Past the content's far edge on both axes by three screens: the pure
    // travel ended where that edge met the screen's near edge.
    const pastFar = {
      x: -far.x - SCREENS_BEYOND * canvas.width,
      y: -far.y - SCREENS_BEYOND * canvas.height,
    };
    await wheelTo(pastFar);

    await expect
      .poll(async () => (await boxOf(thumb)).width)
      .toBeLessThan(home.thumb.width);
    await expect
      .poll(async () => (await boxOf(upright)).height)
      .toBeLessThan(home.upright.height);

    // The view is now down and right of the content: the corners swap.
    await whenMapGrew();
    const downRight = await corners();
    expect(
      downRight.handle.right,
      'handle in from the right'
    ).toBeLessThanOrEqual(downRight.slop);
    expect(
      downRight.handle.bottom,
      'handle in from the bottom'
    ).toBeLessThanOrEqual(downRight.slop);
    expect(downRight.mark.left, 'mark in from the left').toBeLessThanOrEqual(
      downRight.across.x
    );
    expect(downRight.mark.top, 'mark in from the top').toBeLessThanOrEqual(
      downRight.across.y
    );
    expect(downRight.handle.middle.x, 'handle middle x').toBeGreaterThan(
      downRight.mark.middle.x
    );
    expect(downRight.handle.middle.y, 'handle middle y').toBeGreaterThan(
      downRight.mark.middle.y
    );

    await wheelTo({ x: 0, y: 0 });
    await expect
      .poll(async () => (await boxOf(upright)).height)
      .toBeCloseTo(home.upright.height, 0);
  });

  test('pans an empty document with the wheel and the grab tool', async ({
    erd,
  }) => {
    await erd.seed(createSchema());

    // Nothing to scroll over draws no scrollbar at all, and the pan does not
    // need one: the wheel and the grab move the view exactly as far as they go.
    const tracks = erd.host.locator('.virtual-scroll');
    await expect(tracks).toHaveCount(0);
    await expect(erd.minimap).toHaveCount(0);
    await expect(erd.minimapViewport).toHaveCount(0);
    await expect(erd.contentCompass).toHaveCount(0);
    expect(await erd.tableIds()).toEqual([]);

    await erd.wheel(-700, { deltaX: -1500 });
    await expect
      .poll(async () => {
        const { originX, originY } = await erd.settings();
        return { x: originX, y: originY };
      })
      .toEqual({ x: 1500, y: 700 });

    // Each grab starts from a named scene point, the one under a screen point
    // with room for the drag on its way, since at zoom 1 the scene under a
    // screen point is that point less the origin.
    const under = async (screen: Point): Promise<Point> => {
      const { originX, originY } = await erd.settings();
      return { x: screen.x - originX, y: screen.y - originY };
    };

    await erd.panBy(-400, -250, await under({ x: 1000, y: 600 }));
    const panned = await erd.settings();
    expectClose(panned.originX, 1500 - 400, PIXEL_TOLERANCE);
    expectClose(panned.originY, 700 - 250, PIXEL_TOLERANCE);

    await erd.panBy(900, 500, await under({ x: 200, y: 200 }));
    const back = await erd.settings();
    expectClose(back.originX, panned.originX + 900, PIXEL_TOLERANCE);
    expectClose(back.originY, panned.originY + 500, PIXEL_TOLERANCE);
    await expect(tracks).toHaveCount(0);
  });

  test('points the way back once the screen is off every entity, and goes there when pressed', async ({
    erd,
  }) => {
    await erd.seed(createSchema({ tables: [tableAt('users', 200, 200)] }));

    // Nothing to point at while the table is on the screen.
    await expect(erd.contentCompass).toHaveCount(0);

    // Carried up and left of the table by more than a screen, so what is left
    // to find lies off the top left corner of everything the reader can see.
    await erd.wheel(2_500, { deltaX: 3_000 });
    await expect
      .poll(async () => {
        const { originX, originY } = await erd.settings();
        return { x: originX, y: originY };
      })
      .toEqual({ x: -3_000, y: -2_500 });

    await expect(erd.contentCompass).toBeVisible();

    // The gap in scene units, which at zoom 1 is the pixels between the near
    // edge of the screen and the table's own box.
    await expect(erd.contentCompass).toHaveText(/^\d[\d.]*k?$/);

    const rotation = await erd.contentCompass
      .locator('.icon')
      .evaluate(el => (el as HTMLElement).style.transform);
    const angle = Number(/rotate\((-?[\d.]+)deg\)/.exec(rotation)?.[1]);
    expect(angle).toBeGreaterThan(-180);
    expect(angle).toBeLessThan(-90);

    await erd.contentCompass.click();

    // The press puts the table in the middle of the screen, which leaves the
    // compass with nothing to point at.
    await expect(erd.contentCompass).toHaveCount(0);
    const canvas = await boxOf(erd.host.locator('[data-testid="erd-canvas"]'));
    const drawn = await erd.sceneBox('#table-users');
    expectClose(
      drawn.x + drawn.width / 2,
      canvas.x + canvas.width / 2,
      PIXEL_TOLERANCE
    );
    expectClose(
      drawn.y + drawn.height / 2,
      canvas.y + canvas.height / 2,
      PIXEL_TOLERANCE
    );
  });

  test('sizes the scrollbar thumbs from the content, never under the floor', async ({
    erd,
  }) => {
    // The horizontal track is rendered first and the vertical one second, and
    // each thumb is sized along its own axis: a width here, a height there.
    const tracks = erd.host.locator('.virtual-scroll');
    const thumb = tracks.first().locator('.virtual-scroll-ghost-thumb');
    const upright = tracks.nth(1).locator('.virtual-scroll-ghost-thumb');

    await erd.seed(
      createSchema({
        tables: [tableAt('home', 200, 200), tableAt('mid', 3000, 1500)],
      })
    );
    await expect(tracks).toHaveCount(2);
    const near = await boxOf(thumb);
    const nearUpright = await boxOf(upright);
    expect(near.width).toBeGreaterThan(SCROLLBAR_THUMB_MIN);
    expect(nearUpright.height).toBeGreaterThan(SCROLLBAR_THUMB_MIN);

    await erd.seed(
      createSchema({
        tables: [tableAt('home', 200, 200), tableAt('far', 500_000, 500_000)],
      })
    );

    // Half a million units of travel would draw the screen's share of it a few
    // pixels long, so the floor is what the reader is left something to grab by.
    await expect
      .poll(async () => (await boxOf(thumb)).width)
      .toBeCloseTo(SCROLLBAR_THUMB_MIN, 1);
    await expect
      .poll(async () => (await boxOf(upright)).height)
      .toBeCloseTo(SCROLLBAR_THUMB_MIN, 1);
    expect((await boxOf(thumb)).width).toBeLessThan(near.width);
    expect((await boxOf(upright)).height).toBeLessThan(nearUpright.height);
  });

  test('maps content far outside the old box, screen handle and all', async ({
    erd,
  }) => {
    await erd.seed(
      createSchema({
        tables: [tableAt('home', 200, 200), tableAt('west', -8000, -3000)],
      })
    );

    await expect(erd.minimapTable('home')).toHaveCount(1);
    await expect(erd.minimapTable('west')).toHaveCount(1);

    // The thumbnail is the map of the travel, the content and a screen either
    // way, so its longer side fills the frame and the shorter one is centred in it.
    const thumbnail = await boxOf(erd.minimap);
    expect(Math.max(thumbnail.width, thumbnail.height)).toBeCloseTo(
      MINIMAP_SIZE,
      3
    );

    const handle = await boxOf(erd.minimapViewport);
    expect(handle.width).toBeLessThan(thumbnail.width);
    expect(handle.height).toBeLessThan(thumbnail.height);
    expect(handle.x).toBeGreaterThanOrEqual(thumbnail.x - 1);
    expect(handle.y).toBeGreaterThanOrEqual(thumbnail.y - 1);
    expect(handle.x + handle.width).toBeLessThanOrEqual(
      thumbnail.x + thumbnail.width + 1
    );
    expect(handle.y + handle.height).toBeLessThanOrEqual(
      thumbnail.y + thumbnail.height + 1
    );

    // The handle stands on the map where the screen stands on the scene: its
    // middle is off the home table's mark by what the screen's middle is off
    // the drawn table, at the handle's share of the screen, whatever the zoom.
    const canvas = await boxOf(erd.host.locator('[data-testid="erd-canvas"]'));
    const drawn = await erd.sceneBox('#table-home');
    const mark = await boxOf(erd.minimapTable('home'));
    const share = handle.width / canvas.width;
    const middleOf = (box: Box) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    const screen = middleOf(canvas);
    const table = middleOf(drawn);
    const pin = middleOf(mark);
    const grip = middleOf(handle);
    expectClose(grip.x - pin.x, (screen.x - table.x) * share, PIXEL_TOLERANCE);
    expectClose(grip.y - pin.y, (screen.y - table.y) * share, PIXEL_TOLERANCE);
  });

  test('holds the thumb still for a drag and resizes it on the drop', async ({
    erd,
  }) => {
    await erd.seed(
      createSchema({
        tables: [tableAt('home', 200, 200), tableAt('mover', 600, 300)],
      })
    );

    const thumb = erd.host
      .locator('.virtual-scroll')
      .first()
      .locator('.virtual-scroll-ghost-thumb');
    const before = await boxOf(thumb);

    const from = await erd.tableHeaderPoint('mover');
    await dragHold(erd, from, { x: from.x + 600, y: from.y });

    // The content rect is frozen for the drag, so the travel the thumb is
    // drawn against cannot grow under the pointer that is growing it.
    const during = await boxOf(thumb);
    expectClose(during.width, before.width, 0.5);

    await erd.page.mouse.up();

    // The drop hands the freeze back: six hundred more units of content is a
    // longer travel, and the screen's share of it is a shorter thumb.
    await expect
      .poll(async () => (await boxOf(thumb)).width)
      .toBeLessThan(before.width - 1);
  });

  test('places a table created after a scroll where the screen is, not where zero is', async ({
    erd,
  }) => {
    await erd.seed(
      createSchema({
        originX: 900,
        originY: 700,
        tables: [tableAt('users', 200, 200)],
      })
    );

    // The seed asks for a view well into negative scene space and the load
    // pulls that request onto the content, so the view it settles on is what
    // the rest of the case is derived from.
    const view = await erd.settings();
    expect(view.originX).toBeGreaterThan(0);
    expect(view.originY).toBeGreaterThan(0);

    // Focused at a named point rather than a swept one: a sweep for empty
    // canvas can land on a scrollbar track, and a press there is its own jump.
    await erd.focusCanvas({ x: -view.originX / 2, y: -view.originY / 2 });
    await erd.expectKeyboardFocusInside();
    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);

    const [addedId] = (await erd.tableIds()).filter(id => id !== 'users');
    const added = await erd.table(addedId);

    // A new entity is placed at a fixed screen point, so a view scrolled into
    // negative scene space puts it at a negative scene coordinate.
    expect(added.ui.x).toBe(START_X - view.originX);
    expect(added.ui.y).toBe(START_Y - view.originY);

    const zero = await erd.pointAt(0, 0);
    const box = await erd.sceneBox(`#table-${addedId}`);
    expectClose(box.x, zero.x - view.originX + START_X, PIXEL_TOLERANCE);
    expectClose(box.y, zero.y - view.originY + START_Y, PIXEL_TOLERANCE);
  });

  test('returns the origin after a zoom out and in over fifty thousand units', async ({
    erd,
  }) => {
    await erd.seed(
      createSchema({
        tables: [tableAt('home', 400, 300), tableAt('far', 50_000, 300)],
      })
    );

    const before = await erd.settings();

    for (const percent of [10, 150, 100]) {
      await toolbarZoom(erd, percent);
    }

    // Every step holds the middle of the screen still and names the origin it
    // means, so the walk composes to the identity bar the rounding on each one.
    const after = await erd.settings();
    expect(after.zoomLevel).toBeCloseTo(1, 5);
    expect(Math.abs(after.originX - before.originX)).toBeLessThan(0.05);
    expect(Math.abs(after.originY - before.originY)).toBeLessThan(0.05);
  });

  test('costs the drag no layer of its own', async ({ erd }) => {
    const warnings: string[] = [];
    erd.page.on('console', message => {
      if (message.text().includes('Recommended maximum number of layers')) {
        warnings.push(message.text());
      }
    });

    await erd.seed(
      createSchema({
        tables: [
          {
            id: 'users',
            name: 'users',
            x: 200,
            y: 200,
            columns: [{ id: 'users_id', name: 'id', dataType: 'int' }],
          },
          {
            id: 'posts',
            name: 'posts',
            x: 800,
            y: 460,
            columns: [
              { id: 'posts_user_id', name: 'user_id', dataType: 'int' },
            ],
          },
        ],
        relationships: [
          {
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            startTableId: 'users',
            startColumnIds: ['users_id'],
            endTableId: 'posts',
            endColumnIds: ['posts_user_id'],
          },
        ],
      })
    );

    const from = await erd.tableHeaderPoint('users');
    await erd.page.mouse.move(from.x, from.y);
    await erd.page.mouse.down();
    for (let step = 1; step <= 6; step++) {
      await erd.page.mouse.move(from.x + step * 10, from.y + step * 6);
    }

    const midDrag = await erd.page.evaluate(() => {
      const stage = Reflect.get(window, '__erdStages')?.canvas;
      const bottom = stage?.findOne('.canvas-background');
      return {
        layers: stage.getLayers().map((layer: any) => layer.name()),
        movingConnectors: bottom ? bottom.find('.relationship').length : -1,
      };
    });

    await erd.page.mouse.up();

    // Konva warns past five layers on a stage and a drag opens one of its own,
    // so the moving connectors share the bottom layer rather than take a sixth.
    expect(midDrag.layers).toContain('drag-entity');
    expect(midDrag.layers[0]).toBe('canvas-background');
    expect(midDrag.layers.length).toBeLessThanOrEqual(5);
    expect(midDrag.movingConnectors).toBe(1);
    expect(warnings).toEqual([]);
  });
});

/** The size a png declares in its header, which is the image the file holds. */
function pngSize(path: string) {
  const header = readFileSync(path).subarray(0, 24);
  expect(header.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

/**
 * Two memos, one at scene zero and one placed west and north of it, so the
 * drawn content spans a rect the seed states exactly and starts outside what
 * the old document box could hold.
 */
const WEST = -2000;
const NORTH = -1500;

function strandedMemos(): ErdDocument {
  return createSchema({
    databaseName: 'shop',
    memos: [
      { id: 'origin', value: 'origin', x: 0, y: 0, ...MEMO_BOX },
      { id: 'west', value: 'west', x: WEST, y: NORTH, ...MEMO_BOX },
    ],
  });
}

test.describe('an export of a canvas with no edges', () => {
  test.slow();

  test('draws the content that lies outside the old document box', async ({
    erd,
  }) => {
    await erd.seed(strandedMemos());

    const download = erd.page.waitForEvent('download', {
      timeout: EXPORT_TIMEOUT,
    });

    // Named rather than swept for: the menu opens downward from the click, and
    // both memos have to stay clear of it.
    await erd.openContextMenuAt(600, 400);
    await erd.contextMenu.getByText('Export', { exact: true }).hover();
    const png = erd.contextMenu.getByText('png', { exact: true });
    await expect(png).toBeVisible();
    await png.click();

    const file = await download;

    // The image is the union of the two memo frames plus the margin on every
    // side, which is a box the old export, anchored at zero, never reached.
    expect(pngSize(await file.path())).toEqual({
      width: memoWidth - WEST + EXPORT_MARGIN * 2,
      height: memoHeight - NORTH + EXPORT_MARGIN * 2,
    });
  });
});
