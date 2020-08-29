import { MySQLKeywords } from "./keyword/MySQL";
import { PostgreSQLKeywords } from "./keyword/PostgreSQL";
import { SQLiteKeywords } from "./keyword/SQLite";
import { databaseHints } from "../DataType";

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
};

function getKeywords(): string[] {
  const keywords: string[] = [
    ...MySQLKeywords,
    ...PostgreSQLKeywords,
    ...SQLiteKeywords,
  ];
  return Array.from(new Set(keywords));
}

export type StatementType =
  | "create.table"
  | "create.index"
  | "create.unique.index";

export function isString(token: Token): boolean {
  return (
    token.type === "doubleQuoteString" ||
    token.type === "singleQuoteString" ||
    token.type === "backtickString"
  );
}

export function isKeyword(token: Token): boolean {
  const value = token.value.toUpperCase();
  return token.type === "string" && tokenMatch.keywords.includes(value);
}

export function isNewStatement(token: Token): boolean {
  const value = token.value;
  return (
    token.type === "keyword" &&
    (value === "CREATE" ||
      value === "ALTER" ||
      value === "DROP" ||
      value === "USE" ||
      value === "SET" ||
      value === "RENAME" ||
      value === "DELETE" ||
      value === "SELECT")
  );
}

export function isSemicolon(token: Token): boolean {
  return token.type === "semicolon" && token.value === tokenMatch.semicolon;
}

export function keywordEqual(token: Token, value: string): boolean {
  return token.type === "keyword" && token.value === value;
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

const dataTypes: string[] = [];
function setupDataTypes() {
  if (!dataTypes.length) {
    const keywords: string[] = [];
    databaseHints.forEach((databaseHint) =>
      keywords.push(
        ...databaseHint.dataTypeHints.map((dataTypeHint) =>
          dataTypeHint.name.toUpperCase()
        )
      )
    );
    dataTypes.push(...Array.from(new Set(keywords)));
  }
}

export function isDataType(token: Token): boolean {
  if (!dataTypes.length) setupDataTypes();
  return token.type === "keyword" && dataTypes.includes(token.value);
}

export function isNot(token: Token): boolean {
  return keywordEqual(token, "NOT");
}

export function isNull(token: Token): boolean {
  return keywordEqual(token, "NULL");
}

export function isDefault(token: Token): boolean {
  return keywordEqual(token, "DEFAULT");
}

export function isComment(token: Token): boolean {
  return keywordEqual(token, "COMMENT");
}

export function isAutoIncrement(token: Token): boolean {
  return (
    keywordEqual(token, "AUTO_INCREMENT") ||
    keywordEqual(token, "AUTOINCREMENT")
  );
}

export function isPrimary(token: Token): boolean {
  return keywordEqual(token, "PRIMARY");
}

export function isKey(token: Token): boolean {
  return keywordEqual(token, "KEY");
}

export function isUnique(token: Token): boolean {
  return keywordEqual(token, "UNIQUE");
}

export function isConstraint(token: Token): boolean {
  return keywordEqual(token, "CONSTRAINT");
}
