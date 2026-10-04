import { describe, expect, it } from 'vite-plus/test';

import { DatabaseVendor, RefPos, StatementType } from '@/parser/statement';
import { alterTableAddDefaultParser } from '@/parser/statement/alter.table.add.default';
import { tokenizer } from '@/parser/tokenizer';

const parse = (source: string, database?: DatabaseVendor) => {
  const tokens = tokenizer(source, database);
  const $pos: RefPos = { value: 0 };
  const ast = alterTableAddDefaultParser(tokens, $pos, database);
  return { ast, $pos, tokens };
};

describe('alterTableAddDefaultParser', () => {
  it('reads the default SSMS scripts for a column, dropping its constraint name', () => {
    const { ast } = parse(
      "ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Status]  DEFAULT ('draft') FOR [Status]\nGO"
    );

    expect(ast).toEqual({
      type: StatementType.alterTableAddDefault,
      name: 'Orders',
      columnName: 'Status',
      default: "'draft'",
    });
  });

  it('reads a default with no constraint name', () => {
    const { ast } = parse(
      'ALTER TABLE [dbo].[Orders] ADD  DEFAULT ((0)) FOR [Qty]'
    );

    expect(ast).toEqual({
      type: StatementType.alterTableAddDefault,
      name: 'Orders',
      columnName: 'Qty',
      default: '0',
    });
  });

  it('reads the expression as a column DEFAULT does', () => {
    const defaultOf = (expression: string) =>
      parse(`ALTER TABLE t ADD CONSTRAINT df DEFAULT ${expression} FOR c;`).ast
        .default;

    expect(defaultOf('(getdate())')).toBe('getdate()');
    expect(defaultOf("(N'(none)')")).toBe("N'(none)'");
    expect(defaultOf('(NULL)')).toBe('NULL');
    expect(defaultOf('((1.5))')).toBe('1.5');
    expect(defaultOf('(dateadd(day, (1), getdate()))')).toBe(
      'dateadd(day, (1), getdate())'
    );
    expect(defaultOf('(NEXT VALUE FOR [dbo].[seq])')).toBe(
      'NEXT VALUE FOR [dbo].[seq]'
    );
    expect(defaultOf('NEXT VALUE FOR [dbo].[seq]')).toBe(
      'NEXT VALUE FOR [dbo].[seq]'
    );
    expect(defaultOf('0')).toBe('0');
  });

  it('reads the column keywords of an expression without its parentheses, which only FOR ends', () => {
    expect(
      parse(
        'ALTER TABLE t ADD CONSTRAINT df DEFAULT CASE WHEN 1 = 1 THEN NULL ELSE 0 END FOR c;'
      ).ast
    ).toMatchObject({
      columnName: 'c',
      default: 'CASE WHEN 1 = 1 THEN NULL ELSE 0 END',
    });
    expect(
      parse("ALTER TABLE t ADD DEFAULT 'a' COLLATE Latin1_General_CI_AS FOR c;")
        .ast
    ).toMatchObject({
      columnName: 'c',
      default: "'a' COLLATE Latin1_General_CI_AS",
    });
    expect(
      parse('ALTER TABLE t ADD DEFAULT 1 + NULL FOR [c] WITH VALUES;').ast
    ).toMatchObject({ columnName: 'c', default: '1 + NULL' });
  });

  it('ends the expression at a closing paren nothing opened', () => {
    expect(parse('ALTER TABLE t ADD DEFAULT 0) FOR c;').ast).toMatchObject({
      columnName: '',
      default: '0',
    });
  });

  it('names the column after the FOR of NEXT VALUE FOR', () => {
    const { ast } = parse(
      'ALTER TABLE t ADD DEFAULT NEXT VALUE FOR seq FOR [Id] WITH VALUES;'
    );

    expect(ast.default).toBe('NEXT VALUE FOR seq');
    expect(ast.columnName).toBe('Id');
  });

  it('writes a literal back in the quotes of the vendor it reads for', () => {
    expect(parse("ALTER TABLE t ADD DEFAULT 'it''s' FOR c;").ast.default).toBe(
      "'it''s'"
    );
    expect(
      parse("ALTER TABLE t ADD DEFAULT 'it\\'s' FOR c;", 'Databricks').ast
        .default
    ).toBe("'it\\'s'");
  });

  it('keeps the last segment of the table name, after ONLY too', () => {
    expect(
      parse('ALTER TABLE [db].[dbo].[Orders] ADD DEFAULT 0 FOR [Qty];').ast.name
    ).toBe('Orders');
    expect(parse('ALTER TABLE ONLY s.t ADD DEFAULT 0 FOR c;').ast.name).toBe(
      't'
    );
    expect(parse('ALTER TABLE only ADD DEFAULT 0 FOR c;').ast.name).toBe(
      'only'
    );
  });

  it('reads only the first clause', () => {
    const { ast, $pos, tokens } = parse(
      'ALTER TABLE t ADD CONSTRAINT d1 DEFAULT 0 FOR a, CONSTRAINT d2 DEFAULT 1 FOR b;'
    );

    expect(ast).toMatchObject({ columnName: 'a', default: '0' });
    expect($pos.value).toBe(tokens.length);
  });

  it('names no column when no FOR follows the expression', () => {
    expect(parse('ALTER TABLE t ADD DEFAULT 0;').ast).toMatchObject({
      name: 't',
      columnName: '',
      default: '0',
    });
    expect(parse('ALTER TABLE t ADD DEFAULT 0 FOR;').ast.columnName).toBe('');
  });

  it('stops on the terminator instead of reading the statement after it', () => {
    const { $pos, tokens } = parse(
      "ALTER TABLE t ADD DEFAULT 0 FOR c; COMMENT ON TABLE t IS 'a';"
    );

    expect(tokens[$pos.value].value).toBe('COMMENT');
  });

  it('stops on the next statement of an SSMS script, which writes GO for a terminator', () => {
    const { $pos, tokens } = parse(
      'ALTER TABLE t ADD DEFAULT (0) FOR [a]\nGO\nALTER TABLE t ADD DEFAULT (1) FOR [b]\nGO'
    );

    expect(tokens[$pos.value].value).toBe('ALTER');
    expect($pos.value).toBeGreaterThan(0);
  });

  it('ends an expression no FOR or terminator ends at the next statement', () => {
    const { ast, $pos, tokens } = parse(
      'ALTER TABLE t ADD DEFAULT 0\nGO\nCREATE TABLE x (a INT)\nGO',
      'MSSQL'
    );

    expect(tokens[$pos.value].value).toBe('CREATE');
    expect(ast.columnName).toBe('');
  });

  it('ends at the end of a truncated source', () => {
    const { ast, $pos, tokens } = parse('ALTER TABLE t ADD DEFAULT (');

    expect(ast).toMatchObject({ name: 't', columnName: '' });
    expect($pos.value).toBe(tokens.length);
  });
});
