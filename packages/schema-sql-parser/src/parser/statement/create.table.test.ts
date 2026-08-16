import { describe, expect, it } from 'vite-plus/test';

import { Column, RefPos, SortType, StatementType } from '@/parser/statement';
import {
  createTableParser,
  parserForeignKeyParser,
} from '@/parser/statement/create.table';
import { tokenizer } from '@/parser/tokenizer';

function parse(sql: string) {
  const tokens = tokenizer(sql);
  const $pos: RefPos = { value: 0 };
  const ast = createTableParser(tokens, $pos);
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
      column({ name: 'name', dataType: 'VARCHAR(50)', default: 'anon' }),
    ]);
    expect(ast.indexes).toEqual([]);
    expect(ast.foreignKeys).toEqual([]);
  });

  it('keeps only the last identifier of a database qualified name', () => {
    const { ast } = parse('CREATE TABLE public.accounts (id INT);');

    expect(ast.name).toBe('accounts');
    expect(ast.columns).toEqual([column({ name: 'id', dataType: 'INT' })]);
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

  it('leaves the name empty when the body starts immediately', () => {
    const { ast } = parse('CREATE TABLE (a INT);');

    expect(ast.name).toBe('');
    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
  });

  it('ignores a table COMMENT that is written with an equal sign', () => {
    const { ast } = parse("CREATE TABLE t (id INT) COMMENT='table comment';");

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

  it('produces no column for an empty body', () => {
    const { ast } = parse('CREATE TABLE t ();');

    expect(ast.columns).toEqual([]);
  });

  it('keeps the last data type keyword of a multi word PostgreSQL type', () => {
    const { ast } = parse(
      'CREATE TABLE t ("id" serial PRIMARY KEY, "d" timestamp without time zone);'
    );

    expect(ast.columns).toEqual([
      column({ name: 'id', dataType: 'serial', primaryKey: true }),
      column({ name: 'd', dataType: 'time' }),
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

  it('applies an anonymous UNIQUE constraint over several columns', () => {
    const { ast } = parse('CREATE TABLE t (a INT, b INT, UNIQUE (a, b));');

    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT', unique: true }),
      column({ name: 'b', dataType: 'INT', unique: true }),
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

  it('swallows the following keyword when CONSTRAINT has no name', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT, CONSTRAINT PRIMARY KEY (a));'
    );

    expect(ast.columns).toEqual([column({ name: 'a', dataType: 'INT' })]);
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
      { columnNames: ['a'], refTableName: 'other', refColumnNames: ['id'] },
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
      },
    ]);
  });

  it('drops a FOREIGN KEY whose column counts do not match', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT, FOREIGN KEY (a) REFERENCES o (x, y));'
    );

    expect(ast.foreignKeys).toEqual([]);
  });

  it('treats FOREIGN without KEY as a plain token sequence', () => {
    const { ast } = parse(
      'CREATE TABLE t (a INT, FOREIGN (a) REFERENCES o (x));'
    );

    expect(ast.foreignKeys).toEqual([]);
    expect(ast.columns).toEqual([
      column({ name: 'a', dataType: 'INT' }),
      column({ name: 'REFERENCES' }),
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
    });
  });

  it('resolves a schema qualified reference table', () => {
    const { foreignKey } = parseForeignKey(
      'FOREIGN KEY (a) REFERENCES sc.o (x)'
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

  it('returns null when the referenced column list is missing', () => {
    const { foreignKey } = parseForeignKey('FOREIGN KEY (a) REFERENCES o');

    expect(foreignKey).toBeNull();
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
