<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# schema-sql-parser (`@dineug/schema-sql-parser`)

## Purpose

A permissive, hand-written DDL parser. It takes a SQL script of any dialect and produces a flat
`Statement[]` AST covering the five statement kinds the editor cares about — everything else is
skipped rather than rejected. This powers "import from SQL": paste a schema dump and get tables,
columns, keys, and indexes.

"Permissive" is the design goal. Real-world dumps contain vendor extensions, comments, and syntax this
parser does not model; it must skip past them and keep going rather than fail the whole import.

**This is the only package in the workspace with a real test suite.**

## Key Files

| File                          | Description                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `src/index.ts`                | Public surface — `schemaSQLParser`, `StatementType`, `SortType`, and the statement types |
| `src/index.spec.ts`           | The workspace's only Vitest suite                                                        |
| `src/schema_sql_test_case.md` | Curated real-world DDL snippets that document expected parse behaviour                   |
| `src/parser/tokenizer.ts`     | Lexer producing `Token[]` (strings, keywords, punctuation, comments)                     |
| `src/parser/index.ts`         | Top-level loop: probes each statement matcher at the current `$pos` and dispatches       |
| `src/parser/helper.ts`        | `isCreateTable` / `isCreateIndex` / `isAlterTableAdd*` lookahead matchers                |
| `src/internal-types/index.ts` | `ValuesType` and other internal type helpers                                             |

## Subdirectories

| Directory               | Purpose                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/parser/statement/` | One parser per statement kind — `create.table`, `create.index`, `alter.table.add.primaryKey`, `alter.table.add.unique`, `alter.table.add.foreignKey` — plus `index.ts` holding the `Statement` union, `StatementType`, `SortType`, and `RefPos` |
| `src/parser/dataType/`  | Per-vendor data-type keyword lists: `MySQL`, `MariaDB`, `PostgreSQL`, `MSSQL`, `Oracle`, `SQLite`                                                                                                                                               |

## For AI Agents

### Working In This Directory

- **Never throw on unrecognized SQL.** The top-level loop advances `$pos` and continues; a parser that
  bails out turns a partial import into a failed one.
- **`$pos` is a shared mutable cursor** (`RefPos = { value: number }`) threaded through every statement
  parser. Each parser must leave `$pos` immediately after the statement it consumed — off-by-one here
  causes infinite loops or silently swallowed statements.
- Adding a statement kind means four edits: the parser file, the `Statement` union and `StatementType`
  in `statement/index.ts`, a matcher in `parser/helper.ts`, and a branch in `parser/index.ts`.
- Data-type lists are per vendor but the parser is dialect-agnostic at parse time — vendor lists are
  used for classification, not for rejecting input.
- `private: true`.

### Testing Requirements

- **`pnpm --filter @dineug/schema-sql-parser test`** (Vitest, `vitest run`); `test:dev` for watch mode.
  This is the only package `pnpm test` actually exercises — keep it green.
- Add a case to `src/index.spec.ts` for every parser change. `src/schema_sql_test_case.md` is the
  source of real-world snippets; pull new fixtures from there or from the dumps in the repo root
  `data/` directory (`sakila.sql`, `GNUBOARD5.sql`, `Magento2-sales.sql`, `OKKY.sql`, `YOUNGCART5.sql`).
- End-to-end check: import a `data/*.sql` dump through the editor's SQL import and confirm the
  resulting tables/relationships.

### Common Patterns

- Tokenize once, then parse by lookahead — no backtracking.
- Matchers are curried: `isCreateTable(tokens)` returns a `(pos) => boolean` predicate.
- `StatementType` and `SortType` are `as const` objects paired with a same-named type via `ValuesType`.

## Dependencies

### Internal

None — leaf package.

### External

Build/test only: `vite`, `vite-plugin-dts`, `@rollup/plugin-typescript`, `vitest`, `@types/node`, `tslib`.

### Consumers

`@dineug/erd-editor` — `src/utils/schema-sql-parser/` maps the AST onto editor actions.

<!-- MANUAL: -->
