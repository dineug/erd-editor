import { describe, expect, it } from 'vite-plus/test';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { MariaDBTypes } from '@/constants/sql/dataType/MariaDB';

/**
 * Mirrors getPrimitiveType in @/utils/generator-code/utils: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase().replace(/\([^)]*\)/g, '');
  let matched: DataTypeHint | undefined;

  for (const hint of MariaDBTypes) {
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
  return MariaDBTypes.filter(hint => hint.primitiveType === primitiveType).map(
    hint => hint.name
  );
}

describe('MariaDBTypes', () => {
  it('lists the 45 supported data types in upper case', () => {
    expect(MariaDBTypes).toHaveLength(86);

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
      'CHAR BYTE',
      'CHAR VARYING',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'CLOB',
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
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'INET4',
      'INET6',
      'INT',
      'INT1',
      'INT2',
      'INT3',
      'INT4',
      'INT8',
      'INTEGER',
      'JSON',
      'LINESTRING',
      'LONG CHAR VARYING',
      'LONG CHARACTER VARYING',
      'LONG VARBINARY',
      'LONG VARCHAR',
      'LONG VARCHARACTER',
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
      'NATIONAL VARCHARACTER',
      'NCHAR VARCHAR',
      'NCHAR VARCHARACTER',
      'NCHAR VARYING',
      'NCHAR',
      'NUMBER',
      'NUMERIC',
      'NVARCHAR',
      'POINT',
      'POLYGON',
      'RAW',
      'REAL',
      'SERIAL',
      'SET',
      'SMALLINT',
      'SQL_TSI_YEAR',
      'TEXT',
      'TIME',
      'TIMESTAMP',
      'TINYBLOB',
      'TINYINT',
      'TINYTEXT',
      'UUID',
      'VARBINARY',
      'VARCHAR',
      'VARCHAR2',
      'VARCHARACTER',
      'VECTOR',
      'XMLTYPE',
      'YEAR',
    ]);
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
      'SQL_TSI_YEAR',
      'TINYINT',
      'YEAR',
    ]);
    expect(namesOf('decimal')).toEqual([
      'DEC',
      'DECIMAL',
      'FIXED',
      'NUMBER',
      'NUMERIC',
    ]);
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
      'CLOB',
      'JSON',
      'LONG CHAR VARYING',
      'LONG CHARACTER VARYING',
      'LONG VARBINARY',
      'LONG VARCHAR',
      'LONG VARCHARACTER',
      'LONG',
      'LONGBLOB',
      'LONGTEXT',
      'MEDIUMBLOB',
      'MEDIUMTEXT',
      'TEXT',
      'TINYBLOB',
      'TINYTEXT',
      'XMLTYPE',
    ]);
  });

  it('treats the spatial and character types as strings', () => {
    expect(namesOf('string')).toEqual([
      'BINARY',
      'CHAR BYTE',
      'CHAR VARYING',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'ENUM',
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'INET4',
      'INET6',
      'LINESTRING',
      'MULTILINESTRING',
      'MULTIPOINT',
      'MULTIPOLYGON',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NATIONAL VARCHAR',
      'NATIONAL VARCHARACTER',
      'NCHAR VARCHAR',
      'NCHAR VARCHARACTER',
      'NCHAR VARYING',
      'NCHAR',
      'NVARCHAR',
      'POINT',
      'POLYGON',
      'RAW',
      'SET',
      'UUID',
      'VARBINARY',
      'VARCHAR',
      'VARCHAR2',
      'VARCHARACTER',
      'VECTOR',
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
    // DATE and TIME come first, but the longest matching hint wins.
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
      { name: 'FLOAT8', primitiveType: 'double' },
      { name: 'INT8', primitiveType: 'long' },
      { name: 'TIMESTAMP', primitiveType: 'dateTime' },
    ]);

    for (const hint of extendingAnEarlierName) {
      expect(resolvePrimitiveType(hint.name)).toBe(hint.primitiveType);
    }
  });
});
