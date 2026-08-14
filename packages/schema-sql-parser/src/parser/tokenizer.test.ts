import { describe, expect, it } from 'vitest';

import { Token, tokenizer, TokenType } from '@/parser/tokenizer';

const pairs = (tokens: Token[]) =>
  tokens.map(({ type, value }) => [type, value]);

describe('TokenType', () => {
  it('maps every key to its own name', () => {
    expect(TokenType).toEqual({
      string: 'string',
      leftParent: 'leftParent',
      rightParent: 'rightParent',
      leftBracket: 'leftBracket',
      rightBracket: 'rightBracket',
      comma: 'comma',
      period: 'period',
      equal: 'equal',
      semicolon: 'semicolon',
    });
  });
});

describe('tokenizer', () => {
  describe('empty and whitespace input', () => {
    it('returns no tokens for an empty source', () => {
      expect(tokenizer('')).toEqual([]);
    });

    it('skips every kind of whitespace without emitting a token', () => {
      expect(tokenizer(' \t\r\n  ')).toEqual([]);
    });

    it('skips leading and trailing whitespace around a value', () => {
      expect(tokenizer('  \n\tname \r\n ')).toEqual([
        { type: TokenType.string, value: 'name' },
      ]);
    });
  });

  describe('single character tokens', () => {
    it('tokenizes a left parenthesis', () => {
      expect(tokenizer('(')).toEqual([
        { type: TokenType.leftParent, value: '(' },
      ]);
    });

    it('tokenizes a right parenthesis', () => {
      expect(tokenizer(')')).toEqual([
        { type: TokenType.rightParent, value: ')' },
      ]);
    });

    it('tokenizes a comma', () => {
      expect(tokenizer(',')).toEqual([{ type: TokenType.comma, value: ',' }]);
    });

    it('tokenizes a period', () => {
      expect(tokenizer('.')).toEqual([{ type: TokenType.period, value: '.' }]);
    });

    it('tokenizes an equal sign standing on its own', () => {
      expect(tokenizer(' = ')).toEqual([{ type: TokenType.equal, value: '=' }]);
    });

    it('tokenizes a semicolon', () => {
      expect(tokenizer(';')).toEqual([
        { type: TokenType.semicolon, value: ';' },
      ]);
    });

    it('tokenizes punctuation packed together without whitespace', () => {
      expect(pairs(tokenizer('(),.;'))).toEqual([
        ['leftParent', '('],
        ['rightParent', ')'],
        ['comma', ','],
        ['period', '.'],
        ['semicolon', ';'],
      ]);
    });
  });

  describe('bracket quoting', () => {
    it('reads a bracket quoted identifier as a single string token', () => {
      expect(tokenizer('[my table]')).toEqual([
        { type: TokenType.string, value: 'my table' },
      ]);
    });

    it('keeps break characters inside brackets', () => {
      expect(tokenizer('[a.b,c(d)]')).toEqual([
        { type: TokenType.string, value: 'a.b,c(d)' },
      ]);
    });

    it('produces an empty string token for an empty bracket pair', () => {
      expect(tokenizer('[]')).toEqual([{ type: TokenType.string, value: '' }]);
    });

    it('consumes the rest of the source when the bracket is unterminated', () => {
      expect(tokenizer('[abc')).toEqual([
        { type: TokenType.string, value: 'abc' },
      ]);
    });

    it('continues tokenizing after a closed bracket', () => {
      expect(pairs(tokenizer('[db].[tbl]'))).toEqual([
        ['string', 'db'],
        ['period', '.'],
        ['string', 'tbl'],
      ]);
    });
  });

  describe('double quote quoting', () => {
    it('reads a double quoted identifier as a single string token', () => {
      expect(tokenizer('"my table"')).toEqual([
        { type: TokenType.string, value: 'my table' },
      ]);
    });

    it('keeps break characters inside double quotes', () => {
      expect(tokenizer('"a.b;c"')).toEqual([
        { type: TokenType.string, value: 'a.b;c' },
      ]);
    });

    it('produces an empty string token for an empty double quote pair', () => {
      expect(tokenizer('""')).toEqual([{ type: TokenType.string, value: '' }]);
    });

    it('consumes the rest of the source when the double quote is unterminated', () => {
      expect(tokenizer('"abc')).toEqual([
        { type: TokenType.string, value: 'abc' },
      ]);
    });
  });

  describe('single quote quoting', () => {
    it('reads a single quoted literal as a single string token', () => {
      expect(tokenizer("'hello world'")).toEqual([
        { type: TokenType.string, value: 'hello world' },
      ]);
    });

    it('keeps break characters inside single quotes', () => {
      expect(tokenizer("'(1,2)'")).toEqual([
        { type: TokenType.string, value: '(1,2)' },
      ]);
    });

    it('produces an empty string token for an empty single quote pair', () => {
      expect(tokenizer("''")).toEqual([{ type: TokenType.string, value: '' }]);
    });

    it('consumes the rest of the source when the single quote is unterminated', () => {
      expect(tokenizer("'abc")).toEqual([
        { type: TokenType.string, value: 'abc' },
      ]);
    });
  });

  describe('backtick quoting', () => {
    it('reads a backtick quoted identifier as a single string token', () => {
      expect(tokenizer('`my table`')).toEqual([
        { type: TokenType.string, value: 'my table' },
      ]);
    });

    it('keeps break characters inside backticks', () => {
      expect(tokenizer('`a.b`')).toEqual([
        { type: TokenType.string, value: 'a.b' },
      ]);
    });

    it('produces an empty string token for an empty backtick pair', () => {
      expect(tokenizer('``')).toEqual([{ type: TokenType.string, value: '' }]);
    });

    it('consumes the rest of the source when the backtick is unterminated', () => {
      expect(tokenizer('`abc')).toEqual([
        { type: TokenType.string, value: 'abc' },
      ]);
    });
  });

  describe('bare strings', () => {
    it('splits bare words on whitespace', () => {
      expect(pairs(tokenizer('CREATE TABLE users'))).toEqual([
        ['string', 'CREATE'],
        ['string', 'TABLE'],
        ['string', 'users'],
      ]);
    });

    it('breaks a bare word on every break character', () => {
      expect(pairs(tokenizer('a;b,c(d)e.f'))).toEqual([
        ['string', 'a'],
        ['semicolon', ';'],
        ['string', 'b'],
        ['comma', ','],
        ['string', 'c'],
        ['leftParent', '('],
        ['string', 'd'],
        ['rightParent', ')'],
        ['string', 'e'],
        ['period', '.'],
        ['string', 'f'],
      ]);
    });

    it('does not break a bare word on an equal sign', () => {
      expect(pairs(tokenizer('a=b'))).toEqual([['string', 'a=b']]);
    });

    it('emits an equal token only when it starts a token', () => {
      expect(pairs(tokenizer('a = b'))).toEqual([
        ['string', 'a'],
        ['equal', '='],
        ['string', 'b'],
      ]);
    });

    it('stops a bare word at the end of the source', () => {
      expect(pairs(tokenizer('tail'))).toEqual([['string', 'tail']]);
    });

    it('treats a quote in the middle of a bare word as part of the word', () => {
      expect(pairs(tokenizer("a'b'"))).toEqual([['string', "a'b'"]]);
    });
  });

  describe('statements', () => {
    it('tokenizes a create table statement', () => {
      expect(pairs(tokenizer('CREATE TABLE `user` (id INT);'))).toEqual([
        ['string', 'CREATE'],
        ['string', 'TABLE'],
        ['string', 'user'],
        ['leftParent', '('],
        ['string', 'id'],
        ['string', 'INT'],
        ['rightParent', ')'],
        ['semicolon', ';'],
      ]);
    });

    it('tokenizes a schema qualified alter table statement', () => {
      expect(pairs(tokenizer('ALTER TABLE ONLY "public"."user"'))).toEqual([
        ['string', 'ALTER'],
        ['string', 'TABLE'],
        ['string', 'ONLY'],
        ['string', 'public'],
        ['period', '.'],
        ['string', 'user'],
      ]);
    });

    it('tokenizes a default literal with a comment string', () => {
      expect(
        pairs(tokenizer(`name VARCHAR(10) DEFAULT 'a,b' COMMENT 'hi there'`))
      ).toEqual([
        ['string', 'name'],
        ['string', 'VARCHAR'],
        ['leftParent', '('],
        ['string', '10'],
        ['rightParent', ')'],
        ['string', 'DEFAULT'],
        ['string', 'a,b'],
        ['string', 'COMMENT'],
        ['string', 'hi there'],
      ]);
    });

    it('tokenizes statements spread over multiple lines', () => {
      const source = ['CREATE TABLE a (', '  id INT', ');'].join('\n');

      expect(pairs(tokenizer(source))).toEqual([
        ['string', 'CREATE'],
        ['string', 'TABLE'],
        ['string', 'a'],
        ['leftParent', '('],
        ['string', 'id'],
        ['string', 'INT'],
        ['rightParent', ')'],
        ['semicolon', ';'],
      ]);
    });

    it('cannot reach DOUBLE PRECISION as one token because whitespace splits it', () => {
      expect(tokenizer('DOUBLE PRECISION')).toEqual([
        { type: TokenType.string, value: 'DOUBLE' },
        { type: TokenType.string, value: 'PRECISION' },
      ]);
    });
  });
});
