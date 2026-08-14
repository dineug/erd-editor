import { describe, expect, it } from 'vitest';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { OracleTypes } from '@/constants/sql/dataType/Oracle';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: the first hint
 * whose lowercased name is a prefix of the lowercased data type wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  return OracleTypes.find(
    hint =>
      dataType.toLocaleLowerCase().indexOf(hint.name.toLocaleLowerCase()) === 0
  )?.primitiveType;
}

function namesOf(primitiveType: PrimitiveType): string[] {
  return OracleTypes.filter(hint => hint.primitiveType === primitiveType).map(
    hint => hint.name
  );
}

describe('OracleTypes', () => {
  it('lists the 22 supported data types', () => {
    expect(OracleTypes).toHaveLength(22);
  });

  it('keeps the documented order', () => {
    expect(OracleTypes.map(hint => hint.name)).toEqual([
      'BFILE',
      'BINARY_DOUBLE',
      'BINARY_FLOAT',
      'BLOB',
      'CHAR',
      'CLOB',
      'DATE',
      'DATETIME',
      'LONG RAW',
      'LONG',
      'NCHAR',
      'NCLOB',
      'NUMBER',
      'NVARCHAR2',
      'RAW',
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP',
      'UriType',
      'VARCHAR',
      'VARCHAR2',
      'XMLType',
    ]);
  });

  it('keeps the two object-flavoured names in mixed case', () => {
    const mixedCase = OracleTypes.map(hint => hint.name).filter(
      name => name !== name.toUpperCase()
    );

    expect(mixedCase).toEqual(['UriType', 'XMLType']);
  });

  it('classifies NUMBER as long and the binary floats separately', () => {
    expect(namesOf('long')).toEqual(['NUMBER']);
    expect(namesOf('double')).toEqual(['BINARY_DOUBLE']);
    expect(namesOf('float')).toEqual(['BINARY_FLOAT']);
    expect(namesOf('int')).toEqual([]);
    expect(namesOf('decimal')).toEqual([]);
    expect(namesOf('boolean')).toEqual([]);
    expect(namesOf('time')).toEqual([]);
  });

  it('classifies the temporal types', () => {
    expect(namesOf('date')).toEqual(['DATE']);
    expect(namesOf('dateTime')).toEqual([
      'DATETIME',
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
      'LONG RAW',
      'LONG',
      'NCLOB',
      'RAW',
    ]);
    expect(namesOf('string')).toEqual([
      'CHAR',
      'NCHAR',
      'NVARCHAR2',
      'UriType',
      'VARCHAR',
      'VARCHAR2',
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
    expect(resolvePrimitiveType('rowid')).toBeUndefined();
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('shadows DATETIME behind the shorter DATE prefix', () => {
    expect(resolvePrimitiveType('DATETIME')).toBe('date');

    const shadowed = OracleTypes.filter((hint, index) =>
      OracleTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0 &&
          earlier.primitiveType !== hint.primitiveType
      )
    );

    expect(shadowed).toEqual<DataTypeHint[]>([
      { name: 'DATETIME', primitiveType: 'dateTime' },
    ]);
  });
});
