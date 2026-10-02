import { describe, expect, it } from 'vite-plus/test';

import { RefPos, SortType, StatementType } from '@/parser/statement';
import { createIndexParser } from '@/parser/statement/create.index';
import { tokenizer } from '@/parser/tokenizer';

function parse(sql: string, start = 0) {
  const tokens = tokenizer(sql);
  const $pos: RefPos = { value: start };
  const ast = createIndexParser(tokens, $pos);
  return { ast, tokens, $pos };
}

describe('createIndexParser', () => {
  it('stops on the terminator instead of reading the statement after it', () => {
    const { ast, $pos, tokens } = parse(
      "CREATE INDEX idx_a ON t (a); COMMENT ON TABLE t IS 'a';"
    );

    expect(ast.tableName).toBe('t');
    expect(tokens[$pos.value].value).toBe('COMMENT');
  });

  it('parses a simple non unique index', () => {
    const { ast } = parse('CREATE INDEX idx_a ON t (a);');

    expect(ast).toEqual({
      type: StatementType.createIndex,
      name: 'idx_a',
      unique: false,
      tableName: 't',
      columns: [{ name: 'a', sort: SortType.asc }],
    });
  });

  it('parses a unique index with explicit sort directions', () => {
    const { ast } = parse('CREATE UNIQUE INDEX idx_a ON t (a DESC, b ASC);');

    expect(ast.unique).toBe(true);
    expect(ast.name).toBe('idx_a');
    expect(ast.tableName).toBe('t');
    expect(ast.columns).toEqual([
      { name: 'a', sort: SortType.desc },
      { name: 'b', sort: SortType.asc },
    ]);
  });

  it('defaults every column of a multi column index to ASC', () => {
    const { ast } = parse('CREATE INDEX idx ON t (a, b, c);');

    expect(ast.columns).toEqual([
      { name: 'a', sort: SortType.asc },
      { name: 'b', sort: SortType.asc },
      { name: 'c', sort: SortType.asc },
    ]);
  });

  it('unwraps quoted identifiers', () => {
    const { ast } = parse(
      'CREATE UNIQUE INDEX "idx_a" ON "public_t" ("a" DESC);'
    );

    expect(ast).toEqual({
      type: StatementType.createIndex,
      name: 'idx_a',
      unique: true,
      tableName: 'public_t',
      columns: [{ name: 'a', sort: SortType.desc }],
    });
  });

  it('unwraps MySQL backtick identifiers', () => {
    const { ast } = parse('CREATE INDEX `idx_a` ON `t` (`a`);');

    expect(ast.name).toBe('idx_a');
    expect(ast.tableName).toBe('t');
    expect(ast.columns).toEqual([{ name: 'a', sort: SortType.asc }]);
  });

  it('leaves the table empty when the ON clause is missing', () => {
    const { ast } = parse('CREATE INDEX idx_a;');

    expect(ast.name).toBe('idx_a');
    expect(ast.tableName).toBe('');
    expect(ast.columns).toEqual([]);
  });

  it('leaves the name empty when INDEX is not followed by an identifier', () => {
    const { ast } = parse('CREATE INDEX ;');

    expect(ast.name).toBe('');
    expect(ast.tableName).toBe('');
  });

  it('leaves the table empty when ON is not followed by an identifier', () => {
    const { ast } = parse('CREATE INDEX idx ON (a);');

    expect(ast.name).toBe('idx');
    expect(ast.tableName).toBe('');
    expect(ast.columns).toEqual([]);
  });

  it('records the table without columns when the column list is missing', () => {
    const { ast } = parse('CREATE INDEX idx_a ON t;');

    expect(ast.tableName).toBe('t');
    expect(ast.columns).toEqual([]);
  });

  it('records no column for an empty column list', () => {
    const { ast } = parse('CREATE INDEX idx_a ON t ();');

    expect(ast.columns).toEqual([]);
  });

  it('takes the last segment of a qualified target', () => {
    const { ast } = parse('CREATE INDEX idx_a ON public.t (a);');

    expect(ast.tableName).toBe('t');
    expect(ast.columns).toEqual([{ name: 'a', sort: SortType.asc }]);
  });

  it('leaves the name empty when the index name is omitted', () => {
    const { ast } = parse('CREATE INDEX ON t (a);');

    expect(ast.name).toBe('');
    expect(ast.tableName).toBe('t');
    expect(ast.columns).toEqual([{ name: 'a', sort: SortType.asc }]);
  });

  it('reads the unique index pg_dump writes', () => {
    const { ast } = parse(
      'CREATE UNIQUE INDEX i_1 ON public.sp_region USING btree (code, name);'
    );

    expect(ast).toEqual({
      type: StatementType.createIndex,
      name: 'i_1',
      unique: true,
      tableName: 'sp_region',
      columns: [
        { name: 'code', sort: SortType.asc },
        { name: 'name', sort: SortType.asc },
      ],
    });
  });

  it('names each key part of pg_dump by its column, past its null order, operator class and collation', () => {
    const sorted = parse(
      'CREATE UNIQUE INDEX uq_ab ON public.t USING btree (a, b DESC NULLS LAST);'
    ).ast;
    const classed = parse(
      'CREATE UNIQUE INDEX uq_ba ON public.t USING btree (b text_pattern_ops, a COLLATE "C");'
    ).ast;

    expect(sorted.columns).toEqual([
      { name: 'a', sort: SortType.asc },
      { name: 'b', sort: SortType.desc },
    ]);
    expect(classed.columns).toEqual([
      { name: 'b', sort: SortType.asc },
      { name: 'a', sort: SortType.asc },
    ]);
  });

  it.each([
    'WHERE deleted_at IS NULL',
    'WHERE (active)',
    'WHERE a IS NOT NULL AND deleted_at IS NULL',
    'WHERE a IS NOT NULL OR b IS NOT NULL',
    'WHERE c IS NOT NULL',
    'WHERE a IS NULL',
  ])('reads a partial unique index as not unique: %s', where => {
    const { ast, tokens, $pos } = parse(
      `CREATE UNIQUE INDEX uq ON public.t USING btree (a, b) ${where}; CREATE TABLE z (i INT);`
    );

    expect(ast.unique).toBe(false);
    expect(ast.name).toBe('uq');
    expect(ast.tableName).toBe('t');
    expect(ast.columns.map(column => column.name)).toEqual(['a', 'b']);
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('reads a partial unique index over one column by the same rule', () => {
    const filtered = parse(
      'CREATE UNIQUE INDEX uq_a ON t (a) WHERE a > 0;'
    ).ast;
    const nullFiltered = parse(
      'CREATE UNIQUE INDEX uq_a ON t (a) WHERE (a IS NOT NULL);'
    ).ast;

    expect(filtered).toMatchObject({ name: 'uq_a', unique: false });
    expect(filtered.columns.map(column => column.name)).toEqual(['a']);
    expect(nullFiltered.unique).toBe(true);
  });

  it.each([
    ['PostgreSQL', 'WHERE a IS NOT NULL;'],
    ['SQLite', 'WHERE "a" IS NOT NULL AND "b" IS NOT NULL;'],
    [
      'SQL Server',
      'WHERE ([a] IS NOT NULL AND ([B] IS NOT NULL)) WITH (PAD_INDEX = OFF) ON [PRIMARY]\nGO\n',
    ],
    ['a dump without terminators', 'WHERE a IS NOT NULL\nGO\n'],
  ])(
    'keeps unique a %s index whose WHERE drops only rows with a NULL key',
    (_vendor, where) => {
      const { ast, tokens, $pos } = parse(
        `CREATE UNIQUE INDEX uq ON t (a, b) ${where}CREATE TABLE z (i INT);`
      );

      expect(ast.unique).toBe(true);
      expect(tokens[$pos.value].value).toBe('CREATE');
    }
  );

  it('leaves a partial index that is not unique as it is', () => {
    const { ast } = parse('CREATE INDEX i ON t (a) WHERE a > 0;');

    expect(ast.unique).toBe(false);
    expect(ast.columns.map(column => column.name)).toEqual(['a']);
  });

  it('reads the ON ONLY of a partitioned table, and a table named only', () => {
    const partitioned = parse(
      'CREATE UNIQUE INDEX i ON ONLY public.t USING btree (a, b);'
    ).ast;
    const named = parse('CREATE INDEX i ON only (a);').ast;

    expect(partitioned.tableName).toBe('t');
    expect(partitioned.columns.map(column => column.name)).toEqual(['a', 'b']);
    expect(named.tableName).toBe('only');
    expect(named.columns.map(column => column.name)).toEqual(['a']);
  });

  it('reads CONCURRENTLY and IF NOT EXISTS as no name', () => {
    const { ast } = parse(
      'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq ON t (a, b);'
    );

    expect(ast.name).toBe('uq');
    expect(ast.tableName).toBe('t');
    expect(ast.columns.map(column => column.name)).toEqual(['a', 'b']);
  });

  it('reads the index SSMS scripts, clustering and filegroup included', () => {
    const { ast, tokens, $pos } = parse(
      'CREATE UNIQUE NONCLUSTERED INDEX [uq_ab] ON [dbo].[t] ([a] ASC, [b] DESC) ' +
        'WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF) ON [PRIMARY]\nGO\n' +
        'CREATE TABLE z (i INT);'
    );

    expect(ast).toEqual({
      type: StatementType.createIndex,
      name: 'uq_ab',
      unique: true,
      tableName: 't',
      columns: [
        { name: 'a', sort: SortType.asc },
        { name: 'b', sort: SortType.desc },
      ],
    });
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('reads the qualified index and table names Oracle writes', () => {
    const { ast } = parse(
      'CREATE UNIQUE INDEX "HR"."UQ_AB" ON "HR"."T" ("A", "B") TABLESPACE "USERS";'
    );

    expect(ast.name).toBe('UQ_AB');
    expect(ast.tableName).toBe('T');
    expect(ast.columns.map(column => column.name)).toEqual(['A', 'B']);
  });

  it('keeps the column of a key part with a prefix length', () => {
    const { ast } = parse('CREATE UNIQUE INDEX uq ON t (email(191), b);');

    expect(ast.columns.map(column => column.name)).toEqual(['email', 'b']);
  });

  it('records no column for a key with an expression part', () => {
    const cases = [
      'CREATE UNIQUE INDEX uq ON t (lower(email));',
      'CREATE UNIQUE INDEX uq ON public.t USING btree (lower((email)::text), b);',
      'CREATE UNIQUE INDEX uq ON t ((a + b), c);',
    ];

    for (const source of cases) {
      expect(parse(source).ast.columns).toEqual([]);
    }
  });

  it('reads the columns of a MySQL index whose method comes first', () => {
    const { ast } = parse('CREATE UNIQUE INDEX uq USING BTREE ON t (a, b);');

    expect(ast.name).toBe('uq');
    expect(ast.tableName).toBe('t');
    expect(ast.columns.map(column => column.name)).toEqual(['a', 'b']);
  });

  it('steps past CREATE when called where no index header stands', () => {
    const { ast, $pos } = parse('CREATE x;');

    expect(ast.name).toBe('x');
    expect($pos.value).toBe(3);
  });

  it('stops before the next statement', () => {
    const { ast, tokens, $pos } = parse(
      'CREATE INDEX idx ON t (a); CREATE TABLE z (i INT);'
    );

    expect(ast.columns).toEqual([{ name: 'a', sort: SortType.asc }]);
    expect(tokens[$pos.value].value).toBe('CREATE');
  });

  it('closes an unterminated column list', () => {
    const { ast, tokens, $pos } = parse('CREATE INDEX idx ON t (a');

    expect(ast.columns).toEqual([{ name: 'a', sort: SortType.asc }]);
    expect($pos.value).toBeGreaterThanOrEqual(tokens.length);
  });

  it('ignores a trailing comma in the column list', () => {
    const { ast } = parse('CREATE INDEX idx ON t (a, b,);');

    expect(ast.columns).toEqual([
      { name: 'a', sort: SortType.asc },
      { name: 'b', sort: SortType.asc },
    ]);
  });

  it('parses a statement that does not start at position 0', () => {
    const { ast, tokens, $pos } = parse(
      'USE mydb; CREATE UNIQUE INDEX idx ON t (a);',
      3
    );

    expect(ast.unique).toBe(true);
    expect(ast.name).toBe('idx');
    expect(ast.tableName).toBe('t');
    expect($pos.value).toBe(tokens.length);
  });
});
