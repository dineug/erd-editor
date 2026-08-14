import { describe, expect, it } from 'vitest';

import { MSSQLTypes } from '@/parser/dataType/MSSQL';
import { isDataType } from '@/parser/helper';
import { tokenizer } from '@/parser/tokenizer';

const orderViolations = (list: string[]) =>
  list.filter((value, index) => {
    if (index === 0) return false;
    const prev = list[index - 1];
    if (prev.startsWith(`${value} `)) return false;
    return prev.toUpperCase() >= value.toUpperCase();
  });

describe('MSSQLTypes', () => {
  it('exposes the documented T-SQL data type list verbatim', () => {
    expect(MSSQLTypes).toEqual([
      'BIGINT',
      'BINARY',
      'BIT',
      'CHAR',
      'DATE',
      'DATETIME',
      'DATETIME2',
      'DATETIMEOFFSET',
      'DECIMAL',
      'FLOAT',
      'GEOGRAPHY',
      'GEOMETRY',
      'IMAGE',
      'INT',
      'MONEY',
      'NCHAR',
      'NTEXT',
      'NUMERIC',
      'NVARCHAR',
      'REAL',
      'SMALLDATETIME',
      'SMALLINT',
      'SMALLMONEY',
      'SQL_VARIANT',
      'TEXT',
      'TIME',
      'TINYINT',
      'UNIQUEIDENTIFIER',
      'VARBINARY',
      'VARCHAR',
      'XML',
    ]);
    expect(MSSQLTypes).toHaveLength(31);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(MSSQLTypes).size).toBe(MSSQLTypes.length);
  });

  it('is written entirely in upper case', () => {
    const notUpperCase = MSSQLTypes.filter(type => type !== type.toUpperCase());
    expect(notUpperCase).toEqual([]);
  });

  it('is sorted ascending', () => {
    expect(orderViolations(MSSQLTypes)).toEqual([]);
    expect(MSSQLTypes.indexOf('DATETIME')).toBeLessThan(
      MSSQLTypes.indexOf('DATETIME2')
    );
    expect(MSSQLTypes.indexOf('DATETIME2')).toBeLessThan(
      MSSQLTypes.indexOf('DATETIMEOFFSET')
    );
  });

  it('has no multi-word type, so every entry survives tokenization', () => {
    expect(MSSQLTypes.filter(type => type.includes(' '))).toEqual([]);
    const split = MSSQLTypes.filter(type => tokenizer(type).length !== 1);
    expect(split).toEqual([]);
  });

  it('keeps the underscore of SQL_VARIANT as part of a single token', () => {
    expect(MSSQLTypes).toContain('SQL_VARIANT');
    expect(tokenizer('SQL_VARIANT')).toHaveLength(1);
    expect(isDataType(tokenizer('SQL_VARIANT'))(0)).toBe(true);
  });

  it('covers the national character and money families', () => {
    for (const type of ['NCHAR', 'NVARCHAR', 'NTEXT']) {
      expect(MSSQLTypes).toContain(type);
    }
    expect(MSSQLTypes).toContain('MONEY');
    expect(MSSQLTypes).toContain('SMALLMONEY');
  });

  it('omits types that belong to other vendors', () => {
    expect(MSSQLTypes).not.toContain('BOOLEAN');
    expect(MSSQLTypes).not.toContain('BLOB');
    expect(MSSQLTypes).not.toContain('JSON');
    expect(MSSQLTypes).not.toContain('TIMESTAMP');
  });

  it('makes every type recognizable by isDataType', () => {
    const unrecognized = MSSQLTypes.filter(
      type => !isDataType(tokenizer(type))(0)
    );
    expect(unrecognized).toEqual([]);
  });

  it('is matched case-insensitively and rejects unknown words', () => {
    expect(isDataType(tokenizer('uniqueidentifier'))(0)).toBe(true);
    expect(isDataType(tokenizer('SQL_VARIANTS'))(0)).toBe(false);
  });
});
