export const TokenKind = {
  identifier: 1,
  quoted: 2,
  string: 3,
  expression: 4,
  number: 5,
  punctuation: 6,
  doc: 7,
  comment: 8,
  newline: 9,
} as const;

/**
 * AML is indentation-sensitive, so every token carries its line's depth. A
 * newline token opens the line that follows and holds that line's depth, and a
 * synthetic one starts the stream so the first line reads like every other.
 */
export type Token = {
  kind: number;
  value: string;
  line: number;
  depth: number;
};

const SPACE = /[ \t\f\v]/;
const DIGIT = /[0-9]/;
const IDENTIFIER_START = /[A-Za-z_\u0080-\uffff]/;
const IDENTIFIER_PART = /[0-9A-Za-z_#\u0080-\uffff]/;
const INDENT = /^[ \t]*/;
const ESCAPED_HASH = /\\#/g;
// AML spells only \n; anything else decodes to the character it escapes.
const ESCAPE_MAP: Record<string, string> = { n: '\n' };

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let depth = indentDepth(source, 0);

  const push = (kind: number, value: string) => {
    tokens.push({ kind, value, line, depth });
  };

  tokens.push({ kind: TokenKind.newline, value: '', line: 0, depth });

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
      depth = indentDepth(source, index);
      push(TokenKind.newline, '\n');
      line += 1;
      continue;
    }

    if (char === '#') {
      let end = index + 1;
      while (
        end < source.length &&
        source[end] !== '\n' &&
        source[end] !== '\r'
      ) {
        end += 1;
      }
      push(TokenKind.comment, source.slice(index + 1, end).trim());
      index = end;
      continue;
    }

    if (char === '|') {
      if (source.startsWith('|||', index)) {
        const result = readMultilineDoc(source, index + 3);
        push(TokenKind.doc, dedent(result.value));
        index = result.index;
        line += result.lines;
        continue;
      }

      const result = readDoc(source, index + 1);
      push(TokenKind.doc, result.value);
      index = result.index;
      continue;
    }

    if (char === '"') {
      const result = readDelimited(source, index + 1, '"', true, false);
      push(TokenKind.quoted, result.value);
      index = result.index;
      continue;
    }

    if (char === "'") {
      const result = readDelimited(source, index + 1, "'", true, false);
      push(TokenKind.string, result.value);
      index = result.index;
      continue;
    }

    if (char === '`') {
      const result = readDelimited(source, index + 1, '`', false, true);
      push(TokenKind.expression, result.value);
      index = result.index;
      line += result.lines;
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
      push(TokenKind.number, source.slice(index, end));
      index = end;
      continue;
    }

    if (IDENTIFIER_START.test(char)) {
      let end = index + 1;
      while (end < source.length && IDENTIFIER_PART.test(source[end])) {
        end += 1;
      }
      // An identifier ends on a word boundary, so a trailing # is left behind
      // to open a comment while a#b stays one name.
      while (end > index && source[end - 1] === '#') {
        end -= 1;
      }
      push(TokenKind.identifier, source.slice(index, end));
      index = end;
      continue;
    }

    push(TokenKind.punctuation, char);
    index += 1;
  }

  return tokens;
}

function indentDepth(source: string, index: number): number {
  let width = 0;

  for (let i = index; i < source.length; i++) {
    const char = source[i];

    if (char === '\t') {
      width += 1;
    } else if (char === ' ') {
      width += 0.5;
    } else {
      break;
    }
  }

  return Math.round(width) - 1;
}

/**
 * A # stays inside the doc unless a space precedes it, which is what lets
 * | doc with \# escaped # no type end in a comment.
 */
function readDoc(
  source: string,
  start: number
): { value: string; index: number } {
  let index = start;

  while (index < source.length && SPACE.test(source[index])) {
    index += 1;
  }

  if (index > start && source[index] === '"') {
    const quoted = readDelimited(source, index + 1, '"', true, false);
    if (quoted.terminated) {
      return { value: quoted.value, index: quoted.index };
    }
  }

  const buffer: string[] = [];
  index = start;

  while (index < source.length) {
    const char = source[index];

    if (char === '\n' || char === '\r') {
      break;
    }
    if (char !== ' ' && source[index + 1] === '#') {
      buffer.push(char, '#');
      index += 2;
      continue;
    }
    if (char === '#') {
      break;
    }

    buffer.push(char);
    index += 1;
  }

  const value = buffer.join('').trim().replace(ESCAPED_HASH, '#');

  return { value: unquote(value), index };
}

function readMultilineDoc(
  source: string,
  start: number
): { value: string; index: number; lines: number } {
  const closing = source.indexOf('|||', start);
  const end = closing === -1 ? source.length : closing;
  const value = source.slice(start, end);

  return {
    value,
    index: closing === -1 ? source.length : closing + 3,
    lines: value.split('\n').length - 1,
  };
}

function readDelimited(
  source: string,
  start: number,
  closing: string,
  escaped: boolean,
  multiline: boolean
): { value: string; index: number; lines: number; terminated: boolean } {
  const buffer: string[] = [];
  let index = start;
  let lines = 0;

  while (index < source.length) {
    if (source.startsWith(closing, index)) {
      return {
        value: buffer.join(''),
        index: index + closing.length,
        lines,
        terminated: true,
      };
    }

    const char = source[index];

    if (!multiline && (char === '\n' || char === '\r')) {
      break;
    }

    const next = source[index + 1];

    if (escaped && char === '\\' && next !== undefined) {
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

  // An unterminated delimiter takes the rest of the line, or of the file when it
  // may span lines, rather than throwing; the caller degrades one line, not the
  // document.
  return { value: buffer.join(''), index, lines, terminated: false };
}

function unquote(value: string): string {
  const quote = value[0];

  return value.length > 1 &&
    (quote === '"' || quote === "'") &&
    value.endsWith(quote)
    ? value.slice(1, -1)
    : value;
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
