import { describe, expect, it } from 'vite-plus/test';

import { SQLiteTypes } from '@/parser/dataType/SQLite';
import { isDataType } from '@/parser/helper';
import { tokenizer } from '@/parser/tokenizer';

const orderViolations = (list: string[]) =>
  list.filter((value, index) => {
    if (index === 0) return false;
    const prev = list[index - 1];
    if (prev.startsWith(`${value} `)) return false;
    return prev.toUpperCase() >= value.toUpperCase();
  });

describe('SQLiteTypes', () => {
  it('exposes the storage classes and the documented affinity names', () => {
    expect(SQLiteTypes).toEqual([
      'BIGINT',
      'BLOB',
      'BOOLEAN',
      'CHARACTER',
      'CLOB',
      'DATE',
      'DATETIME',
      'DECIMAL',
      'DOUBLE PRECISION',
      'DOUBLE',
      'FLOAT',
      'INT',
      'INT2',
      'INT8',
      'INTEGER',
      'MEDIUMINT',
      'NATIVE CHARACTER',
      'NCHAR',
      'NUMERIC',
      'NVARCHAR',
      'REAL',
      'SMALLINT',
      'TEXT',
      'TINYINT',
      'UNSIGNED BIG INT',
      'VARCHAR',
      'VARYING CHARACTER',
    ]);
    expect(SQLiteTypes).toHaveLength(27);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(SQLiteTypes).size).toBe(SQLiteTypes.length);
  });

  it('is written entirely in upper case and sorted ascending', () => {
    const notUpperCase = SQLiteTypes.filter(
      type => type !== type.toUpperCase()
    );
    expect(notUpperCase).toEqual([]);
    expect(orderViolations(SQLiteTypes)).toEqual([]);
  });

  it('lists the affinity names spelled over several words', () => {
    expect(SQLiteTypes.filter(type => type.includes(' '))).toEqual([
      'DOUBLE PRECISION',
      'NATIVE CHARACTER',
      'UNSIGNED BIG INT',
      'VARYING CHARACTER',
    ]);
  });

  it('omits the names the affinity rules only use as counter-examples', () => {
    expect(SQLiteTypes).not.toContain('STRING');
    expect(SQLiteTypes).not.toContain('FLOATING POINT');
    // ANY is legal in a STRICT table only, and datatype3.html never lists it.
    expect(SQLiteTypes).not.toContain('ANY');
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
