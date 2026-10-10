import { describe, expect, it } from 'vite-plus/test';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { createTable } from '@/utils/collection/table.entity';

describe('createTable', () => {
  it('creates a table filled with defaults when no value is given', () => {
    const table = createTable();

    expect(table.name).toBe('');
    expect(table.comment).toBe('');
    expect(table.columnIds).toEqual([]);
    expect(table.seqColumnIds).toEqual([]);
    expect(table.groupId).toBe('');
    expect(table.ui).toEqual({
      x: 200,
      y: 100,
      zIndex: 2,
      widthName: COLUMN_MIN_WIDTH,
      widthComment: COLUMN_MIN_WIDTH,
      color: '',
    });
    expect(table).not.toHaveProperty('meta');
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

  it('drops a __proto__ key parsed from a peer or tool payload', () => {
    const table = createTable(
      JSON.parse(
        '{"__proto__": {"admin": true}, "name": "users", "ui": {"__proto__": {"admin": true}, "x": 5}}'
      )
    );

    expect(table.name).toBe('users');
    expect(Object.getPrototypeOf(table)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(table.ui)).toBe(Object.prototype);
    expect(table.ui).toEqual({
      x: 5,
      y: 100,
      zIndex: 2,
      widthName: COLUMN_MIN_WIDTH,
      widthComment: COLUMN_MIN_WIDTH,
      color: '',
    });
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it('treats an explicitly undefined value as no value', () => {
    const table = createTable(undefined);

    expect(table.name).toBe('');
    expect(table.ui.y).toBe(100);
  });
});
