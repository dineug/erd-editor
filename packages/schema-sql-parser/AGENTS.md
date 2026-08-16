<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# schema-sql-parser (`@dineug/schema-sql-parser`)

## Purpose

A permissive, hand-written DDL parser. It takes a SQL script of any dialect and produces a flat
`Statement[]` AST covering the five statement kinds the editor cares about — everything else is
skipped rather than rejected. This powers "import from SQL": paste a schema dump and get tables,
columns, keys, and indexes.

"Permissive" is the design goal. Real-world dumps contain vendor extensions, comments, and syntax this
parser does not model; it must skip past them and keep going rather than fail the whole import.

## Key Files

| File                          | Description                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                | Public surface — `schemaSQLParser`, `StatementType`, `SortType`, and the statement types                                      |
| `src/index.test.ts`           | Markdown-driven `test.each` over `schema_sql_test_case.md`, plus entry-surface assertions                                     |
| `src/schema_sql_test_case.md` | 20 curated real-world DDL snippets, each paired with its expected `{ statements }` JSON                                       |
| `src/parser/tokenizer.ts`     | Lexer producing `Token[]`; `TokenType` is `string` plus eight punctuation kinds — quoted/bracketed spans collapse to `string` |
| `src/parser/index.ts`         | Top-level loop: probes each statement matcher at the current `$pos` and dispatches                                            |
| `src/parser/helper.ts`        | Token/value predicates plus the `isCreateTable` / `isCreateIndex` / `isAlterTableAdd*` lookahead matchers and `isDataType`    |
| `src/internal-types/index.ts` | `ValuesType`                                                                                                                  |
| `vitest.config.ts`            | Test config `vp test` reads — node env, `src/**/*.test.ts`, v8 coverage with per-file 80% thresholds                          |
| `vite.config.ts`              | Library build **and** the package's `run.tasks` — ES-only lib entry, `BROWSER_TARGET`, `vite-plugin-dts`                      |
| `tsconfig.json`               | The `tsc --noEmit` gate's program — `include: ["src"]`, so the 16 spec files are typechecked too                              |
| `tsconfig.build.json`         | The dts pass's tsconfig; excludes `src/**/*.test.ts` so tests never reach `dist/`                                             |
| `README.md`                   | The per-vendor data-type support matrix, mirroring `src/parser/dataType/`                                                     |

## Subdirectories

| Directory               | Purpose                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/parser/statement/` | One parser per statement kind — `create.table`, `create.index`, `alter.table.add.primaryKey`, `alter.table.add.unique`, `alter.table.add.foreignKey` — plus `index.ts` holding the `Statement` union, `StatementType`, `SortType`, and `RefPos` |
| `src/parser/dataType/`  | Per-vendor data-type keyword lists: `MySQL`, `MariaDB`, `PostgreSQL`, `MSSQL`, `Oracle`, `SQLite`                                                                                                                                               |

Every non-test `src/**/*.ts` has a sibling `*.test.ts` in the same directory except
`src/internal-types/index.ts` (16 test files against 17 sources) — that one exception is
institutionalised in `vitest.config.ts` as `coverage.exclude: ['src/internal-types/**']`.

## For AI Agents

### Working In This Directory

- **Never throw on unrecognized SQL.** The top-level loop advances `$pos` and continues; a parser that
  bails out turns a partial import into a failed one.
- **`$pos` is a shared mutable cursor** (`RefPos = { value: number }`) threaded through every statement
  parser. Each parser must leave `$pos` immediately after the statement it consumed — off-by-one here
  causes infinite loops or silently swallowed statements.
- Adding a statement kind means four edits: the parser file, the `Statement` union and `StatementType`
  in `statement/index.ts`, a matcher in `parser/helper.ts`, and a branch in `parser/index.ts` — plus
  the sibling `*.test.ts` for each, or `test:coverage` fails on its per-file threshold.
- Matchers are hoisted out of the loop in `parser/index.ts` (`const createTable = isCreateTable(tokens)`)
  because they are curried over `tokens`; a new matcher follows the same shape.
- Data-type lists are per vendor but the parser is dialect-agnostic at parse time: `helper.ts` merges
  all six lists into one deduped uppercase `DataTypes` set that `isDataType` tests against. Vendor
  files are for classification and documentation, never for rejecting input — adding a type to one
  vendor widens the parser for every dialect.
- The package's two tasks live in `vite.config.ts` under `run.tasks`, and each is an array that runs
  `tsc --noEmit` before the real command (`vp build`, `vp test run`). ⚠️ Their `input` globs are
  spelled out by hand because TypeScript 7's `tsc` is a Go binary, invisible to Vite Task's automatic
  file tracing — widen `tsconfig.json`'s `include` without widening `input` and the typecheck keeps
  replaying a cache hit over files it never read. Nothing goes red.
- ⚠️ `output: ['dist/**']` on the `build` task is load-bearing. Drop it and a cache hit replays the
  terminal output without restoring `dist/`, which reads as a fast green build that produced nothing.
- This is a leaf package, so the `dependsOn` block (`build`, `from` all three dependency fields)
  resolves to an empty set and the `input` list carries no `packages/<dep>/dist/**/*.d.ts` line.
  `scripts/check-task-inputs.mjs` — part of `pnpm check` — enforces that correspondence in both
  directions, so adding a workspace dependency here means adding its `.d.ts` glob in the same commit.
- `build.target` is the shared `BROWSER_TARGET` imported from the root `build-target.ts`
  (chrome87 / edge88 / firefox78 / safari14.1). Every published library here imports the same value;
  don't declare a local floor.
- `private: true`.

### Testing Requirements

- **`pnpm exec vp run --filter @dineug/schema-sql-parser --fail-if-no-match test`** — 16 files /
  416 tests. `test:dev` (`vp test dev`) watches; `test:coverage` (`vp test run --coverage`) adds the
  thresholds below. It is one of eight packages `pnpm test` (`vp run -r test`) exercises — keep it
  green.
- ⚠️ `pnpm --filter @dineug/schema-sql-parser test` and its `build` twin no longer exist. `build` and
  `test` are `run.tasks` task names now, and a `package.json` script of the same name makes the task
  graph fail to load — so this package declares neither. Flags go **before** the task name, and
  without `--fail-if-no-match` a filter that matches nothing exits 0 instead of failing.
- ⚠️ `test:coverage` and `test:dev` call the built-in `vp test`, which does not read `run.tasks` —
  they skip the `tsc --noEmit` gate that `vp run test` puts in front of the suite.
- Specs import `describe` / `it` / `expect` from **`vite-plus/test`**, not from `vitest`; all 16 files
  do. `vitest` is still the runner and `@vitest/coverage-v8` still the provider, but nothing in `src/`
  names either.
- Coverage is a gate: `vitest.config.ts` sets v8 coverage with `perFile: true` and 80% on
  lines/functions/branches/statements over `src/**/*.ts`, excluding only `*.test.ts`, `*.d.ts` and
  `src/internal-types/**`.
- What the suite covers: `tokenizer.test.ts` (every token kind, the four quoting styles, whitespace
  and break-character splitting), `helper.test.ts` (the
  largest file — every token/value predicate and every `is*` lookahead matcher, including the
  PostgreSQL `ALTER TABLE ONLY` and MSSQL bracket variants), one file per statement parser
  (`create.table.test.ts` splits into table name / column options / table-level constraints /
  truncated input), one file per vendor data-type list (each asserts the list verbatim and its sort
  order), `parser/index.test.ts` for the dispatch loop and skip-and-continue behaviour, and
  `index.test.ts` for the public entry surface.
- **`src/schema_sql_test_case.md` is the end-to-end fixture.** `index.test.ts` reads it with
  `fs.readFileSync`, splits on `### ` headings, and pulls the fenced `sql` block and the fenced
  `json` block that follows it out of each section into a `test.each` case. Adding a real-world
  snippet means adding a section there, not a new spec file — and the JSON block must be the exact
  `{ statements }` output, since the test asserts deep equality against it.
- The repo-root `data/` dumps (`sakila.sql`, `GNUBOARD5.sql`, `Magento2-sales.sql`, `OKKY.sql`,
  `YOUNGCART5.sql`) are **not** referenced by any test — they are the manual end-to-end loop: import a
  dump through the editor's SQL import and confirm the resulting tables/relationships. They are also
  the source to mine when writing a new `schema_sql_test_case.md` section.
- A change is not verified until `pnpm build` (`vp run -r build`) passes — the `build` task runs
  `tsc --noEmit` ahead of `vp build`, and that gate reads `tsconfig.json` (`include: ["src"]`), so the
  16 spec files are typechecked along with the sources. They were not while the gate was
  `@rollup/plugin-typescript` over `tsconfig.build.json`: a type error inside a spec used to stay
  invisible until someone opened the file.

### Common Patterns

- Tokenize once, then parse by lookahead — no backtracking.
- **There is no keyword token and no comment token.** Keywords are plain `string` tokens matched by
  value (`createValueEqual('CREATE')`, case-insensitive), and the tokenizer has no `--` / `/* */`
  handling at all — SQL comments arrive as ordinary tokens that the statement matchers must fail to
  match and the top-level loop then skips. `"x"`, `'x'`, `` `x` `` and MSSQL's `[x]` all collapse to a
  single `string` token with the delimiters stripped.
- Matchers are curried: `isCreateTable(tokens)` returns a `(pos) => boolean` predicate.
- `StatementType` and `SortType` are `as const` objects paired with a same-named type via `ValuesType`.
- Statement objects are fully populated — empty strings and empty arrays rather than optional fields —
  so consumers never branch on `undefined`.

## Dependencies

### Internal

None — leaf package.

### External

Build/test only: `vite` — the pnpm catalog aliases that name to `@voidzero-dev/vite-plus-core` 0.2.9,
so there is no `vite` binary in `node_modules/.bin` and every command here goes through `vp` — plus
`vite-plus` 0.2.9, `vite-plugin-dts` 5, `@typescript/typescript6` 6.0.2 (`vite-plugin-dts` still calls
the JS Compiler API that TypeScript 7 removed), `vitest` 4.1.10 and `@vitest/coverage-v8` 4.1.10 under
`vite-plus/test`, `typescript` 7.0.2 (pinned repo-wide by `pnpm-workspace.yaml` `overrides`),
`@types/node`, `tslib`. No runtime dependencies.

### Consumers

`@dineug/erd-editor` — `src/utils/schema-sql-parser/` maps the AST onto editor actions.

<!-- MANUAL: -->
