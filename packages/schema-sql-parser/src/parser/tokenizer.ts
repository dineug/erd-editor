import { ValuesType } from '@/internal-types';

export type Quote = '"' | "'" | '`' | '[';

export type Token = {
  type: TokenType;
  value: string;
  // The opening delimiter of a token that came out of quoting, so a quoted
  // identifier such as key is never read back as the KEY keyword, and a
  // quoted ENUM value can be written back inside the quotes it had.
  quoted?: Quote;
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
  literalEnd: /[\s,;)\]:|]/,
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
  literalEnd: createTest(pattern.literalEnd),
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

  // MySQL's it\'s: a quote behind an odd run of backslashes, unless what
  // follows may end a literal. 'C:\', is how standard SQL writes a trailing
  // backslash, and so is 'C:\'::text.
  const isEscapedQuote = (value: string) => {
    if (pos + 1 >= source.length || match.literalEnd(source[pos + 1])) {
      return false;
    }

    let run = 0;

    while (value[value.length - 1 - run] === '\\') {
      run++;
    }

    return run % 2 === 1;
  };

  // A doubled quote inside a quoted token is one quote of its value, the way
  // SQL escapes it: 'it''s'. Not inside brackets, where ]] also ends a nested
  // array literal, ARRAY[[1, 2]].
  const readQuoted = (quote: Quote) => {
    const close = quote === '[' ? ']' : quote;
    let value = '';
    pos++;

    while (isChar()) {
      const char = source[pos];

      if (char === close && quote === "'" && isEscapedQuote(value)) {
        value = value.slice(0, -1);
      } else if (char === close) {
        if (quote === '[' || source[pos + 1] !== close) break;
        pos++;
      }

      value += char;
      pos++;
    }

    tokens.push({ type: TokenType.string, value, quoted: quote });
    pos++;
  };

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
      readQuoted('[');
      continue;
    }

    if (match.doubleQuote(char)) {
      readQuoted('"');
      continue;
    }

    if (match.singleQuote(char)) {
      readQuoted("'");
      continue;
    }

    if (match.backtick(char)) {
      readQuoted('`');
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
