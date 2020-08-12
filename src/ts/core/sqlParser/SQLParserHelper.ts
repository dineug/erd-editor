import { MySQLKeywords } from "./keyword/MySQL";
import { PostgreSQLKeywords } from "./keyword/PostgreSQL";

type TokenType =
  | "leftParen"
  | "rightParen"
  | "comma"
  | "period"
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
  const value = token.value.toUpperCase();
  return (
    token.type === "keyword" &&
    (value === "CREATE" || value === "ALTER" || value === "DROP")
  );
}

export function isSemicolon(token: Token): boolean {
  return token.type === "semicolon" && token.value === tokenMatch.semicolon;
}
