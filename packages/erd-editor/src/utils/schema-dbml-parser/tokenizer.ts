export const TokenKind = {
  identifier: 1,
  quoted: 2,
  string: 3,
  expression: 4,
  number: 5,
  punctuation: 6,
  operator: 7,
  newline: 8,
} as const;

export type Token = {
  kind: number;
  value: string;
  line: number;
};

const SPACE = /[ \t\f\v]/;
const DIGIT = /[0-9]/;
const IDENTIFIER_START = /[A-Za-z_\u0080-\uffff]/;
const IDENTIFIER_PART = /[0-9A-Za-z_\u0080-\uffff]/;
const INDENT = /^[ \t]*/;
const ESCAPE_MAP: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  v: '\v',
  '0': '\0',
};

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  // Only `[` and `(` suppress a line terminator. A `{` opens an element body,
  // whose entries are line-delimited: `Table t { a int b varchar }` is an error.
  let depth = 0;

  const push = (kind: number, value: string) => {
    tokens.push({ kind, value, line });
  };

  const pushNewline = () => {
    if (depth === 0) {
      push(TokenKind.newline, '\n');
    }
  };

  while (index < source.length) {
    const char = source[index];

    if (SPACE.test(char)) {
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      if (char === '\r' && source[index + 1] === '\n') {
        index += 1;
      }
      index += 1;
      pushNewline();
      line += 1;
      continue;
    }

    if (char === '/' && source[index + 1] === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') {
        index += 1;
      }
      continue;
    }

    if (char === '/' && source[index + 1] === '*') {
      index += 2;
      let broke = false;

      while (index < source.length) {
        if (source[index] === '*' && source[index + 1] === '/') {
          index += 2;
          break;
        }
        if (source[index] === '\n') {
          broke = true;
          line += 1;
        }
        index += 1;
      }

      if (broke) {
        pushNewline();
      }
      continue;
    }

    if (char === '"') {
      const result = readDelimited(source, index + 1, '"', true);
      index = result.index;
      line += result.lines;
      push(TokenKind.quoted, result.value);
      continue;
    }

    if (char === "'") {
      if (source.startsWith("'''", index)) {
        const result = readDelimited(source, index + 3, "'''", true);
        index = result.index;
        line += result.lines;
        push(TokenKind.string, dedent(result.value));
        continue;
      }

      const result = readDelimited(source, index + 1, "'", true);
      index = result.index;
      line += result.lines;
      push(TokenKind.string, result.value);
      continue;
    }

    if (char === '`') {
      const result = readDelimited(source, index + 1, '`', false);
      index = result.index;
      line += result.lines;
      push(TokenKind.expression, result.value);
      continue;
    }

    if (DIGIT.test(char)) {
      let end = index;
      while (end < source.length && DIGIT.test(source[end])) {
        end += 1;
      }
      if (source[end] === '.' && DIGIT.test(source[end + 1] ?? '')) {
        end += 1;
        while (end < source.length && DIGIT.test(source[end])) {
          end += 1;
        }
      }
      if (
        (source[end] === 'e' || source[end] === 'E') &&
        DIGIT.test(source[end + 1] ?? '')
      ) {
        end += 2;
        while (end < source.length && DIGIT.test(source[end])) {
          end += 1;
        }
      }
      push(TokenKind.number, source.slice(index, end));
      index = end;
      continue;
    }

    if (IDENTIFIER_START.test(char)) {
      let end = index + 1;
      while (end < source.length && IDENTIFIER_PART.test(source[end])) {
        end += 1;
      }
      push(TokenKind.identifier, source.slice(index, end));
      index = end;
      continue;
    }

    const operator = readOperator(source, index);
    if (operator) {
      push(TokenKind.operator, operator);
      index += operator.length;
      continue;
    }

    if (char === '[' || char === '(') {
      depth += 1;
    } else if (char === ']' || char === ')') {
      depth = Math.max(0, depth - 1);
    }

    push(TokenKind.punctuation, char);
    index += 1;
  }

  return tokens;
}

/**
 * `-` is left to the parser, which reads it as a sign inside a value and as a
 * relationship operator between two endpoints; `-?` cannot be either.
 */
function readOperator(source: string, index: number): string {
  const char = source[index];

  if (char === '-') {
    return source[index + 1] === '?' ? '-?' : '';
  }

  if (char !== '<' && char !== '>' && char !== '?') {
    return '';
  }

  const match = /^\??(?:<>|<|>|-)\??/.exec(source.slice(index));

  return match && /[<>-]/.test(match[0]) ? match[0] : '';
}

function readDelimited(
  source: string,
  start: number,
  closing: string,
  escaped: boolean
): { value: string; index: number; lines: number } {
  const buffer: string[] = [];
  let index = start;
  let lines = 0;

  while (index < source.length) {
    if (source.startsWith(closing, index)) {
      return { value: buffer.join(''), index: index + closing.length, lines };
    }

    const char = source[index];

    if (escaped && char === '\\' && index + 1 < source.length) {
      const next = source[index + 1];
      buffer.push(ESCAPE_MAP[next] ?? next);
      index += 2;
      continue;
    }

    if (char === '\n') {
      lines += 1;
    }

    buffer.push(char);
    index += 1;
  }

  // An unterminated delimiter takes the rest of the file rather than throwing;
  // the caller degrades one element, not the document.
  return { value: buffer.join(''), index, lines };
}

function dedent(value: string): string {
  const lines = value.replace(/\r\n|\r/g, '\n').split('\n');

  if (lines[0]?.trim() === '') {
    lines.shift();
  }
  if (lines.length && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  const indents = lines
    .filter(line => line.trim() !== '')
    .map(line => (INDENT.exec(line)?.[0] ?? '').length);
  const common = indents.length ? Math.min(...indents) : 0;

  return lines.map(line => line.slice(common)).join('\n');
}
