import { ValuesType } from '@/internal-types';

export type Token = {
  type: TokenType;
  value: string;
};

export const TokenType = {
  string: 'string',
  leftParent: 'leftParent',
  rightParent: 'rightParent',
  leftBracket: 'leftBracket',
  rightBracket: 'rightBracket',
  comma: 'comma',
  period: 'period',
  equal: 'equal',
  semicolon: 'semicolon',
} as const;
export type TokenType = ValuesType<typeof TokenType>;

const pattern = {
  doubleQuote: `"`,
  singleQuote: `'`,
  backtick: '`',
  whiteSpace: /\s/,
  string: /\S/,
  breakString: /;|,|\(|\)|\[|\]|\./,
  equal: '=',
  period: '.',
  comma: ',',
  semicolon: ';',
  leftParent: '(',
  rightParent: ')',
  leftBracket: '[',
  rightBracket: ']',
};

const createEqual = (type: string) => (char: string) => type === char;
const createTest = (regexp: RegExp) => (char: string) => regexp.test(char);

const match = {
  doubleQuote: createEqual(pattern.doubleQuote),
  singleQuote: createEqual(pattern.singleQuote),
  backtick: createEqual(pattern.backtick),
  whiteSpace: createTest(pattern.whiteSpace),
  string: createTest(pattern.string),
  breakString: createTest(pattern.breakString),
  equal: createEqual(pattern.equal),
  period: createEqual(pattern.period),
  comma: createEqual(pattern.comma),
  semicolon: createEqual(pattern.semicolon),
  leftParent: createEqual(pattern.leftParent),
  rightParent: createEqual(pattern.rightParent),
  leftBracket: createEqual(pattern.leftBracket),
  rightBracket: createEqual(pattern.rightBracket),
};

export function tokenizer(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  const isChar = () => pos < source.length;

  while (isChar()) {
    let char = source[pos];

    if (match.whiteSpace(char)) {
      let value = '';

      while (isChar() && match.whiteSpace(char)) {
        value += char;
        char = source[++pos];
      }
      continue;
    }

    if (match.leftParent(char)) {
      tokens.push({ type: TokenType.leftParent, value: char });
      pos++;
      continue;
    }

    if (match.rightParent(char)) {
      tokens.push({ type: TokenType.rightParent, value: char });
      pos++;
      continue;
    }

    if (match.comma(char)) {
      tokens.push({ type: TokenType.comma, value: char });
      pos++;
      continue;
    }

    if (match.period(char)) {
      tokens.push({ type: TokenType.period, value: char });
      pos++;
      continue;
    }

    if (match.equal(char)) {
      tokens.push({ type: TokenType.equal, value: char });
      pos++;
      continue;
    }

    if (match.semicolon(char)) {
      tokens.push({ type: TokenType.semicolon, value: char });
      pos++;
      continue;
    }

    if (match.leftBracket(char)) {
      let value = '';
      char = source[++pos];

      while (isChar() && !match.rightBracket(char)) {
        value += char;
        char = source[++pos];
      }

      tokens.push({ type: TokenType.string, value });
      pos++;
      continue;
    }

    if (match.doubleQuote(char)) {
      let value = '';
      char = source[++pos];

      while (isChar() && !match.doubleQuote(char)) {
        value += char;
        char = source[++pos];
      }

      tokens.push({ type: TokenType.string, value });
      pos++;
      continue;
    }

    if (match.singleQuote(char)) {
      let value = '';
      char = source[++pos];

      while (isChar() && !match.singleQuote(char)) {
        value += char;
        char = source[++pos];
      }

      tokens.push({ type: TokenType.string, value });
      pos++;
      continue;
    }

    if (match.backtick(char)) {
      let value = '';
      char = source[++pos];

      while (isChar() && !match.backtick(char)) {
        value += char;
        char = source[++pos];
      }

      tokens.push({ type: TokenType.string, value });
      pos++;
      continue;
    }

    if (match.string(char)) {
      let value = '';

      while (isChar() && match.string(char) && !match.breakString(char)) {
        value += char;
        char = source[++pos];
      }

      tokens.push({ type: TokenType.string, value });
      continue;
    }

    pos++;
  }

  return tokens;
}
