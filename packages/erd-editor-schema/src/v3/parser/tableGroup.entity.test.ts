import { describe, expect, it } from 'vite-plus/test';

import {
  createAndMergeTableGroupEntities,
  createTableGroup,
} from '@/v3/parser/tableGroup.entity';

const defaultUI = { x: 200, y: 100, width: 400, height: 300, zIndex: 1 };

describe('createTableGroup', () => {
  it('creates an unnamed, uncoloured group with the default ui', () => {
    const group = createTableGroup();

    expect(group.id).toBe('');
    expect(group.name).toBe('');
    expect(group.color).toBe('');
    expect(group.ui).toEqual(defaultUI);
    expect(group).not.toHaveProperty('meta');
  });

  it('hands out a new ui each time', () => {
    const first = createTableGroup();
    first.ui.width = 10;

    expect(createTableGroup().ui.width).toBe(400);
  });
});

describe('createAndMergeTableGroupEntities', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string', 'nope'],
    ['number', 1],
    ['array', []],
  ])('returns an empty record for a non-object source (%s)', (_l, source) => {
    expect(createAndMergeTableGroupEntities(source as any)).toEqual({});
  });

  it('skips falsy entries and entries without an id', () => {
    const entities = createAndMergeTableGroupEntities({
      a: null as any,
      b: undefined,
      c: 0 as any,
      d: { name: 'no-id' },
      e: { id: 5 as any, name: 'numeric id' },
    });

    expect(entities).toEqual({});
  });

  it('keys the entity by its own id, not the record key', () => {
    const entities = createAndMergeTableGroupEntities({
      recordKey: { id: 'g1', name: 'billing' },
    });

    expect(Object.keys(entities)).toEqual(['g1']);
    expect(entities.g1.name).toBe('billing');
  });

  it('merges every field', () => {
    const entities = createAndMergeTableGroupEntities({
      g1: {
        id: 'g1',
        name: 'billing',
        color: '#0090ff',
        ui: { x: -10, y: 20, width: 640, height: 360, zIndex: 4 },
      },
    });

    expect(entities.g1).toEqual({
      id: 'g1',
      name: 'billing',
      color: '#0090ff',
      ui: { x: -10, y: 20, width: 640, height: 360, zIndex: 4 },
    });
  });

  it('keeps defaults for wrongly typed fields', () => {
    const entities = createAndMergeTableGroupEntities({
      g1: {
        id: 'g1',
        name: 42 as any,
        color: ['#fff'] as any,
        ui: {
          x: '1' as any,
          y: 5,
          width: null as any,
          height: {} as any,
          zIndex: true as any,
        },
      },
    });

    const group = entities.g1;
    expect(group.name).toBe('');
    expect(group.color).toBe('');
    expect(group.ui).toEqual({ ...defaultUI, y: 5 });
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a string', 'wide'],
  ])('keeps the ui defaults when ui is %s', (_l, ui) => {
    const entities = createAndMergeTableGroupEntities({
      g1: { id: 'g1', ui: ui as any },
    });

    expect(entities.g1.ui).toEqual(defaultUI);
  });

  it('ignores keys a group does not have', () => {
    const entities = createAndMergeTableGroupEntities({
      g1: { id: 'g1', tableIds: ['t1'], note: 'n' } as any,
    });

    expect(Object.keys(entities.g1).sort()).toEqual([
      'color',
      'id',
      'name',
      'ui',
    ]);
  });

  it('merges several groups and lets the last id win', () => {
    const entities = createAndMergeTableGroupEntities({
      a: { id: 'a', name: 'first' },
      b: { id: 'b', name: 'second' },
      c: { id: 'a', name: 'override' },
    });

    expect(Object.keys(entities).sort()).toEqual(['a', 'b']);
    expect(entities.a.name).toBe('override');
  });
});
