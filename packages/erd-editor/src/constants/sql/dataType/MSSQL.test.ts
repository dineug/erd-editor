import { describe, expect, it } from 'vite-plus/test';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { MSSQLTypes } from '@/constants/sql/dataType/MSSQL';

/**
 * Mirrors getPrimitiveType in @/utils/generator-code/utils: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase().replace(/\([^)]*\)/g, '');
  let matched: DataTypeHint | undefined;

  for (const hint of MSSQLTypes) {
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
  return MSSQLTypes.filter(hint => hint.primitiveType === primitiveType).map(
    hint => hint.name
  );
}

describe('MSSQLTypes', () => {
  it('lists the 31 supported data types in lower case', () => {
    expect(MSSQLTypes).toHaveLength(48);

    for (const hint of MSSQLTypes) {
      expect(hint.name).toBe(hint.name.toLowerCase());
    }
  });

  it('keeps the documented order', () => {
    expect(MSSQLTypes.map(hint => hint.name)).toEqual([
      'bigint',
      'binary varying',
      'binary',
      'bit',
      'char varying',
      'char',
      'character varying',
      'character',
      'date',
      'datetime',
      'datetime2',
      'datetimeoffset',
      'dec',
      'decimal',
      'double precision',
      'float',
      'geography',
      'geometry',
      'hierarchyid',
      'image',
      'int',
      'integer',
      'json',
      'money',
      'national char varying',
      'national char',
      'national character varying',
      'national character',
      'national text',
      'nchar',
      'ntext',
      'numeric',
      'nvarchar',
      'real',
      'rowversion',
      'smalldatetime',
      'smallint',
      'smallmoney',
      'sql_variant',
      'text',
      'time',
      'timestamp',
      'tinyint',
      'uniqueidentifier',
      'varbinary',
      'varchar',
      'vector',
      'xml',
    ]);
  });

  it('classifies the numeric types', () => {
    expect(namesOf('long')).toEqual(['bigint']);
    expect(namesOf('int')).toEqual(['int', 'integer', 'smallint', 'tinyint']);
    expect(namesOf('decimal')).toEqual([
      'dec',
      'decimal',
      'money',
      'numeric',
      'smallmoney',
    ]);
    expect(namesOf('double')).toEqual(['double precision', 'float']);
    expect(namesOf('float')).toEqual(['real']);
  });

  it('classifies numeric and the money types as decimal, as decimal is', () => {
    expect(resolvePrimitiveType('numeric(18, 0)')).toBe('decimal');
    expect(resolvePrimitiveType('decimal(18, 0)')).toBe('decimal');
    expect(resolvePrimitiveType('money')).toBe('decimal');
    expect(resolvePrimitiveType('smallmoney')).toBe('decimal');
  });

  it('classifies bit as the flag SQL Server reads it as', () => {
    expect(resolvePrimitiveType('bit')).toBe('boolean');
    expect(namesOf('boolean')).toEqual(['bit']);
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
    expect(namesOf('lob')).toEqual([
      'image',
      'json',
      'national text',
      'ntext',
      'text',
      'xml',
    ]);
    expect(namesOf('string')).toEqual([
      'binary varying',
      'binary',
      'char varying',
      'char',
      'character varying',
      'character',
      'geography',
      'geometry',
      'hierarchyid',
      'national char varying',
      'national char',
      'national character varying',
      'national character',
      'nchar',
      'nvarchar',
      'rowversion',
      'sql_variant',
      'timestamp',
      'uniqueidentifier',
      'varbinary',
      'varchar',
      'vector',
    ]);
  });

  it('files binary as varbinary is, apart from the image large object', () => {
    const byName = new Map(
      MSSQLTypes.map(hint => [hint.name, hint.primitiveType])
    );

    expect(byName.get('binary')).toBe('string');
    expect(byName.get('varbinary')).toBe('string');
    expect(byName.get('image')).toBe('lob');
  });

  it('resolves parameterised data types by prefix', () => {
    expect(resolvePrimitiveType('nvarchar(max)')).toBe('string');
    expect(resolvePrimitiveType('VARCHAR(50)')).toBe('string');
    expect(resolvePrimitiveType('bigint')).toBe('long');
    expect(resolvePrimitiveType('rowversion')).toBe('string');
    expect(resolvePrimitiveType('national character varying(20)')).toBe(
      'string'
    );
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('resolves every datetime variant to dateTime despite the shorter date prefix', () => {
    // date comes first, but the longest matching hint wins.
    expect(resolvePrimitiveType('datetime')).toBe('dateTime');
    expect(resolvePrimitiveType('datetime2(7)')).toBe('dateTime');
    expect(resolvePrimitiveType('datetimeoffset')).toBe('dateTime');
    expect(resolvePrimitiveType('smalldatetime')).toBe('dateTime');
    // date itself keeps its own primitive type.
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
      { name: 'timestamp', primitiveType: 'string' },
    ]);

    for (const hint of extendingAnEarlierName) {
      expect(resolvePrimitiveType(hint.name)).toBe(hint.primitiveType);
    }
  });
});
