import { describe, expect, it } from 'vitest';

import * as tableEntityModule from '@/v3/schema/table.entity';
import { Table, TableUI } from '@/v3/schema/table.entity';

const buildTable = (id: string, columnIds: string[] = []): Table => ({
  id,
  name: `table_${id}`,
  comment: '',
  columnIds,
  seqColumnIds: [...columnIds],
  ui: {
    x: 0,
    y: 0,
    zIndex: 2,
    widthName: 60,
    widthComment: 60,
    color: '',
  },
  meta: { updateAt: 0, createAt: 0 },
});

describe('v3/schema/table.entity', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(tableEntityModule)).toEqual([]);
  });

  it('describes a fully populated table entity', () => {
    const ui: TableUI = {
      x: 120,
      y: 240,
      zIndex: 7,
      widthName: 84,
      widthComment: 60,
      color: '#ff0000',
    };
    const table: Table = {
      id: 'table-1',
      name: 'actor',
      comment: 'film actors',
      columnIds: ['column-1', 'column-2'],
      seqColumnIds: ['column-1', 'column-2', 'column-3'],
      ui,
      meta: { updateAt: 20, createAt: 10 },
    };

    expect(table.columnIds).toHaveLength(2);
    expect(table.ui.color).toBe('#ff0000');
    expect(table.meta.updateAt).toBeGreaterThan(table.meta.createAt);
  });

  it('keeps seqColumnIds as a superset that retains deleted column ids', () => {
    const table = buildTable('a', ['c1', 'c2']);
    table.columnIds = table.columnIds.filter(id => id !== 'c1');

    expect(table.columnIds).toEqual(['c2']);
    expect(table.seqColumnIds).toEqual(['c1', 'c2']);
    expect(
      table.seqColumnIds.filter(id => !table.columnIds.includes(id))
    ).toEqual(['c1']);
  });

  it('orders tables by their ui zIndex', () => {
    const first = buildTable('a');
    const second = buildTable('b');
    second.ui.zIndex = 10;

    const sorted = [second, first].sort((l, r) => l.ui.zIndex - r.ui.zIndex);
    expect(sorted.map(table => table.id)).toEqual(['a', 'b']);
  });
});
