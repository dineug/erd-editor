import { describe, expect, it } from 'vitest';

import { PostgreSQLTypes } from '@/parser/dataType/PostgreSQL';
import { isDataType } from '@/parser/helper';
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
      'BYTEA',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'CIDR',
      'CIRCLE',
      'DATE',
      'DECIMAL',
      'DOUBLE PRECISION',
      'FLOAT4',
      'FLOAT8',
      'INET',
      'INT',
      'INT2',
      'INT4',
      'INT8',
      'INTEGER',
      'INTERVAL',
      'JSON',
      'JSONB',
      'LINE',
      'LSEG',
      'MACADDR',
      'MACADDR8',
      'MONEY',
      'NUMERIC',
      'PATH',
      'PG_LSN',
      'POINT',
      'POLYGON',
      'REAL',
      'SERIAL',
      'SERIAL2',
      'SERIAL4',
      'SERIAL8',
      'SMALLINT',
      'SMALLSERIAL',
      'TEXT',
      'TIME WITH',
      'TIME',
      'TIMESTAMP WITH',
      'TIMESTAMP',
      'TIMESTAMPTZ',
      'TIMETZ',
      'TSQUERY',
      'TSVECTOR',
      'TXID_SNAPSHOT',
      'UUID',
      'VARBIT',
      'VARCHAR',
      'XML',
    ]);
    expect(PostgreSQLTypes).toHaveLength(58);
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
      ['TIME WITH', 'TIME'],
      ['TIMESTAMP WITH', 'TIMESTAMP'],
    ]) {
      expect(PostgreSQLTypes.indexOf(longer)).toBeLessThan(
        PostgreSQLTypes.indexOf(shorter)
      );
    }
  });

  it('lists the multi-word types, two of which are truncated fragments', () => {
    expect(PostgreSQLTypes.filter(type => type.includes(' '))).toEqual([
      'BIT VARYING',
      'CHARACTER VARYING',
      'DOUBLE PRECISION',
      'TIME WITH',
      'TIMESTAMP WITH',
    ]);
    expect(PostgreSQLTypes).not.toContain('TIME WITH TIME ZONE');
    expect(PostgreSQLTypes).not.toContain('TIMESTAMP WITH TIME ZONE');
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

  it('cannot reach multi-word types through the tokenizer', () => {
    for (const type of PostgreSQLTypes.filter(value => value.includes(' '))) {
      expect(isDataType([{ type: TokenType.string, value: type }])(0)).toBe(
        true
      );
      expect(tokenizer(type)).toHaveLength(2);
    }
    expect(isDataType(tokenizer('BIT VARYING'))(0)).toBe(true);
    expect(isDataType(tokenizer('BIT VARYING'))(1)).toBe(false);
  });
});
