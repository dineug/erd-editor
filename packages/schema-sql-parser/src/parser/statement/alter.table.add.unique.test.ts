import { describe, expect, it } from 'vite-plus/test';

import { RefPos, SortType, StatementType } from '@/parser/statement';
import { alterTableAddUniqueParser } from '@/parser/statement/alter.table.add.unique';
import { Token, tokenizer } from '@/parser/tokenizer';

const parse = (source: string, start = 0) => {
  const tokens = tokenizer(source);
  const $pos: RefPos = { value: start };
  const ast = alterTableAddUniqueParser(tokens, $pos);
  return { ast, $pos, tokens };
};

const names = (source: string) =>
  parse(source).ast.columns.map(column => column.name);

const parseTokens = (tokens: Token[], start = 0) => {
  const $pos: RefPos = { value: start };
  const ast = alterTableAddUniqueParser(tokens, $pos);
  return { ast, $pos };
};

describe('alterTableAddUniqueParser', () => {
  it('stops on the terminator instead of reading the statement after it', () => {
    const { ast, $pos, tokens } = parse(
      "ALTER TABLE users ADD UNIQUE (email); COMMENT ON TABLE orders IS 'a';"
    );

    expect(ast.name).toBe('users');
    expect(tokens[$pos.value].value).toBe('COMMENT');
  });

  it('parses an anonymous unique constraint over a single column', () => {
    const { ast } = parse('ALTER TABLE users ADD UNIQUE (email);');

    expect(ast).toEqual({
      type: StatementType.alterTableAddUnique,
      name: 'users',
      constraintName: '',
      columns: [{ name: 'email', sort: SortType.asc }],
    });
  });

  it('collects every column of a composite unique constraint in order', () => {
    expect(names('ALTER TABLE users ADD UNIQUE (last_name, email);')).toEqual([
      'last_name',
      'email',
    ]);
  });

  it('keeps the table name and the constraint name', () => {
    const { ast } = parse(
      'ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);'
    );

    expect(ast.name).toBe('users');
    expect(ast.constraintName).toBe('uq_users_email');
    expect(ast.columns).toEqual([{ name: 'email', sort: SortType.asc }]);
  });

  it('reads the MySQL UNIQUE KEY and UNIQUE INDEX forms by their index name', () => {
    const key = parse('ALTER TABLE users ADD UNIQUE KEY uq_ab (a, b DESC);');
    const index = parse('ALTER TABLE users ADD UNIQUE INDEX uq_c (c);');

    expect(key.ast.constraintName).toBe('uq_ab');
    expect(key.ast.columns).toEqual([
      { name: 'a', sort: SortType.asc },
      { name: 'b', sort: SortType.desc },
    ]);
    expect(index.ast.constraintName).toBe('uq_c');
    expect(index.ast.columns).toEqual([{ name: 'c', sort: SortType.asc }]);
  });

  it('prefers the index name to the CONSTRAINT symbol, as MySQL does', () => {
    const { ast } = parse(
      'ALTER TABLE t ADD CONSTRAINT sym UNIQUE KEY idx_ab (a, b);'
    );

    expect(ast.constraintName).toBe('idx_ab');
    expect(ast.columns.map(column => column.name)).toEqual(['a', 'b']);
  });

  it('keeps the CONSTRAINT symbol of an anonymous UNIQUE KEY', () => {
    const { ast } = parse(
      'ALTER TABLE t ADD CONSTRAINT sym UNIQUE KEY (a, b);'
    );

    expect(ast.constraintName).toBe('sym');
  });

  it('reads no key modifier as the name', () => {
    const cases = [
      'ALTER TABLE t ADD CONSTRAINT uq UNIQUE NONCLUSTERED (a, b);',
      'ALTER TABLE t ADD CONSTRAINT uq UNIQUE NULLS NOT DISTINCT (a, b);',
      'ALTER TABLE t ADD CONSTRAINT uq UNIQUE KEY USING BTREE (a, b);',
      'ALTER TABLE t ADD UNIQUE KEY uq USING HASH (a, b);',
    ];

    for (const source of cases) {
      const { ast } = parse(source);

      expect(ast.constraintName).toBe('uq');
      expect(ast.columns.map(column => column.name)).toEqual(['a', 'b']);
    }
  });

  it('records no column for a key with an expression part', () => {
    expect(names('ALTER TABLE t ADD UNIQUE KEY uq ((lower(a)), b);')).toEqual(
      []
    );
  });

  it('keeps the column of a key part with a prefix length', () => {
    expect(names('ALTER TABLE t ADD UNIQUE KEY uq (email(191), b);')).toEqual([
      'email',
      'b',
    ]);
  });

  it('skips the ONLY keyword of the PostgreSQL dialect', () => {
    const { ast } = parse(
      'ALTER TABLE ONLY users ADD CONSTRAINT uq_users_email UNIQUE (email);'
    );

    expect(ast).toEqual({
      type: StatementType.alterTableAddUnique,
      name: 'users',
      constraintName: 'uq_users_email',
      columns: [{ name: 'email', sort: SortType.asc }],
    });
  });

  it('parses ALTER TABLE ONLY without a named constraint', () => {
    const { ast } = parse('ALTER TABLE ONLY users ADD UNIQUE (email);');

    expect(ast.name).toBe('users');
    expect(ast.constraintName).toBe('');
    expect(names('ALTER TABLE ONLY users ADD UNIQUE (email);')).toEqual([
      'email',
    ]);
  });

  it('uses the last segment of a schema qualified table name', () => {
    const { ast } = parse('ALTER TABLE public.users ADD UNIQUE (email);');

    expect(ast.name).toBe('users');
  });

  it('unwraps quoted and bracketed identifiers', () => {
    const { ast } = parse('ALTER TABLE `users` ADD UNIQUE ([email], "name");');

    expect(ast.name).toBe('users');
    expect(ast.columns.map(column => column.name)).toEqual(['email', 'name']);
  });

  it('keeps the schema name when the token after the period is not a string', () => {
    const { ast } = parse('ALTER TABLE public.(x) ADD UNIQUE (email);');

    expect(ast.name).toBe('public');
    expect(ast.columns.map(column => column.name)).toEqual(['email']);
  });

  it('leaves the name empty when TABLE is not followed by an identifier', () => {
    const { ast } = parse('ALTER TABLE , ADD UNIQUE (email);');

    expect(ast.name).toBe('');
    expect(ast.columns.map(column => column.name)).toEqual(['email']);
  });

  it('tolerates a CONSTRAINT keyword that is not followed by a name', () => {
    const { ast } = parse('ALTER TABLE users ADD CONSTRAINT (a) UNIQUE (b);');

    expect(ast.name).toBe('users');
    expect(ast.constraintName).toBe('');
    expect(ast.columns.map(column => column.name)).toEqual(['b']);
  });

  it('reads a CONSTRAINT with no symbol as naming nothing', () => {
    const { ast } = parse('ALTER TABLE users ADD CONSTRAINT UNIQUE (a, b);');

    expect(ast.constraintName).toBe('');
    expect(ast.columns.map(column => column.name)).toEqual(['a', 'b']);
  });

  it('collects no columns when UNIQUE has no column list', () => {
    const { ast } = parse('ALTER TABLE users ADD UNIQUE;');

    expect(ast.columns).toEqual([]);
  });

  it('collects the columns parsed so far when the list is unterminated', () => {
    const { ast, $pos, tokens } = parse('ALTER TABLE users ADD UNIQUE (email');

    expect(ast.columns.map(column => column.name)).toEqual(['email']);
    expect($pos.value).toBeGreaterThanOrEqual(tokens.length);
  });

  it('stops at the next statement and leaves the position on its first token', () => {
    const { ast, $pos, tokens } = parse(
      'ALTER TABLE users ADD UNIQUE (email); CREATE TABLE t (id int);'
    );

    expect(ast.columns.map(column => column.name)).toEqual(['email']);
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('returns an empty statement when a new statement follows ALTER immediately', () => {
    const { ast, $pos } = parse('ALTER SELECT');

    expect(ast).toEqual({
      type: StatementType.alterTableAddUnique,
      name: '',
      constraintName: '',
      columns: [],
    });
    expect($pos.value).toBe(1);
  });

  it('returns an empty statement when there are no tokens after ALTER', () => {
    const { ast, $pos } = parse('ALTER');

    expect(ast.name).toBe('');
    expect(ast.columns).toEqual([]);
    expect($pos.value).toBe(1);
  });

  it('starts parsing from the given position instead of the beginning', () => {
    const source = 'USE mydb; ALTER TABLE users ADD UNIQUE (email);';
    const tokens = tokenizer(source);
    const start = tokens.findIndex(token => token.value === 'ALTER');
    const { ast } = parseTokens(tokens, start);

    expect(start).toBe(3);
    expect(ast.name).toBe('users');
    expect(ast.columns.map(column => column.name)).toEqual(['email']);
  });

  it('reads the MySQL UNIQUE KEY <name> (...) form over one column', () => {
    const { ast } = parse('ALTER TABLE users ADD UNIQUE KEY uq_email (email);');

    expect(ast.name).toBe('users');
    expect(ast.constraintName).toBe('uq_email');
    expect(ast.columns.map(column => column.name)).toEqual(['email']);
  });
});
