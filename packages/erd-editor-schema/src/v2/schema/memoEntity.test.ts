import { describe, expect, it } from 'vitest';

import * as memoEntityModule from '@/v2/schema/memoEntity';
import { Memo, MemoEntity, MemoUI } from '@/v2/schema/memoEntity';

describe('v2/schema/memoEntity', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(memoEntityModule)).toEqual([]);
  });

  it('accepts a fully populated memo including the optional color', () => {
    const ui: MemoUI = {
      active: true,
      top: 100,
      left: 200,
      width: 127,
      height: 127,
      zIndex: 3,
      color: '#00ff00',
    };
    const memo: Memo = { id: 'memo-1', value: 'hello', ui };
    const entity: MemoEntity = { memos: [memo] };

    expect(entity.memos).toHaveLength(1);
    expect(entity.memos[0].value).toBe('hello');
    expect(entity.memos[0].ui.color).toBe('#00ff00');
    expect(entity.memos[0].ui.width).toBe(entity.memos[0].ui.height);
  });

  it('treats color as optional and allows an empty memo list', () => {
    const memo: Memo = {
      id: 'memo-2',
      value: '',
      ui: {
        active: false,
        top: 0,
        left: 0,
        width: 127,
        height: 127,
        zIndex: 1,
      },
    };

    expect(memo.ui.color).toBeUndefined();

    const empty: MemoEntity = { memos: [] };
    expect(empty.memos).toEqual([]);
  });

  it('keeps memos addressable by id', () => {
    const build = (id: string, value: string): Memo => ({
      id,
      value,
      ui: {
        active: false,
        top: 0,
        left: 0,
        width: 127,
        height: 127,
        zIndex: 1,
      },
    });
    const entity: MemoEntity = {
      memos: [build('a', 'first'), build('b', 'second')],
    };

    expect(entity.memos.find(memo => memo.id === 'b')?.value).toBe('second');
    expect(entity.memos.find(memo => memo.id === 'c')).toBeUndefined();
  });
});
