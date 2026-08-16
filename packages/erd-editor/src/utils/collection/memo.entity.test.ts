import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import { createMemo } from '@/utils/collection/memo.entity';

describe('createMemo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a memo filled with defaults when no value is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T03:04:05.000Z'));
    const now = Date.now();

    const memo = createMemo();

    expect(memo.value).toBe('');
    expect(memo.ui).toEqual({
      x: 200,
      y: 100,
      zIndex: 2,
      width: MEMO_MIN_WIDTH,
      height: MEMO_MIN_HEIGHT,
      color: '',
    });
    expect(memo.meta).toEqual({ updateAt: now, createAt: now });
    expect(typeof memo.id).toBe('string');
    expect(memo.id.length).toBeGreaterThan(0);
  });

  it('uses the layout minimums as the default size', () => {
    const memo = createMemo();

    expect(memo.ui.width).toBe(116);
    expect(memo.ui.height).toBe(100);
  });

  it('generates a unique id per call', () => {
    const a = createMemo();
    const b = createMemo();

    expect(a.id).not.toBe(b.id);
  });

  it('deep merges a partial ui object keeping untouched ui defaults', () => {
    const memo = createMemo({
      id: 'memo-1',
      value: 'hello',
      ui: { x: 10, y: 20, color: '#fff' },
    });

    expect(memo.id).toBe('memo-1');
    expect(memo.value).toBe('hello');
    expect(memo.ui).toEqual({
      x: 10,
      y: 20,
      zIndex: 2,
      width: MEMO_MIN_WIDTH,
      height: MEMO_MIN_HEIGHT,
      color: '#fff',
    });
  });

  it('does not mutate the given value object', () => {
    const value = { ui: { x: 1 } };
    const memo = createMemo(value);

    expect(value).toEqual({ ui: { x: 1 } });
    expect(memo.ui).not.toBe(value.ui);
  });

  it('treats an explicitly undefined value as no value', () => {
    const memo = createMemo(undefined);

    expect(memo.value).toBe('');
    expect(memo.ui.zIndex).toBe(2);
  });
});
