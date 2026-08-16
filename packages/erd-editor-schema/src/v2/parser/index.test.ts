import { describe, expect, it } from 'vite-plus/test';

import { parser } from '@/v2/parser';

describe('parser', () => {
  it('produces a complete schema from an empty object', () => {
    const schema = parser({});

    expect(Object.keys(schema).sort()).toEqual([
      'canvas',
      'memo',
      'relationship',
      'table',
    ]);
    expect(schema.canvas.version).toBe('2.2.11');
    expect(schema.table).toEqual({ tables: [], indexes: [] });
    expect(schema.relationship).toEqual({ relationships: [] });
    expect(schema.memo).toEqual({ memos: [] });
  });

  it('delegates each section to its own parser', () => {
    const schema = parser({
      canvas: { width: 4000, database: 'PostgreSQL' },
      table: {
        tables: [{ id: 't1', name: 'users', columns: [{ id: 'c1' }] }],
        indexes: [{ id: 'i1', tableId: 't1' }],
      },
      relationship: {
        relationships: [{ id: 'r1', relationshipType: 'N' }],
      },
      memo: { memos: [{ id: 'm1', value: 'note' }] },
    });

    expect(schema.canvas.width).toBe(4000);
    expect(schema.canvas.database).toBe('PostgreSQL');
    expect(schema.table.tables[0].name).toBe('users');
    expect(schema.table.tables[0].columns[0].id).toBe('c1');
    expect(schema.table.indexes[0].id).toBe('i1');
    expect(schema.relationship.relationships[0].relationshipType).toBe('OneN');
    expect(schema.memo.memos[0].value).toBe('note');
  });

  it('drops unknown top level keys', () => {
    const schema = parser({ unknown: 1, canvas: { scrollTop: 5 } });

    expect(schema).not.toHaveProperty('unknown');
    expect(schema.canvas.scrollTop).toBe(5);
  });

  it('ignores sections with an invalid shape', () => {
    const schema = parser({
      canvas: null,
      table: 'nope',
      relationship: 3,
      memo: [],
    });

    expect(schema.canvas.version).toBe('2.2.11');
    expect(schema.table).toEqual({ tables: [], indexes: [] });
    expect(schema.relationship).toEqual({ relationships: [] });
    expect(schema.memo).toEqual({ memos: [] });
  });

  it('throws when the source is nill', () => {
    expect(() => parser(undefined)).toThrow(TypeError);
    expect(() => parser(null)).toThrow(TypeError);
  });
});
