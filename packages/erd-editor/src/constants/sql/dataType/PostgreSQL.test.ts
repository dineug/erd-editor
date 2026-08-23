import { describe, expect, it } from 'vite-plus/test';

import { DataTypeHint, PrimitiveType } from '@/constants/sql/dataType';
import { PostgreSQLTypes } from '@/constants/sql/dataType/PostgreSQL';

/**
 * Mirrors `getPrimitiveType` in `@/utils/generator-code/utils`: among the hints
 * whose lowercased name prefixes the lowercased data type, the longest wins.
 */
function resolvePrimitiveType(dataType: string): PrimitiveType | undefined {
  const value = dataType.toLocaleLowerCase().replace(/\([^)]*\)/g, '');
  let matched: DataTypeHint | undefined;

  for (const hint of PostgreSQLTypes) {
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
  return PostgreSQLTypes.filter(
    hint => hint.primitiveType === primitiveType
  ).map(hint => hint.name);
}

describe('PostgreSQLTypes', () => {
  it('is the largest vendor list and is written in lower case', () => {
    expect(PostgreSQLTypes).toHaveLength(106);

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
      'bpchar',
      'bytea',
      'char',
      'character varying',
      'character',
      'cid',
      'cidr',
      'circle',
      'date',
      'datemultirange',
      'daterange',
      'decimal',
      'double precision',
      'float',
      'float4',
      'float8',
      'inet',
      'int',
      'int2',
      'int4',
      'int4multirange',
      'int4range',
      'int8',
      'int8multirange',
      'int8range',
      'integer',
      'interval day to hour',
      'interval day to minute',
      'interval day to second',
      'interval day',
      'interval hour to minute',
      'interval hour to second',
      'interval hour',
      'interval minute to second',
      'interval minute',
      'interval month',
      'interval second',
      'interval year to month',
      'interval year',
      'interval',
      'json',
      'jsonb',
      'jsonpath',
      'line',
      'lseg',
      'macaddr',
      'macaddr8',
      'money',
      'name',
      'numeric',
      'nummultirange',
      'numrange',
      'oid',
      'path',
      'pg_lsn',
      'pg_snapshot',
      'point',
      'polygon',
      'real',
      'regclass',
      'regcollation',
      'regconfig',
      'regdictionary',
      'regnamespace',
      'regoper',
      'regoperator',
      'regproc',
      'regprocedure',
      'regrole',
      'regtype',
      'serial',
      'serial2',
      'serial4',
      'serial8',
      'smallint',
      'smallserial',
      'text',
      'tid',
      'time with time zone',
      'time without time zone',
      'time',
      'timestamp with time zone',
      'timestamp without time zone',
      'timestamp',
      'timestamptz',
      'timetz',
      'tsmultirange',
      'tsquery',
      'tsrange',
      'tstzmultirange',
      'tstzrange',
      'tsvector',
      'txid_snapshot',
      'uuid',
      'varbit',
      'varchar',
      'xid',
      'xid8',
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
    expect(namesOf('long')).toEqual([
      'bigint',
      'bigserial',
      'cid',
      'int8',
      'oid',
      'serial8',
      'xid',
      'xid8',
    ]);
  });

  it('classifies the approximate and exact numeric types', () => {
    expect(namesOf('float')).toEqual(['float4', 'real']);
    expect(namesOf('double')).toEqual([
      'double precision',
      'float',
      'float8',
      'money',
    ]);
    expect(namesOf('decimal')).toEqual(['decimal', 'numeric']);
    expect(namesOf('boolean')).toEqual(['bool', 'boolean']);
  });

  it('classifies the temporal types', () => {
    expect(namesOf('date')).toEqual(['date']);
    expect(namesOf('time')).toEqual([
      'interval day to hour',
      'interval day to minute',
      'interval day to second',
      'interval day',
      'interval hour to minute',
      'interval hour to second',
      'interval hour',
      'interval minute to second',
      'interval minute',
      'interval month',
      'interval second',
      'interval year to month',
      'interval year',
      'interval',
      'time with time zone',
      'time without time zone',
      'time',
      'timetz',
    ]);
    expect(namesOf('dateTime')).toEqual([
      'timestamp with time zone',
      'timestamp without time zone',
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
      'bpchar',
      'bytea',
      'char',
      'character varying',
      'character',
      'cidr',
      'circle',
      'datemultirange',
      'daterange',
      'inet',
      'int4multirange',
      'int4range',
      'int8multirange',
      'int8range',
      'jsonpath',
      'line',
      'lseg',
      'macaddr',
      'macaddr8',
      'name',
      'nummultirange',
      'numrange',
      'path',
      'pg_snapshot',
      'point',
      'polygon',
      'regclass',
      'regcollation',
      'regconfig',
      'regdictionary',
      'regnamespace',
      'regoper',
      'regoperator',
      'regproc',
      'regprocedure',
      'regrole',
      'regtype',
      'text',
      'tid',
      'tsmultirange',
      'tsquery',
      'tsrange',
      'tstzmultirange',
      'tstzrange',
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

  it('resolves int8, interval, serial8 and the timestamps past their shorter prefixes', () => {
    // `int`, `serial` and `time` are listed before their longer siblings, but
    // the longest matching hint wins.
    expect(resolvePrimitiveType('int8')).toBe('long');
    expect(resolvePrimitiveType('interval')).toBe('time');
    expect(resolvePrimitiveType('serial8')).toBe('long');
    expect(resolvePrimitiveType('timestamp')).toBe('dateTime');
    expect(resolvePrimitiveType('timestamptz')).toBe('dateTime');
    expect(resolvePrimitiveType('timestamp with time zone')).toBe('dateTime');
    // The shorter siblings keep their own primitive types.
    expect(resolvePrimitiveType('int')).toBe('int');
    expect(resolvePrimitiveType('serial')).toBe('int');
    expect(resolvePrimitiveType('time')).toBe('time');
    expect(resolvePrimitiveType('timetz')).toBe('time');

    const extendingAnEarlierName = PostgreSQLTypes.filter((hint, index) =>
      PostgreSQLTypes.slice(0, index).some(
        earlier =>
          hint.name.toLowerCase().indexOf(earlier.name.toLowerCase()) === 0 &&
          earlier.primitiveType !== hint.primitiveType
      )
    );

    expect(extendingAnEarlierName).toEqual<DataTypeHint[]>([
      { name: 'cidr', primitiveType: 'string' },
      { name: 'datemultirange', primitiveType: 'string' },
      { name: 'daterange', primitiveType: 'string' },
      { name: 'float4', primitiveType: 'float' },
      { name: 'int4multirange', primitiveType: 'string' },
      { name: 'int4range', primitiveType: 'string' },
      { name: 'int8', primitiveType: 'long' },
      { name: 'int8multirange', primitiveType: 'string' },
      { name: 'int8range', primitiveType: 'string' },
      { name: 'interval day to hour', primitiveType: 'time' },
      { name: 'interval day to minute', primitiveType: 'time' },
      { name: 'interval day to second', primitiveType: 'time' },
      { name: 'interval day', primitiveType: 'time' },
      { name: 'interval hour to minute', primitiveType: 'time' },
      { name: 'interval hour to second', primitiveType: 'time' },
      { name: 'interval hour', primitiveType: 'time' },
      { name: 'interval minute to second', primitiveType: 'time' },
      { name: 'interval minute', primitiveType: 'time' },
      { name: 'interval month', primitiveType: 'time' },
      { name: 'interval second', primitiveType: 'time' },
      { name: 'interval year to month', primitiveType: 'time' },
      { name: 'interval year', primitiveType: 'time' },
      { name: 'interval', primitiveType: 'time' },
      { name: 'jsonpath', primitiveType: 'string' },
      { name: 'serial8', primitiveType: 'long' },
      { name: 'timestamp with time zone', primitiveType: 'dateTime' },
      { name: 'timestamp without time zone', primitiveType: 'dateTime' },
      { name: 'timestamp', primitiveType: 'dateTime' },
      { name: 'timestamptz', primitiveType: 'dateTime' },
    ]);

    for (const hint of extendingAnEarlierName) {
      expect(resolvePrimitiveType(hint.name)).toBe(hint.primitiveType);
    }
  });
});
