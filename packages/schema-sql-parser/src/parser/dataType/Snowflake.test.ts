import { describe, expect, it } from 'vite-plus/test';

import { SnowflakeTypes } from '@/parser/dataType/Snowflake';
import {
  isDataType,
  matchDataType,
  matchNestedDataType,
} from '@/parser/helper';
import { tokenizer, TokenType } from '@/parser/tokenizer';

// A longer name sits ahead of the shorter name it starts with, so the space of
// TIMESTAMP WITH TIME ZONE and the underscore of TIMESTAMP_TZ both count as a
// prefix.
const orderViolations = (list: string[]) =>
  list.filter((value, index) => {
    if (index === 0) return false;
    const prev = list[index - 1];
    if (prev.startsWith(value)) return false;
    return prev.toUpperCase() >= value.toUpperCase();
  });

describe('SnowflakeTypes', () => {
  it('exposes the documented Snowflake data type list verbatim', () => {
    expect(SnowflakeTypes).toEqual([
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
    ]);
    expect(SnowflakeTypes).toHaveLength(54);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(SnowflakeTypes).size).toBe(SnowflakeTypes.length);
  });

  it('is written entirely in upper case', () => {
    const notUpperCase = SnowflakeTypes.filter(
      type => type !== type.toUpperCase()
    );
    expect(notUpperCase).toEqual([]);
  });

  it('is sorted ascending, with a longer name placed before its prefix', () => {
    expect(orderViolations(SnowflakeTypes)).toEqual([]);
    for (const [longer, shorter] of [
      ['CHAR VARYING', 'CHAR'],
      ['DOUBLE PRECISION', 'DOUBLE'],
      ['NCHAR VARYING', 'NCHAR'],
      ['TIMESTAMP WITH TIME ZONE', 'TIMESTAMP'],
      ['TIMESTAMP_TZ', 'TIMESTAMP'],
    ]) {
      expect(SnowflakeTypes.indexOf(longer)).toBeLessThan(
        SnowflakeTypes.indexOf(shorter)
      );
    }
  });

  it('spells every multi-word type in full', () => {
    expect(SnowflakeTypes.filter(type => type.includes(' '))).toEqual([
      'CHAR VARYING',
      'DOUBLE PRECISION',
      'NCHAR VARYING',
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP WITHOUT TIME ZONE',
    ]);
  });

  it('lists the semi-structured and structured types by name', () => {
    for (const type of ['VARIANT', 'OBJECT', 'ARRAY', 'MAP']) {
      expect(SnowflakeTypes).toContain(type);
    }
  });

  it('carries the seven names no other vendor list spells', () => {
    for (const type of [
      'BYTEINT',
      'DECFLOAT',
      'FILE',
      'TIMESTAMP_TZ',
      'TIMESTAMPLTZ',
      'TIMESTAMPNTZ',
      'UNKNOWN',
    ]) {
      expect(SnowflakeTypes).toContain(type);
    }
  });

  it('covers every documented spelling of the timestamp family', () => {
    for (const type of [
      'TIMESTAMP',
      'TIMESTAMP_LTZ',
      'TIMESTAMP_NTZ',
      'TIMESTAMP_TZ',
      'TIMESTAMPLTZ',
      'TIMESTAMPNTZ',
      'TIMESTAMPTZ',
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP WITHOUT TIME ZONE',
      'DATETIME',
    ]) {
      expect(SnowflakeTypes).toContain(type);
    }
  });

  it('omits types that belong to other vendors', () => {
    expect(SnowflakeTypes).not.toContain('STRUCT');
    expect(SnowflakeTypes).not.toContain('BLOB');
    expect(SnowflakeTypes).not.toContain('SERIAL');
    expect(SnowflakeTypes).not.toContain('MONEY');
    expect(SnowflakeTypes).not.toContain('INTERVAL');
    expect(SnowflakeTypes).not.toContain('CHARACTER VARYING');
  });

  it('makes every single-word type recognizable by isDataType', () => {
    const unrecognized = SnowflakeTypes.filter(
      type => !type.includes(' ')
    ).filter(type => {
      const tokens = tokenizer(type);
      return tokens.length !== 1 || !isDataType(tokens)(0);
    });
    expect(unrecognized).toEqual([]);
  });

  it('is matched case-insensitively and rejects unknown words', () => {
    expect(isDataType(tokenizer('number'))(0)).toBe(true);
    expect(isDataType(tokenizer('Variant'))(0)).toBe(true);
    expect(isDataType(tokenizer('TRANSIENT'))(0)).toBe(false);
  });

  it('keeps underscored names as one token', () => {
    expect(tokenizer('TIMESTAMP_TZ')).toHaveLength(1);
    expect(isDataType(tokenizer('timestamp_tz'))(0)).toBe(true);
    expect(isDataType(tokenizer('timestamp_ntz'))(0)).toBe(true);
    expect(isDataType(tokenizer('timestamp_ltz'))(0)).toBe(true);
  });

  it('reaches every multi-word type through the tokenizer', () => {
    for (const type of SnowflakeTypes.filter(value => value.includes(' '))) {
      expect(isDataType([{ type: TokenType.string, value: type }])(0)).toBe(
        true
      );
      const tokens = tokenizer(type);
      expect(matchDataType(tokens)(0)).toBe(tokens.length);
    }
    expect(isDataType(tokenizer('TIMESTAMP WITH'))(1)).toBe(false);
  });

  it('takes the longest name when several share a first word', () => {
    expect(matchDataType(tokenizer('timestamp with local time zone'))(0)).toBe(
      5
    );
    expect(matchDataType(tokenizer('timestamp with time zone'))(0)).toBe(4);
    expect(matchDataType(tokenizer('timestamp'))(0)).toBe(1);
    expect(matchDataType(tokenizer('timestamp_tz'))(0)).toBe(1);
    expect(matchDataType(tokenizer('char varying'))(0)).toBe(2);
    expect(matchDataType(tokenizer('char'))(0)).toBe(1);
  });

  // Snowflake writes its structured types with parentheses, not the angle
  // brackets Databricks uses, so the argument list is already part of the
  // matched span and there is nothing for matchNestedDataType to rebalance.
  it('spans a structured type through its parenthesized arguments', () => {
    expect(matchDataType(tokenizer('ARRAY(NUMBER)'))(0)).toBe(4);
    expect(matchDataType(tokenizer('MAP(VARCHAR, NUMBER)'))(0)).toBe(6);
    expect(
      matchDataType(tokenizer('OBJECT(city VARCHAR, zip NUMBER)'))(0)
    ).toBe(8);
    expect(matchDataType(tokenizer('VECTOR(FLOAT, 3)'))(0)).toBe(6);
    expect(matchNestedDataType(tokenizer('ARRAY(NUMBER)'))(0)).toBe(0);
  });
});
