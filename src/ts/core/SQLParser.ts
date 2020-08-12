import {
  Token,
  tokenMatch,
  isKeyword,
  isString,
  isNewStatement,
  isSemicolon,
} from "./sqlParser/SQLParserHelper";

/**
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */
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
        value: ".",
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

  tokens.forEach((token) => {
    if (isString(token)) {
      token.type = "string";
    } else if (isKeyword(token)) {
      token.type = "keyword";
    }
  });

  return tokens;
}

export function parser(tokens: Token[]): any {
  let current = 0;

  const statements: Array<Array<Token>> = [];

  while (current < tokens.length) {
    let token = tokens[current];

    if (isNewStatement(token)) {
      const statement: Token[] = [];

      statement.push(token);
      token = tokens[++current];

      while (
        current < tokens.length &&
        !isNewStatement(token) &&
        !isSemicolon(token)
      ) {
        statement.push(token);
        token = tokens[++current];
      }

      statements.push(statement);
    }

    if (token && isNewStatement(token)) {
      continue;
    }

    current++;
  }

  return statements;
}
