import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument } from '../support/schema';

// The memo editor is a textarea in the dom overlay, which the scene hit test
// cannot see because the overlay sits beside the stage container. A press
// inside it used to read as a press on bare canvas and pan instead of select.

const MEMO_ID = 'note';

const BODY = 'the quick brown fox jumps over the lazy dog and keeps going';

/**
 * Scrolled away from scene zero on purpose, through the legacy pair the parser
 * migrates: the origin is then one the file set, so a view that stood still is
 * told from one put back to the default, and a pan moves it from wherever it stands.
 */
function withMemo(): ErdDocument {
  const document = createSchema({
    memos: [
      { id: MEMO_ID, value: BODY, x: 520, y: 440, width: 260, height: 160 },
    ],
  });

  Object.assign(document.settings, { scrollLeft: -200, scrollTop: -200 });
  return document;
}

test.describe('memo editor drag', () => {
  test('dragging inside the open editor selects text and never pans', async ({
    erd,
  }) => {
    await erd.seed(withMemo());

    const hit = await erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea-hit']);
    await erd.clickAt({ x: hit.x + 24, y: hit.y + 24 });
    await expect(erd.memoEditor).toBeVisible();

    const before = await erd.settings();
    const box = await erd.memoEditor.boundingBox();
    expect(box).not.toBeNull();
    const { x, y, width } = box!;

    await erd.drag(
      { x: x + 6, y: y + 6 },
      { x: x + width - 12, y: y + 40 },
      { steps: 10 }
    );

    const selected = await erd.memoEditor.evaluate(el => {
      const textarea = el as HTMLTextAreaElement;
      return textarea.value.slice(
        textarea.selectionStart,
        textarea.selectionEnd
      );
    });
    expect(selected.length).toBeGreaterThan(0);

    const after = await erd.settings();
    expect([after.originX, after.originY]).toEqual([
      before.originX,
      before.originY,
    ]);
    await expect(erd.memoEditor).toBeVisible();
  });

  test('a press inside the open editor keeps the memo selected', async ({
    erd,
  }) => {
    await erd.seed(withMemo());

    const hit = await erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea-hit']);
    await erd.clickAt({ x: hit.x + 24, y: hit.y + 24 });
    await expect(erd.memoEditor).toBeVisible();
    await expect
      .poll(() => erd.sceneAttr(`#memo-${MEMO_ID}`, 'selected'))
      .toBe(true);

    const box = await erd.memoEditor.boundingBox();
    expect(box).not.toBeNull();
    await erd.clickAt({ x: box!.x + 30, y: box!.y + 10 });

    await expect
      .poll(() => erd.sceneAttr(`#memo-${MEMO_ID}`, 'selected'))
      .toBe(true);
    await expect(erd.memoEditor).toBeVisible();
  });

  test('a drag on bare canvas still pans while an editor is open', async ({
    erd,
  }) => {
    await erd.seed(withMemo());

    const hit = await erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea-hit']);
    await erd.clickAt({ x: hit.x + 24, y: hit.y + 24 });
    await expect(erd.memoEditor).toBeVisible();

    const before = await erd.settings();
    const box = await erd.memoEditor.boundingBox();
    expect(box).not.toBeNull();
    const from = {
      x: box!.x + box!.width + 160,
      y: box!.y + box!.height + 120,
    };

    // Started past the editor's corner and kept short of it, so the press lands
    // on bare canvas and every step of the drag stays outside the open editor.
    await erd.drag(from, { x: from.x - 90, y: from.y - 50 }, { steps: 10 });

    const after = await erd.settings();
    expect([after.originX, after.originY]).not.toEqual([
      before.originX,
      before.originY,
    ]);
    await expect(erd.memoEditor).toHaveCount(0);
  });
});
