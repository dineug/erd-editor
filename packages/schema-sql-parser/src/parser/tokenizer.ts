import { ValuesType } from '@/internal-types';

export type Token = {
  type: TokenType;
  value: string;
  // Set on tokens that came out of ", ', backtick or [] quoting, so a
  // quoted identifier such as key is never read back as the KEY keyword.
  quoted?: boolean;
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
  dash: '-',
  slash: '/',
  asterisk: '*',
  newLine: '\n',
  singleQuote: `'`,
  backtick: '`',
  whiteSpace: /\s/,
  string: /\S/,
  breakString: /;|,|\(|\)|\[|\]|\.|=/,
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
  dash: createEqual(pattern.dash),
  slash: createEqual(pattern.slash),
  asterisk: createEqual(pattern.asterisk),
  newLine: createEqual(pattern.newLine),
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

    // SQL comments are not tokens: a ; or ( inside one would otherwise end
    // the statement or be read as its column list.
    if (match.dash(char) && match.dash(source[pos + 1])) {
      while (isChar() && !match.newLine(char)) {
        char = source[++pos];
      }
      continue;
    }

    if (match.slash(char) && match.asterisk(source[pos + 1])) {
      pos += 2;
      char = source[pos];

      while (
        isChar() &&
        !(match.asterisk(char) && match.slash(source[pos + 1]))
      ) {
        char = source[++pos];
      }

      pos += 2;
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

    if (match.rightBracket(char)) {
      tokens.push({ type: TokenType.rightBracket, value: char });
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

      tokens.push({ type: TokenType.string, value, quoted: true });
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

      tokens.push({ type: TokenType.string, value, quoted: true });
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

      tokens.push({ type: TokenType.string, value, quoted: true });
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

      tokens.push({ type: TokenType.string, value, quoted: true });
      pos++;
      continue;
    }

    if (match.string(char)) {
      let value = '';

      while (
        isChar() &&
        match.string(char) &&
        !match.breakString(char) &&
        // A comment needs no whitespace in front of it: INT-- pk.
        !(match.dash(char) && match.dash(source[pos + 1])) &&
        !(match.slash(char) && match.asterisk(source[pos + 1]))
      ) {
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
