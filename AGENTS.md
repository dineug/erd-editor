<!-- Generated: 2026-08-27 | Updated: 2026-09-01 -->

# erd-editor

## Purpose

`@dineug/erd-editor-monorepo` is a pnpm + Vite+ workspace building an Entity-Relationship Diagram editor, shipped through four surfaces: the web app at erd-editor.io, a VSCode extension, an IntelliJ plugin, and the standalone `<erd-editor>` custom element on npm. The editor core is framework-free, built on the in-house `@dineug/r-html` framework — authored in JSX, compiled back to that framework's tagged templates at build time. Its state lives in a Redux-like store whose actions carry a Lamport-style clock and merge through an LWW register set, which is what lets collaboration, cross-tab sync and undo/redo share one mechanism.

## Key Files

| File | Description |
| --- | --- |
| `vite.config.ts` | The repo's only `lint` / `fmt` / `staged` block — no package config declares one, and there is deliberately no `.oxlintrc.json` / `.oxfmtrc.json`; the `oxc.oxc-vscode` LSP shims read this file too |
| `package.json` | Root scripts (`build`, `test`, `check`, `format`, `lint`, `size`, `cache:clear`); pins pnpm 10.34.3 via `packageManager` |
| `pnpm-workspace.yaml` | `packages/*`, the catalog aliasing `vite` → `@voidzero-dev/vite-plus-core@0.2.9`, and the `typescript: 7.0.2` override |
| `tsconfig.app.json` | Base config every package extends — ES2022 `target` and `lib`, strict, bundler resolution |
| `tsconfig.json` | Typechecks the root tooling plus every `vite.config.*` / `vitest.config.*`, which sit in no package program |
| `build-target.ts` | `BROWSER_TARGET` / `BROWSER_TARGET_QUERY` — the one browser floor, consumed by the library config factory, the two bespoke library configs and `app` |
| `tools/eslint-rules/index.js` | The `local` oxlint plugin — the four comment rules `vite.config.ts` enables; the directory is itself lint-exempt |
| `tools/vite/library-config.ts` | Typed factory for the seven standard library builds and shared task builder used by all nine library-mode packages |
| `tools/vite/package-metadata.ts` | Derives task inputs, banners and runtime externals from JSONC tsconfig files and workspace manifests |
| `scripts/check-task-inputs.mjs` | Independently verifies exact task/cache contracts and workspace declaration inputs during `pnpm check` |
| `scripts/check-bundle-size.mjs` | The `pnpm size` gate — gzips `packages/erd-editor/dist/erd-editor.js` at level 9 and checks it against `packages/erd-editor/.size-baseline.json`. It reads a build artifact, so it runs after `pnpm build` in CI and never inside `pnpm check` |
| `erd-editor.code-workspace` | Multi-root workspace; sets `oxc.oxc-vscode` as the formatter per language so the editor matches `vp fmt` |
| `CLAUDE.md` | Two-line alias to this file; `AGENTS.md` is the canonical repository guidance |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `packages/` | The 14 workspace packages; each carries its own `AGENTS.md` |
| `data/` | Importer fixtures, all for hand-testing: SQL dumps (`sakila`, `OKKY`, `GNUBOARD5`, `YOUNGCART5`, `Magento2-sales`), GraphQL SDL (`bookstore` directive-free, `hasura-blog` for the generated-type pruning path), DBML (`bookstore` hand-written dbdiagram style, `sql2dbml-shop` for the fully quoted multi-schema machine dialect), AML (`bookstore` hand-written v2, `azimutt-full` and `azimutt-full-legacy` for the exhaustive v2 and v1 spellings) and `test.json` |
| `docker/` | Per-vendor `docker-compose.yml` (mysql, mariadb, mssql, oracle, postgres, sqlite) for validating generated DDL; Databricks and Snowflake have no entry |
| `json-schema/` | `schema.json` for `.erd` / `.vuerd` documents; `erd-editor-schema` stamps its URL into every parsed document |
| `.github/` | `workflows/ci.yml` and `workflows/intellij-plugin.yml`, the `setup-workspace` composite action, two issue templates |
| `.vite-hooks/` | `pre-commit` runs `vp staged`, `commit-msg` runs commitlint; only the generated `_/` dispatcher is gitignored |

## Package Map

Build order is derived from workspace dependencies: the first five rows below are leaves, `erd-editor-schema` and `vscode-bridge` sit on `shared`, and `erd-editor` sits on the five leaves plus `erd-editor-schema`. `app`, `intellij-webview` and `vscode-webview` depend on `erd-editor` directly; `vscode-extension` reaches it only through `vscode-webview`, which is the longest chain — `vuerd-vscode` → `vscode-webview` → `vscode-replication-store-worker` → `erd-editor` → `erd-editor-schema` → `shared`. `intellij-plugin` sits outside that graph: a Gradle project whose only pnpm presence is a `private` package.json, fed by `intellij-webview`'s build output.

| Package | npm name | Kind | |
| --- | --- | --- | --- |
| `packages/shared` | `@dineug/shared` | Library | type guards, array/number helpers, nanoid |
| `packages/r-html` | `@dineug/r-html` | Library | tagged-template rendering framework + store |
| `packages/vite-plugin-r-html` | `@dineug/vite-plugin-r-html` | Build tool | JSX → tagged templates, and HMR boundaries |
| `packages/schema-sql-parser` | `@dineug/schema-sql-parser` | Library | permissive DDL parser for SQL import |
| `packages/erd-editor-shiki-worker` | `@dineug/erd-editor-shiki-worker` | Worker | Shiki highlighting off the main thread (published, 0.2.0) |
| `packages/erd-editor-schema` | `@dineug/erd-editor-schema` | Library | v2/v3 document schema, parsing, LWW operators |
| `packages/erd-editor` | `@dineug/erd-editor` | Library | **editor core** — the `<erd-editor>` element (published, 3.5.0) |
| `packages/vscode-bridge` | `@dineug/erd-editor-vscode-bridge` | Library | typed host↔webview command protocol |
| `packages/vscode-replication-store-worker` | `@dineug/erd-editor-vscode-replication-store-worker` | Worker | headless document replica for the VSCode host |
| `packages/vscode-webview` | `@dineug/erd-editor-vscode-webview` | App | bundle inside the VSCode webview iframe |
| `packages/vscode-extension` | `vuerd-vscode` | App | the published VSCode extension (2.4.0) |
| `packages/intellij-webview` | `@dineug/erd-editor-intellij-webview` | App | bundle for the IntelliJ plugin, over `window.cefQuery` |
| `packages/intellij-plugin` | `@dineug/erd-editor-intellij-plugin` | App | the published IntelliJ plugin — Kotlin/Gradle, no TS (0.4.0) |
| `packages/app` | `@dineug/erd-editor-app` | App | the React PWA at erd-editor.io |

## CODE MAP

The TypeScript LSP is configured but unavailable in this checkout; the rows below come from the indexed code graph and manifest/config inspection.

| Symbol | Location | Graph signal | Role |
| --- | --- | --- | --- |
| `defineLibraryConfig` | `tools/vite/library-config.ts:110` | 7 callers | Standard library Vite configs; delegates to `createLibraryConfig` and the generated task graph |
| `createLibraryTasks` | `tools/vite/library-config.ts:42` | 5 callers | Shared `tsc --noEmit` → build/test task contract, including the two bespoke library configs |
| `createReplicationStore` | `packages/erd-editor/src/engine/replication-store.ts:44` | 7 callers | DOM-free document replica consumed by the engine entry, app IndexedDB, and both IDE workers |
| `Bridge` | `packages/vscode-bridge/src/bridge.ts:23` | host/webview/worker/IntelliJ surfaces | Transport-neutral command registry and dispatch boundary |

## For AI Agents

### Working In This Directory

- **pnpm only.** Cross-package deps are `workspace:*`; import a sibling by package name (`@dineug/shared`), never a relative path into its `src/`.
- **Command surface split.** A name lives in `run.tasks` or in package.json `scripts`, never both — no package.json here declares a `build` or `test` script.

  | Target | Invocation |
  | --- | --- |
  | task (`build`, `test`) | `vp run --filter <pkg> --fail-if-no-match <task>`, or `vp run -r <task>` for all |
  | script (`dev`, `e2e`, `typecheck`, `test:coverage`) | `pnpm --filter <pkg> <script>` |
  | Gradle (`intellij-plugin` only) | `cd packages/intellij-plugin && ./gradlew <task>` — it declares neither of the above |

  Selection flags go before the task name: `vp run -r build` is recursive, while `vp run build -r` forwards `-r` as a task argument instead of enabling recursion. `vp build` and `vp test` are built-ins that skip `run.tasks`, its `tsc --noEmit` gate and `dependsOn`. A `--filter` matching no package exits 0, so pass `--fail-if-no-match` or a rename leaves CI green while building nothing.
- **TypeScript 7.0.2 everywhere.** Its `tsc` is a native binary Vite Task cannot trace, so every task declares `input` explicitly. The nine library-mode packages derive those inputs from their tsconfig and workspace manifests; bespoke app tasks still own their lists locally.
- **One bundler.** Nine libraries build in Vite library mode with `vite-plugin-dts`; `app`, `intellij-webview`, `vscode-webview` and `vscode-extension` build an entry. Match the neighbouring package.
- **`@/*` → `<package>/src/*`** is in all 13 TypeScript packages' `tsconfig.json` `paths`. The seven standard library builds receive the matching Vite alias from `tools/vite/library-config.ts`; bespoke build and test configs still declare it locally.
- **Formatting covers `.{ts,mts,tsx}` only** — `fmt.ignorePatterns` excludes Markdown, so `pnpm format` never rewrites the 15 AGENTS.md files. oxlint does not read `.gitignore`; its ignore list is in the root `vite.config.ts`, so gitignoring a path does not un-lint it.
- **Comments are lint-enforced, repo-wide.** Four rules in `tools/eslint-rules/`, enabled as `error` in the root `vite.config.ts` — global rather than under the `**/src/**` overrides, because the longest prose here lives in the configs, the e2e harnesses and the specs. What no longer fits a comment goes to a package `AGENTS.md`, becomes a test, or is left to git history.

  | Rule | Bound |
  | --- | --- |
  | `local/jsdoc-prose-limit` | One prose paragraph, three lines. `@example` and `@tag` lines do not count |
  | `local/comment-run-limit` | Three consecutive line comments that open their line; a bare `//` separator counts |
  | `local/jsdoc-attached` | A JSDoc block describes the declaration below it — never an import, a re-export, or another block. A tags-only block such as `@type` is machine-read and exempt |
  | `local/no-comment-markdown` | No emphasis, backticks, fences, tables or lists in comment prose — nothing renders it. `@example` bodies are exempt, and it auto-fixes the paired forms |

  `no-comment-markdown --fix` mis-pairs where a code span itself contains backticks or `${…}`; review those hunks rather than taking the fix. Lint reaches `.{ts,tsx,js,mjs}` only, so the `.github/` YAML follows the same bounds by hand — the `**bold**` in `ISSUE_TEMPLATE/` is the exception, since GitHub renders it.
- Commit messages are linted by commitlint (Conventional Commits); `subject-case` is off because this repo capitalizes subjects.

### Testing Requirements

- `pnpm test` = `vp run -r test`. Nine packages define a `test` task — `shared`, `r-html`, `schema-sql-parser`, `erd-editor-schema`, `erd-editor`, `vscode-bridge`, `vite-plugin-r-html`, `app`, `vscode-extension`; the other five no-op. Each runs `tsc --noEmit` before Vitest.
- Eight Vitest configs use `include: ['src/**/*.test.ts']`. `erd-editor` is the exception: it declares two `projects` — `unit` (happy-dom, `src/**/*.test.{ts,tsx}`) and `browser` (a real headless Chromium through `@vitest/browser-playwright`, `src/**/*.browser.test.{ts,tsx}`), because its ERD scene is a Konva canvas that means nothing without one. The `.browser.` infix is the only thing that routes a spec to the second project. **`pnpm test` therefore needs a browser binary now**, which is why the `ci` job installs Chromium before running it. A test outside `src/` is never collected, and all nine configs have a v8 coverage block at `perFile` 80%. Those thresholds gate `pnpm --filter <pkg> test:coverage` only; `pnpm test` and CI do not enforce them.
- **A change is not verified until `pnpm build` passes.** Every `build` task runs `tsc --noEmit` first, so a green `pnpm test` proves nothing about the types of what ships.
- `pnpm check` = `vp check` (oxfmt + oxlint in one pass) + the root `tsc --noEmit` + the library config contract tests + `scripts/check-task-inputs.mjs`. `pnpm format` is the writing half.
- Out-of-process suites, none of them in `pnpm test`: `pnpm --filter <pkg> e2e` for `erd-editor`, `app` and `r-html` (Playwright), and `vscode-extension` (`@vscode/test-cli`; needs `xvfb-run -a` on Linux). `app`'s is the one with no CI job.
- `ci.yml` runs five jobs on push/PR/dispatch: `check` (`pnpm check`, then a build of `app`'s and `vuerd-vscode`'s dependencies, then those two `typecheck` scripts and `app`'s `e2e:typecheck`), `ci` (install Chromium, `pnpm test`, r-html `test:coverage`, `pnpm build`, `pnpm size`), `e2e`, `r-html-e2e`, `vscode-extension-e2e`. `intellij-plugin.yml` is separate so its `cancel-in-progress` does not reach those five; a `gate` job there decides whether the Gradle jobs run, because a job skipped by `paths` at workflow level leaves its check Pending forever. That build step in `check` is load-bearing: those typechecks resolve siblings through `dist/**/*.d.ts`, so dropping it passes locally and fails only on a runner.
- `pnpm size` sits outside `pnpm check` on purpose: it reads `packages/erd-editor/dist/`, which does not exist until `pnpm build` has run. `.size-baseline.json` keeps the measurement taken at `baseCommit`, so every run also prints the delta since then; `budgetGzip` is a separate field and a regression watch rather than a cap — wide enough to absorb ordinary work, narrow enough that one new dependency fails the round it lands in. Re-pin it with `--set-budget --budget-gzip <bytes> --budget-note <why>`; `--update-baseline` rewrites the recorded measurement and throws the delta away.
- Lint scope is `**/src/**/*.{ts,tsx}` — e2e specs, config files and `vscode-extension/test/**` are outside it. For SQL-generation changes, `docker/<vendor>/` plus `data/*.sql` is the manual loop — except Databricks and Snowflake, proprietary managed cloud services with no local container, so there is no `docker/databricks/` or `docker/snowflake/` and there will not be one.

### Common Patterns

- **`erd-editor` is authored in JSX** (`.tsx`), compiled to `html`/`svg` tagged templates by `rHtml()` before any JS transform sees the file; `packages/r-html` itself stays tagged-template, and its ~180 sites are the format that transform targets. Sigils survive as JSX namespaces — `bool:`, `on:`, `prop:`, `use:` — and every component attribute is emitted with a leading dot, so a prop named `onFoo` is not read as an event. `packages/erd-editor/AGENTS.md` carries the full mapping. A `.tsx` file may instead open with a `/** @jsxHost konva */` pragma, which sends the same transform at a second render host — `erd-editor`'s Konva scene, whose intrinsics are `k-*` rather than DOM tags. One file, one host; mixing them is a compile error either way.
- Named exports, except that component modules default-export their component — every `export default` in the workspace is under `erd-editor/src/components/` or `app/src/components|routes/`. Imports and exports are sorted by `simple-import-sort`, bridged into oxlint through `lint.jsPlugins`.
- Barrel `index.ts` per feature directory; a package's root `src/index.ts` is the public surface — named re-exports in most, blanket `export *` in `shared`, `r-html` and `vscode-bridge`.
- The eight ESM library packages are `"type": "module"` with an `exports` map of `types` + `default`, and point `main` / `module` / `types` at `dist/`.
- Most `typescript/*` strictness rules are deliberately off in the root `vite.config.ts` (`no-explicit-any`, `no-unused-vars`, …); don't reintroduce them inside an unrelated change.

## Dependencies

### External

- **Vite+ 0.2.9** — tasks, lint, format, test and commit hooks in one toolchain; `vp toolchain` is what prints the bundled tool versions. The catalog aliases `vite` to `@voidzero-dev/vite-plus-core`, so there is no `node_modules/.bin/vite` to invoke.
- **pnpm 10.34.3** (`packageManager`) and **Node 22.23.2** (`.nvmrc` / `.node-version`, same content). The pin to 10 existed so the separate IntelliJ plugin repo's pnpm 10 could read the lockfile; that repo is now `packages/intellij-plugin`, so nothing outside this tree constrains it.
- **TypeScript 7.0.2**, plus **`@typescript/typescript6` 6.0.2** in the nine declaration-emitting packages — `vite-plugin-dts` needs the compiler API TS7 removed.
- **Vitest 4** (imported as `vite-plus/test`); **Playwright `^1.62.1`** across all three Playwright suites and `erd-editor`'s browser-mode Vitest project, so one browser download serves all four; **`@vscode/test-cli`** for the Extension Host suite.
- **konva 10.3.2** — the ERD scene renderer in `erd-editor`, pinned without a caret, imported only through `konva/lib/*` deep paths (the root barrel costs 3.3 kB gzipped for nothing) and bundled into `dist/` like every other devDependency there. It replaced **`html-to-image`**, which left with the DOM scene. **`@chenglou/pretext` 0.0.8** arrived with it, for the multi-line memo text a `<textarea>` used to lay out.
- **rxjs 7** — the editor's store/action pipeline and DOM interaction streams. **es-toolkit `^1.50.0`** — the utility belt in `erd-editor`, `erd-editor-schema` and `app`; `isEmpty`, `get`, `set` and `round` come from `es-toolkit/compat`, and `packages/erd-editor/AGENTS.md` says why. **lucide 1.35.0** — the icon set in `erd-editor`, pinned without a caret and a `devDependency`, because that package's lib build inlines its devDeps into `dist/`.
- **React 19** with `@radix-ui/themes` 3 — `app` only, as is `dexie` `^3.2.7`, the one dependency held back on purpose; `packages/app/AGENTS.md` carries the reason.
- **`eslint-plugin-simple-import-sort`** (bridged into oxlint through `lint.jsPlugins`) and **commitlint 20** (run from `.vite-hooks/commit-msg`) — the two things Vite+ has no equivalent for.

### Contracts Outside This Repo

| What | Who reads it |
| --- | --- |
| JetBrains Marketplace | the plugin `<id>`, its signing certificate and the listing text extracted from `packages/intellij-plugin/README.md`. Publishing is manual — no token or key is in this repository, and no workflow uploads anything |

<!-- MANUAL: notes added below this line are preserved on regeneration -->
