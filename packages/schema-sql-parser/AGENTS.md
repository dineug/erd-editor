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
| `src/parser/helper.ts` | Token/value predicates, the `is*` lookahead matchers, the merged `DataTypes` set, `matchCreateTable`, `matchQualifiedName`, `matchDataType`, `matchNestedDataType`, `matchReferentialClause` |
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
- **A table constraint or index item yields no column**: `opensConstraintItem` in `statement/create.table.ts` names the tokens that open one; a new opener goes there.
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
- A qualified table name (`db.schema.t`) keeps its last segment in every statement parser except `create.index`, which takes the schema as `tableName` and records no columns — `create.index.test.ts` pins that current behaviour.

## Dependencies

### Internal

None — leaf package.

### External

No runtime dependencies.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
