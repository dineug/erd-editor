<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# schema-sql-parser

## Purpose

`@dineug/schema-sql-parser` is a hand-written, permissive DDL parser: `schemaSQLParser(source)` tokenizes SQL of
any dialect and returns a flat `Statement[]` of seven kinds — `create.table`, `create.index`,
`alter.table.add.{primaryKey,unique,foreignKey}` and `comment.on.{table,column}`. Unrecognised input is skipped
rather than rejected, so a real dump imports partially instead of failing. Its only consumer is `@dineug/erd-editor`, whose
`src/utils/schema-sql-parser/` folds the AST into an `ERDEditorSchemaV3` document, not into editor actions.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface — `schemaSQLParser`, `StatementType`, `SortType`, statement types |
| `src/parser/index.ts` | Dispatch loop — probes each matcher at `$pos`, calls a statement parser, else advances |
| `src/parser/helper.ts` | Curried token/value predicates, the `is*` lookahead matchers, the merged `DataTypes` set, `matchCreateTable`, `matchQualifiedName`, `matchDataType` and `matchNestedDataType` |
| `src/parser/statement/index.ts` | `Statement` union, `StatementType`, `SortType`, `RefPos`, AST node shapes |
| `src/schema_sql_test_case.md` | 27 end-to-end fixture sections (`### ` heading + fenced `sql` + fenced `json`) |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/parser/` | `tokenizer.ts` (lexer — emits `string` plus six punctuation kinds; `TokenType`'s `leftBracket` is declared but never produced — `[x]` collapses into one quoted `string` — while an unpaired `]` emits `rightBracket`, which nothing consumes), matchers, dispatch loop |
| `src/parser/statement/` | One parser file per statement kind, plus the AST type module |
| `src/parser/dataType/` | Per-vendor keyword lists: MySQL, MariaDB, PostgreSQL, MSSQL, Oracle, SQLite, Databricks, Snowflake |

## For AI Agents

### Working In This Directory

- **Never throw on unrecognized SQL** — the loop advances `$pos` and continues; bailing turns a partial import into a failed one.
- **`$pos` (`RefPos = { value: number }`) is a shared mutable cursor.** Each parser must leave it just past what it
  consumed — off-by-one either loops forever or swallows a statement.
- Adding a statement kind is four edits: the parser file, the `Statement` union and `StatementType`, a matcher in `parser/helper.ts`, a branch in `parser/index.ts`.
- `helper.ts` merges all eight `dataType/` lists into one deduped uppercase set, so adding a type to one vendor widens every dialect.
- **A type name is matched word by word, longest first**, so multi-word names are written in full (`TIMESTAMP WITHOUT TIME ZONE`, not `TIMESTAMP WITHOUT`) and `matchDataType` returns the token span — argument lists included, wherever they sit (`TIMESTAMP(3) WITH TIME ZONE`). Each name is mirrored in `erd-editor/src/constants/sql/dataType/` with a `primitiveType`; the two lists hold the same names and change together.
- **The `CREATE ... TABLE` header is measured, not counted.** `matchCreateTable` returns its token span, because `OR REPLACE` and a table kind (`TRANSIENT`, `HYBRID`, …) sit between the two words; the statement parser adds that span to reach the name. The modifier list is a whitelist — scanning to the next `TABLE` would also claim `CREATE OR REPLACE VIEW v AS SELECT ... FROM TABLE(...)`. `matchQualifiedName` does the same job for an `ALTER TABLE db.schema.t ADD` target.
- **Angle-bracket generics are recovered in the parser, not the lexer**: `<` / `>` are not break characters, so `MAP<STRING, INT>` arrives as `MAP<STRING`, `,`, `INT>` and `matchNestedDataType` rebalances the span for `ARRAY` / `MAP` / `STRUCT`, keeping that comma from reading as a column separator.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/schema-sql-parser --fail-if-no-match test` — `tsc --noEmit` then `vp test run`.
  That gate reads `tsconfig.json` (`include: ["src"]`), so specs typecheck too.
- `pnpm --filter @dineug/schema-sql-parser test:coverage` enforces `vitest.config.ts`'s per-file 80% thresholds (node env, `src/**/*.test.ts`, `src/internal-types/**` excluded); `test:dev` watches.
- Specs import `describe` / `it` / `expect` / `test` from `vite-plus/test`, never from `vitest`.
- New end-to-end cases are `### ` sections in `src/schema_sql_test_case.md` — `index.test.ts` pairs each section's
  `sql` block with its `json` block and deep-equals `{ statements }`. The root `data/*.sql` dumps are manual only.

### Common Patterns

- Tokenize once, then parse by lookahead — no backtracking.
- No keyword token exists, and `--` / `/* */` comments are dropped by the lexer rather than emitted: keywords are `string` tokens compared case-insensitively by value, and `"x"`, `'x'`, `` `x` `` and `[x]` all collapse to one `string` token with delimiters stripped — but marked `quoted`, which every `is*Value` matcher refuses, so `` `key` `` is a column and `KEY` is an index.
- Matchers are curried over `tokens` (`isCreateTable(tokens)` → `(pos) => boolean`) and hoisted out of the loop.
- AST nodes are fully populated with `''` and `[]` rather than optional fields.

## Dependencies

### Internal

None — leaf package.

### External

No runtime dependencies. Build-only: `vite-plugin-dts` 5 with `@typescript/typescript6` 6.0.2 for declaration emit,
and `BROWSER_TARGET` from the root `build-target.ts`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
