import { MySQLKeywords } from "./keyword/MySQL";
import { PostgreSQLKeywords } from "./keyword/PostgreSQL";
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
  const keywords: string[] = [...MySQLKeywords];

  PostgreSQLKeywords.forEach((keyword) => {
    if (!keywords.some((k) => k.toUpperCase() === keyword.toUpperCase())) {
      keywords.push(keyword);
    }
  });

  return keywords;
}

export function isString(token: Token): boolean {
  return (
    token.type === "doubleQuoteString" ||
    token.type === "singleQuoteString" ||
    token.type === "backtickString"
  );
}

export function isKeyword(token: Token): boolean {
  return (
    token.type === "string" &&
    tokenMatch.keywords.some(
      (keyword) => keyword.toUpperCase() === token.value.toUpperCase()
    )
  );
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
databaseHints.forEach((databaseHint) => {
  databaseHint.dataTypeHints.forEach((dataTypeHint) => {
    const name = dataTypeHint.name.toUpperCase();
    if (!dataTypes.some((dataType) => dataType === name)) {
      dataTypes.push(name);
    }
  });
});

export function isDataType(token: Token): boolean {
  return (
    token.type === "keyword" &&
    dataTypes.some((dataType) => dataType === token.value)
  );
}
