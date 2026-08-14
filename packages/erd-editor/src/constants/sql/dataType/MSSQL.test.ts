import { describe, expect, it } from 'vitest';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { MSSQLTypes } from '@/constants/sql/dataType/MSSQL';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase();
  let matched: DataTypeHint | undefined;

  for (const hint of MSSQLTypes) {
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
  return MSSQLTypes.filter(hint => hint.primitiveType === primitiveType).map(
    hint => hint.name
  );
}

describe('MSSQLTypes', () => {
  it('lists the 31 supported data types in lower case', () => {
    expect(MSSQLTypes).toHaveLength(31);

    for (const hint of MSSQLTypes) {
      expect(hint.name).toBe(hint.name.toLowerCase());
    }
  });

  it('keeps the documented order', () => {
    expect(MSSQLTypes.map(hint => hint.name)).toEqual([
      'bigint',
      'binary',
      'bit',
      'char',
      'date',
      'datetime',
      'datetime2',
      'datetimeoffset',
      'decimal',
      'float',
      'geography',
      'geometry',
      'image',
      'int',
      'money',
      'nchar',
      'ntext',
      'numeric',
      'nvarchar',
      'real',
      'smalldatetime',
      'smallint',
      'smallmoney',
      'sql_variant',
      'text',
      'time',
      'tinyint',
      'uniqueidentifier',
      'varbinary',
      'varchar',
      'xml',
    ]);
  });

  it('classifies the numeric types', () => {
    expect(namesOf('long')).toEqual(['bigint']);
    expect(namesOf('int')).toEqual(['bit', 'int', 'smallint', 'tinyint']);
    expect(namesOf('decimal')).toEqual(['decimal']);
    expect(namesOf('double')).toEqual(['float', 'money']);
    expect(namesOf('float')).toEqual(['numeric', 'real', 'smallmoney']);
  });

  it('classifies numeric as float and decimal as decimal', () => {
    // Unlike every other vendor list, MSSQL maps `numeric` to float rather
    // than decimal.
    expect(resolvePrimitiveType('numeric(18, 0)')).toBe('float');
    expect(resolvePrimitiveType('decimal(18, 0)')).toBe('decimal');
  });

  it('classifies the temporal types', () => {
    expect(namesOf('date')).toEqual(['date']);
    expect(namesOf('dateTime')).toEqual([
      'datetime',
      'datetime2',
      'datetimeoffset',
      'smalldatetime',
    ]);
    expect(namesOf('time')).toEqual(['time']);
  });

  it('classifies the large object and string types', () => {
    expect(namesOf('lob')).toEqual(['binary', 'image', 'ntext', 'text', 'xml']);
    expect(namesOf('string')).toEqual([
      'char',
      'geography',
      'geometry',
      'nchar',
      'nvarchar',
      'sql_variant',
      'uniqueidentifier',
      'varbinary',
      'varchar',
    ]);
  });

  it('maps binary to lob but varbinary to string', () => {
    const byName = new Map(
      MSSQLTypes.map(hint => [hint.name, hint.primitiveType])
    );

    expect(byName.get('binary')).toBe('lob');
    expect(byName.get('varbinary')).toBe('string');
  });

  it('resolves parameterised data types by prefix', () => {
    expect(resolvePrimitiveType('nvarchar(max)')).toBe('string');
    expect(resolvePrimitiveType('VARCHAR(50)')).toBe('string');
    expect(resolvePrimitiveType('bigint')).toBe('long');
    expect(resolvePrimitiveType('rowversion')).toBeUndefined();
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('resolves every datetime variant to dateTime despite the shorter date prefix', () => {
    // `date` comes first, but the longest matching hint wins.
    expect(resolvePrimitiveType('datetime')).toBe('dateTime');
    expect(resolvePrimitiveType('datetime2(7)')).toBe('dateTime');
    expect(resolvePrimitiveType('datetimeoffset')).toBe('dateTime');
    expect(resolvePrimitiveType('smalldatetime')).toBe('dateTime');
    // `date` itself keeps its own primitive type.
    expect(resolvePrimitiveType('date')).toBe('date');

    const extendingAnEarlierName = MSSQLTypes.filter((hint, index) =>
      MSSQLTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0 &&
          earlier.primitiveType !== hint.primitiveType
      )
    );

    expect(extendingAnEarlierName).toEqual<DataTypeHint[]>([
      { name: 'datetime', primitiveType: 'dateTime' },
      { name: 'datetime2', primitiveType: 'dateTime' },
      { name: 'datetimeoffset', primitiveType: 'dateTime' },
    ]);

    for (const hint of extendingAnEarlierName) {
      expect(resolvePrimitiveType(hint.name)).toBe(hint.primitiveType);
    }
  });
});
