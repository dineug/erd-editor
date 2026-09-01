import { expect, test } from '../support/fixtures';
import {
  createSchema,
  type ErdDocument,
  MEMO_SIZE,
  twoTables,
} from '../support/schema';

// AC-I2. A memo was a div with a textarea in it, so the browser owned its drag
// surface, its resize handles and its caret. All three are scene nodes now, and
// only the header strip is still a plain grab.

const MEMO_ID = 'note';

/** Where a memo drag starts: the header strip, clear of the remove button. */
const GRAB_OFFSET = { x: 20, y: 8 };

function withMemo(
  overrides: Partial<ErdDocument['settings']> = {}
): ErdDocument {
  const document = createSchema({
    memos: [{ id: MEMO_ID, value: 'first line', x: 320, y: 240 }],
  });

  Object.assign(document.settings, overrides);
  return document;
}

test.describe('memo', () => {
  test('dragging a memo by its header selects it and moves it', async ({
    erd,
  }) => {
    await erd.seed(withMemo());

    const before = await erd.memo(MEMO_ID);
    expect(await erd.sceneAttr(`#memo-${MEMO_ID}`, 'selected')).toBe(false);

    const box = await erd.sceneBox(`#memo-${MEMO_ID}`);
    const from = { x: box.x + GRAB_OFFSET.x, y: box.y + GRAB_OFFSET.y };
    await erd.drag(from, { x: from.x + 140, y: from.y + 90 });

    const after = await erd.memo(MEMO_ID);
    expect(after.ui.x).toBeCloseTo(before.ui.x + 140, 0);
    expect(after.ui.y).toBeCloseTo(before.ui.y + 90, 0);
    await expect
      .poll(() => erd.sceneAttr(`#memo-${MEMO_ID}`, 'selected'))
      .toBe(true);
  });

  test('a whole memo drag collapses into a single undo step', async ({
    erd,
  }) => {
    await erd.seed(withMemo());

    const before = await erd.memo(MEMO_ID);
    const box = await erd.sceneBox(`#memo-${MEMO_ID}`);
    const from = { x: box.x + GRAB_OFFSET.x, y: box.y + GRAB_OFFSET.y };
    await erd.drag(from, { x: from.x + 120, y: from.y + 60 });

    // The drag is twelve moves and one history entry, so one undo has to put
    // the memo back where it started rather than one move back along the path.
    await erd.undo();

    const after = await erd.memo(MEMO_ID);
    expect(after.ui.x).toBeCloseTo(before.ui.x, 0);
    expect(after.ui.y).toBeCloseTo(before.ui.y, 0);
    await expect(erd.toolbarButton('Redo')).toHaveClass(/\bactive\b/);
  });

  test('each sash resizes the memo from its own edge', async ({ erd }) => {
    await erd.seed(withMemo());

    const STEP = 30;
    const cases = [
      { sash: 'left', dx: -STEP, dy: 0, x: -STEP, y: 0, w: STEP, h: 0 },
      { sash: 'right', dx: STEP, dy: 0, x: 0, y: 0, w: STEP, h: 0 },
      { sash: 'bottom', dx: 0, dy: STEP, x: 0, y: 0, w: 0, h: STEP },
      {
        sash: 'lt',
        dx: -STEP,
        dy: -STEP,
        x: -STEP,
        y: -STEP,
        w: STEP,
        h: STEP,
      },
      { sash: 'rt', dx: STEP, dy: -STEP, x: 0, y: -STEP, w: STEP, h: STEP },
      { sash: 'lb', dx: -STEP, dy: STEP, x: -STEP, y: 0, w: STEP, h: STEP },
      { sash: 'rb', dx: STEP, dy: STEP, x: 0, y: 0, w: STEP, h: STEP },
    ];

    for (const shape of cases) {
      const before = await erd.memo(MEMO_ID);
      const box = await erd.sceneBox([
        `#memo-${MEMO_ID}`,
        `.memo-sash-${shape.sash}`,
      ]);
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await erd.drag(
        from,
        { x: from.x + shape.dx, y: from.y + shape.dy },
        { steps: 20 }
      );

      const after = await erd.memo(MEMO_ID);
      expect(
        [after.ui.x, after.ui.y, after.ui.width, after.ui.height].map(
          Math.round
        )
      ).toEqual([
        Math.round(before.ui.x + shape.x),
        Math.round(before.ui.y + shape.y),
        Math.round(before.ui.width + shape.w),
        Math.round(before.ui.height + shape.h),
      ]);
    }

    const grown = await erd.memo(MEMO_ID);
    const widened = cases.reduce((total, shape) => total + shape.w, 0);
    const heightened = cases.reduce((total, shape) => total + shape.h, 0);
    expect([grown.ui.width, grown.ui.height]).toEqual([
      MEMO_SIZE + widened,
      MEMO_SIZE + heightened,
    ]);
  });

  test('clicking the body opens an editor over it and edits the value', async ({
    erd,
  }) => {
    await erd.seed(withMemo());

    const hit = await erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea-hit']);
    await erd.clickAt({ x: hit.x + 24, y: hit.y + 24 });

    await expect(erd.memoEditor).toBeVisible();
    await expect(erd.memoEditor).toHaveValue('first line');

    await erd.memoEditor.fill('second line');
    await expect
      .poll(async () => (await erd.memo(MEMO_ID)).value)
      .toBe('second line');

    await erd.press('Escape');

    // The editor is torn down rather than hidden, and the drawn body takes the
    // typed value back over.
    await expect(erd.memoEditor).toHaveCount(0);
    await expect
      .poll(() => erd.sceneAttr([`#memo-${MEMO_ID}`, '.memo-textarea'], 'text'))
      .toBe('second line');
  });

  test('a wheel over the open memo editor never reaches the canvas', async ({
    erd,
  }) => {
    await erd.seed(withMemo());

    const hit = await erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea-hit']);
    await erd.clickAt({ x: hit.x + 24, y: hit.y + 24 });
    await expect(erd.memoEditor).toBeVisible();

    const before = await erd.settings();
    const box = await erd.memoEditor.boundingBox();
    expect(box).not.toBeNull();

    await erd.page.mouse.move(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2
    );
    await erd.page.mouse.wheel(0, 240);
    await erd.page.mouse.wheel(0, -240);

    const after = await erd.settings();
    expect([after.scrollLeft, after.scrollTop, after.zoomLevel]).toEqual([
      before.scrollLeft,
      before.scrollTop,
      before.zoomLevel,
    ]);
  });

  test('a marquee takes the memo together with the tables it covers', async ({
    erd,
  }) => {
    const document = twoTables();
    const memo = withMemo();
    document.doc.memoIds = memo.doc.memoIds;
    document.collections.memoEntities = memo.collections.memoEntities;
    await erd.seed(document);

    await expect(erd.canvas.locator('.memo[data-selected]')).toHaveCount(0);

    await erd.marqueeSelect({ x: 120, y: 120 }, { x: 620, y: 560 });

    await expect(erd.canvas.locator('.memo[data-selected]')).toHaveCount(1);
    await expect(erd.selectedTables()).toHaveCount(1);
  });
});
