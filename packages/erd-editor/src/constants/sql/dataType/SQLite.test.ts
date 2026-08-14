import { describe, expect, it } from 'vitest';

import { PrimitiveType } from '@/constants/sql/dataType';
import { SQLiteTypes } from '@/constants/sql/dataType/SQLite';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: the first hint
 * whose lowercased name is a prefix of the lowercased data type wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  return SQLiteTypes.find(
    hint =>
      dataType.toLocaleLowerCase().indexOf(hint.name.toLocaleLowerCase()) === 0
  )?.primitiveType;
}

describe('SQLiteTypes', () => {
  it('lists only the five storage classes', () => {
    expect(SQLiteTypes).toEqual([
      { name: 'BLOB', primitiveType: 'lob' },
      { name: 'INTEGER', primitiveType: 'int' },
      { name: 'NUMERIC', primitiveType: 'decimal' },
      { name: 'REAL', primitiveType: 'double' },
      { name: 'TEXT', primitiveType: 'string' },
    ]);
  });

  it('is alphabetically ordered upper case with one hint per primitive', () => {
    const names = SQLiteTypes.map(hint => hint.name);

    expect(names).toEqual([...names].sort());
    expect(names).toEqual(names.map(name => name.toUpperCase()));

    const primitiveTypes = SQLiteTypes.map(hint => hint.primitiveType);
    expect(new Set(primitiveTypes).size).toBe(primitiveTypes.length);
  });

  it('has no temporal or boolean hints, matching SQLite storage classes', () => {
    const primitiveTypes = SQLiteTypes.map(hint => hint.primitiveType);

    expect(primitiveTypes).not.toContain('date');
    expect(primitiveTypes).not.toContain('dateTime');
    expect(primitiveTypes).not.toContain('time');
    expect(primitiveTypes).not.toContain('boolean');
    expect(primitiveTypes).not.toContain('long');
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

  it('does not resolve SQLite type affinities that are absent from the list', () => {
    expect(resolvePrimitiveType('VARCHAR(255)')).toBeUndefined();
    expect(resolvePrimitiveType('INT')).toBeUndefined();
    expect(resolvePrimitiveType('DATETIME')).toBeUndefined();
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('has no name that shadows another by prefix', () => {
    const shadowed = SQLiteTypes.filter((hint, index) =>
      SQLiteTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0
      )
    );

    expect(shadowed).toEqual([]);
  });
});
