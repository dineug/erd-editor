import { expect, test } from '../support/fixtures';
import type { ErdEditorPage, Point } from '../support/ErdEditorPage';
import { createSchema, oneTable, twoTables } from '../support/schema';
import { MOD_KEY } from '../support/shortcuts';

/** One screen pixel of pointer rounding, doubled for the two drag endpoints. */
const PIXEL_TOLERANCE = 2;

/** constants/layout.ts — the rendered edge of .minimap, re-checked below. */
const MINIMAP_SIZE = 150;

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
 * translate(scrollLeft, scrollTop) scale(zoomLevel) transform and the
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

    // The drag has to carry $mod as well: selectTableAction$ unselects
    // everything else when the mousedown has no modifier, so a plain drag would
    // collapse the multi-selection to the table under the cursor first.
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
    expect([settings.scrollLeft, settings.scrollTop]).toEqual([0, 0]);
  });

  test('a plain drag on empty canvas pans the canvas and clamps at 0', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    // (1100, 700) in canvas coordinates is empty: posts sits at (760, 420)
    // and its box ends near (1090, 530).
    await erd.panBy(-240, -120, { x: 1100, y: 700 });

    const scrolled = await erd.settings();
    expectClose(scrolled.scrollLeft, -240, PIXEL_TOLERANCE);
    expectClose(scrolled.scrollTop, -120, PIXEL_TOLERANCE);

    // Scrolling back past the origin clamps: streamScrollTo caps at 0.
    await erd.panBy(360, 240, { x: 1100, y: 700 });

    const clamped = await erd.settings();
    expect(clamped.scrollLeft).toBe(0);
    expect(clamped.scrollTop).toBe(0);
  });

  test('holding Space pans even when the drag starts over a table', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    // grabMove is armed by a Space keydown whose target is a DIV, so the
    // editor root has to hold focus first. (1100, 700) is the same empty canvas
    // point the pan test uses.
    await erd.focusCanvas({ x: 1100, y: 700 });
    await erd.page.keyboard.down('Space');

    // Grab mode makes the canvas wrapper transparent to the pointer — that is
    // what stops the table underneath from receiving the mousedown.
    await expect(canvasController(erd)).toHaveCSS('pointer-events', 'none');

    const from = await erd.tableHeaderPoint('users');
    await erd.drag(from, { x: from.x - 120, y: from.y - 60 });
    // Space only disarms on a window-level keyup; leaving it down would make
    // every later drag in this page pan.
    await erd.page.keyboard.up('Space');
    await expect(canvasController(erd)).toHaveCSS('pointer-events', 'auto');

    const settings = await erd.settings();
    expectClose(settings.scrollLeft, -120, PIXEL_TOLERANCE);
    expectClose(settings.scrollTop, -60, PIXEL_TOLERANCE);

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

    // useMinimapScroll divides the pointer movement by the minimap's own scale,
    // and the minimap is the full canvas scaled by exactly that ratio, so the
    // rendered box is where the ratio comes from.
    const minimapBox = await boxOf(erd.minimap);
    expect(minimapBox.width).toBeCloseTo(MINIMAP_SIZE, 3);
    const ratio = minimapBox.width / settingsBefore.width;

    const handleBefore = await boxOf(erd.minimapViewport);

    const from = await erd.centerOf(erd.minimapViewport);
    await erd.drag(from, { x: from.x + 24, y: from.y + 12 });

    const settings = await erd.settings();
    const tolerance = PIXEL_TOLERANCE / ratio;
    expectClose(settings.scrollLeft, -24 / ratio, tolerance);
    expectClose(settings.scrollTop, -12 / ratio, tolerance);

    // The handle follows the pointer 1:1, because it is drawn at
    // scroll * ratio.
    const handleAfter = await boxOf(erd.minimapViewport);
    expectClose(handleAfter.x - handleBefore.x, 24, PIXEL_TOLERANCE);
    expectClose(handleAfter.y - handleBefore.y, 12, PIXEL_TOLERANCE);
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

    const settingsBefore = await erd.settings();
    const before = await boxOf(thumb);

    // getWidthRatio is the viewport over the canvas width, and the viewport is
    // fed by a ResizeObserver that subtracts only the toolbar height, so the
    // host width is the viewport width. The thumb width verifies that.
    const hostBox = await boxOf(erd.host);
    const ratio = hostBox.width / settingsBefore.width;
    expectClose(before.width, hostBox.width * ratio, PIXEL_TOLERANCE);

    const from = await erd.centerOf(thumb);
    await dragHold(erd, from, { x: from.x + 48, y: from.y });
    // [data-selected] marks the grabbed thumb for as long as the drag runs.
    await expect(thumb).toHaveAttribute('data-selected', '');
    await erd.page.mouse.up();
    await expect(thumb).not.toHaveAttribute('data-selected', '');

    const settings = await erd.settings();
    expectClose(settings.scrollLeft, -48 / ratio, PIXEL_TOLERANCE / ratio);
    expect(settings.scrollTop).toBe(0);

    // The thumb is drawn at -scrollLeft * ratio, which is exactly the
    // pointer delta again.
    const after = await boxOf(thumb);
    expectClose(after.x - before.x, 48, PIXEL_TOLERANCE);
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
