import { describe, expect, it } from 'vite-plus/test';

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
  describe('quoted flag', () => {
    it('marks every quoting style as quoted', () => {
      expect(tokenizer('`a` "b" \'c\' [d]').map(token => token.quoted)).toEqual(
        [true, true, true, true]
      );
    });

    it('leaves a bare word unquoted', () => {
      expect(tokenizer('a').map(token => token.quoted)).toEqual([undefined]);
    });
  });

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
        { type: TokenType.string, value: 'my table', quoted: true },
      ]);
    });

    it('keeps break characters inside brackets', () => {
      expect(tokenizer('[a.b,c(d)]')).toEqual([
        { type: TokenType.string, value: 'a.b,c(d)', quoted: true },
      ]);
    });

    it('produces an empty string token for an empty bracket pair', () => {
      expect(tokenizer('[]')).toEqual([
        { type: TokenType.string, value: '', quoted: true },
      ]);
    });

    it('consumes the rest of the source when the bracket is unterminated', () => {
      expect(tokenizer('[abc')).toEqual([
        { type: TokenType.string, value: 'abc', quoted: true },
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
        { type: TokenType.string, value: 'my table', quoted: true },
      ]);
    });

    it('keeps break characters inside double quotes', () => {
      expect(tokenizer('"a.b;c"')).toEqual([
        { type: TokenType.string, value: 'a.b;c', quoted: true },
      ]);
    });

    it('produces an empty string token for an empty double quote pair', () => {
      expect(tokenizer('""')).toEqual([
        { type: TokenType.string, value: '', quoted: true },
      ]);
    });

    it('consumes the rest of the source when the double quote is unterminated', () => {
      expect(tokenizer('"abc')).toEqual([
        { type: TokenType.string, value: 'abc', quoted: true },
      ]);
    });
  });

  describe('single quote quoting', () => {
    it('reads a single quoted literal as a single string token', () => {
      expect(tokenizer("'hello world'")).toEqual([
        { type: TokenType.string, value: 'hello world', quoted: true },
      ]);
    });

    it('keeps break characters inside single quotes', () => {
      expect(tokenizer("'(1,2)'")).toEqual([
        { type: TokenType.string, value: '(1,2)', quoted: true },
      ]);
    });

    it('produces an empty string token for an empty single quote pair', () => {
      expect(tokenizer("''")).toEqual([
        { type: TokenType.string, value: '', quoted: true },
      ]);
    });

    it('consumes the rest of the source when the single quote is unterminated', () => {
      expect(tokenizer("'abc")).toEqual([
        { type: TokenType.string, value: 'abc', quoted: true },
      ]);
    });
  });

  describe('backtick quoting', () => {
    it('reads a backtick quoted identifier as a single string token', () => {
      expect(tokenizer('`my table`')).toEqual([
        { type: TokenType.string, value: 'my table', quoted: true },
      ]);
    });

    it('keeps break characters inside backticks', () => {
      expect(tokenizer('`a.b`')).toEqual([
        { type: TokenType.string, value: 'a.b', quoted: true },
      ]);
    });

    it('produces an empty string token for an empty backtick pair', () => {
      expect(tokenizer('``')).toEqual([
        { type: TokenType.string, value: '', quoted: true },
      ]);
    });

    it('consumes the rest of the source when the backtick is unterminated', () => {
      expect(tokenizer('`abc')).toEqual([
        { type: TokenType.string, value: 'abc', quoted: true },
      ]);
    });
  });

  describe('sql comments', () => {
    it('drops a line comment and everything it contains', () => {
      expect(pairs(tokenizer('a -- b; c (d)\ne'))).toEqual([
        ['string', 'a'],
        ['string', 'e'],
      ]);
    });

    it('drops a line comment that runs to the end of the source', () => {
      expect(pairs(tokenizer('a -- b'))).toEqual([['string', 'a']]);
    });

    it('ends a bare word at a line comment that has no space in front of it', () => {
      expect(pairs(tokenizer('INT-- pk\nb'))).toEqual([
        ['string', 'INT'],
        ['string', 'b'],
      ]);
    });

    it('drops a block comment and everything it contains', () => {
      expect(pairs(tokenizer('a /* b; c (d) */ e'))).toEqual([
        ['string', 'a'],
        ['string', 'e'],
      ]);
    });

    it('drops a block comment spread over several lines', () => {
      expect(pairs(tokenizer('a /*\n b;\n*/ e'))).toEqual([
        ['string', 'a'],
        ['string', 'e'],
      ]);
    });

    it('ends a bare word at a block comment that has no space in front of it', () => {
      expect(pairs(tokenizer('INT/* pk */b'))).toEqual([
        ['string', 'INT'],
        ['string', 'b'],
      ]);
    });

    it('consumes the rest of the source when the block comment is unterminated', () => {
      expect(pairs(tokenizer('a /* b'))).toEqual([['string', 'a']]);
    });

    it('keeps comment markers that sit inside a quoted value', () => {
      expect(pairs(tokenizer("'a -- b /* c */'"))).toEqual([
        ['string', 'a -- b /* c */'],
      ]);
    });

    it('does not read a single dash as a comment', () => {
      expect(pairs(tokenizer('-1'))).toEqual([['string', '-1']]);
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

    it('breaks a bare word on an equal sign', () => {
      expect(pairs(tokenizer('a=b'))).toEqual([
        ['string', 'a'],
        ['equal', '='],
        ['string', 'b'],
      ]);
    });

    it('emits the same tokens whether or not the equal sign is padded', () => {
      expect(pairs(tokenizer('a = b'))).toEqual(pairs(tokenizer('a=b')));
    });

    it('stops a bare word at the end of the source', () => {
      expect(pairs(tokenizer('tail'))).toEqual([['string', 'tail']]);
    });

    it('treats a quote in the middle of a bare word as part of the word', () => {
      expect(pairs(tokenizer("a'b'"))).toEqual([['string', "a'b'"]]);
    });

    it('keeps a typed literal prefix attached to its literal', () => {
      expect(pairs(tokenizer("N'hello'"))).toEqual([['string', "N'hello'"]]);
    });

    it('splits a MySQL table option written without whitespace', () => {
      expect(pairs(tokenizer("COMMENT='role'"))).toEqual([
        ['string', 'COMMENT'],
        ['equal', '='],
        ['string', 'role'],
      ]);
    });

    it('keeps parentheses inside a quoted option value out of the token stream', () => {
      expect(pairs(tokenizer("COMMENT='(test)bug here!!'"))).toEqual([
        ['string', 'COMMENT'],
        ['equal', '='],
        ['string', '(test)bug here!!'],
      ]);
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
