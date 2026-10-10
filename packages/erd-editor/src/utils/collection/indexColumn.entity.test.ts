import { describe, expect, it } from 'vite-plus/test';

import { OrderType } from '@/constants/schema';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';

describe('createIndexColumn', () => {
  it('creates an index column filled with defaults when no value is given', () => {
    const indexColumn = createIndexColumn();

    expect(indexColumn.indexId).toBe('');
    expect(indexColumn.columnId).toBe('');
    expect(indexColumn.orderType).toBe(OrderType.ASC);
    expect(indexColumn).not.toHaveProperty('meta');
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

  it('treats an explicitly undefined value as no value', () => {
    const indexColumn = createIndexColumn(undefined);

    expect(indexColumn.orderType).toBe(OrderType.ASC);
    expect(indexColumn.columnId).toBe('');
  });
});
