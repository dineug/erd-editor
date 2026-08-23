import { describe, expect, it } from 'vite-plus/test';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { OracleTypes } from '@/constants/sql/dataType/Oracle';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase().replace(/\([^)]*\)/g, '');
  let matched: DataTypeHint | undefined;

  for (const hint of OracleTypes) {
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
  return OracleTypes.filter(hint => hint.primitiveType === primitiveType).map(
    hint => hint.name
  );
}

describe('OracleTypes', () => {
  it('lists the 22 supported data types', () => {
    expect(OracleTypes).toHaveLength(51);
  });

  it('keeps the documented order', () => {
    expect(OracleTypes.map(hint => hint.name)).toEqual([
      'ANYDATA',
      'BFILE',
      'BINARY_DOUBLE',
      'BINARY_FLOAT',
      'BLOB',
      'BOOL',
      'BOOLEAN',
      'CHAR VARYING',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'CLOB',
      'DATE',
      'DEC',
      'DECIMAL',
      'DOUBLE PRECISION',
      'FLOAT',
      'INT',
      'INTEGER',
      'INTERVAL DAY TO SECOND',
      'INTERVAL YEAR TO MONTH',
      'JSON',
      'LONG RAW',
      'LONG VARCHAR',
      'LONG',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NCHAR VARYING',
      'NCHAR',
      'NCLOB',
      'NUMBER',
      'NUMERIC',
      'NVARCHAR2',
      'RAW',
      'REAL',
      'ROWID',
      'SDO_GEOMETRY',
      'SDO_GEORASTER',
      'SDO_TOPO_GEOMETRY',
      'SMALLINT',
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP',
      'URIType',
      'UROWID',
      'VARCHAR',
      'VARCHAR2',
      'VECTOR',
      'XMLType',
    ]);
  });

  it('keeps the two object-flavoured names in mixed case', () => {
    const mixedCase = OracleTypes.map(hint => hint.name).filter(
      name => name !== name.toUpperCase()
    );

    expect(mixedCase).toEqual(['URIType', 'XMLType']);
  });

  it('classifies NUMBER as long and the binary floats separately', () => {
    expect(namesOf('long')).toEqual(['NUMBER']);
    expect(namesOf('double')).toEqual([
      'BINARY_DOUBLE',
      'DOUBLE PRECISION',
      'FLOAT',
    ]);
    expect(namesOf('float')).toEqual(['BINARY_FLOAT', 'REAL']);
    expect(namesOf('int')).toEqual(['INT', 'INTEGER', 'SMALLINT']);
    expect(namesOf('decimal')).toEqual(['DEC', 'DECIMAL', 'NUMERIC']);
    expect(namesOf('boolean')).toEqual(['BOOL', 'BOOLEAN']);
    expect(namesOf('time')).toEqual([
      'INTERVAL DAY TO SECOND',
      'INTERVAL YEAR TO MONTH',
    ]);
  });

  it('classifies the temporal types', () => {
    expect(namesOf('date')).toEqual(['DATE']);
    expect(namesOf('dateTime')).toEqual([
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP',
    ]);
  });

  it('classifies the large object and string types', () => {
    expect(namesOf('lob')).toEqual([
      'BFILE',
      'BLOB',
      'CLOB',
      'JSON',
      'LONG RAW',
      'LONG VARCHAR',
      'LONG',
      'NCLOB',
      'RAW',
    ]);
    expect(namesOf('string')).toEqual([
      'ANYDATA',
      'CHAR VARYING',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NCHAR VARYING',
      'NCHAR',
      'NVARCHAR2',
      'ROWID',
      'SDO_GEOMETRY',
      'SDO_GEORASTER',
      'SDO_TOPO_GEOMETRY',
      'URIType',
      'UROWID',
      'VARCHAR',
      'VARCHAR2',
      'VECTOR',
      'XMLType',
    ]);
  });

  it('orders the longest TIMESTAMP variant first so each one resolves', () => {
    const names = OracleTypes.map(hint => hint.name);

    expect(names.indexOf('TIMESTAMP WITH LOCAL TIME ZONE')).toBeLessThan(
      names.indexOf('TIMESTAMP WITH TIME ZONE')
    );
    expect(names.indexOf('TIMESTAMP WITH TIME ZONE')).toBeLessThan(
      names.indexOf('TIMESTAMP')
    );

    expect(resolvePrimitiveType('TIMESTAMP(6) WITH TIME ZONE')).toBe(
      'dateTime'
    );
    expect(resolvePrimitiveType('timestamp with local time zone')).toBe(
      'dateTime'
    );
  });

  it('orders "LONG RAW" before "LONG"', () => {
    const names = OracleTypes.map(hint => hint.name);

    expect(names.indexOf('LONG RAW')).toBeLessThan(names.indexOf('LONG'));
    expect(resolvePrimitiveType('LONG RAW')).toBe('lob');
    expect(resolvePrimitiveType('LONG')).toBe('lob');
  });

  it('resolves parameterised data types by prefix', () => {
    expect(resolvePrimitiveType('VARCHAR2(4000 CHAR)')).toBe('string');
    expect(resolvePrimitiveType('NUMBER(10, 2)')).toBe('long');
    expect(resolvePrimitiveType('rowid')).toBe('string');
    expect(resolvePrimitiveType('interval day(2) to second(6)')).toBe('time');
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('resolves a longer name past the shorter one that prefixes it', () => {
    expect(resolvePrimitiveType('DATE')).toBe('date');
    // Oracle has no DATETIME; the doc's datetime types are DATE, TIMESTAMP and
    // the two INTERVAL forms.
    expect(resolvePrimitiveType('DATETIME')).toBeUndefined();

    const extendingAnEarlierName = OracleTypes.filter((hint, index) =>
      OracleTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0 &&
          earlier.primitiveType !== hint.primitiveType
      )
    );

    expect(extendingAnEarlierName).toEqual<DataTypeHint[]>([
      { name: 'INTERVAL DAY TO SECOND', primitiveType: 'time' },
      { name: 'INTERVAL YEAR TO MONTH', primitiveType: 'time' },
    ]);

    for (const hint of extendingAnEarlierName) {
      expect(resolvePrimitiveType(hint.name)).toBe(hint.primitiveType);
    }
  });
});
