import { describe, expect, it } from 'vite-plus/test';

import {
  createAndMergeMemoEntities,
  createMemo,
} from '@/v3/parser/memo.entity';

describe('createMemo', () => {
  it('creates a memo with the default ui', () => {
    const memo = createMemo();

    expect(memo.id).toBe('');
    expect(memo.value).toBe('');
    expect(memo.ui).toEqual({
      x: 200,
      y: 100,
      zIndex: 2,
      width: 116,
      height: 100,
      color: '',
    });
    expect(memo.meta.createAt).toBe(memo.meta.updateAt);
    expect(typeof memo.meta.createAt).toBe('number');
  });
});

describe('createAndMergeMemoEntities', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string', 'nope'],
    ['array', []],
  ])('returns an empty record for a non-object source (%s)', (_l, source) => {
    expect(createAndMergeMemoEntities(source as any)).toEqual({});
  });

  it('skips falsy entries', () => {
    const entities = createAndMergeMemoEntities({
      a: null as any,
      b: undefined,
      c: 0 as any,
    });

    expect(entities).toEqual({});
  });

  it('drops entries without an id', () => {
    const entities = createAndMergeMemoEntities({
      a: { value: 'hello' },
    });

    expect(entities).toEqual({});
  });

  it('keys the entity by its own id, not the record key', () => {
    const entities = createAndMergeMemoEntities({
      recordKey: { id: 'memo1', value: 'hello' },
    });

    expect(Object.keys(entities)).toEqual(['memo1']);
    expect(entities.memo1.value).toBe('hello');
  });

  it('merges every ui field', () => {
    const entities = createAndMergeMemoEntities({
      memo1: {
        id: 'memo1',
        value: 'note',
        ui: {
          x: 1,
          y: 2,
          zIndex: 3,
          width: 4,
          height: 5,
          color: '#fff',
        },
        meta: { updateAt: 10, createAt: 20 },
      },
    });

    expect(entities.memo1).toEqual({
      id: 'memo1',
      value: 'note',
      ui: { x: 1, y: 2, zIndex: 3, width: 4, height: 5, color: '#fff' },
      meta: { updateAt: 10, createAt: 20 },
    });
  });

  it('keeps defaults for wrongly typed fields', () => {
    const entities = createAndMergeMemoEntities({
      memo1: {
        id: 'memo1',
        value: 42 as any,
        ui: {
          x: '1' as any,
          color: 1 as any,
          height: null as any,
        },
        meta: { updateAt: 'x' as any },
      },
    });

    const memo = entities.memo1;
    expect(memo.value).toBe('');
    expect(memo.ui.x).toBe(200);
    expect(memo.ui.color).toBe('');
    expect(memo.ui.height).toBe(100);
    expect(memo.meta.updateAt).toBe(memo.meta.createAt);
  });

  it('keeps the ui defaults when ui is missing', () => {
    const entities = createAndMergeMemoEntities({
      memo1: { id: 'memo1' },
    });

    expect(entities.memo1.ui).toEqual({
      x: 200,
      y: 100,
      zIndex: 2,
      width: 116,
      height: 100,
      color: '',
    });
  });

  it('merges multiple entities and lets the last id win', () => {
    const entities = createAndMergeMemoEntities({
      a: { id: 'a', value: 'first' },
      b: { id: 'b', value: 'second' },
      c: { id: 'a', value: 'override' },
    });

    expect(Object.keys(entities).sort()).toEqual(['a', 'b']);
    expect(entities.a.value).toBe('override');
  });
});
