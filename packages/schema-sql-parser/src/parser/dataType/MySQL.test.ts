import { describe, expect, it } from 'vite-plus/test';

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

describe('MySQLTypes', () => {
  it('exposes the documented MySQL data type list verbatim', () => {
    expect(MySQLTypes).toEqual([
      'BIGINT',
      'BINARY',
      'BIT',
      'BLOB',
      'BOOL',
      'BOOLEAN',
      'CHAR BYTE',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'DATE',
      'DATETIME',
      'DEC',
      'DECIMAL',
      'DOUBLE PRECISION',
      'DOUBLE',
      'ENUM',
      'FIXED',
      'FLOAT',
      'FLOAT4',
      'FLOAT8',
      'GEOMCOLLECTION',
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'INT',
      'INT1',
      'INT2',
      'INT3',
      'INT4',
      'INT8',
      'INTEGER',
      'JSON',
      'LINESTRING',
      'LONG VARBINARY',
      'LONG VARCHAR',
      'LONG',
      'LONGBLOB',
      'LONGTEXT',
      'MEDIUMBLOB',
      'MEDIUMINT',
      'MEDIUMTEXT',
      'MIDDLEINT',
      'MULTILINESTRING',
      'MULTIPOINT',
      'MULTIPOLYGON',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NATIONAL VARCHAR',
      'NCHAR VARCHAR',
      'NCHAR',
      'NUMERIC',
      'NVARCHAR',
      'POINT',
      'POLYGON',
      'REAL',
      'SERIAL',
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
      'VARCHARACTER',
      'YEAR',
    ]);
    expect(MySQLTypes).toHaveLength(70);
  });

  it('contains no duplicate entries', () => {
    expect(new Set(MySQLTypes).size).toBe(MySQLTypes.length);
  });

  it('is written entirely in upper case', () => {
    const notUpperCase = MySQLTypes.filter(type => type !== type.toUpperCase());
    expect(notUpperCase).toEqual([]);
  });

  it('is sorted ascending, with a multi-word type placed before its prefix', () => {
    expect(orderViolations(MySQLTypes)).toEqual([]);
    expect(MySQLTypes.indexOf('DOUBLE PRECISION')).toBeLessThan(
      MySQLTypes.indexOf('DOUBLE')
    );
  });

  it('lists the synonyms that spell a type over several words', () => {
    expect(MySQLTypes.filter(type => type.includes(' '))).toEqual([
      'CHAR BYTE',
      'CHARACTER VARYING',
      'DOUBLE PRECISION',
      'LONG VARBINARY',
      'LONG VARCHAR',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NATIONAL VARCHAR',
      'NCHAR VARCHAR',
    ]);
  });

  it('covers the spatial and blob families', () => {
    for (const type of [
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'LINESTRING',
      'MULTILINESTRING',
      'MULTIPOINT',
      'MULTIPOLYGON',
      'POINT',
      'POLYGON',
    ]) {
      expect(MySQLTypes).toContain(type);
    }
    for (const type of ['TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB']) {
      expect(MySQLTypes).toContain(type);
    }
  });

  it('omits types that belong to other vendors', () => {
    expect(MySQLTypes).not.toContain('NUMBER');
    expect(MySQLTypes).not.toContain('UUID');
    expect(MySQLTypes).not.toContain('VARCHAR2');
    expect(MySQLTypes).not.toContain('CLOB');
  });

  it('makes every single-word type recognizable by isDataType', () => {
    const unrecognized = MySQLTypes.filter(type => !type.includes(' ')).filter(
      type => {
        const tokens = tokenizer(type);
        return tokens.length !== 1 || !isDataType(tokens)(0);
      }
    );
    expect(unrecognized).toEqual([]);
  });

  it('is matched case-insensitively and rejects unknown words', () => {
    expect(isDataType(tokenizer('varchar'))(0)).toBe(true);
    expect(isDataType(tokenizer('HYPERLOGLOG'))(0)).toBe(false);
  });

  it('cannot reach DOUBLE PRECISION through the tokenizer', () => {
    expect(tokenizer('DOUBLE PRECISION')).toHaveLength(2);
    expect(
      isDataType([{ type: TokenType.string, value: 'DOUBLE PRECISION' }])(0)
    ).toBe(true);
  });
});
