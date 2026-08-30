import { describe, expect, it } from 'vite-plus/test';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { SQLiteTypes } from '@/constants/sql/dataType/SQLite';

/**
 * Mirrors getPrimitiveType in @/utils/generator-code/utils: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase().replace(/\([^)]*\)/g, '');
  let matched: DataTypeHint | undefined;

  for (const hint of SQLiteTypes) {
    const name = hint.name.toLocaleLowerCase();
    if (
      value.indexOf(name) === 0 &&
      !/[0-9A-Za-z_]/.test(value.charAt(name.length)) &&
      (!matched || name.length > matched.name.length)
    ) {
      matched = hint;
    }
  }

  return matched?.primitiveType;
}

describe('SQLiteTypes', () => {
  it('lists the storage classes plus the documented affinity names', () => {
    expect(SQLiteTypes).toEqual([
      { name: 'BIGINT', primitiveType: 'long' },
      { name: 'BLOB', primitiveType: 'lob' },
      { name: 'BOOLEAN', primitiveType: 'boolean' },
      { name: 'CHARACTER', primitiveType: 'string' },
      { name: 'CLOB', primitiveType: 'lob' },
      { name: 'DATE', primitiveType: 'date' },
      { name: 'DATETIME', primitiveType: 'dateTime' },
      { name: 'DECIMAL', primitiveType: 'decimal' },
      { name: 'DOUBLE PRECISION', primitiveType: 'double' },
      { name: 'DOUBLE', primitiveType: 'double' },
      { name: 'FLOAT', primitiveType: 'double' },
      { name: 'INT', primitiveType: 'int' },
      { name: 'INT2', primitiveType: 'int' },
      { name: 'INT8', primitiveType: 'long' },
      { name: 'INTEGER', primitiveType: 'int' },
      { name: 'MEDIUMINT', primitiveType: 'int' },
      { name: 'NATIVE CHARACTER', primitiveType: 'string' },
      { name: 'NCHAR', primitiveType: 'string' },
      { name: 'NUMERIC', primitiveType: 'decimal' },
      { name: 'NVARCHAR', primitiveType: 'string' },
      { name: 'REAL', primitiveType: 'double' },
      { name: 'SMALLINT', primitiveType: 'int' },
      { name: 'TEXT', primitiveType: 'string' },
      { name: 'TINYINT', primitiveType: 'int' },
      { name: 'UNSIGNED BIG INT', primitiveType: 'long' },
      { name: 'VARCHAR', primitiveType: 'string' },
      { name: 'VARYING CHARACTER', primitiveType: 'string' },
    ]);
  });

  it('is upper case and ordered so a longer name precedes its prefix', () => {
    const names = SQLiteTypes.map(hint => hint.name);

    expect(names).toEqual(names.map(name => name.toUpperCase()));
    expect(
      names.filter((name, index) => {
        if (index === 0) return false;
        const prev = names[index - 1];
        if (prev.startsWith(`${name} `)) return false;
        return prev >= name;
      })
    ).toEqual([]);
  });

  it('carries no time hint, the one primitive SQLite has no name for', () => {
    const primitiveTypes = SQLiteTypes.map(hint => hint.primitiveType);

    expect(primitiveTypes).not.toContain('time');
    expect(primitiveTypes).not.toContain('float');
  });

  it('resolves data types by prefix, case-insensitively', () => {
    expect(resolvePrimitiveType('INTEGER')).toBe('int');
    expect(resolvePrimitiveType('integer primary key')).toBe('int');
    expect(resolvePrimitiveType('text')).toBe('string');
    expect(resolvePrimitiveType('NUMERIC(10, 2)')).toBe('decimal');
    expect(resolvePrimitiveType('real')).toBe('double');
    expect(resolvePrimitiveType('blob')).toBe('lob');
  });

  it('resolves the affinity names, longest prefix first', () => {
    expect(resolvePrimitiveType('VARCHAR(255)')).toBe('string');
    expect(resolvePrimitiveType('INT')).toBe('int');
    expect(resolvePrimitiveType('INT8')).toBe('long');
    expect(resolvePrimitiveType('DATETIME')).toBe('dateTime');
    expect(resolvePrimitiveType('UNSIGNED BIG INT')).toBe('long');
    expect(resolvePrimitiveType('STRING')).toBeUndefined();
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('resolves every listed name to its own primitive, longest match first', () => {
    const misresolved = SQLiteTypes.filter(
      hint => resolvePrimitiveType(hint.name) !== hint.primitiveType
    );

    expect(misresolved).toEqual([]);
  });
});
