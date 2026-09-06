import { expect, test } from '../support/fixtures';
import type { ErdEditorPage, Point } from '../support/ErdEditorPage';
import { createSchema, oneTable, twoTables } from '../support/schema';
import { MOD_KEY, Shortcut } from '../support/shortcuts';

/** One screen pixel of pointer rounding, doubled for the two drag endpoints. */
const PIXEL_TOLERANCE = 2;

/** constants/layout.ts — the square the minimap frame draws, re-checked below. */
const MINIMAP_SIZE = 150;

/**
 * How far past the content's far edge a pan is carried, in scene units. Only
 * the sign of it is the point: the travel the aids draw ends at that edge, and
 * the pan goes on regardless of it.
 */
const BEYOND_EDGE = 200;

/** How far the thumb is dragged, and the step taken before it is measured. */
const THUMB_DRAG = 48;
const FIRST_STEP = 4;

/** useVirtualScroll.ts — the width the drawn thumb never goes under. */
const SCROLLBAR_THUMB_MIN = 24;

function expectClose(actual: number, expected: number, tolerance: number) {
  expect(
    Math.abs(actual - expected),
    `expected ${actual} to be within ${tolerance} of ${expected}`
  ).toBeLessThanOrEqual(tolerance);
}

type Box = { x: number; y: number; width: number; height: number };

/** boundingBox() narrowed to a value, so every geometry read stays readable. */
async function boxOf(target: {
  boundingBox: () => Promise<Box | null>;
}): Promise<Box> {
  const box = await target.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return box;
}

/**
 * DragSelect renders its marquee with a generated class, so the stable handle is
 * its own markup: the one short-dashed rect in the editor. It lives outside the
 * canvas, so this is one of the few locators going through the host.
 */
const marqueeBand = (erd: ErdEditorPage) =>
  erd.host.locator('svg:has(rect[stroke-dasharray="3"])');

/**
 * The div Canvas.ts wraps the canvas in. It carries the
 * translate(originX, originY) scale(zoomLevel) transform and the
 * pointer-events switch, so it is what a pan visibly moves.
 */
const canvasController = (erd: ErdEditorPage) => erd.canvas.locator('xpath=..');

/**
 * Presses and steps the mouse to to without releasing, so a spec can assert
 * on the state that only exists mid-drag. The caller owns the mouse.up().
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

/**
 * Mousedown on a table header, the strip that starts a move drag. Holding the
 * modifier opens the context menu on some hosts and not others, harmlessly, so
 * nothing in this file may assert on its presence or absence.
 */
async function pressTableHeader(
  erd: ErdEditorPage,
  id: string,
  options: { mod?: boolean } = {}
) {
  const point = await erd.tableHeaderPoint(id);
  if (options.mod) await erd.page.keyboard.down(MOD_KEY);
  await erd.page.mouse.click(point.x, point.y);
  if (options.mod) await erd.page.keyboard.up(MOD_KEY);
}

const threeTables = () =>
  createSchema({
    tables: [
      {
        id: 'a',
        name: 'a',
        x: 160,
        y: 160,
        columns: [{ id: 'a_id', name: 'id', dataType: 'int' }],
      },
      {
        id: 'b',
        name: 'b',
        x: 700,
        y: 160,
        columns: [{ id: 'b_id', name: 'id', dataType: 'int' }],
      },
      {
        id: 'c',
        name: 'c',
        x: 160,
        y: 520,
        columns: [{ id: 'c_id', name: 'id', dataType: 'int' }],
      },
    ],
  });

test.describe('mouse drag', () => {
  test('dragging a table header moves it by the pointer delta', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const before = await boxOf(erd.tableEl('users'));

    // 120 x 60 over the helper's 12 steps is a whole number of pixels per move,
    // and well past the 20px MOVE_MIN that gates a history entry.
    await erd.moveTable('users', 120, 60);

    const users = await erd.table('users');
    // zoomLevel is 1, so the canvas delta equals the pointer delta exactly.
    expectClose(users.ui.x, 160 + 120, PIXEL_TOLERANCE);
    expectClose(users.ui.y, 160 + 60, PIXEL_TOLERANCE);

    const after = await boxOf(erd.tableEl('users'));
    expectClose(after.x - before.x, 120, PIXEL_TOLERANCE);
    expectClose(after.y - before.y, 60, PIXEL_TOLERANCE);

    // The mousedown that starts the move also selects the table.
    await expect(erd.tableEl('users')).toHaveAttribute('data-selected', '');
    await expect(erd.selectedTables()).toHaveCount(1);

    const posts = await erd.table('posts');
    expect([posts.ui.x, posts.ui.y]).toEqual([760, 420]);
  });

  test('under zoom the table movement is divided by zoomLevel', async ({
    erd,
  }) => {
    const seed = twoTables();
    // 0.8 keeps the normal table render — at <= 0.7 it swaps to high-level.
    seed.settings.zoomLevel = 0.8;
    await erd.seed(seed);

    // The high-level render drops the column rows, so their presence is the
    // proof that 0.8 really did stay on the detailed table.
    await expect(erd.tableEl('users').locator('.column-row')).toHaveCount(2);

    const before = await boxOf(erd.tableEl('users'));

    await erd.moveTable('users', 96, 48);

    // moveAllAction$ divides the pointer delta by zoomLevel, so 96 screen px
    // is 120 canvas units at 0.8.
    const users = await erd.table('users');
    expectClose(users.ui.x, 160 + 96 / 0.8, PIXEL_TOLERANCE / 0.8);
    expectClose(users.ui.y, 160 + 48 / 0.8, PIXEL_TOLERANCE / 0.8);

    // …and on screen that canvas delta is scaled back down, so the element
    // still tracks the pointer 1:1.
    const after = await boxOf(erd.tableEl('users'));
    expectClose(after.x - before.x, 96, PIXEL_TOLERANCE);
    expectClose(after.y - before.y, 48, PIXEL_TOLERANCE);
  });

  test('a $mod drag moves every selected table and leaves the rest alone', async ({
    erd,
  }) => {
    await erd.seed(threeTables());

    const beforeB = await boxOf(erd.tableEl('b'));

    await pressTableHeader(erd, 'a');
    await pressTableHeader(erd, 'b', { mod: true });
    await expect(erd.selectedTables()).toHaveCount(2);

    // The modifier is no longer what keeps the selection together — a press on
    // a table already in it does that — but a $mod drag is the older spelling
    // and still has to carry the whole selection.
    const from = await erd.tableHeaderPoint('a');
    await erd.drag(
      from,
      { x: from.x + 120, y: from.y + 60 },
      { modifiers: [MOD_KEY] }
    );

    const [a, b, c] = [
      await erd.table('a'),
      await erd.table('b'),
      await erd.table('c'),
    ];
    expectClose(a.ui.x, 160 + 120, PIXEL_TOLERANCE);
    expectClose(a.ui.y, 160 + 60, PIXEL_TOLERANCE);
    expectClose(b.ui.x, 700 + 120, PIXEL_TOLERANCE);
    expectClose(b.ui.y, 160 + 60, PIXEL_TOLERANCE);
    expect([c.ui.x, c.ui.y]).toEqual([160, 520]);

    // b was never under the cursor, so its rendered box is the visible proof
    // that the drag carried the whole selection.
    const afterB = await boxOf(erd.tableEl('b'));
    expectClose(afterB.x - beforeB.x, 120, PIXEL_TOLERANCE);
    expectClose(afterB.y - beforeB.y, 60, PIXEL_TOLERANCE);

    await expect(erd.selectedTables()).toHaveCount(2);
    await expect(erd.tableEl('c')).not.toHaveAttribute('data-selected', '');
  });

  test('a plain drag on a table the selection holds carries the whole selection', async ({
    erd,
  }) => {
    await erd.seed(threeTables());

    await pressTableHeader(erd, 'a');
    await pressTableHeader(erd, 'b', { mod: true });
    await expect(erd.selectedTables()).toHaveCount(2);

    // No modifier at all this time: the press lands on a table the selection
    // already holds, so it keeps it rather than collapsing onto that table.
    const from = await erd.tableHeaderPoint('a');
    await erd.drag(from, { x: from.x + 120, y: from.y + 60 });

    const [a, b, c] = [
      await erd.table('a'),
      await erd.table('b'),
      await erd.table('c'),
    ];
    expectClose(a.ui.x, 160 + 120, PIXEL_TOLERANCE);
    expectClose(a.ui.y, 160 + 60, PIXEL_TOLERANCE);
    expectClose(b.ui.x, 700 + 120, PIXEL_TOLERANCE);
    expectClose(b.ui.y, 160 + 60, PIXEL_TOLERANCE);
    expect([c.ui.x, c.ui.y]).toEqual([160, 520]);
    await expect(erd.selectedTables()).toHaveCount(2);
  });

  test('a plain drag on a table the selection never held collapses onto it', async ({
    erd,
  }) => {
    await erd.seed(threeTables());

    await pressTableHeader(erd, 'a');
    await pressTableHeader(erd, 'b', { mod: true });
    await expect(erd.selectedTables()).toHaveCount(2);

    const from = await erd.tableHeaderPoint('c');
    await erd.drag(from, { x: from.x + 90, y: from.y + 40 });

    const [a, b, c] = [
      await erd.table('a'),
      await erd.table('b'),
      await erd.table('c'),
    ];
    expect([a.ui.x, a.ui.y]).toEqual([160, 160]);
    expect([b.ui.x, b.ui.y]).toEqual([700, 160]);
    expectClose(c.ui.x, 160 + 90, PIXEL_TOLERANCE);
    expectClose(c.ui.y, 520 + 40, PIXEL_TOLERANCE);
    await expect(erd.selectedTables()).toHaveCount(1);
  });

  test('$mod + drag on empty canvas marquee-selects the tables it covers', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const band = marqueeBand(erd);
    await expect(band).toHaveCount(0);

    // Selection tests the table's centre box, so the band is built around the
    // rendered users element with a margin — well clear of posts.
    const users = await boxOf(erd.tableEl('users'));
    const from = { x: users.x - 30, y: users.y - 30 };
    const to = {
      x: users.x + users.width + 30,
      y: users.y + users.height + 30,
    };

    await erd.page.keyboard.down(MOD_KEY);
    await dragHold(erd, from, to);

    await expect(band).toBeVisible();
    const bandBox = await boxOf(band);
    expectClose(bandBox.width, to.x - from.x, PIXEL_TOLERANCE);
    expectClose(bandBox.height, to.y - from.y, PIXEL_TOLERANCE);

    await erd.page.mouse.up();
    await erd.page.keyboard.up(MOD_KEY);

    // The band only exists while state.dragSelect is true.
    await expect(band).toHaveCount(0);
    await expect(erd.tableEl('users')).toHaveAttribute('data-selected', '');
    await expect(erd.selectedTables()).toHaveCount(1);

    // A second band over blank canvas selects nothing, which clears the first.
    // The band assertion below is what distinguishes a real marquee from the
    // pan the same drag would be unmodified, since either unselects all.
    const posts = await boxOf(erd.tableEl('posts'));
    const blankFrom = { x: posts.x + posts.width + 60, y: posts.y + 120 };
    const blankTo = { x: blankFrom.x + 180, y: blankFrom.y + 120 };

    await erd.page.keyboard.down(MOD_KEY);
    await dragHold(erd, blankFrom, blankTo);
    await expect(band).toBeVisible();
    await erd.page.mouse.up();
    await erd.page.keyboard.up(MOD_KEY);

    await expect(band).toHaveCount(0);
    await expect(erd.selectedTables()).toHaveCount(0);

    // …and it marquee-selected rather than panned.
    const settings = await erd.settings();
    expect([settings.originX, settings.originY]).toEqual([0, 0]);
  });

  test('a plain drag on empty canvas pans the canvas and keeps going past it', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    // At zoom 1 and origin 0 a screen offset from scene zero is a scene
    // coordinate, so the far corner of the lower, righter table is where the
    // content ends — posts is that table in this seed.
    const zero = await erd.pointAt(0, 0);
    const posts = await erd.sceneBox('#table-posts');
    const farX = posts.x - zero.x + posts.width;
    const farY = posts.y - zero.y + posts.height;

    // (1100, 700) in canvas coordinates is empty: posts sits at (760, 420)
    // and its box ends near (1090, 530).
    await erd.panBy(-240, -120, { x: 1100, y: 700 });

    const scrolled = await erd.settings();
    expectClose(scrolled.originX, -240, PIXEL_TOLERANCE);
    expectClose(scrolled.originY, -120, PIXEL_TOLERANCE);

    // Dragging on west reaches where the content's far edge meets the near
    // edge of the screen, and the next drag goes straight past it: how far that
    // is comes off the drawn box, since a font decides how wide a table is.
    const toEdge = {
      x: Math.ceil(farX + scrolled.originX) + BEYOND_EDGE,
      y: Math.ceil(farY + scrolled.originY) + BEYOND_EDGE,
    };
    await erd.panBy(-toEdge.x, -toEdge.y);

    const edge = await erd.settings();
    expectClose(edge.originX, scrolled.originX - toEdge.x, PIXEL_TOLERANCE);
    expectClose(edge.originY, scrolled.originY - toEdge.y, PIXEL_TOLERANCE);
    expect(edge.originX).toBeLessThanOrEqual(-farX + PIXEL_TOLERANCE);
    expect(edge.originY).toBeLessThanOrEqual(-farY + PIXEL_TOLERANCE);

    await erd.panBy(-900, -600);

    const past = await erd.settings();
    expectClose(past.originX, edge.originX - 900, PIXEL_TOLERANCE);
    expectClose(past.originY, edge.originY - 600, PIXEL_TOLERANCE);
    expect(past.originX).toBeLessThan(-farX - BEYOND_EDGE);
    expect(past.originY).toBeLessThan(-farY - BEYOND_EDGE);
  });

  test('the hand tool pans even when the drag starts over a table', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    // Space toggles the tool rather than holding it, so the editor root has to
    // own the keyboard first. (1100, 700) is the same empty canvas point the
    // pan test uses.
    await erd.focusCanvas({ x: 1100, y: 700 });
    await erd.press(Shortcut.handTool);

    // The hand makes the canvas wrapper transparent to the pointer — that is
    // what stops the table underneath from receiving the mousedown.
    await expect(canvasController(erd)).toHaveCSS('pointer-events', 'none');

    const from = await erd.tableHeaderPoint('users');
    await erd.drag(from, { x: from.x - 120, y: from.y - 60 });
    // The tool stays down until it is pressed again; leaving it down would make
    // every later drag in this page pan.
    await erd.press(Shortcut.handTool);
    await expect(canvasController(erd)).toHaveCSS('pointer-events', 'auto');

    const settings = await erd.settings();
    expectClose(settings.originX, -120, PIXEL_TOLERANCE);
    expectClose(settings.originY, -60, PIXEL_TOLERANCE);

    // The table itself never moved, and never even got the mousedown.
    const users = await erd.table('users');
    expect([users.ui.x, users.ui.y]).toEqual([160, 160]);
    await expect(erd.tableEl('users')).not.toHaveAttribute('data-selected', '');
    await expect(erd.selectedTables()).toHaveCount(0);
  });

  test('dragging the minimap viewport handle pans the canvas proportionally', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const settingsBefore = await erd.settings();
    const hostBox = await boxOf(erd.host);

    // The thumbnail is a map of the travel, the content and a screen either
    // way, so its longer side fills the frame; the handle is the screen mapped
    // onto it, which is where the scale the drag is divided by can be read.
    const minimapBox = await boxOf(erd.minimap);
    expect(Math.max(minimapBox.width, minimapBox.height)).toBeCloseTo(
      MINIMAP_SIZE,
      3
    );
    const handleBefore = await boxOf(erd.minimapViewport);
    const ratio =
      handleBefore.width / (hostBox.width / settingsBefore.zoomLevel);

    const from = await erd.centerOf(erd.minimapViewport);
    await dragHold(erd, from, { x: from.x + 24, y: from.y + 12 });

    // The map is held still for the drag, so the ratio the press saw is the
    // one every step is read against and the handle follows the pointer 1:1.
    const handleDuring = await boxOf(erd.minimapViewport);
    expectClose(handleDuring.x - handleBefore.x, 24, PIXEL_TOLERANCE);
    expectClose(handleDuring.y - handleBefore.y, 12, PIXEL_TOLERANCE);
    await erd.page.mouse.up();

    const settings = await erd.settings();
    const tolerance = PIXEL_TOLERANCE / ratio;
    expectClose(settings.originX, -24 / ratio, tolerance);
    expectClose(settings.originY, -12 / ratio, tolerance);
  });

  test('dragging the horizontal scrollbar thumb scrolls the canvas', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    // VirtualScroll is a sibling of the canvas, not a child of it, so this is
    // a deliberate host locator. It renders the horizontal track first and
    // the vertical one second; the shape assertion pins which one this is.
    const tracks = erd.host.locator('.virtual-scroll');
    await expect(tracks).toHaveCount(2);
    const track = tracks.first();
    const thumb = track.locator('.virtual-scroll-ghost-thumb');
    const trackBox = await boxOf(track);
    expect(trackBox.width).toBeGreaterThan(trackBox.height);

    // The thumb is the screen's share of a screen plus the travel behind it and
    // slides over what that leaves, so the gain a drag is scaled by is the
    // thumb's share of the viewport — the host, not the slightly shorter track.
    const hostBox = await boxOf(erd.host);
    expect(trackBox.width).toBeLessThanOrEqual(hostBox.width);

    const from = await erd.centerOf(thumb);
    await erd.page.mouse.move(from.x, from.y);
    await erd.page.mouse.down();

    // Stepped once before anything is measured: the press is what reads the
    // table sizes the relationship sort settles after a load, so the two boxes
    // below are taken against the one geometry the drag holds frozen.
    await erd.page.mouse.move(from.x + FIRST_STEP, from.y);
    // [data-selected] marks the grabbed thumb for as long as the drag runs.
    await expect(thumb).toHaveAttribute('data-selected', '');

    const held = await boxOf(thumb);
    expect(held.width).toBeGreaterThan(SCROLLBAR_THUMB_MIN);
    const ratio = held.width / hostBox.width;

    await erd.page.mouse.move(from.x + THUMB_DRAG, from.y);

    // The thumb is drawn at what is left of the travel above the origin, and
    // the drag scales the pointer against that same travel, so what it slid is
    // the pointer delta itself.
    const during = await boxOf(thumb);
    expectClose(during.x - held.x, THUMB_DRAG - FIRST_STEP, PIXEL_TOLERANCE);

    await erd.page.mouse.up();
    await expect(thumb).not.toHaveAttribute('data-selected', '');

    const settings = await erd.settings();
    expectClose(settings.originX, -THUMB_DRAG / ratio, PIXEL_TOLERANCE / ratio);
    expect(settings.originY).toBe(0);

    // The drop hands the freeze back, and the drag stayed inside the travel the
    // content alone allows, so what it was drawn against is what it is drawn
    // against now: the thumb does not jump when the gesture ends.
    const after = await boxOf(thumb);
    expectClose(after.x, during.x, PIXEL_TOLERANCE);
    expectClose(after.width, held.width, PIXEL_TOLERANCE);
  });

  test('reordering a column by native drag-and-drop moves it in the store and the DOM', async ({
    erd,
  }) => {
    await erd.seed(oneTable());

    const domOrder = () =>
      erd.canvas
        .locator('.column-row')
        .evaluateAll(els => els.map(el => (el as HTMLElement).dataset.id));

    expect(await erd.columnIds('users')).toEqual(['users_id', 'users_name']);
    expect(await domOrder()).toEqual(['users_id', 'users_name']);

    // handleDragstartColumn bails unless a column already holds focus, so the
    // focus ring is a precondition rather than a nicety.
    await erd.focusCell(erd.cell(erd.columnEl('users_name'), 'columnName'));

    // Column rows use native drag-and-drop, and dragTo() drops too fast:
    // fromShadowDraggable debounces dragover and tears down on dragend, so a
    // drag that releases immediately never emits.
    const source = await erd.centerOf(erd.columnEl('users_name'));
    const target = await erd.centerOf(erd.columnEl('users_id'));
    await dragHold(erd, source, target, 6);

    // The rows are reordered under a FLIP animation, so wait on the settled
    // DOM order rather than on a transform or a timeout.
    await expect.poll(domOrder).toEqual(['users_name', 'users_id']);
    expect(await erd.columnIds('users')).toEqual(['users_name', 'users_id']);

    await erd.page.mouse.up();

    // The drop keeps the order the dragover already applied.
    expect(await erd.columnIds('users')).toEqual(['users_name', 'users_id']);
    expect(await domOrder()).toEqual(['users_name', 'users_id']);
    // The table still owns both columns — a reorder is not a move.
    expect(await erd.tableIds()).toEqual(['users']);
  });

  test('a whole move drag collapses into a single undo step', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const before = await boxOf(erd.tableEl('users'));
    // active is one class among emotion-generated ones, hence the word match.
    await expect(erd.toolbarButton('Undo')).not.toHaveClass(/\bactive\b/);
    await expect(erd.toolbarButton('Redo')).not.toHaveClass(/\bactive\b/);

    await erd.moveTable('users', 120, 60);
    await expect(erd.toolbarButton('Undo')).toHaveClass(/\bactive\b/);

    // 12 mousemoves, one history entry: moveTable is a stream action that the
    // history groups per drag, so a single click has to undo the whole thing.
    await erd.toolbarButton('Undo').click();

    const users = await erd.table('users');
    expect([users.ui.x, users.ui.y]).toEqual([160, 160]);

    const after = await boxOf(erd.tableEl('users'));
    expect(after.x).toBeCloseTo(before.x, 1);
    expect(after.y).toBeCloseTo(before.y, 1);
    await expect(erd.toolbarButton('Undo')).not.toHaveClass(/\bactive\b/);
    await expect(erd.toolbarButton('Redo')).toHaveClass(/\bactive\b/);
  });
});
