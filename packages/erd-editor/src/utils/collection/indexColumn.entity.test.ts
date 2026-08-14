import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrderType } from '@/constants/schema';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';

describe('createIndexColumn', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an index column filled with defaults when no value is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T03:04:05.000Z'));
    const now = Date.now();

    const indexColumn = createIndexColumn();

    expect(indexColumn.indexId).toBe('');
    expect(indexColumn.columnId).toBe('');
    expect(indexColumn.orderType).toBe(OrderType.ASC);
    expect(indexColumn.meta).toEqual({ updateAt: now, createAt: now });
    expect(typeof indexColumn.id).toBe('string');
    expect(indexColumn.id.length).toBeGreaterThan(0);
  });

  it('generates a unique id per call', () => {
    const a = createIndexColumn();
    const b = createIndexColumn();

    expect(a.id).not.toBe(b.id);
  });

  it('overrides the defaults with the given partial value', () => {
    const indexColumn = createIndexColumn({
      id: 'ic-1',
      indexId: 'index-1',
      columnId: 'column-1',
      orderType: OrderType.DESC,
    });

    expect(indexColumn).toMatchObject({
      id: 'ic-1',
      indexId: 'index-1',
      columnId: 'column-1',
      orderType: OrderType.DESC,
    });
  });

  it('merges a partial meta object', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-06T07:08:09.000Z'));
    const now = Date.now();

    const indexColumn = createIndexColumn({ meta: { updateAt: 42 } });

    expect(indexColumn.meta).toEqual({ updateAt: 42, createAt: now });
  });

  it('treats an explicitly undefined value as no value', () => {
    const indexColumn = createIndexColumn(undefined);

    expect(indexColumn.orderType).toBe(OrderType.ASC);
    expect(indexColumn.columnId).toBe('');
  });
});
