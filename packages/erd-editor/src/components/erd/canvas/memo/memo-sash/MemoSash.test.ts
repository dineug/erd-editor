import { query } from '@dineug/erd-editor-schema';
import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import MemoSash from '@/components/erd/canvas/memo/memo-sash/MemoSash';
import { SASH_SIZE } from '@/components/primitives/sash/Sash.styles';
import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import {
  addMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import type { Memo } from '@/internal-types';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});

const MEMO_ID = 'memo-1';

const seedMemo = (
  app: AppContext,
  { x = 30, y = 40, width = 200, height = 150 } = {}
): Memo => {
  app.store.dispatchSync(
    addMemoAction({ id: MEMO_ID, ui: { x, y, zIndex: 2 } })
  );
  app.store.dispatchSync(
    resizeMemoAction({ id: MEMO_ID, x, y, width, height })
  );
  return query(app.store.state.collections)
    .collection('memoEntities')
    .selectById(MEMO_ID)!;
};

const SASH_INDEX = {
  left: 0,
  right: 1,
  bottom: 2,
  lt: 3,
  rt: 4,
  lb: 5,
  rb: 6,
} as const;

const sashes = () =>
  Array.from(mounted!.container.querySelectorAll<HTMLElement>('.sash'));

const sashAt = (position: keyof typeof SASH_INDEX) =>
  sashes()[SASH_INDEX[position]];

const mousedown = (el: Element, clientX: number, clientY: number) =>
  el.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    })
  );

const mousemove = (clientX: number, clientY: number) =>
  window.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    })
  );

const drag = async (
  position: keyof typeof SASH_INDEX,
  from: [number, number],
  to: [number, number]
) => {
  mousedown(sashAt(position), from[0], from[1]);
  mousemove(to[0], to[1]);
  await flush();
};

const mountSash = async (
  memo: Memo,
  app: AppContext,
  top = 184,
  left = 218
) => {
  mounted = await mountAndFlush(
    html`<${MemoSash} memo=${memo} top=${top} left=${left} />`,
    app
  );
  return mounted;
};

describe('MemoSash', () => {
  it('renders the two vertical edges, the bottom edge and the four corners', async () => {
    const app = createTestAppContext();
    await mountSash(seedMemo(app), app);

    const all = sashes();
    expect(all).toHaveLength(7);
    expect(all.map(el => el.className.includes('vertical'))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(all.map(el => el.className.includes('horizontal'))).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(all.filter(el => el.className.includes('edge'))).toHaveLength(4);
  });

  it('places each sash at the memo bounds and centers it on the edge', async () => {
    const app = createTestAppContext();
    await mountSash(seedMemo(app), app, 184, 218);

    const half = SASH_SIZE / 2;
    expect(sashAt('left').style.top).toBe('0px');
    expect(sashAt('left').style.left).toBe(`${-half}px`);
    expect(sashAt('right').style.left).toBe(`${218 - half}px`);
    expect(sashAt('bottom').style.top).toBe(`${184 - half}px`);
    expect(sashAt('bottom').style.left).toBe('0px');
    expect(sashAt('rb').style.top).toBe(`${184 - half}px`);
    expect(sashAt('rb').style.left).toBe(`${218 - half}px`);
  });

  it('gives the corner handles diagonal resize cursors', async () => {
    const app = createTestAppContext();
    await mountSash(seedMemo(app), app);

    expect(sashAt('lt').style.cursor).toBe('nwse-resize');
    expect(sashAt('rt').style.cursor).toBe('nesw-resize');
    expect(sashAt('lb').style.cursor).toBe('nesw-resize');
    expect(sashAt('rb').style.cursor).toBe('nwse-resize');
  });

  it('grows the width from the right edge without moving the memo', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app);
    await mountSash(memo, app);

    await drag('right', [0, 0], [50, 0]);

    expect(memo.ui.width).toBe(250);
    expect(memo.ui.x).toBe(30);
    expect(memo.ui.height).toBe(150);
  });

  it('grows the width from the left edge and shifts the memo left', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app);
    await mountSash(memo, app);

    await drag('left', [100, 0], [50, 0]);

    expect(memo.ui.width).toBe(250);
    expect(memo.ui.x).toBe(-20);
  });

  it('grows the height from the bottom edge without moving the memo', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app);
    await mountSash(memo, app);

    await drag('bottom', [0, 100], [0, 150]);

    expect(memo.ui.height).toBe(200);
    expect(memo.ui.y).toBe(40);
    expect(memo.ui.width).toBe(200);
  });

  it('resizes both axes from the bottom right corner', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app);
    await mountSash(memo, app);

    await drag('rb', [0, 0], [40, 40]);

    expect(memo.ui.width).toBe(240);
    expect(memo.ui.height).toBe(190);
    expect(memo.ui.x).toBe(30);
    expect(memo.ui.y).toBe(40);
  });

  it('resizes both axes and moves the origin from the top left corner', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app);
    await mountSash(memo, app);

    await drag('lt', [100, 100], [60, 60]);

    expect(memo.ui.width).toBe(240);
    expect(memo.ui.height).toBe(190);
    expect(memo.ui.x).toBe(-10);
    expect(memo.ui.y).toBe(0);
  });

  it('moves only the vertical origin from the top right corner', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app);
    await mountSash(memo, app);

    await drag('rt', [0, 100], [40, 60]);

    expect(memo.ui.width).toBe(240);
    expect(memo.ui.height).toBe(190);
    expect(memo.ui.x).toBe(30);
    expect(memo.ui.y).toBe(0);
  });

  it('moves only the horizontal origin from the bottom left corner', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app);
    await mountSash(memo, app);

    await drag('lb', [100, 0], [60, 40]);

    expect(memo.ui.width).toBe(240);
    expect(memo.ui.height).toBe(190);
    expect(memo.ui.x).toBe(-10);
    expect(memo.ui.y).toBe(40);
  });

  it('refuses to shrink below the minimum width and ignores the way back', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app, { width: MEMO_MIN_WIDTH + 4 });
    await mountSash(memo, app);

    mousedown(sashAt('right'), 0, 0);
    mousemove(-10, 0);
    await flush();
    expect(memo.ui.width).toBe(MEMO_MIN_WIDTH + 4);

    // the anchor did not advance, so the move back is rejected by x > clientX
    mousemove(0, 0);
    await flush();
    expect(memo.ui.width).toBe(MEMO_MIN_WIDTH + 4);
    expect(memo.ui.x).toBe(30);
  });

  it('refuses to shrink the left edge below the minimum width and ignores the way back', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app, { width: MEMO_MIN_WIDTH + 4 });
    await mountSash(memo, app);

    mousedown(sashAt('left'), 0, 0);
    mousemove(10, 0);
    await flush();
    expect(memo.ui.width).toBe(MEMO_MIN_WIDTH + 4);

    // the anchor did not advance, so the move back is rejected by x < clientX
    mousemove(0, 0);
    await flush();
    expect(memo.ui.width).toBe(MEMO_MIN_WIDTH + 4);
    expect(memo.ui.x).toBe(30);
  });

  it('refuses to shrink below the minimum height and ignores the way back', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app, { height: MEMO_MIN_HEIGHT + 4 });
    await mountSash(memo, app);

    mousedown(sashAt('bottom'), 0, 0);
    mousemove(0, -10);
    await flush();
    expect(memo.ui.height).toBe(MEMO_MIN_HEIGHT + 4);

    mousemove(0, 0);
    await flush();
    expect(memo.ui.height).toBe(MEMO_MIN_HEIGHT + 4);
    expect(memo.ui.y).toBe(40);
  });

  it('refuses to shrink the top edge below the minimum height and ignores the way back', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app, { height: MEMO_MIN_HEIGHT + 4 });
    await mountSash(memo, app);

    mousedown(sashAt('lt'), 0, 0);
    mousemove(0, 10);
    await flush();
    expect(memo.ui.height).toBe(MEMO_MIN_HEIGHT + 4);

    mousemove(0, 0);
    await flush();
    expect(memo.ui.height).toBe(MEMO_MIN_HEIGHT + 4);
    expect(memo.ui.y).toBe(40);
  });

  it('stops resizing once the pointer is released', async () => {
    const app = createTestAppContext();
    const memo = seedMemo(app);
    await mountSash(memo, app);

    mousedown(sashAt('right'), 0, 0);
    mousemove(20, 0);
    await flush();
    expect(memo.ui.width).toBe(220);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    mousemove(60, 0);
    await flush();
    expect(memo.ui.width).toBe(220);
  });
});
