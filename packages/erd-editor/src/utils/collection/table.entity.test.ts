import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { createTable } from '@/utils/collection/table.entity';

describe('createTable', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a table filled with defaults when no value is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T03:04:05.000Z'));
    const now = Date.now();

    const table = createTable();

    expect(table.name).toBe('');
    expect(table.comment).toBe('');
    expect(table.columnIds).toEqual([]);
    expect(table.seqColumnIds).toEqual([]);
    expect(table.ui).toEqual({
      x: 200,
      y: 100,
      zIndex: 2,
      widthName: COLUMN_MIN_WIDTH,
      widthComment: COLUMN_MIN_WIDTH,
      color: '',
    });
    expect(table.meta).toEqual({ updateAt: now, createAt: now });
    expect(typeof table.id).toBe('string');
    expect(table.id.length).toBeGreaterThan(0);
  });

  it('generates a unique id per call', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createTable().id));

    expect(ids.size).toBe(20);
  });

  it('deep merges the ui object and concatenates column id arrays', () => {
    const table = createTable({
      id: 'table-1',
      name: 'users',
      comment: 'user table',
      columnIds: ['column-1', 'column-2'],
      seqColumnIds: ['column-1', 'column-2'],
      ui: { x: 300, widthName: 120, color: '#ff0000' },
    });

    expect(table.id).toBe('table-1');
    expect(table.name).toBe('users');
    expect(table.comment).toBe('user table');
    expect(table.columnIds).toEqual(['column-1', 'column-2']);
    expect(table.seqColumnIds).toEqual(['column-1', 'column-2']);
    expect(table.ui).toEqual({
      x: 300,
      y: 100,
      zIndex: 2,
      widthName: 120,
      widthComment: COLUMN_MIN_WIDTH,
      color: '#ff0000',
    });
  });

  it('clones the given arrays so later mutation does not leak in', () => {
    const columnIds = ['column-1'];
    const table = createTable({ columnIds });

    columnIds.push('column-2');

    expect(table.columnIds).toEqual(['column-1']);
  });

  it('merges a partial meta object', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-06T07:08:09.000Z'));
    const now = Date.now();

    const table = createTable({ meta: { createAt: 7 } });

    expect(table.meta).toEqual({ createAt: 7, updateAt: now });
  });

  it('treats an explicitly undefined value as no value', () => {
    const table = createTable(undefined);

    expect(table.name).toBe('');
    expect(table.ui.y).toBe(100);
  });
});
