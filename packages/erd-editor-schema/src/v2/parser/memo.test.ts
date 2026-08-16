import { describe, expect, it } from 'vite-plus/test';

import { createAndMergeMemoEntity } from '@/v2/parser/memo';

const defaultUI = {
  active: false,
  left: 200,
  top: 200,
  zIndex: 2,
  width: 127,
  height: 127,
};

describe('createAndMergeMemoEntity', () => {
  it('returns an empty entity when json is nill', () => {
    expect(createAndMergeMemoEntity()).toEqual({ memos: [] });
    expect(createAndMergeMemoEntity(null as any)).toEqual({ memos: [] });
    expect(createAndMergeMemoEntity(undefined)).toEqual({ memos: [] });
  });

  it('returns an empty entity when memos is not an array', () => {
    expect(createAndMergeMemoEntity({ memos: 'nope' } as any)).toEqual({
      memos: [],
    });
    expect(createAndMergeMemoEntity({} as any)).toEqual({ memos: [] });
  });

  it('returns an empty memo list for an empty array', () => {
    expect(createAndMergeMemoEntity({ memos: [] })).toEqual({ memos: [] });
  });

  it('fills defaults when memo fields are missing', () => {
    const result = createAndMergeMemoEntity({ memos: [{}] } as any);

    expect(result.memos).toHaveLength(1);
    expect(result.memos[0]).toEqual({
      id: '',
      value: '',
      ui: { ...defaultUI },
    });
  });

  it('merges every valid memo field', () => {
    const result = createAndMergeMemoEntity({
      memos: [
        {
          id: 'memo-1',
          value: 'hello',
          ui: {
            active: true,
            color: '#ff0000',
            left: 10,
            top: 20,
            zIndex: 5,
            width: 300,
            height: 400,
          },
        },
      ],
    });

    expect(result.memos[0]).toEqual({
      id: 'memo-1',
      value: 'hello',
      ui: {
        active: true,
        color: '#ff0000',
        left: 10,
        top: 20,
        zIndex: 5,
        width: 300,
        height: 400,
      },
    });
  });

  it('ignores fields with the wrong primitive type', () => {
    const result = createAndMergeMemoEntity({
      memos: [
        {
          id: 1,
          value: null,
          ui: {
            active: 'true',
            color: 42,
            left: '10',
            top: undefined,
            zIndex: {},
            width: [],
            height: false,
          },
        },
      ],
    } as any);

    expect(result.memos[0]).toEqual({
      id: '',
      value: '',
      ui: { ...defaultUI },
    });
    expect(result.memos[0].ui.color).toBeUndefined();
  });

  it('keeps the ui defaults when ui is absent', () => {
    const result = createAndMergeMemoEntity({
      memos: [{ id: 'a' }],
    } as any);

    expect(result.memos[0].ui).toEqual({ ...defaultUI });
  });

  it('parses multiple memos independently', () => {
    const result = createAndMergeMemoEntity({
      memos: [{ id: 'a' }, { id: 'b', ui: { left: 1 } }],
    } as any);

    expect(result.memos.map(memo => memo.id)).toEqual(['a', 'b']);
    expect(result.memos[0].ui.left).toBe(200);
    expect(result.memos[1].ui.left).toBe(1);
    expect(result.memos[0].ui).not.toBe(result.memos[1].ui);
  });
});
