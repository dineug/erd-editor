<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-02 -->

# schema-sql-parser

## Purpose

`@dineug/schema-sql-parser` (private) is a hand-written, permissive DDL parser: `schemaSQLParser(source)` tokenizes SQL of any dialect into a flat `Statement[]` of seven kinds — `create.table`, `create.index`, `alter.table.add.{primaryKey,unique,foreignKey}` and `comment.on.{table,column}`. Unrecognised input is skipped, so a real dump imports partially instead of failing; `CREATE TYPE`, `CREATE DOMAIN` and `CREATE EXTENSION` are among it. Its only consumer is `packages/erd-editor/src/utils/schema-sql-parser/`, which folds the statements into an `ERDEditorSchemaV3` document.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface — `schemaSQLParser`, `StatementType`, `SortType`, the statement types; everything else is internal |
| `src/parser/tokenizer.ts` | Lexer — `"x"`, `'x'`, `` `x` `` and `[x]` each become one `string` token, delimiters stripped, `quoted` set to the opening delimiter; a doubled `''`, `""` or ``` `` ``` inside is one character of the value, a doubled `]]` is not (a nested array literal closes on it); an unpaired `]` emits `rightBracket` |
| `src/parser/index.ts` | Dispatch loop — probes each matcher at `$pos`, runs a statement parser, else advances one token |
| `src/parser/helper.ts` | Token/value predicates, the `is*` lookahead matchers, the merged `DataTypes` set, `matchCreateTable`, `matchQualifiedName`, `matchDataType`, `matchUserDataType`, `matchNestedDataType`, `matchReferentialClause`, `isTableItemWord`, `requote`, `requoteTypeName` |
| `src/parser/statement/` | One parser per statement kind; `index.ts` holds `Statement`, `StatementType`, `SortType`, `RefPos` |
| `src/parser/dataType/` | Per-vendor type lists: MySQL, MariaDB, PostgreSQL, MSSQL, Oracle, SQLite, Databricks, Snowflake |
| `src/schema_sql_test_case.md` | End-to-end fixtures read by `index.test.ts` |

## For AI Agents

### Working In This Directory

- **Never throw on unrecognised SQL** — the loop advances `$pos` and continues; bailing turns a partial import into a failed one.
- **`$pos` (`RefPos = { value: number }`) is a shared mutable cursor.** Each parser leaves it just past what it consumed; off by one either loops forever or swallows a statement.
- Adding a statement kind is four edits: the parser file, the `Statement` union and `StatementType`, a matcher in `parser/helper.ts`, a branch in `parser/index.ts`.
- **Keywords are unquoted `string` tokens compared case-insensitively**; every `is*Value` matcher refuses a `quoted` token, so `` `key` `` is a column and `KEY` an index. `--` and `/* */` comments never become tokens.
- **A quoted `DEFAULT` goes back into quotes** (`'...'`, inner quotes doubled): `column.default` is raw SQL that every exporter writes after `DEFAULT`, and the lexer has stripped the quotes.
- **So does a quoted data type argument, in the delimiter it came in** (`requote`): `ENUM('a','b')`, `OBJECT("city" VARCHAR)`; `column.dataType` is raw SQL too. A user type's quoted name keeps its quotes (`"MyType"`, `[my type]`), a listed type's does not (`[int]` → `int`); T-SQL brackets around a regular name are dropped for both (`requoteTypeName`: `[dbo].[Phone]` → `dbo.Phone`, `[sysname]` → `sysname`). A nested type's quoted tokens keep theirs too: `STRUCT<name: STRING COMMENT 'x'>`.
- **A type no list carries is read only where the type stands**, the token right after the column name (`typePos` in `statement/create.table.ts`): `mood`, `public.mood`, `hstore`. A single-quoted literal and the words in `ColumnKeywords` (`helper.ts`) are refused there, since a typeless column (SQLite, a computed `AS`, a `CREATE TABLE AS` column list) puts its first constraint in that place; a column keyword the parser meets there goes into that list, or it becomes the type. `TAG` before `(` and `SORT` where the column ends are refused by position, since a PostgreSQL type may carry either name. Anywhere else an unknown word is an attribute (`INT UNSIGNED`).
- **A table constraint or index item yields no column**: `opensConstraintItem` in `statement/create.table.ts` names the tokens that open one; a new opener goes there. An item opened by a word a column may be named too (`LIKE s`, `EXCLUDE USING`, `FULLTEXT ft (c)`, `PERIOD FOR`, `SUPPLEMENTAL LOG`) goes into `isTableItemWord` (`helper.ts`), told apart by the words after it.
- `helper.ts` merges all eight `dataType/` lists into one deduplicated uppercase set, so a type added to one vendor widens every dialect.
- **Type names match word by word, longest first**: write multi-word names in full (`TIMESTAMP WITHOUT TIME ZONE`); `matchDataType` returns the token span, argument lists and an array suffix (`[]`, `[3]`, `ARRAY`) included. Unlisted words in front of a listed type join it in the type's place, since SQLite takes any words as a type (`UNSIGNED BIG INTEGER`); with no listed type after them, only the first is the type (`hstore COMPRESSION pglz`). Each name is mirrored with a `primitiveType` in `packages/erd-editor/src/constants/sql/dataType/`; no test pins the parity, so change both lists together.
- **The `CREATE ... TABLE` header is measured, not counted**: `matchCreateTable` returns its span over a whitelist of modifiers (`OR REPLACE`, `TRANSIENT`, …), since scanning to the next `TABLE` would claim `CREATE VIEW ... FROM TABLE(...)`. `matchQualifiedName` does the same for an `ALTER TABLE db.schema.t` target.
- **Angle-bracket generics are rebalanced in the parser**: `<` / `>` are not break characters, so `matchNestedDataType` rejoins `ARRAY` / `MAP` / `STRUCT` spans and keeps their inner commas from ending the column.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/schema-sql-parser --fail-if-no-match test` — `node` environment.
- A new end-to-end case is a `### ` section in `src/schema_sql_test_case.md` with a fenced `sql` block and a fenced `json` block; `index.test.ts` deep-equals `{ statements }`.
- `index.test.ts` also parses the root `data/sakila.sql` and pins its column, foreign key and index shape; the other `data/*.sql` dumps are manual only.

### Common Patterns

- AST nodes are fully populated with `''` and `[]` rather than optional fields.
- A qualified table name (`db.schema.t`) keeps its last segment in every statement parser except `create.index`, which takes the schema as `tableName` and records no columns — `create.index.test.ts` pins that current behaviour.

## Dependencies

### Internal

None — leaf package.

### External

No runtime dependencies.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
