import { describe, expect, it } from 'vite-plus/test';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { MySQLTypes } from '@/constants/sql/dataType/MySQL';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase();
  let matched: DataTypeHint | undefined;

  for (const hint of MySQLTypes) {
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
  return MySQLTypes.filter(hint => hint.primitiveType === primitiveType).map(
    hint => hint.name
  );
}

describe('MySQLTypes', () => {
  it('lists the 43 supported data types in upper case', () => {
    expect(MySQLTypes).toHaveLength(43);

    for (const hint of MySQLTypes) {
      expect(hint.name).toBe(hint.name.toUpperCase());
    }
  });

  it('keeps the documented order', () => {
    expect(MySQLTypes.map(hint => hint.name)).toEqual([
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

  it('omits the MariaDB-only FIXED and REAL aliases', () => {
    const names = MySQLTypes.map(hint => hint.name);

    expect(names).not.toContain('FIXED');
    expect(names).not.toContain('REAL');
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
    expect(namesOf('decimal')).toEqual(['DEC', 'DECIMAL', 'NUMERIC']);
    expect(namesOf('float')).toEqual(['FLOAT']);
    expect(namesOf('double')).toEqual(['DOUBLE PRECISION', 'DOUBLE']);
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

  it('resolves parameterised data types by prefix', () => {
    expect(resolvePrimitiveType('VARCHAR(255)')).toBe('string');
    expect(resolvePrimitiveType('bigint(20) unsigned')).toBe('long');
    expect(resolvePrimitiveType('ENUM("a","b")')).toBe('string');
    // SERIAL is a MySQL alias for BIGINT UNSIGNED but is not listed as a hint.
    expect(resolvePrimitiveType('SERIAL')).toBeUndefined();
    expect(resolvePrimitiveType('nope')).toBeUndefined();
  });

  it('resolves DATETIME and TIMESTAMP to dateTime despite their shorter prefixes', () => {
    // `DATE` and `TIME` come first, but the longest matching hint wins.
    expect(resolvePrimitiveType('DATETIME')).toBe('dateTime');
    expect(resolvePrimitiveType('TIMESTAMP')).toBe('dateTime');
    expect(resolvePrimitiveType('DATE')).toBe('date');
    expect(resolvePrimitiveType('TIME')).toBe('time');

    const extendingAnEarlierName = MySQLTypes.filter((hint, index) =>
      MySQLTypes.slice(0, index).some(
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
