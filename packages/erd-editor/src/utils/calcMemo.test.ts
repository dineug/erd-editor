import { describe, expect, it } from 'vite-plus/test';

import {
  MEMO_BORDER,
  MEMO_HEADER_HEIGHT,
  MEMO_MIN_HEIGHT,
  MEMO_MIN_WIDTH,
  MEMO_PADDING,
} from '@/constants/layout';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';
import { createMemo } from '@/utils/collection/memo.entity';

describe('calcMemoWidth', () => {
  it('adds the border and padding on both sides of the content width', () => {
    const memo = createMemo({ ui: { width: 200 } });

    expect(calcMemoWidth(memo)).toBe(218);
    expect(calcMemoWidth(memo)).toBe(
      MEMO_BORDER + MEMO_PADDING + 200 + MEMO_PADDING + MEMO_BORDER
    );
  });

  it('uses the minimum width of a freshly created memo', () => {
    expect(calcMemoWidth(createMemo())).toBe(MEMO_MIN_WIDTH + 18);
    expect(calcMemoWidth(createMemo())).toBe(134);
  });

  it('returns only the chrome when the content width is zero', () => {
    expect(calcMemoWidth(createMemo({ ui: { width: 0 } }))).toBe(18);
  });

  it('scales linearly with the content width', () => {
    const small = calcMemoWidth(createMemo({ ui: { width: 10 } }));
    const large = calcMemoWidth(createMemo({ ui: { width: 110 } }));

    expect(large - small).toBe(100);
  });
});

describe('calcMemoHeight', () => {
  it('adds the border, padding and header to the content height', () => {
    const memo = createMemo({ ui: { height: 200 } });

    expect(calcMemoHeight(memo)).toBe(234);
    expect(calcMemoHeight(memo)).toBe(
      MEMO_BORDER +
        MEMO_PADDING +
        MEMO_HEADER_HEIGHT +
        200 +
        MEMO_PADDING +
        MEMO_BORDER
    );
  });

  it('uses the minimum height of a freshly created memo', () => {
    expect(calcMemoHeight(createMemo())).toBe(MEMO_MIN_HEIGHT + 34);
    expect(calcMemoHeight(createMemo())).toBe(134);
  });

  it('returns only the chrome when the content height is zero', () => {
    expect(calcMemoHeight(createMemo({ ui: { height: 0 } }))).toBe(34);
  });

  it('is independent from the memo width', () => {
    const a = createMemo({ ui: { width: 10, height: 50 } });
    const b = createMemo({ ui: { width: 999, height: 50 } });

    expect(calcMemoHeight(a)).toBe(calcMemoHeight(b));
  });
});
