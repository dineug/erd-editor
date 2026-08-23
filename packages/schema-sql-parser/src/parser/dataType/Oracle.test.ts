import { describe, expect, it } from 'vite-plus/test';

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
      'ANYDATA',
      'BFILE',
      'BINARY_DOUBLE',
      'BINARY_FLOAT',
      'BLOB',
      'BOOL',
      'BOOLEAN',
      'CHAR VARYING',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'CLOB',
      'DATE',
      'DEC',
      'DECIMAL',
      'DOUBLE PRECISION',
      'FLOAT',
      'INT',
      'INTEGER',
      'INTERVAL DAY TO SECOND',
      'INTERVAL YEAR TO MONTH',
      'JSON',
      'LONG RAW',
      'LONG VARCHAR',
      'LONG',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NCHAR VARYING',
      'NCHAR',
      'NCLOB',
      'NUMBER',
      'NUMERIC',
      'NVARCHAR2',
      'RAW',
      'REAL',
      'ROWID',
      'SDO_GEOMETRY',
      'SDO_GEORASTER',
      'SDO_TOPO_GEOMETRY',
      'SMALLINT',
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
      'TIMESTAMP',
      'URIType',
      'UROWID',
      'VARCHAR',
      'VARCHAR2',
      'VECTOR',
      'XMLType',
    ]);
    expect(OracleTypes).toHaveLength(51);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(OracleTypes).size).toBe(OracleTypes.length);
  });

  it('is the only vendor list carrying mixed-case entries', () => {
    const mixedCase = OracleTypes.filter(type => type !== type.toUpperCase());
    expect(mixedCase).toEqual(['URIType', 'XMLType']);
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

  it('lists the ANSI and datetime names spelled over several words', () => {
    expect(OracleTypes.filter(type => type.includes(' '))).toEqual([
      'CHAR VARYING',
      'CHARACTER VARYING',
      'DOUBLE PRECISION',
      'INTERVAL DAY TO SECOND',
      'INTERVAL YEAR TO MONTH',
      'LONG RAW',
      'LONG VARCHAR',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NCHAR VARYING',
      'TIMESTAMP WITH LOCAL TIME ZONE',
      'TIMESTAMP WITH TIME ZONE',
    ]);
  });

  it('carries the ANSI-supported aliases Oracle maps onto its own types', () => {
    for (const type of ['INT', 'INTEGER', 'SMALLINT', 'DEC', 'NUMERIC']) {
      expect(OracleTypes).toContain(type);
    }
  });

  it('omits types that belong to other vendors', () => {
    expect(OracleTypes).not.toContain('TEXT');
    expect(OracleTypes).not.toContain('TINYINT');
    expect(OracleTypes).not.toContain('ENUM');
    // Table 2-1 and datetime_datatypes::= carry DATE, TIMESTAMP and the two
    // INTERVAL forms; Oracle has no DATETIME.
    expect(OracleTypes).not.toContain('DATETIME');
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
