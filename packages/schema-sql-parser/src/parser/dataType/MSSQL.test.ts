import { describe, expect, it } from 'vite-plus/test';

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
      'BINARY VARYING',
      'BINARY',
      'BIT',
      'CHAR VARYING',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'DATE',
      'DATETIME',
      'DATETIME2',
      'DATETIMEOFFSET',
      'DEC',
      'DECIMAL',
      'DOUBLE PRECISION',
      'FLOAT',
      'GEOGRAPHY',
      'GEOMETRY',
      'HIERARCHYID',
      'IMAGE',
      'INT',
      'INTEGER',
      'JSON',
      'MONEY',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NATIONAL TEXT',
      'NCHAR',
      'NTEXT',
      'NUMERIC',
      'NVARCHAR',
      'REAL',
      'ROWVERSION',
      'SMALLDATETIME',
      'SMALLINT',
      'SMALLMONEY',
      'SQL_VARIANT',
      'TEXT',
      'TIME',
      'TIMESTAMP',
      'TINYINT',
      'UNIQUEIDENTIFIER',
      'VARBINARY',
      'VARCHAR',
      'VECTOR',
      'XML',
    ]);
    expect(MSSQLTypes).toHaveLength(48);
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

  it('lists the ISO synonyms that spell a type over several words', () => {
    expect(MSSQLTypes.filter(type => type.includes(' '))).toEqual([
      'BINARY VARYING',
      'CHAR VARYING',
      'CHARACTER VARYING',
      'DOUBLE PRECISION',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NATIONAL TEXT',
    ]);
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
    expect(MSSQLTypes).not.toContain('CLOB');
    expect(MSSQLTypes).not.toContain('NUMBER');
  });

  it('carries the T-SQL types that share a name with another vendor', () => {
    // JSON is a SQL Server 2025 type; TIMESTAMP is the deprecated synonym for
    // ROWVERSION, not a datetime.
    expect(MSSQLTypes).toContain('JSON');
    expect(MSSQLTypes).toContain('TIMESTAMP');
    expect(MSSQLTypes).toContain('ROWVERSION');
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
