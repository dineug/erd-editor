import { describe, expect, it } from 'vite-plus/test';

import { RefPos, StatementType } from '@/parser/statement';
import { commentOnColumnParser } from '@/parser/statement/comment.on.column';
import { tokenizer } from '@/parser/tokenizer';

const parse = (source: string, start = 0) => {
  const tokens = tokenizer(source);
  const $pos: RefPos = { value: start };
  const ast = commentOnColumnParser(tokens, $pos);
  return { ast, $pos, tokens };
};

describe('commentOnColumnParser', () => {
  it('splits table and column out of the qualified name', () => {
    const { ast } = parse("COMMENT ON COLUMN users.id IS 'user id';");

    expect(ast).toEqual({
      type: StatementType.commentOnColumn,
      tableName: 'users',
      columnName: 'id',
      comment: 'user id',
    });
  });

  it('reads the last two segments of a schema qualified name', () => {
    const { ast } = parse("COMMENT ON COLUMN public.users.id IS 'user id';");

    expect(ast.tableName).toBe('users');
    expect(ast.columnName).toBe('id');
  });

  it('unwraps quoted segments', () => {
    const { ast } = parse(`COMMENT ON COLUMN "users"."id" IS 'user id';`);

    expect(ast.tableName).toBe('users');
    expect(ast.columnName).toBe('id');
  });

  it('keeps punctuation the comment contains', () => {
    const { ast } = parse("COMMENT ON COLUMN users.id IS '(a, b); c';");

    expect(ast.comment).toBe('(a, b); c');
  });

  it('leaves the table name empty when the column is unqualified', () => {
    const { ast } = parse("COMMENT ON COLUMN id IS 'user id';");

    expect(ast.tableName).toBe('');
    expect(ast.columnName).toBe('id');
  });

  it('leaves every name empty when there is nothing to read', () => {
    const { ast } = parse('COMMENT ON COLUMN;');

    expect(ast).toEqual({
      type: StatementType.commentOnColumn,
      tableName: '',
      columnName: '',
      comment: '',
    });
  });

  it('stops on the terminator', () => {
    const { $pos, tokens } = parse(
      "COMMENT ON COLUMN users.id IS 'user id'; CREATE TABLE t (id INT);"
    );

    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('stops on the next statement when the terminator is missing', () => {
    const { ast, $pos, tokens } = parse(
      "COMMENT ON COLUMN users.id IS 'user id' CREATE TABLE t (id INT)"
    );

    expect(ast.comment).toBe('user id');
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('does not read a trailing name as part of the column path', () => {
    const { ast } = parse("COMMENT ON COLUMN users.id IS 'user id' extra");

    expect(ast.tableName).toBe('users');
    expect(ast.columnName).toBe('id');
  });

  it('reads IS NULL as no comment rather than the text NULL', () => {
    const { ast } = parse('COMMENT ON COLUMN users.id IS NULL;');

    expect(ast.comment).toBe('');
  });

  it('stops on the next COMMENT ON when no terminator separates them', () => {
    const { ast, $pos, tokens } = parse(
      "COMMENT ON COLUMN users.id IS 'user id'\nCOMMENT ON COLUMN users.email IS 'email'"
    );

    expect(ast.columnName).toBe('id');
    expect(ast.comment).toBe('user id');
    expect(tokens[$pos.value].value).toBe('COMMENT');
  });
});
