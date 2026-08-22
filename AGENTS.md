<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# erd-editor

## Purpose

`@dineug/erd-editor-monorepo` is a pnpm + Vite+ workspace building an Entity-Relationship Diagram editor, shipped through four surfaces: the web app at erd-editor.io, a VSCode extension, an IntelliJ plugin webview, and the standalone `<erd-editor>` custom element on npm. The editor core is framework-free, built on the in-house `@dineug/r-html` framework — authored in JSX, compiled back to that framework's tagged templates at build time. Its state lives in a Redux-like store whose actions carry a Lamport-style clock and merge through an LWW register set, which is what lets collaboration, cross-tab sync and undo/redo share one mechanism.

## Key Files

| File | Description |
| --- | --- |
| `vite.config.ts` | The repo's only `lint` / `fmt` / `staged` block — no package config declares one, and there is deliberately no `.oxlintrc.json` / `.oxfmtrc.json`; the `oxc.oxc-vscode` LSP shims read this file too |
| `package.json` | Root scripts (`build`, `test`, `check`, `format`, `lint`, `cache:clear`); pins pnpm 10.34.3 via `packageManager` |
| `pnpm-workspace.yaml` | `packages/*`, the catalog aliasing `vite` → `@voidzero-dev/vite-plus-core@0.2.9`, and the `typescript: 7.0.2` override |
| `tsconfig.app.json` | Base config every package extends — ES2022 `target` and `lib`, strict, bundler resolution |
| `tsconfig.json` | Typechecks the `vite.config.*` / `vitest.config.*` files, which sit in no package program; without it a typo in a `run.tasks` block is accepted silently |
| `build-target.ts` | `BROWSER_TARGET` / `BROWSER_TARGET_QUERY` — the one browser floor, imported by the nine library `vite.config`s and `app`'s, and by neither webview |
| `scripts/check-task-inputs.mjs` | Fails `pnpm check` when a package gains a workspace dep without the matching `dist/**/*.d.ts` input glob |
| `erd-editor.code-workspace` | Multi-root workspace; sets `oxc.oxc-vscode` as the formatter per language so the editor matches `vp fmt` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `packages/` | The 13 workspace packages; each carries its own `AGENTS.md` |
| `data/` | Sample SQL dumps (`sakila`, `OKKY`, `GNUBOARD5`, `YOUNGCART5`, `Magento2-sales`) and `test.json`, for exercising the SQL importer by hand |
| `docker/` | Per-vendor `docker-compose.yml` (mysql, mariadb, mssql, oracle, postgres, sqlite) for validating generated DDL |
| `json-schema/` | `schema.json` for `.erd` / `.vuerd` documents; `erd-editor-schema` stamps its URL into every parsed document |
| `.github/` | `workflows/ci.yml`, the `setup-workspace` composite action, two issue templates |
| `.vite-hooks/` | `pre-commit` runs `vp staged`, `commit-msg` runs commitlint; only the generated `_/` dispatcher is gitignored |

## Package Map

Build order is derived from workspace dependencies: the first five rows below are leaves, `erd-editor-schema` and `vscode-bridge` sit on `shared`, and `erd-editor` sits on the five leaves plus `erd-editor-schema`. `app`, `intellij-webview` and `vscode-webview` depend on `erd-editor` directly; `vscode-extension` reaches it only through `vscode-webview`, which is the longest chain — `vuerd-vscode` → `vscode-webview` → `vscode-replication-store-worker` → `erd-editor` → `erd-editor-schema` → `shared`.

| Package | npm name | Kind | |
| --- | --- | --- | --- |
| `packages/shared` | `@dineug/shared` | Library | type guards, array/number helpers, nanoid |
| `packages/r-html` | `@dineug/r-html` | Library | tagged-template rendering framework + store |
| `packages/vite-plugin-r-html` | `@dineug/vite-plugin-r-html` | Build tool | JSX → tagged templates, and HMR boundaries |
| `packages/schema-sql-parser` | `@dineug/schema-sql-parser` | Library | permissive DDL parser for SQL import |
| `packages/erd-editor-shiki-worker` | `@dineug/erd-editor-shiki-worker` | Worker | Shiki highlighting off the main thread (published, 0.1.2) |
| `packages/erd-editor-schema` | `@dineug/erd-editor-schema` | Library | v2/v3 document schema, parsing, LWW operators |
| `packages/erd-editor` | `@dineug/erd-editor` | Library | **editor core** — the `<erd-editor>` element (published, 3.3.1) |
| `packages/vscode-bridge` | `@dineug/erd-editor-vscode-bridge` | Library | typed host↔webview command protocol |
| `packages/vscode-replication-store-worker` | `@dineug/erd-editor-vscode-replication-store-worker` | Worker | headless document replica for the VSCode host |
| `packages/vscode-webview` | `@dineug/erd-editor-vscode-webview` | App | bundle inside the VSCode webview iframe |
| `packages/vscode-extension` | `vuerd-vscode` | App | the published VSCode extension (2.2.0) |
| `packages/intellij-webview` | `@dineug/erd-editor-intellij-webview` | App | bundle for the IntelliJ plugin, over `window.cefQuery` |
| `packages/app` | `@dineug/erd-editor-app` | App | the React PWA at erd-editor.io |

## For AI Agents

### Working In This Directory

- **pnpm only.** Cross-package deps are `workspace:*`; import a sibling by package name (`@dineug/shared`), never a relative path into its `src/`.
- **Command surface split.** A name lives in `run.tasks` or in package.json `scripts`, never both — no package.json here declares a `build` or `test` script.

  | Target | Invocation |
  | --- | --- |
  | task (`build`, `test`, `build:webview`) | `vp run --filter <pkg> --fail-if-no-match <task>`, or `vp run -r <task>` for all |
  | script (`dev`, `e2e`, `typecheck`, `test:coverage`) | `pnpm --filter <pkg> <script>` |

  Flags go before the task name: `vp run build -r` builds one package and exits 0. `vp build` and `vp test` are built-ins that skip `run.tasks`, its `tsc --noEmit` gate and `dependsOn`. A `--filter` matching no package exits 0, so pass `--fail-if-no-match` or a rename leaves CI green while building nothing.
- **TypeScript 7.0.2 everywhere.** Its `tsc` is a native binary Vite Task cannot trace, so every task declares `input` explicitly — change a tsconfig `include` without the matching `input` and a stale `.d.ts` typechecks green.
- **One bundler.** Nine libraries build in Vite library mode with `vite-plugin-dts`; `app`, `intellij-webview`, `vscode-webview` and `vscode-extension` build an entry. Match the neighbouring package.
- **`@/*` → `<package>/src/*`** is in all 13 `tsconfig.json` `paths`, and repeated in each config that has to resolve it — `vite.config.ts` in twelve (`vscode-extension` declares none; only its specs import through `@/`) and `vitest.config.*` in the eight with a suite. A new alias needs every copy.
- **Formatting covers `.{ts,mts,tsx}` only** — `fmt.ignorePatterns` excludes Markdown, so `pnpm format` never rewrites the 14 AGENTS.md files. oxlint does not read `.gitignore`; its ignore list is in the root `vite.config.ts`, so gitignoring a path does not un-lint it.
- Commit messages are linted by commitlint (Conventional Commits); `subject-case` is off because this repo capitalizes subjects.

### Testing Requirements

- `pnpm test` = `vp run -r test`. Nine packages define a `test` task — `shared`, `r-html`, `schema-sql-parser`, `erd-editor-schema`, `erd-editor`, `vscode-bridge`, `vite-plugin-r-html`, `app`, `vscode-extension`; the other four no-op. Each runs `tsc --noEmit` before Vitest.
- Vitest configs are uniform: `include: ['src/**/*.test.ts']` — a test outside `src/` is never collected — and a v8 coverage block at `perFile` 80%. Those thresholds gate `pnpm --filter <pkg> test:coverage` only; `pnpm test` and CI do not enforce them.
- **A change is not verified until `pnpm build` passes.** Every `build` task runs `tsc --noEmit` first, so a green `pnpm test` proves nothing about the types of what ships.
- `pnpm check` = `vp check` (oxfmt + oxlint in one pass) + the root `tsc --noEmit` + `scripts/check-task-inputs.mjs`. `pnpm format` is the writing half.
- Out-of-process suites, none of them in `pnpm test`: `pnpm --filter <pkg> e2e` for `erd-editor`, `app` and `r-html` (Playwright), and `vscode-extension` (`@vscode/test-cli`; needs `xvfb-run -a` on Linux). `app`'s is the one with no CI job.
- `ci.yml` runs five jobs on push/PR/dispatch: `check` (`pnpm check`, then a build of `app`'s and `vuerd-vscode`'s dependencies, then those two `typecheck` scripts and `app`'s `e2e:typecheck`), `ci` (`pnpm test`, r-html `test:coverage`, `pnpm build`), `e2e`, `r-html-e2e`, `vscode-extension-e2e`. That build step in `check` is load-bearing: those typechecks resolve siblings through `dist/**/*.d.ts`, so dropping it passes locally and fails only on a runner.
- Lint scope is `**/src/**/*.{ts,tsx}` — e2e specs, config files and `vscode-extension/test/**` are outside it. For SQL-generation changes, `docker/<vendor>/` plus `data/*.sql` is the manual loop.

### Common Patterns

- **`erd-editor` is authored in JSX** (`.tsx`), compiled to `html`/`svg` tagged templates by `rHtml()` before any JS transform sees the file; `packages/r-html` itself stays tagged-template, and its ~180 sites are the format that transform targets. Sigils survive as JSX namespaces — `bool:`, `on:`, `prop:`, `use:` — and every component attribute is emitted with a leading dot, so a prop named `onFoo` is not read as an event. `packages/erd-editor/AGENTS.md` carries the full mapping.
- Named exports, except that component modules default-export their component — every `export default` in the workspace is under `erd-editor/src/components/` or `app/src/components|routes/`. Imports and exports are sorted by `simple-import-sort`, bridged into oxlint through `lint.jsPlugins`.
- Barrel `index.ts` per feature directory; a package's root `src/index.ts` is the public surface — named re-exports in most, blanket `export *` in `shared`, `r-html` and `vscode-bridge`.
- The eight ESM library packages are `"type": "module"` with an `exports` map of `types` + `default`, and point `main` / `module` / `types` at `dist/`.
- Most `typescript/*` strictness rules are deliberately off in the root `vite.config.ts` (`no-explicit-any`, `no-unused-vars`, …); don't reintroduce them inside an unrelated change.

## Dependencies

### External

- **Vite+ 0.2.9** — tasks, lint, format, test and commit hooks in one toolchain; `vp toolchain` is what prints the bundled tool versions. The catalog aliases `vite` to `@voidzero-dev/vite-plus-core`, so there is no `node_modules/.bin/vite` to invoke.
- **pnpm 10.34.3** (`packageManager`) and **Node 22.23.2** (`.nvmrc` / `.node-version`, same content).
- **TypeScript 7.0.2**, plus **`@typescript/typescript6` 6.0.2** in the nine declaration-emitting packages — `vite-plugin-dts` needs the compiler API TS7 removed.
- **Vitest 4** (imported as `vite-plus/test`); **Playwright `^1.62.1`** across all three Playwright suites, so one browser download serves them; **`@vscode/test-cli`** for the Extension Host suite.
- **rxjs 7** — the editor's store/action pipeline and DOM interaction streams. **es-toolkit `^1.50.0`** — the utility belt in `erd-editor`, `erd-editor-schema` and `app`; `isEmpty`, `get`, `set` and `round` come from `es-toolkit/compat`, and `packages/erd-editor/AGENTS.md` says why.
- **React 19** with `@radix-ui/themes` 3 — `app` only, as is `dexie` `^3.2.7`, the one dependency held back on purpose; `packages/app/AGENTS.md` carries the reason.
- **`eslint-plugin-simple-import-sort`** (bridged into oxlint through `lint.jsPlugins`) and **commitlint 20** (run from `.vite-hooks/commit-msg`) — the two things Vite+ has no equivalent for.

### Contracts Outside This Repo

| What | Who reads it |
| --- | --- |
| `.nvmrc` | `erd-editor-intellij-plugin`'s workflows, as `node-version-file: erd-editor/.nvmrc` — see the comment in `.github/actions/setup-workspace/action.yml`. Both node files must stay and must agree |
| `pnpm-lock.yaml` format | those same workflows, which install **pnpm 10**. A lockfile written by pnpm 11 is unreadable there, which is why `packageManager` pins 10.34.3 — do not bump it to 11 |
| `intellij-webview`'s `build:webview` | that same plugin repo — it emits into `../../../erd-editor-intellij-plugin/src/main/resources/assets` with `emptyOutDir`, and is `cache: false` because the cache cannot restore files outside this tree. That default assumes the plugin repo sits beside this one; it also vendors this repo as a submodule, and its CI sets `ERD_EDITOR_ASSETS_DIR` to redirect the output |

<!-- MANUAL: notes added below this line are preserved on regeneration -->
