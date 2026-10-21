<!-- Generated: 2026-08-27 | Updated: 2026-10-11 -->

# erd-editor

## Purpose

`@dineug/erd-editor-monorepo` is a pnpm + Vite+ workspace for ERD Editor, an Entity-Relationship Diagram editor shipped five ways: erd-editor.io, a VS Code extension, an IntelliJ plugin, an Obsidian plugin and the `<erd-editor>` custom element on npm. Its framework-free core is JSX compiled to in-house `@dineug/r-html` tagged templates. Store actions carry a Lamport-style clock and merge through an LWW register set, the one mechanism behind collaboration, cross-tab sync and undo/redo. Through it `@dineug/erd-editor-mcp`, a stdio MCP server also on npm, puts a coding agent into a VS Code, Obsidian or JetBrains IDE session as one more collaborator.

A document has two forms: the storage form (`erd-editor-schema`'s `toDocumentJson`) and the runtime value (`toJson`). `value`, on the element, `ReplicationStore` and `PeerStore`, is the storage form every host writes and compares. `runtimeValue` keeps removed entities: a second view or a joining agent seeds from it and no host writes it, because a peer seeded from the file form brings a removed table back empty when its author undoes the removal.

## Making a Change

1. **Read the `AGENTS.md` of each package the change touches**, and for a change across a package boundary (a hub message, a bridge command, an `engine.js` or `peer.js` export) the file on each side. In `erd-editor`, also read the nested `AGENTS.md` of each `src/` directory touched; the package file lists them. Claude Code loads a subdirectory's `AGENTS.md` when its Read tool opens a file there; other agents may not, and a Bash read does not. Each file holds rules its specs and gates enforce that this file does not repeat.
2. **Write the change with what it carries** (What a change carries, below).
3. **Run each touched package's `test` task**, which the sixteen with a `vitest.config.*` have: `pnpm exec vp run --filter ./packages/<dir> --fail-if-no-match test` builds its workspace dependencies, then runs `tsc --noEmit` and Vitest. `replication-store-worker`, `vscode-webview` and `intellij-webview` have none; step 5's build checks them. A change to what a package hands its siblings (an export, a type, a hub or bridge message) runs `pnpm test`, since they type-check against its `dist/**/*.d.ts`.
4. **Run `pnpm --filter ./packages/<dir> --fail-if-no-match test:coverage`** where shipping source changed in a package with a `test` task: CI fails a file under 80%, and step 3 measures none.
5. **Run `pnpm check`, then `pnpm build`**, the only check of declaration emit, bundling and the three packages with no `test` task. Then run `pnpm peer-graph` and `pnpm size` when `erd-editor`'s output or a library it inlines changed.
6. **Run the checks outside `pnpm test` that the change reaches** (Testing Requirements):
   - the `e2e` of `erd-editor`, `app`, `r-html` or `vuerd-vscode`, for behaviour a user sees there;
   - `ERD_MCP_CONFORMANCE=required ./gradlew check` in `packages/intellij-plugin`, after step 5 built the MCP server, for a change to `intellij-plugin`, `agent-hub`, `agent-hub-host`, `mcp-server` or `webview-bridge` (whose `src/theme.ts` and `src/locale.ts` the Gradle tests read);
   - the docker loop, for generated SQL.
7. **Report what ran**: each command and its exit status; each check left out (the Windows-only cases, the smokes), with the reason and the platform or app it needs; the assumptions; the follow-ups found; what waits for the owner (a version, a CHANGELOG entry, a budget, a fix outside the change).

   ```
   <example>
   Ran, each exit 0: `pnpm exec vp run --filter ./packages/mcp-server --fail-if-no-match test`, `pnpm --filter ./packages/mcp-server --fail-if-no-match test:coverage`, `pnpm check`, `pnpm build`, `ERD_MCP_CONFORMANCE=required ./gradlew check`.
   Not run: `hub-windows` (Windows only; CI runs it).
   Assumed: "group" means a table group. Follow-ups: none.
   For the owner: a CHANGELOG entry for `@dineug/erd-editor-mcp`.
   </example>
   ```

A step is done when its commands exit 0 on a run that exercised the change. Not done:

- A command that failed to start (`vp` not on `PATH`, no Chromium, `ERR_MODULE_NOT_FOUND`): install with `pnpm install --frozen-lockfile` or `pnpm --filter @dineug/erd-editor exec playwright install chromium` and run it again.
- `vp test` in place of step 3, which skips the `tsc --noEmit` gate (`vp check` checks no types).
- A pass replayed from cache after a change that moved dependencies alone (the `tsc` bullet below).
- A size gate past its number (`pnpm size`, `mcp-server`'s `BUNDLE_GZIP_BUDGET`). Its fix is the owner's: report the measured bytes and what added them, and leave the budget as it is.

A change to Markdown alone needs no check, except in three files a build reads: `schema-sql-parser`'s `src/schema_sql_test_case.md`, its spec's fixture, and `intellij-plugin`'s `README.md` and `CHANGELOG.md`, which `./gradlew buildPlugin` turns into the plugin's description and change notes.

## Key Files

| File | Description |
| --- | --- |
| `AGENTS.md` | This file. There is no `CLAUDE.md`: the one that only imported this file was removed in 451277dc, since Claude Code reads `AGENTS.md` itself |
| `vite.config.ts` | The only `lint` / `fmt` / `staged` config; deliberately no `.oxlintrc.json` / `.oxfmtrc.json` |
| `.gitattributes` | `* text=auto eol=lf`: every text file checks out with LF, which the gates need |
| `package.json` | Root scripts (`build`, `test`, `check`, `format`, `lint`, `size`, `peer-graph`, `cache:clear`) |
| `pnpm-workspace.yaml` | `packages/*`, the catalog (`vite` → `@voidzero-dev/vite-plus-core`, Vitest, the exact `effect` / `@effect/platform-node` pin), the overrides, the `storybook>vite-plus` peer rule and the `packageExtensions` entry that makes platform-node's `redis` peer optional, each with its reason in a comment beside it; the `vite` / `vitest` overrides stay bare keys, never the `vite@*` spelling `vp migrate` writes |
| `tsconfig.app.json` | Base every TS package extends (ES2022, strict, bundler resolution) except `vscode-extension`, a Node config |
| `tsconfig.json` | Root program: `tools/`, every package's Vite / Vitest config, which no package program covers, and `functions/`, whose auth handlers it checks without the DOM lib |
| `build-target.ts` | `BROWSER_TARGET` / `BROWSER_TARGET_QUERY`, the one browser floor for every library build and `app` |
| `tools/vite/library-config.ts` | `defineLibraryConfig` (the whole config of twelve library packages, one `src/index.ts` build each; `node: true`, which `agent-hub-host` sets, targets `node22` and keeps every node builtin external, bare and `node:`-prefixed; `jsx: { konvaImportSource }` adds `@dineug/vite-plugin-r-html`'s `rHtml({ jsx, refresh: false })`, resolved from the own dependencies of the package being built, since the root links no workspace package, and loaded through `lazyPlugins`, in `worker.plugins` too with `workers`, since a worker pass inherits no plugin), `createLibraryTasks` (task contract of all thirteen library packages; `erd-editor` uses it alone) |
| `tools/vite/package-metadata.ts` | Task inputs derived from tsconfig files and manifests; `createExternal` (dependencies and peers, plus the builtins it is given) |
| `tools/vite/worker-url.ts`, `same-origin-worker.ts`, `inline-worker.ts` | The worker plugins, tested with the factory in `tools/vite-config.test.ts` |
| `tools/eslint-rules/` | The `local` oxlint plugin, the four comment rules; itself lint-exempt |
| `scripts/check-task-inputs.mjs` | Recomputes library tasks; matches bespoke tasks' `.d.ts` globs to declared deps; pins the 13 / 12 library-config counts a new library must update |
| `scripts/check-bundle-size.mjs` | The `pnpm size` gate |
| `scripts/check-peer-graph.mjs` | The `pnpm peer-graph` gate, walking what `erd-editor`'s `peer.js` reaches in `dist/` the way the size gate walks; `--export <key>` reports another entry's graph and judges nothing |
| `erd-editor.code-workspace` | Multi-root workspace, formatting through `oxc.oxc-vscode` in a release that starts `vp lint --lsp` / `vp fmt --lsp` (1.62.0 does), since Vite+ 1.0 puts no `oxlint` / `oxfmt` in `node_modules/.bin`. It names every package as a folder, so a new package adds one here, a row to the root README's package table and the Package Map, and moves each count this file keeps (the packages, the `vitest.config.*` packages, the library configs) |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `packages/` | The 20 workspace packages, each with its own `AGENTS.md` |
| `data/` | Import fixtures for hand-testing (SQL, GraphQL SDL, DBML, AML v1/v2, `test.json`); `schema-sql-parser`'s tests read `sakila.sql` |
| `docker/` | A `docker-compose.yml` per SQL vendor to run generated DDL; Databricks and Snowflake are cloud-only and have none |
| `functions/` | Cloudflare Pages Functions for erd-editor.io: `api/auth/[[route]].ts` only re-exports `packages/app/src/server/auth/pages.ts` (`packages/app/AGENTS.md`) |
| `json-schema/` | `schema.json` for `.erd` / `.vuerd` documents (see Contracts Outside This Repo). Written by hand: `erd-editor-schema`'s `src/jsonSchema.test.ts` imports it and validates the storage form against it, so an edit here runs that package's `test` task |
| `.github/` | The two workflows, the `setup-workspace` action |
| `.vite-hooks/` | `pre-commit` runs `vp staged`, `commit-msg` runs commitlint; only the generated `_/` is gitignored |

## Package Map

- Build order follows workspace dependencies; the longest chain is `vuerd-vscode` → `vscode-webview` → `webview-client` → `replication-store-worker` → `erd-editor` → `grid` → `r-html-konva` → `r-html`.
- `mcp-server` joins only the tail, at `erd-editor`. It also names `erd-editor-schema`, `r-html` and `uuid` itself, for the parser, the query layer and the serializers, the action types and the relationship id it mints. Its other dependency, `agent-hub`, depends on no workspace package; `effect` is its one peer.
- `r-html-konva` depends on `r-html` alone, with `konva` its one peer, and builds through `vite-plugin-r-html`. `erd-editor` lists it as a devDependency and inlines it.
- `grid` depends on `r-html-konva`, `r-html` and `@chenglou/pretext`, with `konva` its one peer, and builds through `vite-plugin-r-html` too. It names all three in `dependencies`, so its `dist/` keeps them bare. `erd-editor` lists it as a devDependency and its Dictionary tab mounts it, so it ships inlined in `erd-editor`'s `dist/index.js` and UMD build, never in `peer.js` or a worker; that devDependency is the edge that puts it in the chain above.
- `agent-hub-host` depends on `agent-hub` alone, with `effect` and `@effect/platform-node` as its peers. `vuerd-vscode` and `obsidian-plugin` inline both hub packages.
- `intellij-plugin` is Gradle, outside the graph, fed by `intellij-webview`'s build. It re-implements the hub in Kotlin with no build edge to `agent-hub` or `agent-hub-host`, held to them by their conformance corpora (`src/__fixtures__/conformance.json`), which its Gradle tests read, and by a conformance run of `mcp-server`'s build.
- `obsidian-plugin` bundles `erd-editor`, `replication-store-worker`, `webview-bridge`, `agent-hub-host`, `agent-hub`, `effect`, `@effect/platform-node` and `monkey-around` into one `main.js`; only `obsidian` and node builtins stay imports.

| `packages/` | npm name | |
| --- | --- | --- |
| `r-html` | `@dineug/r-html` | tagged-template rendering framework + store |
| `vite-plugin-r-html` | `@dineug/vite-plugin-r-html` | JSX → tagged templates, HMR |
| `r-html-konva` | `@dineug/r-html-konva` | the r-html host that renders into a Konva `Stage`, the one every Konva scene renders through: its ledger, draw gate and `k-*` intrinsics |
| `grid` | `@dineug/grid` | the spreadsheet grid on a Konva canvas, through `r-html-konva`: it holds no data, reads only the cells in view and draws them with one `k-shape` per region |
| `schema-sql-parser` | `@dineug/schema-sql-parser` | permissive DDL parser for SQL import |
| `uuid` | `@dineug/uuid` | UUIDv7 and Uuid25, written here with no dependency: `uuid25()`, the id of every entity the editor creates and every other id it mints. No id has a shape anything may rely on: a document keeps the `nanoid` ids and a v2 file's hyphenated UUIDs it holds, so no parser, tool input or `json-schema/schema.json` pattern checks an id's length or alphabet (`packages/uuid/AGENTS.md`) |
| `erd-editor-schema` | `@dineug/erd-editor-schema` | v2/v3 document schema, parsing, the runtime value and storage form serializers, queries, LWW operators |
| `erd-editor` | `@dineug/erd-editor` | the editor core: `<erd-editor>`, its Konva scene, `engine.js` (`createReplicationStore`) and `peer.js` (`createPeerStore` and the catalog barrels `mcp-server` builds its tools from) |
| `webview-bridge` | `@dineug/erd-editor-webview-bridge` | `Bridge`, the typed host↔webview command protocol |
| `agent-hub` | `@dineug/erd-editor-agent-hub` | the editor window ↔ coding-agent hub protocol as an effect `Schema` spec |
| `agent-hub-host` | `@dineug/erd-editor-agent-hub-host` | the editor window's side of that hub on Node, which `vuerd-vscode` and `obsidian-plugin` build their document sides on |
| `webview-client` | `@dineug/erd-editor-webview-client` | `mountWebview(host)`, all host wiring both webviews share |
| `replication-store-worker` | `@dineug/erd-editor-replication-store-worker` | headless replica that `webview-client` and `obsidian-plugin`'s `ErdView` spawn |
| `vscode-webview` | `@dineug/erd-editor-vscode-webview` | VS Code webview bundle |
| `vscode-extension` | `vuerd-vscode` | VS Code extension host and the hub's document side, on `agent-hub-host` |
| `intellij-webview` | `@dineug/erd-editor-intellij-webview` | IntelliJ webview bundle, over `window.cefQuery` |
| `intellij-plugin` | `@dineug/erd-editor-intellij-plugin` | Kotlin/Gradle plugin and the hub's document side in Kotlin: one hub for every project an IDE process has open |
| `obsidian-plugin` | `@dineug/erd-editor-obsidian-plugin` | Obsidian plugin, whose `dist/` is the plugin folder, and a vault window's hub document side, on `agent-hub-host` |
| `app` | `@dineug/erd-editor-app` | React PWA at erd-editor.io, with `/gdrive`, its Google Drive editor, whose OAuth relay is the one Pages Function (`functions/`) |
| `mcp-server` | `@dineug/erd-editor-mcp` | stdio MCP server for coding agents, live through the hub of a VS Code or Obsidian window or a JetBrains IDE, or headless on the file; one ESM file with nothing external but node builtins |

## For AI Agents

### Working In This Directory

- **Use pnpm only.** Cross-package deps are `workspace:*`; import a sibling by package name, never by a relative path into its `src/`.
- **Command surface split.** A name lives in `run.tasks` or in package.json `scripts`, never both.

  | Target | Invocation |
  | --- | --- |
  | task (`build`, `test`) | `pnpm exec vp run --filter <pkg> --fail-if-no-match <task>`, or `pnpm exec vp run -r <task>` |
  | script (`dev`, `e2e`, `typecheck`, `test:coverage`) | `pnpm --filter <pkg> <script>` |
  | Gradle (`intellij-plugin`) | `cd packages/intellij-plugin && ./gradlew <task>` |

  - `<pkg>` is an npm name (`@dineug/erd-editor-mcp`) or a folder as `./packages/mcp-server`, not the bare folder names this file uses. A filter matching nothing runs nothing and exits 0 without `--fail-if-no-match`.
  - `vp` is the workspace's `node_modules/.bin/vp`, on `PATH` in package scripts and git hooks but not in a shell without a global Vite+, where a bare `vp …` fails to start.
  - Flags go before the task: `vp run build -r` forwards `-r` to the task.
  - `vp build` / `vp test` are built-ins that skip `run.tasks`, the `tsc --noEmit` gate and `dependsOn`. There is no `vite` binary.
- **Read the installed toolchain, not remembered APIs.** Vite+ 1.0, Vitest 5, TypeScript 7 and effect 4.0.0 postdate most training data and moved APIs: effect 4.0.0 has no `Effect.catchAll` or `Context.Tag`; this repository writes `Effect.catch` and `Context.Service`. Read what `pnpm install` put on disk: `node_modules/vite-plus/docs/`, and effect's `AGENTS.md`, `ai-docs/` and `src/` (`packages/agent-hub/node_modules/effect/`). Where a bundled guide disagrees, this file holds: vite-plus's checklist counts `vp check` and `vp test` as type checks, and here neither is one.
- **TypeScript 7.0.2's native `tsc` is invisible to Vite Task**, reads and writes alike, so every task declares `cache.input`.
  - Library packages derive it in `package-metadata.ts`, and `check-task-inputs.mjs` recomputes it. App tasks list their own, and the check only matches their sibling `dist/**/*.d.ts` globs to declared deps.
  - Neither names `pnpm-lock.yaml` or `pnpm-workspace.yaml`, and a `catalog:` bump changes no `package.json`. After a change that moves dependencies alone, run `pnpm cache:clear` first, or a `tsc --noEmit` gate can replay its cached pass over new type errors; CI's cold cache never meets this.
  - Without `cache.output` a cache hit restores what the traced commands wrote, never what `tsc` wrote; `output: []` restores nothing.
  - `@typescript/typescript6` serves `vite-plugin-dts` and the compiler API three `erd-editor` specs use: `coordinateAuthority.test.ts` and `sceneSvg.attributes.test.ts` parse sources with it, and `jsonShape.test.ts` reads identifiers with its scanner.
- **Library builds.** Eleven private libraries (`r-html`, `vite-plugin-r-html`, `r-html-konva`, `grid`, `schema-sql-parser`, `uuid`, `erd-editor-schema`, `webview-bridge`, `webview-client`, `agent-hub`, `agent-hub-host`) build `minify: false` + `preserveModules: true` with `sideEffects: false`, so the consumer prunes per file and minifies once. `agent-hub-host` alone sets `node: true`, since a browser build resolves its node builtins to an empty stub with only a warning. `erd-editor` keeps chunks and no `sideEffects` field (its `AGENTS.md` says why).
- **Browser floor.** A library's shipping code calls no built-in newer than `BROWSER_TARGET` (`build-target.ts`; `chrome91` is its lowest, which lacks `Array.prototype.at` and `Object.hasOwn`). Rolldown lowers syntax but polyfills no runtime API, and `lib: ES2022` in `tsconfig.app.json` types those APIs anyway, so nothing fails until a browser on the floor throws. `erd-editor`'s `utils/highlightWords.ts` reads its last range by index for that reason. Only `app` (`@vitejs/plugin-legacy`) and the two webviews get core-js.
- **Externals decide what ships.** `createExternal` keeps `dependencies` + `peerDependencies` as bare imports and inlines the rest.
  - `erd-editor` lists the private libraries as devDependencies so they inline; in `dependencies`, one would ship an import of a package not on npm.
  - `agent-hub-host` names `agent-hub` in `dependencies`, as `erd-editor-schema` names `uuid`, which `erd-editor` and `mcp-server` list as a devDependency and inline. The hub libraries' `dist/*.js` and `.d.ts` keep that import and their effect peers bare.
  - Each consumer (`mcp-server`, `vuerd-vscode`, `obsidian-plugin`) lists them as devDependencies, effect's from the same `catalog:` pin, and inlines the one copy it resolves (`ssr.noExternal: true` in the Node bundles), shared with its own effect code. Two copies of `agent-hub` would make two `HubRequestError` classes, and every refusal would answer `internal`.
  - A consumer program that type-checks those `.d.ts` files needs `skipLibCheck`, which `tsconfig.app.json` and the extension's `tsconfig.json` set, since effect's own declarations name types lib ES2022 lacks (`TextDecoderOptions`); `agent-hub-host`'s also need `@types/node`.
- **Workers.** `erd-editor`'s three SharedWorkers and `replication-store-worker`'s replica Worker ship as `dist/workers/*.js` of their own package, spawned from `new URL('./workers/x.js', import.meta.url)`, the spelling `worker-url.ts` writes, which webpack, Rspack and Vite all bundle from a dependency. `vscode-webview` rebuilds them as same-origin blobs (`same-origin-worker.ts`), `intellij-webview` loads them by URL, and the UMD build and `obsidian-plugin` inline them (`inline-worker.ts`).
- **Run `pnpm cache:clear` and rebuild before packaging or publishing.** A cache replay does not empty a task's `cache.output` directory, and an explicit one archives whatever its glob matches as each of the task's commands ends, the `tsc --noEmit` gate too. So a tree that has seen several builds holds stale chunks beside live ones.
- **`@/*` maps to `<package>/src/*`** in every TS package's `tsconfig.json`, mirrored by a Vite alias in the factory and in each Vitest config; a new config needs it too.
- **Formatting covers TypeScript only.** `fmt.ignorePatterns` lists every other extension, since oxfmt does not re-include after a global exclude; that spelling formats nothing and still passes.
- **Keep scratch scripts and notes outside the repository.** oxlint does not read `.gitignore` (its ignore list is in `vite.config.ts`), so `pnpm check` lints a stray file that list misses, as Vitest runs any `src/**/*.test.ts`.
- **Lint scope.** The rule overrides, import sort included, cover `**/src/**/*.{ts,tsx}`; the comment rules are global; type-aware lint is off. Most `typescript/*` strictness rules are off on purpose, and so are the twelve React Compiler rules oxlint 1.85 put in `correctness` (`react/purity`, `react/refs`, …), since they misread `erd-editor`'s r-html hooks and `app` runs no React Compiler. Leave both off in unrelated changes.
- **Comments are lint-enforced** (`tools/eslint-rules/`); move what no longer fits to an `AGENTS.md` or a test. A comment or rule states its reason itself, never a label from a plan outside the tree (the gitignored `.omc/`: `X9`, `D19`), which no reader can follow; the `AC-*` tags in test titles stay.

  - `local/jsdoc-prose-limit`: one prose paragraph, three lines; `@example` / `@tag` lines do not count.
  - `local/comment-run-limit`: three consecutive line comments that open their line; a bare `//` counts.
  - `local/jsdoc-attached`: a JSDoc block sits on a declaration, not an import, re-export or another block, except a tags-only block on an import or re-export.
  - `local/no-comment-markdown`: no emphasis, backticks, fences, tables or lists in comment prose; `@example` exempt.

  `no-comment-markdown --fix` mis-pairs spans containing backticks or `${…}`, so review those hunks. `.github/` YAML keeps the bounds by hand.
- **Measured figures.** A measured figure keeps its current value, date and reason, never a chain of earlier values, which git history holds.
- **What a change carries**: its specs, enough to keep each touched file at 80%, and an edit to every `AGENTS.md` line it makes false.
  - Report a pre-existing bug, performance concern or behaviour the task does not mention as a follow-up rather than fix it in the change, unless the requested behaviour cannot work without it. Implement an ambiguous task in the reading its wording and the surrounding code support, and state the assumption in the report.
  - Commit no scratch script or quick check. Add tests only where the task asks or the repository keeps tests for that kind of change, sized like the neighbouring specs.
  - A version, a CHANGELOG entry, a new size budget (`pnpm size`'s or `mcp-server`'s `BUNDLE_GZIP_BUDGET`) and a fix outside the change wait for the owner; name the one that looks due in the report.
  - Every published version stays as `main` has it (the `version` of `@dineug/erd-editor`, `@dineug/erd-editor-mcp` and `vuerd-vscode`, the Obsidian `manifest.json` and `versions.json`, IntelliJ's `pluginVersion`), and IntelliJ's `## [Unreleased]` heading stays empty. The release procedure writes versions and CHANGELOGs, and a version raised on a branch ships a number no release made.
  - No doc, comment, test title or constant names a released version, or every release would have to edit it: describe the behaviour, and read a version from its manifest (`mcp-server`'s `server.ts` imports its `package.json`). Document-schema, host, toolchain and dependency versions are exempt.
- **Ask the owner before an outbound or irreversible step** the task did not ask for: a publish (`npm publish`, `publish:vsce`, `./gradlew publishPlugin`); a push, tag or release here or in `dineug/erd-editor-obsidian-plugin`; a PR or issue comment; a change to what Contracts Outside This Repo lists. A maintainer's machine can hold the credentials, and a registry refuses a version it has published. In `~/.erd-editor/ide` remove only the files of a process you started; the rest are the owner's open editor windows.
- **Commits follow Conventional Commits**, checked by commitlint with `subject-case` off, since subjects are capitalized; header and body lines are at most 100 characters.
  - Commit through the hooks and fix what they report; `--no-verify`, `VP_GIT_HOOKS=0` and `HUSKY=0` skip them.
  - The hooks live in the generated `.vite-hooks/_/`, which `pnpm install` writes and which puts `node_modules/.bin` on `PATH`, so a fresh clone or worktree runs no hook before its install.
  - `vp staged` hides a partly staged file's unstaged hunks while it runs, so commit such a file only while nothing else edits it.

  ```
  <example>
  fix(erd-editor): Keep a column's comment when a SQL import renames it

  The importer rebuilt the column and dropped the comment.
  </example>
  ```
- **Pull requests.** `main` has no branch protection, so before a merge watch every check of both workflows finish (`gh pr checks <n> --watch`). `Closes #N` closes no GitHub Discussion, where many requests live: name it in the body, and tell the owner after the merge that it is still open.

### Testing Requirements

- **`pnpm test` is `vp run -r test`** over the sixteen `test` tasks of step 3 (a library has one because it has a `vitest.config.*`), with Vitest imported as `vite-plus/test`.
- **Vitest collects `src/**/*.test.ts` only** (`erd-editor`, `r-html-konva` and `grid`: `.test.{ts,tsx}`); a spec named or placed otherwise never runs. The `browser` projects of `erd-editor`, `r-html-konva` and `grid` (`*.browser.test.{ts,tsx}`, real Chromium) make `pnpm test` need Chromium (Making a Change).
- **v8 coverage at `perFile` 80%** on all four metrics gates `test:coverage`; `pnpm test` measures none. CI runs `pnpm -r --no-bail test:coverage`, so a file under 80% in any of the sixteen packages fails it. Each package's `coverage.include` names what it measures. Cover a gap with a test; the one ignore hint in `src/` is `/* v8 ignore next -- @preserve */` on `erd-editor`'s `if (import.meta.hot)` blocks.
- **A failing spec is fixed at its cause.** CI retries `erd-editor`'s browser specs and the Playwright suites twice and a local run never does, so a local failure is real until shown otherwise. Fix the race, wall-clock wait or repeated work rather than add a timeout, a retry or a skip. Show a spec written for a fix failing on the code before it; report a spec that looks wrong, with its output.
- **The hub packages' specs pass on Windows too**: CI's `hub-windows` runs the `test` task of `agent-hub`, `agent-hub-host`, `mcp-server`, `vuerd-vscode` and `obsidian-plugin` on `windows-latest`.
  - **A listener goes through `specPipePath`** (`src/__test-utils__/platform.ts` in `agent-hub-host` and `mcp-server`; `obsidian-plugin`'s `servePeer` and `mcp-server`'s `bin.test.ts` inline it), a named pipe on Windows, where Node listens on nothing else. Never stat a live pipe: a stat connects as a peer.
  - **Gate a case one platform cannot have** with `it.runIf` / `it.skipIf` on `process.platform` and a comment giving the reason; the other platform gets its own form of the check where the product has one (`nodeHub.test.ts`'s errno case). Every gated case so far is `mcp-server`'s, and its `AGENTS.md` names each, but two in `erd-editor`: `src/components/erd/welcome-screen/WelcomeScreen.browser.test.ts`, which off a Mac measures English alone and checks no bound's tightness, and `src/i18n/messages/fit.browser.test.ts`. Both gate on `server.platform` (the Vitest server's `process.platform`), since their bounds hold in the font a Mac resolves the stack to.
  - **Coverage is measured on Linux only**, so every win32 branch in shipping code must stay reachable from a memory spec that passes `win32`.
  - **Locally the symlink specs need Developer Mode or an elevated shell**; the hosted runner is an administrator.
- **The gates want LF files**, which `.gitattributes` gives every checkout whatever `core.autocrlf` says. On the CRLF files Git for Windows writes by default, `vp check` flags every file and two specs that read committed bytes fail (`erd-editor`'s `moduleLayout.test.ts`, `app`'s `server/auth/imports.test.ts`); the hub packages' specs pass either way. A clone made before `.gitattributes` keeps its CRLF files until Git writes them again.
- **`pnpm check`** = `vp check` (oxfmt + oxlint) + root `tsc --noEmit` + `node --test tools/vite-config.test.ts` + `check-task-inputs.mjs`.
- **`pnpm size`**, after `pnpm build`, checks the gzip of every script reachable from `erd-editor`'s `exports` against `packages/erd-editor/.size-baseline.json`. `budgetGzip` is a regression watch whose number the owner sets; it is re-pinned (`--set-budget --budget-gzip <bytes> --budget-note <why>`) only once they accept one. No `AGENTS.md` or README records the measured figure, because every change to the bundle moves it and two branches then conflict on it; `pnpm size` prints it (an owner decision of 2026-10-10).
- **`pnpm peer-graph`**, after `pnpm build`: the scripts `erd-editor`'s `peer.js` reaches must hold no `SharedWorker`, `customElements`, `document.`, `window.` or `navigator.`, and import only `es-toolkit` (and `/compat`), `graphql` and `rxjs`. `erd-editor`'s `src/peer/imports.test.ts` holds the sources to the same two rules in `pnpm test`; change both allowlists together. The gate reads the emitted text, comments included, and Rolldown's `//#region <path>` comments name every module it inlines. So a module `peer.js` reaches fails the gate if its file name starts with `document.`, `window.` or `navigator.`, which is why `erd-editor-schema`'s storage form lives in `storageForm.ts` and not `document.ts`.
- **`pnpm --filter <pkg> e2e`**, outside `pnpm test`, is Playwright for `@dineug/erd-editor`, `@dineug/erd-editor-app` and `@dineug/r-html`; `@vscode/test-cli` for `vuerd-vscode` (`xvfb-run -a` on Linux). Each runs in its own CI job.
- **The two editor smokes**, outside `pnpm test` and CI, drive the built plugin in the real editor and its hub with the built MCP server, so build `@dineug/erd-editor-mcp` first: `pnpm --filter @dineug/erd-editor-obsidian-plugin smoke` (macOS or Windows) and `pnpm --filter @dineug/erd-editor-intellij-plugin smoke` (macOS, after `./gradlew buildWebview`). Each writes a real lock and socket under `~/.erd-editor/ide` and deletes only its own pid's; its package's `AGENTS.md` (Testing Requirements) gives the steps and knobs.
- **A desktop app started to verify a change** (a smoke, or Obsidian, an IDE, VS Code or Chrome driven by hand) keeps the real `HOME`, isolated by its own user data directory, since under another `HOME` macOS shows a keychain dialog on every launch. Stop it by its pid or over CDP, never by app name (`pkill -x Obsidian`), which closes the person's own windows too.
- **`cd packages/intellij-plugin && ./gradlew check`**, outside `pnpm test`, runs the plugin's JUnit 4 specs and the Kotlin hub against `agent-hub`'s and `agent-hub-host`'s conformance corpora under Kover's per-class 80% gate, and, when `packages/mcp-server/dist` exists, the built MCP server against the Kotlin hub (skipped without the build, failed instead under `ERD_MCP_CONFORMANCE=required`). Run it after a change to `agent-hub`, `agent-hub-host`, `mcp-server` or `webview-bridge` too, as `intellij-plugin.yml` does.
- **Windows check of the IntelliJ hub**: `packages/intellij-plugin/AGENTS.md`, Windows Verification (named-pipe hub).
- **SQL-generation changes** have a manual loop, `docker/<vendor>/` plus `data/*.sql`.
- **CI `ci.yml`**: `check` (`pnpm check`, then builds `app`'s and `vuerd-vscode`'s dependencies for their `typecheck` scripts, which read siblings' `dist/**/*.d.ts`, then `app`'s `e2e:typecheck`), `ci` (`pnpm test`, every package's `test:coverage`, `pnpm build`, `pnpm peer-graph`, `pnpm size`), `e2e`, `app-e2e`, `r-html-e2e`, `vscode-extension-e2e`, and `hub-windows` (above; it builds the hub packages' workspace dependencies, the `erd-editor` chain included, and measures no coverage).
- **`intellij-plugin.yml` is separate** so its `cancel-in-progress` never reaches `ci.yml`; a `gate` job stands in for a `paths` filter, which would leave the check Pending forever. Its `build`, `test-windows` and `verify` jobs are in `packages/intellij-plugin/AGENTS.md` (Testing Requirements); `test-windows` is the one CI job where the Kotlin named-pipe hub runs.
- **`setup-workspace` caches the pnpm store, never the Vite Task cache**: a cold cache makes declared inputs do real work.

### Common Patterns

- **`erd-editor` and `grid` are authored in JSX** that `rHtml()` compiles to r-html templates, or under `/** @jsxHost konva */` to the templates of the Konva host, `r-html-konva` (`packages/erd-editor`, `packages/grid`, `packages/r-html-konva`, `packages/vite-plugin-r-html`); `r-html` itself stays tagged-template.
- **Use named exports.** A component module default-exports its component. Import and export order is `simple-import-sort`'s, applied by `vp check --fix` (the pre-commit hook runs it on staged files), so leave the order to it.
- **A barrel `index.ts` per feature directory**; `src/index.ts` is a package's public surface.
- **The product is ERD Editor** in every sentence a person or an agent reads, in every distribution (an owner decision of 2026-09-25): store listings, the VS Code `displayName`, the IntelliJ `<name>`, the Obsidian manifest `name`, erd-editor.io's pages, the MCP server's prose, the console app names. Google's brand review matches the consent screen's name to the home page. Identifiers keep `erd-editor` (packages, `<erd-editor>`, files, setting ids, keys, routes), and a sentence that means the site writes erd-editor.io; `packages/app/AGENTS.md` lists the app's own.
- **A user-visible change reaches every README that describes it**: the root one, with its Korean, Chinese and Japanese translations (`README.ko.md`, `README.zh-CN.md`, `README.ja.md`, which say what `README.md` says and are edited with it), and those of `erd-editor` (npm), `vscode-extension`, `intellij-plugin` (between its `Plugin description` markers) and `obsidian-plugin`, the last three store listings; the Obsidian one reaches the directory only once copied to the release repository's root. A new distribution or listing link also goes into the READMEs of `mcp-server` and `app`. docs.erd-editor.io is another repository, updated once the change is on `main`.

## Dependencies

### External

- **Toolchain.** Vite+ 1.0.0 (`vp`; Vite 8.3.1, Rolldown 1.2.11, oxlint 1.85.0, oxfmt 0.70.0), pnpm 10.34.3, TypeScript 7.0.2 (+ `@typescript/typescript6` 6.0.2), Vitest 5.0.1, Playwright `^1.62.1` everywhere, `@vscode/test-cli`, `eslint-plugin-simple-import-sort`, commitlint 20.
- **Node 22.23.2** (`.nvmrc` = `.node-version`), above two floors:
  - Declared: `engines.node` `>=22.12.0` in the root, `mcp-server`, `agent-hub` and `agent-hub-host`; the extension's is VS Code 1.101, which runs Node 22.15.
  - Needed to work in this repository, which no `engines` field states: 22.22.1 or later on the 22 line, 24.11 or later on the 24, or 26 and up. Vite+ asks for 22.18, and the lint-staged 17 that `vp staged` bundles for the pre-commit hook asks for 22.22.1 and Git 2.32.
- **Editor runtime** (konva, elkjs, shiki, comlink, rxjs, es-toolkit, lucide, `@chenglou/pretext`, es-hangul): `packages/erd-editor/AGENTS.md`. React 19, Radix Themes, `dexie` `^3`: `app` only.
- **`effect` 4.0.0 and `@effect/platform-node` 4.0.0**, both through `catalog:`: the hub libraries' peers (Package Map; platform-node is `agent-hub-host`'s alone), which their consumers inline (Externals).
  - **Bump both together, to one exact release**, never a range, then run `pnpm build`, `pnpm test` and `mcp-server`'s `bin.test.ts`. effect releases every `@effect/*` package at one version, and the group modules used here (`effect/ai`, `effect/socket`) are tagged `@stability unstable`, which allows breaking changes in a minor release.
  - **Import effect from the entries it exports by name**, as its own docs do: `import { Effect, Schema } from 'effect'`, `TestClock` from `'effect/testing'`, and each `effect/<group>` barrel (`McpServer` from `'effect/ai'`, `Socket` from `'effect/socket'`). The release candidates' `effect/unstable/<group>` paths no longer resolve; a module path (`effect/Effect`, `effect/ai/McpServer`) resolves only through the `./*` wildcard. Rolldown still prunes the barrels per module: effect's `sideEffects` lists only `SchemaJITCompiler/enable`.
  - **Import `@effect/platform-node` by module path** (`@effect/platform-node/NodeStdio`). Its barrel re-exports `NodeRedis`, which imports `redis`, the peer `packageExtensions` makes optional and nothing installs, so Node cannot load the barrel (`ERR_MODULE_NOT_FOUND`, which fails every Vitest file that reaches it) and Rolldown cannot resolve it.
  - **Two guards hold these rules.** `no-restricted-imports` in `vite.config.ts` refuses an effect module path, the platform-node barrel, anything below a platform-node module, `@effect/platform-node-shared`, and `effect/schema` / `effect/sql` (where `SchemaJITCompiler` builds decoders with `Function` and `Migrator` loads migrations with a dynamic import). An imports spec in each effect package holds its sources to the same entries: `mcp-server`'s `src/imports.test.ts`, `vuerd-vscode`'s `src/hub/imports.test.ts` (also reading `test/`, outside the lint rule's `src` scope), `agent-hub`'s `node-free.test.ts`, `agent-hub-host`'s `src/imports.test.ts` (also allowing its shipping code nothing but its own modules, those effect entries, six `node:` builtins and `agent-hub`) and `obsidian-plugin`'s `src/hub/imports.test.ts` (also keeping `obsidian` out of `src/hub/` at runtime).
  - **Effect specs run on each package's own thin helpers** (`src/__test-utils__/` in `agent-hub`, `agent-hub-host`, `mcp-server` and `obsidian-plugin`, `test/mocks/hubLayers.ts` in `vuerd-vscode`), not `@effect/vitest`, whose Vitest 5 peer is now met. No package depends on it. Those five imports specs, which read the specs too, refuse every `@effect/*` import but a platform-node module path, which `agent-hub`'s refuses too.

### Contracts Outside This Repo

| What | Who reads it |
| --- | --- |
| JetBrains Marketplace | the plugin `<id>`, its signing certificate and the listing text from `packages/intellij-plugin/README.md` |
| `dineug/erd-editor-obsidian-plugin` | this repository as a submodule. It releases `packages/obsidian-plugin/dist/` as the assets of a GitHub release tagged with the manifest version and keeps a copy of `manifest.json` at its root, where Obsidian looks for the latest version. The manifest `id` (`erd-editor`) cannot change once the plugin is in the community directory. Its `README.md`, the listing, carries the disclosure Obsidian's developer policies require for files outside the vault (the hub's lock and socket under `~/.erd-editor/ide`), so a change to what the hub writes outside the vault, or a network request, updates it |
| `json-schema/schema.json` on `main` | the `$schema` of every saved `.erd` / `.vuerd` file: `erd-editor-schema` stamps its raw GitHub URL, so moving or renaming it leaves existing files pointing at a dead URL. It describes the storage form alone, which a JSON editor that follows `$schema` checks a file against (`packages/erd-editor-schema/AGENTS.md`) |
| erd-editor.io's paths `/privacy`, `/terms`, `/support`, `/gdrive` and `/api/auth/callback` | the Google Cloud console, set by hand. The OAuth consent screen and the Workspace Marketplace listing link the two policy pages, and the listing's Support link opens `/support`. Drive's Open with and New open `/gdrive`. The production web client registers the callback as its one redirect URI; `http://localhost:5175/api/auth/callback` belongs to a separate client in a Testing project. Moving one, or asking for another scope than `packages/app/src/server/auth/contract.ts` lists, is a console change first |
| erd-editor.io's Cloudflare Pages project | its build settings, set by hand: the repository root (root directory empty) builds to `packages/app/dist`, with the root `functions/` as its Functions; moving either is a Pages settings change first |

Publishing is manual for JetBrains, the VS Code Marketplace (`dineug.vuerd-vscode`), npm (`@dineug/erd-editor`, `@dineug/erd-editor-mcp`) and Obsidian (a release of `dineug/erd-editor-obsidian-plugin`): no token or key is in the repository and no workflow publishes anything (their `actions/upload-artifact` steps keep builds and reports as run artifacts only). The Google Workspace Marketplace listing (assets in `packages/app/google-workspace/`) and the Pages variables the relay reads (`GOOGLE_CLIENT_SECRET`, `COOKIE_KEY`, `VITE_GOOGLE_CLIENT_ID`) are manual too. erd-editor.io deploys only when the owner starts it, never on a push: after pushing a site change, say so, and check the live page once they say it ran.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
