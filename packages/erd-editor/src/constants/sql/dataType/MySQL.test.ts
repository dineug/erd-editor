import { describe, expect, it } from 'vitest';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { MySQLTypes } from '@/constants/sql/dataType/MySQL';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: the first hint
 * whose lowercased name is a prefix of the lowercased data type wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  return MySQLTypes.find(
    hint =>
      dataType.toLocaleLowerCase().indexOf(hint.name.toLocaleLowerCase()) === 0
  )?.primitiveType;
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

  it('shadows DATETIME and TIMESTAMP behind their shorter prefixes', () => {
    // Known quirk: `DATE` and `TIME` come first, so prefix matching never
    // reaches the dateTime entries below them.
    expect(resolvePrimitiveType('DATETIME')).toBe('date');
    expect(resolvePrimitiveType('TIMESTAMP')).toBe('time');

    const shadowed = MySQLTypes.filter((hint, index) =>
      MySQLTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0 &&
          earlier.primitiveType !== hint.primitiveType
      )
    );

    expect(shadowed).toEqual<DataTypeHint[]>([
      { name: 'DATETIME', primitiveType: 'dateTime' },
      { name: 'TIMESTAMP', primitiveType: 'dateTime' },
    ]);
  });
});
