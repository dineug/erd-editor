import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  MEMO_BORDER,
  MEMO_HEADER_HEIGHT,
  MEMO_PADDING,
} from '@/constants/layout';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import {
  getContentRect,
  getContentRectAfter,
  getContentRects,
  unionRect,
} from '@/konva/scene/contentBounds';
import { getMemoRect, getTableRect, type Rect } from '@/konva/scene/metrics';
import { createMemo } from '@/utils/collection/memo.entity';
import { createTable } from '@/utils/collection/table.entity';

function createState(): RootState {
  return {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
}

function addTable(state: RootState, id: string, x: number, y: number) {
  const table = createTable({ id, name: id, ui: { x, y } });
  state.collections.tableEntities[id] = table;
  state.doc.tableIds.push(id);
  return table;
}

function addMemo(
  state: RootState,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const memo = createMemo({ id, ui: { x, y, width, height } });
  state.collections.memoEntities[id] = memo;
  state.doc.memoIds.push(id);
  return memo;
}

/** The far edges of a box, which is what a union is decided on. */
const right = (rect: Rect) => rect.x + rect.width;
const bottom = (rect: Rect) => rect.y + rect.height;

describe('getContentRect', () => {
  it('is null for a document with neither a table nor a memo', () => {
    expect(getContentRect(createState())).toBeNull();
  });

  it('is the memo frame itself for a document holding one memo', () => {
    const state = createState();
    const memo = addMemo(state, 'm1', -320, 470, 200, 120);

    expect(getContentRect(state)).toEqual(getMemoRect(memo));
  });

  it('is the union of every table box and memo frame', () => {
    const state = createState();
    const a = addTable(state, 'a', 100, 200);
    const b = addTable(state, 'b', -4_000, 3_500);
    const memo = addMemo(state, 'm', 12_000, -900, 300, 100);
    const boxes = [
      getTableRect(state, a),
      getTableRect(state, b),
      getMemoRect(memo),
    ];

    const rect = getContentRect(state)!;

    expect(rect.x).toBe(Math.min(...boxes.map(box => box.x)));
    expect(rect.y).toBe(Math.min(...boxes.map(box => box.y)));
    expect(right(rect)).toBe(Math.max(...boxes.map(right)));
    expect(bottom(rect)).toBe(Math.max(...boxes.map(bottom)));
  });

  /**
   * A memo's frame, the border, the padding and the header the sashes hang
   * off, reaches past its body. A memo whose body ends inside a table's box
   * still sets the far edge when its frame pokes out of that box.
   */
  it('lets a memo frame set the far edge where its body would not', () => {
    const state = createState();
    const table = addTable(state, 't', 0, 0);
    const tableBox = getTableRect(state, table);
    const frameX = MEMO_BORDER + MEMO_PADDING;
    const frameY = frameX + MEMO_HEADER_HEIGHT;
    // The body ends 5 inside the table's far edges; the frame ends past them.
    const width = 100;
    const height = 60;
    const memo = addMemo(
      state,
      'm',
      right(tableBox) - 5 - width,
      bottom(tableBox) - 5 - height,
      width,
      height
    );
    const frame = getMemoRect(memo);

    const rect = getContentRect(state)!;

    expect(memo.ui.x + memo.ui.width).toBeLessThan(right(tableBox));
    expect(memo.ui.y + memo.ui.height).toBeLessThan(bottom(tableBox));
    expect(right(frame)).toBe(memo.ui.x + width + 2 * frameX);
    expect(bottom(frame)).toBe(memo.ui.y + height + frameX + frameY);
    expect(right(rect)).toBe(right(frame));
    expect(bottom(rect)).toBe(bottom(frame));
    expect(right(rect)).toBeGreaterThan(right(tableBox));
    expect(bottom(rect)).toBeGreaterThan(bottom(tableBox));
  });

  it('skips an id whose entity is gone rather than reading a hole', () => {
    const state = createState();
    const table = addTable(state, 't', 700, -300);
    state.doc.tableIds.push('gone');
    state.doc.memoIds.push('gone-too');

    expect(getContentRect(state)).toEqual(getTableRect(state, table));
  });

  /**
   * The state is one mutable proxy and a move writes the position in place, so
   * a cache keyed on the state object would answer the old box forever. Each
   * call reads the positions as they are.
   */
  it('follows a table moved in place on the next call', () => {
    const state = createState();
    const table = addTable(state, 't', 0, 0);
    const before = getContentRect(state)!;

    table.ui.x = 25_000;
    table.ui.y = -8_000;

    const after = getContentRect(state)!;
    expect(after).toEqual(getTableRect(state, table));
    expect(after.x - before.x).toBe(25_000);
    expect(after.y - before.y).toBe(-8_000);
  });
});

describe('unionRect', () => {
  const a: Rect = { x: -10, y: 5, width: 30, height: 40 };
  const b: Rect = { x: 15, y: -20, width: 100, height: 10 };

  it('is the smallest box holding both, whichever comes first', () => {
    const expected: Rect = { x: -10, y: -20, width: 125, height: 65 };

    expect(unionRect(a, b)).toEqual(expected);
    expect(unionRect(b, a)).toEqual(expected);
  });

  it('is the box itself when one holds the other', () => {
    const inner: Rect = { x: 0, y: 10, width: 5, height: 5 };

    expect(unionRect(a, inner)).toEqual(a);
    expect(unionRect(inner, a)).toEqual(a);
  });
});

describe('getContentRectAfter', () => {
  it('is the content rect itself when no table is named', () => {
    const state = createState();
    addTable(state, 'a', 100, 200);
    addMemo(state, 'm', -500, 900, 200, 100);

    expect(getContentRectAfter(state, [])).toEqual(getContentRect(state));
  });

  /**
   * The placement asks for the box its tables are about to occupy in the same
   * dispatch that moves them, so the box is read off the points named rather
   * than off positions no reducer has written yet, and nothing is moved by asking.
   */
  it('reads a named table at its point and leaves the rest where they are', () => {
    const state = createState();
    const a = addTable(state, 'a', 100, 200);
    const b = addTable(state, 'b', 3_000, 1_500);
    const memo = addMemo(state, 'm', 900, -400, 300, 100);
    const size = getTableRect(state, a);
    const moves = [{ id: 'a', x: -7_000, y: 5_000 }];

    const rect = getContentRectAfter(state, moves)!;

    const boxes = [
      { ...size, x: -7_000, y: 5_000 },
      getTableRect(state, b),
      getMemoRect(memo),
    ];
    expect(rect.x).toBe(Math.min(...boxes.map(box => box.x)));
    expect(rect.y).toBe(Math.min(...boxes.map(box => box.y)));
    expect(right(rect)).toBe(Math.max(...boxes.map(right)));
    expect(bottom(rect)).toBe(Math.max(...boxes.map(bottom)));
    expect([a.ui.x, a.ui.y]).toEqual([100, 200]);
    expect(getContentRect(state)).not.toEqual(rect);
  });

  it('ignores a move naming a table the document does not hold', () => {
    const state = createState();
    const table = addTable(state, 't', 0, 0);

    expect(
      getContentRectAfter(state, [{ id: 'gone', x: 40_000, y: 40_000 }])
    ).toEqual(getTableRect(state, table));
  });
});

describe('getContentRects', () => {
  it('is empty for a document with neither a table nor a memo', () => {
    expect(getContentRects(createState())).toEqual([]);
  });

  it('hands back one box per entity, the tables before the memos', () => {
    const state = createState();
    const a = addTable(state, 'a', 100, 200);
    const b = addTable(state, 'b', -4_000, 3_500);
    const memo = addMemo(state, 'm', 12_000, -900, 300, 100);

    expect(getContentRects(state)).toEqual([
      getTableRect(state, a),
      getTableRect(state, b),
      getMemoRect(memo),
    ]);
  });

  it('is the boxes the content rect is folded from', () => {
    const state = createState();
    addTable(state, 'a', 100, 200);
    addMemo(state, 'm', 12_000, -900, 300, 100);

    expect(getContentRects(state).reduce(unionRect)).toEqual(
      getContentRect(state)
    );
  });

  it('reads a named table at its point, as the fold does', () => {
    const state = createState();
    const table = addTable(state, 't', 0, 0);
    const move = { id: 't', x: 900, y: -700 };
    const [rect] = getContentRects(state, [move]);

    expect([rect.x, rect.y]).toEqual([move.x, move.y]);
    expect([table.ui.x, table.ui.y]).toEqual([0, 0]);
  });
});
