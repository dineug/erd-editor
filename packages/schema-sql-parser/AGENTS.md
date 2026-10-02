<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# schema-sql-parser

## Purpose

`@dineug/schema-sql-parser` (private) is a hand-written, permissive DDL parser: `schemaSQLParser(source)` tokenizes SQL of any dialect into a flat `Statement[]` of seven kinds — `create.table`, `create.index`, `alter.table.add.{primaryKey,unique,foreignKey}` and `comment.on.{table,column}`. Unrecognised input is skipped, so a real dump imports partially instead of failing. Its only consumer is `packages/erd-editor/src/utils/schema-sql-parser/`, which folds the statements into an `ERDEditorSchemaV3` document.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface — `schemaSQLParser`, `StatementType`, `SortType`, the statement types; everything else is internal |
| `src/parser/tokenizer.ts` | Lexer — `"x"`, `'x'`, `` `x` `` and `[x]` each become one `string` token, delimiters stripped, marked `quoted`; an unpaired `]` emits `rightBracket` |
| `src/parser/index.ts` | Dispatch loop — probes each matcher at `$pos`, runs a statement parser, else advances one token |
| `src/parser/helper.ts` | Token/value predicates, the `is*` lookahead matchers, the merged `DataTypes` set, `matchCreateTable`, `matchCreateIndex`, `matchQualifiedName`, `matchDataType`, `matchNestedDataType`, `matchReferentialClause`, `matchKeyModifier` (and `matchKeyModifiers`, a run of them), `matchUsingIndexName`, `isNullFilter` |
| `src/parser/statement/` | One parser per statement kind; `index.ts` holds `Statement`, `StatementType`, `SortType`, `RefPos`; `index.columns.ts` reads a key list for `create.table` (its primary and unique keys and its indexes), `create.index`, `alter.table.add.unique` and `alter.table.add.primaryKey`: a key part's first word names its column, the rest is its sort or words that name none (`COLLATE "C"`, an operator class, `NULLS LAST`); a numeric prefix length is skipped and not kept, and any other group is an expression that leaves the key no column; a list still open at a `;` leaves the key none either, and `$pos` on the `;` |
| `src/parser/dataType/` | Per-vendor type lists: MySQL, MariaDB, PostgreSQL, MSSQL, Oracle, SQLite, Databricks, Snowflake |
| `src/schema_sql_test_case.md` | End-to-end fixtures read by `index.test.ts` |

## For AI Agents

### Working In This Directory

- **Never throw on unrecognised SQL** — the loop advances `$pos` and continues; bailing turns a partial import into a failed one.
- **`$pos` (`RefPos = { value: number }`) is a shared mutable cursor.** Each parser leaves it just past what it consumed; off by one either loops forever or swallows a statement.
- Adding a statement kind is four edits: the parser file, the `Statement` union and `StatementType`, a matcher in `parser/helper.ts`, a branch in `parser/index.ts`.
- **One `ALTER TABLE name ADD` is dispatched once, whatever it adds** (`isAlterTableAdd`): the primary key or foreign key parser reads the statement when its first clause is one, then `alterTableAddUniqueParser` reads the same tokens again and returns one `alter.table.add.unique` per UNIQUE clause, so phpMyAdmin's `ADD PRIMARY KEY (...), ADD UNIQUE KEY ...` keeps every key. A CONSTRAINT symbol names only the clause it opens: a comma or ADD drops it. A UNIQUE after a word no branch claims belongs to the column the clause adds (`ADD [COLUMN] c INT UNIQUE CHECK (...)`) and keys nothing. A foreign key after the first clause is still dropped, and so is `ADD KEY` / `ADD INDEX`. A group the parser skips (a CHECK, a foreign key's lists) also ends at a `;`, and so does a key list `indexColumnsParser` reads, the ALTER's or `CREATE INDEX`'s, which then keys nothing: one the source leaves open never swallows the statements after it. A `CREATE TABLE` whose parentheses do not balance still runs to the end of the source.
- **Keywords are unquoted `string` tokens compared case-insensitively**; every `is*Value` matcher refuses a `quoted` token, so `` `key` `` is a column and `KEY` an index. `--` and `/* */` comments never become tokens.
- **A quoted `DEFAULT` goes back into quotes** (`'...'`, inner quotes doubled): `column.default` is raw SQL that every exporter writes after `DEFAULT`, and the lexer has stripped the quotes.
- **A table constraint or index item yields no column**: `opensConstraintItem` in `statement/create.table.ts` names the tokens that open one; a new opener goes there.
- **A UNIQUE over several columns is one unique index** in every spelling (`UNIQUE (a, b)`, `UNIQUE KEY` / `INDEX n`, SQL Server's inline `INDEX n UNIQUE`, `CONSTRAINT [n] UNIQUE`, `ALTER TABLE ... ADD [CONSTRAINT [n]] UNIQUE [KEY] [IF NOT EXISTS] [n]`, `CREATE UNIQUE INDEX`), named by its index name, else its CONSTRAINT symbol, else `''`; a flag on each column would be a stricter key. SQL Server's inline `INDEX n UNIQUE (...) [INCLUDE (...)] WHERE ...` reads its filter by the rule `CREATE UNIQUE INDEX ... WHERE` follows (below): unless the filter only drops NULL keys, the key is a plain index that keeps its name and columns, over one column too. One column sets the column's `unique` whatever its name, which is how the editor's own `UQ_<table>_<column>` comes back as the flag it was. `alter.table.add.unique` only reports the key; the editor's importer applies that rule to it. `matchKeyModifier` keeps `NULLS NOT DISTINCT`, `NONCLUSTERED` and `USING BTREE` from being read as the name. A column's own UNIQUE reads no name and no key list, since Oracle follows it with `USING INDEX (...)`. An ALTER's unique or primary key reports the index Oracle's `USING INDEX [schema.]index` names as `usingIndexName` (`matchUsingIndexName` refuses the index properties and constraint states that may stand there instead), and the primary key its CONSTRAINT symbol too. The importer reads the table's index of that name, else of the key's own name (SQL Developer exports `CREATE UNIQUE INDEX "UQ"` before `ADD CONSTRAINT "UQ" UNIQUE`), over the same columns as part of the key: a composite unique key is that index made unique, a one-column key and a primary key take it into their flags, since Oracle refuses to index one column list twice. A key with neither name (Oracle's system-named `ADD PRIMARY KEY` / `ADD UNIQUE`, whose index SQL Developer exports as `SYS_C...`) takes over, the same way, the index of the table, inline or from a `CREATE INDEX`, that covers its columns in the same order, unique or not and whatever its name, none included: Oracle enforces a primary or unique key through an index over its columns, a non-unique one too, rather than build another, so `CREATE INDEX ix_id ON t (id); ALTER TABLE t ADD PRIMARY KEY (id);` imports as the primary key flag on `id` and no index, and a second index a MySQL or PostgreSQL script keeps over those columns is taken over as well. Where the `CREATE INDEX` stands plays no part: the importer merges every `CREATE INDEX` before any ALTER key, so `ALTER TABLE t ADD PRIMARY KEY (id); CREATE INDEX ix_id ON t (id);` imports the same, since DBMS_METADATA's `CONSTRAINTS_AS_ALTER` output, followed by the table's dependent index DDL, writes each ALTER before the `SYS_C...` index of its key. An index over the key's columns in another column order stays one of its own. `create.table` reports in `keys` each primary key and one-column unique key the source names (by CONSTRAINT, or a one-column `UNIQUE KEY n` / `INDEX n UNIQUE`), and every key with no name that Oracle's `USING INDEX` follows, a composite unique key too, which stays in `indexes` as well; a key with no name that PostgreSQL's `USING INDEX TABLESPACE ts` follows is not reported, since DBMS_METADATA never writes `TABLESPACE` right after `USING INDEX` and Oracle refuses a second index over a key's columns (ORA-01408): a `CREATE INDEX` over the columns of that key is an index of its own; a column's CONSTRAINT names a key only when the key follows it at once. The importer reads a later `CREATE [UNIQUE] INDEX`, such as the one DBMS_METADATA writes for each key a table declares inline, as a key or index the table already has in two cases only: it carries the name of a key or of an index of the table over the same columns, in any order; or it covers, in their order, the columns of a key with no name that `keys` reports, one Oracle's `USING INDEX` followed (`PRIMARY KEY ("ID") USING INDEX ...` or `UNIQUE ("A", "B") USING INDEX ...`, then `CREATE UNIQUE INDEX "HR"."SYS_C..."`). Read so, it adds no index: an index takes its name when it had none, and its UNIQUE. It never folds into any other index with no name, an earlier `CREATE INDEX` without one or an inline `UNIQUE` without `USING INDEX`: `UNIQUE (a, b)` then `CREATE INDEX ix_ab ON t (a, b)` keeps both, and so do `CREATE INDEX ON t (a, b)` then `CREATE UNIQUE INDEX uq ON t (a, b)`. The editor's own exports write no `USING INDEX`, so an index over the columns of an unnamed key they write comes back as the index it was.
- **`CREATE [UNIQUE] [NONCLUSTERED] INDEX` reads what dump tools write**: `matchCreateIndex` measures the header through INDEX, `CONCURRENTLY` / `IF NOT EXISTS` and a missing name are skipped, the index and table names keep their last segment (pg_dump's `ON [ONLY] public.t`, Oracle's `"HR"."T"`), `USING btree` before the key list is skipped, and only the first ON names the table, never SSMS's `ON [PRIMARY]` filegroup. A `WHERE` makes a unique index a plain one that keeps its name and columns, since a partial key unconditioned is a stricter one, unless `isNullFilter` reads it as `key IS NOT NULL` over key columns, AND-joined, in parentheses that pair up: those rows are the ones the SQL standard's UNIQUE already lets repeat, SQL Server's usual filter for a unique nullable column.
- `helper.ts` merges all eight `dataType/` lists into one deduplicated uppercase set, so a type added to one vendor widens every dialect.
- **Type names match word by word, longest first**: write multi-word names in full (`TIMESTAMP WITHOUT TIME ZONE`); `matchDataType` returns the token span, argument lists included. Each name is mirrored with a `primitiveType` in `packages/erd-editor/src/constants/sql/dataType/`; no test pins the parity, so change both lists together.
- **The `CREATE ... TABLE` header is measured, not counted**: `matchCreateTable` returns its span over a whitelist of modifiers (`OR REPLACE`, `TRANSIENT`, …), since scanning to the next `TABLE` would claim `CREATE VIEW ... FROM TABLE(...)`. `matchQualifiedName` does the same for an `ALTER TABLE db.schema.t` target.
- **Angle-bracket generics are rebalanced in the parser**: `<` / `>` are not break characters, so `matchNestedDataType` rejoins `ARRAY` / `MAP` / `STRUCT` spans and keeps their inner commas from ending the column.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/schema-sql-parser --fail-if-no-match test` — `node` environment.
- A new end-to-end case is a `### ` section in `src/schema_sql_test_case.md` with a fenced `sql` block and a fenced `json` block; `index.test.ts` deep-equals `{ statements }`.
- `index.test.ts` also parses the root `data/sakila.sql` and pins its column, foreign key and index shape; the other `data/*.sql` dumps are manual only.

### Common Patterns

- AST nodes are fully populated with `''` and `[]` rather than optional fields.
- A qualified table name (`db.schema.t`) keeps its last segment in every statement parser.

## Dependencies

### Internal

None — leaf package.

### External

No runtime dependencies.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
