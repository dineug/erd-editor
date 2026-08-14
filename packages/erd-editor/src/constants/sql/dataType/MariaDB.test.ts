import { describe, expect, it } from 'vitest';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { MariaDBTypes } from '@/constants/sql/dataType/MariaDB';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase();
  let matched: DataTypeHint | undefined;

  for (const hint of MariaDBTypes) {
    const name = hint.name.toLocaleLowerCase();
    if (
      value.indexOf(name) === 0 &&
      (!matched || name.length > matched.name.length)
    ) {
      matched = hint;
    }
  }

  return matched?.primitiveType;
}

function namesOf(primitiveType: PrimitiveType): string[] {
  return MariaDBTypes.filter(hint => hint.primitiveType === primitiveType).map(
    hint => hint.name
  );
}

describe('MariaDBTypes', () => {
  it('lists the 45 supported data types in upper case', () => {
    expect(MariaDBTypes).toHaveLength(45);

    for (const hint of MariaDBTypes) {
      expect(hint.name).toBe(hint.name.toUpperCase());
    }
  });

  it('keeps the documented order', () => {
    expect(MariaDBTypes.map(hint => hint.name)).toEqual([
      'BIGINT',
      'BINARY',
      'BIT',
      'BLOB',
      'BOOL',
      'BOOLEAN',
      'CHAR',
      'DATE',
      'DATETIME',
      'DEC',
      'DECIMAL',
      'DOUBLE PRECISION',
      'DOUBLE',
      'ENUM',
      'FIXED',
      'FLOAT',
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'INT',
      'INTEGER',
      'JSON',
      'LINESTRING',
      'LONGBLOB',
      'LONGTEXT',
      'MEDIUMBLOB',
      'MEDIUMINT',
      'MEDIUMTEXT',
      'MULTILINESTRING',
      'MULTIPOINT',
      'MULTIPOLYGON',
      'NUMERIC',
      'POINT',
      'POLYGON',
      'REAL',
      'SET',
      'SMALLINT',
      'TEXT',
      'TIME',
      'TIMESTAMP',
      'TINYBLOB',
      'TINYINT',
      'TINYTEXT',
      'VARBINARY',
      'VARCHAR',
      'YEAR',
    ]);
  });

  it('classifies the numeric types', () => {
    expect(namesOf('long')).toEqual(['BIGINT']);
    expect(namesOf('int')).toEqual([
      'BIT',
      'INT',
      'INTEGER',
      'MEDIUMINT',
      'SMALLINT',
      'TINYINT',
      'YEAR',
    ]);
    expect(namesOf('decimal')).toEqual(['DEC', 'DECIMAL', 'FIXED', 'NUMERIC']);
    expect(namesOf('float')).toEqual(['FLOAT']);
    expect(namesOf('double')).toEqual(['DOUBLE PRECISION', 'DOUBLE', 'REAL']);
  });

  it('classifies the boolean, temporal and large object types', () => {
    expect(namesOf('boolean')).toEqual(['BOOL', 'BOOLEAN']);
    expect(namesOf('date')).toEqual(['DATE']);
    expect(namesOf('dateTime')).toEqual(['DATETIME', 'TIMESTAMP']);
    expect(namesOf('time')).toEqual(['TIME']);
    expect(namesOf('lob')).toEqual([
      'BLOB',
      'JSON',
      'LONGBLOB',
      'LONGTEXT',
      'MEDIUMBLOB',
      'MEDIUMTEXT',
      'TEXT',
      'TINYBLOB',
      'TINYTEXT',
    ]);
  });

  it('treats the spatial and character types as strings', () => {
    expect(namesOf('string')).toEqual([
      'BINARY',
      'CHAR',
      'ENUM',
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'LINESTRING',
      'MULTILINESTRING',
      'MULTIPOINT',
      'MULTIPOLYGON',
      'POINT',
      'POLYGON',
      'SET',
      'VARBINARY',
      'VARCHAR',
    ]);
  });

  it('adds FIXED and REAL on top of the MySQL type list', () => {
    const names = MariaDBTypes.map(hint => hint.name);
    expect(names).toContain('FIXED');
    expect(names).toContain('REAL');
  });

  it('orders "DOUBLE PRECISION" before "DOUBLE" so both resolve to double', () => {
    const doublePrecision = MariaDBTypes.findIndex(
      hint => hint.name === 'DOUBLE PRECISION'
    );
    const double = MariaDBTypes.findIndex(hint => hint.name === 'DOUBLE');

    expect(doublePrecision).toBeLessThan(double);
    expect(resolvePrimitiveType('DOUBLE PRECISION')).toBe('double');
    expect(resolvePrimitiveType('double(10,2)')).toBe('double');
  });

  it('resolves parameterised data types by prefix', () => {
    expect(resolvePrimitiveType('VARCHAR(255)')).toBe('string');
    expect(resolvePrimitiveType('decimal(10, 2)')).toBe('decimal');
    expect(resolvePrimitiveType('int unsigned')).toBe('int');
    expect(resolvePrimitiveType('UNKNOWN_TYPE')).toBeUndefined();
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('resolves DATETIME and TIMESTAMP to dateTime despite their shorter prefixes', () => {
    // `DATE` and `TIME` come first, but the longest matching hint wins.
    expect(resolvePrimitiveType('DATETIME')).toBe('dateTime');
    expect(resolvePrimitiveType('TIMESTAMP')).toBe('dateTime');
    expect(resolvePrimitiveType('DATE')).toBe('date');
    expect(resolvePrimitiveType('TIME')).toBe('time');

    const extendingAnEarlierName = MariaDBTypes.filter((hint, index) =>
      MariaDBTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0 &&
          earlier.primitiveType !== hint.primitiveType
      )
    );

    expect(extendingAnEarlierName).toEqual<DataTypeHint[]>([
      { name: 'DATETIME', primitiveType: 'dateTime' },
      { name: 'TIMESTAMP', primitiveType: 'dateTime' },
    ]);

    for (const hint of extendingAnEarlierName) {
      expect(resolvePrimitiveType(hint.name)).toBe(hint.primitiveType);
    }
  });
});
