import { getKeywords } from "./sqlParser/SQLParserHelper";

export type TokenType =
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

const tokenMatch = {
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

export function tokenizer(input: string): Token[] {
  let current = 0;

  const tokens: Token[] = [];

  while (current < input.length) {
    let char = input[current];

    if (tokenMatch.whiteSpace.test(char)) {
      current++;
      continue;
    }

    if (char === tokenMatch.leftParen) {
      tokens.push({
        type: "leftParen",
        value: "(",
      });

      current++;

      continue;
    }

    if (char === tokenMatch.rightParen) {
      tokens.push({
        type: "rightParen",
        value: ")",
      });
      current++;
      continue;
    }

    if (char === tokenMatch.comma) {
      tokens.push({
        type: "comma",
        value: ",",
      });
      current++;
      continue;
    }

    if (char === tokenMatch.period) {
      tokens.push({
        type: "period",
        value: ",",
      });
    }

    if (char === tokenMatch.semicolon) {
      tokens.push({
        type: "semicolon",
        value: ";",
      });
      current++;
      continue;
    }

    if (char === tokenMatch.doubleQuote) {
      let value = "";

      char = input[++current];

      while (char !== tokenMatch.doubleQuote) {
        value += char;
        char = input[++current];
      }

      char = input[++current];

      tokens.push({ type: "doubleQuoteString", value });

      continue;
    }

    if (char === tokenMatch.singleQuote) {
      let value = "";

      char = input[++current];

      while (char !== tokenMatch.singleQuote) {
        value += char;
        char = input[++current];
      }

      char = input[++current];

      tokens.push({ type: "singleQuoteString", value });

      continue;
    }

    if (char === tokenMatch.backtick) {
      let value = "";

      char = input[++current];

      while (char !== tokenMatch.backtick) {
        value += char;
        char = input[++current];
      }

      char = input[++current];

      tokens.push({ type: "backtickString", value });

      continue;
    }

    if (tokenMatch.string.test(char)) {
      let value = "";

      while (tokenMatch.string.test(char)) {
        value += char;
        char = input[++current];
      }

      tokens.push({ type: "string", value });

      continue;
    }

    if (tokenMatch.unknown.test(char)) {
      let value = "";

      while (tokenMatch.unknown.test(char)) {
        value += char;
        char = input[++current];
      }

      tokens.push({ type: "unknown", value });

      continue;
    }

    throw new TypeError("I dont know what this character is: " + char);
  }

  tokenizerReType(tokens);
  return tokens;
}

function tokenizerReType(tokens: Token[]) {
  tokens.forEach((token) => {
    if (
      token.type === "string" &&
      tokenMatch.keywords.some(
        (keyword) => keyword.toUpperCase() === token.value.toUpperCase()
      )
    ) {
      token.type = "keyword";
    }

    if (
      token.type === "doubleQuoteString" ||
      token.type === "singleQuoteString" ||
      token.type === "backtickString"
    ) {
      token.type = "string";
    }
  });
}

export function parser(tokens: Token[]): any {
  let current = 0;

  const statements: Array<Array<Token>> = [];

  while (current < tokens.length) {
    let token = tokens[current];
    const value = token.value.toUpperCase();

    if (
      token.type === "keyword" &&
      (value === "CREATE" || value === "ALTER" || value === "DROP")
    ) {
      const statement: Token[] = [];

      while (
        current < tokens.length &&
        token.type !== "semicolon" &&
        token.value !== tokenMatch.semicolon
      ) {
        statement.push(token);
        token = tokens[++current];
      }

      statements.push(statement);
    }

    current++;
  }

  return statements;
}
