import { describe, expect, it } from 'vite-plus/test';

import { PostgreSQLTypes } from '@/parser/dataType/PostgreSQL';
import { isDataType, matchDataType } from '@/parser/helper';
import { tokenizer, TokenType } from '@/parser/tokenizer';

const orderViolations = (list: string[]) =>
  list.filter((value, index) => {
    if (index === 0) return false;
    const prev = list[index - 1];
    if (prev.startsWith(`${value} `)) return false;
    return prev.toUpperCase() >= value.toUpperCase();
  });

describe('PostgreSQLTypes', () => {
  it('exposes the documented PostgreSQL data type list verbatim', () => {
    expect(PostgreSQLTypes).toEqual([
      'BIGINT',
      'BIGSERIAL',
      'BIT VARYING',
      'BIT',
      'BOOL',
      'BOOLEAN',
      'BOX',
      'BPCHAR',
      'BYTEA',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'CID',
      'CIDR',
      'CIRCLE',
      'DATE',
      'DATEMULTIRANGE',
      'DATERANGE',
      'DECIMAL',
      'DOUBLE PRECISION',
      'FLOAT',
      'FLOAT4',
      'FLOAT8',
      'INET',
      'INT',
      'INT2',
      'INT4',
      'INT4MULTIRANGE',
      'INT4RANGE',
      'INT8',
      'INT8MULTIRANGE',
      'INT8RANGE',
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
      'JSON',
      'JSONB',
      'JSONPATH',
      'LINE',
      'LSEG',
      'MACADDR',
      'MACADDR8',
      'MONEY',
      'NAME',
      'NUMERIC',
      'NUMMULTIRANGE',
      'NUMRANGE',
      'OID',
      'PATH',
      'PG_LSN',
      'PG_SNAPSHOT',
      'POINT',
      'POLYGON',
      'REAL',
      'REGCLASS',
      'REGCOLLATION',
      'REGCONFIG',
      'REGDICTIONARY',
      'REGNAMESPACE',
      'REGOPER',
      'REGOPERATOR',
      'REGPROC',
      'REGPROCEDURE',
      'REGROLE',
      'REGTYPE',
      'SERIAL',
      'SERIAL2',
      'SERIAL4',
      'SERIAL8',
      'SMALLINT',
      'SMALLSERIAL',
      'TEXT',
      'TID',
      'TIME WITH TIME ZONE',
      'TIME WITHOUT TIME ZONE',
      'TIME',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP WITHOUT TIME ZONE',
      'TIMESTAMP',
      'TIMESTAMPTZ',
      'TIMETZ',
      'TSMULTIRANGE',
      'TSQUERY',
      'TSRANGE',
      'TSTZMULTIRANGE',
      'TSTZRANGE',
      'TSVECTOR',
      'TXID_SNAPSHOT',
      'UUID',
      'VARBIT',
      'VARCHAR',
      'XID',
      'XID8',
      'XML',
    ]);
    expect(PostgreSQLTypes).toHaveLength(106);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(PostgreSQLTypes).size).toBe(PostgreSQLTypes.length);
  });

  it('is written entirely in upper case', () => {
    const notUpperCase = PostgreSQLTypes.filter(
      type => type !== type.toUpperCase()
    );
    expect(notUpperCase).toEqual([]);
  });

  it('is sorted ascending, with a multi-word type placed before its prefix', () => {
    expect(orderViolations(PostgreSQLTypes)).toEqual([]);
    for (const [longer, shorter] of [
      ['BIT VARYING', 'BIT'],
      ['CHARACTER VARYING', 'CHARACTER'],
      ['TIME WITH TIME ZONE', 'TIME'],
      ['TIME WITHOUT TIME ZONE', 'TIME'],
      ['TIMESTAMP WITH TIME ZONE', 'TIMESTAMP'],
      ['TIMESTAMP WITHOUT TIME ZONE', 'TIMESTAMP'],
      ['INTERVAL DAY TO SECOND', 'INTERVAL DAY'],
      ['INTERVAL DAY', 'INTERVAL'],
    ]) {
      expect(PostgreSQLTypes.indexOf(longer)).toBeLessThan(
        PostgreSQLTypes.indexOf(shorter)
      );
    }
  });

  it('spells every multi-word type in full', () => {
    expect(PostgreSQLTypes.filter(type => type.includes(' '))).toEqual([
      'BIT VARYING',
      'CHARACTER VARYING',
      'DOUBLE PRECISION',
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
      'TIME WITH TIME ZONE',
      'TIME WITHOUT TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP WITHOUT TIME ZONE',
    ]);
  });

  it('covers the serial and integer alias families', () => {
    for (const type of [
      'SMALLSERIAL',
      'SERIAL',
      'BIGSERIAL',
      'SERIAL2',
      'SERIAL4',
      'SERIAL8',
    ]) {
      expect(PostgreSQLTypes).toContain(type);
    }
    for (const type of ['INT2', 'INT4', 'INT8', 'FLOAT4', 'FLOAT8']) {
      expect(PostgreSQLTypes).toContain(type);
    }
  });

  it('omits types that belong to other vendors', () => {
    expect(PostgreSQLTypes).not.toContain('DATETIME');
    expect(PostgreSQLTypes).not.toContain('BLOB');
    expect(PostgreSQLTypes).not.toContain('NVARCHAR');
    expect(PostgreSQLTypes).not.toContain('NUMBER');
  });

  it('makes every single-word type recognizable by isDataType', () => {
    const unrecognized = PostgreSQLTypes.filter(
      type => !type.includes(' ')
    ).filter(type => {
      const tokens = tokenizer(type);
      return tokens.length !== 1 || !isDataType(tokens)(0);
    });
    expect(unrecognized).toEqual([]);
  });

  it('keeps underscored names as one token', () => {
    expect(tokenizer('PG_LSN')).toHaveLength(1);
    expect(isDataType(tokenizer('pg_lsn'))(0)).toBe(true);
    expect(isDataType(tokenizer('txid_snapshot'))(0)).toBe(true);
  });

  it('reaches every multi-word type through the tokenizer', () => {
    for (const type of PostgreSQLTypes.filter(value => value.includes(' '))) {
      expect(isDataType([{ type: TokenType.string, value: type }])(0)).toBe(
        true
      );
      const tokens = tokenizer(type);
      expect(matchDataType(tokens)(0)).toBe(tokens.length);
    }
    expect(isDataType(tokenizer('BIT VARYING'))(1)).toBe(false);
  });

  it('takes the longest name when several share a first word', () => {
    expect(matchDataType(tokenizer('timestamp without time zone'))(0)).toBe(4);
    expect(matchDataType(tokenizer('timestamptz'))(0)).toBe(1);
    expect(matchDataType(tokenizer('interval day to second'))(0)).toBe(4);
    expect(matchDataType(tokenizer('interval day'))(0)).toBe(2);
    expect(matchDataType(tokenizer('interval'))(0)).toBe(1);
  });
});
