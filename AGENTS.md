<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# erd-editor

## Purpose

`@dineug/erd-editor-monorepo` is a pnpm + Vite+ workspace for an Entity-Relationship Diagram editor shipped four ways: erd-editor.io, a VSCode extension, an IntelliJ plugin and the `<erd-editor>` custom element on npm. The framework-free editor core is JSX compiled to the in-house `@dineug/r-html` tagged templates. Its store's actions carry a Lamport-style clock and merge through an LWW register set — the one mechanism behind collaboration, cross-tab sync and undo/redo.

## Key Files

| File | Description |
| --- | --- |
| `vite.config.ts` | The only `lint` / `fmt` / `staged` config; deliberately no `.oxlintrc.json` / `.oxfmtrc.json` |
| `package.json` | Root scripts (`build`, `test`, `check`, `format`, `lint`, `size`, `cache:clear`) |
| `pnpm-workspace.yaml` | `packages/*`, the catalog (`vite` → `@voidzero-dev/vite-plus-core`, Vitest), the `typescript` override |
| `tsconfig.app.json` | Base every TS package extends (ES2022, strict, bundler resolution) except `vscode-extension`, a Node config |
| `tsconfig.json` | Root program: `tools/` and every package's Vite / Vitest config, which no package program covers |
| `build-target.ts` | `BROWSER_TARGET` / `BROWSER_TARGET_QUERY` — the one browser floor for every library build and `app` |
| `tools/vite/library-config.ts` | `defineLibraryConfig` (seven standard builds), `createLibraryTasks` (task contract of all eight library packages) |
| `tools/vite/package-metadata.ts` | Task inputs derived from tsconfig files and manifests; `createExternal` |
| `tools/vite/worker-url.ts`, `same-origin-worker.ts`, `inline-worker.ts` | The worker plugins, tested with the factory in `tools/vite-config.test.ts` |
| `tools/eslint-rules/` | The `local` oxlint plugin — the four comment rules; itself lint-exempt |
| `scripts/check-task-inputs.mjs` | Recomputes library tasks; matches bespoke tasks' `.d.ts` globs to declared deps; pins the 8 / 7 library-config counts a new library must update |
| `scripts/check-bundle-size.mjs` | The `pnpm size` gate |
| `erd-editor.code-workspace` | Multi-root workspace, formatting through `oxc.oxc-vscode` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `packages/` | The 13 workspace packages, each with its own `AGENTS.md` |
| `data/` | Import fixtures for hand-testing (SQL, GraphQL SDL, DBML, AML v1/v2, `test.json`); `schema-sql-parser`'s tests read `sakila.sql` |
| `docker/` | A `docker-compose.yml` per SQL vendor for running generated DDL; Databricks and Snowflake are cloud-only and have none |
| `json-schema/` | `schema.json` for `.erd` / `.vuerd` documents (see Contracts) |
| `.github/` | The two workflows (see Testing), the `setup-workspace` action |
| `.vite-hooks/` | `pre-commit` runs `vp staged`, `commit-msg` runs commitlint; only the generated `_/` is gitignored |

## Package Map

Build order follows workspace dependencies; the longest chain is `vuerd-vscode` → `vscode-webview` → `webview-client` → `replication-store-worker` → `erd-editor` → `erd-editor-schema`. `intellij-plugin` is Gradle, outside the graph, fed by `intellij-webview`'s build.

| `packages/` | npm name | |
| --- | --- | --- |
| `r-html` | `@dineug/r-html` | tagged-template rendering framework + store |
| `vite-plugin-r-html` | `@dineug/vite-plugin-r-html` | JSX → tagged templates, HMR |
| `schema-sql-parser` | `@dineug/schema-sql-parser` | permissive DDL parser for SQL import |
| `erd-editor-schema` | `@dineug/erd-editor-schema` | v2/v3 document schema, parsing, LWW operators |
| `erd-editor` | `@dineug/erd-editor` | **editor core**, published (3.9.0): `<erd-editor>`, its Konva scene, and `engine.js` (`createReplicationStore`) |
| `webview-bridge` | `@dineug/erd-editor-webview-bridge` | `Bridge`, the typed host↔webview command protocol |
| `webview-client` | `@dineug/erd-editor-webview-client` | `mountWebview(host)` — all host wiring both webviews share |
| `replication-store-worker` | `@dineug/erd-editor-replication-store-worker` | headless replica `webview-client` spawns |
| `vscode-webview` | `@dineug/erd-editor-vscode-webview` | VSCode webview bundle |
| `vscode-extension` | `vuerd-vscode` | VSCode extension host, published (2.8.0) |
| `intellij-webview` | `@dineug/erd-editor-intellij-webview` | IntelliJ webview bundle, over `window.cefQuery` |
| `intellij-plugin` | `@dineug/erd-editor-intellij-plugin` | Kotlin/Gradle plugin, published (0.8.0) |
| `app` | `@dineug/erd-editor-app` | React PWA at erd-editor.io |

## For AI Agents

### Working In This Directory

- **pnpm only.** Cross-package deps are `workspace:*`; import a sibling by package name, never through a relative path into its `src/`.
- **Command surface split.** A name lives in `run.tasks` or in package.json `scripts`, never both.

  | Target | Invocation |
  | --- | --- |
  | task (`build`, `test`) | `vp run --filter <pkg> --fail-if-no-match <task>`, or `vp run -r <task>` |
  | script (`dev`, `e2e`, `typecheck`, `test:coverage`) | `pnpm --filter <pkg> <script>` |
  | Gradle (`intellij-plugin`) | `cd packages/intellij-plugin && ./gradlew <task>` |

  Flags go before the task: `vp run build -r` forwards `-r` to the task. A `--filter` matching nothing exits 0. `vp build` / `vp test` are built-ins that skip `run.tasks`, the `tsc --noEmit` gate and `dependsOn`. There is no `vite` binary.
- **TypeScript 7.0.2's native `tsc` is invisible to Vite Task**, so every task declares `input`. Library packages derive it in `package-metadata.ts` and `check-task-inputs.mjs` recomputes it; app tasks list their own, and the check only matches their sibling `dist/**/*.d.ts` globs to declared dependencies. A task with no `output` restores nothing on a cache hit. `@typescript/typescript6` is only for `vite-plugin-dts`.
- **Library builds.** Six private libraries (`r-html`, `vite-plugin-r-html`, `schema-sql-parser`, `erd-editor-schema`, `webview-bridge`, `webview-client`) build `minify: false` + `preserveModules: true` with `sideEffects: false`, so the consumer prunes per file and minifies once. `erd-editor` keeps chunks and no `sideEffects` field (its `AGENTS.md` says why).
- **Externals decide what ships.** `createExternal` keeps `dependencies` + `peerDependencies` as bare imports and inlines the rest. `erd-editor` lists the private libraries as devDependencies so they inline; moving one into `dependencies` ships an import of a package not on npm.
- **Workers.** `erd-editor`'s four SharedWorkers and the replica Worker ship as `dist/workers/*.js`, spawned from `new URL('./workers/x.js', import.meta.url)` — the spelling `worker-url.ts` writes, which webpack, Rspack and Vite all bundle from a dependency. `vscode-webview` rebuilds them as same-origin blobs (`same-origin-worker.ts`), `intellij-webview` loads them by URL, the UMD build inlines them (`inline-worker.ts`).
- **A cache replay does not empty a task's `output` directory**, so a tree that has seen several builds holds stale chunks beside live ones. `pnpm cache:clear` and rebuild before packaging or publishing.
- **`@/*` → `<package>/src/*`** in every TS package's `tsconfig.json`, mirrored by a Vite alias in the factory and in each Vitest config — a new config needs it too.
- **Formatting is TypeScript only**: `fmt.ignorePatterns` lists every other extension, because oxfmt does not re-include after a global exclude; that spelling formats nothing and still passes. oxlint ignores `.gitignore`; its ignore list is in `vite.config.ts`.
- **Lint scope.** The rule overrides, import sort included, cover `**/src/**/*.{ts,tsx}`; the comment rules are global. Type-aware lint is off. Most `typescript/*` strictness rules are off on purpose; leave them off in unrelated changes.
- **Comments are lint-enforced** (`tools/eslint-rules/`); what no longer fits goes to an `AGENTS.md` or a test.

  | Rule | Bound |
  | --- | --- |
  | `local/jsdoc-prose-limit` | One prose paragraph, three lines; `@example` / `@tag` lines do not count |
  | `local/comment-run-limit` | Three consecutive line comments that open their line; a bare `//` counts |
  | `local/jsdoc-attached` | A JSDoc block sits on a declaration — not an import, re-export or another block; tags-only blocks exempt |
  | `local/no-comment-markdown` | No emphasis, backticks, fences, tables or lists in comment prose; `@example` exempt |

  `no-comment-markdown --fix` mis-pairs spans containing backticks or `${…}`; review those hunks. `.github/` YAML keeps the bounds by hand.
- **Commits**: Conventional Commits via commitlint, `subject-case` off (subjects are capitalized), header and body lines ≤ 100 chars.

### Testing Requirements

- `pnpm test` = `vp run -r test` over the nine packages with a `vitest.config.*` (a library's `test` task exists because of that file), each `tsc --noEmit` then Vitest, imported as `vite-plus/test`.
- Vitest collects `src/**/*.test.ts` only (`erd-editor`: `.test.{ts,tsx}`); a spec named or placed otherwise never runs. `erd-editor`'s `browser` project (`*.browser.test.{ts,tsx}`, real Chromium) makes `pnpm test` need `pnpm --filter @dineug/erd-editor exec playwright install chromium`.
- v8 coverage at `perFile` 80% on all four metrics gates `test:coverage`, and `pnpm test` measures none. CI runs `pnpm -r --no-bail test:coverage`, so a file under 80% in any of the nine packages fails it. Cover a gap with a test; the one hint in `src/` is `/* v8 ignore next -- @preserve */` on `erd-editor`'s `if (import.meta.hot)` blocks.
- **Not verified until `pnpm build` passes** — declaration emit, bundling and the packages with no `test` task are checked only there.
- `pnpm check` = `vp check` (oxfmt + oxlint) + root `tsc --noEmit` + `node --test tools/vite-config.test.ts` + `check-task-inputs.mjs`.
- `pnpm size`, after `pnpm build`: gzip of every script reachable from `erd-editor`'s `exports` vs `packages/erd-editor/.size-baseline.json`. `budgetGzip` is a regression watch; re-pin with `--set-budget --budget-gzip <bytes> --budget-note <why>`.
- `pnpm --filter <pkg> e2e`, outside `pnpm test`: Playwright for `@dineug/erd-editor`, `@dineug/erd-editor-app`, `@dineug/r-html`; `@vscode/test-cli` for `vuerd-vscode` (`xvfb-run -a` on Linux). `app`'s has no CI job.
- SQL-generation changes: `docker/<vendor>/` plus `data/*.sql` is the manual loop.
- CI `ci.yml`: `check` (`pnpm check`, then builds `app`'s and `vuerd-vscode`'s dependencies for their `typecheck` scripts, which read siblings' `dist/**/*.d.ts`), `ci` (`pnpm test`, every package's `test:coverage`, `pnpm build`, `pnpm size`), `e2e`, `r-html-e2e`, `vscode-extension-e2e`.
- `intellij-plugin.yml` is separate so its `cancel-in-progress` never reaches `ci.yml`; a `gate` job stands in for a `paths` filter, which would leave the check Pending forever.
- `setup-workspace` caches the pnpm store, never the Vite Task cache: a cold cache is what makes declared inputs do real work.

### Common Patterns

- **`erd-editor` is authored in JSX** that `rHtml()` compiles to r-html templates (or, under `/** @jsxHost konva */`, to the Konva scene host); `r-html` itself stays tagged-template. See `packages/erd-editor` and `packages/vite-plugin-r-html`.
- Named exports; a component module default-exports its component. `simple-import-sort` orders imports and exports.
- A barrel `index.ts` per feature directory; `src/index.ts` is a package's public surface.

## Dependencies

### External

- Toolchain: **Vite+ 0.2.9** (`vp`), **pnpm 10.34.3**, **Node 22.23.2** (`.nvmrc` = `.node-version`), **TypeScript 7.0.2** (+ `@typescript/typescript6` 6.0.2), **Vitest 4.1.10**, **Playwright `^1.62.1`** everywhere, `@vscode/test-cli`, `eslint-plugin-simple-import-sort`, commitlint 20.
- Editor runtime (konva, elkjs, shiki, comlink, rxjs, es-toolkit, nanoid, lucide, `@chenglou/pretext`): `packages/erd-editor/AGENTS.md`. React 19, Radix Themes, `dexie` `^3`: `app` only.

### Contracts Outside This Repo

| What | Who reads it |
| --- | --- |
| JetBrains Marketplace | the plugin `<id>`, its signing certificate and the listing text from `packages/intellij-plugin/README.md` |
| `json-schema/schema.json` on `main` | the `$schema` of every saved `.erd` / `.vuerd` file: `erd-editor-schema` stamps its raw GitHub URL, so moving or renaming it leaves existing files pointing at a dead URL |

Publishing — JetBrains, the VS Code Marketplace (`dineug.vuerd-vscode`), npm (`@dineug/erd-editor`) — is manual: no token or key is in the repository and no workflow uploads anything.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
