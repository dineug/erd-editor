<!-- Generated: 2026-08-27 | Updated: 2026-09-25 -->

# erd-editor

## Purpose

`@dineug/erd-editor-monorepo` is a pnpm + Vite+ workspace for an Entity-Relationship Diagram editor shipped four ways: erd-editor.io, a VSCode extension, an IntelliJ plugin and the `<erd-editor>` custom element on npm. The framework-free editor core is JSX compiled to the in-house `@dineug/r-html` tagged templates. Its store's actions carry a Lamport-style clock and merge through an LWW register set — the one mechanism behind collaboration, cross-tab sync and undo/redo. The same mechanism lets `@dineug/erd-editor-mcp`, a stdio MCP server also on npm, put a coding agent into a VS Code editing session as one more collaborator.

## Key Files

| File | Description |
| --- | --- |
| `vite.config.ts` | The only `lint` / `fmt` / `staged` config; deliberately no `.oxlintrc.json` / `.oxfmtrc.json` |
| `package.json` | Root scripts (`build`, `test`, `check`, `format`, `lint`, `size`, `peer-graph`, `cache:clear`) |
| `pnpm-workspace.yaml` | `packages/*`, the catalog (`vite` → `@voidzero-dev/vite-plus-core`, Vitest, the exact `effect` / `@effect/platform-node` pin), the `typescript` override, the `packageExtensions` entry that makes platform-node's `redis` peer optional |
| `tsconfig.app.json` | Base every TS package extends (ES2022, strict, bundler resolution) except `vscode-extension`, a Node config |
| `tsconfig.json` | Root program: `tools/`, every package's Vite / Vitest config, which no package program covers, and `functions/`, whose auth handlers it checks without the DOM lib |
| `build-target.ts` | `BROWSER_TARGET` / `BROWSER_TARGET_QUERY` — the one browser floor for every library build and `app` |
| `tools/vite/library-config.ts` | `defineLibraryConfig` (the whole config of eight library packages, one `src/index.ts` build each), `createLibraryTasks` (task contract of all nine library packages; `erd-editor` uses it alone) |
| `tools/vite/package-metadata.ts` | Task inputs derived from tsconfig files and manifests; `createExternal` |
| `tools/vite/worker-url.ts`, `same-origin-worker.ts`, `inline-worker.ts` | The worker plugins, tested with the factory in `tools/vite-config.test.ts` |
| `tools/eslint-rules/` | The `local` oxlint plugin — the four comment rules; itself lint-exempt |
| `scripts/check-task-inputs.mjs` | Recomputes library tasks; matches bespoke tasks' `.d.ts` globs to declared deps; pins the 9 / 8 library-config counts a new library must update |
| `scripts/check-bundle-size.mjs` | The `pnpm size` gate |
| `scripts/check-peer-graph.mjs` | The `pnpm peer-graph` gate: what `erd-editor`'s `peer.js` reaches in `dist/`, walked like the size gate, may hold none of five browser tokens (`SharedWorker`, `customElements`, `document.`, `window.`, `navigator.`) and import no package outside its allowlist; `--export <key>` reports another entry's graph and judges nothing |
| `erd-editor.code-workspace` | Multi-root workspace, formatting through `oxc.oxc-vscode` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `packages/` | The 16 workspace packages, each with its own `AGENTS.md` |
| `data/` | Import fixtures for hand-testing (SQL, GraphQL SDL, DBML, AML v1/v2, `test.json`); `schema-sql-parser`'s tests read `sakila.sql` |
| `docker/` | A `docker-compose.yml` per SQL vendor for running generated DDL; Databricks and Snowflake are cloud-only and have none |
| `functions/` | Cloudflare Pages Functions for erd-editor.io: `api/auth/[[route]].ts` only re-exports `packages/app/src/server/auth/pages.ts` (see `packages/app/AGENTS.md`) |
| `json-schema/` | `schema.json` for `.erd` / `.vuerd` documents (see Contracts) |
| `.github/` | The two workflows (see Testing), the `setup-workspace` action |
| `.vite-hooks/` | `pre-commit` runs `vp staged`, `commit-msg` runs commitlint; only the generated `_/` is gitignored |

## Package Map

Build order follows workspace dependencies; the longest chain is `vuerd-vscode` → `vscode-webview` → `webview-client` → `replication-store-worker` → `erd-editor` → `erd-editor-schema`. `mcp-server` joins only its tail (`mcp-server` → `erd-editor` → `erd-editor-schema`; it also names `erd-editor-schema` and `r-html` itself, for the parser and the action types), and its other dependency, `agent-hub`, which `vuerd-vscode` inlines too, depends on no workspace package; `effect` is its one peer. `intellij-plugin` is Gradle, outside the graph, fed by `intellij-webview`'s build. `obsidian-plugin` depends on `erd-editor` alone and bundles its UMD build.

| `packages/` | npm name | |
| --- | --- | --- |
| `r-html` | `@dineug/r-html` | tagged-template rendering framework + store |
| `vite-plugin-r-html` | `@dineug/vite-plugin-r-html` | JSX → tagged templates, HMR |
| `schema-sql-parser` | `@dineug/schema-sql-parser` | permissive DDL parser for SQL import |
| `erd-editor-schema` | `@dineug/erd-editor-schema` | v2/v3 document schema, parsing, LWW operators |
| `erd-editor` | `@dineug/erd-editor` | **editor core**, published: `<erd-editor>`, its Konva scene, `engine.js` (`createReplicationStore`) and `peer.js` (`createPeerStore` and the catalog barrels `mcp-server` builds its tools from) |
| `webview-bridge` | `@dineug/erd-editor-webview-bridge` | `Bridge`, the typed host↔webview command protocol |
| `agent-hub` | `@dineug/erd-editor-agent-hub` | the IDE ↔ coding-agent hub protocol as an effect `Schema` spec, `effect` its one peer dependency: messages, lock file, JSON lines framing, path authorization, discovery |
| `webview-client` | `@dineug/erd-editor-webview-client` | `mountWebview(host)` — all host wiring both webviews share |
| `replication-store-worker` | `@dineug/erd-editor-replication-store-worker` | headless replica `webview-client` spawns |
| `vscode-webview` | `@dineug/erd-editor-vscode-webview` | VSCode webview bundle |
| `vscode-extension` | `vuerd-vscode` | VSCode extension host, published, and the document hub coding agents join, on effect layers |
| `intellij-webview` | `@dineug/erd-editor-intellij-webview` | IntelliJ webview bundle, over `window.cefQuery` |
| `intellij-plugin` | `@dineug/erd-editor-intellij-plugin` | Kotlin/Gradle plugin, published |
| `obsidian-plugin` | `@dineug/erd-editor-obsidian-plugin` | Obsidian plugin, whose `dist/` is the plugin folder; released from `dineug/erd-editor-obsidian-plugin`, which carries this repository as a submodule |
| `app` | `@dineug/erd-editor-app` | React PWA at erd-editor.io, with `/gdrive`, its Google Drive editor, whose OAuth relay is the one Pages Function (`functions/`) |
| `mcp-server` | `@dineug/erd-editor-mcp` | stdio MCP server for coding agents, published: effect's `McpServer` over stdio, one tool per editing op, live through a VS Code window's hub or headless on the file; one ESM file with nothing external but node builtins |

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
- **Library builds.** Seven private libraries (`r-html`, `vite-plugin-r-html`, `schema-sql-parser`, `erd-editor-schema`, `webview-bridge`, `webview-client`, `agent-hub`) build `minify: false` + `preserveModules: true` with `sideEffects: false`, so the consumer prunes per file and minifies once. `erd-editor` keeps chunks and no `sideEffects` field (its `AGENTS.md` says why).
- **Externals decide what ships.** `createExternal` keeps `dependencies` + `peerDependencies` as bare imports and inlines the rest. `erd-editor` lists the private libraries as devDependencies so they inline; moving one into `dependencies` ships an import of a package not on npm. `agent-hub` names `effect` in `peerDependencies`, the only private library with a peer: its `dist/*.js` and `.d.ts` keep every `effect` import bare, and each consumer (`mcp-server`, `vuerd-vscode`) lists `effect` as a devDependency from the same `catalog:` pin and inlines the one copy it resolves (`ssr.noExternal: true`), shared with its own effect code. A consumer program that type-checks those `.d.ts` files needs `skipLibCheck`, which `tsconfig.app.json` and the extension's `tsconfig.json` set: effect's own declarations name types lib ES2022 lacks (`TextDecoderOptions`).
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

- `pnpm test` = `vp run -r test` over the eleven packages with a `vitest.config.*` (a library's `test` task exists because of that file), each `tsc --noEmit` then Vitest, imported as `vite-plus/test`.
- Vitest collects `src/**/*.test.ts` only (`erd-editor`: `.test.{ts,tsx}`); a spec named or placed otherwise never runs. `erd-editor`'s `browser` project (`*.browser.test.{ts,tsx}`, real Chromium) makes `pnpm test` need `pnpm --filter @dineug/erd-editor exec playwright install chromium`.
- v8 coverage at `perFile` 80% on all four metrics gates `test:coverage`, and `pnpm test` measures none. CI runs `pnpm -r --no-bail test:coverage`, so a file under 80% in any of the eleven packages fails it. Cover a gap with a test; the one hint in `src/` is `/* v8 ignore next -- @preserve */` on `erd-editor`'s `if (import.meta.hot)` blocks.
- **Not verified until `pnpm build` passes** — declaration emit, bundling and the packages with no `test` task are checked only there.
- `pnpm check` = `vp check` (oxfmt + oxlint) + root `tsc --noEmit` + `node --test tools/vite-config.test.ts` + `check-task-inputs.mjs`.
- `pnpm size`, after `pnpm build`: gzip of every script reachable from `erd-editor`'s `exports` vs `packages/erd-editor/.size-baseline.json`. `budgetGzip` is a regression watch; re-pin with `--set-budget --budget-gzip <bytes> --budget-note <why>`.
- `pnpm peer-graph`, after `pnpm build`: the scripts `erd-editor`'s `peer.js` reaches must hold no `SharedWorker`, `customElements`, `document.`, `window.` or `navigator.` and import only `deepmerge`, `es-toolkit` (and `/compat`), `graphql`, `luxon`, `nanoid`, `rxjs`. `erd-editor`'s `src/peer/imports.test.ts` holds the sources to the same two rules in `pnpm test`; change both allowlists together.
- `pnpm --filter <pkg> e2e`, outside `pnpm test`: Playwright for `@dineug/erd-editor`, `@dineug/erd-editor-app`, `@dineug/r-html`; `@vscode/test-cli` for `vuerd-vscode` (`xvfb-run -a` on Linux). Each runs in its own CI job.
- `pnpm --filter @dineug/erd-editor-obsidian-plugin smoke`, outside `pnpm test` and CI: the built plugin in a real Obsidian (`/Applications/Obsidian.app`) on a throwaway vault and user data directory, driven over CDP.
- SQL-generation changes: `docker/<vendor>/` plus `data/*.sql` is the manual loop.
- CI `ci.yml`: `check` (`pnpm check`, then builds `app`'s and `vuerd-vscode`'s dependencies for their `typecheck` scripts, which read siblings' `dist/**/*.d.ts`), `ci` (`pnpm test`, every package's `test:coverage`, `pnpm build`, `pnpm peer-graph`, `pnpm size`), `e2e`, `app-e2e`, `r-html-e2e`, `vscode-extension-e2e`.
- `intellij-plugin.yml` is separate so its `cancel-in-progress` never reaches `ci.yml`; a `gate` job stands in for a `paths` filter, which would leave the check Pending forever.
- `setup-workspace` caches the pnpm store, never the Vite Task cache: a cold cache is what makes declared inputs do real work.

### Common Patterns

- **`erd-editor` is authored in JSX** that `rHtml()` compiles to r-html templates (or, under `/** @jsxHost konva */`, to the Konva scene host); `r-html` itself stays tagged-template. See `packages/erd-editor` and `packages/vite-plugin-r-html`.
- Named exports; a component module default-exports its component. `simple-import-sort` orders imports and exports.
- A barrel `index.ts` per feature directory; `src/index.ts` is a package's public surface.

## Dependencies

### External

- Toolchain: **Vite+ 0.2.9** (`vp`), **pnpm 10.34.3**, **Node 22.23.2** (`.nvmrc` = `.node-version`; the floor a package declares is `engines.node` `>=22.12.0`, in the root, `mcp-server` and `agent-hub`, and the extension's is VS Code 1.101, which runs Node 22.15), **TypeScript 7.0.2** (+ `@typescript/typescript6` 6.0.2), **Vitest 4.1.10**, **Playwright `^1.62.1`** everywhere, `@vscode/test-cli`, `eslint-plugin-simple-import-sort`, commitlint 20.
- Editor runtime (konva, elkjs, shiki, comlink, rxjs, es-toolkit, nanoid, lucide, `@chenglou/pretext`): `packages/erd-editor/AGENTS.md`. React 19, Radix Themes, `dexie` `^3`: `app` only.
- **`effect` 4.0.0-rc.117** and **`@effect/platform-node` 4.0.0-rc.117**, both through `catalog:`. `effect` is `agent-hub`'s peer and a devDependency of `mcp-server` and `vuerd-vscode`, which inline it; `@effect/platform-node` is a devDependency of those two only, and `agent-hub` does not depend on it. The catalog pins both to one exact release, never a range, and they move together: a release candidate moves modules between releases (the ai, rpc, socket and encoding modules are `effect/unstable/*` in rc.117), so bump both, then `pnpm build`, `pnpm test` and `mcp-server`'s `bin.test.ts`. Import effect from the entries its `package.json` exports by name, the way its own docs do (`MCP.md`, the site's Importing Effect page): `import { Effect, Schema } from 'effect'`, `TestClock` from `'effect/testing'`, and each `effect/unstable/<group>` barrel (`McpServer` from `'effect/unstable/ai'`, `Socket` from `'effect/unstable/socket'`). A module path (`effect/Effect`, `effect/unstable/ai/McpServer`) resolves only through the `./*` wildcard. Rolldown still prunes the barrels per module, since effect's `sideEffects` lists only `SchemaJITCompiler/enable`. `@effect/platform-node` is the exception, imported by module path (`@effect/platform-node/NodeStdio`): its barrel re-exports `NodeRedis`, which imports `redis`, the peer `packageExtensions` makes optional and nothing installs, so Node cannot load the barrel (`ERR_MODULE_NOT_FOUND`, which fails every Vitest file that reaches it) and Rolldown cannot resolve it. `no-restricted-imports` in `vite.config.ts` refuses an effect module path, the platform-node barrel, anything below a platform-node module, `@effect/platform-node-shared`, and `effect/unstable/schema` / `effect/unstable/sql` (whose `SchemaAOTCompiler` and `Migrator` carry dynamic imports); `mcp-server`'s `src/imports.test.ts`, `vuerd-vscode`'s `src/hub/imports.test.ts` (which also reads `test/`, outside the lint rule's `src` scope) and `agent-hub`'s `node-free.test.ts` hold their sources to the same entries. `@effect/vitest` needs Vitest 5, so the specs run effects through each package's own helpers (`src/__test-utils__/` in `agent-hub` and `mcp-server`, `test/mocks/hubLayers.ts` in `vuerd-vscode`).

### Contracts Outside This Repo

| What | Who reads it |
| --- | --- |
| JetBrains Marketplace | the plugin `<id>`, its signing certificate and the listing text from `packages/intellij-plugin/README.md` |
| `dineug/erd-editor-obsidian-plugin` | this repository as a submodule: it releases `packages/obsidian-plugin/dist/` as the assets of a GitHub release tagged with the manifest version, and keeps a copy of the package's `manifest.json` at its root, where Obsidian looks for the latest version. The manifest `id` (`erd-editor`) cannot change once the plugin is in the community directory |
| `json-schema/schema.json` on `main` | the `$schema` of every saved `.erd` / `.vuerd` file: `erd-editor-schema` stamps its raw GitHub URL, so moving or renaming it leaves existing files pointing at a dead URL |
| erd-editor.io's paths `/privacy`, `/terms`, `/gdrive` and `/api/auth/callback` | the Google Cloud console, set by hand: the OAuth consent screen and the Workspace Marketplace listing link the two policy pages, Drive's Open with and New open `/gdrive`, and the production web client registers the callback as its one redirect URI (`http://localhost:5175/api/auth/callback` belongs to a separate client in a Testing project); moving one, or asking for another scope than `packages/app/src/server/auth/contract.ts` lists, is a console change first |

Publishing — JetBrains, the VS Code Marketplace (`dineug.vuerd-vscode`), npm (`@dineug/erd-editor`, `@dineug/erd-editor-mcp`), Obsidian (a release of `dineug/erd-editor-obsidian-plugin`) — is manual: no token or key is in the repository and no workflow uploads anything. So are the Google Workspace Marketplace listing (its assets in `packages/app/google-workspace/`) and the Pages variables the relay reads (`GOOGLE_CLIENT_SECRET`, `COOKIE_KEY`, `VITE_GOOGLE_CLIENT_ID`).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
