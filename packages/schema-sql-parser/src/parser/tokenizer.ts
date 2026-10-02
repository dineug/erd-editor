import { ValuesType } from '@/internal-types';
import { DatabaseVendor } from '@/parser/statement';

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
  literalEnd: /[\s,;)\]:|+]/,
  equal: '=',
  period: '.',
  comma: ',',
  semicolon: ';',
  leftParent: '(',
  rightParent: ')',
  leftBracket: '[',
  rightBracket: ']',
};

// What Spark reads a backslash and the character after it as; any other
// character stands for itself, a quote or a backslash among them.
const SparkEscapes: Readonly<Record<string, string>> = {
  '0': '\0',
  b: '\b',
  n: '\n',
  r: '\r',
  t: '\t',
  Z: '\x1a',
  '%': '\\%',
  _: '\\_',
};

// UTF-16 units of a code point as Spark builds them, each cut to 16 bits, so
// one past U+10FFFF reads as two units instead of throwing.
const fromSparkCodePoint = (codePoint: number) =>
  codePoint < 0x10000
    ? String.fromCharCode(codePoint)
    : String.fromCharCode(
        Math.floor((codePoint - 0x10000) / 0x400) + 0xd800,
        ((codePoint - 0x10000) % 0x400) + 0xdc00
      );

// Spark's escape at the start of rest, the text after a backslash: what it
// reads as and how many characters of rest it spans. \u0041 and \101 are A.
const readSparkEscape = (rest: string): [string, number] => {
  const unicode = /^(?:u([\da-fA-F]{4})|U([\da-fA-F]{8}))/.exec(rest);
  if (unicode) {
    const hex = unicode[1] ?? unicode[2];
    return [fromSparkCodePoint(parseInt(hex, 16)), hex.length + 1];
  }

  const octal = /^[01][0-7]{2}/.exec(rest);
  if (octal) return [String.fromCharCode(parseInt(octal[0], 8)), 3];

  // A backslash the source ends on stands for itself.
  if (!rest) return ['\\', 0];

  return [SparkEscapes[rest[0]] ?? rest[0], 1];
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

// A Databricks source reads a single-quoted literal by Spark's rules, where
// every backslash escapes what follows it; any other by the guess below.
export function tokenizer(source: string, database?: DatabaseVendor): Token[] {
  const tokens: Token[] = [];
  const spark = database === 'Databricks';
  let pos = 0;

  const isChar = () => pos < source.length;

  // MySQL's it\'s: a quote behind an odd run of backslashes, unless what
  // follows may end a literal. 'C:\', is how standard SQL writes a trailing
  // backslash, and so are 'C:\'::text and T-SQL's 'C:\'+name.
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

      if (spark && quote === "'" && char === '\\') {
        const [text, length] = readSparkEscape(source.slice(pos + 1, pos + 10));
        value += text;
        pos += length + 1;
        continue;
      }

      if (char === close && quote === "'" && !spark && isEscapedQuote(value)) {
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
