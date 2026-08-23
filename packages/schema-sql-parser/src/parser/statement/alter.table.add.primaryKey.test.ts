import { describe, expect, it } from 'vite-plus/test';

import { RefPos, StatementType } from '@/parser/statement';
import { alterTableAddPrimaryKeyParser } from '@/parser/statement/alter.table.add.primaryKey';
import { Token, tokenizer } from '@/parser/tokenizer';

const parse = (source: string, start = 0) => {
  const tokens = tokenizer(source);
  const $pos: RefPos = { value: start };
  const ast = alterTableAddPrimaryKeyParser(tokens, $pos);
  return { ast, $pos, tokens };
};

const parseTokens = (tokens: Token[], start = 0) => {
  const $pos: RefPos = { value: start };
  const ast = alterTableAddPrimaryKeyParser(tokens, $pos);
  return { ast, $pos };
};

describe('alterTableAddPrimaryKeyParser', () => {
  it('stops on the terminator instead of reading the statement after it', () => {
    const { ast, $pos, tokens } = parse(
      "ALTER TABLE users ADD PRIMARY KEY (id); COMMENT ON TABLE orders IS 'a';"
    );

    expect(ast.name).toBe('users');
    expect(tokens[$pos.value].value).toBe('COMMENT');
  });

  it('parses an anonymous primary key over a single column', () => {
    const { ast } = parse('ALTER TABLE users ADD PRIMARY KEY (id);');

    expect(ast).toEqual({
      type: StatementType.alterTableAddPrimaryKey,
      name: 'users',
      columnNames: ['id'],
    });
  });

  it('collects every column of a composite primary key in order', () => {
    const { ast } = parse(
      'ALTER TABLE user_role ADD PRIMARY KEY (user_id, role_id);'
    );

    expect(ast.columnNames).toEqual(['user_id', 'role_id']);
  });

  it('keeps the table name and drops the constraint name', () => {
    const { ast } = parse(
      'ALTER TABLE users ADD CONSTRAINT pk_users PRIMARY KEY (id);'
    );

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['id']);
  });

  it('skips the ONLY keyword of the PostgreSQL dialect', () => {
    const { ast } = parse('ALTER TABLE ONLY users ADD PRIMARY KEY (id);');

    expect(ast).toEqual({
      type: StatementType.alterTableAddPrimaryKey,
      name: 'users',
      columnNames: ['id'],
    });
  });

  it('parses ALTER TABLE ONLY together with a named constraint', () => {
    const { ast } = parse(
      'ALTER TABLE ONLY public.users ADD CONSTRAINT pk_users PRIMARY KEY (id);'
    );

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['id']);
  });

  it('uses the last segment of a schema qualified table name', () => {
    const { ast } = parse('ALTER TABLE public.users ADD PRIMARY KEY (id);');

    expect(ast.name).toBe('users');
  });

  it('unwraps quoted and bracketed identifiers', () => {
    const { ast } = parse(
      'ALTER TABLE [users] ADD PRIMARY KEY (`id`, "code");'
    );

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['id', 'code']);
  });

  it('keeps the schema name when the token after the period is not a string', () => {
    const { ast } = parse('ALTER TABLE public.(x) ADD PRIMARY KEY (id);');

    expect(ast.name).toBe('public');
    expect(ast.columnNames).toEqual(['id']);
  });

  it('leaves the name empty when TABLE is not followed by an identifier', () => {
    const { ast } = parse('ALTER TABLE , ADD PRIMARY KEY (id);');

    expect(ast.name).toBe('');
    expect(ast.columnNames).toEqual(['id']);
  });

  it('tolerates a CONSTRAINT keyword that is not followed by a name', () => {
    const { ast } = parse(
      'ALTER TABLE users ADD CONSTRAINT (a) PRIMARY KEY (id);'
    );

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['id']);
  });

  it('collects no columns when PRIMARY is not followed by KEY', () => {
    const { ast } = parse('ALTER TABLE users ADD PRIMARY (id);');

    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual([]);
  });

  it('collects no columns when PRIMARY KEY has no column list', () => {
    const { ast } = parse('ALTER TABLE users ADD PRIMARY KEY;');

    expect(ast.columnNames).toEqual([]);
  });

  it('collects the columns parsed so far when the list is unterminated', () => {
    const { ast, $pos, tokens } = parse(
      'ALTER TABLE users ADD PRIMARY KEY (id'
    );

    expect(ast.columnNames).toEqual(['id']);
    expect($pos.value).toBeGreaterThanOrEqual(tokens.length);
  });

  it('stops at the next statement and leaves the position on its first token', () => {
    const { ast, $pos, tokens } = parse(
      'ALTER TABLE users ADD PRIMARY KEY (id); ALTER TABLE t ADD PRIMARY KEY (x);'
    );

    expect(ast.columnNames).toEqual(['id']);
    expect(tokens[$pos.value].value).toBe('ALTER');
  });

  it('returns an empty statement when a new statement follows ALTER immediately', () => {
    const { ast, $pos } = parse('ALTER DROP');

    expect(ast).toEqual({
      type: StatementType.alterTableAddPrimaryKey,
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
    const source = 'USE mydb; ALTER TABLE users ADD PRIMARY KEY (id);';
    const tokens = tokenizer(source);
    const start = tokens.findIndex(token => token.value === 'ALTER');
    const { ast } = parseTokens(tokens, start);

    expect(start).toBe(3);
    expect(ast.name).toBe('users');
    expect(ast.columnNames).toEqual(['id']);
  });
});
