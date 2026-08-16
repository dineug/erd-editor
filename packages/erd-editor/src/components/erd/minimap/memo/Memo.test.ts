import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import * as canvasMemoStyles from '@/components/erd/canvas/memo/Memo.styles';
import Memo from '@/components/erd/minimap/memo/Memo';
import type { Memo as MemoType } from '@/internal-types';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
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

const memoOf = () => mounted!.container.querySelector<HTMLElement>('.memo')!;

describe('minimap Memo', () => {
  it('renders an empty box carrying the shared canvas memo class', async () => {
    const memo = createMemo();
    mounted = await mountAndFlush(html`<${Memo} memo=${memo} />`);

    const el = memoOf();
    expect(el).toBeTruthy();
    expect(el.tagName).toBe('DIV');
    expect(el.classList.contains('memo')).toBe(true);
    expect(el.classList.contains(String(canvasMemoStyles.root))).toBe(true);
    expect(el.childElementCount).toBe(0);
    expect(el.textContent).toBe('');
  });

  it('places the box at the memo position and z-index', async () => {
    const memo = createMemo({ x: 30, y: 40, zIndex: 7 });
    mounted = await mountAndFlush(html`<${Memo} memo=${memo} />`);

    const el = memoOf();
    expect(el.style.left).toBe('30px');
    expect(el.style.top).toBe('40px');
    expect(el.style.zIndex).toBe('7');
  });

  it('sizes the box with the memo padding, header and border included', async () => {
    const memo = createMemo({ width: 100, height: 120 });
    mounted = await mountAndFlush(html`<${Memo} memo=${memo} />`);

    // 1 border + 8 padding + 100 + 8 padding + 1 border
    expect(calcMemoWidth(memo)).toBe(118);
    // 1 border + 8 padding + 16 header + 120 + 8 padding + 1 border
    expect(calcMemoHeight(memo)).toBe(154);

    const el = memoOf();
    expect(el.style.width).toBe('118px');
    expect(el.style.height).toBe('154px');
  });

  it('recomputes position and size when the memo ui changes', async () => {
    const memo = createMemo();
    mounted = await mountAndFlush(html`<${Memo} memo=${memo} />`);

    memo.ui.x = 500;
    memo.ui.y = 600;
    memo.ui.width = 200;
    memo.ui.height = 10;
    memo.ui.zIndex = 12;
    mounted.unmount();
    mounted = await mountAndFlush(html`<${Memo} memo=${memo} />`);
    await flush();

    const el = memoOf();
    expect(el.style.left).toBe('500px');
    expect(el.style.top).toBe('600px');
    expect(el.style.zIndex).toBe('12');
    expect(el.style.width).toBe('218px');
    expect(el.style.height).toBe('44px');
  });
});
