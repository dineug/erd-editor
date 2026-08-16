<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# schema-sql-parser

## Purpose

`@dineug/schema-sql-parser` is a hand-written, permissive DDL parser: `schemaSQLParser(source)` tokenizes SQL of
any dialect and returns a flat `Statement[]` of five kinds — `create.table`, `create.index`, and
`alter.table.add.{primaryKey,unique,foreignKey}`. Unrecognised input is skipped rather than rejected, so a real dump
imports partially instead of failing. Its only consumer is `@dineug/erd-editor`, whose
`src/utils/schema-sql-parser/` folds the AST into an `ERDEditorSchemaV3` document, not into editor actions.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface — `schemaSQLParser`, `StatementType`, `SortType`, statement types |
| `src/parser/index.ts` | Dispatch loop — probes each matcher at `$pos`, calls a statement parser, else advances |
| `src/parser/helper.ts` | Curried token/value predicates, the `is*` lookahead matchers, the merged `DataTypes` set |
| `src/parser/statement/index.ts` | `Statement` union, `StatementType`, `SortType`, `RefPos`, AST node shapes |
| `src/schema_sql_test_case.md` | 20 end-to-end fixture sections (`### ` heading + fenced `sql` + fenced `json`) |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/parser/` | `tokenizer.ts` (lexer — emits `string` plus six punctuation kinds; `TokenType`'s `leftBracket` / `rightBracket` are declared but never produced, so their predicates never fire), matchers, dispatch loop |
| `src/parser/statement/` | One parser file per statement kind, plus the AST type module |
| `src/parser/dataType/` | Per-vendor keyword lists: MySQL, MariaDB, PostgreSQL, MSSQL, Oracle, SQLite |

## For AI Agents

### Working In This Directory

- **Never throw on unrecognized SQL** — the loop advances `$pos` and continues; bailing turns a partial import into a failed one.
- **`$pos` (`RefPos = { value: number }`) is a shared mutable cursor.** Each parser must leave it just past what it
  consumed — off-by-one either loops forever or swallows a statement.
- Adding a statement kind is four edits: the parser file, the `Statement` union and `StatementType`, a matcher in
  `parser/helper.ts`, a branch in `parser/index.ts`.
- `helper.ts` merges all six `dataType/` lists into one deduped uppercase set, so adding a type to one vendor widens every dialect.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/schema-sql-parser --fail-if-no-match test` — `tsc --noEmit` then `vp test run`.
  That gate reads `tsconfig.json` (`include: ["src"]`), so specs typecheck too.
- `pnpm --filter @dineug/schema-sql-parser test:coverage` enforces `vitest.config.ts`'s per-file 80% thresholds (node env, `src/**/*.test.ts`, `src/internal-types/**` excluded); `test:dev` watches.
- Specs import `describe` / `it` / `expect` / `test` from `vite-plus/test`, never from `vitest`.
- New end-to-end cases are `### ` sections in `src/schema_sql_test_case.md` — `index.test.ts` pairs each section's
  `sql` block with its `json` block and deep-equals `{ statements }`. The root `data/*.sql` dumps are manual only.

### Common Patterns

- Tokenize once, then parse by lookahead — no backtracking.
- No keyword or comment token exists: keywords are `string` tokens compared case-insensitively by value, and `"x"`, `'x'`, `` `x` `` and `[x]` all collapse to one `string` token with delimiters stripped.
- Matchers are curried over `tokens` (`isCreateTable(tokens)` → `(pos) => boolean`) and hoisted out of the loop.
- AST nodes are fully populated with `''` and `[]` rather than optional fields.

## Dependencies

### Internal

None — leaf package.

### External

No runtime dependencies. Build-only: `vite-plugin-dts` 5 with `@typescript/typescript6` 6.0.2 for declaration emit,
and `BROWSER_TARGET` from the root `build-target.ts`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
