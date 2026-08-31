/** @jsxHost konva */

// P3-34 and P4-37: the seven sash hit areas, their names and the geometry the
// DOM sash laid out, and the resize gesture each of them starts.

import { query } from '@dineug/erd-editor-schema';
import { Layer } from 'konva/lib/Layer';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  fireSceneTouch,
  flush,
  movePointer,
  moveTouch,
  releasePointer,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import MemoSash from '@/components/erd/canvas/memo/memo-sash/MemoSash';
import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import {
  addMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import type { Memo } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';

/** The border box of a memo whose body is 200 by 150, and the box a sash spans. */
const MEMO_BOX = { width: 218, height: 184 };
const SASH_SPAN = { width: 216, height: 182 };

const MEMO_ID = 'memo-1';

const THEME = createTestTheme();

type SashPosition = 'left' | 'right' | 'bottom' | 'lt' | 'rt' | 'lb' | 'rb';

type Fixture = {
  app: AppContext;
  memo: Memo;
  stage: Stage;
};

const teardowns: Array<() => void> = [];

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

async function mountSash(
  options: { width?: number; height?: number } = {}
): Promise<Fixture> {
  const app = createTestAppContext();
  const memo = seedMemo(app, options);
  const container = document.createElement('div');
  document.body.append(container);

  const rendered = renderScene({
    app,
    container,
    width: 400,
    height: 400,
    theme: THEME,
    scene: (
      <k-layer name="scene">
        <MemoSash memo={memo} top={MEMO_BOX.height} left={MEMO_BOX.width} />
      </k-layer>
    ),
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await flush();
  await whenDrawn();

  return { app, memo, stage: rendered.stage };
}

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const sashes = (stage: Stage) =>
  (stage.findOne<Layer>('.scene') as Layer).getChildren();

const sashAt = (stage: Stage, position: SashPosition) =>
  stage.findOne(`.memo-sash-${position}`) as KonvaNode;

const box = (stage: Stage, position: SashPosition) => {
  const { attrs } = sashAt(stage, position);
  const { x, y, width, height } = attrs;
  return { x, y, width, height };
};

const drag = async (
  stage: Stage,
  position: SashPosition,
  from: [number, number],
  to: [number, number]
) => {
  fireScenePointer(sashAt(stage, position), 'mousedown', {
    clientX: from[0],
    clientY: from[1],
  });
  movePointer(to[0], to[1]);
  await flush();
};

describe('the memo sashes', () => {
  it('draws seven rects, one per edge the DOM memo could be grabbed by', async () => {
    const { stage } = await mountSash();

    expect(sashes(stage)).toHaveLength(7);
    expect(sashes(stage).every(sash => sash.getClassName() === 'Rect')).toBe(
      true
    );
  });

  it('names each sash for the edge it grabs and kinds them all as a sash', async () => {
    const { stage } = await mountSash();

    expect(sashes(stage).map(sash => sash.name())).toEqual([
      'memo-sash memo-sash-left',
      'memo-sash memo-sash-right',
      'memo-sash memo-sash-bottom',
      'memo-sash memo-sash-lt',
      'memo-sash memo-sash-rt',
      'memo-sash memo-sash-lb',
      'memo-sash memo-sash-rb',
    ]);
    expect(sashes(stage).every(sash => sash.attrs.kind === 'sash')).toBe(true);
  });

  it('runs the side sashes the length of the box they sit on', async () => {
    const { stage } = await mountSash();

    expect(box(stage, 'left')).toEqual({
      x: -2.5,
      y: 0,
      width: 5,
      height: SASH_SPAN.height,
    });
    expect(box(stage, 'right')).toEqual({
      x: MEMO_BOX.width - 2.5,
      y: 0,
      width: 5,
      height: SASH_SPAN.height,
    });
    expect(box(stage, 'bottom')).toEqual({
      x: 0,
      y: MEMO_BOX.height - 2.5,
      width: SASH_SPAN.width,
      height: 5,
    });
  });

  it('centers a corner sash on its corner, on both axes', async () => {
    const { stage } = await mountSash();
    const corner = { width: 5, height: 5 };

    expect(box(stage, 'lt')).toEqual({ x: -2.5, y: -2.5, ...corner });
    expect(box(stage, 'rt')).toEqual({
      x: MEMO_BOX.width - 2.5,
      y: -2.5,
      ...corner,
    });
    expect(box(stage, 'lb')).toEqual({
      x: -2.5,
      y: MEMO_BOX.height - 2.5,
      ...corner,
    });
    expect(box(stage, 'rb')).toEqual({
      x: MEMO_BOX.width - 2.5,
      y: MEMO_BOX.height - 2.5,
      ...corner,
    });
  });

  it('fills each sash with nothing but a hit area', async () => {
    const { stage } = await mountSash();

    expect(sashes(stage).every(sash => sash.attrs.fill === 'transparent')).toBe(
      true
    );
    expect(sashes(stage).every(sash => sash.attrs.stroke === undefined)).toBe(
      true
    );
  });
});

describe('the pointer a sash asks the stage for', () => {
  it('gives the corner handles diagonal resize cursors', async () => {
    const { stage } = await mountSash();
    const container = stage.container();

    const cursorOver = (position: SashPosition) => {
      fireScenePointer(sashAt(stage, position), 'mouseenter');
      const cursor = container.style.cursor;
      fireScenePointer(sashAt(stage, position), 'mouseleave');
      return cursor;
    };

    expect(cursorOver('lt')).toBe('nwse-resize');
    expect(cursorOver('rt')).toBe('nesw-resize');
    expect(cursorOver('lb')).toBe('nesw-resize');
    expect(cursorOver('rb')).toBe('nwse-resize');
  });

  it('gives the side handles the axis they resize, and drops it on leave', async () => {
    const { stage } = await mountSash();
    const container = stage.container();

    fireScenePointer(sashAt(stage, 'right'), 'mouseenter');
    expect(container.style.cursor).toBe('ew-resize');

    fireScenePointer(sashAt(stage, 'right'), 'mouseleave');
    expect(container.style.cursor).toBe('');

    fireScenePointer(sashAt(stage, 'bottom'), 'mouseenter');
    expect(container.style.cursor).toBe('ns-resize');
  });
});

describe('the resize a sash drag commits', () => {
  it('grows the width from the right edge without moving the memo', async () => {
    const { memo, stage } = await mountSash();

    await drag(stage, 'right', [0, 0], [50, 0]);

    expect(memo.ui.width).toBe(250);
    expect(memo.ui.x).toBe(30);
    expect(memo.ui.height).toBe(150);
  });

  it('grows the width from the left edge and shifts the memo left', async () => {
    const { memo, stage } = await mountSash();

    await drag(stage, 'left', [100, 0], [50, 0]);

    expect(memo.ui.width).toBe(250);
    expect(memo.ui.x).toBe(-20);
  });

  it('grows the height from the bottom edge without moving the memo', async () => {
    const { memo, stage } = await mountSash();

    await drag(stage, 'bottom', [0, 100], [0, 150]);

    expect(memo.ui.height).toBe(200);
    expect(memo.ui.y).toBe(40);
    expect(memo.ui.width).toBe(200);
  });

  it('resizes both axes from the bottom right corner', async () => {
    const { memo, stage } = await mountSash();

    await drag(stage, 'rb', [0, 0], [40, 40]);

    expect(memo.ui.width).toBe(240);
    expect(memo.ui.height).toBe(190);
    expect(memo.ui.x).toBe(30);
    expect(memo.ui.y).toBe(40);
  });

  it('resizes both axes and moves the origin from the top left corner', async () => {
    const { memo, stage } = await mountSash();

    await drag(stage, 'lt', [100, 100], [60, 60]);

    expect(memo.ui.width).toBe(240);
    expect(memo.ui.height).toBe(190);
    expect(memo.ui.x).toBe(-10);
    expect(memo.ui.y).toBe(0);
  });

  it('moves only the vertical origin from the top right corner', async () => {
    const { memo, stage } = await mountSash();

    await drag(stage, 'rt', [0, 100], [40, 60]);

    expect(memo.ui.width).toBe(240);
    expect(memo.ui.height).toBe(190);
    expect(memo.ui.x).toBe(30);
    expect(memo.ui.y).toBe(0);
  });

  it('moves only the horizontal origin from the bottom left corner', async () => {
    const { memo, stage } = await mountSash();

    await drag(stage, 'lb', [100, 0], [60, 40]);

    expect(memo.ui.width).toBe(240);
    expect(memo.ui.height).toBe(190);
    expect(memo.ui.x).toBe(-10);
    expect(memo.ui.y).toBe(40);
  });

  it('refuses to shrink below the minimum width and ignores the way back', async () => {
    const { memo, stage } = await mountSash({ width: MEMO_MIN_WIDTH + 4 });

    fireScenePointer(sashAt(stage, 'right'), 'mousedown', {
      clientX: 0,
      clientY: 0,
    });
    movePointer(-10, 0);
    await flush();
    expect(memo.ui.width).toBe(MEMO_MIN_WIDTH + 4);

    // the anchor did not advance, so the move back is rejected by x > clientX
    movePointer(0, 0);
    await flush();
    expect(memo.ui.width).toBe(MEMO_MIN_WIDTH + 4);
    expect(memo.ui.x).toBe(30);
  });

  it('refuses to shrink the left edge below the minimum width and ignores the way back', async () => {
    const { memo, stage } = await mountSash({ width: MEMO_MIN_WIDTH + 4 });

    fireScenePointer(sashAt(stage, 'left'), 'mousedown', {
      clientX: 0,
      clientY: 0,
    });
    movePointer(10, 0);
    await flush();
    expect(memo.ui.width).toBe(MEMO_MIN_WIDTH + 4);

    // the anchor did not advance, so the move back is rejected by x < clientX
    movePointer(0, 0);
    await flush();
    expect(memo.ui.width).toBe(MEMO_MIN_WIDTH + 4);
    expect(memo.ui.x).toBe(30);
  });

  it('refuses to shrink below the minimum height and ignores the way back', async () => {
    const { memo, stage } = await mountSash({ height: MEMO_MIN_HEIGHT + 4 });

    fireScenePointer(sashAt(stage, 'bottom'), 'mousedown', {
      clientX: 0,
      clientY: 0,
    });
    movePointer(0, -10);
    await flush();
    expect(memo.ui.height).toBe(MEMO_MIN_HEIGHT + 4);

    movePointer(0, 0);
    await flush();
    expect(memo.ui.height).toBe(MEMO_MIN_HEIGHT + 4);
    expect(memo.ui.y).toBe(40);
  });

  it('refuses to shrink the top edge below the minimum height and ignores the way back', async () => {
    const { memo, stage } = await mountSash({ height: MEMO_MIN_HEIGHT + 4 });

    fireScenePointer(sashAt(stage, 'lt'), 'mousedown', {
      clientX: 0,
      clientY: 0,
    });
    movePointer(0, 10);
    await flush();
    expect(memo.ui.height).toBe(MEMO_MIN_HEIGHT + 4);

    movePointer(0, 0);
    await flush();
    expect(memo.ui.height).toBe(MEMO_MIN_HEIGHT + 4);
    expect(memo.ui.y).toBe(40);
  });

  it('stops resizing once the pointer is released', async () => {
    const { memo, stage } = await mountSash();

    fireScenePointer(sashAt(stage, 'right'), 'mousedown', {
      clientX: 0,
      clientY: 0,
    });
    movePointer(20, 0);
    await flush();
    expect(memo.ui.width).toBe(220);

    releasePointer();
    movePointer(60, 0);
    await flush();
    expect(memo.ui.width).toBe(220);
  });

  it('resizes from a touch drag as well as a pointer one', async () => {
    const { memo, stage } = await mountSash();

    fireSceneTouch(sashAt(stage, 'right'), 'touchstart', 0, 0);
    moveTouch(30, 0);
    await flush();

    expect(memo.ui.width).toBe(230);
  });
});
