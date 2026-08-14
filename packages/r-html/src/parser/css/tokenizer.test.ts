import { describe, expect, it } from 'vitest';

import { MARKER } from '@/constants';
import { tokenizer, TokenType } from '@/parser/css/tokenizer';

describe('css tokenizer', () => {
  it('returns no token for an empty source', () => {
    expect(tokenizer('')).toEqual([]);
  });

  it('reads a bare identifier as a single string token', () => {
    expect(tokenizer('a')).toEqual([{ type: TokenType.string, value: 'a' }]);
  });

  it('groups consecutive spaces into one whiteSpace token', () => {
    expect(tokenizer(' a ')).toEqual([
      { type: TokenType.whiteSpace, value: ' ' },
      { type: TokenType.string, value: 'a' },
      { type: TokenType.whiteSpace, value: ' ' },
    ]);

    expect(tokenizer('\t\ta')).toEqual([
      { type: TokenType.whiteSpace, value: '\t\t' },
      { type: TokenType.string, value: 'a' },
    ]);
  });

  it('emits a dedicated nextLine token for line breaks', () => {
    expect(tokenizer('a\nb')).toEqual([
      { type: TokenType.string, value: 'a' },
      { type: TokenType.nextLine, value: '\n' },
      { type: TokenType.string, value: 'b' },
    ]);
  });

  describe('colon', () => {
    it('reads a declaration as name / colon / whiteSpace / value / semicolon', () => {
      expect(tokenizer('color: red;')).toEqual([
        { type: TokenType.string, value: 'color' },
        { type: TokenType.colon, value: ':' },
        { type: TokenType.whiteSpace, value: ' ' },
        { type: TokenType.string, value: 'red' },
        { type: TokenType.semicolon, value: ';' },
      ]);
    });

    it('keeps the whole value - including spaces - up to the semicolon', () => {
      expect(tokenizer('margin:   0 auto;')).toEqual([
        { type: TokenType.string, value: 'margin' },
        { type: TokenType.colon, value: ':' },
        { type: TokenType.whiteSpace, value: '   ' },
        { type: TokenType.string, value: '0 auto' },
        { type: TokenType.semicolon, value: ';' },
      ]);
    });

    it('stops at the end of the source when the semicolon is missing', () => {
      expect(tokenizer('color: red')).toEqual([
        { type: TokenType.string, value: 'color' },
        { type: TokenType.colon, value: ':' },
        { type: TokenType.whiteSpace, value: ' ' },
        { type: TokenType.string, value: 'red' },
      ]);
    });

    it('treats a colon not followed by whiteSpace as a pseudo class colon', () => {
      expect(tokenizer('a:hover')).toEqual([
        { type: TokenType.string, value: 'a' },
        { type: TokenType.colon, value: ':' },
        { type: TokenType.string, value: 'hover' },
      ]);
    });

    it('handles a trailing colon at the end of the source', () => {
      expect(tokenizer('a:')).toEqual([
        { type: TokenType.string, value: 'a' },
        { type: TokenType.colon, value: ':' },
      ]);
    });
  });

  describe('attribute selector', () => {
    it('reads a double quoted attribute value', () => {
      expect(tokenizer('[type="text"]')).toEqual([
        { type: TokenType.leftBracket, value: '[' },
        { type: TokenType.string, value: 'type' },
        { type: TokenType.equal, value: '=' },
        { type: TokenType.string, value: 'text' },
        { type: TokenType.rightBracket, value: ']' },
      ]);
    });

    it('reads a single quoted attribute value', () => {
      expect(tokenizer("[a='b']")).toEqual([
        { type: TokenType.leftBracket, value: '[' },
        { type: TokenType.string, value: 'a' },
        { type: TokenType.equal, value: '=' },
        { type: TokenType.string, value: 'b' },
        { type: TokenType.rightBracket, value: ']' },
      ]);
    });

    it('reads a value-less attribute', () => {
      expect(tokenizer('[disabled]')).toEqual([
        { type: TokenType.leftBracket, value: '[' },
        { type: TokenType.string, value: 'disabled' },
        { type: TokenType.rightBracket, value: ']' },
      ]);
    });

    it('emits no rightBracket when the attribute is never closed', () => {
      expect(tokenizer('[a')).toEqual([
        { type: TokenType.leftBracket, value: '[' },
        { type: TokenType.string, value: 'a' },
      ]);
    });
  });

  describe('single character tokens', () => {
    const cases: Array<[string, TokenType]> = [
      ['>', TokenType.gt],
      ['~', TokenType.tilde],
      ['+', TokenType.plus],
      ['#', TokenType.sharp],
      ['*', TokenType.asterisk],
      ['&', TokenType.ampersand],
      ['.', TokenType.period],
      [',', TokenType.comma],
      [';', TokenType.semicolon],
      ['{', TokenType.leftBrace],
      ['}', TokenType.rightBrace],
      ['@', TokenType.commercialAt],
    ];

    it.each(cases)('reads %s as its own token type', (char, type) => {
      expect(tokenizer(char)).toEqual([{ type, value: char }]);
    });

    it('reads every punctuation character in one pass', () => {
      const tokens = tokenizer('> ~ + # * & . , ; { } @');
      const types = tokens
        .filter(token => token.type !== TokenType.whiteSpace)
        .map(token => token.type);

      expect(types).toEqual(cases.map(([, type]) => type));
    });

    it('has no rightBracket rule, so a stray ] becomes a string token', () => {
      expect(tokenizer(']')).toEqual([{ type: TokenType.string, value: ']' }]);
    });
  });

  describe('comments', () => {
    it('tokenizes a multi line comment with explicit open / close string tokens', () => {
      expect(tokenizer('/* hi */')).toEqual([
        { type: TokenType.string, value: '/*' },
        { type: TokenType.whiteSpace, value: ' ' },
        { type: TokenType.string, value: 'hi' },
        { type: TokenType.whiteSpace, value: ' ' },
        { type: TokenType.string, value: '*/' },
      ]);
    });

    it('keeps line breaks inside a multi line comment', () => {
      expect(tokenizer('/*\n*/')).toEqual([
        { type: TokenType.string, value: '/*' },
        { type: TokenType.nextLine, value: '\n' },
        { type: TokenType.string, value: '*/' },
      ]);
    });

    it('emits no closing token for an unterminated multi line comment', () => {
      expect(tokenizer('/* hi')).toEqual([
        { type: TokenType.string, value: '/*' },
        { type: TokenType.whiteSpace, value: ' ' },
        { type: TokenType.string, value: 'hi' },
      ]);
    });

    it('ends a single line comment at the line break and resumes style mode', () => {
      expect(tokenizer('// hi\na')).toEqual([
        { type: TokenType.string, value: '//' },
        { type: TokenType.whiteSpace, value: ' ' },
        { type: TokenType.string, value: 'hi' },
        { type: TokenType.nextLine, value: '\n' },
        { type: TokenType.string, value: 'a' },
      ]);
    });

    it('ends a single line comment at the end of the source', () => {
      expect(tokenizer('// hi')).toEqual([
        { type: TokenType.string, value: '//' },
        { type: TokenType.whiteSpace, value: ' ' },
        { type: TokenType.string, value: 'hi' },
      ]);
    });

    it('does not apply style rules inside a single line comment', () => {
      expect(tokenizer('// a-b\n')).toEqual([
        { type: TokenType.string, value: '//' },
        { type: TokenType.whiteSpace, value: ' ' },
        { type: TokenType.string, value: 'a-b' },
        { type: TokenType.nextLine, value: '\n' },
      ]);
    });
  });

  describe('parenthesis group', () => {
    it('collapses a parenthesised group into one string token', () => {
      expect(tokenizer('calc(1 + 2)')).toEqual([
        { type: TokenType.string, value: 'calc' },
        { type: TokenType.string, value: '(1 + 2)' },
      ]);
    });

    it('appends the literal "undefined" when the group is never closed (known bug)', () => {
      expect(tokenizer('(abc')).toEqual([
        { type: TokenType.string, value: '(abcundefined' },
      ]);
    });
  });

  it('splits the dynamic marker into two commercialAt tokens plus its id', () => {
    expect(tokenizer(`${MARKER}_0_;`)).toEqual([
      { type: TokenType.commercialAt, value: '@' },
      { type: TokenType.commercialAt, value: '@' },
      { type: TokenType.string, value: `${MARKER.replace('@@', '')}_0_` },
      { type: TokenType.semicolon, value: ';' },
    ]);
  });

  it('tokenizes a complete rule set', () => {
    expect(tokenizer('.a { color: red; }')).toEqual([
      { type: TokenType.period, value: '.' },
      { type: TokenType.string, value: 'a' },
      { type: TokenType.whiteSpace, value: ' ' },
      { type: TokenType.leftBrace, value: '{' },
      { type: TokenType.whiteSpace, value: ' ' },
      { type: TokenType.string, value: 'color' },
      { type: TokenType.colon, value: ':' },
      { type: TokenType.whiteSpace, value: ' ' },
      { type: TokenType.string, value: 'red' },
      { type: TokenType.semicolon, value: ';' },
      { type: TokenType.whiteSpace, value: ' ' },
      { type: TokenType.rightBrace, value: '}' },
    ]);
  });

  it('tokenizes an at rule prelude', () => {
    expect(tokenizer("@import 'x';")).toEqual([
      { type: TokenType.commercialAt, value: '@' },
      { type: TokenType.string, value: 'import' },
      { type: TokenType.whiteSpace, value: ' ' },
      { type: TokenType.string, value: "'x'" },
      { type: TokenType.semicolon, value: ';' },
    ]);
  });
});
