import { describe, expect, it } from 'vite-plus/test';

import * as memoEntityModule from '@/v3/schema/memo.entity';
import { Memo, MemoUI } from '@/v3/schema/memo.entity';

describe('v3/schema/memo.entity', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(memoEntityModule)).toEqual([]);
  });

  it('describes a fully populated memo entity', () => {
    const ui: MemoUI = {
      x: 200,
      y: 100,
      width: 127,
      height: 127,
      zIndex: 4,
      color: '#00ff00',
    };
    const memo: Memo = {
      id: 'memo-1',
      value: 'remember me',
      ui,
      meta: { updateAt: 2, createAt: 1 },
    };

    expect(memo.value).toBe('remember me');
    expect(memo.ui.width).toBe(memo.ui.height);
    expect(memo.ui.color).toBe('#00ff00');
  });

  it('requires color to be present, unlike the v2 memo shape', () => {
    const memo: Memo = {
      id: 'memo-2',
      value: '',
      ui: { x: 0, y: 0, width: 127, height: 127, zIndex: 1, color: '' },
      meta: { updateAt: 0, createAt: 0 },
    };

    expect(memo.ui.color).toBe('');
    expect(Object.keys(memo.ui).sort()).toEqual([
      'color',
      'height',
      'width',
      'x',
      'y',
      'zIndex',
    ]);
  });

  it('keeps memos addressable through a collection record', () => {
    const build = (id: string, value: string): Memo => ({
      id,
      value,
      ui: { x: 0, y: 0, width: 127, height: 127, zIndex: 1, color: '' },
      meta: { updateAt: 0, createAt: 0 },
    });
    const memoEntities: Record<string, Memo> = {
      a: build('a', 'first'),
      b: build('b', 'second'),
    };

    expect(memoEntities.b.value).toBe('second');
    expect(memoEntities['c']).toBeUndefined();
    expect(Object.keys(memoEntities)).toHaveLength(2);
  });
});
