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
      'CHAR BYTE',
      'CHAR VARYING',
      'CHAR',
      'CHARACTER VARYING',
      'CHARACTER',
      'CLOB',
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
      'GEOMETRY',
      'GEOMETRYCOLLECTION',
      'INET4',
      'INET6',
      'INT',
      'INT1',
      'INT2',
      'INT3',
      'INT4',
      'INT8',
      'INTEGER',
      'JSON',
      'LINESTRING',
      'LONG CHAR VARYING',
      'LONG CHARACTER VARYING',
      'LONG VARBINARY',
      'LONG VARCHAR',
      'LONG VARCHARACTER',
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
      'NATIONAL VARCHARACTER',
      'NCHAR VARCHAR',
      'NCHAR VARCHARACTER',
      'NCHAR VARYING',
      'NCHAR',
      'NUMBER',
      'NUMERIC',
      'NVARCHAR',
      'POINT',
      'POLYGON',
      'RAW',
      'REAL',
      'SERIAL',
      'SET',
      'SMALLINT',
      'SQL_TSI_YEAR',
      'TEXT',
      'TIME',
      'TIMESTAMP',
      'TINYBLOB',
      'TINYINT',
      'TINYTEXT',
      'UUID',
      'VARBINARY',
      'VARCHAR',
      'VARCHAR2',
      'VARCHARACTER',
      'VECTOR',
      'XMLTYPE',
      'YEAR',
    ]);
    expect(MariaDBTypes).toHaveLength(86);
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

  it('lists the synonyms that spell a type over several words', () => {
    expect(MariaDBTypes.filter(type => type.includes(' '))).toEqual([
      'CHAR BYTE',
      'CHAR VARYING',
      'CHARACTER VARYING',
      'DOUBLE PRECISION',
      'LONG CHAR VARYING',
      'LONG CHARACTER VARYING',
      'LONG VARBINARY',
      'LONG VARCHAR',
      'LONG VARCHARACTER',
      'NATIONAL CHAR VARYING',
      'NATIONAL CHAR',
      'NATIONAL CHARACTER VARYING',
      'NATIONAL CHARACTER',
      'NATIONAL VARCHAR',
      'NATIONAL VARCHARACTER',
      'NCHAR VARCHAR',
      'NCHAR VARCHARACTER',
      'NCHAR VARYING',
    ]);
  });

  it('covers the MySQL list apart from the GEOMCOLLECTION synonym', () => {
    expect(MySQLTypes.filter(type => !MariaDBTypes.includes(type))).toEqual([
      'GEOMCOLLECTION',
    ]);
  });

  it('adds the Oracle compatibility and MariaDB-only types', () => {
    for (const type of ['NUMBER', 'VARCHAR2', 'RAW', 'CLOB', 'XMLTYPE']) {
      expect(MariaDBTypes).toContain(type);
      expect(MySQLTypes).not.toContain(type);
    }
    for (const type of ['UUID', 'INET4', 'INET6', 'SQL_TSI_YEAR']) {
      expect(MariaDBTypes).toContain(type);
      expect(MySQLTypes).not.toContain(type);
    }
  });

  it('omits types that belong to other vendors', () => {
    expect(MariaDBTypes).not.toContain('NVARCHAR2');
    expect(MariaDBTypes).not.toContain('MONEY');
    expect(MariaDBTypes).not.toContain('NUMRANGE');
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
