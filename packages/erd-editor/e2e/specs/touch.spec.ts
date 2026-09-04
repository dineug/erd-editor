import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument, twoTables } from '../support/schema';

// AC-I5. A touch press is the one input konva has to resolve twice: the stage
// reads the point off a TouchEvent rather than a MouseEvent, and the node it
// finds has a touchstart binding of its own beside the mouse one.

const MEMO_ID = 'note';

/** Where an entity drag starts: the header strip, clear of every button. */
const GRAB_OFFSET = { x: 20, y: 8 };

function withMemo(): ErdDocument {
  const document = twoTables();
  const memo = createSchema({
    memos: [{ id: MEMO_ID, value: 'a memo', x: 320, y: 560 }],
  });

  document.doc.memoIds = memo.doc.memoIds;
  document.collections.memoEntities = memo.collections.memoEntities;

  return document;
}

test.describe('touch input', () => {
  test.use({ hasTouch: true });

  test('a touch on a table header selects it', async ({ erd }) => {
    await erd.seed(twoTables());

    expect(await erd.sceneAttr('#table-users', 'selected')).toBe(false);

    // Nothing is dispatched here: the browser delivers the press and the stage
    // resolves which node was under it, which is the whole of what this asserts.
    await erd.touchStart(await erd.tableHeaderPoint('users'));
    await erd.touchEnd();

    await expect
      .poll(() => erd.sceneAttr('#table-users', 'selected'))
      .toBe(true);
    await expect
      .poll(() => erd.sceneAttr('#table-posts', 'selected'))
      .toBe(false);
  });

  test('a touch drag moves the table it started on', async ({ erd }) => {
    await erd.seed(twoTables());

    const before = await erd.table('users');
    const from = await erd.tableHeaderPoint('users');
    await erd.touchDrag(from, { x: from.x + 120, y: from.y + 80 });

    const after = await erd.table('users');
    expect(after.ui.x).toBeCloseTo(before.ui.x + 120, 0);
    expect(after.ui.y).toBeCloseTo(before.ui.y + 80, 0);
  });

  test('a touch drag moves a memo by its header', async ({ erd }) => {
    await erd.seed(withMemo());

    const before = await erd.memo(MEMO_ID);
    const box = await erd.sceneBox(`#memo-${MEMO_ID}`);
    const from = { x: box.x + GRAB_OFFSET.x, y: box.y + GRAB_OFFSET.y };
    await erd.touchDrag(from, { x: from.x - 90, y: from.y - 60 });

    const after = await erd.memo(MEMO_ID);
    expect(after.ui.x).toBeCloseTo(before.ui.x - 90, 0);
    expect(after.ui.y).toBeCloseTo(before.ui.y - 60, 0);
    await expect
      .poll(() => erd.sceneAttr(`#memo-${MEMO_ID}`, 'selected'))
      .toBe(true);
  });

  test('a touch drag on bare canvas pans it', async ({ erd }) => {
    await erd.seed(twoTables());

    const before = await erd.settings();
    expect([before.scrollLeft, before.scrollTop]).toEqual([0, 0]);

    const from = await erd.emptyPoint();
    await erd.touchDrag(from, { x: from.x - 160, y: from.y - 100 });

    const after = await erd.settings();
    expect(after.scrollLeft).toBeCloseTo(-160, 0);
    expect(after.scrollTop).toBeCloseTo(-100, 0);
  });

  test('a touch on the minimap lands the canvas where a click there does', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const box = await erd.minimap.boundingBox();
    expect(box).not.toBeNull();
    const target = {
      x: (box?.x ?? 0) + (box?.width ?? 0) * 0.85,
      y: (box?.y ?? 0) + (box?.height ?? 0) * 0.85,
    };

    await erd.clickAt(target);
    const clicked = await erd.settings();
    expect(clicked.scrollLeft).toBeLessThan(0);
    expect(clicked.scrollTop).toBeLessThan(0);

    await erd.seed(twoTables());
    expect((await erd.settings()).scrollLeft).toBe(0);

    await erd.touchStart(target);
    await erd.touchEnd();

    await expect
      .poll(async () => {
        const { scrollLeft, scrollTop } = await erd.settings();
        return [scrollLeft, scrollTop];
      })
      .toEqual([clicked.scrollLeft, clicked.scrollTop]);
  });
});
