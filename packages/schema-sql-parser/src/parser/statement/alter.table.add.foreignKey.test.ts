import { describe, expect, it } from 'vite-plus/test';

import { RefPos, StatementType } from '@/parser/statement';
import { alterTableAddForeignKeyParser } from '@/parser/statement/alter.table.add.foreignKey';
import { Token, tokenizer } from '@/parser/tokenizer';

const parse = (source: string, start = 0) => {
  const tokens = tokenizer(source);
  const $pos: RefPos = { value: start };
  const ast = alterTableAddForeignKeyParser(tokens, $pos);
  return { ast, $pos, tokens };
};

const parseTokens = (tokens: Token[], start = 0) => {
  const $pos: RefPos = { value: start };
  const ast = alterTableAddForeignKeyParser(tokens, $pos);
  return { ast, $pos };
};

const emptyAst = {
  type: StatementType.alterTableAddForeignKey,
  name: '',
  columnNames: [],
  refTableName: '',
  refColumnNames: [],
};

describe('alterTableAddForeignKeyParser', () => {
  it('parses an anonymous foreign key over a single column', () => {
    const { ast } = parse(
      'ALTER TABLE post ADD FOREIGN KEY (user_id) REFERENCES user (id);'
    );

    expect(ast).toEqual({
      type: StatementType.alterTableAddForeignKey,
      name: 'post',
      columnNames: ['user_id'],
      refTableName: 'user',
      refColumnNames: ['id'],
    });
  });

  it('parses a composite foreign key preserving column order', () => {
    const { ast } = parse(
      'ALTER TABLE post ADD FOREIGN KEY (a, b) REFERENCES user (x, y);'
    );

    expect(ast.columnNames).toEqual(['a', 'b']);
    expect(ast.refColumnNames).toEqual(['x', 'y']);
  });

  it('keeps the table name and drops the constraint name', () => {
    const { ast } = parse(
      'ALTER TABLE post ADD CONSTRAINT fk_post_user FOREIGN KEY (user_id) REFERENCES user (id);'
    );

    expect(ast.name).toBe('post');
    expect(ast.columnNames).toEqual(['user_id']);
    expect(ast.refTableName).toBe('user');
  });

  it('skips the ONLY keyword and resolves schema qualified names on both sides', () => {
    const { ast } = parse(
      'ALTER TABLE ONLY public.post ADD CONSTRAINT fk_post_user FOREIGN KEY (user_id) REFERENCES public.user(id);'
    );

    expect(ast).toEqual({
      type: StatementType.alterTableAddForeignKey,
      name: 'post',
      columnNames: ['user_id'],
      refTableName: 'user',
      refColumnNames: ['id'],
    });
  });

  it('parses ALTER TABLE ONLY without a named constraint', () => {
    const { ast } = parse(
      'ALTER TABLE ONLY post ADD FOREIGN KEY (user_id) REFERENCES user (id);'
    );

    expect(ast.name).toBe('post');
    expect(ast.refTableName).toBe('user');
  });

  it('unwraps quoted and bracketed identifiers', () => {
    const { ast } = parse(
      'ALTER TABLE `post` ADD FOREIGN KEY ([user_id]) REFERENCES "user" (`id`);'
    );

    expect(ast.name).toBe('post');
    expect(ast.columnNames).toEqual(['user_id']);
    expect(ast.refTableName).toBe('user');
    expect(ast.refColumnNames).toEqual(['id']);
  });

  it('keeps the schema name when the token after the period is not a string', () => {
    const { ast } = parse(
      'ALTER TABLE public.(x) ADD FOREIGN KEY (user_id) REFERENCES user (id);'
    );

    expect(ast.name).toBe('public');
    expect(ast.columnNames).toEqual(['user_id']);
  });

  it('leaves the name empty when TABLE is not followed by an identifier', () => {
    const { ast } = parse(
      'ALTER TABLE , ADD FOREIGN KEY (user_id) REFERENCES user (id);'
    );

    expect(ast.name).toBe('');
    expect(ast.refTableName).toBe('user');
  });

  it('tolerates a CONSTRAINT keyword that is not followed by a name', () => {
    const { ast } = parse(
      'ALTER TABLE post ADD CONSTRAINT (a) FOREIGN KEY (user_id) REFERENCES user (id);'
    );

    expect(ast.name).toBe('post');
    expect(ast.columnNames).toEqual(['user_id']);
  });

  it('ignores the foreign key when the column counts do not match', () => {
    const { ast } = parse(
      'ALTER TABLE post ADD FOREIGN KEY (a, b) REFERENCES user (id);'
    );

    expect(ast).toEqual({ ...emptyAst, name: 'post' });
  });

  it('ignores the foreign key when the REFERENCES clause is missing', () => {
    const { ast } = parse('ALTER TABLE post ADD FOREIGN KEY (user_id);');

    expect(ast).toEqual({ ...emptyAst, name: 'post' });
  });

  it('ignores the foreign key when FOREIGN is not followed by KEY', () => {
    const { ast, $pos, tokens } = parse(
      'ALTER TABLE post ADD FOREIGN (user_id) REFERENCES user (id);'
    );

    expect(ast).toEqual({ ...emptyAst, name: 'post' });
    expect($pos.value).toBeGreaterThanOrEqual(tokens.length);
  });

  it('keeps only the last foreign key when a statement declares several', () => {
    const { ast } = parse(
      'ALTER TABLE post ADD FOREIGN KEY (a) REFERENCES r1 (x), ADD FOREIGN KEY (b) REFERENCES r2 (y);'
    );

    expect(ast.columnNames).toEqual(['b']);
    expect(ast.refTableName).toBe('r2');
    expect(ast.refColumnNames).toEqual(['y']);
  });

  it('stops at the next statement and leaves the position on its first token', () => {
    const { ast, $pos, tokens } = parse(
      'ALTER TABLE post ADD FOREIGN KEY (user_id) REFERENCES user (id); CREATE TABLE t (id int);'
    );

    expect(ast.refTableName).toBe('user');
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('returns an empty statement when a new statement follows ALTER immediately', () => {
    const { ast, $pos } = parse('ALTER RENAME');

    expect(ast).toEqual(emptyAst);
    expect($pos.value).toBe(1);
  });

  it('returns an empty statement when there are no tokens after ALTER', () => {
    const { ast, $pos } = parse('ALTER');

    expect(ast).toEqual(emptyAst);
    expect($pos.value).toBe(1);
  });

  it('starts parsing from the given position instead of the beginning', () => {
    const source =
      'USE mydb; ALTER TABLE post ADD FOREIGN KEY (user_id) REFERENCES user (id);';
    const tokens: Token[] = tokenizer(source);
    const start = tokens.findIndex(token => token.value === 'ALTER');
    const { ast } = parseTokens(tokens, start);

    expect(start).toBe(3);
    expect(ast.name).toBe('post');
    expect(ast.refTableName).toBe('user');
  });
});
