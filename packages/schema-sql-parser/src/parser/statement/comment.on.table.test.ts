import { describe, expect, it } from 'vite-plus/test';

import { RefPos, StatementType } from '@/parser/statement';
import { commentOnTableParser } from '@/parser/statement/comment.on.table';
import { tokenizer } from '@/parser/tokenizer';

const parse = (source: string, start = 0) => {
  const tokens = tokenizer(source);
  const $pos: RefPos = { value: start };
  const ast = commentOnTableParser(tokens, $pos);
  return { ast, $pos, tokens };
};

describe('commentOnTableParser', () => {
  it('parses the table name and its comment', () => {
    const { ast } = parse("COMMENT ON TABLE users IS 'user table';");

    expect(ast).toEqual({
      type: StatementType.commentOnTable,
      name: 'users',
      comment: 'user table',
    });
  });

  it('keeps the last segment of a schema qualified name', () => {
    const { ast } = parse("COMMENT ON TABLE public.users IS 'user table';");

    expect(ast.name).toBe('users');
  });

  it('unwraps a quoted table name', () => {
    const { ast } = parse(`COMMENT ON TABLE "users" IS 'user table';`);

    expect(ast.name).toBe('users');
  });

  it('keeps punctuation the comment contains', () => {
    const { ast } = parse("COMMENT ON TABLE users IS '(a, b); c';");

    expect(ast.comment).toBe('(a, b); c');
  });

  it('leaves the comment empty when IS has no value', () => {
    const { ast } = parse('COMMENT ON TABLE users;');

    expect(ast).toEqual({
      type: StatementType.commentOnTable,
      name: 'users',
      comment: '',
    });
  });

  it('stops on the terminator', () => {
    const { $pos, tokens } = parse(
      "COMMENT ON TABLE users IS 'user table'; CREATE TABLE t (id INT);"
    );

    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('stops on the next statement when the terminator is missing', () => {
    const { ast, $pos, tokens } = parse(
      "COMMENT ON TABLE users IS 'user table' CREATE TABLE t (id INT)"
    );

    expect(ast.comment).toBe('user table');
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('does not read a trailing name as the table name', () => {
    const { ast } = parse("COMMENT ON TABLE users IS 'user table' extra");

    expect(ast.name).toBe('users');
  });

  it('stops at the end of the source', () => {
    const { ast, $pos, tokens } = parse("COMMENT ON TABLE users IS 'a'");

    expect(ast.comment).toBe('a');
    expect($pos.value).toBe(tokens.length);
  });

  it('reads IS NULL as no comment rather than the text NULL', () => {
    const { ast } = parse('COMMENT ON TABLE users IS NULL;');

    expect(ast.comment).toBe('');
  });

  it('still reads a quoted NULL as the comment', () => {
    const { ast } = parse("COMMENT ON TABLE users IS 'NULL';");

    expect(ast.comment).toBe('NULL');
  });

  it('stops on the next COMMENT ON when no terminator separates them', () => {
    const { ast, $pos, tokens } = parse(
      "COMMENT ON TABLE users IS 'user table'\nCOMMENT ON TABLE orders IS 'order table'"
    );

    expect(ast.comment).toBe('user table');
    expect(tokens[$pos.value].value).toBe('COMMENT');
  });
});
