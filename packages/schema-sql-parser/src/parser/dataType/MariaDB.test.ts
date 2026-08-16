import { describe, expect, it } from 'vite-plus/test';

import { MariaDBTypes } from '@/parser/dataType/MariaDB';
import { MySQLTypes } from '@/parser/dataType/MySQL';
import { isDataType } from '@/parser/helper';
import { tokenizer, TokenType } from '@/parser/tokenizer';

const orderViolations = (list: string[]) =>
  list.filter((value, index) => {
    if (index === 0) return false;
    const prev = list[index - 1];
    if (prev.startsWith(`${value} `)) return false;
    return prev.toUpperCase() >= value.toUpperCase();
  });

describe('MariaDBTypes', () => {
  it('exposes the documented MariaDB data type list verbatim', () => {
    expect(MariaDBTypes).toEqual([
      'BIGINT',
      'BINARY',
      'BIT',
      'BLOB',
      'BOOL',
      'BOOLEAN',
      'CHAR',
      'DATE',
      'DATETIME',
      'DEC',
      'DECIMAL',
      'DOUBLE PRECISION',
      'DOUBLE',
      'ENUM',
      'FIXED',
      'FLOAT',
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'INT',
      'INTEGER',
      'JSON',
      'LINESTRING',
      'LONGBLOB',
      'LONGTEXT',
      'MEDIUMBLOB',
      'MEDIUMINT',
      'MEDIUMTEXT',
      'MULTILINESTRING',
      'MULTIPOINT',
      'MULTIPOLYGON',
      'NUMERIC',
      'POINT',
      'POLYGON',
      'REAL',
      'SET',
      'SMALLINT',
      'TEXT',
      'TIME',
      'TIMESTAMP',
      'TINYBLOB',
      'TINYINT',
      'TINYTEXT',
      'VARBINARY',
      'VARCHAR',
      'YEAR',
    ]);
    expect(MariaDBTypes).toHaveLength(45);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(MariaDBTypes).size).toBe(MariaDBTypes.length);
  });

  it('is written entirely in upper case', () => {
    const notUpperCase = MariaDBTypes.filter(
      type => type !== type.toUpperCase()
    );
    expect(notUpperCase).toEqual([]);
  });

  it('is sorted ascending, with a multi-word type placed before its prefix', () => {
    expect(orderViolations(MariaDBTypes)).toEqual([]);
    expect(MariaDBTypes.indexOf('DOUBLE PRECISION')).toBeLessThan(
      MariaDBTypes.indexOf('DOUBLE')
    );
    expect(MariaDBTypes.indexOf('DEC')).toBeLessThan(
      MariaDBTypes.indexOf('DECIMAL')
    );
  });

  it('holds a single multi-word type', () => {
    expect(MariaDBTypes.filter(type => type.includes(' '))).toEqual([
      'DOUBLE PRECISION',
    ]);
  });

  it('extends the MySQL list with FIXED and REAL', () => {
    expect(MariaDBTypes).toContain('FIXED');
    expect(MariaDBTypes).toContain('REAL');
    expect(MySQLTypes).not.toContain('FIXED');
    expect(MySQLTypes).not.toContain('REAL');
    expect(MySQLTypes.every(type => MariaDBTypes.includes(type))).toBe(true);
  });

  it('omits types that belong to other vendors', () => {
    expect(MariaDBTypes).not.toContain('VARCHAR2');
    expect(MariaDBTypes).not.toContain('NVARCHAR');
    expect(MariaDBTypes).not.toContain('SERIAL');
  });

  it('makes every single-word type recognizable by isDataType', () => {
    const unrecognized = MariaDBTypes.filter(
      type => !type.includes(' ')
    ).filter(type => {
      const tokens = tokenizer(type);
      return tokens.length !== 1 || !isDataType(tokens)(0);
    });
    expect(unrecognized).toEqual([]);
  });

  it('is matched case-insensitively', () => {
    const tokens = tokenizer('mediumtext');
    expect(isDataType(tokens)(0)).toBe(true);
  });

  it('cannot reach DOUBLE PRECISION through the tokenizer', () => {
    expect(
      isDataType([{ type: TokenType.string, value: 'DOUBLE PRECISION' }])(0)
    ).toBe(true);
    expect(tokenizer('DOUBLE PRECISION')).toEqual([
      { type: TokenType.string, value: 'DOUBLE' },
      { type: TokenType.string, value: 'PRECISION' },
    ]);
    expect(isDataType(tokenizer('DOUBLE PRECISION'))(1)).toBe(false);
  });
});
