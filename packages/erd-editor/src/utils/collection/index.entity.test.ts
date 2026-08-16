import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createIndex } from '@/utils/collection/index.entity';

describe('createIndex', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an index filled with defaults when no value is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T03:04:05.000Z'));
    const now = Date.now();

    const index = createIndex();

    expect(index.name).toBe('');
    expect(index.tableId).toBe('');
    expect(index.indexColumnIds).toEqual([]);
    expect(index.seqIndexColumnIds).toEqual([]);
    expect(index.unique).toBe(false);
    expect(index.meta).toEqual({ updateAt: now, createAt: now });
    expect(typeof index.id).toBe('string');
    expect(index.id.length).toBeGreaterThan(0);
  });

  it('generates a unique id per call', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createIndex().id));

    expect(ids.size).toBe(20);
  });

  it('overrides scalar defaults with the given partial value', () => {
    const index = createIndex({
      id: 'index-1',
      name: 'idx_user_email',
      tableId: 'table-1',
      unique: true,
    });

    expect(index.id).toBe('index-1');
    expect(index.name).toBe('idx_user_email');
    expect(index.tableId).toBe('table-1');
    expect(index.unique).toBe(true);
  });

  it('concatenates array values onto the empty defaults', () => {
    const index = createIndex({
      indexColumnIds: ['ic-1', 'ic-2'],
      seqIndexColumnIds: ['ic-2', 'ic-1'],
    });

    expect(index.indexColumnIds).toEqual(['ic-1', 'ic-2']);
    expect(index.seqIndexColumnIds).toEqual(['ic-2', 'ic-1']);
  });

  it('does not keep a reference to the source arrays', () => {
    const indexColumnIds = ['ic-1'];
    const index = createIndex({ indexColumnIds });

    indexColumnIds.push('ic-2');

    expect(index.indexColumnIds).toEqual(['ic-1']);
  });

  it('merges a partial meta object', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-06T07:08:09.000Z'));
    const now = Date.now();

    const index = createIndex({ meta: { createAt: 1 } });

    expect(index.meta).toEqual({ createAt: 1, updateAt: now });
  });

  it('treats an explicitly undefined value as no value', () => {
    const index = createIndex(undefined);

    expect(index.name).toBe('');
    expect(index.unique).toBe(false);
  });
});
