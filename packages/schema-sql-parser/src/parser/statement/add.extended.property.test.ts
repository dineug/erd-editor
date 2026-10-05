import { describe, expect, it } from 'vite-plus/test';

import { RefPos, StatementType } from '@/parser/statement';
import { addExtendedPropertyParser } from '@/parser/statement/add.extended.property';
import { tokenizer } from '@/parser/tokenizer';

const parse = (source: string) => {
  const tokens = tokenizer(source);
  const $pos: RefPos = { value: 0 };
  const ast = addExtendedPropertyParser(tokens, $pos);
  return { ast, $pos, tokens };
};

const named = (args: string) =>
  parse(`EXEC sys.sp_addextendedproperty ${args}`).ast;

describe('addExtendedPropertyParser', () => {
  it('reads the table comment SSMS scripts with named arguments', () => {
    const { ast } = parse(
      "EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Order header' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Orders'\nGO"
    );

    expect(ast).toEqual({
      type: StatementType.commentOnTable,
      name: 'Orders',
      comment: 'Order header',
    });
  });

  it('reads the column comment SSMS scripts with named arguments', () => {
    const { ast } = parse(
      "EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'How many' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Orders', @level2type=N'COLUMN',@level2name=N'Qty'\nGO"
    );

    expect(ast).toEqual({
      type: StatementType.commentOnColumn,
      tableName: 'Orders',
      columnName: 'Qty',
      comment: 'How many',
    });
  });

  it("reads the positional arguments the editor's MSSQL export writes", () => {
    expect(
      parse(
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n  'user table', 'schema', 'sales', 'table', 'users'\nGO"
      ).ast
    ).toEqual({
      type: StatementType.commentOnTable,
      name: 'users',
      comment: 'user table',
    });
    expect(
      parse(
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n  'user id', 'schema', 'sales', 'table', 'users', 'column', 'id'\nGO"
      ).ast
    ).toEqual({
      type: StatementType.commentOnColumn,
      tableName: 'users',
      columnName: 'id',
      comment: 'user id',
    });
  });

  it('reads a positional call at level 0 user dbo, a bare word for its name', () => {
    expect(
      parse(
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n  'user table', 'user', dbo, 'table', 'users'\nGO"
      ).ast
    ).toEqual({
      type: StatementType.commentOnTable,
      name: 'users',
      comment: 'user table',
    });
    expect(
      parse(
        "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n  'user id', 'user', dbo, 'table', 'users', 'column', 'id'\nGO"
      ).ast
    ).toEqual({
      type: StatementType.commentOnColumn,
      tableName: 'users',
      columnName: 'id',
      comment: 'user id',
    });
  });

  it('fills the parameters after positional ones by name', () => {
    expect(
      named(
        "N'MS_Description', N'x', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'T'"
      )
    ).toEqual({ type: StatementType.commentOnTable, name: 'T', comment: 'x' });
  });

  it('reads named arguments in any order and parameter names in any case', () => {
    expect(
      named(
        "@LEVEL1NAME = [Orders], @Level1Type = 'table', @value = 'x', @NAME = 'ms_description'"
      )
    ).toEqual({
      type: StatementType.commentOnTable,
      name: 'Orders',
      comment: 'x',
    });
  });

  it('keeps the quotes a comment doubles, its punctuation and its lines', () => {
    expect(
      named(
        "@name=N'MS_Description', @value=N'it''s (a, b); c\nnext', @level1type=N'TABLE', @level1name=N't'"
      )
    ).toEqual({
      type: StatementType.commentOnTable,
      name: 't',
      comment: "it's (a, b); c\nnext",
    });
  });

  it('reads an empty comment', () => {
    expect(
      named("N'MS_Description', N'', N'SCHEMA', N'dbo', N'TABLE', N't'")
    ).toEqual({ type: StatementType.commentOnTable, name: 't', comment: '' });
  });

  // T-SQL passes DEFAULT as the parameter's own default, NULL for each of these.
  it.each(['NULL', 'DEFAULT'])(
    'reads a table comment where the column level is %s',
    keyword => {
      const comment = {
        type: StatementType.commentOnTable,
        name: 't',
        comment: 'x',
      };

      expect(
        named(
          `N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't', ${keyword}, ${keyword}`
        )
      ).toEqual(comment);
      expect(
        named(
          `@name = N'MS_Description', @value = N'x', @level1type = N'TABLE', @level1name = N't', @level2type = ${keyword}`
        )
      ).toEqual(comment);
    }
  );

  it('reads past an argument the procedure has no parameter for', () => {
    expect(
      named(
        "N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't', NULL, NULL, N'extra'"
      )
    ).toEqual({ type: StatementType.commentOnTable, name: 't', comment: 'x' });
  });

  it.each([
    ['another property', "N'Caption', N'x', N'SCHEMA', N'dbo', N'TABLE', N't'"],
    [
      'no property name',
      "@value = N'x', @level1type = N'TABLE', @level1name = N't'",
    ],
    ['a view', "N'MS_Description', N'x', N'SCHEMA', N'dbo', N'VIEW', N'v'"],
    ['a schema', "N'MS_Description', N'x', N'SCHEMA', N'dbo'"],
    [
      'an index of a table',
      "N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't', N'INDEX', N'ix'",
    ],
    [
      'a column with no name',
      "N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't', N'COLUMN'",
    ],
    [
      'a table with no name',
      "N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE'",
    ],
    [
      'a NULL value',
      "N'MS_Description', NULL, N'SCHEMA', N'dbo', N'TABLE', N't'",
    ],
    [
      'a DEFAULT value',
      "N'MS_Description', DEFAULT, N'SCHEMA', N'dbo', N'TABLE', N't'",
    ],
    ['a number', "N'MS_Description', 42, N'SCHEMA', N'dbo', N'TABLE', N't'"],
    [
      'a variable for its value',
      "N'MS_Description', @comment, N'SCHEMA', N'dbo', N'TABLE', N't'",
    ],
    [
      'a variable for its table',
      "N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', @table",
    ],
    [
      'a variable for its column level',
      "N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't', @kind, N'c'",
    ],
    [
      'a named variable for its column level',
      "@name=N'MS_Description', @value=N'x', @level1type=N'TABLE', @level1name=N't', @level2type=@kind, @level2name=N'c'",
    ],
    ['a named argument with no value', "@name = , @value = N'x'"],
    ['no arguments', ''],
  ])('gives no comment for %s', (_, args) => {
    expect(named(args)).toBeNull();
  });

  it('reads the comment whatever variable names its schema', () => {
    expect(
      named("N'MS_Description', N'x', N'SCHEMA', @schema, N'TABLE', N't'")
    ).toEqual({ type: StatementType.commentOnTable, name: 't', comment: 'x' });
  });

  it.each([
    ['no arguments', '', null],
    ['a named argument with no value', '@name =', null],
    [
      'a comma after the last argument',
      "N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't',",
      { type: StatementType.commentOnTable, name: 't', comment: 'x' },
    ],
  ])('leaves the next statement after %s', (_, args, ast) => {
    const next = parse(
      `EXEC sp_addextendedproperty ${args}\nCREATE TABLE u (id INT)`
    );
    const go = parse(`EXEC sp_addextendedproperty ${args}\nGO`);

    expect(next.ast).toEqual(ast);
    expect(next.tokens[next.$pos.value].value).toBe('CREATE');
    expect(go.ast).toEqual(ast);
    expect(go.tokens[go.$pos.value].value).toBe('GO');
  });

  it('ends the arguments at the first that no comma follows', () => {
    const { ast, $pos, tokens } = parse(
      "EXEC sp_addextendedproperty N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't'\nGO\nCREATE TABLE u (id INT)"
    );

    expect(ast).toEqual({
      type: StatementType.commentOnTable,
      name: 't',
      comment: 'x',
    });
    expect(tokens[$pos.value].value).toBe('GO');
  });

  it('reads no comment out of an expression, ending at its operator', () => {
    const { ast, $pos, tokens } = parse(
      "EXEC sp_addextendedproperty N'MS_Description', N'a' + N'b', N'SCHEMA', N'dbo', N'TABLE', N't'"
    );

    expect(ast).toBeNull();
    expect(tokens[$pos.value].value).toBe('+');
  });

  it('keeps no part of a value an expression builds after its table is read', () => {
    expect(
      named(
        "@level1type = N'TABLE', @level1name = N't', @name = N'MS_Description', @value = N'a' + CHAR(13) + N'b'"
      )
    ).toBeNull();
    expect(
      named(
        "@level1type = N'TABLE', @level1name = N't', @name = N'MS_Description', @value = N'a' || N'b'"
      )
    ).toBeNull();
  });

  it('steps over the terminator', () => {
    const { $pos, tokens } = parse(
      "EXEC sp_addextendedproperty N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't'; CREATE TABLE u (id INT);"
    );

    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('stops at the end of the source', () => {
    const { $pos, tokens } = parse(
      "EXEC sp_addextendedproperty N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't',"
    );

    expect($pos.value).toBe(tokens.length);
  });

  it('steps one token past anything but the call, reading nothing', () => {
    const { ast, $pos } = parse(
      "EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', N't'"
    );

    expect(ast).toBeNull();
    expect($pos.value).toBe(1);
  });
});
