import { describe, expect, it } from 'vitest';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { PostgreSQLTypes } from '@/constants/sql/dataType/PostgreSQL';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: the first hint
 * whose lowercased name is a prefix of the lowercased data type wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  return PostgreSQLTypes.find(
    hint =>
      dataType.toLocaleLowerCase().indexOf(hint.name.toLocaleLowerCase()) === 0
  )?.primitiveType;
}

function namesOf(primitiveType: PrimitiveType): string[] {
  return PostgreSQLTypes.filter(
    hint => hint.primitiveType === primitiveType
  ).map(hint => hint.name);
}

describe('PostgreSQLTypes', () => {
  it('is the largest vendor list and is written in lower case', () => {
    expect(PostgreSQLTypes).toHaveLength(58);

    for (const hint of PostgreSQLTypes) {
      expect(hint.name).toBe(hint.name.toLowerCase());
    }
  });

  it('keeps the documented order', () => {
    expect(PostgreSQLTypes.map(hint => hint.name)).toEqual([
      'bigint',
      'bigserial',
      'bit varying',
      'bit',
      'bool',
      'boolean',
      'box',
      'bytea',
      'char',
      'character varying',
      'character',
      'cidr',
      'circle',
      'date',
      'decimal',
      'double precision',
      'float4',
      'float8',
      'inet',
      'int',
      'int2',
      'int4',
      'int8',
      'integer',
      'interval',
      'json',
      'jsonb',
      'line',
      'lseg',
      'macaddr',
      'macaddr8',
      'money',
      'numeric',
      'path',
      'pg_lsn',
      'point',
      'polygon',
      'real',
      'serial',
      'serial2',
      'serial4',
      'serial8',
      'smallint',
      'smallserial',
      'text',
      'time with time zone',
      'time',
      'timestamp with time zone',
      'timestamp',
      'timestamptz',
      'timetz',
      'tsquery',
      'tsvector',
      'txid_snapshot',
      'uuid',
      'varbit',
      'varchar',
      'xml',
    ]);
  });

  it('classifies the integer family', () => {
    expect(namesOf('int')).toEqual([
      'bit varying',
      'bit',
      'int',
      'int2',
      'int4',
      'integer',
      'pg_lsn',
      'serial',
      'serial2',
      'serial4',
      'smallint',
      'smallserial',
      'varbit',
    ]);
    expect(namesOf('long')).toEqual(['bigint', 'bigserial', 'int8', 'serial8']);
  });

  it('classifies the approximate and exact numeric types', () => {
    expect(namesOf('float')).toEqual(['float4', 'real']);
    expect(namesOf('double')).toEqual(['double precision', 'float8', 'money']);
    expect(namesOf('decimal')).toEqual(['decimal', 'numeric']);
    expect(namesOf('boolean')).toEqual(['bool', 'boolean']);
  });

  it('classifies the temporal types', () => {
    expect(namesOf('date')).toEqual(['date']);
    expect(namesOf('time')).toEqual([
      'interval',
      'time with time zone',
      'time',
      'timetz',
    ]);
    expect(namesOf('dateTime')).toEqual([
      'timestamp with time zone',
      'timestamp',
      'timestamptz',
    ]);
  });

  it('treats only json, jsonb and xml as large objects — text is a string', () => {
    expect(namesOf('lob')).toEqual(['json', 'jsonb', 'xml']);
    expect(resolvePrimitiveType('text')).toBe('string');
  });

  it('classifies the geometric, network and text types as strings', () => {
    expect(namesOf('string')).toEqual([
      'box',
      'bytea',
      'char',
      'character varying',
      'character',
      'cidr',
      'circle',
      'inet',
      'line',
      'lseg',
      'macaddr',
      'macaddr8',
      'path',
      'point',
      'polygon',
      'text',
      'tsquery',
      'tsvector',
      'txid_snapshot',
      'uuid',
      'varchar',
    ]);
  });

  it('orders the "… varying" aliases before their shorter forms', () => {
    const names = PostgreSQLTypes.map(hint => hint.name);

    expect(names.indexOf('bit varying')).toBeLessThan(names.indexOf('bit'));
    expect(names.indexOf('character varying')).toBeLessThan(
      names.indexOf('character')
    );
    expect(names.indexOf('time with time zone')).toBeLessThan(
      names.indexOf('time')
    );

    expect(resolvePrimitiveType('bit varying(8)')).toBe('int');
    expect(resolvePrimitiveType('character varying(255)')).toBe('string');
    expect(resolvePrimitiveType('time with time zone')).toBe('time');
  });

  it('resolves parameterised data types by prefix', () => {
    expect(resolvePrimitiveType('varchar(255)')).toBe('string');
    expect(resolvePrimitiveType('NUMERIC(10,2)')).toBe('decimal');
    expect(resolvePrimitiveType('bigserial')).toBe('long');
    expect(resolvePrimitiveType('hstore')).toBeUndefined();
    expect(resolvePrimitiveType('')).toBeUndefined();
  });

  it('shadows int8, interval, serial8 and the timestamps behind shorter prefixes', () => {
    // Known quirk: `int`, `serial` and `time` are listed before their longer
    // siblings, so prefix matching resolves these to the wrong primitive.
    expect(resolvePrimitiveType('int8')).toBe('int');
    expect(resolvePrimitiveType('interval')).toBe('int');
    expect(resolvePrimitiveType('serial8')).toBe('int');
    expect(resolvePrimitiveType('timestamp')).toBe('time');
    expect(resolvePrimitiveType('timestamptz')).toBe('time');
    expect(resolvePrimitiveType('timestamp with time zone')).toBe('time');

    const shadowed = PostgreSQLTypes.filter((hint, index) =>
      PostgreSQLTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0 &&
          earlier.primitiveType !== hint.primitiveType
      )
    );

    expect(shadowed).toEqual<DataTypeHint[]>([
      { name: 'int8', primitiveType: 'long' },
      { name: 'interval', primitiveType: 'time' },
      { name: 'serial8', primitiveType: 'long' },
      { name: 'timestamp with time zone', primitiveType: 'dateTime' },
      { name: 'timestamp', primitiveType: 'dateTime' },
      { name: 'timestamptz', primitiveType: 'dateTime' },
    ]);
  });
});
