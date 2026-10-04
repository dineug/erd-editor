import { describe, expect, it } from 'vite-plus/test';

import { DatabaseVendor, RefPos } from '@/parser/statement';
import {
  defaultExpressionParser,
  matchDefaultExpression,
} from '@/parser/statement/default.expression';
import { tokenizer } from '@/parser/tokenizer';

// Reads source as the text right after a DEFAULT, and names the token the
// cursor stops on, '' at the end of the source.
const parse = (source: string, database?: DatabaseVendor) => {
  const tokens = tokenizer(source, database);
  const $pos: RefPos = { value: 0 };
  const value = defaultExpressionParser(tokens, $pos, database);
  return { value, $pos, stop: tokens[$pos.value]?.value ?? '' };
};

const read = (source: string, database?: DatabaseVendor) =>
  parse(source, database).value;

describe('matchDefaultExpression', () => {
  it('spans nothing where no value follows', () => {
    const tokens = tokenizer(', b INT');

    expect(matchDefaultExpression(tokens)(0)).toBe(0);
    expect(matchDefaultExpression(tokens)(tokens.length)).toBe(0);
  });
});

describe('defaultExpressionParser - where it ends', () => {
  it.each<[string, string, string]>([
    ['now(), b INT', 'now()', ','],
    ['0.5)', '0.5', ')'],
    ['(getdate()) NOT NULL, b INT', 'getdate()', 'NOT'],
    ["'x' NULL", "'x'", 'NULL'],
    [
      'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'CURRENT_TIMESTAMP',
      'ON',
    ],
    ["0 COMMENT 'zero'", '0', 'COMMENT'],
    ['1 CHECK (a > 0)', '1', 'CHECK'],
    ['\'a\' COLLATE "C"', "'a'", 'COLLATE'],
    ['0 CONSTRAINT pk PRIMARY KEY', '0', 'CONSTRAINT'],
    ['0 PRIMARY KEY', '0', 'PRIMARY'],
    ['0 UNIQUE', '0', 'UNIQUE'],
    ['0 REFERENCES t (id)', '0', 'REFERENCES'],
    ['0 AUTO_INCREMENT', '0', 'AUTO_INCREMENT'],
    ['0 WITH VALUES', '0', 'WITH'],
    ["'a' CHARACTER SET utf8", "'a'", 'CHARACTER'],
    ['0 NOT DEFERRABLE', '0', 'NOT'],
    ['0 INITIALLY DEFERRED', '0', 'INITIALLY'],
    ['0 FOR [c]', '0', 'FOR'],
    ['newsequentialid() ROWGUIDCOL', 'newsequentialid()', 'ROWGUIDCOL'],
    ['0 SPARSE NULL', '0', 'SPARSE'],
    ['0 MASK m', '0', 'MASK'],
    ['0 STORAGE DISK', '0', 'STORAGE'],
    ['0 COLUMN_FORMAT FIXED', '0', 'COLUMN_FORMAT'],
    ["0 TAG (t = 'v')", '0', 'TAG'],
    ["0 WITH TAG (t = 'v')", '0', 'WITH'],
    ['0 WITH LOCAL', '0', 'WITH'],
    [
      "('now'::text)::timestamp with time zone NOT NULL",
      "('now'::text)::timestamp with time zone",
      'NOT',
    ],
    ['now()::time WITH TIME ZONE, b', 'now()::time WITH TIME ZONE', ','],
    [
      'x::timestamp with local time zone NOT NULL',
      'x::timestamp with local time zone',
      'NOT',
    ],
  ])('reads %s up to what ends it', (source, value, stop) => {
    expect(parse(source)).toMatchObject({ value, stop });
  });

  it('takes the first token as the value even where it is a keyword', () => {
    expect(parse('NULL NOT NULL')).toMatchObject({
      value: 'NULL',
      stop: 'NOT',
    });
  });

  it('keeps the FOR of a sequence call and stops at the one after it', () => {
    expect(parse('NEXT VALUE FOR dbo.seq FOR [id]')).toMatchObject({
      value: 'NEXT VALUE FOR dbo.seq',
      stop: 'FOR',
    });
  });

  it('reads a TAG with no list after it as part of the value', () => {
    expect(parse('0 + tag, b')).toMatchObject({ value: '0 + tag', stop: ',' });
  });

  it('reads the keywords and commas inside a group as part of the value', () => {
    expect(read("(CASE WHEN 1 = 1 THEN 'a' ELSE NULL END), b INT")).toBe(
      "CASE WHEN 1 = 1 THEN 'a' ELSE NULL END"
    );
    expect(read('CAST(0 AS bit) NOT NULL')).toBe('CAST(0 AS bit)');
  });

  it('stops at a terminator a group leaves open, and keeps the cursor there', () => {
    const { value, stop } = parse('(now(; CREATE TABLE u (id INT);');

    expect(value).toBe('(now(');
    expect(stop).toBe(';');
  });

  it('reads nothing where no value follows', () => {
    expect(parse(', b INT')).toMatchObject({ value: '', stop: ',' });
    expect(parse('')).toMatchObject({ value: '', stop: '' });
    expect(parse('] b')).toMatchObject({ value: '', stop: ']' });
  });
});

describe('defaultExpressionParser - spacing', () => {
  it.each<[string, string]>([
    ["nextval ( 'public.s' :: regclass )", "nextval('public.s'::regclass)"],
    ['CONVERT( [bit] ,( 0 ) )', 'CONVERT([bit], (0))'],
    ["now()  AT  TIME ZONE 'utc'", "now() AT TIME ZONE 'utc'"],
    ['seq . nextval', 'seq.nextval'],
    ['0 . 5', '0.5'],
    ["'a'  ||\n  'b'", "'a' || 'b'"],
    ['getdate()+ 1', 'getdate() + 1'],
    ['- (1)', '- (1)'],
    ['ARRAY[1, 2]', 'ARRAY[1, 2]'],
    ["datetime('now','localtime')", "datetime('now', 'localtime')"],
    ['CURRENT_TIMESTAMP(3)', 'CURRENT_TIMESTAMP(3)'],
    ['(a = 1)', 'a = 1'],
    ['(CASE WHEN a >= 1 THEN 1 END)', 'CASE WHEN a >= 1 THEN 1 END'],
    ['a <= 1', 'a <= 1'],
    ['a != 1', 'a != 1'],
    ['a <=> b', 'a <=> b'],
    ['a == 1', 'a == 1'],
    ['f(x => 1)', 'f(x => 1)'],
    ['a <> 1', 'a <> 1'],
    ['NEXT VALUE FOR [dbo].[seq]', 'NEXT VALUE FOR [dbo].[seq]'],
    ['(CASE WHEN [x] > 1 THEN 1 END)', 'CASE WHEN [x] > 1 THEN 1 END'],
    ['ARRAY[CURRENT_DATE]', 'ARRAY[CURRENT_DATE]'],
    ["'{}'::text []", "'{}'"],
    ['(ARRAY[1, 2])[1]', '(ARRAY[1, 2])[1]'],
  ])('writes %s back as %s', (source, value) => {
    expect(read(source)).toBe(value);
  });
});

describe('defaultExpressionParser - what it keeps', () => {
  it.each<[string, string]>([
    ['((0))', '0'],
    ['(getdate())', 'getdate()'],
    ["(N'abc')", "N'abc'"],
    ['((now() + interval 1 day))', 'now() + interval 1 day'],
    ["(now() AT TIME ZONE 'utc'::text)", "now() AT TIME ZONE 'utc'::text"],
    ['(-1)', '-1'],
    ['()', ''],
  ])('drops the parens around the whole of %s', (source, value) => {
    expect(read(source)).toBe(value);
  });

  it('keeps parens that wrap only a part of the value', () => {
    expect(read('(a) + (b)')).toBe('(a) + (b)');
  });

  it.each<[string, string]>([
    ["'draft'::character varying", "'draft'"],
    ["'x'::character varying(20)", "'x'"],
    ['NULL::character varying', 'NULL'],
    ['0::bigint', '0'],
    ['1.5::numeric', '1.5'],
    ['(0)::numeric', '0'],
    ["('a'::text)", "'a'"],
    ["'{}'::text[]", "'{}'"],
    ['\'x\'::"MyType"', "'x'"],
    ["'ok'::public.mood", "'ok'"],
    ['true::boolean', 'true'],
    ["E'a\\nb'::text", "E'a\\nb'"],
    ['B\'0\'::"bit"', "B'0'"],
  ])('drops the cast of the literal %s', (source, value) => {
    expect(read(source)).toBe(value);
  });

  it.each<string>([
    "nextval('t_id_seq'::regclass)",
    'ARRAY[]::text[]',
    "('now'::text)::date",
    "'now'::text::date",
    "'a'::text || 'b'",
    "'a' || 'b'::text",
    '0::int BETWEEN a AND b',
  ])('keeps the casts of %s', source => {
    expect(read(source)).toBe(source);
  });

  it('writes a lone quoted value back as a string literal', () => {
    expect(read("'it''s'")).toBe("'it''s'");
    expect(read('"x"')).toBe("'x'");
    expect(read('("x")')).toBe("'x'");
    expect(read('[x]')).toBe("'x'");
  });

  it.each<[string, string]>([
    ["(N'a,b')", "N'a,b'"],
    ["(N'(none)')", "N'(none)'"],
    ["E'a  b'", "E'a  b'"],
    ["n'it''s'", "n'it''s'"],
    ["b'0'", "b'0'"],
    ["X'ff'", "X'ff'"],
    ["U&'d\\0061t'", "U&'d\\0061t'"],
    ["_utf8mb4'x'", "_utf8mb4'x'"],
    ["(concat(_utf8mb4'a',_utf8mb4'b'))", "concat(_utf8mb4'a', _utf8mb4'b')"],
  ])('keeps the prefix and the text of the literal %s', (source, value) => {
    expect(read(source)).toBe(value);
  });

  it('keeps the quotes of the identifiers inside an expression', () => {
    expect(read('([dbo].[fn]())')).toBe('[dbo].[fn]()');
    expect(read('"s".nextval')).toBe('"s".nextval');
    expect(read('`a` + 1')).toBe('`a` + 1');
    expect(read("lower('A''B')")).toBe("lower('A''B')");
  });

  it('writes a literal back in Spark escapes for Databricks', () => {
    expect(read(String.raw`'it\'s'`, 'Databricks')).toBe(String.raw`'it\'s'`);
    expect(read(String.raw`concat('a', 'it\'s')`, 'Databricks')).toBe(
      String.raw`concat('a', 'it\'s')`
    );
  });
});
