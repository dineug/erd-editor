import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { START_ADD, START_X, START_Y } from '@/constants/layout';
import { Memo, Settings, Table } from '@/internal-types';
import {
  getDefaultEntityMeta,
  nextPoint,
  nextZIndex,
  pascalCase,
  safeRange,
  toList,
} from '@/utils';
import { createMemo } from '@/utils/collection/memo.entity';
import { createTable } from '@/utils/collection/table.entity';

const createSettings = (partial: Partial<Settings> = {}): Settings => ({
  ...schemaV3Parser({}).settings,
  width: 2000,
  height: 2000,
  scrollTop: 0,
  scrollLeft: 0,
  zoomLevel: 1,
  ...partial,
});

describe('nextZIndex', () => {
  it('returns 2 when there is nothing on the canvas', () => {
    expect(nextZIndex([], [])).toBe(2);
  });

  it('returns the highest zIndex plus one', () => {
    const tables: Table[] = [
      createTable({ ui: { zIndex: 3 } }),
      createTable({ ui: { zIndex: 7 } }),
    ];
    const memos: Memo[] = [createMemo({ ui: { zIndex: 5 } })];

    expect(nextZIndex(tables, memos)).toBe(8);
  });

  it('takes the memo zIndex into account when it is the largest', () => {
    const tables: Table[] = [createTable({ ui: { zIndex: 2 } })];
    const memos: Memo[] = [createMemo({ ui: { zIndex: 42 } })];

    expect(nextZIndex(tables, memos)).toBe(43);
  });

  it('never drops below 2 even for negative zIndex values', () => {
    const tables: Table[] = [createTable({ ui: { zIndex: -10 } })];

    expect(nextZIndex(tables, [])).toBe(2);
  });
});

describe('nextPoint', () => {
  it('offsets the start point by the scroll at zoom level 1', () => {
    const settings = createSettings({ scrollLeft: 30, scrollTop: 10 });

    expect(nextPoint(settings, [], [])).toEqual({
      x: START_X - 30,
      y: START_Y - 10,
    });
  });

  it('converts the start point into canvas coordinates when zoomed out', () => {
    const settings = createSettings({
      width: 1000,
      height: 800,
      zoomLevel: 0.5,
    });

    expect(nextPoint(settings, [], [])).toEqual({ x: -100, y: -200 });
  });

  it('shifts the point while it collides with an existing table', () => {
    const settings = createSettings();
    const tables: Table[] = [createTable({ ui: { x: START_X, y: START_Y } })];

    expect(nextPoint(settings, tables, [])).toEqual({
      x: START_X + START_ADD,
      y: START_Y + START_ADD,
    });
  });

  it('keeps shifting across both tables and memos until a free slot', () => {
    const settings = createSettings();
    const tables: Table[] = [createTable({ ui: { x: START_X, y: START_Y } })];
    const memos: Memo[] = [
      createMemo({ ui: { x: START_X + START_ADD, y: START_Y + START_ADD } }),
    ];

    expect(nextPoint(settings, tables, memos)).toEqual({
      x: START_X + START_ADD * 2,
      y: START_Y + START_ADD * 2,
    });
  });

  it('ignores entities that only share one axis', () => {
    const settings = createSettings();
    const tables: Table[] = [
      createTable({ ui: { x: START_X, y: START_Y + 1 } }),
      createTable({ ui: { x: START_X + 1, y: START_Y } }),
    ];

    expect(nextPoint(settings, tables, [])).toEqual({
      x: START_X,
      y: START_Y,
    });
  });
});

describe('toList', () => {
  it('maps ids to entities in order', () => {
    const entities = { a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' } };

    expect(toList(['c', 'a'], entities)).toEqual([{ id: 'c' }, { id: 'a' }]);
    expect(toList(['a', 'b', 'c'], entities)).toEqual([
      entities.a,
      entities.b,
      entities.c,
    ]);
  });

  it('drops ids that are missing from the entity map', () => {
    const entities = { a: { id: 'a' } };

    expect(toList(['a', 'missing'], entities)).toEqual([{ id: 'a' }]);
  });

  it('drops falsy entity values as well', () => {
    const entities: Record<string, number> = { zero: 0, one: 1 };

    expect(toList(['zero', 'one'], entities)).toEqual([1]);
  });

  it('returns an empty array for no ids', () => {
    expect(toList([], { a: 1 })).toEqual([]);
  });
});

describe('getDefaultEntityMeta', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stamps createAt and updateAt with the current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-04T05:06:07.000Z'));

    const meta = getDefaultEntityMeta();
    const now = new Date('2024-03-04T05:06:07.000Z').getTime();

    expect(meta).toEqual({ createAt: now, updateAt: now });
  });

  it('returns a fresh object each call', () => {
    const a = getDefaultEntityMeta();
    const b = getDefaultEntityMeta();

    expect(a).not.toBe(b);
    expect(typeof a.createAt).toBe('number');
  });
});

describe('safeRange', () => {
  it('builds an inclusive ascending range', () => {
    expect(safeRange(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it('normalizes a reversed range to ascending order', () => {
    expect(safeRange(4, 1)).toEqual([1, 2, 3, 4]);
  });

  it('returns a single element when both bounds are equal', () => {
    expect(safeRange(2, 2)).toEqual([2]);
  });

  it('supports negative bounds', () => {
    expect(safeRange(-2, 1)).toEqual([-2, -1, 0, 1]);
  });
});

describe('pascalCase', () => {
  it('converts separated words to PascalCase', () => {
    expect(pascalCase('foo bar')).toBe('FooBar');
    expect(pascalCase('foo_bar_baz')).toBe('FooBarBaz');
    expect(pascalCase('foo-bar')).toBe('FooBar');
    expect(pascalCase('fooBar')).toBe('FooBar');
  });

  it('returns an empty string for empty or missing input', () => {
    expect(pascalCase()).toBe('');
    expect(pascalCase('')).toBe('');
  });
});
