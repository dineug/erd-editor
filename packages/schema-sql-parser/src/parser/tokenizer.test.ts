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
    it('marks every quoting style with its opening delimiter', () => {
      expect(tokenizer('`a` "b" \'c\' [d]').map(token => token.quoted)).toEqual(
        ['`', '"', "'", '[']
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
        { type: TokenType.string, value: 'my table', quoted: '[' },
      ]);
    });

    it('keeps break characters inside brackets', () => {
      expect(tokenizer('[a.b,c(d)]')).toEqual([
        { type: TokenType.string, value: 'a.b,c(d)', quoted: '[' },
      ]);
    });

    it('produces an empty string token for an empty bracket pair', () => {
      expect(tokenizer('[]')).toEqual([
        { type: TokenType.string, value: '', quoted: '[' },
      ]);
    });

    // ]] is no escape here: a nested array literal closes on it, and read as
    // one it would carry the literal on through the rest of the source.
    it('ends a bracket at its first closing bracket, even a doubled one', () => {
      expect(pairs(tokenizer('ARRAY[[1],[2]], b'))).toEqual([
        ['string', 'ARRAY'],
        ['string', '[1'],
        ['comma', ','],
        ['string', '2'],
        ['rightBracket', ']'],
        ['comma', ','],
        ['string', 'b'],
      ]);
    });

    it('consumes the rest of the source when the bracket is unterminated', () => {
      expect(tokenizer('[abc')).toEqual([
        { type: TokenType.string, value: 'abc', quoted: '[' },
      ]);
    });

    it('continues tokenizing after a closed bracket', () => {
      expect(pairs(tokenizer('[db].[tbl]'))).toEqual([
        ['string', 'db'],
        ['period', '.'],
        ['string', 'tbl'],
      ]);
    });

    // An unpaired ] used to fall through to the bare-string branch, which
    // pushed an empty token without advancing: the loop never ended.
    it('emits a token for an unpaired closing bracket and moves on', () => {
      expect(pairs(tokenizer(']'))).toEqual([['rightBracket', ']']]);
      expect(pairs(tokenizer('a] b'))).toEqual([
        ['string', 'a'],
        ['rightBracket', ']'],
        ['string', 'b'],
      ]);
    });
  });

  describe('double quote quoting', () => {
    it('reads a double quoted identifier as a single string token', () => {
      expect(tokenizer('"my table"')).toEqual([
        { type: TokenType.string, value: 'my table', quoted: '"' },
      ]);
    });

    it('keeps break characters inside double quotes', () => {
      expect(tokenizer('"a.b;c"')).toEqual([
        { type: TokenType.string, value: 'a.b;c', quoted: '"' },
      ]);
    });

    it('produces an empty string token for an empty double quote pair', () => {
      expect(tokenizer('""')).toEqual([
        { type: TokenType.string, value: '', quoted: '"' },
      ]);
    });

    it('reads a doubled double quote as one quote of the identifier', () => {
      expect(tokenizer('"a""b" """"')).toEqual([
        { type: TokenType.string, value: 'a"b', quoted: '"' },
        { type: TokenType.string, value: '"', quoted: '"' },
      ]);
    });

    it('consumes the rest of the source when the double quote is unterminated', () => {
      expect(tokenizer('"abc')).toEqual([
        { type: TokenType.string, value: 'abc', quoted: '"' },
      ]);
    });
  });

  describe('single quote quoting', () => {
    it('reads a single quoted literal as a single string token', () => {
      expect(tokenizer("'hello world'")).toEqual([
        { type: TokenType.string, value: 'hello world', quoted: "'" },
      ]);
    });

    it('keeps break characters inside single quotes', () => {
      expect(tokenizer("'(1,2)'")).toEqual([
        { type: TokenType.string, value: '(1,2)', quoted: "'" },
      ]);
    });

    it('produces an empty string token for an empty single quote pair', () => {
      expect(tokenizer("''")).toEqual([
        { type: TokenType.string, value: '', quoted: "'" },
      ]);
    });

    // Read as two literals, 'it''s' left a stray s behind and a COMMENT kept
    // only it.
    it('reads a doubled single quote as one quote of the literal', () => {
      expect(tokenizer("'it''s' '''' '',x")).toEqual([
        { type: TokenType.string, value: "it's", quoted: "'" },
        { type: TokenType.string, value: "'", quoted: "'" },
        { type: TokenType.string, value: '', quoted: "'" },
        { type: TokenType.comma, value: ',' },
        { type: TokenType.string, value: 'x' },
      ]);
    });

    // MySQL's it\'s: read as the end of the literal, it left a stray s behind.
    it('reads a backslashed quote that cannot end the literal as an escape', () => {
      expect(tokenizer(String.raw`'it\'s' 'a\\\'b' '\'x\''`)).toEqual([
        { type: TokenType.string, value: "it's", quoted: "'" },
        { type: TokenType.string, value: String.raw`a\\'b`, quoted: "'" },
        { type: TokenType.string, value: "'x'", quoted: "'" },
      ]);
    });

    // Standard SQL keeps a backslash as it is: 'C:\' is a whole literal, and
    // T-SQL joins one to the next with a +.
    it.each([' ', ',', ';', ')', ']', ':', '|', '+', ''])(
      'ends the literal at a backslashed quote followed by "%s"',
      end => {
        expect(tokenizer(String.raw`'C:\'` + end)[0]).toEqual({
          type: TokenType.string,
          value: 'C:\\',
          quoted: "'",
        });
      }
    );

    it('ends the literal at a quote behind an even run of backslashes', () => {
      expect(tokenizer(String.raw`'a\\'b`)[0]).toEqual({
        type: TokenType.string,
        value: String.raw`a\\`,
        quoted: "'",
      });
    });

    it('consumes the rest of the source when the single quote is unterminated', () => {
      expect(tokenizer("'abc")).toEqual([
        { type: TokenType.string, value: 'abc', quoted: "'" },
      ]);
    });
  });

  describe('a prefixed single quote literal', () => {
    const literal = (value: string, prefix: string) => ({
      type: TokenType.string,
      value,
      quoted: "'",
      prefix,
    });

    it('reads the literal behind its prefix as one token that keeps it', () => {
      expect(tokenizer("N'a,b' E'a  b' n'(none)'")).toEqual([
        literal('a,b', 'N'),
        literal('a  b', 'E'),
        literal('(none)', 'n'),
      ]);
    });

    it('reads every prefix a vendor writes', () => {
      expect(
        tokenizer("B'01' x'ff' U&'d' _utf8mb4'a' _latin1'b'").map(
          token => token.prefix
        )
      ).toEqual(['B', 'x', 'U&', '_utf8mb4', '_latin1']);
    });

    it('reads a doubled quote inside it as one quote', () => {
      expect(tokenizer("N'it''s', b")).toEqual([
        literal("it's", 'N'),
        { type: TokenType.comma, value: ',' },
        { type: TokenType.string, value: 'b' },
      ]);
    });

    it('reads it by the Spark rules for Databricks', () => {
      expect(tokenizer(String.raw`X'a\'b'`, 'Databricks')).toEqual([
        literal("a'b", 'X'),
      ]);
    });

    it('keeps the quote in a word that is no prefix', () => {
      expect(tokenizer("it's ON'x' _'y'")).toEqual([
        { type: TokenType.string, value: "it's" },
        { type: TokenType.string, value: "ON'x'" },
        { type: TokenType.string, value: "_'y'" },
      ]);
    });
  });

  // Spark reads every backslash in a single-quoted literal as an escape, so a
  // Databricks document is read by its rules rather than by the guess above.
  describe('a Databricks single quote literal', () => {
    const databricks = (source: string) => tokenizer(source, 'Databricks');
    const valueOf = (source: string) => databricks(source)[0].value;

    it('reads a backslash as escaping the quote or backslash after it', () => {
      expect(databricks(String.raw`'it\'s' 'a\\b' 'C:\\' x`)).toEqual([
        { type: TokenType.string, value: "it's", quoted: "'" },
        { type: TokenType.string, value: String.raw`a\b`, quoted: "'" },
        { type: TokenType.string, value: 'C:\\', quoted: "'" },
        { type: TokenType.string, value: 'x' },
      ]);
    });

    it('reads on past a backslashed quote, whatever follows it', () => {
      expect(valueOf(String.raw`'C:\', x'`)).toBe("C:', x");
      expect(valueOf(String.raw`'C:\'+name'`)).toBe("C:'+name");
    });

    it('ends the literal at a quote behind an escaped backslash', () => {
      expect(databricks(String.raw`'a\\' b`)).toEqual([
        { type: TokenType.string, value: 'a\\', quoted: "'" },
        { type: TokenType.string, value: 'b' },
      ]);
    });

    it('reads the named escapes as Spark does', () => {
      expect(valueOf(String.raw`'\n\t\r\b\0\Z\%\_\"\q'`)).toBe(
        '\n\t\r\b\0\x1a\\%\\_"q'
      );
    });

    it('reads the unicode and octal escapes as Spark does', () => {
      expect(valueOf(String.raw`'\u0041\u00e9\U0001F600\101\012'`)).toBe(
        'Aé😀A\n'
      );
      expect(valueOf(String.raw`'\U00110000'`)).toBe('\udc00\udc00');
    });

    it('reads a short unicode or octal escape as an escaped letter', () => {
      expect(valueOf(String.raw`'\u004' '\10'`)).toBe('u004');
      expect(databricks(String.raw`'\u004' '\10'`)[1].value).toBe('10');
    });

    it('still reads a doubled single quote as one quote', () => {
      expect(valueOf("'it''s'")).toBe("it's");
    });

    it('keeps a backslash the source ends on', () => {
      expect(valueOf("'abc\\")).toBe('abc\\');
    });

    it('leaves the other quoting styles as they are', () => {
      expect(databricks('"C:\\" `a\\` [b\\]')).toEqual([
        { type: TokenType.string, value: 'C:\\', quoted: '"' },
        { type: TokenType.string, value: 'a\\', quoted: '`' },
        { type: TokenType.string, value: 'b\\', quoted: '[' },
      ]);
    });

    it('reads by the guess for any other vendor', () => {
      expect(tokenizer(String.raw`'a\\b'`, 'MySQL')[0].value).toBe(
        String.raw`a\\b`
      );
      expect(tokenizer(String.raw`'a\\b'`)[0].value).toBe(String.raw`a\\b`);
    });
  });

  describe('backtick quoting', () => {
    it('reads a backtick quoted identifier as a single string token', () => {
      expect(tokenizer('`my table`')).toEqual([
        { type: TokenType.string, value: 'my table', quoted: '`' },
      ]);
    });

    it('keeps break characters inside backticks', () => {
      expect(tokenizer('`a.b`')).toEqual([
        { type: TokenType.string, value: 'a.b', quoted: '`' },
      ]);
    });

    it('produces an empty string token for an empty backtick pair', () => {
      expect(tokenizer('``')).toEqual([
        { type: TokenType.string, value: '', quoted: '`' },
      ]);
    });

    it('reads a doubled backtick as one backtick of the identifier', () => {
      expect(tokenizer('`a``b`')).toEqual([
        { type: TokenType.string, value: 'a`b', quoted: '`' },
      ]);
    });

    it('consumes the rest of the source when the backtick is unterminated', () => {
      expect(tokenizer('`abc')).toEqual([
        { type: TokenType.string, value: 'abc', quoted: '`' },
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

    it('reads a typed literal prefix into the token of its literal', () => {
      expect(tokenizer("N'hello'")).toEqual([
        { type: TokenType.string, value: 'hello', quoted: "'", prefix: 'N' },
      ]);
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
