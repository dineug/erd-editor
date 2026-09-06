/** @jsxHost konva */

// P3-31: the minimap's memo box. Same geometry the dom minimap laid out with,
// and the id rides in the name because a second stage may carry none.

import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import Memo from '@/components/erd/minimap/memo/Memo';
import { MINIMAP_MARK_MIN } from '@/components/erd/minimap/minimapGeometry';
import { MEMO_BORDER } from '@/constants/layout';
import type { Memo as MemoType } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';

const THEME: Theme = createTestTheme();

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const createMemo = (ui: Partial<MemoType['ui']> = {}): MemoType => ({
  id: 'memo-1',
  value: 'note',
  ui: {
    x: 30,
    y: 40,
    width: 100,
    height: 120,
    zIndex: 7,
    color: '',
    ...ui,
  },
  meta: { updateAt: 0, createAt: 0 },
});

/**
 * Mounts the box at a ratio of one thumbnail pixel per scene unit unless told
 * otherwise, which is where every box is past the mark and drawn at its own size.
 */
async function mountMemo(
  memo: MemoType = createMemo(),
  ratio = 1
): Promise<Stage> {
  const container = document.createElement('div');
  document.body.append(container);

  const scene = renderScene({
    app: createTestAppContext(),
    container,
    scene: (
      <k-layer name="scene">
        <Memo memo={memo} ratio={ratio} />
      </k-layer>
    ),
    width: 400,
    height: 400,
    theme: THEME,
  });

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    scene.destroy();
    container.remove();
  });

  return scene.stage;
}

const boxOf = (stage: Stage) => stage.findOne('.minimap-memo') as KonvaNode;

describe('the minimap memo box', () => {
  it('draws one rect that locates by name and by the memo id in it', async () => {
    const stage = await mountMemo();
    const box = boxOf(stage);

    expect(box.getClassName()).toBe('Rect');
    expect(box.getAttr('kind')).toBe('minimap-memo');
    expect(box.hasName('memo-1')).toBe(true);
    expect(Object.hasOwn(box.attrs, 'id')).toBe(false);
    expect(box.getParent()?.getChildren()).toHaveLength(1);
  });

  it('places the box at the memo position, inset by half its stroke', async () => {
    const stage = await mountMemo();
    const box = boxOf(stage);

    expect(box.x()).toBe(30 + MEMO_BORDER / 2);
    expect(box.y()).toBe(40 + MEMO_BORDER / 2);
  });

  it('sizes the box with the memo padding, header and border included', async () => {
    const memo = createMemo({ width: 100, height: 120 });
    const stage = await mountMemo(memo);
    const box = boxOf(stage);

    // 1 border + 8 padding + 100 + 8 padding + 1 border
    expect(calcMemoWidth(memo)).toBe(118);
    // 1 border + 8 padding + 16 header + 120 + 8 padding + 1 border
    expect(calcMemoHeight(memo)).toBe(154);

    expect(box.width()).toBe(118 - MEMO_BORDER);
    expect(box.height()).toBe(154 - MEMO_BORDER);
  });

  it('takes the size the memo ui was resized to', async () => {
    const stage = await mountMemo(createMemo({ width: 200, height: 10 }));
    const box = boxOf(stage);

    expect(box.width()).toBe(218 - MEMO_BORDER);
    expect(box.height()).toBe(44 - MEMO_BORDER);
  });

  it('paints the memo background and border from the theme', async () => {
    const stage = await mountMemo();
    const box = boxOf(stage);

    expect(box.getAttr('fill')).toBe(THEME.memoBackground);
    expect(box.getAttr('stroke')).toBe(THEME.memoBorder);
    expect(box.getAttr('strokeWidth')).toBe(MEMO_BORDER);
  });

  it('draws no smaller than a mark at a ratio that folds the memo away', async () => {
    const ratio = 0.005;
    const memo = createMemo({ width: 100, height: 120 });
    const stage = await mountMemo(memo, ratio);
    const box = boxOf(stage);
    const mark = MINIMAP_MARK_MIN / ratio;

    expect(154 * ratio).toBeLessThan(MINIMAP_MARK_MIN);
    expect(box.width() + MEMO_BORDER).toBeCloseTo(mark, 9);
    expect(box.height() + MEMO_BORDER).toBeCloseTo(mark, 9);
    // Grown about the memo's own middle, the stroke still a border in.
    expect(box.x() - MEMO_BORDER / 2 + mark / 2).toBeCloseTo(30 + 118 / 2, 9);
    expect(box.y() - MEMO_BORDER / 2 + mark / 2).toBeCloseTo(40 + 154 / 2, 9);
  });
});
