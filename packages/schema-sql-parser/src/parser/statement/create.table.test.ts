import { describe, expect, it } from 'vite-plus/test';

import {
  Column,
  DatabaseVendor,
  ReferentialAction,
  RefPos,
  SortType,
  StatementType,
} from '@/parser/statement';
import {
  createTableParser,
  parserForeignKeyParser,
} from '@/parser/statement/create.table';
import { tokenizer } from '@/parser/tokenizer';

function parse(sql: string, database?: DatabaseVendor) {
  const tokens = tokenizer(sql, database);
  const $pos: RefPos = { value: 0 };
  const ast = createTableParser(tokens, $pos, database);
  return { ast, tokens, $pos };
}

function parseFrom(sql: string, start: number) {
  const tokens = tokenizer(sql);
  const $pos: RefPos = { value: start };
  const ast = createTableParser(tokens, $pos);
  return { ast, tokens, $pos };
}

function column(partial: Partial<Column>): Column {
  return {
    name: '',
    dataType: '',
    default: '',
    comment: '',
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    nullable: true,
    ...partial,
  };
}

function parseForeignKey(sql: string) {
  const tokens = tokenizer(sql);
  const $pos: RefPos = { value: 0 };
  const foreignKey = parserForeignKeyParser(tokens, $pos);
  return { foreignKey, tokens, $pos };
}

describe('createTableParser - table name', () => {
  it('parses a MySQL backtick quoted table with columns', () => {
    const { ast } = parse(
      'CREATE TABLE `users` (\n' +
        "  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'pk',\n" +
        "  `name` VARCHAR(50) DEFAULT 'anon',\n" +
        '  PRIMARY KEY (`id`)\n' +
        ") COMMENT 'user table';"
    );

    expect(ast.type).toBe(StatementType.createTable);
    expect(ast.name).toBe('users');
    expect(ast.comment).toBe('user table');
    expect(ast.columns).toEqual([
      column({
        name: 'id',
        dataType: 'INT',
        comment: 'pk',
        primaryKey: true,
        autoIncrement: true,
        nullable: false,
      }),
      column({ name: 'name', dataType: 'VARCHAR(50)', default: "'anon'" }),
    ]);
    expect(ast.indexes).toEqual([]);
    expect(ast.foreignKeys).toEqual([]);
  });

  it('keeps only the last identifier of a database qualified name', () => {
    const { ast } = parse('CREATE TABLE public.accounts (id INT);');

    expect(ast.name).toBe('accounts');
    expect(ast.columns).toEqual([column({ name: 'id', dataType: 'INT' })]);
  });

  it('keeps only the last identifier of a catalog qualified name', () => {
    const { ast } = parse('CREATE TABLE main.sales.orders (id BIGINT);');

    expect(ast.name).toBe('orders');
    expect(ast.columns).toEqual([column({ name: 'id', dataType: 'BIGINT' })]);
  });

  it('keeps the first identifier when the period is not followed by a name', () => {
    const { ast } = parse('CREATE TABLE db. (a INT);');

    expect(ast.name).toBe('db');
    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
  });

  it('unwraps MSSQL bracket quoted identifiers', () => {
    const { ast } = parse('CREATE TABLE [dbo].[Orders] ([Id] INT NOT NULL);');

    expect(ast.name).toBe('Orders');
    expect(ast.columns).toEqual([
      column({ name: 'Id', dataType: 'INT', nullable: false }),
    ]);
  });

  it('skips the IF NOT EXISTS prefix', () => {
    const { ast } = parse(
      'CREATE TABLE IF NOT EXISTS payments (id BIGINT PRIMARY KEY);'
    );

    expect(ast.name).toBe('payments');
    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'BIGINT', primaryKey: true }),
    ]);
  });

  it('skips a CREATE OR REPLACE header and a table kind', () => {
    expect(parse('CREATE OR REPLACE TABLE t (id INT);').ast.name).toBe('t');
    expect(
      parse('create or replace transient table d.s.t (id INT);').ast.name
    ).toBe('t');
    expect(parse('CREATE HYBRID TABLE h (id INT);').ast.name).toBe('h');
  });

  // An option group is not a column list: file_format = (...) used to be
  // read as one, inventing a column out of a table that declares none.
  it('takes only the group that follows the name as the column list', () => {
    expect(
      parse(
        'create or replace external table e location=@s file_format = (type = parquet);'
      ).ast.columns
    ).toEqual([]);
    expect(
      parse("CREATE TABLE t LOCATION 's3://b/p' TBLPROPERTIES ('a' = 'b');").ast
        .columns
    ).toEqual([]);
    expect(
      parse("CREATE EXTERNAL TABLE e (id INT) LOCATION 's3://b/p';").ast.columns
    ).toEqual([column({ name: 'id', dataType: 'INT' })]);
  });

  it('consumes a clustering clause that precedes the column list', () => {
    expect(
      parse('create or replace TABLE L cluster by LINEAR(d)(a INT, d DATE);')
        .ast.columns
    ).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'd', dataType: 'DATE' }),
    ]);
    expect(
      parse('CREATE TABLE t cluster by (a) (a INT, b INT);').ast.columns
    ).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
  });

  it('leaves the name empty when the body starts immediately', () => {
    const { ast } = parse('CREATE TABLE (a INT);');

    expect(ast.name).toBe('');
    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
  });

  it('reads a table COMMENT that is written with an equal sign', () => {
    const { ast } = parse("CREATE TABLE t (id INT) COMMENT='table comment';");

    expect(ast.comment).toBe('table comment');
  });

  it('keeps parentheses that a quoted table COMMENT contains', () => {
    const { ast } = parse(
      "CREATE TABLE t (id INT) ENGINE=InnoDB COMMENT='(test)bug here!!';"
    );

    expect(ast.comment).toBe('(test)bug here!!');
    expect(ast.columns).toEqual([column({ name: 'id', dataType: 'INT' })]);
  });

  it('stops at the terminator instead of reading the next statement as options', () => {
    const { ast } = parse(
      "CREATE TABLE t (id INT);\nCOMMENT ON TABLE t IS 'table comment';"
    );

    expect(ast.comment).toBe('');
  });

  it('ignores a trailing COMMENT keyword without a value', () => {
    const { ast } = parse('CREATE TABLE t (a INT) COMMENT;');

    expect(ast.comment).toBe('');
  });

  it('stops at the next statement and leaves $pos on it', () => {
    const { ast, tokens, $pos } = parse(
      'CREATE TABLE a (x INT); CREATE TABLE b (y INT);'
    );

    expect(ast.name).toBe('a');
    expect(ast.columns).toEqual([column({ name: 'x', dataType: 'INT' })]);
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('parses a statement that does not start at position 0', () => {
    const { ast, tokens, $pos } = parseFrom(
      'USE mydb; CREATE TABLE t (a INT);',
      3
    );

    expect(ast.name).toBe('t');
    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
    expect($pos.value).toBe(tokens.length);
  });
});

describe('createTableParser - column options', () => {
  it('parses data types with a length and a precision argument', () => {
    const { ast } = parse('CREATE TABLE t (a DECIMAL(10,2), b NUMERIC (8));');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'DECIMAL(10,2)' }),
      column({ name: 'b', dataType: 'NUMERIC(8)' }),
    ]);
  });

  it('marks NOT NULL columns as non nullable', () => {
    const { ast } = parse(
      'CREATE TABLE t (id NUMBER(10) NOT NULL, dt DATE DEFAULT SYSDATE);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'NUMBER(10)', nullable: false }),
      column({ name: 'dt', dataType: 'DATE', default: 'SYSDATE' }),
    ]);
  });

  it('keeps the column nullable when NOT is not followed by NULL', () => {
    const { ast } = parse('CREATE TABLE t (a INT NOT DEFERRABLE);');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', nullable: true }),
    ]);
  });

  it('keeps a quoted DEFAULT a SQL string literal and an unquoted one verbatim', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        " a VARCHAR(20) NOT NULL DEFAULT 'PENDING',\n" +
        " b VARCHAR(20) DEFAULT '',\n" +
        " c DATETIME DEFAULT '0000-00-00 00:00:00',\n" +
        ' d VARCHAR(20) DEFAULT "x",\n' +
        " e TINYINT DEFAULT '0',\n" +
        " f VARCHAR(20) DEFAULT 'NULL',\n" +
        ' g TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n' +
        ' h INT DEFAULT 0,\n' +
        ' i INT DEFAULT -1,\n' +
        ' j VARCHAR(20) DEFAULT NULL\n' +
        ');'
    );

    expect(ast.columns.map(column => column.default)).toEqual([
      "'PENDING'",
      "''",
      "'0000-00-00 00:00:00'",
      "'x'",
      "'0'",
      "'NULL'",
      'CURRENT_TIMESTAMP',
      '0',
      '-1',
      'NULL',
    ]);
    expect(ast.columns[0].nullable).toBe(false);
  });

  it('doubles a quote the DEFAULT string literal contains', () => {
    const { ast } = parse('CREATE TABLE t (a VARCHAR(20) DEFAULT "it\'s");');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'VARCHAR(20)', default: "'it''s'" }),
    ]);
  });

  it('ignores a DEFAULT that is not followed by a value token', () => {
    const { ast } = parse('CREATE TABLE t (a INT DEFAULT, b INT);');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
  });

  it('ignores a column COMMENT without a value token', () => {
    const { ast } = parse('CREATE TABLE t (a INT COMMENT, b INT);');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
  });

  it('supports the SQLite AUTOINCREMENT spelling', () => {
    const { ast } = parse(
      'CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, n TEXT);'
    );

    expect(ast.columns).toEqual([
      column({
        name: 'id',
        dataType: 'INTEGER',
        primaryKey: true,
        autoIncrement: true,
      }),
      column({ name: 'n', dataType: 'TEXT' }),
    ]);
  });

  it('marks inline PRIMARY KEY and UNIQUE columns', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT PRIMARY KEY, b VARCHAR(3) UNIQUE);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', primaryKey: true }),
      column({ name: 'b', dataType: 'VARCHAR(3)', unique: true }),
    ]);
  });

  it('keeps the attribute that follows an inline UNIQUE', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        " a VARCHAR(255) NOT NULL UNIQUE COMMENT 'Login email',\n" +
        " b VARCHAR(255) UNIQUE NOT NULL COMMENT 'Second',\n" +
        ' c INT UNIQUE DEFAULT (0),\n' +
        " d VARCHAR(255) UNIQUE          COMMENT 'Snowflake',\n" +
        ' e INT UNIQUE PRIMARY KEY NOT NULL\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({
        name: 'a',
        dataType: 'VARCHAR(255)',
        nullable: false,
        unique: true,
        comment: 'Login email',
      }),
      column({
        name: 'b',
        dataType: 'VARCHAR(255)',
        nullable: false,
        unique: true,
        comment: 'Second',
      }),
      column({ name: 'c', dataType: 'INT', unique: true, default: '0' }),
      column({
        name: 'd',
        dataType: 'VARCHAR(255)',
        unique: true,
        comment: 'Snowflake',
      }),
      column({
        name: 'e',
        dataType: 'INT',
        unique: true,
        primaryKey: true,
        nullable: false,
      }),
    ]);
  });

  it('marks the column an inline UNIQUE CHECK belongs to', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT, b INT UNIQUE CHECK (a > 0));'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'b', dataType: 'INT', unique: true }),
    ]);
  });

  it('ignores PRIMARY when it is not followed by KEY', () => {
    const { ast } = parse('CREATE TABLE t (a INT PRIMARY);');

    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
  });

  it('skips a parenthesised expression such as CHECK', () => {
    const { ast } = parse('CREATE TABLE t (a INT CHECK (a > 0), b INT);');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
  });

  it('keeps the columns that follow an option with nested parentheses', () => {
    const { ast } = parse(
      'CREATE TABLE t2 (\n' +
        ' ts TIMESTAMP,\n' +
        ' d DATE GENERATED ALWAYS AS (CAST(ts AS DATE)),\n' +
        ' name STRING,\n' +
        ' email STRING\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({ name: 'ts', dataType: 'TIMESTAMP' }),
      column({ name: 'd', dataType: 'DATE' }),
      column({ name: 'name', dataType: 'STRING' }),
      column({ name: 'email', dataType: 'STRING' }),
    ]);
  });

  it('skips a CHECK that wraps a subquery in its own parentheses', () => {
    const { ast } = parse(
      'CREATE TABLE t (v INT CHECK (v > (SELECT 1)), w INT);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'v', dataType: 'INT' }),
      column({ name: 'w', dataType: 'INT' }),
    ]);
  });

  it('reads a DEFAULT written as a parenthesised function call without its parens', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT DEFAULT (CURRENT_TIMESTAMP()), b INT);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', default: 'CURRENT_TIMESTAMP()' }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
  });

  it('reads the whole DEFAULT expression up to the next column keyword', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a timestamp DEFAULT now() NOT NULL,\n' +
        ' b numeric(3,2) DEFAULT 0.5,\n' +
        ' c bit DEFAULT ((0)) NOT NULL,\n' +
        " d varchar(10) DEFAULT 'draft'::character varying,\n" +
        " e integer DEFAULT nextval('t_e_seq'::regclass) NOT NULL,\n" +
        " f timestamp DEFAULT (now() AT TIME ZONE 'utc'::text) COMMENT 'x',\n" +
        ' g text[] DEFAULT ARRAY[]::text[]\n' +
        ');'
    );

    expect(
      ast.columns.map(column => [column.name, column.default, column.nullable])
    ).toEqual([
      ['a', 'now()', false],
      ['b', '0.5', true],
      ['c', '0', false],
      ['d', "'draft'", true],
      ['e', '', false],
      ['f', "now() AT TIME ZONE 'utc'::text", true],
      ['g', 'ARRAY[]::text[]', true],
    ]);
    expect(ast.columns[5].comment).toBe('x');
  });

  it('reads a default that is one call of nextval as auto increment with no default', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        " a integer DEFAULT nextval('public.t_a_seq'::regclass) NOT NULL,\n" +
        " b bigint NOT NULL DEFAULT (nextval('t_b_seq'::regclass)),\n" +
        " c integer DEFAULT nextval('t_c_seq'::regclass) + 1,\n" +
        ' d integer\n' +
        ');'
    );

    expect(
      ast.columns.map(column => [
        column.name,
        column.default,
        column.autoIncrement,
        column.nullable,
      ])
    ).toEqual([
      ['a', '', true, false],
      ['b', '', true, false],
      ['c', "nextval('t_c_seq'::regclass) + 1", false, true],
      ['d', '', false, true],
    ]);
  });

  it('reads a prefixed literal whole and the columns after it', () => {
    const { ast } = parse(
      "CREATE TABLE t (a nvarchar(10) DEFAULT (N'(none)'), b nvarchar(10) DEFAULT (N'a,b'), c int);"
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'nvarchar(10)', default: "N'(none)'" }),
      column({ name: 'b', dataType: 'nvarchar(10)', default: "N'a,b'" }),
      column({ name: 'c', dataType: 'int' }),
    ]);
  });

  it('reads a literal glued to the operator before it, as SQL Server stores one', () => {
    const { ast } = parse(
      "CREATE TABLE [dbo].[U]([Label] [nvarchar](40) NULL DEFAULT (N'a'+N' (b)'), [Id] [int] NOT NULL)"
    );

    expect(ast.columns).toEqual([
      column({
        name: 'Label',
        dataType: 'nvarchar(40)',
        default: "N'a' + N' (b)'",
      }),
      column({ name: 'Id', dataType: 'int', nullable: false }),
    ]);
  });

  it('ends a DEFAULT at the column options MariaDB and SQL Server write after it', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a int DEFAULT NULL WITHOUT SYSTEM VERSIONING,\n' +
        ' b int DEFAULT 5 WITHOUT SYSTEM VERSIONING,\n' +
        ' c int NOT NULL DEFAULT 0 INDEX ix_c,\n' +
        ' d timestamp DEFAULT now()::timestamp without time zone,\n' +
        ' e int\n' +
        ') WITH SYSTEM VERSIONING;'
    );

    expect(ast.columns.map(column => [column.name, column.default])).toEqual([
      ['a', 'NULL'],
      ['b', '5'],
      ['c', '0'],
      ['d', 'now()::timestamp without time zone'],
      ['e', ''],
    ]);
  });

  it('reads a bare CASE default up to its END', () => {
    const { ast } = parse(
      "CREATE TABLE t (a text DEFAULT CASE WHEN (x IS NULL) THEN 'a' ELSE NULL END NOT NULL, b int);"
    );

    expect(ast.columns).toEqual([
      column({
        name: 'a',
        dataType: 'text',
        default: "CASE WHEN(x IS NULL) THEN 'a' ELSE NULL END",
        nullable: false,
      }),
      column({ name: 'b', dataType: 'int' }),
    ]);
  });

  it('reads a prefixed COMMENT as its text alone', () => {
    const { ast } = parse(
      "CREATE TABLE t (a int COMMENT N'hello world', b int COMMENT _utf8mb4'x') COMMENT=_utf8mb4'tbl';"
    );

    expect(ast.comment).toBe('tbl');
    expect(ast.columns.map(column => column.comment)).toEqual([
      'hello world',
      'x',
    ]);
  });

  it('reads the expression after the ON NULL of an Oracle DEFAULT', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a NUMBER DEFAULT ON NULL 0 NOT NULL ENABLE,\n' +
        " b VARCHAR2(10) DEFAULT ON NULL FOR INSERT ONLY 'x',\n" +
        ' c NUMBER DEFAULT ON NULL FOR INSERT AND UPDATE 1,\n' +
        ' d NUMBER DEFAULT ON NULL FOR INSERT\n' +
        ');'
    );

    expect(
      ast.columns.map(column => [column.name, column.default, column.nullable])
    ).toEqual([
      ['a', '0', false],
      ['b', "'x'", true],
      ['c', '1', true],
      ['d', 'FOR INSERT', true],
    ]);
  });

  it('reads an ON NULL at the end of the source as no default', () => {
    const { ast } = parse('CREATE TABLE t (a NUMBER DEFAULT ON NULL');

    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'NUMBER' })]);
  });

  it('reads GENERATED BY DEFAULT AS IDENTITY as an identity with no default', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a INT GENERATED BY DEFAULT AS IDENTITY (START WITH 1 INCREMENT BY 1) NOT NULL,\n' +
        ' b NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY,\n' +
        ' c INT\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({
        name: 'a',
        dataType: 'INT',
        autoIncrement: true,
        nullable: false,
      }),
      column({ name: 'b', dataType: 'NUMBER', autoIncrement: true }),
      column({ name: 'c', dataType: 'INT' }),
    ]);
  });

  it('keeps a nested type together when its arguments hold a comma', () => {
    const { ast } = parse(
      'CREATE TABLE t3 (\n' +
        ' id BIGINT,\n' +
        ' tags ARRAY<STRING>,\n' +
        ' props MAP<STRING, INT>,\n' +
        ' addr STRUCT<city: STRING, zip: INT>,\n' +
        ' name STRING\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'BIGINT' }),
      column({ name: 'tags', dataType: 'ARRAY<STRING>' }),
      column({ name: 'props', dataType: 'MAP<STRING, INT>' }),
      column({ name: 'addr', dataType: 'STRUCT<city: STRING, zip: INT>' }),
      column({ name: 'name', dataType: 'STRING' }),
    ]);
  });

  it('balances the angle brackets of a doubly nested type', () => {
    const { ast } = parse(
      'CREATE TABLE t (a ARRAY<STRUCT<a:INT, b:STRING>>, b DECIMAL(10,2));'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'ARRAY<STRUCT<a:INT, b:STRING>>' }),
      column({ name: 'b', dataType: 'DECIMAL(10,2)' }),
    ]);
  });

  // Bare, the comment read as words and the name as two fields.
  it('keeps the quotes of a nested field comment and name', () => {
    const { ast } = parse(
      "CREATE TABLE t (a STRUCT<name: STRING COMMENT 'it''s > 0', `first name`: STRING>, b INT, c STRUCT<x: STRING COMMENT 'q'>);"
    );

    expect(ast.columns).toEqual([
      column({
        name: 'a',
        dataType:
          "STRUCT<name: STRING COMMENT 'it''s > 0', `first name`: STRING>",
      }),
      column({ name: 'b', dataType: 'INT' }),
      column({ name: 'c', dataType: "STRUCT<x: STRING COMMENT 'q'>" }),
    ]);
  });

  it('produces no column for an empty body', () => {
    const { ast } = parse('CREATE TABLE t ();');

    expect(ast.columns).toEqual([]);
  });

  it('keeps every word of a multi word PostgreSQL type', () => {
    const { ast } = parse(
      'CREATE TABLE t ("id" serial PRIMARY KEY, "d" timestamp without time zone);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'serial', primaryKey: true }),
      column({ name: 'd', dataType: 'timestamp without time zone' }),
    ]);
  });

  it('keeps an argument list that sits inside a multi word type', () => {
    const { ast } = parse('CREATE TABLE t (a timestamp(3) with time zone);');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'timestamp(3) with time zone' }),
    ]);
  });

  it('takes the longest type name when a shorter one prefixes it', () => {
    const { ast } = parse(
      'CREATE TABLE t (a DOUBLE PRECISION, b DOUBLE, c INTERVAL DAY TO SECOND);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'DOUBLE PRECISION' }),
      column({ name: 'b', dataType: 'DOUBLE' }),
      column({ name: 'c', dataType: 'INTERVAL DAY TO SECOND' }),
    ]);
  });

  // Extension types such as citext and hstore are outside every list, and
  // used to come in empty.
  it('keeps a type no vendor list carries', () => {
    const { ast } = parse(
      'CREATE TABLE t (a numrange, b hstore, c citext, d ltree);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'numrange' }),
      column({ name: 'b', dataType: 'hstore' }),
      column({ name: 'c', dataType: 'citext' }),
      column({ name: 'd', dataType: 'ltree' }),
    ]);
  });
});

describe('createTableParser - user defined types', () => {
  const types = (sql: string) =>
    parse(sql).ast.columns.map(({ name, dataType }) => [name, dataType]);

  it('keeps the attributes that follow a CREATE TYPE or CREATE DOMAIN type', () => {
    const { ast } = parse(
      "CREATE TABLE person (current_mood mood NOT NULL DEFAULT 'ok', zip us_postal UNIQUE COMMENT 'post code', id sysname);"
    );

    expect(ast.columns).toEqual([
      column({
        name: 'current_mood',
        dataType: 'mood',
        default: "'ok'",
        nullable: false,
      }),
      column({
        name: 'zip',
        dataType: 'us_postal',
        unique: true,
        comment: 'post code',
      }),
      column({ name: 'id', dataType: 'sysname' }),
    ]);
  });

  it('keeps a qualified type and the quotes of a quoted one', () => {
    expect(
      types(
        'CREATE TABLE t (a "MyType", b public.mood, c "public"."mood", d [dbo].[Phone] NOT NULL, e money.amount, f pg_catalog."varchar"(10));'
      )
    ).toEqual([
      ['a', '"MyType"'],
      ['b', 'public.mood'],
      ['c', '"public"."mood"'],
      ['d', '[dbo].[Phone]'],
      ['e', 'money.amount'],
      ['f', 'pg_catalog."varchar"(10)'],
    ]);
  });

  // Shed, the brackets left dbo.Order, which T-SQL refuses: ORDER is reserved.
  it('keeps the T-SQL brackets of a user type, needed or not', () => {
    expect(
      types(
        'CREATE TABLE [c] ([Name] [sysname] NOT NULL, [Loc] [geography] NULL, [Zip] [my type], [D] [default], [O] [dbo].[Order], [P] dbo.[Order]);'
      )
    ).toEqual([
      ['Name', '[sysname]'],
      ['Loc', 'geography'],
      ['Zip', '[my type]'],
      ['D', '[default]'],
      ['O', '[dbo].[Order]'],
      ['P', 'dbo.[Order]'],
    ]);
  });

  it('still unwraps the quotes of a type the lists carry', () => {
    expect(
      types('CREATE TABLE t ([a] [int], [b] [nvarchar](50), "c" "int4");')
    ).toEqual([
      ['a', 'int'],
      ['b', 'nvarchar(50)'],
      ['c', 'int4'],
    ]);
  });

  // PostgreSQL reads char as character(1) and bit as bit(1), while "char" and
  // "bit" name other types, which pg_dump writes quoted.
  it('keeps the double quotes of "char" and "bit"', () => {
    expect(
      types(
        'CREATE TABLE t (a "char", b char, c "char"[] NOT NULL, d "bit", e "bit"(3), f [char](2), g `bit`, h "CHAR"(2));'
      )
    ).toEqual([
      ['a', '"char"'],
      ['b', 'char'],
      ['c', '"char"[]'],
      ['d', '"bit"'],
      ['e', '"bit"(3)'],
      ['f', 'char(2)'],
      ['g', 'bit'],
      ['h', 'CHAR(2)'],
    ]);
  });

  it('keeps the arguments of a user type', () => {
    expect(
      types(
        "CREATE TABLE t (a halfvec(3), b public.geometry(Point,4326), c my_enum('x','y'));"
      )
    ).toEqual([
      ['a', 'halfvec(3)'],
      ['b', 'public.geometry(Point,4326)'],
      ['c', "my_enum('x','y')"],
    ]);
  });

  it('keeps the array suffix of any type', () => {
    expect(
      types(
        'CREATE TABLE t (a mood[], b text[][], c integer ARRAY, d integer[3], e int ARRAY[4], f "MyType"[], g character varying(20)[], h public.mood [] NOT NULL, i mood ARRAY);'
      )
    ).toEqual([
      ['a', 'mood[]'],
      ['b', 'text[][]'],
      ['c', 'integer ARRAY'],
      ['d', 'integer[3]'],
      ['e', 'int ARRAY[4]'],
      ['f', '"MyType"[]'],
      ['g', 'character varying(20)[]'],
      ['h', 'public.mood[]'],
      ['i', 'mood ARRAY'],
    ]);
  });

  // SQLite takes any words as a type; UNSIGNED INTEGER is no listed name.
  it('keeps the words the lists lack in front of a type they carry', () => {
    expect(
      types(
        'CREATE TABLE t (a UNSIGNED INTEGER NOT NULL, b UNSIGNED SMALLINT(5), c VARYING CHARACTER(255), d UNSIGNED BIG INTEGER, e UNSIGNED TINY INT NOT NULL, f SIGNED BIG INT DEFAULT 0);'
      )
    ).toEqual([
      ['a', 'UNSIGNED INTEGER'],
      ['b', 'UNSIGNED SMALLINT(5)'],
      ['c', 'VARYING CHARACTER(255)'],
      ['d', 'UNSIGNED BIG INTEGER'],
      ['e', 'UNSIGNED TINY INT'],
      ['f', 'SIGNED BIG INT'],
    ]);
  });

  it('reads no type out of the constraint that follows a typeless column', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a,\n' +
        ' b PRIMARY KEY,\n' +
        ' c NOT NULL,\n' +
        ' d NULL,\n' +
        ' e UNIQUE,\n' +
        ' f CHECK (f > 0),\n' +
        ' g REFERENCES o (id) ON DELETE CASCADE,\n' +
        ' h DEFAULT 0,\n' +
        ' i COLLATE NOCASE,\n' +
        ' j CONSTRAINT nn NOT NULL,\n' +
        ' k AS (a + 1),\n' +
        ' l GENERATED ALWAYS AS (a * 2) STORED,\n' +
        " m COMMENT 'x',\n" +
        ' n WITH MASKING POLICY p,\n' +
        ' o VISIBLE,\n' +
        " p 'x',\n" +
        ' q MASKING POLICY mp,\n' +
        ' r PROJECTION POLICY pp,\n' +
        ' s ENCRYPT,\n' +
        ' t INVISIBLE\n' +
        ') AS SELECT * FROM o;'
    );

    expect(ast.columns.map(column => column.dataType)).toEqual(
      Array.from({ length: 20 }, () => '')
    );
    expect(ast.columns.map(column => column.name).join('')).toBe(
      'abcdefghijklmnopqrst'
    );
  });

  it('reads a word the lists lack after the type as an attribute', () => {
    expect(
      types(
        'CREATE TABLE t (a INT UNSIGNED ZEROFILL, b mood SPARSE, c VARCHAR(10) BINARY, d hstore COMPRESSION pglz);'
      )
    ).toEqual([
      ['a', 'INT'],
      ['b', 'mood'],
      ['c', 'VARCHAR(10)'],
      ['d', 'hstore'],
    ]);
  });

  // Each used to read as a column named by its first word, typed by the next.
  it('reads no column out of a table item a column name could open', () => {
    const { ast } = parse(
      'CREATE TABLE t (a int, LIKE s INCLUDING ALL, EXCLUDE USING gist (a WITH &&), EXCLUDE (a WITH =), FULLTEXT ft (a), SPATIAL (a), PERIOD FOR SYSTEM_TIME (a, a), SUPPLEMENTAL LOG DATA (ALL) COLUMNS, b mood);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'int' }),
      column({ name: 'b', dataType: 'mood' }),
    ]);
    expect(ast.indexes).toEqual([]);
  });

  it('still reads a column named by one of those words', () => {
    expect(
      types(
        'CREATE TABLE t (exclude BOOLEAN, fulltext tsvector, fulltext mood, spatial geometry(Point,4326), period INT, supplemental TEXT, "like" s);'
      )
    ).toEqual([
      ['exclude', 'BOOLEAN'],
      ['fulltext', 'tsvector'],
      ['fulltext', 'mood'],
      ['spatial', 'geometry(Point,4326)'],
      ['period', 'INT'],
      ['supplemental', 'TEXT'],
      ['like', 's'],
    ]);
  });

  it('gives no type to the TAG or SORT of a CREATE TABLE AS column', () => {
    expect(
      types(
        "CREATE TABLE t (a TAG (k = 'v'), b SORT, c SORT VISIBLE, d tag, e sort[]) AS SELECT 1, 2, 3, 4, 5;"
      )
    ).toEqual([
      ['a', ''],
      ['b', ''],
      ['c', ''],
      ['d', 'tag'],
      ['e', 'sort[]'],
    ]);
  });

  it('still reads no column out of a table constraint on a user type', () => {
    const { ast } = parse(
      'CREATE TABLE t (a mood, CONSTRAINT pk PRIMARY KEY (a) USING INDEX TABLESPACE ts, INDEX idx_a (a) USING BTREE);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'mood', primaryKey: true }),
    ]);
    expect(ast.indexes).toEqual([
      { name: 'idx_a', unique: false, columns: [{ name: 'a', sort: 'ASC' }] },
    ]);
  });
});

describe('createTableParser - quoted type arguments', () => {
  it('keeps the quotes of an ENUM or SET value', () => {
    const { ast } = parse(
      "CREATE TABLE t (a ENUM('G','PG-13', 'NC-17') NOT NULL DEFAULT 'G', b SET('Deleted Scenes','Trailers'), c enum(''));"
    );

    expect(ast.columns).toEqual([
      column({
        name: 'a',
        dataType: "ENUM('G','PG-13','NC-17')",
        default: "'G'",
        nullable: false,
      }),
      column({ name: 'b', dataType: "SET('Deleted Scenes','Trailers')" }),
      column({ name: 'c', dataType: "enum('')" }),
    ]);
  });

  it('keeps a quote an ENUM value escapes by doubling it', () => {
    const { ast } = parse(
      "CREATE TABLE t (a ENUM('it''s','''x''') DEFAULT 'it''s', b INT);"
    );

    expect(ast.columns).toEqual([
      column({
        name: 'a',
        dataType: "ENUM('it''s','''x''')",
        default: "'it''s'",
      }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
  });

  // MySQL also escapes a quote with a backslash; read as the end of the value,
  // it's became the label it' s.
  it('doubles a quote an ENUM value or a COMMENT escapes with a backslash', () => {
    const { ast } = parse(
      "CREATE TABLE t (a ENUM('it\\'s','b') COMMENT 'it\\'s', b VARCHAR(9) DEFAULT 'C:\\', c INT);"
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: "ENUM('it''s','b')", comment: "it's" }),
      column({ name: 'b', dataType: 'VARCHAR(9)', default: "'C:\\'" }),
      column({ name: 'c', dataType: 'INT' }),
    ]);
  });

  it('writes an argument back in the quotes it came in', () => {
    expect(
      parse(
        'CREATE TABLE t (a SET("x", \'y\'), b OBJECT("city" VARCHAR, zip NUMBER));'
      ).ast.columns.map(column => column.dataType)
    ).toEqual(['SET("x",\'y\')', 'OBJECT("city" VARCHAR,zip NUMBER)']);
  });
});

// Spark escapes a quote with a backslash, and all but its newest releases end
// the literal at a doubled one: what a Databricks import writes back as SQL
// has to escape the way it was read.
describe('createTableParser - Databricks literals', () => {
  const sql = String.raw`CREATE TABLE t (
    a STRUCT<y: STRING COMMENT 'it\'s', z: STRING COMMENT 'C:\\x'> COMMENT 'o\'k',
    b STRING DEFAULT 'it\'s' COMMENT 'a\\b',
    c STRING DEFAULT 'C:\\'
  )`;

  it('writes a field comment and a default back in Spark escapes', () => {
    expect(parse(sql, 'Databricks').ast.columns).toEqual([
      column({
        name: 'a',
        dataType: String.raw`STRUCT<y: STRING COMMENT 'it\'s', z: STRING COMMENT 'C:\\x'>`,
        comment: "o'k",
      }),
      column({
        name: 'b',
        dataType: 'STRING',
        default: String.raw`'it\'s'`,
        comment: String.raw`a\b`,
      }),
      column({ name: 'c', dataType: 'STRING', default: String.raw`'C:\\'` }),
    ]);
  });

  it('doubles the quote of a literal from any other vendor', () => {
    expect(parse(sql).ast.columns).toEqual([
      column({
        name: 'a',
        dataType: String.raw`STRUCT<y: STRING COMMENT 'it''s', z: STRING COMMENT 'C:\\x'>`,
        comment: "o'k",
      }),
      column({
        name: 'b',
        dataType: 'STRING',
        default: "'it''s'",
        comment: String.raw`a\\b`,
      }),
      column({ name: 'c', dataType: 'STRING', default: String.raw`'C:\\'` }),
    ]);
  });
});

describe('createTableParser - column attributes', () => {
  it('reads a quoted reserved word as a column name', () => {
    const { ast } = parse('CREATE TABLE `t` (`key` VARCHAR(30) NOT NULL);');

    expect(ast.columns).toEqual([
      column({ name: 'key', dataType: 'VARCHAR(30)', nullable: false }),
    ]);
    expect(ast.indexes).toEqual([]);
  });

  it('still reads an unquoted KEY as an index definition', () => {
    const { ast } = parse('CREATE TABLE t (a INT, KEY idx_a (a));');

    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
    expect(ast.indexes).toEqual([
      { name: 'idx_a', unique: false, columns: [{ name: 'a', sort: 'ASC' }] },
    ]);
  });

  it('skips CHARACTER SET and COLLATE instead of reading them as the data type', () => {
    const { ast } = parse(
      'CREATE TABLE t (a VARCHAR(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'VARCHAR(30)', nullable: false }),
    ]);
  });

  it('skips a COLLATE written with an equal sign', () => {
    const { ast } = parse('CREATE TABLE t (a VARCHAR(30) COLLATE=binary);');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'VARCHAR(30)' }),
    ]);
  });

  it('keeps the column list when a comment before it holds a semicolon or parentheses', () => {
    const { ast } = parse(
      'CREATE TABLE users /* pk: id; see docs (v2) */ (id INT, name VARCHAR(30));'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'INT' }),
      column({ name: 'name', dataType: 'VARCHAR(30)' }),
    ]);
  });

  it('keeps the column list when a table option brings a second paren group', () => {
    const { ast } = parse(
      'CREATE TABLE t (id INT, name VARCHAR(30)) WITH (fillfactor=70);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'INT' }),
      column({ name: 'name', dataType: 'VARCHAR(30)' }),
    ]);
  });

  it('reads a column COMMENT written with an equal sign', () => {
    const { ast } = parse("CREATE TABLE t (a INT COMMENT='(a)b');");

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', comment: '(a)b' }),
    ]);
  });
});

describe('createTableParser - table level constraints', () => {
  it('applies a composite PRIMARY KEY and a named UNIQUE KEY to the columns', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a INT,\n' +
        ' b INT,\n' +
        ' c VARCHAR(10),\n' +
        ' PRIMARY KEY (a, b),\n' +
        ' UNIQUE KEY uq_c (c)\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', primaryKey: true }),
      column({ name: 'b', dataType: 'INT', primaryKey: true }),
      column({ name: 'c', dataType: 'VARCHAR(10)', unique: true }),
    ]);
  });

  it('matches the constraint column names case insensitively', () => {
    const { ast } = parse('CREATE TABLE t (Id INT, PRIMARY KEY (ID));');

    expect(ast.columns).toEqual([
      column({ name: 'Id', dataType: 'INT', primaryKey: true }),
    ]);
  });

  it('applies an anonymous UNIQUE KEY column list', () => {
    const { ast } = parse('CREATE TABLE t (a INT, UNIQUE KEY (a));');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', unique: true }),
    ]);
  });

  it('records an anonymous UNIQUE over several columns as one unique index', () => {
    const { ast } = parse('CREATE TABLE t (a INT, b INT, UNIQUE (a, b));');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
    expect(ast.indexes).toEqual([
      {
        name: '',
        unique: true,
        columns: [
          { name: 'a', sort: SortType.asc },
          { name: 'b', sort: SortType.asc },
        ],
      },
    ]);
  });

  it('records every spelling of a composite UNIQUE as one unique index', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a INT, b INT, c INT, d INT,\n' +
        ' UNIQUE KEY uq_ab (a, b DESC),\n' +
        ' UNIQUE INDEX uq_bc (b, c),\n' +
        ' CONSTRAINT uq_cd UNIQUE (c, d),\n' +
        ' CONSTRAINT sym UNIQUE KEY uq_ad (a, d),\n' +
        ' CONSTRAINT uq_bd UNIQUE KEY (b, d),\n' +
        ' UNIQUE KEY (a, c)\n' +
        ');'
    );

    expect(ast.columns.every(column => !column.unique)).toBe(true);
    expect(
      ast.indexes.map(({ name, unique, columns }) => [
        name,
        unique,
        columns.map(({ name, sort }) => `${name} ${sort}`).join(', '),
      ])
    ).toEqual([
      ['uq_ab', true, 'a ASC, b DESC'],
      ['uq_bc', true, 'b ASC, c ASC'],
      ['uq_cd', true, 'c ASC, d ASC'],
      ['uq_ad', true, 'a ASC, d ASC'],
      ['uq_bd', true, 'b ASC, d ASC'],
      ['', true, 'a ASC, c ASC'],
    ]);
  });

  it('keeps a CONSTRAINT name to the item it opens', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT, b INT, CONSTRAINT pk PRIMARY KEY (a), UNIQUE (a, b));'
    );

    expect(ast.indexes).toEqual([
      {
        name: '',
        unique: true,
        columns: [
          { name: 'a', sort: SortType.asc },
          { name: 'b', sort: SortType.asc },
        ],
      },
    ]);
  });

  it('reads no key modifier as the name of a composite UNIQUE', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a INT, b INT,\n' +
        ' CONSTRAINT uq_mssql UNIQUE NONCLUSTERED (a, b),\n' +
        ' CONSTRAINT uq_pg UNIQUE NULLS NOT DISTINCT (a, b),\n' +
        ' UNIQUE NULLS DISTINCT (b, a),\n' +
        ' UNIQUE KEY uq_hash USING HASH (a, b),\n' +
        ' UNIQUE KEY USING BTREE (b, a),\n' +
        ' UNIQUE CLUSTERED (a)\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', unique: true }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
    expect(ast.indexes.map(index => index.name)).toEqual([
      'uq_mssql',
      'uq_pg',
      '',
      'uq_hash',
      '',
    ]);
  });

  it('names a SQL Server inline INDEX n UNIQUE by its index name', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a INT, b INT,\n' +
        ' INDEX ix_ab UNIQUE NONCLUSTERED (a, b DESC),\n' +
        ' INDEX [ix_ba] UNIQUE (b, a),\n' +
        ' INDEX ix_a UNIQUE CLUSTERED (a),\n' +
        ' UNIQUE (b, a)\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', unique: true }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
    expect(
      ast.indexes.map(({ name, unique, columns }) => [
        name,
        unique,
        columns.map(({ name, sort }) => `${name} ${sort}`).join(', '),
      ])
    ).toEqual([
      ['ix_ab', true, 'a ASC, b DESC'],
      ['ix_ba', true, 'b ASC, a ASC'],
      ['', true, 'b ASC, a ASC'],
    ]);
  });

  it('reads a filtered SQL Server INDEX n UNIQUE as a plain index unless its WHERE drops only NULL keys', () => {
    const { ast, tokens, $pos } = parse(
      'CREATE TABLE [dbo].[t] (\n' +
        ' [a] INT, [b] INT, [c] INT, [d] INT,\n' +
        ' INDEX [uq_ab] UNIQUE NONCLUSTERED ([a], [b]) WHERE ([a] IS NOT NULL AND ([b] IS NOT NULL)),\n' +
        ' INDEX [ix_bc] UNIQUE ([b], [c] DESC) INCLUDE ([d]) WHERE ([d] > 0) WITH (PAD_INDEX = OFF),\n' +
        ' INDEX [uq_c] UNIQUE ([c]) WHERE [c] IS NOT NULL,\n' +
        ' INDEX [ix_d] UNIQUE ([d]) WHERE [d] IS NOT NULL OR [a] = 1 ON [PRIMARY],\n' +
        ' INDEX [ix_x] UNIQUE ((LOWER([a]))) WHERE [a] > 0,\n' +
        ' [e] INT,\n' +
        ' INDEX [ix_e] UNIQUE CLUSTERED ([e]) WHERE ([e] IS NOT NULL AND [a] > 0)\n' +
        ');\nCREATE TABLE z (i INT);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'b', dataType: 'INT' }),
      column({ name: 'c', dataType: 'INT', unique: true }),
      column({ name: 'd', dataType: 'INT' }),
      column({ name: 'e', dataType: 'INT' }),
    ]);
    expect(
      ast.indexes.map(({ name, unique, columns }) => [
        name,
        unique,
        columns.map(({ name, sort }) => `${name} ${sort}`).join(', '),
      ])
    ).toEqual([
      ['uq_ab', true, 'a ASC, b ASC'],
      ['ix_bc', false, 'b ASC, c DESC'],
      ['ix_d', false, 'd ASC'],
      ['ix_e', false, 'e ASC'],
    ]);
    expect(ast.keys).toEqual([{ name: 'uq_c', columnNames: ['c'] }]);
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('looks for the filter of a unique key no further than its statement', () => {
    const open = parse(
      'CREATE TABLE t (a INT, b INT, UNIQUE (a, b);\n' +
        'CREATE UNIQUE INDEX uq ON t (a) WHERE a > 0;'
    ).ast;
    const cut = parse('CREATE TABLE t (a INT, b INT, UNIQUE (a, b)').ast;

    expect(open.indexes[0]).toMatchObject({ name: '', unique: true });
    expect(cut.indexes[0]).toMatchObject({ name: '', unique: true });
  });

  it('reports the name of each primary key and one-column unique key it names', () => {
    const { ast } = parse(
      'CREATE TABLE "HR"."T" (\n' +
        ' "ID" NUMBER CONSTRAINT "T_NN" NOT NULL ENABLE,\n' +
        ' "A" NUMBER, "B" NUMBER,\n' +
        ' "C" NUMBER CONSTRAINT "T_C_UK" UNIQUE USING INDEX TABLESPACE "USERS",\n' +
        ' "D" NUMBER CONSTRAINT "T_D_NN" NOT NULL UNIQUE,\n' +
        ' "E" NUMBER UNIQUE,\n' +
        ' CONSTRAINT "T_PK" PRIMARY KEY ("ID", "A") USING INDEX ENABLE,\n' +
        ' CONSTRAINT "T_B_UK" UNIQUE ("B"),\n' +
        ' CONSTRAINT "T_AB_UK" UNIQUE ("A", "B"),\n' +
        ' UNIQUE KEY "T_E_IX" ("E"), INDEX "T_D_IX" UNIQUE ("D")\n' +
        ');\n'
    );

    expect(ast.keys).toEqual([
      { name: 'T_C_UK', columnNames: ['C'] },
      { name: 'T_PK', columnNames: ['ID', 'A'] },
      { name: 'T_B_UK', columnNames: ['B'] },
      { name: 'T_E_IX', columnNames: ['E'] },
      { name: 'T_D_IX', columnNames: ['D'] },
    ]);
    expect(
      parse(
        'CREATE TABLE t (id INT CONSTRAINT nn NOT NULL PRIMARY KEY, a INT);\n'
      ).ast.keys
    ).toEqual([]);
    expect(
      parse('CREATE TABLE t (id INT CONSTRAINT pk_t PRIMARY KEY, a INT);\n').ast
        .keys
    ).toEqual([{ name: 'pk_t', columnNames: ['id'] }]);
  });

  it("reports a key with no name, composite or not, only where Oracle's USING INDEX follows it", () => {
    const { ast } = parse(
      'CREATE TABLE "HR"."T" (\n' +
        ' "ID" NUMBER, "A" NUMBER, "B" NUMBER,\n' +
        ' "E" NUMBER UNIQUE USING INDEX ENABLE,\n' +
        ' "F" NUMBER UNIQUE, "G" NUMBER,\n' +
        ' PRIMARY KEY ("ID") USING INDEX PCTFREE 10 ENABLE,\n' +
        ' UNIQUE ("A", "B") USING INDEX ENABLE,\n' +
        ' UNIQUE ("B", "G") ENABLE,\n' +
        ' UNIQUE ("G") ENABLE, CHECK ("A" > 0) USING INDEX\n' +
        ');\n'
    );

    expect(ast.keys).toEqual([
      { name: '', columnNames: ['E'] },
      { name: '', columnNames: ['ID'] },
      { name: '', columnNames: ['A', 'B'] },
    ]);
    expect(ast.indexes.map(({ columns }) => columns.length)).toEqual([2, 2]);
  });

  it("reports no key with no name that PostgreSQL's USING INDEX TABLESPACE follows", () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' id int PRIMARY KEY USING INDEX TABLESPACE fast,\n' +
        ' a int, b int, e text UNIQUE USING INDEX TABLESPACE fast,\n' +
        ' UNIQUE (a, b) INCLUDE (e) WITH (fillfactor = 70) USING INDEX TABLESPACE fast\n' +
        ');\n'
    );

    expect(ast.keys).toEqual([]);
    expect(ast.indexes).toEqual([
      {
        name: '',
        unique: true,
        columns: [
          { name: 'a', sort: SortType.asc },
          { name: 'b', sort: SortType.asc },
        ],
      },
    ]);
    expect(
      parse(
        'CREATE TABLE t (a int, b int, PRIMARY KEY (a, b) USING INDEX TABLESPACE fast);\n'
      ).ast.keys
    ).toEqual([]);
  });

  it('reads a primary key part by its first word', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a TEXT, b INT,\n' +
        ' CONSTRAINT pk_t PRIMARY KEY CLUSTERED (a(10) ASC, b DESC),\n' +
        ' c INT\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'TEXT', primaryKey: true }),
      column({ name: 'b', dataType: 'INT', primaryKey: true }),
      column({ name: 'c', dataType: 'INT' }),
    ]);
    expect(ast.keys).toEqual([{ name: 'pk_t', columnNames: ['a', 'b'] }]);
  });

  it('reads no key list after a column level UNIQUE', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a NUMBER UNIQUE USING INDEX (CREATE UNIQUE INDEX ix ON t (a)),\n' +
        ' b NUMBER CONSTRAINT uq_b UNIQUE USING INDEX TABLESPACE users,\n' +
        ' c NUMBER UNIQUE KEY,\n' +
        ' t NUMBER\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'NUMBER', unique: true }),
      column({ name: 'b', dataType: 'NUMBER', unique: true }),
      column({ name: 'c', dataType: 'NUMBER', unique: true }),
      column({ name: 't', dataType: 'NUMBER' }),
    ]);
    expect(ast.indexes).toEqual([]);
  });

  it('keeps a column level UNIQUE NULLS NOT DISTINCT on its column', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT UNIQUE NULLS NOT DISTINCT NOT NULL, b INT);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', unique: true, nullable: false }),
      column({ name: 'b', dataType: 'INT' }),
    ]);
  });

  it('ignores a CONSTRAINT that is immediately followed by a group', () => {
    const { ast } = parse('CREATE TABLE t (a INT, CONSTRAINT (b));');

    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
  });

  it('applies a named CONSTRAINT ... UNIQUE column list', () => {
    const { ast } = parse('CREATE TABLE t (a INT, CONSTRAINT uq UNIQUE (a));');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', unique: true }),
    ]);
  });

  it('applies a UNIQUE constraint that only has an index name', () => {
    const { ast } = parse('CREATE TABLE t (a INT, UNIQUE uq_a (a));');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', unique: true }),
    ]);
  });

  it('reads the key after a CONSTRAINT that has no name', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT, b INT, CONSTRAINT PRIMARY KEY (a), CONSTRAINT UNIQUE (b));'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', primaryKey: true }),
      column({ name: 'b', dataType: 'INT', unique: true }),
    ]);
  });

  it('parses INDEX and KEY definitions with sort directions', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a INT, b INT,\n' +
        ' INDEX idx_ab (a ASC, b DESC),\n' +
        ' KEY idx_a (a)\n' +
        ');'
    );

    expect(ast.indexes).toEqual([
      {
        name: 'idx_ab',
        unique: false,
        columns: [
          { name: 'a', sort: SortType.asc },
          { name: 'b', sort: SortType.desc },
        ],
      },
      {
        name: 'idx_a',
        unique: false,
        columns: [{ name: 'a', sort: SortType.asc }],
      },
    ]);
  });

  it('ignores a trailing comma inside an index column list', () => {
    const { ast } = parse('CREATE TABLE t (a INT, b INT, KEY idx (a, b,));');

    expect(ast.indexes).toEqual([
      {
        name: 'idx',
        unique: false,
        columns: [
          { name: 'a', sort: SortType.asc },
          { name: 'b', sort: SortType.asc },
        ],
      },
    ]);
  });

  it('ignores an index without a column list', () => {
    const { ast } = parse('CREATE TABLE t (a INT, INDEX idx_a);');

    expect(ast.indexes).toEqual([]);
  });

  it('ignores an index with an empty column list', () => {
    const { ast } = parse('CREATE TABLE t (a INT, KEY idx ());');

    expect(ast.indexes).toEqual([]);
  });

  it('ignores an index without a name', () => {
    const { ast } = parse('CREATE TABLE t (a INT, INDEX (a));');

    expect(ast.indexes).toEqual([]);
    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
  });

  it('parses a named FOREIGN KEY constraint', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a INT,\n' +
        ' CONSTRAINT fk_a FOREIGN KEY (a) REFERENCES other (id)\n' +
        ');'
    );

    expect(ast.foreignKeys).toEqual([
      {
        columnNames: ['a'],
        refTableName: 'other',
        refColumnNames: ['id'],
        onDelete: '',
        onUpdate: '',
      },
    ]);
  });

  it('parses a composite FOREIGN KEY that references a qualified table', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a INT, b INT,\n' +
        ' FOREIGN KEY (a, b) REFERENCES public.other (x, y)\n' +
        ');'
    );

    expect(ast.foreignKeys).toEqual([
      {
        columnNames: ['a', 'b'],
        refTableName: 'other',
        refColumnNames: ['x', 'y'],
        onDelete: '',
        onUpdate: '',
      },
    ]);
  });

  it('parses a FOREIGN KEY that references a catalog qualified table', () => {
    const { ast } = parse(
      'CREATE TABLE orders (\n' +
        ' id BIGINT,\n' +
        ' cust_id BIGINT,\n' +
        ' CONSTRAINT fk1 FOREIGN KEY (cust_id) REFERENCES main.sales.customers (id)\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'BIGINT' }),
      column({ name: 'cust_id', dataType: 'BIGINT' }),
    ]);
    expect(ast.foreignKeys).toEqual([
      {
        columnNames: ['cust_id'],
        refTableName: 'customers',
        refColumnNames: ['id'],
        onDelete: '',
        onUpdate: '',
      },
    ]);
  });

  it('skips the state clauses that trail a constraint', () => {
    const { ast } = parse(
      'CREATE TABLE posts (\n' +
        ' id BIGINT NOT NULL,\n' +
        ' user_id BIGINT,\n' +
        ' CONSTRAINT pk_posts PRIMARY KEY (id) NOT ENFORCED RELY,\n' +
        ' CONSTRAINT fk_posts FOREIGN KEY (user_id) REFERENCES users (id) NOT ENFORCED RELY\n' +
        ');'
    );

    expect(ast.columns).toEqual([
      column({
        name: 'id',
        dataType: 'BIGINT',
        primaryKey: true,
        nullable: false,
      }),
      column({ name: 'user_id', dataType: 'BIGINT' }),
    ]);
    expect(ast.foreignKeys).toEqual([
      {
        columnNames: ['user_id'],
        refTableName: 'users',
        refColumnNames: ['id'],
        onDelete: '',
        onUpdate: '',
      },
    ]);
  });

  it('skips the ANSI DEFERRABLE INITIALLY DEFERRED spelling', () => {
    const { ast } = parse(
      'CREATE TABLE t (\n' +
        ' a INT,\n' +
        ' CONSTRAINT fk_a FOREIGN KEY (a) REFERENCES o (x) DEFERRABLE INITIALLY DEFERRED\n' +
        ');'
    );

    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
    expect(ast.foreignKeys).toEqual([
      {
        columnNames: ['a'],
        refTableName: 'o',
        refColumnNames: ['x'],
        onDelete: '',
        onUpdate: '',
      },
    ]);
  });

  it('skips a bare NORELY that trails a PRIMARY KEY', () => {
    const { ast } = parse('CREATE TABLE t (a INT, PRIMARY KEY (a) NORELY);');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', primaryKey: true }),
    ]);
  });

  it('drops a FOREIGN KEY whose column counts do not match', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT, FOREIGN KEY (a) REFERENCES o (x, y));'
    );

    expect(ast.foreignKeys).toEqual([]);
  });

  // The item still opens with FOREIGN, so its words belong to that malformed
  // constraint rather than to a column named REFERENCES.
  it('drops a FOREIGN without KEY, and every word of its item', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT, FOREIGN (a) REFERENCES o (x));'
    );

    expect(ast.foreignKeys).toEqual([]);
    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
  });

  // An unnamed CHECK used to read as a column named CHECK with no type.
  it.each([
    [
      'PostgreSQL',
      'CREATE TABLE u (id int, price numeric, CHECK (price > 0) NO INHERIT, label text);',
    ],
    [
      'MySQL 8',
      'CREATE TABLE `u` (`id` int, `price` int, CHECK (`price` > 0) NOT ENFORCED, check (`id` > 0) ENFORCED, `label` text);',
    ],
    [
      'SQLite',
      'CREATE TABLE u (id INTEGER, price INTEGER, CHECK(price>0), label TEXT);',
    ],
    [
      'T-SQL',
      'CREATE TABLE [dbo].[u] ([id] [int] NOT NULL, [price] [int] NULL, CHECK NOT FOR REPLICATION ([price]>(0)), [label] [nvarchar](10) NULL);',
    ],
  ])('reads no column out of an unnamed %s table CHECK', (_, sql) => {
    const { ast } = parse(sql);

    expect(ast.columns.map(({ name }) => name)).toEqual([
      'id',
      'price',
      'label',
    ]);
  });

  it('still reads a quoted column named check', () => {
    const { ast } = parse(
      'CREATE TABLE u (id int, "check" int CHECK ("check" > 0), `check` (a));'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'int' }),
      column({ name: 'check', dataType: 'int' }),
      column({ name: 'check' }),
    ]);
  });
});

describe('createTableParser - constraint and index items', () => {
  const idAndA = [
    column({ name: 'id', dataType: 'INT' }),
    column({ name: 'a_id', dataType: 'INT' }),
  ];
  const foreignKey = {
    columnNames: ['a_id'],
    refTableName: 'a',
    refColumnNames: ['id'],
    onDelete: '',
    onUpdate: '',
  };

  it('reads the referential actions that trail a FOREIGN KEY', () => {
    for (const [actions, onDelete, onUpdate] of [
      [
        'ON DELETE RESTRICT ON UPDATE CASCADE',
        ReferentialAction.restrict,
        ReferentialAction.cascade,
      ],
      ['ON DELETE SET NULL', ReferentialAction.setNull, ''],
      ['MATCH FULL ON DELETE CASCADE', ReferentialAction.cascade, ''],
      ['on update no action', '', ReferentialAction.noAction],
      [
        'ON DELETE SET NULL (a_id) ON UPDATE CASCADE',
        ReferentialAction.setNull,
        ReferentialAction.cascade,
      ],
      [
        'ON DELETE SET DEFAULT (a_id, b) ON UPDATE RESTRICT',
        ReferentialAction.setDefault,
        ReferentialAction.restrict,
      ],
    ]) {
      const { ast } = parse(
        `CREATE TABLE b (id INT, a_id INT, FOREIGN KEY (a_id) REFERENCES a (id) ${actions});`
      );

      expect(ast.columns).toEqual(idAndA);
      expect(ast.foreignKeys).toEqual([{ ...foreignKey, onDelete, onUpdate }]);
    }

    const { ast } = parse(
      'CREATE TABLE b (id INT, a_id INT, CONSTRAINT fk FOREIGN KEY (a_id) REFERENCES a (id) ON UPDATE NO ACTION ON DELETE SET DEFAULT, c INT);'
    );

    expect(ast.columns).toEqual([
      ...idAndA,
      column({ name: 'c', dataType: 'INT' }),
    ]);
    expect(ast.foreignKeys).toEqual([
      {
        ...foreignKey,
        onDelete: ReferentialAction.setDefault,
        onUpdate: ReferentialAction.noAction,
      },
    ]);
  });

  it('keeps the data type of an inline REFERENCES with a SET NULL action', () => {
    const { ast } = parse(
      'CREATE TABLE b (id INT, a_id BIGINT REFERENCES a (id) ON DELETE SET NULL, c INTEGER REFERENCES a (id) ON DELETE SET NULL);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'INT' }),
      column({ name: 'a_id', dataType: 'BIGINT' }),
      column({ name: 'c', dataType: 'INTEGER' }),
    ]);
  });

  it('keys the column an inline REFERENCES ends, with its actions', () => {
    const { ast } = parse(
      'CREATE TABLE b (id INT, a_id BIGINT NOT NULL REFERENCES s.a (id) ON DELETE CASCADE ON UPDATE RESTRICT, c INT REFERENCES a, d INT);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'INT' }),
      column({ name: 'a_id', dataType: 'BIGINT', nullable: false }),
      column({ name: 'c', dataType: 'INT' }),
      column({ name: 'd', dataType: 'INT' }),
    ]);
    expect(ast.foreignKeys).toEqual([
      {
        columnNames: ['a_id'],
        refTableName: 'a',
        refColumnNames: ['id'],
        onDelete: ReferentialAction.cascade,
        onUpdate: ReferentialAction.restrict,
      },
      {
        columnNames: ['c'],
        refTableName: 'a',
        refColumnNames: [],
        onDelete: '',
        onUpdate: '',
      },
    ]);
  });

  it('keys the column an inline FOREIGN KEY REFERENCES ends, named or not', () => {
    for (const constraint of ['', 'CONSTRAINT fk_a ']) {
      const { ast } = parse(
        `CREATE TABLE b (a_id INT ${constraint}FOREIGN KEY REFERENCES a (id) ON DELETE CASCADE, c INT NOT NULL FOREIGN KEY REFERENCES a, d INT);`
      );

      expect(ast.columns).toEqual([
        column({ name: 'a_id', dataType: 'INT' }),
        column({ name: 'c', dataType: 'INT', nullable: false }),
        column({ name: 'd', dataType: 'INT' }),
      ]);
      expect(ast.foreignKeys).toEqual([
        {
          columnNames: ['a_id'],
          refTableName: 'a',
          refColumnNames: ['id'],
          onDelete: ReferentialAction.cascade,
          onUpdate: '',
        },
        {
          columnNames: ['c'],
          refTableName: 'a',
          refColumnNames: [],
          onDelete: '',
          onUpdate: '',
        },
      ]);
    }
  });

  it('reads the column attributes that follow an inline REFERENCES', () => {
    const { ast } = parse(
      "CREATE TABLE b (a_id INT REFERENCES a (id) NOT NULL DEFAULT 1 COMMENT 'x');"
    );

    expect(ast.columns).toEqual([
      column({
        name: 'a_id',
        dataType: 'INT',
        nullable: false,
        default: '1',
        comment: 'x',
      }),
    ]);
    expect(ast.foreignKeys).toHaveLength(1);
  });

  it('keys no column from an inline REFERENCES it cannot read', () => {
    for (const sql of [
      'CREATE TABLE b (a_id INT REFERENCES (id), z INT);',
      'CREATE TABLE b (a_id INT REFERENCES a (x, y), z INT);',
      'CREATE TABLE b (a_id INT REFERENCES',
    ]) {
      const { ast } = parse(sql);

      expect(ast.foreignKeys).toEqual([]);
      expect(ast.columns[0]).toEqual(column({ name: 'a_id', dataType: 'INT' }));
    }
  });

  it('drops the ON UPDATE of a MySQL timestamp and keeps what follows it', () => {
    const { ast } = parse(
      "CREATE TABLE t (ts DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'x', z INT);"
    );

    expect(ast.columns).toEqual([
      column({
        name: 'ts',
        dataType: 'DATETIME(3)',
        default: 'CURRENT_TIMESTAMP(3)',
        comment: 'x',
        nullable: false,
      }),
      column({ name: 'z', dataType: 'INT' }),
    ]);
  });

  it('still skips the value of an ON UPDATE that is no referential action', () => {
    const { ast } = parse(
      'CREATE TABLE t (ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, z INT);'
    );

    expect(ast.columns).toEqual([
      column({
        name: 'ts',
        dataType: 'TIMESTAMP',
        default: 'CURRENT_TIMESTAMP',
      }),
      column({ name: 'z', dataType: 'INT' }),
    ]);
  });

  it('marks the column of a named single column UNIQUE INDEX', () => {
    const { ast } = parse(
      'CREATE TABLE b (id INT, code VARCHAR(10), UNIQUE INDEX idx_code (code ASC));'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'INT' }),
      column({ name: 'code', dataType: 'VARCHAR(10)', unique: true }),
    ]);
    expect(ast.indexes).toEqual([]);
  });

  it('records a named UNIQUE INDEX over several columns as a unique index', () => {
    const { ast } = parse(
      'CREATE TABLE b (a INT, c INT, UNIQUE INDEX idx_ac (a ASC, c DESC));'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'c', dataType: 'INT' }),
    ]);
    expect(ast.indexes).toEqual([
      {
        name: 'idx_ac',
        unique: true,
        columns: [
          { name: 'a', sort: SortType.asc },
          { name: 'c', sort: SortType.desc },
        ],
      },
    ]);
  });

  it('keeps the items after a UNIQUE INDEX whose key has a prefix length', () => {
    const { ast } = parse(
      'CREATE TABLE `b` (`id` INT, `email` VARCHAR(255), `a_id` INT, UNIQUE INDEX `email_UNIQUE` (`email`(191) ASC) VISIBLE, INDEX `fk_idx` (`a_id` ASC) VISIBLE, CONSTRAINT `fk` FOREIGN KEY (`a_id`) REFERENCES `a` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'INT' }),
      column({ name: 'email', dataType: 'VARCHAR(255)', unique: true }),
      column({ name: 'a_id', dataType: 'INT' }),
    ]);
    expect(ast.indexes).toEqual([
      {
        name: 'fk_idx',
        unique: false,
        columns: [{ name: 'a_id', sort: SortType.asc }],
      },
    ]);
    expect(ast.foreignKeys).toEqual([
      {
        ...foreignKey,
        onDelete: ReferentialAction.noAction,
        onUpdate: ReferentialAction.noAction,
      },
    ]);
  });

  it('reads the column of each prefix length key part', () => {
    const { ast } = parse(
      'CREATE TABLE b (a TEXT, c TEXT, UNIQUE INDEX uq_ac (a(100), c(100) DESC), INDEX idx_c (c(10)), z INT);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'TEXT' }),
      column({ name: 'c', dataType: 'TEXT' }),
      column({ name: 'z', dataType: 'INT' }),
    ]);
    expect(ast.indexes).toEqual([
      {
        name: 'uq_ac',
        unique: true,
        columns: [
          { name: 'a', sort: SortType.asc },
          { name: 'c', sort: SortType.desc },
        ],
      },
      {
        name: 'idx_c',
        unique: false,
        columns: [{ name: 'c', sort: SortType.asc }],
      },
    ]);
  });

  it('records no key over a functional key part and keeps the items after it', () => {
    const { ast } = parse(
      'CREATE TABLE b (id INT, email VARCHAR(255), UNIQUE INDEX uq_lower ((lower(email))), UNIQUE INDEX uq_id_lower (id, (lower(email))), KEY idx_upper ((upper(email)) DESC), a_id INT, CONSTRAINT fk FOREIGN KEY (a_id) REFERENCES a (id));'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'INT' }),
      column({ name: 'email', dataType: 'VARCHAR(255)' }),
      column({ name: 'a_id', dataType: 'INT' }),
    ]);
    expect(ast.indexes).toEqual([]);
    expect(ast.foreignKeys).toEqual([foreignKey]);
  });

  it('records a FULLTEXT or SPATIAL index without a column for its kind', () => {
    for (const kind of ['FULLTEXT INDEX', 'FULLTEXT KEY', 'SPATIAL INDEX']) {
      const { ast } = parse(
        `CREATE TABLE b (id INT, g TEXT, ${kind} idx_g (g));`
      );

      expect(ast.columns).toEqual([
        column({ name: 'id', dataType: 'INT' }),
        column({ name: 'g', dataType: 'TEXT' }),
      ]);
      expect(ast.indexes).toEqual([
        { name: 'idx_g', unique: false, columns: [{ name: 'g', sort: 'ASC' }] },
      ]);
    }
  });

  it('still reads a quoted on or spatial and a bare spatial as columns', () => {
    const { ast } = parse(
      'CREATE TABLE b (`on` INT, `spatial` INT, "match" INT, spatial GEOMETRY, `fulltext` TEXT);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'on', dataType: 'INT' }),
      column({ name: 'spatial', dataType: 'INT' }),
      column({ name: 'match', dataType: 'INT' }),
      column({ name: 'spatial', dataType: 'GEOMETRY' }),
      column({ name: 'fulltext', dataType: 'TEXT' }),
    ]);
  });

  it('keeps the first data type of a column', () => {
    const { ast } = parse(
      'CREATE TABLE staff (password VARCHAR(40) BINARY NULL DEFAULT NULL);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'password', dataType: 'VARCHAR(40)', default: 'NULL' }),
    ]);
  });

  it.each<[string, string, string[]]>([
    [
      'MySQL Workbench VISIBLE',
      'CREATE TABLE `b` (`id` INT, `code` VARCHAR(10), UNIQUE INDEX `code_UNIQUE` (`code` ASC) VISIBLE, INDEX `fk_idx` (`id` ASC) VISIBLE);',
      ['id INT', 'code VARCHAR(10)'],
    ],
    [
      'Oracle ENABLE',
      'CREATE TABLE "B" ("ID" NUMBER(10), "A_ID" NUMBER(10), CONSTRAINT "FK" FOREIGN KEY ("A_ID") REFERENCES "A" ("ID") ON DELETE CASCADE ENABLE);',
      ['ID NUMBER(10)', 'A_ID NUMBER(10)'],
    ],
    [
      'WITH PARSER',
      'CREATE TABLE b (id INT, title TEXT, FULLTEXT INDEX ft (title) WITH PARSER ngram);',
      ['id INT', 'title TEXT'],
    ],
    [
      'USING BTREE',
      'CREATE TABLE b (id INT, code INT, PRIMARY KEY (id) USING BTREE, KEY idx_code (code) USING BTREE);',
      ['id INT', 'code INT'],
    ],
    [
      'CHECK',
      'CREATE TABLE b (id INT, price INT, CONSTRAINT chk_price CHECK (price > 0));',
      ['id INT', 'price INT'],
    ],
    [
      'SQLite ON CONFLICT',
      'CREATE TABLE b (id INT, code TEXT, UNIQUE (code) ON CONFLICT REPLACE);',
      ['id INT', 'code TEXT'],
    ],
  ])(
    'reads no column out of the words that trail a constraint: %s',
    (_, sql, expected) => {
      const { ast } = parse(sql);

      expect(
        ast.columns.map(({ name, dataType }) => `${name} ${dataType}`)
      ).toEqual(expected);
    }
  );

  it('keeps the primary key of a SQL Server PRIMARY KEY CLUSTERED', () => {
    const { ast } = parse(
      'CREATE TABLE [dbo].[b] ([id] INT NOT NULL, [name] NVARCHAR(50), CONSTRAINT [PK_b] PRIMARY KEY CLUSTERED ([id] ASC) WITH (PAD_INDEX = OFF) ON [PRIMARY]) ON [PRIMARY];'
    );

    expect(ast.columns).toEqual([
      column({
        name: 'id',
        dataType: 'INT',
        nullable: false,
        primaryKey: true,
      }),
      column({ name: 'name', dataType: 'NVARCHAR(50)' }),
    ]);
  });
});

describe('createTableParser - truncated input', () => {
  it('closes an unterminated data type argument list', () => {
    const { ast } = parse('CREATE TABLE t (a VARCHAR(10');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'VARCHAR(10)' }),
    ]);
  });

  it('flushes the pending column when the body is not closed', () => {
    const { ast } = parse('CREATE TABLE t (a INT, b VARCHAR(10)');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'b', dataType: 'VARCHAR(10)' }),
    ]);
  });

  it('still applies an unterminated PRIMARY KEY list', () => {
    const { ast } = parse('CREATE TABLE t (a INT, PRIMARY KEY (a');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', primaryKey: true }),
    ]);
  });

  it('still applies an unterminated UNIQUE list', () => {
    const { ast } = parse('CREATE TABLE t (a INT, UNIQUE (a');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', unique: true }),
    ]);
  });

  it('still records an unterminated index column list', () => {
    const { ast } = parse('CREATE TABLE t (a INT, KEY idx (a');

    expect(ast.indexes).toEqual([
      {
        name: 'idx',
        unique: false,
        columns: [{ name: 'a', sort: SortType.asc }],
      },
    ]);
  });

  it('drops an unterminated FOREIGN KEY', () => {
    const { ast } = parse('CREATE TABLE t (a INT, FOREIGN KEY (a');

    expect(ast.foreignKeys).toEqual([]);
    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
  });

  it('stops at the end of input for an unterminated parenthesis group', () => {
    const { ast, tokens, $pos } = parse('CREATE TABLE t (a INT CHECK (a');

    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
    expect($pos.value).toBeGreaterThanOrEqual(tokens.length);
  });
});

describe('parserForeignKeyParser', () => {
  it('returns the foreign key for a well formed definition', () => {
    const { foreignKey } = parseForeignKey('FOREIGN KEY (a) REFERENCES o (x)');

    expect(foreignKey).toEqual({
      columnNames: ['a'],
      refTableName: 'o',
      refColumnNames: ['x'],
      onDelete: '',
      onUpdate: '',
    });
  });

  it('resolves a schema qualified reference table', () => {
    const { foreignKey } = parseForeignKey(
      'FOREIGN KEY (a) REFERENCES sc.o (x)'
    );

    expect(foreignKey?.refTableName).toBe('o');
  });

  it('resolves a catalog qualified reference table', () => {
    const { foreignKey } = parseForeignKey(
      'FOREIGN KEY (a) REFERENCES cat.sc.o (x)'
    );

    expect(foreignKey?.refTableName).toBe('o');
  });

  it('keeps the first identifier when the period has no following name', () => {
    const { foreignKey } = parseForeignKey(
      'FOREIGN KEY (a) REFERENCES sc. (x)'
    );

    expect(foreignKey).toEqual({
      columnNames: ['a'],
      refTableName: 'sc',
      refColumnNames: ['x'],
      onDelete: '',
      onUpdate: '',
    });
  });

  it('returns null and only consumes one token when KEY is missing', () => {
    const { foreignKey, $pos } = parseForeignKey(
      'FOREIGN (a) REFERENCES o (x)'
    );

    expect(foreignKey).toBeNull();
    expect($pos.value).toBe(1);
  });

  it('returns null when there is no local column list', () => {
    const { foreignKey } = parseForeignKey('FOREIGN KEY REFERENCES o (x)');

    expect(foreignKey).toBeNull();
  });

  it('returns null when the REFERENCES clause is missing', () => {
    const { foreignKey } = parseForeignKey('FOREIGN KEY (a)');

    expect(foreignKey).toBeNull();
  });

  it('returns null when REFERENCES is not followed by a table name', () => {
    const { foreignKey } = parseForeignKey('FOREIGN KEY (a) REFERENCES (x)');

    expect(foreignKey).toBeNull();
  });

  it('keeps a key with no referenced column list, the referenced primary key', () => {
    const { foreignKey, $pos, tokens } = parseForeignKey(
      'FOREIGN KEY (a, b) REFERENCES o ON DELETE CASCADE, c INT'
    );

    expect(foreignKey).toEqual({
      columnNames: ['a', 'b'],
      refTableName: 'o',
      refColumnNames: [],
      onDelete: ReferentialAction.cascade,
      onUpdate: '',
    });
    expect(tokens[$pos.value].value).toBe(',');
  });

  it('returns null when the column counts differ', () => {
    const { foreignKey } = parseForeignKey(
      'FOREIGN KEY (a, b) REFERENCES o (x)'
    );

    expect(foreignKey).toBeNull();
  });

  it('returns null for a truncated column list', () => {
    const { foreignKey } = parseForeignKey('FOREIGN KEY (a');

    expect(foreignKey).toBeNull();
  });
});
