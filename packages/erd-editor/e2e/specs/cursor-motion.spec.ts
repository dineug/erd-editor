import type { ErdEditorPage, Point } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  createSchema,
  type ErdDocument,
  oneTable,
  twoTables,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

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

function withSizedMemo(zoomLevel: number, width: number): ErdDocument {
  return createSchema({
    zoomLevel,
    memos: [
      { id: 'note', value: 'a memo', x: 320, y: 240, width, height: 200 },
    ],
  });
}

/** Presses the middle of a memo sash once the stage points at its cursor. */
async function pressSash(
  erd: ErdEditorPage,
  sash: keyof typeof SASH_CURSORS
): Promise<Point> {
  const box = await erd.sceneBox(['#memo-note', `.memo-sash-${sash}`]);
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await erd.hoverAt(at);
  await expect.poll(() => erd.canvasCursor()).toBe(SASH_CURSORS[sash]);
  await erd.page.mouse.down();
  return at;
}

/**
 * Moves the pressed pointer one step a frame, the rate a browser hands a drag
 * over, and reads the cursor once each step is drawn. A sash redrawn under the
 * last step is one step behind the next, which is what outruns its hit area.
 */
async function pacedDrag(
  erd: ErdEditorPage,
  from: Point,
  step: Point,
  count: number
) {
  const cursors: string[] = [];
  let at = from;
  for (let index = 0; index < count; index++) {
    at = { x: at.x + step.x, y: at.y + step.y };
    await erd.page.mouse.move(at.x, at.y);
    await erd.whenDrawn();
    cursors.push(await erd.canvasCursor());
  }
  return { at, cursors };
}

test.describe('cursor and motion', () => {
  test('the hand tool asks for a grab and the press makes it a fist', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    expect(await erd.canvasCursor()).toBe(IDLE);

    await erd.focusCanvas({ x: 1100, y: 700 });
    await erd.press(Shortcut.handTool);
    await expect.poll(() => erd.canvasCursor()).toBe('grab');

    const from = await erd.pointAt(1100, 700);
    await erd.page.mouse.move(from.x, from.y);
    await erd.page.mouse.down();
    await erd.page.mouse.move(from.x - 40, from.y - 20);
    await expect.poll(() => erd.canvasCursor()).toBe('grabbing');

    await erd.page.mouse.up();
    await expect.poll(() => erd.canvasCursor()).toBe('grab');

    // The tool is a toggle now, so leaving it down would make every later
    // gesture on this page pan.
    await erd.press(Shortcut.handTool);
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

  const RUNAWAY_DRAGS = [
    {
      sash: 'right',
      zoomLevel: 1,
      step: { x: 4, y: 0 },
      away: { x: 0, y: 20 },
    },
    {
      sash: 'bottom',
      zoomLevel: 0.8,
      step: { x: 0, y: 2 },
      away: { x: 20, y: 0 },
    },
  ] as const;

  for (const { sash, zoomLevel, step, away } of RUNAWAY_DRAGS) {
    test(`a memo ${sash} sash keeps its cursor through a drag at zoom ${zoomLevel}`, async ({
      erd,
    }) => {
      await erd.seed(withSizedMemo(zoomLevel, 300));
      const cursor = SASH_CURSORS[sash];

      const from = await pressSash(erd, sash);
      const ahead = await pacedDrag(erd, from, step, 12);
      expect(ahead.cursors).toEqual(Array(12).fill(cursor));

      // The sash follows one axis only, so the other walks the pointer off the
      // memo, and the lift has to give back the empty canvas under it.
      const off = await pacedDrag(erd, ahead.at, away, 10);
      expect(off.cursors).toEqual(Array(10).fill(cursor));

      await erd.page.mouse.up();
      await expect.poll(() => erd.canvasCursor()).toBe(IDLE);
    });
  }

  test('a memo sash keeps its cursor over the text a clamped drag runs onto', async ({
    erd,
  }) => {
    await erd.seed(withSizedMemo(1, 200));

    const from = await pressSash(erd, 'right');
    const inward = await pacedDrag(erd, from, { x: -6, y: 0 }, 20);
    expect(inward.cursors).toEqual(Array(20).fill(SASH_CURSORS.right));

    await erd.page.mouse.up();
    await expect.poll(() => erd.canvasCursor()).toBe('text');
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
