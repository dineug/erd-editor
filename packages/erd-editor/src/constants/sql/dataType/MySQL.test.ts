import { describe, expect, it } from 'vite-plus/test';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { MySQLTypes } from '@/constants/sql/dataType/MySQL';

/**
 * Mirrors getPrimitiveType in @/utils/generator-code/utils: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase().replace(/\([^)]*\)/g, '');
  let matched: DataTypeHint | undefined;

  for (const hint of MySQLTypes) {
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

function namesOf(primitiveType: PrimitiveType): string[] {
  return MySQLTypes.filter(hint => hint.primitiveType === primitiveType).map(
    hint => hint.name
  );
}

describe('MySQLTypes', () => {
  it('lists the 43 supported data types in upper case', () => {
    expect(MySQLTypes).toHaveLength(70);

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
      'CHAR BYTE',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'DATE',
      'DATETIME',
      'DEC',
      'DECIMAL',
      'DOUBLE PRECISION',
      'DOUBLE',
      'ENUM',
      'FIXED',
      'FLOAT',
      'FLOAT4',
      'FLOAT8',
      'GEOMCOLLECTION',
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'INT',
      'INT1',
      'INT2',
      'INT3',
      'INT4',
      'INT8',
      'INTEGER',
      'JSON',
      'LINESTRING',
      'LONG VARBINARY',
      'LONG VARCHAR',
      'LONG',
      'LONGBLOB',
      'LONGTEXT',
      'MEDIUMBLOB',
      'MEDIUMINT',
      'MEDIUMTEXT',
      'MIDDLEINT',
      'MULTILINESTRING',
      'MULTIPOINT',
      'MULTIPOLYGON',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NATIONAL VARCHAR',
      'NCHAR VARCHAR',
      'NCHAR',
      'NUMERIC',
      'NVARCHAR',
      'POINT',
      'POLYGON',
      'REAL',
      'SERIAL',
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
      'VARCHARACTER',
      'YEAR',
    ]);
  });

  it('omits the types MariaDB adds on top of MySQL', () => {
    const names = MySQLTypes.map(hint => hint.name);

    expect(names).not.toContain('NUMBER');
    expect(names).not.toContain('VARCHAR2');
    expect(names).not.toContain('UUID');
    expect(names).not.toContain('INET6');
  });

  it('classifies the numeric types', () => {
    expect(namesOf('long')).toEqual(['BIGINT', 'INT8', 'SERIAL']);
    expect(namesOf('int')).toEqual([
      'BIT',
      'INT',
      'INT1',
      'INT2',
      'INT3',
      'INT4',
      'INTEGER',
      'MEDIUMINT',
      'MIDDLEINT',
      'SMALLINT',
      'TINYINT',
      'YEAR',
    ]);
    expect(namesOf('decimal')).toEqual(['DEC', 'DECIMAL', 'FIXED', 'NUMERIC']);
    expect(namesOf('float')).toEqual(['FLOAT', 'FLOAT4']);
    expect(namesOf('double')).toEqual([
      'DOUBLE PRECISION',
      'DOUBLE',
      'FLOAT8',
      'REAL',
    ]);
  });

  it('classifies the boolean, temporal and large object types', () => {
    expect(namesOf('boolean')).toEqual(['BOOL', 'BOOLEAN']);
    expect(namesOf('date')).toEqual(['DATE']);
    expect(namesOf('dateTime')).toEqual(['DATETIME', 'TIMESTAMP']);
    expect(namesOf('time')).toEqual(['TIME']);
    expect(namesOf('lob')).toEqual([
      'BLOB',
      'JSON',
      'LONG VARBINARY',
      'LONG VARCHAR',
      'LONG',
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
      'CHAR BYTE',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'ENUM',
      'GEOMCOLLECTION',
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'LINESTRING',
      'MULTILINESTRING',
      'MULTIPOINT',
      'MULTIPOLYGON',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NATIONAL VARCHAR',
      'NCHAR VARCHAR',
      'NCHAR',
      'NVARCHAR',
      'POINT',
      'POLYGON',
      'SET',
      'VARBINARY',
      'VARCHAR',
      'VARCHARACTER',
    ]);
  });

  it('resolves parameterised data types by prefix', () => {
    expect(resolvePrimitiveType('VARCHAR(255)')).toBe('string');
    expect(resolvePrimitiveType('bigint(20) unsigned')).toBe('long');
    expect(resolvePrimitiveType('ENUM("a","b")')).toBe('string');
    // SERIAL is a MySQL alias for BIGINT UNSIGNED NOT NULL AUTO_INCREMENT.
    expect(resolvePrimitiveType('SERIAL')).toBe('long');
    expect(resolvePrimitiveType('nope')).toBeUndefined();
  });

  it('resolves DATETIME and TIMESTAMP to dateTime despite their shorter prefixes', () => {
    // DATE and TIME come first, but the longest matching hint wins.
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
      { name: 'FLOAT8', primitiveType: 'double' },
      { name: 'INT8', primitiveType: 'long' },
      { name: 'TIMESTAMP', primitiveType: 'dateTime' },
    ]);

    for (const hint of extendingAnEarlierName) {
      expect(resolvePrimitiveType(hint.name)).toBe(hint.primitiveType);
    }
  });
});
