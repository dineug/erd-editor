import { describe, expect, it } from 'vite-plus/test';

import { createIndex } from '@/utils/collection/index.entity';

describe('createIndex', () => {
  it('creates an index filled with defaults when no value is given', () => {
    const index = createIndex();

    expect(index.name).toBe('');
    expect(index.tableId).toBe('');
    expect(index.indexColumnIds).toEqual([]);
    expect(index.seqIndexColumnIds).toEqual([]);
    expect(index.unique).toBe(false);
    expect(index).not.toHaveProperty('meta');
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

  it('treats an explicitly undefined value as no value', () => {
    const index = createIndex(undefined);

    expect(index.name).toBe('');
    expect(index.unique).toBe(false);
  });
});
