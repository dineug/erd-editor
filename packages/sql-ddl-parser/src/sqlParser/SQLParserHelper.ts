import { Token } from '@@types/index';

import { MariaDBTypes } from './dataType/MariaDB';
import { MSSQLTypes } from './dataType/MSSQL';
import { MySQLTypes } from './dataType/MySQL';
import { OracleTypes } from './dataType/Oracle';
import { PostgreSQLTypes } from './dataType/PostgreSQL';
import { SQLiteTypes } from './dataType/SQLite';
import { MariaDBKeywords } from './keyword/MariaDB';
import { MSSQLKeywords } from './keyword/MSSQL';
import { MySQLKeywords } from './keyword/MySQL';
import { OracleKeywords } from './keyword/Oracle';
import { PostgreSQLKeywords } from './keyword/PostgreSQL';
import { SQLiteKeywords } from './keyword/SQLite';

export interface Current {
  value: number;
}

export const tokenMatch = {
  whiteSpace: /(?:\s+|#.*|-- +.*|\/\*(?:[\s\S])*?\*\/)+/,
  leftParen: '(',
  rightParen: ')',
  comma: ',',
  period: '.',
  equal: '=',
  semicolon: ';',
  doubleQuote: `"`,
  singleQuote: `'`,
  backtick: '`',
  keywords: getKeywords(),
  // number, english, korean, chinese, japanese
  string:
    /[a-z0-9_\u3131-\u314E\u314F-\u3163\uAC00-\uD7A3\u3040-\u309F\u30A0-\u30FF\u3400-\u4DB5\u4E00-\u9FCC]/i,
  unknown: /.+/,
  dataTypes: getDataTypes(),
};

function getDataTypes(): string[] {
  const keywords: string[] = [
    ...MariaDBTypes,
    ...MSSQLTypes,
    ...MySQLTypes,
    ...OracleTypes,
    ...PostgreSQLTypes,
    ...SQLiteTypes,
  ];
  return Array.from(new Set(keywords.map(keyword => keyword.toUpperCase())));
}

function getKeywords(): string[] {
  const keywords: string[] = [
    ...MariaDBKeywords,
    ...MSSQLKeywords,
    ...MySQLKeywords,
    ...OracleKeywords,
    ...PostgreSQLKeywords,
    ...SQLiteKeywords,
    ...getDataTypes(),
  ];
  return Array.from(new Set(keywords.map(keyword => keyword.toUpperCase())));
}

export function keywordEqual(token: Token, value: string): boolean {
  return (
    token.type === 'keyword' &&
    token.value.toUpperCase() === value.toUpperCase()
  );
}

export function isExtraString(token?: Token): boolean {
  if (!token) return false;
  return (
    token.type === 'doubleQuoteString' ||
    token.type === 'singleQuoteString' ||
    token.type === 'backtickString'
  );
}

export function isStringKeyword(token?: Token): boolean {
  if (!token) return false;
  const value = token.value.toUpperCase();
  return token.type === 'string' && tokenMatch.keywords.includes(value);
}

export function isKeyword(token?: Token): boolean {
  if (!token) return false;
  return token.type === 'keyword';
}

export function isString(token?: Token): boolean {
  if (!token) return false;
  return token.type === 'string';
}

export function isPeriod(token?: Token): boolean {
  if (!token) return false;
  return token.type === 'period';
}

export function isLeftParen(token?: Token): boolean {
  if (!token) return false;
  return token.type === 'leftParen';
}

export function isRightParen(token?: Token): boolean {
  if (!token) return false;
  return token.type === 'rightParen';
}

export function isSemicolon(token?: Token): boolean {
  if (!token) return false;
  return token.type === 'semicolon';
}

export function isComma(token?: Token): boolean {
  if (!token) return false;
  return token.type === 'comma';
}

export function isCurrent<T>(list: T[], current: number): boolean {
  return list.length > current;
}

export function isNewStatement(token?: Token): boolean {
  if (!token) return false;
  return (
    keywordEqual(token, 'CREATE') ||
    keywordEqual(token, 'ALTER') ||
    keywordEqual(token, 'DROP') ||
    keywordEqual(token, 'USE') ||
    keywordEqual(token, 'RENAME') ||
    keywordEqual(token, 'SELECT')
  );
}

export function isCreateTable(tokens: Token[]): boolean {
  return (
    tokens.length > 2 &&
    keywordEqual(tokens[0], 'CREATE') &&
    keywordEqual(tokens[1], 'TABLE')
  );
}

export function isCreateIndex(tokens: Token[]): boolean {
  return (
    tokens.length > 2 &&
    keywordEqual(tokens[0], 'CREATE') &&
    keywordEqual(tokens[1], 'INDEX')
  );
}

export function isCreateUniqueIndex(tokens: Token[]): boolean {
  return (
    tokens.length > 3 &&
    keywordEqual(tokens[0], 'CREATE') &&
    keywordEqual(tokens[1], 'UNIQUE') &&
    keywordEqual(tokens[2], 'INDEX')
  );
}

export function isAlterTableAddPrimaryKey(tokens: Token[]): boolean {
  return (
    (tokens.length > 6 &&
      keywordEqual(tokens[0], 'ALTER') &&
      keywordEqual(tokens[1], 'TABLE') &&
      keywordEqual(tokens[3], 'ADD') &&
      keywordEqual(tokens[4], 'PRIMARY') &&
      keywordEqual(tokens[5], 'KEY')) ||
    (tokens.length > 8 &&
      keywordEqual(tokens[0], 'ALTER') &&
      keywordEqual(tokens[1], 'TABLE') &&
      keywordEqual(tokens[3], 'ADD') &&
      keywordEqual(tokens[4], 'CONSTRAINT') &&
      keywordEqual(tokens[6], 'PRIMARY') &&
      keywordEqual(tokens[7], 'KEY'))
  );
}

export function isAlterTableAddForeignKey(tokens: Token[]): boolean {
  return (
    (tokens.length > 6 &&
      keywordEqual(tokens[0], 'ALTER') &&
      keywordEqual(tokens[1], 'TABLE') &&
      keywordEqual(tokens[3], 'ADD') &&
      keywordEqual(tokens[4], 'FOREIGN') &&
      keywordEqual(tokens[5], 'KEY')) ||
    (tokens.length > 8 &&
      keywordEqual(tokens[0], 'ALTER') &&
      keywordEqual(tokens[1], 'TABLE') &&
      keywordEqual(tokens[3], 'ADD') &&
      keywordEqual(tokens[4], 'CONSTRAINT') &&
      keywordEqual(tokens[6], 'FOREIGN') &&
      keywordEqual(tokens[7], 'KEY'))
  );
}

export function isAlterTableAddUnique(tokens: Token[]): boolean {
  return (
    (tokens.length > 5 &&
      keywordEqual(tokens[0], 'ALTER') &&
      keywordEqual(tokens[1], 'TABLE') &&
      keywordEqual(tokens[3], 'ADD') &&
      keywordEqual(tokens[4], 'UNIQUE')) ||
    (tokens.length > 7 &&
      keywordEqual(tokens[0], 'ALTER') &&
      keywordEqual(tokens[1], 'TABLE') &&
      keywordEqual(tokens[3], 'ADD') &&
      keywordEqual(tokens[4], 'CONSTRAINT') &&
      keywordEqual(tokens[6], 'UNIQUE'))
  );
}

export function isDataType(token?: Token): boolean {
  if (!token) return false;
  const value = token.value.toUpperCase();
  return token.type === 'keyword' && tokenMatch.dataTypes.includes(value);
}

export function isNot(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'NOT');
}

export function isNull(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'NULL');
}

export function isDefault(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'DEFAULT');
}

export function isComment(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'COMMENT');
}

export function isAutoIncrement(token?: Token): boolean {
  if (!token) return false;
  return (
    keywordEqual(token, 'AUTO_INCREMENT') ||
    keywordEqual(token, 'AUTOINCREMENT')
  );
}

export function isPrimary(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'PRIMARY');
}

export function isKey(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'KEY');
}

export function isUnique(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'UNIQUE');
}

export function isConstraint(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'CONSTRAINT');
}

export function isIndex(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'INDEX');
}

export function isForeign(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'FOREIGN');
}

export function isReferences(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'REFERENCES');
}

export function isASC(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'ASC');
}

export function isDESC(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'DESC');
}

export function isOn(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'ON');
}

export function isTable(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, 'TABLE');
}
