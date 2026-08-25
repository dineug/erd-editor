import { describe, expect, it } from 'vite-plus/test';

import { Database } from '@/constants/schema';
import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { SnowflakeTypes } from '@/constants/sql/dataType/Snowflake';
import { getPrimitiveType } from '@/utils/generator-code/utils';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 * Unlike the real one this reports a miss instead of falling back to `string`.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase().replace(/\([^)]*\)/g, '');
  let matched: DataTypeHint | undefined;

  for (const hint of SnowflakeTypes) {
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
  return SnowflakeTypes.filter(
    hint => hint.primitiveType === primitiveType
  ).map(hint => hint.name);
}

/**
 * `SnowflakeTypes` in `@dineug/schema-sql-parser` holds the same names without
 * the primitive types, but that package exports only `schemaSQLParser` from its
 * entry point, so the parser side cannot be imported here — it is repeated as a
 * literal and the two lists have to be edited together.
 */
const PARSER_NAMES = [
  'ARRAY',
  'BIGINT',
  'BINARY',
  'BOOLEAN',
  'BYTEINT',
  'CHAR VARYING',
  'CHAR',
  'CHARACTER',
  'DATE',
  'DATETIME',
  'DEC',
  'DECFLOAT',
  'DECIMAL',
  'DOUBLE PRECISION',
  'DOUBLE',
  'FILE',
  'FLOAT',
  'FLOAT4',
  'FLOAT8',
  'GEOGRAPHY',
  'GEOMETRY',
  'INT',
  'INTEGER',
  'MAP',
  'NCHAR VARYING',
  'NCHAR',
  'NUMBER',
  'NUMERIC',
  'NVARCHAR',
  'NVARCHAR2',
  'OBJECT',
  'REAL',
  'SMALLINT',
  'STRING',
  'TEXT',
  'TIME',
  'TIMESTAMP WITH LOCAL TIME ZONE',
  'TIMESTAMP WITH TIME ZONE',
  'TIMESTAMP WITHOUT TIME ZONE',
  'TIMESTAMP_LTZ',
  'TIMESTAMP_NTZ',
  'TIMESTAMP_TZ',
  'TIMESTAMP',
  'TIMESTAMPLTZ',
  'TIMESTAMPNTZ',
  'TIMESTAMPTZ',
  'TINYINT',
  'UNKNOWN',
  'UUID',
  'VARBINARY',
  'VARCHAR',
  'VARCHAR2',
  'VARIANT',
  'VECTOR',
];

describe('SnowflakeTypes', () => {
  it('lists the supported data types in upper case', () => {
    expect(SnowflakeTypes).toHaveLength(54);

    for (const hint of SnowflakeTypes) {
      expect(hint.name).toBe(hint.name.toUpperCase());
    }
  });

  it('keeps the documented order', () => {
    expect(SnowflakeTypes.map(hint => hint.name)).toEqual(PARSER_NAMES);
  });

  it('never repeats a name', () => {
    const names = SnowflakeTypes.map(hint => hint.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('holds the same name set the SQL parser accepts', () => {
    expect([...SnowflakeTypes.map(hint => hint.name)].sort()).toEqual(
      [...PARSER_NAMES].sort()
    );
  });

  it('only carries primitive types generator-code knows', () => {
    const primitiveTypes = new Set<string>(Object.values(PrimitiveType));

    for (const hint of SnowflakeTypes) {
      expect(primitiveTypes.has(hint.primitiveType)).toBe(true);
    }
  });

  it('classifies the numeric types', () => {
    expect(namesOf('int')).toEqual([
      'BYTEINT',
      'INT',
      'INTEGER',
      'SMALLINT',
      'TINYINT',
    ]);
    expect(namesOf('long')).toEqual(['BIGINT', 'NUMBER']);
    expect(namesOf('float')).toEqual([]);
    expect(namesOf('double')).toEqual([
      'DOUBLE PRECISION',
      'DOUBLE',
      'FLOAT',
      'FLOAT4',
      'FLOAT8',
      'REAL',
    ]);
    expect(namesOf('decimal')).toEqual([
      'DEC',
      'DECFLOAT',
      'DECIMAL',
      'NUMERIC',
    ]);
    expect(namesOf('boolean')).toEqual(['BOOLEAN']);
  });

  it('classifies the temporal types', () => {
    expect(namesOf('date')).toEqual(['DATE']);
    expect(namesOf('dateTime')).toEqual([
      'DATETIME',
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP WITHOUT TIME ZONE',
      'TIMESTAMP_LTZ',
      'TIMESTAMP_NTZ',
      'TIMESTAMP_TZ',
      'TIMESTAMP',
      'TIMESTAMPLTZ',
      'TIMESTAMPNTZ',
      'TIMESTAMPTZ',
    ]);
    expect(namesOf('time')).toEqual(['TIME']);
  });

  it('treats the binary types as large objects and the rest as strings', () => {
    expect(namesOf('lob')).toEqual(['BINARY', 'VARBINARY']);
    expect(namesOf('string')).toEqual([
      'ARRAY',
      'CHAR VARYING',
      'CHAR',
      'CHARACTER',
      'FILE',
      'GEOGRAPHY',
      'GEOMETRY',
      'MAP',
      'NCHAR VARYING',
      'NCHAR',
      'NVARCHAR',
      'NVARCHAR2',
      'OBJECT',
      'STRING',
      'TEXT',
      'UNKNOWN',
      'UUID',
      'VARCHAR',
      'VARCHAR2',
      'VARIANT',
      'VECTOR',
    ]);
  });

  it('lists a qualified name before the shorter name it extends', () => {
    const names = SnowflakeTypes.map(hint => hint.name);

    for (const [index, name] of names.entries()) {
      for (const [otherIndex, other] of names.entries()) {
        const extendsOther =
          name.length > other.length &&
          name.indexOf(other) === 0 &&
          /[^0-9A-Za-z]/.test(name.charAt(other.length));

        if (extendsOther) {
          expect(index).toBeLessThan(otherIndex);
        }
      }
    }

    expect(names.indexOf('CHAR VARYING')).toBeLessThan(names.indexOf('CHAR'));
    expect(names.indexOf('DOUBLE PRECISION')).toBeLessThan(
      names.indexOf('DOUBLE')
    );
    expect(names.indexOf('TIMESTAMP WITH TIME ZONE')).toBeLessThan(
      names.indexOf('TIMESTAMP')
    );
    expect(names.indexOf('TIMESTAMP_TZ')).toBeLessThan(
      names.indexOf('TIMESTAMP')
    );
  });

  it('sorts the remaining names alphabetically', () => {
    const names = SnowflakeTypes.map(hint => hint.name).filter(
      name =>
        !SnowflakeTypes.some(
          hint =>
            hint.name.length < name.length &&
            name.indexOf(hint.name) === 0 &&
            /[^0-9A-Za-z]/.test(name.charAt(hint.name.length))
        )
    );

    expect(names).toEqual([...names].sort());
  });

  it('resolves parameterised data types by prefix', () => {
    expect(resolvePrimitiveType('NUMBER(38,0)')).toBe('long');
    expect(resolvePrimitiveType('varchar(16777216)')).toBe('string');
    expect(resolvePrimitiveType('TIMESTAMP_NTZ(9)')).toBe('dateTime');
    expect(resolvePrimitiveType('VECTOR(FLOAT, 3)')).toBe('string');
    expect(resolvePrimitiveType('nope')).toBeUndefined();
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('resolves every name it lists back to its own primitive type', () => {
    for (const hint of SnowflakeTypes) {
      expect(resolvePrimitiveType(hint.name)).toBe(hint.primitiveType);
    }
  });

  it('keeps a longer name from being claimed by the one it extends', () => {
    expect(getPrimitiveType('NUMBER', Database.Snowflake)).toBe('long');
    expect(getPrimitiveType('DATETIME', Database.Snowflake)).toBe('dateTime');
    expect(getPrimitiveType('TIMESTAMP_TZ', Database.Snowflake)).toBe(
      'dateTime'
    );
    expect(getPrimitiveType('TIMESTAMPLTZ', Database.Snowflake)).toBe(
      'dateTime'
    );
    expect(getPrimitiveType('FLOAT4', Database.Snowflake)).toBe('double');
    expect(getPrimitiveType('NVARCHAR2', Database.Snowflake)).toBe('string');

    const extendingAnEarlierName = SnowflakeTypes.filter((hint, index) =>
      SnowflakeTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0 &&
          earlier.primitiveType !== hint.primitiveType
      )
    );

    expect(extendingAnEarlierName).toEqual<DataTypeHint[]>([
      { name: 'DATETIME', primitiveType: 'dateTime' },
      { name: 'TIMESTAMP WITH LOCAL TIME ZONE', primitiveType: 'dateTime' },
      { name: 'TIMESTAMP WITH TIME ZONE', primitiveType: 'dateTime' },
      { name: 'TIMESTAMP WITHOUT TIME ZONE', primitiveType: 'dateTime' },
      { name: 'TIMESTAMP_LTZ', primitiveType: 'dateTime' },
      { name: 'TIMESTAMP_NTZ', primitiveType: 'dateTime' },
      { name: 'TIMESTAMP_TZ', primitiveType: 'dateTime' },
      { name: 'TIMESTAMP', primitiveType: 'dateTime' },
      { name: 'TIMESTAMPLTZ', primitiveType: 'dateTime' },
      { name: 'TIMESTAMPNTZ', primitiveType: 'dateTime' },
      { name: 'TIMESTAMPTZ', primitiveType: 'dateTime' },
    ]);

    for (const hint of extendingAnEarlierName) {
      expect(getPrimitiveType(hint.name, Database.Snowflake)).toBe(
        hint.primitiveType
      );
    }
  });
});
