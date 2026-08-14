import { describe, expect, it } from 'vitest';

import { RefPos, SortType, StatementType } from '@/parser/statement';
import { createIndexParser } from '@/parser/statement/create.index';
import { tokenizer } from '@/parser/tokenizer';

function parse(sql: string, start = 0) {
  const tokens = tokenizer(sql);
  const $pos: RefPos = { value: start };
  const ast = createIndexParser(tokens, $pos);
  return { ast, tokens, $pos };
}

describe('createIndexParser', () => {
  it('parses a simple non unique index', () => {
    const { ast } = parse('CREATE INDEX idx_a ON t (a);');

    expect(ast).toEqual({
      type: StatementType.createIndex,
      name: 'idx_a',
      unique: false,
      tableName: 't',
      columns: [{ name: 'a', sort: SortType.asc }],
    });
  });

  it('parses a unique index with explicit sort directions', () => {
    const { ast } = parse('CREATE UNIQUE INDEX idx_a ON t (a DESC, b ASC);');

    expect(ast.unique).toBe(true);
    expect(ast.name).toBe('idx_a');
    expect(ast.tableName).toBe('t');
    expect(ast.columns).toEqual([
      { name: 'a', sort: SortType.desc },
      { name: 'b', sort: SortType.asc },
    ]);
  });

  it('defaults every column of a multi column index to ASC', () => {
    const { ast } = parse('CREATE INDEX idx ON t (a, b, c);');

    expect(ast.columns).toEqual([
      { name: 'a', sort: SortType.asc },
      { name: 'b', sort: SortType.asc },
      { name: 'c', sort: SortType.asc },
    ]);
  });

  it('unwraps quoted identifiers', () => {
    const { ast } = parse(
      'CREATE UNIQUE INDEX "idx_a" ON "public_t" ("a" DESC);'
    );

    expect(ast).toEqual({
      type: StatementType.createIndex,
      name: 'idx_a',
      unique: true,
      tableName: 'public_t',
      columns: [{ name: 'a', sort: SortType.desc }],
    });
  });

  it('unwraps MySQL backtick identifiers', () => {
    const { ast } = parse('CREATE INDEX `idx_a` ON `t` (`a`);');

    expect(ast.name).toBe('idx_a');
    expect(ast.tableName).toBe('t');
    expect(ast.columns).toEqual([{ name: 'a', sort: SortType.asc }]);
  });

  it('leaves the table empty when the ON clause is missing', () => {
    const { ast } = parse('CREATE INDEX idx_a;');

    expect(ast.name).toBe('idx_a');
    expect(ast.tableName).toBe('');
    expect(ast.columns).toEqual([]);
  });

  it('leaves the name empty when INDEX is not followed by an identifier', () => {
    const { ast } = parse('CREATE INDEX ;');

    expect(ast.name).toBe('');
    expect(ast.tableName).toBe('');
  });

  it('leaves the table empty when ON is not followed by an identifier', () => {
    const { ast } = parse('CREATE INDEX idx ON (a);');

    expect(ast.name).toBe('idx');
    expect(ast.tableName).toBe('');
    expect(ast.columns).toEqual([]);
  });

  it('records the table without columns when the column list is missing', () => {
    const { ast } = parse('CREATE INDEX idx_a ON t;');

    expect(ast.tableName).toBe('t');
    expect(ast.columns).toEqual([]);
  });

  it('records no column for an empty column list', () => {
    const { ast } = parse('CREATE INDEX idx_a ON t ();');

    expect(ast.columns).toEqual([]);
  });

  it('takes the schema as the table name for a qualified target', () => {
    const { ast } = parse('CREATE INDEX idx_a ON public.t (a);');

    expect(ast.tableName).toBe('public');
    expect(ast.columns).toEqual([]);
  });

  it('uses the next token as the name when the index name is omitted', () => {
    const { ast } = parse('CREATE INDEX ON t (a);');

    expect(ast.name).toBe('ON');
    expect(ast.tableName).toBe('t');
    expect(ast.columns).toEqual([{ name: 'a', sort: SortType.asc }]);
  });

  it('stops before the next statement', () => {
    const { ast, tokens, $pos } = parse(
      'CREATE INDEX idx ON t (a); CREATE TABLE z (i INT);'
    );

    expect(ast.columns).toEqual([{ name: 'a', sort: SortType.asc }]);
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('closes an unterminated column list', () => {
    const { ast, tokens, $pos } = parse('CREATE INDEX idx ON t (a');

    expect(ast.columns).toEqual([{ name: 'a', sort: SortType.asc }]);
    expect($pos.value).toBeGreaterThanOrEqual(tokens.length);
  });

  it('ignores a trailing comma in the column list', () => {
    const { ast } = parse('CREATE INDEX idx ON t (a, b,);');

    expect(ast.columns).toEqual([
      { name: 'a', sort: SortType.asc },
      { name: 'b', sort: SortType.asc },
    ]);
  });

  it('parses a statement that does not start at position 0', () => {
    const { ast, tokens, $pos } = parse(
      'USE mydb; CREATE UNIQUE INDEX idx ON t (a);',
      3
    );

    expect(ast.unique).toBe(true);
    expect(ast.name).toBe('idx');
    expect(ast.tableName).toBe('t');
    expect($pos.value).toBe(tokens.length);
  });
});
