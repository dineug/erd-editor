import { describe, expect, it } from 'vite-plus/test';

import { DatabricksTypes } from '@/parser/dataType/Databricks';
import {
  isDataType,
  matchDataType,
  matchNestedDataType,
} from '@/parser/helper';
import { tokenizer, TokenType } from '@/parser/tokenizer';

// A longer name sits ahead of the shorter name it starts with, so the space of
// INTERVAL DAY and the underscore of TIMESTAMP_NTZ both count as a prefix.
const orderViolations = (list: string[]) =>
  list.filter((value, index) => {
    if (index === 0) return false;
    const prev = list[index - 1];
    if (prev.startsWith(value)) return false;
    return prev.toUpperCase() >= value.toUpperCase();
  });

describe('DatabricksTypes', () => {
  it('exposes the documented Databricks data type list verbatim', () => {
    expect(DatabricksTypes).toEqual([
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
    ]);
    expect(DatabricksTypes).toHaveLength(45);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(DatabricksTypes).size).toBe(DatabricksTypes.length);
  });

  it('is written entirely in upper case', () => {
    const notUpperCase = DatabricksTypes.filter(
      type => type !== type.toUpperCase()
    );
    expect(notUpperCase).toEqual([]);
  });

  it('is sorted ascending, with a longer name placed before its prefix', () => {
    expect(orderViolations(DatabricksTypes)).toEqual([]);
    for (const [longer, shorter] of [
      ['INTERVAL DAY TO SECOND', 'INTERVAL DAY'],
      ['INTERVAL YEAR TO MONTH', 'INTERVAL YEAR'],
      ['INTERVAL DAY', 'INTERVAL'],
      ['TIMESTAMP_LTZ', 'TIMESTAMP'],
      ['TIMESTAMP_NTZ', 'TIMESTAMP'],
    ]) {
      expect(DatabricksTypes.indexOf(longer)).toBeLessThan(
        DatabricksTypes.indexOf(shorter)
      );
    }
  });

  it('spells every multi-word type in full', () => {
    expect(DatabricksTypes.filter(type => type.includes(' '))).toEqual([
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
    ]);
  });

  it('lists the complex and semi-structured types by name', () => {
    for (const type of ['ARRAY', 'MAP', 'STRUCT', 'VARIANT', 'OBJECT']) {
      expect(DatabricksTypes).toContain(type);
    }
  });

  it('lists STRING, the name the SQLite affinity rules leave out', () => {
    expect(DatabricksTypes).toContain('STRING');
  });

  it('covers the timestamp family and the integer aliases', () => {
    for (const type of ['TIMESTAMP', 'TIMESTAMP_NTZ', 'TIMESTAMP_LTZ']) {
      expect(DatabricksTypes).toContain(type);
    }
    for (const type of ['BYTE', 'SHORT', 'INT', 'LONG']) {
      expect(DatabricksTypes).toContain(type);
    }
  });

  it('omits types that belong to other vendors', () => {
    expect(DatabricksTypes).not.toContain('TEXT');
    expect(DatabricksTypes).not.toContain('BLOB');
    expect(DatabricksTypes).not.toContain('NVARCHAR');
    expect(DatabricksTypes).not.toContain('DATETIME');
  });

  it('makes every single-word type recognizable by isDataType', () => {
    const unrecognized = DatabricksTypes.filter(
      type => !type.includes(' ')
    ).filter(type => {
      const tokens = tokenizer(type);
      return tokens.length !== 1 || !isDataType(tokens)(0);
    });
    expect(unrecognized).toEqual([]);
  });

  it('is matched case-insensitively and rejects unknown words', () => {
    expect(isDataType(tokenizer('string'))(0)).toBe(true);
    expect(isDataType(tokenizer('Variant'))(0)).toBe(true);
    expect(isDataType(tokenizer('DELTA'))(0)).toBe(false);
  });

  it('keeps underscored names as one token', () => {
    expect(tokenizer('TIMESTAMP_NTZ')).toHaveLength(1);
    expect(isDataType(tokenizer('timestamp_ntz'))(0)).toBe(true);
    expect(isDataType(tokenizer('timestamp_ltz'))(0)).toBe(true);
  });

  it('reaches every multi-word type through the tokenizer', () => {
    for (const type of DatabricksTypes.filter(value => value.includes(' '))) {
      expect(isDataType([{ type: TokenType.string, value: type }])(0)).toBe(
        true
      );
      const tokens = tokenizer(type);
      expect(matchDataType(tokens)(0)).toBe(tokens.length);
    }
    expect(isDataType(tokenizer('INTERVAL DAY'))(1)).toBe(false);
  });

  it('takes the longest name when several share a first word', () => {
    expect(matchDataType(tokenizer('interval day to second'))(0)).toBe(4);
    expect(matchDataType(tokenizer('interval day'))(0)).toBe(2);
    expect(matchDataType(tokenizer('interval'))(0)).toBe(1);
    expect(matchDataType(tokenizer('timestamp_ntz'))(0)).toBe(1);
    expect(matchDataType(tokenizer('timestamp'))(0)).toBe(1);
  });

  it('recovers a nested complex type the angle brackets split apart', () => {
    expect(matchNestedDataType(tokenizer('MAP<STRING, INT>'))(0)).toBe(3);
    expect(matchNestedDataType(tokenizer('ARRAY<STRING>'))(0)).toBe(1);
    expect(matchNestedDataType(tokenizer('STRING'))(0)).toBe(0);
  });
});
