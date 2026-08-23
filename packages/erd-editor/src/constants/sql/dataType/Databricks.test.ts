import { describe, expect, it } from 'vite-plus/test';

import { Database } from '@/constants/schema';
import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { DatabricksTypes } from '@/constants/sql/dataType/Databricks';
import { getPrimitiveType } from '@/utils/generator-code/utils';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 * Unlike the real one this reports a miss instead of falling back to `string`.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase().replace(/\([^)]*\)/g, '');
  let matched: DataTypeHint | undefined;

  for (const hint of DatabricksTypes) {
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
  return DatabricksTypes.filter(
    hint => hint.primitiveType === primitiveType
  ).map(hint => hint.name);
}

/**
 * `DatabricksTypes` in `@dineug/schema-sql-parser` holds the same names without
 * the primitive types, but that package exports only `schemaSQLParser` from its
 * entry point, so the parser side cannot be imported here — it is repeated as a
 * literal and the two lists have to be edited together.
 */
const PARSER_NAMES = [
  'ARRAY',
  'BIGINT',
  'BINARY',
  'BOOLEAN',
  'BYTE',
  'CHAR',
  'DATE',
  'DEC',
  'DECIMAL',
  'DOUBLE',
  'FLOAT',
  'GEOGRAPHY',
  'GEOMETRY',
  'INT',
  'INTEGER',
  'INTERVAL DAY TO HOUR',
  'INTERVAL DAY TO MINUTE',
  'INTERVAL DAY TO SECOND',
  'INTERVAL DAY',
  'INTERVAL HOUR TO MINUTE',
  'INTERVAL HOUR TO SECOND',
  'INTERVAL HOUR',
  'INTERVAL MINUTE TO SECOND',
  'INTERVAL MINUTE',
  'INTERVAL MONTH',
  'INTERVAL SECOND',
  'INTERVAL YEAR TO MONTH',
  'INTERVAL YEAR',
  'INTERVAL',
  'LONG',
  'MAP',
  'NUMERIC',
  'OBJECT',
  'REAL',
  'SHORT',
  'SMALLINT',
  'STRING',
  'STRUCT',
  'TIMESTAMP_LTZ',
  'TIMESTAMP_NTZ',
  'TIMESTAMP',
  'TINYINT',
  'VARCHAR',
  'VARIANT',
  'VOID',
];

describe('DatabricksTypes', () => {
  it('lists the supported data types in upper case', () => {
    expect(DatabricksTypes).toHaveLength(45);

    for (const hint of DatabricksTypes) {
      expect(hint.name).toBe(hint.name.toUpperCase());
    }
  });

  it('keeps the documented order', () => {
    expect(DatabricksTypes.map(hint => hint.name)).toEqual(PARSER_NAMES);
  });

  it('never repeats a name', () => {
    const names = DatabricksTypes.map(hint => hint.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('holds the same name set the SQL parser accepts', () => {
    expect([...DatabricksTypes.map(hint => hint.name)].sort()).toEqual(
      [...PARSER_NAMES].sort()
    );
  });

  it('only carries primitive types generator-code knows', () => {
    const primitiveTypes = new Set<string>(Object.values(PrimitiveType));

    for (const hint of DatabricksTypes) {
      expect(primitiveTypes.has(hint.primitiveType)).toBe(true);
    }
  });

  it('classifies the numeric types', () => {
    expect(namesOf('int')).toEqual([
      'BYTE',
      'INT',
      'INTEGER',
      'SHORT',
      'SMALLINT',
      'TINYINT',
    ]);
    expect(namesOf('long')).toEqual(['BIGINT', 'LONG']);
    expect(namesOf('float')).toEqual(['FLOAT', 'REAL']);
    expect(namesOf('double')).toEqual(['DOUBLE']);
    expect(namesOf('decimal')).toEqual(['DEC', 'DECIMAL', 'NUMERIC']);
    expect(namesOf('boolean')).toEqual(['BOOLEAN']);
  });

  it('classifies the temporal types', () => {
    expect(namesOf('date')).toEqual(['DATE']);
    expect(namesOf('dateTime')).toEqual([
      'TIMESTAMP_LTZ',
      'TIMESTAMP_NTZ',
      'TIMESTAMP',
    ]);
    expect(namesOf('time')).toEqual([
      'INTERVAL DAY TO HOUR',
      'INTERVAL DAY TO MINUTE',
      'INTERVAL DAY TO SECOND',
      'INTERVAL DAY',
      'INTERVAL HOUR TO MINUTE',
      'INTERVAL HOUR TO SECOND',
      'INTERVAL HOUR',
      'INTERVAL MINUTE TO SECOND',
      'INTERVAL MINUTE',
      'INTERVAL MONTH',
      'INTERVAL SECOND',
      'INTERVAL YEAR TO MONTH',
      'INTERVAL YEAR',
      'INTERVAL',
    ]);
  });

  it('treats BINARY as the only large object and the complex types as strings', () => {
    expect(namesOf('lob')).toEqual(['BINARY']);
    expect(namesOf('string')).toEqual([
      'ARRAY',
      'CHAR',
      'GEOGRAPHY',
      'GEOMETRY',
      'MAP',
      'OBJECT',
      'STRING',
      'STRUCT',
      'VARCHAR',
      'VARIANT',
      'VOID',
    ]);
  });

  it('lists a qualified name before the shorter name it extends', () => {
    const names = DatabricksTypes.map(hint => hint.name);

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

    expect(names.indexOf('INTERVAL DAY TO SECOND')).toBeLessThan(
      names.indexOf('INTERVAL DAY')
    );
    expect(names.indexOf('INTERVAL DAY')).toBeLessThan(
      names.indexOf('INTERVAL')
    );
    expect(names.indexOf('TIMESTAMP_NTZ')).toBeLessThan(
      names.indexOf('TIMESTAMP')
    );
  });

  it('sorts the remaining names alphabetically', () => {
    const names = DatabricksTypes.map(hint => hint.name).filter(
      name =>
        !DatabricksTypes.some(
          hint =>
            hint.name.length < name.length &&
            name.indexOf(hint.name) === 0 &&
            /[^0-9A-Za-z]/.test(name.charAt(hint.name.length))
        )
    );

    expect(names).toEqual([...names].sort());
  });

  it('resolves parameterised data types by prefix', () => {
    expect(resolvePrimitiveType('DECIMAL(10,2)')).toBe('decimal');
    expect(resolvePrimitiveType('varchar(255)')).toBe('string');
    expect(resolvePrimitiveType('ARRAY<STRING>')).toBe('string');
    expect(resolvePrimitiveType('interval day(2) to second(6)')).toBe('time');
    expect(resolvePrimitiveType('nope')).toBeUndefined();
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('resolves the intervals and the zoned timestamps past their shorter prefixes', () => {
    // `INT` and `TIMESTAMP` are listed before the names that extend them, but
    // the longest matching hint wins and only on a word boundary.
    expect(
      getPrimitiveType('INTERVAL DAY TO SECOND', Database.Databricks)
    ).toBe('time');
    expect(getPrimitiveType('INTERVAL', Database.Databricks)).toBe('time');
    expect(getPrimitiveType('INTEGER', Database.Databricks)).toBe('int');
    expect(getPrimitiveType('INT', Database.Databricks)).toBe('int');
    expect(getPrimitiveType('TIMESTAMP_NTZ', Database.Databricks)).toBe(
      'dateTime'
    );
    expect(getPrimitiveType('TIMESTAMP_LTZ', Database.Databricks)).toBe(
      'dateTime'
    );
    expect(getPrimitiveType('TIMESTAMP', Database.Databricks)).toBe('dateTime');

    const extendingAnEarlierName = DatabricksTypes.filter((hint, index) =>
      DatabricksTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0 &&
          earlier.primitiveType !== hint.primitiveType
      )
    );

    expect(extendingAnEarlierName).toEqual<DataTypeHint[]>([
      { name: 'INTERVAL DAY TO HOUR', primitiveType: 'time' },
      { name: 'INTERVAL DAY TO MINUTE', primitiveType: 'time' },
      { name: 'INTERVAL DAY TO SECOND', primitiveType: 'time' },
      { name: 'INTERVAL DAY', primitiveType: 'time' },
      { name: 'INTERVAL HOUR TO MINUTE', primitiveType: 'time' },
      { name: 'INTERVAL HOUR TO SECOND', primitiveType: 'time' },
      { name: 'INTERVAL HOUR', primitiveType: 'time' },
      { name: 'INTERVAL MINUTE TO SECOND', primitiveType: 'time' },
      { name: 'INTERVAL MINUTE', primitiveType: 'time' },
      { name: 'INTERVAL MONTH', primitiveType: 'time' },
      { name: 'INTERVAL SECOND', primitiveType: 'time' },
      { name: 'INTERVAL YEAR TO MONTH', primitiveType: 'time' },
      { name: 'INTERVAL YEAR', primitiveType: 'time' },
      { name: 'INTERVAL', primitiveType: 'time' },
    ]);

    for (const hint of extendingAnEarlierName) {
      expect(getPrimitiveType(hint.name, Database.Databricks)).toBe(
        hint.primitiveType
      );
    }
  });
});
