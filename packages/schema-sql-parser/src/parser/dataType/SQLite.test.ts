import { describe, expect, it } from 'vite-plus/test';

import { SQLiteTypes } from '@/parser/dataType/SQLite';
import { isDataType } from '@/parser/helper';
import { tokenizer } from '@/parser/tokenizer';

describe('SQLiteTypes', () => {
  it('exposes only the five storage class names', () => {
    expect(SQLiteTypes).toEqual(['BLOB', 'INTEGER', 'NUMERIC', 'REAL', 'TEXT']);
    expect(SQLiteTypes).toHaveLength(5);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(SQLiteTypes).size).toBe(SQLiteTypes.length);
  });

  it('is written entirely in upper case and sorted ascending', () => {
    const notUpperCase = SQLiteTypes.filter(
      type => type !== type.toUpperCase()
    );
    expect(notUpperCase).toEqual([]);
    expect([...SQLiteTypes].sort()).toEqual(SQLiteTypes);
  });

  it('has no multi-word type, so every entry survives tokenization', () => {
    expect(SQLiteTypes.filter(type => type.includes(' '))).toEqual([]);
    const split = SQLiteTypes.filter(type => tokenizer(type).length !== 1);
    expect(split).toEqual([]);
  });

  it('omits the affinity aliases SQLite also accepts', () => {
    expect(SQLiteTypes).not.toContain('INT');
    expect(SQLiteTypes).not.toContain('VARCHAR');
    expect(SQLiteTypes).not.toContain('DOUBLE');
    expect(SQLiteTypes).not.toContain('BOOLEAN');
    expect(SQLiteTypes).not.toContain('DATETIME');
  });

  it('makes every type recognizable by isDataType', () => {
    const unrecognized = SQLiteTypes.filter(
      type => !isDataType(tokenizer(type))(0)
    );
    expect(unrecognized).toEqual([]);
  });

  it('is matched case-insensitively and rejects unknown words', () => {
    expect(isDataType(tokenizer('integer'))(0)).toBe(true);
    expect(isDataType(tokenizer('Blob'))(0)).toBe(true);
    expect(isDataType(tokenizer('STORAGECLASS'))(0)).toBe(false);
  });

  it('is fully contained in the union recognized by isDataType', () => {
    const outside = SQLiteTypes.filter(
      type => !isDataType(tokenizer(type.toLowerCase()))(0)
    );
    expect(outside).toEqual([]);
  });
});
