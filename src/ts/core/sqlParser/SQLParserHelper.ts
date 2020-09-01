import { MariaDBKeywords } from "./keyword/MariaDB";
import { MSSQLKeywords } from "./keyword/MSSQL";
import { MySQLKeywords } from "./keyword/MySQL";
import { OracleKeywords } from "./keyword/Oracle";
import { PostgreSQLKeywords } from "./keyword/PostgreSQL";
import { SQLiteKeywords } from "./keyword/SQLite";
import { databaseHints } from "../DataType";

export type StatementType =
  | "create.table"
  | "create.index"
  | "alter.table.add.primaryKey"
  | "alter.table.add.foreignKey"
  | "alter.table.add.unique";

export type SortType = "ASC" | "DESC";

export interface Current {
  value: number;
}

type TokenType =
  | "leftParen"
  | "rightParen"
  | "comma"
  | "period"
  | "equal"
  | "semicolon"
  | "keyword"
  | "string"
  | "doubleQuoteString"
  | "singleQuoteString"
  | "backtickString"
  | "unknown";

export interface Token {
  type: TokenType;
  value: string;
}

export const tokenMatch = {
  whiteSpace: /(?:\s+|#.*|-- +.*|\/\*(?:[\s\S])*?\*\/)+/,
  leftParen: "(",
  rightParen: ")",
  comma: ",",
  period: ".",
  equal: "=",
  semicolon: ";",
  doubleQuote: `"`,
  singleQuote: `'`,
  backtick: "`",
  keywords: getKeywords(),
  string: /[a-z0-9_]/i,
  unknown: /.+/,
  dataTypes: getDataTypes(),
};

function getKeywords(): string[] {
  const keywords: string[] = [
    ...MariaDBKeywords,
    ...MSSQLKeywords,
    ...MySQLKeywords,
    ...OracleKeywords,
    ...PostgreSQLKeywords,
    ...SQLiteKeywords,
  ];
  return Array.from(new Set(keywords.map((keyword) => keyword.toUpperCase())));
}

function getDataTypes(): string[] {
  const keywords: string[] = [];
  databaseHints.forEach((databaseHint) =>
    keywords.push(
      ...databaseHint.dataTypeHints.map((dataTypeHint) =>
        dataTypeHint.name.toUpperCase()
      )
    )
  );
  return Array.from(new Set(keywords));
}

export function keywordEqual(token: Token, value: string): boolean {
  return (
    token.type === "keyword" &&
    token.value.toUpperCase() === value.toUpperCase()
  );
}

export function isExtraString(token?: Token): boolean {
  if (!token) return false;
  return (
    token.type === "doubleQuoteString" ||
    token.type === "singleQuoteString" ||
    token.type === "backtickString"
  );
}

export function isStringKeyword(token?: Token): boolean {
  if (!token) return false;
  const value = token.value.toUpperCase();
  return token.type === "string" && tokenMatch.keywords.includes(value);
}

export function isKeyword(token?: Token): boolean {
  if (!token) return false;
  return token.type === "keyword";
}

export function isString(token?: Token): boolean {
  if (!token) return false;
  return token.type === "string";
}

export function isPeriod(token?: Token): boolean {
  if (!token) return false;
  return token.type === "period";
}

export function isLeftParen(token?: Token): boolean {
  if (!token) return false;
  return token.type === "leftParen";
}

export function isRightParen(token?: Token): boolean {
  if (!token) return false;
  return token.type === "rightParen";
}

export function isSemicolon(token?: Token): boolean {
  if (!token) return false;
  return token.type === "semicolon";
}

export function isComma(token?: Token): boolean {
  if (!token) return false;
  return token.type === "comma";
}

export function isCurrent<T>(list: T[], current: number): boolean {
  return list.length > current;
}

export function isNewStatement(token?: Token): boolean {
  if (!token) return false;
  return (
    keywordEqual(token, "CREATE") ||
    keywordEqual(token, "ALTER") ||
    keywordEqual(token, "DROP") ||
    keywordEqual(token, "USE") ||
    keywordEqual(token, "RENAME") ||
    keywordEqual(token, "DELETE") ||
    keywordEqual(token, "SELECT")
  );
}

export function isCreateTable(tokens: Token[]): boolean {
  return (
    tokens.length > 2 &&
    keywordEqual(tokens[0], "CREATE") &&
    keywordEqual(tokens[1], "TABLE")
  );
}

export function isCreateIndex(tokens: Token[]): boolean {
  return (
    tokens.length > 2 &&
    keywordEqual(tokens[0], "CREATE") &&
    keywordEqual(tokens[1], "INDEX")
  );
}

export function isCreateUniqueIndex(tokens: Token[]): boolean {
  return (
    tokens.length > 3 &&
    keywordEqual(tokens[0], "CREATE") &&
    keywordEqual(tokens[1], "UNIQUE") &&
    keywordEqual(tokens[2], "INDEX")
  );
}

export function isAlterTableAddPrimaryKey(tokens: Token[]): boolean {
  return (
    (tokens.length > 6 &&
      keywordEqual(tokens[0], "ALTER") &&
      keywordEqual(tokens[1], "TABLE") &&
      keywordEqual(tokens[3], "ADD") &&
      keywordEqual(tokens[4], "PRIMARY") &&
      keywordEqual(tokens[5], "KEY")) ||
    (tokens.length > 8 &&
      keywordEqual(tokens[0], "ALTER") &&
      keywordEqual(tokens[1], "TABLE") &&
      keywordEqual(tokens[3], "ADD") &&
      keywordEqual(tokens[4], "CONSTRAINT") &&
      keywordEqual(tokens[6], "PRIMARY") &&
      keywordEqual(tokens[7], "KEY"))
  );
}

export function isAlterTableAddForeignKey(tokens: Token[]): boolean {
  return (
    (tokens.length > 6 &&
      keywordEqual(tokens[0], "ALTER") &&
      keywordEqual(tokens[1], "TABLE") &&
      keywordEqual(tokens[3], "ADD") &&
      keywordEqual(tokens[4], "FOREIGN") &&
      keywordEqual(tokens[5], "KEY")) ||
    (tokens.length > 8 &&
      keywordEqual(tokens[0], "ALTER") &&
      keywordEqual(tokens[1], "TABLE") &&
      keywordEqual(tokens[3], "ADD") &&
      keywordEqual(tokens[4], "CONSTRAINT") &&
      keywordEqual(tokens[6], "FOREIGN") &&
      keywordEqual(tokens[7], "KEY"))
  );
}

export function isAlterTableAddUnique(tokens: Token[]): boolean {
  return (
    (tokens.length > 5 &&
      keywordEqual(tokens[0], "ALTER") &&
      keywordEqual(tokens[1], "TABLE") &&
      keywordEqual(tokens[3], "ADD") &&
      keywordEqual(tokens[4], "UNIQUE")) ||
    (tokens.length > 7 &&
      keywordEqual(tokens[0], "ALTER") &&
      keywordEqual(tokens[1], "TABLE") &&
      keywordEqual(tokens[3], "ADD") &&
      keywordEqual(tokens[4], "CONSTRAINT") &&
      keywordEqual(tokens[6], "UNIQUE"))
  );
}

export function isDataType(token?: Token): boolean {
  if (!token) return false;
  const value = token.value.toUpperCase();
  return token.type === "keyword" && tokenMatch.dataTypes.includes(value);
}

export function isNot(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "NOT");
}

export function isNull(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "NULL");
}

export function isDefault(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "DEFAULT");
}

export function isComment(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "COMMENT");
}

export function isAutoIncrement(token?: Token): boolean {
  if (!token) return false;
  return (
    keywordEqual(token, "AUTO_INCREMENT") ||
    keywordEqual(token, "AUTOINCREMENT")
  );
}

export function isPrimary(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "PRIMARY");
}

export function isKey(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "KEY");
}

export function isUnique(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "UNIQUE");
}

export function isConstraint(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "CONSTRAINT");
}

export function isIndex(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "INDEX");
}

export function isForeign(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "FOREIGN");
}

export function isReferences(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "REFERENCES");
}

export function isASC(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "ASC");
}

export function isDESC(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "DESC");
}

export function isOn(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "ON");
}

export function isTable(token?: Token): boolean {
  if (!token) return false;
  return keywordEqual(token, "TABLE");
}
