import { describe, expect, it } from 'vitest';

import { OracleTypes } from '@/parser/dataType/Oracle';
import { isDataType } from '@/parser/helper';
import { tokenizer, TokenType } from '@/parser/tokenizer';

const orderViolations = (list: string[]) =>
  list.filter((value, index) => {
    if (index === 0) return false;
    const prev = list[index - 1];
    if (prev.startsWith(`${value} `)) return false;
    return prev.toUpperCase() >= value.toUpperCase();
  });

describe('OracleTypes', () => {
  it('exposes the documented Oracle data type list verbatim', () => {
    expect(OracleTypes).toEqual([
      'BFILE',
      'BINARY_DOUBLE',
      'BINARY_FLOAT',
      'BLOB',
      'CHAR',
      'CLOB',
      'DATE',
      'DATETIME',
      'LONG RAW',
      'LONG',
      'NCHAR',
      'NCLOB',
      'NUMBER',
      'NVARCHAR2',
      'RAW',
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP',
      'UriType',
      'VARCHAR',
      'VARCHAR2',
      'XMLType',
    ]);
    expect(OracleTypes).toHaveLength(22);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(OracleTypes).size).toBe(OracleTypes.length);
  });

  it('is the only vendor list carrying mixed-case entries', () => {
    const mixedCase = OracleTypes.filter(type => type !== type.toUpperCase());
    expect(mixedCase).toEqual(['UriType', 'XMLType']);
  });

  it('is sorted ascending case-insensitively, longest multi-word first', () => {
    expect(orderViolations(OracleTypes)).toEqual([]);
    expect(OracleTypes.indexOf('LONG RAW')).toBeLessThan(
      OracleTypes.indexOf('LONG')
    );
    expect(OracleTypes.indexOf('TIMESTAMP WITH LOCAL TIME ZONE')).toBeLessThan(
      OracleTypes.indexOf('TIMESTAMP WITH TIME ZONE')
    );
    expect(OracleTypes.indexOf('TIMESTAMP WITH TIME ZONE')).toBeLessThan(
      OracleTypes.indexOf('TIMESTAMP')
    );
  });

  it('lists exactly three multi-word types', () => {
    expect(OracleTypes.filter(type => type.includes(' '))).toEqual([
      'LONG RAW',
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
    ]);
  });

  it('omits the integer aliases that other vendors provide', () => {
    expect(OracleTypes).not.toContain('INT');
    expect(OracleTypes).not.toContain('INTEGER');
    expect(OracleTypes).not.toContain('BOOLEAN');
    expect(OracleTypes).not.toContain('TEXT');
  });

  it('makes every single-word type recognizable by isDataType', () => {
    const unrecognized = OracleTypes.filter(type => !type.includes(' ')).filter(
      type => {
        const tokens = tokenizer(type);
        return tokens.length !== 1 || !isDataType(tokens)(0);
      }
    );
    expect(unrecognized).toEqual([]);
  });

  it('matches the mixed-case entries case-insensitively', () => {
    expect(isDataType(tokenizer('URITYPE'))(0)).toBe(true);
    expect(isDataType(tokenizer('xmltype'))(0)).toBe(true);
  });

  it('cannot reach multi-word types through the tokenizer', () => {
    for (const type of OracleTypes.filter(value => value.includes(' '))) {
      expect(isDataType([{ type: TokenType.string, value: type }])(0)).toBe(
        true
      );
      expect(tokenizer(type).length).toBeGreaterThan(1);
    }
    expect(
      tokenizer('TIMESTAMP WITH LOCAL TIME ZONE').map(t => t.value)
    ).toEqual(['TIMESTAMP', 'WITH', 'LOCAL', 'TIME', 'ZONE']);
    expect(isDataType(tokenizer('TIMESTAMP WITH LOCAL TIME ZONE'))(1)).toBe(
      false
    );
  });
});
