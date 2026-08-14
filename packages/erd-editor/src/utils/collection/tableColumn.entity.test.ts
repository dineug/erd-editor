import { afterEach, describe, expect, it, vi } from 'vitest';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import { createColumn } from '@/utils/collection/tableColumn.entity';

describe('createColumn', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a column filled with defaults when no value is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T03:04:05.000Z'));
    const now = Date.now();

    const column = createColumn();

    expect(column.tableId).toBe('');
    expect(column.name).toBe('');
    expect(column.comment).toBe('');
    expect(column.dataType).toBe('');
    expect(column.default).toBe('');
    expect(column.options).toBe(0);
    expect(column.ui).toEqual({
      keys: 0,
      widthName: COLUMN_MIN_WIDTH,
      widthComment: COLUMN_MIN_WIDTH,
      widthDataType: COLUMN_MIN_WIDTH,
      widthDefault: COLUMN_MIN_WIDTH,
    });
    expect(column.meta).toEqual({ updateAt: now, createAt: now });
    expect(typeof column.id).toBe('string');
    expect(column.id.length).toBeGreaterThan(0);
  });

  it('generates a unique id per call', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createColumn().id));

    expect(ids.size).toBe(20);
  });

  it('overrides scalars and deep merges the ui object', () => {
    const column = createColumn({
      id: 'column-1',
      tableId: 'table-1',
      name: 'id',
      comment: 'primary key',
      dataType: 'int',
      default: '0',
      options: ColumnOption.primaryKey | ColumnOption.notNull,
      ui: { keys: ColumnUIKey.primaryKey, widthName: 80 },
    });

    expect(column).toMatchObject({
      id: 'column-1',
      tableId: 'table-1',
      name: 'id',
      comment: 'primary key',
      dataType: 'int',
      default: '0',
      options: ColumnOption.primaryKey | ColumnOption.notNull,
    });
    expect(column.ui).toEqual({
      keys: ColumnUIKey.primaryKey,
      widthName: 80,
      widthComment: COLUMN_MIN_WIDTH,
      widthDataType: COLUMN_MIN_WIDTH,
      widthDefault: COLUMN_MIN_WIDTH,
    });
  });

  it('keeps a zero option value instead of falling back to the default', () => {
    const column = createColumn({ options: 0, ui: { keys: 0 } });

    expect(column.options).toBe(0);
    expect(column.ui.keys).toBe(0);
  });

  it('does not mutate the given value object', () => {
    const value = { ui: { widthName: 10 } };
    const column = createColumn(value);

    expect(value).toEqual({ ui: { widthName: 10 } });
    expect(column.ui).not.toBe(value.ui);
  });

  it('treats an explicitly undefined value as no value', () => {
    const column = createColumn(undefined);

    expect(column.dataType).toBe('');
    expect(column.ui.widthDefault).toBe(COLUMN_MIN_WIDTH);
  });
});
