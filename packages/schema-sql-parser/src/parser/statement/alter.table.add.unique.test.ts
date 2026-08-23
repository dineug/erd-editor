import { describe, expect, it } from 'vite-plus/test';

import { RefPos, StatementType } from '@/parser/statement';
import { alterTableAddUniqueParser } from '@/parser/statement/alter.table.add.unique';
import { Token, tokenizer } from '@/parser/tokenizer';

const parse = (source: string, start = 0) => {
  const tokens = tokenizer(source);
  const $pos: RefPos = { value: start };
  const ast = alterTableAddUniqueParser(tokens, $pos);
  return { ast, $pos, tokens };
};

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
      columnNames: ['email'],
    });
  });

  it('collects every column of a composite unique constraint in order', () => {
    const { ast } = parse('ALTER TABLE users ADD UNIQUE (last_name, email);');

    expect(ast.columnNames).toEqual(['last_name', 'email']);
  });

  it('keeps the table name and drops the constraint name', () => {
    const { ast } = parse(
      'ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);'
    );

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['email']);
  });

  it('skips the ONLY keyword of the PostgreSQL dialect', () => {
    const { ast } = parse(
      'ALTER TABLE ONLY users ADD CONSTRAINT uq_users_email UNIQUE (email);'
    );

    expect(ast).toEqual({
      type: StatementType.alterTableAddUnique,
      name: 'users',
      columnNames: ['email'],
    });
  });

  it('parses ALTER TABLE ONLY without a named constraint', () => {
    const { ast } = parse('ALTER TABLE ONLY users ADD UNIQUE (email);');

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['email']);
  });

  it('uses the last segment of a schema qualified table name', () => {
    const { ast } = parse('ALTER TABLE public.users ADD UNIQUE (email);');

    expect(ast.name).toBe('users');
  });

  it('unwraps quoted and bracketed identifiers', () => {
    const { ast } = parse('ALTER TABLE `users` ADD UNIQUE ([email], "name");');

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['email', 'name']);
  });

  it('keeps the schema name when the token after the period is not a string', () => {
    const { ast } = parse('ALTER TABLE public.(x) ADD UNIQUE (email);');

    expect(ast.name).toBe('public');
    expect(ast.columnNames).toEqual(['email']);
  });

  it('leaves the name empty when TABLE is not followed by an identifier', () => {
    const { ast } = parse('ALTER TABLE , ADD UNIQUE (email);');

    expect(ast.name).toBe('');
    expect(ast.columnNames).toEqual(['email']);
  });

  it('tolerates a CONSTRAINT keyword that is not followed by a name', () => {
    const { ast } = parse('ALTER TABLE users ADD CONSTRAINT (a) UNIQUE (b);');

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['b']);
  });

  it('collects no columns when UNIQUE has no column list', () => {
    const { ast } = parse('ALTER TABLE users ADD UNIQUE;');

    expect(ast.columnNames).toEqual([]);
  });

  it('collects the columns parsed so far when the list is unterminated', () => {
    const { ast, $pos, tokens } = parse('ALTER TABLE users ADD UNIQUE (email');

    expect(ast.columnNames).toEqual(['email']);
    expect($pos.value).toBeGreaterThanOrEqual(tokens.length);
  });

  it('stops at the next statement and leaves the position on its first token', () => {
    const { ast, $pos, tokens } = parse(
      'ALTER TABLE users ADD UNIQUE (email); CREATE TABLE t (id int);'
    );

    expect(ast.columnNames).toEqual(['email']);
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('returns an empty statement when a new statement follows ALTER immediately', () => {
    const { ast, $pos } = parse('ALTER SELECT');

    expect(ast).toEqual({
      type: StatementType.alterTableAddUnique,
      name: '',
      columnNames: [],
    });
    expect($pos.value).toBe(1);
  });

  it('returns an empty statement when there are no tokens after ALTER', () => {
    const { ast, $pos } = parse('ALTER');

    expect(ast.name).toBe('');
    expect(ast.columnNames).toEqual([]);
    expect($pos.value).toBe(1);
  });

  it('starts parsing from the given position instead of the beginning', () => {
    const source = 'USE mydb; ALTER TABLE users ADD UNIQUE (email);';
    const tokens = tokenizer(source);
    const start = tokens.findIndex(token => token.value === 'ALTER');
    const { ast } = parseTokens(tokens, start);

    expect(start).toBe(3);
    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['email']);
  });

  it('ignores the MySQL UNIQUE KEY <name> (...) form and yields no columns', () => {
    const { ast } = parse('ALTER TABLE users ADD UNIQUE KEY uq_email (email);');

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual([]);
  });
});
