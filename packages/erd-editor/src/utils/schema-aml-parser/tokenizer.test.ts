import { describe, expect, it } from 'vite-plus/test';

import {
  Token,
  tokenize,
  TokenKind,
} from '@/utils/schema-aml-parser/tokenizer';

const FULL_AML = `#
# Full Schema AML
#

users # simplest entity
  id uid pk
  first_name varchar unique=name
  last_name varchar unique=name
  email varchar unique check
  is_admin bool=false

cms.posts as p # entity in schema
  id int pk {autoIncrement, tags: [id]}
  title varchar(100) unique check(\`title <> ''\`)
  status post_status
  content varchar nullable
  settings json nullable
    slug string unique
    publish_at date
    publish_by -> users(id)
    tags "string[]"
    category json
      id number index
      name string
  created_at "timestamp with time zone"
  created_by int -> users(id)

post_members
  post_id uuid pk=post_members_pk -> cms.posts(id)
  user_id int pk=post_members_pk -> users(id)
  role varchar(10)=author check(\`role IN ('author', 'editor')\`)=members_role_chk

"legacy schema"."post member details" # special entity name
  post_id uuid pk
  user_id int pk
  "index" int=0 | keyword attribute name
  "added by" int nullable -> users(id) | special attribute name

rel "legacy schema"."post member details"(post_id, user_id) -> post_members(post_id, user_id)

comments as c {color: "#ccc", tags: [utils, "owner:infra"]} |||
  a table with most options
  looks quite complex but not intended to be used all together ^^
||| # several additional props
  id uuid pk=comment_pk
  item_kind comment_item(User, Post) index=item |||
    polymorphic column for polymorphic relation
    used with both item_kind and item_id
  |||
  item_id int index=item
  content | doc with \\# escaped # no type
  created_by -> users # attribute type should default to target column is not set

rel comments(item_id) -item_kind=User> users(id)
rel comments(item_id) -item_kind=Post> cms.posts(id) {onDelete: cascade}

db1.web.public.legacy_slug
  old_slug slug check(\`old_slug <> '' AND new_slug <> ''\`)=slug_check
  new_slug slug check=slug_check # composite check, add it to every attribute, predicate can be defined once
  cur_slug varchar nullable -> p(settings.slug)

organizations
  id int pk <> users | many-to-many relation
  name varchar(50)
  content box nullable

identity...profiles
  id int pk -- users(id) | one-to-one relation

admins {view}
  id
  first_name
  last_name
  email

guests {view: "SELECT *\\nFROM users\\nWHERE is_admin = false"} # a view without attributes but with definition

type slug | anonymous type
type uid int {tags: [generic]} # alias type
type cms.post_status (draft, published, archived) # enum type
type position {x int, y int} # struct type
type box \`(INPUT = lower, OUTPUT = lower, INTERNALLENGTH = 16)\` # custom type

namespace social.

social_accounts | entity with no attribute

rel social_accounts <> users | natural many-to-many relation
`;

// The stream opens with a synthetic newline holding the first line's depth, so
// every helper below drops it and one spec covers it on its own.
const tail = (source: string): Token[] => tokenize(source).slice(1);

const shape = (source: string): Array<[number, string]> =>
  tail(source).map((token: Token) => [token.kind, token.value]);

const values = (source: string): string[] =>
  tail(source)
    .filter(token => token.kind !== TokenKind.newline)
    .map(token => token.value);

const depths = (source: string): number[] =>
  tokenize(source)
    .filter(token => token.kind === TokenKind.newline)
    .map(token => token.depth);

describe('schema-aml-parser/tokenizer', () => {
  describe('the synthetic opener', () => {
    it('is the only token of an empty source', () => {
      expect(tokenize('')).toEqual([
        { kind: TokenKind.newline, value: '', line: 0, depth: -1 },
      ]);
    });

    it('carries the depth of the first line', () => {
      expect(tokenize('  id int')[0]).toEqual({
        kind: TokenKind.newline,
        value: '',
        line: 0,
        depth: 0,
      });
    });
  });

  describe('identifiers', () => {
    it('reads a bare identifier', () => {
      expect(shape('users')).toEqual([[TokenKind.identifier, 'users']]);
    });

    it('reads an identifier holding digits and underscores', () => {
      expect(values('user_2 _leading')).toEqual(['user_2', '_leading']);
    });

    it('reads a non-ASCII identifier', () => {
      expect(shape('사용자')).toEqual([[TokenKind.identifier, '사용자']]);
    });

    it('leaves a keyword as an identifier, in the case it was written', () => {
      expect(shape('Index pk NULLABLE')).toEqual([
        [TokenKind.identifier, 'Index'],
        [TokenKind.identifier, 'pk'],
        [TokenKind.identifier, 'NULLABLE'],
      ]);
    });

    it('keeps an inner hash inside the name', () => {
      expect(shape('a#b')).toEqual([[TokenKind.identifier, 'a#b']]);
    });

    it('leaves a trailing hash behind, which opens a comment', () => {
      expect(shape('a# note')).toEqual([
        [TokenKind.identifier, 'a'],
        [TokenKind.comment, 'note'],
      ]);
    });

    it('reads a hash after a space as a comment', () => {
      expect(shape('a #b')).toEqual([
        [TokenKind.identifier, 'a'],
        [TokenKind.comment, 'b'],
      ]);
    });

    it('drops spaces and tabs between tokens', () => {
      expect(values('a \t b')).toEqual(['a', 'b']);
    });
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
      expect(shape('a\r\nb\rc')).toEqual([
        [TokenKind.identifier, 'a'],
        [TokenKind.newline, '\n'],
        [TokenKind.identifier, 'b'],
        [TokenKind.newline, '\n'],
        [TokenKind.identifier, 'c'],
      ]);
    });

    it('terminates a line inside a parenthesis, which never spans lines', () => {
      expect(shape('(a,\nb)')).toEqual([
        [TokenKind.punctuation, '('],
        [TokenKind.identifier, 'a'],
        [TokenKind.punctuation, ','],
        [TokenKind.newline, '\n'],
        [TokenKind.identifier, 'b'],
        [TokenKind.punctuation, ')'],
      ]);
    });

    it('numbers the line each token was read on', () => {
      expect(
        tokenize('a\nb\n\nc')
          .filter(token => token.kind === TokenKind.identifier)
          .map(token => token.line)
      ).toEqual([1, 2, 4]);
    });
  });

  describe('indent depth', () => {
    it('reads an unindented line as -1', () => {
      expect(depths('a\nb')).toEqual([-1, -1]);
    });

    it('counts a space as half a level', () => {
      expect(depths('a\n  b\n    c')).toEqual([-1, 0, 1]);
    });

    it('counts a tab as a whole level', () => {
      expect(depths('a\n\tb\n\t\tc')).toEqual([-1, 0, 1]);
    });

    it('rounds a mixed indent', () => {
      expect(depths('a\n\t  b')).toEqual([-1, 1]);
    });

    it('rounds an odd number of spaces up', () => {
      expect(depths('a\n b\n   c')).toEqual([-1, 0, 1]);
    });

    it('reads a blank line as unindented', () => {
      expect(depths('a\n\n  b')).toEqual([-1, -1, 0]);
    });

    it('reads the empty line after a trailing break as unindented', () => {
      expect(depths('  a\n')).toEqual([0, -1]);
    });

    it('gives every token the depth of the line it sits on', () => {
      expect(
        tokenize('a\n  b\n    c')
          .filter(token => token.kind === TokenKind.identifier)
          .map(token => token.depth)
      ).toEqual([-1, 0, 1]);
    });
  });

  describe('comments', () => {
    it('reads a comment without its hash', () => {
      expect(shape('# note')).toEqual([[TokenKind.comment, 'note']]);
    });

    it('trims the comment', () => {
      expect(shape('#   spaced   ')).toEqual([[TokenKind.comment, 'spaced']]);
    });

    it('reads a bare hash as an empty comment', () => {
      expect(shape('#')).toEqual([[TokenKind.comment, '']]);
    });

    it('ends the comment at the line break', () => {
      expect(shape('a # note\nb')).toEqual([
        [TokenKind.identifier, 'a'],
        [TokenKind.comment, 'note'],
        [TokenKind.newline, '\n'],
        [TokenKind.identifier, 'b'],
      ]);
    });
  });

  describe('docs', () => {
    it('reads the rest of the line as a doc', () => {
      expect(shape('| plain doc')).toEqual([[TokenKind.doc, 'plain doc']]);
    });

    it('unescapes a hash and ends the doc at the comment', () => {
      expect(shape('| doc with \\# escaped # no type')).toEqual([
        [TokenKind.doc, 'doc with # escaped'],
        [TokenKind.comment, 'no type'],
      ]);
    });

    it('keeps a hash glued to the word before it', () => {
      expect(shape('| tag#1')).toEqual([[TokenKind.doc, 'tag#1']]);
    });

    it('ends the doc at a hash preceded by a space', () => {
      expect(shape('| tag #1')).toEqual([
        [TokenKind.doc, 'tag'],
        [TokenKind.comment, '1'],
      ]);
    });

    it('reads an empty doc when a hash opens it', () => {
      expect(shape('|#note')).toEqual([
        [TokenKind.doc, ''],
        [TokenKind.comment, 'note'],
      ]);
    });

    it('ends the doc at the line break', () => {
      expect(shape('| d\nb')).toEqual([
        [TokenKind.doc, 'd'],
        [TokenKind.newline, '\n'],
        [TokenKind.identifier, 'b'],
      ]);
    });

    it('keeps a spaced hash inside a quoted doc', () => {
      expect(shape('| "a # b"')).toEqual([[TokenKind.doc, 'a # b']]);
    });

    it('decodes an escape inside a quoted doc', () => {
      expect(values('| "a\\nb"')).toEqual(['a\nb']);
    });

    it('reads a comment after a quoted doc', () => {
      expect(shape('| "d" # c')).toEqual([
        [TokenKind.doc, 'd'],
        [TokenKind.comment, 'c'],
      ]);
    });

    it('drops the quotes of a doc that is nothing but a quoted value', () => {
      expect(shape('|"foo"')).toEqual([[TokenKind.doc, 'foo']]);
    });

    it('keeps the quotes when they do not wrap the whole doc', () => {
      expect(shape('|"a" b')).toEqual([[TokenKind.doc, '"a" b']]);
    });

    it('falls back to a plain doc when the quote never closes', () => {
      expect(shape('| "oops')).toEqual([[TokenKind.doc, '"oops']]);
    });
  });

  describe('multi-line docs', () => {
    it('strips the common indent', () => {
      expect(values('|||\n  one\n  two\n|||')).toEqual(['one\ntwo']);
    });

    it('keeps relative indentation', () => {
      expect(values('|||\n  one\n    two\n|||')).toEqual(['one\n  two']);
    });

    it('reads an empty multi-line doc', () => {
      expect(values('||||||')).toEqual(['']);
    });

    it('reads a comment after the closing fence', () => {
      expect(shape('|||a||| # c')).toEqual([
        [TokenKind.doc, 'a'],
        [TokenKind.comment, 'c'],
      ]);
    });

    it('takes the rest of the file when the fence never closes', () => {
      expect(values('|||\n  one')).toEqual(['one']);
    });

    it('counts the lines it spans', () => {
      expect(
        tokenize('|||\na\n|||\nx').filter(
          token => token.kind === TokenKind.identifier
        )[0].line
      ).toBe(4);
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
      expect(values('"a\\nb"')).toEqual(['a\nb']);
    });

    it('keeps an unknown escape as the character it names', () => {
      expect(values('"a\\tb"')).toEqual(['atb']);
    });

    it('takes the rest of the line when the quote never closes', () => {
      expect(values('"never closed\nb')).toEqual(['never closed', 'b']);
    });
  });

  describe('strings', () => {
    it('reads a single-quoted string as its own kind', () => {
      expect(shape("'hello'")).toEqual([[TokenKind.string, 'hello']]);
    });

    it('decodes an escaped single quote', () => {
      expect(values("'it\\'s'")).toEqual(["it's"]);
    });

    it('takes the rest of the line when the quote never closes', () => {
      expect(values("'oops\nb")).toEqual(['oops', 'b']);
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

    it('takes the rest of the file when the backtick never closes', () => {
      expect(values('`oops\nb')).toEqual(['oops\nb']);
    });
  });

  describe('numbers', () => {
    it('reads an integer', () => {
      expect(shape('42')).toEqual([[TokenKind.number, '42']]);
    });

    it('reads a decimal', () => {
      expect(values('1.5')).toEqual(['1.5']);
    });

    it('stops before a trailing dot, which is a path separator', () => {
      expect(values('1.')).toEqual(['1', '.']);
    });

    it('leaves the sign to the parser', () => {
      expect(values('-1')).toEqual(['-', '1']);
    });

    it('reads no exponent, which AML has no notation for', () => {
      expect(values('1e3')).toEqual(['1', 'e3']);
    });
  });

  it('reads every structural character as punctuation', () => {
    expect(shape('*[]:,{}-.=><()')).toEqual([
      [TokenKind.punctuation, '*'],
      [TokenKind.punctuation, '['],
      [TokenKind.punctuation, ']'],
      [TokenKind.punctuation, ':'],
      [TokenKind.punctuation, ','],
      [TokenKind.punctuation, '{'],
      [TokenKind.punctuation, '}'],
      [TokenKind.punctuation, '-'],
      [TokenKind.punctuation, '.'],
      [TokenKind.punctuation, '='],
      [TokenKind.punctuation, '>'],
      [TokenKind.punctuation, '<'],
      [TokenKind.punctuation, '('],
      [TokenKind.punctuation, ')'],
    ]);
  });

  it('splits a relation into its parts', () => {
    expect(values('rel a.b -> c:d')).toEqual([
      'rel',
      'a',
      '.',
      'b',
      '-',
      '>',
      'c',
      ':',
      'd',
    ]);
  });

  describe('the reference document', () => {
    it('tokenizes without throwing', () => {
      expect(() => tokenize(FULL_AML)).not.toThrow();
    });

    it('reaches the last statement', () => {
      expect(values(FULL_AML)).toContain('social_accounts');
    });

    it('reads nothing but AML characters as punctuation', () => {
      const punctuation = new Set(
        tokenize(FULL_AML)
          .filter(token => token.kind === TokenKind.punctuation)
          .map(token => token.value)
      );

      expect([...punctuation].sort()).toEqual([
        '(',
        ')',
        ',',
        '-',
        '.',
        ':',
        '<',
        '=',
        '>',
        '[',
        ']',
        '{',
        '}',
      ]);
    });

    it('nests three levels deep', () => {
      expect(Math.max(...depths(FULL_AML))).toBe(2);
    });

    it('reads the escaped doc and the comment behind it', () => {
      const line = tokenize(FULL_AML).filter(token => token.line === 51);

      expect(line.map(token => [token.kind, token.value])).toEqual([
        [TokenKind.identifier, 'content'],
        [TokenKind.doc, 'doc with # escaped'],
        [TokenKind.comment, 'no type'],
        [TokenKind.newline, '\n'],
      ]);
    });

    it('reads the multi-line doc as one dedented token', () => {
      expect(
        tokenize(FULL_AML)
          .filter(token => token.kind === TokenKind.doc)
          .map(token => token.value)
      ).toContain(
        'a table with most options\nlooks quite complex but not intended to be used all together ^^'
      );
    });
  });
});
