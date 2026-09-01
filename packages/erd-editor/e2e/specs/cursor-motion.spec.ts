import { expect, test } from '../support/fixtures';
import {
  createSchema,
  type ErdDocument,
  oneTable,
  twoTables,
} from '../support/schema';

// AC-I7. A dom node carried its own cursor in a stylesheet and a reordered row
// animated because css said transition. Konva has neither, so the container is
// pointed at a cursor by hand and the settle is a tween that has to land.

/** The cursor the editor root leaves on the canvas when nothing asks for one. */
const IDLE = 'auto';

/** What each sash asks the container for while the pointer rests on it. */
const SASH_CURSORS = {
  left: 'ew-resize',
  right: 'ew-resize',
  bottom: 'ns-resize',
  lt: 'nwse-resize',
  rt: 'nesw-resize',
  lb: 'nesw-resize',
  rb: 'nwse-resize',
} as const;

function withMemo(): ErdDocument {
  return createSchema({
    memos: [{ id: 'note', value: 'a memo', x: 320, y: 240 }],
  });
}

test.describe('cursor and motion', () => {
  test('holding Space asks for a grab and the press makes it a fist', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    expect(await erd.canvasCursor()).toBe(IDLE);

    await erd.focusCanvas({ x: 1100, y: 700 });
    await erd.page.keyboard.down('Space');
    await expect.poll(() => erd.canvasCursor()).toBe('grab');

    const from = await erd.pointAt(1100, 700);
    await erd.page.mouse.move(from.x, from.y);
    await erd.page.mouse.down();
    await erd.page.mouse.move(from.x - 40, from.y - 20);
    await expect.poll(() => erd.canvasCursor()).toBe('grabbing');

    await erd.page.mouse.up();
    await expect.poll(() => erd.canvasCursor()).toBe('grab');

    // Space only disarms on a window keyup, so leaving it down would make
    // every later gesture on this page pan.
    await erd.page.keyboard.up('Space');
    await expect.poll(() => erd.canvasCursor()).toBe(IDLE);
  });

  test('the clickable parts of a table ask for a pointer', async ({ erd }) => {
    await erd.seed(oneTable());

    await erd.hoverScene(['#table-users', '.table-header-color']);
    await expect.poll(() => erd.canvasCursor()).toBe('pointer');

    await erd.hoverAway();
    await expect.poll(() => erd.canvasCursor()).toBe(IDLE);

    await erd.hoverAt(await erd.tableHeaderPoint('users'));
    await erd.hoverScene(['#table-users', '.table-remove']);
    await expect.poll(() => erd.canvasCursor()).toBe('pointer');

    await erd.hoverAway();
    await expect.poll(() => erd.canvasCursor()).toBe(IDLE);
  });

  test('a memo body asks for a caret and hands it back on the way out', async ({
    erd,
  }) => {
    await erd.seed(withMemo());

    await erd.hoverScene(['#memo-note', '.memo-textarea-hit']);
    await expect.poll(() => erd.canvasCursor()).toBe('text');

    await erd.hoverScene(['#memo-note', '.memo-header-color']);
    await expect.poll(() => erd.canvasCursor()).toBe('pointer');

    await erd.hoverAway();
    await expect.poll(() => erd.canvasCursor()).toBe(IDLE);
  });

  test('each memo sash asks for the resize cursor its own edge needs', async ({
    erd,
  }) => {
    await erd.seed(withMemo());

    for (const [sash, cursor] of Object.entries(SASH_CURSORS)) {
      await erd.hoverAway();
      await expect.poll(() => erd.canvasCursor()).toBe(IDLE);

      await erd.hoverScene(['#memo-note', `.memo-sash-${sash}`]);
      await expect.poll(() => erd.canvasCursor()).toBe(cursor);
    }
  });

  test('a reordered column row lands on the slot it moved into', async ({
    erd,
  }) => {
    await erd.seed(oneTable());

    const first = await erd.sceneBox('#column-users_id');
    const second = await erd.sceneBox('#column-users_name');
    expect(second.y).toBeGreaterThan(first.y);

    // A drag only reports itself once the pointer has moved, and the drop keeps
    // whatever order the moves already applied, so the press is held open until
    // the store agrees the rows have swapped.
    await erd.focusCell(erd.cell(erd.columnEl('users_name'), 'columnName'));

    const from = await erd.columnPoint('users_name');
    const to = await erd.columnPoint('users_id');
    await erd.page.mouse.move(from.x, from.y);
    await erd.page.mouse.down();
    for (let step = 1; step <= 6; step++) {
      await erd.page.mouse.move(
        from.x + ((to.x - from.x) * step) / 6,
        from.y + ((to.y - from.y) * step) / 6
      );
    }
    await expect
      .poll(() => erd.columnIds('users'))
      .toEqual(['users_name', 'users_id']);
    await erd.page.mouse.up();

    // The rows are tweened into place, so the settle is the whole assertion:
    // each row ends on the exact slot the other one held, with nothing left
    // over from the animation that moved it there.
    await expect
      .poll(async () => (await erd.sceneBox('#column-users_name')).y)
      .toBeCloseTo(first.y, 1);
    await expect
      .poll(async () => (await erd.sceneBox('#column-users_id')).y)
      .toBeCloseTo(second.y, 1);
  });
});
