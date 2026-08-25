import { describe, expect, it } from 'vite-plus/test';

import {
  Token,
  tokenize,
  TokenKind,
} from '@/utils/schema-dbml-parser/tokenizer';

const shape = (source: string): Array<[number, string]> =>
  tokenize(source).map((token: Token) => [token.kind, token.value]);

const values = (source: string): string[] =>
  tokenize(source)
    .filter(token => token.kind !== TokenKind.newline)
    .map(token => token.value);

describe('schema-dbml-parser/tokenizer', () => {
  it('reads a bare identifier', () => {
    expect(shape('Table')).toEqual([[TokenKind.identifier, 'Table']]);
  });

  it('reads an identifier holding digits and underscores', () => {
    expect(values('user_2 _leading')).toEqual(['user_2', '_leading']);
  });

  it('reads a non-ASCII identifier', () => {
    expect(shape('사용자')).toEqual([[TokenKind.identifier, '사용자']]);
  });

  it('drops spaces and tabs between tokens', () => {
    expect(values('a \t b')).toEqual(['a', 'b']);
  });

  describe('line terminators', () => {
    it('emits one token per line break', () => {
      expect(shape('a\nb')).toEqual([
        [TokenKind.identifier, 'a'],
        [TokenKind.newline, '\n'],
        [TokenKind.identifier, 'b'],
      ]);
    });

    it('reads CRLF and a lone CR as one break each', () => {
      expect(
        tokenize('a\r\nb\rc').filter(token => token.kind === TokenKind.newline)
      ).toHaveLength(2);
    });

    it('keeps a break inside braces, which delimit an element body', () => {
      expect(
        tokenize('{\na\n}').filter(token => token.kind === TokenKind.newline)
      ).toHaveLength(2);
    });

    it('suppresses a break inside a bracket, which wraps a settings list', () => {
      expect(
        tokenize('[a,\nb]').filter(token => token.kind === TokenKind.newline)
      ).toHaveLength(0);
    });

    it('suppresses a break inside a parenthesis', () => {
      expect(
        tokenize('(a,\nb)').filter(token => token.kind === TokenKind.newline)
      ).toHaveLength(0);
    });

    it('resumes emitting breaks once the bracket closes', () => {
      expect(
        tokenize('[a,\nb]\nc').filter(token => token.kind === TokenKind.newline)
      ).toHaveLength(1);
    });
  });

  describe('comments', () => {
    it('drops a line comment without eating its line break', () => {
      expect(shape('a // note\nb')).toEqual([
        [TokenKind.identifier, 'a'],
        [TokenKind.newline, '\n'],
        [TokenKind.identifier, 'b'],
      ]);
    });

    it('drops a single-line block comment without a break', () => {
      expect(shape('a /* note */ b')).toEqual([
        [TokenKind.identifier, 'a'],
        [TokenKind.identifier, 'b'],
      ]);
    });

    it('leaves one break behind a block comment that spans lines', () => {
      expect(shape('a /* one\ntwo */ b')).toEqual([
        [TokenKind.identifier, 'a'],
        [TokenKind.newline, '\n'],
        [TokenKind.identifier, 'b'],
      ]);
    });

    it('drops an unterminated block comment', () => {
      expect(values('a /* never closed')).toEqual(['a']);
    });
  });

  describe('quoted identifiers', () => {
    it('reads a quoted name as its own kind', () => {
      expect(shape('"user name"')).toEqual([[TokenKind.quoted, 'user name']]);
    });

    it('decodes an escaped quote and backslash', () => {
      expect(values('"we\\"ird\\\\path"')).toEqual(['we"ird\\path']);
    });

    it('decodes an escaped line terminator', () => {
      expect(values('"a\\nb\\rc\\td"')).toEqual(['a\nb\rc\td']);
    });

    it('keeps an unknown escape as the character it names', () => {
      expect(values('"a\\qb"')).toEqual(['aqb']);
    });

    it('takes the rest of the file when the quote never closes', () => {
      expect(values('"never closed')).toEqual(['never closed']);
    });
  });

  describe('strings', () => {
    it('reads a single-quoted string as its own kind', () => {
      expect(shape("'hello'")).toEqual([[TokenKind.string, 'hello']]);
    });

    it('decodes an escaped single quote', () => {
      expect(values("'it\\'s'")).toEqual(["it's"]);
    });

    it('reads a triple-quoted string and strips the common indent', () => {
      expect(values("'''\n    one\n    two\n  '''")).toEqual(['one\ntwo']);
    });

    it('keeps relative indentation inside a triple-quoted string', () => {
      expect(values("'''\n  one\n    two\n'''")).toEqual(['one\n  two']);
    });

    it('reads an empty triple-quoted string', () => {
      expect(values("''''''")).toEqual(['']);
    });
  });

  describe('expressions', () => {
    it('reads a backtick expression as its own kind', () => {
      expect(shape('`now()`')).toEqual([[TokenKind.expression, 'now()']]);
    });

    it('leaves a backslash alone, which a backtick cannot escape', () => {
      expect(values('`a\\b`')).toEqual(['a\\b']);
    });

    it('reads an expression spanning lines', () => {
      expect(values('`one\ntwo`')).toEqual(['one\ntwo']);
    });
  });

  describe('numbers', () => {
    it('reads an integer', () => {
      expect(shape('42')).toEqual([[TokenKind.number, '42']]);
    });

    it('reads a decimal', () => {
      expect(values('1.5')).toEqual(['1.5']);
    });

    it('reads an exponent', () => {
      expect(values('1e3')).toEqual(['1e3']);
    });

    it('stops before a trailing dot, which is a path separator', () => {
      expect(values('1.')).toEqual(['1', '.']);
    });

    it('leaves the sign to the parser', () => {
      expect(values('-1')).toEqual(['-', '1']);
    });
  });

  describe('relationship operators', () => {
    it.each([
      ['<', '<'],
      ['>', '>'],
      ['<>', '<>'],
      ['?<?', '?<?'],
      ['?>', '?>'],
      ['<?', '<?'],
      ['?<>?', '?<>?'],
      ['-?', '-?'],
    ])('reads %s as one operator token', (source, expected) => {
      expect(shape(source)).toEqual([[TokenKind.operator, expected]]);
    });

    it('reads a bare dash as punctuation, since it is also a sign', () => {
      expect(shape('-')).toEqual([[TokenKind.punctuation, '-']]);
    });

    it('reads a lone question mark as punctuation', () => {
      expect(shape('?')).toEqual([[TokenKind.punctuation, '?']]);
    });

    it('separates an operator from the names around it', () => {
      expect(values('a.b<c.d')).toEqual(['a', '.', 'b', '<', 'c', '.', 'd']);
    });
  });

  it('reads every structural character as punctuation', () => {
    expect(shape('{}[](),:.~#')).toEqual([
      [TokenKind.punctuation, '{'],
      [TokenKind.punctuation, '}'],
      [TokenKind.punctuation, '['],
      [TokenKind.punctuation, ']'],
      [TokenKind.punctuation, '('],
      [TokenKind.punctuation, ')'],
      [TokenKind.punctuation, ','],
      [TokenKind.punctuation, ':'],
      [TokenKind.punctuation, '.'],
      [TokenKind.punctuation, '~'],
      [TokenKind.punctuation, '#'],
    ]);
  });

  it('returns nothing for an empty source', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('numbers the line each token was read on', () => {
    expect(
      tokenize('a\nb\n\nc')
        .filter(token => token.kind === TokenKind.identifier)
        .map(token => token.line)
    ).toEqual([1, 2, 4]);
  });
});
