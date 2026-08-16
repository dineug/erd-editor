<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# erd-editor (monorepo root)

## Purpose

`@dineug/erd-editor-monorepo` is a pnpm + Vite+ workspace that builds an Entity-Relationship Diagram editor
and ships it through four surfaces: a web app ([erd-editor.io](https://erd-editor.io)), a VSCode
extension, an IntelliJ plugin webview, and a standalone `<erd-editor>` custom element published to npm.

The editor core is a framework-free web component built on the in-house `@dineug/r-html` tagged-template
framework. State lives in a Redux-like store whose actions are versioned by a Lamport-style clock and
merged with an LWW (last-write-wins) register set, which is what makes real-time collaboration,
cross-tab sync, and undo/redo share one mechanism.

## Key Files

| File                        | Description                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`            | **Canonical tool config for the whole repo** — `lint` (oxlint), `fmt` (oxfmt) and `staged`. ⚠️ A package's own `lint`/`fmt` block is ignored; the root wins, so rules written there silently do nothing |
| `package.json`              | Workspace root; `build`/`test` delegate to `vp run -r`, plus `lint`, `format`, `check`, `cache:clear`. Pins pnpm via `packageManager`                   |
| `pnpm-workspace.yaml`       | `packages/*` glob, plus the `catalog` that aliases `vite` to `@voidzero-dev/vite-plus-core` and the `overrides` pinning `typescript` to `7.0.2`         |
| `tsconfig.app.json`         | Base TS config every package extends (ES2020, strict, bundler resolution)                                                                               |
| `tsconfig.json`             | Typechecks the 15 config files, which belong to no package program. Without it a typo in a `run.tasks` block is accepted silently                       |
| `build-target.ts`           | The single browser floor the published libraries and the app compile against                                                                            |
| `scripts/check-task-inputs.mjs` | Fails `pnpm check` when a package gains a workspace dependency without the matching `input` glob — the one thing the config type gate cannot see    |
| `commitlint.config.js`      | Conventional Commits rules (ESM — the root is `"type": "module"`). Kept because Vite+ has no commit-message linting                                     |
| `.vite-hooks/`              | `pre-commit` runs `vp staged`, `commit-msg` runs commitlint. Both are committed; only the generated `_/` dispatcher is ignored                          |
| `.nvmrc` / `.node-version`  | Node 22.23.2, both files, same content. ⚠️ `.nvmrc` is read by `erd-editor-intellij-plugin`'s workflows — deleting it breaks that repo's release        |
| `.editorconfig`             | Editor defaults shared with oxfmt (LF, 2-space indent)                                                                                                  |
| `erd-editor.code-workspace` | Multi-root VSCode workspace mapping each package                                                                                                        |
| `json-schema/schema.json`   | Public JSON Schema for `.erd` / `.vuerd` document files                                                                                                 |

## Subdirectories

| Directory      | Purpose                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/`    | All 13 workspace packages (see `packages/*/AGENTS.md`)                                                                                                 |
| `data/`        | Sample SQL dumps (`sakila.sql`, `OKKY.sql`, `GNUBOARD5.sql`, `YOUNGCART5.sql`, `Magento2-sales.sql`) and `test.json` used to exercise the SQL importer |
| `docker/`      | Per-vendor `docker-compose.yml` files (MySQL, MariaDB, MSSQL, Oracle, PostgreSQL, SQLite) for validating generated DDL                                 |
| `json-schema/` | JSON Schema definition for the persisted document format                                                                                               |
| `img/`         | Screenshots and marketing assets referenced by READMEs (plus `img/icons/`)                                                                             |
| `.github/`     | `workflows/ci.yml` (five jobs — see Testing Requirements), the `setup-workspace` composite action, and two issue templates                             |
| `.vite-hooks/` | Git hooks — `pre-commit` runs `vp staged` (`vp check --fix` on `**/*.{ts,mts,tsx}`), `commit-msg` runs commitlint                                      |

## Package Map

Build order is derived by Vite Task from workspace dependencies. Leaves first:

```
shared ──┬─────────────────────────────────────────────┐
         ├── erd-editor-schema ──┐                     │
r-html ──┼── erd-editor ─────────┤                     ├── app
schema-sql-parser ───────────────┤                     │
erd-editor-shiki-worker ─────────┤                     │
vite-plugin-r-html (build-time) ─┘                     │
                                                       │
shared ── vscode-bridge ──┬── vscode-replication-store-worker ──┐
                          ├── vscode-webview ───────────────────┼── vscode-extension
                          └── intellij-webview                  ┘
```

| Package                                    | npm name                                             | Kind                                                                    |
| ------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/shared`                          | `@dineug/shared`                                     | Library — type guards, array/number utils, nanoid                       |
| `packages/r-html`                          | `@dineug/r-html`                                     | Library — tagged-template rendering framework + store                   |
| `packages/vite-plugin-r-html`              | `@dineug/vite-plugin-r-html`                         | Build tool — HMR plugin for r-html components                           |
| `packages/schema-sql-parser`               | `@dineug/schema-sql-parser`                          | Library — permissive DDL parser                                         |
| `packages/erd-editor-schema`               | `@dineug/erd-editor-schema`                          | Library — v2/v3 document schema, parsing, LWW query                     |
| `packages/erd-editor-shiki-worker`         | `@dineug/erd-editor-shiki-worker`                    | Worker — syntax highlighting off the main thread (published, v0.1.2)    |
| `packages/erd-editor`                      | `@dineug/erd-editor`                                 | **Editor core** — the `<erd-editor>` custom element (published, v3.3.1) |
| `packages/vscode-bridge`                   | `@dineug/erd-editor-vscode-bridge`                   | Library — command protocol between host and webview                     |
| `packages/vscode-replication-store-worker` | `@dineug/erd-editor-vscode-replication-store-worker` | Worker — headless store replica for the VSCode host                     |
| `packages/vscode-webview`                  | `@dineug/erd-editor-vscode-webview`                  | App — webview bundle loaded by the VSCode extension                     |
| `packages/vscode-extension`                | `vuerd-vscode`                                       | App — the published VSCode extension (v2.2.0)                           |
| `packages/intellij-webview`                | `@dineug/erd-editor-intellij-webview`                | App — webview bundle for the IntelliJ plugin                            |
| `packages/app`                             | `@dineug/erd-editor-app`                             | App — the React PWA at erd-editor.io                                    |

## For AI Agents

### Working In This Directory

- **Package manager is pnpm.** Never run `npm install` or `yarn`; cross-package deps use `workspace:*`.
- **Know which command surface you are on.** A name lives in `run.tasks` or in `package.json`
  scripts, never both — declaring both makes the task graph fail to load.

  | Target | Invocation |
  | --- | --- |
  | a `run.tasks` task (`build`, `test`, `build:webview`) | `vp run --filter <pkg> --fail-if-no-match <task>`, or `vp run -r <task>` for all |
  | a `package.json` script (`e2e`, `typecheck`, `test:coverage`, `dev`) | `pnpm --filter <pkg> <script>` |

  ⚠️ **`pnpm --filter <pkg> build` and `… test` no longer exist.** Those names are tasks now.
  ⚠️ **Flags go before the task name.** `vp run build -r` passes `-r` to the task, builds a single
  package and exits 0.
  ⚠️ **`vp build` and `vp test` are built-ins that ignore `run.tasks`** — they skip the
  `tsc --noEmit` gate and `dependsOn` entirely. CI and docs use `vp run`.
  ⚠️ **A `--filter` matching no package exits 0**, printing a line nobody reads. Always pass
  `--fail-if-no-match`, or renaming a package leaves the job green while it builds nothing.
- **One bundler.** Every package builds with Vite (Rolldown). The nine libraries use library mode
  plus `vite-plugin-dts`; the four app-shaped packages (`app`, `intellij-webview`, `vscode-webview`,
  `vscode-extension`) build an entry from their own `vite.config.ts`. Match the neighbouring package
  when adding config.
- **One TypeScript.** `7.0.2` everywhere, pinned by `overrides` in `pnpm-workspace.yaml`. ⚠️ TS7's
  `tsc` is a Go native binary, so Vite Task cannot observe which files it reads — every task
  declares its `input` explicitly. **Change a tsconfig `include` and the matching `input` has to
  change too**; only the workspace-dependency half of that is machine-enforced, by
  `scripts/check-task-inputs.mjs`.
- **Config file extensions are mostly historical.** `vitest.config.mts` in `app` and
  `vscode-extension`, and `vite.config.mts` in `vite-plugin-r-html`, date from a rule that no longer
  holds: four CommonJS packages (`app`, `intellij-webview`, `vscode-webview`, `vscode-extension`)
  load a plain `vite.config.ts` without trouble. Prefer `.ts` for new configs. ⚠️ Renaming an
  existing one means updating the root `tsconfig.json` `include`, which lists both extensions.
- **Path alias `@/*` → `<package>/src/*`** in every package. It is declared twice per package —
  `tsconfig.json` `paths` and `vite.config.ts` `resolve.alias`. Adding a new alias means touching
  both, and a package with a Vitest suite needs it in `vitest.config.ts` as well.
- Cross-package imports must use the published package name (`@dineug/shared`), never a relative
  path into a sibling package's `src/`.

### Contracts Outside This Repo

Four things here are read by something that does not live in this repository. Changing them breaks
a build you will not see fail.

| What | Who reads it |
| --- | --- |
| `.nvmrc` | `erd-editor-intellij-plugin`'s `build.yml` and `release.yml`, as `node-version-file: erd-editor/.nvmrc`. `.node-version` exists for Vite+; both must stay and must agree |
| `pnpm-lock.yaml` format | the same workflows, via `cache-dependency-path`. ⚠️ They install **pnpm 10**. A lockfile written by pnpm 11 — which grows a second YAML document for `packageManagerDependencies` — is unreadable there, which is why `packageManager` pins 10.34.3 |
| `intellij-webview`'s `build:webview` | that repo's CI. It writes into its `src/main/resources/assets`, so `emptyOutDir` clears a directory in another checkout, and the task is `cache: false` because a cache hit cannot restore files Vite Task never archived |
| `app`'s `dist/` | the erd-editor.io deploy, configured in an external dashboard rather than in this repo |

⚠️ The plugin repo consumes this one as a **pinned git submodule**, so none of the above breaks the
moment something lands on `main` — it breaks when someone advances that pointer. That commit is the
place to check them, and it is also the only place an IntelliJ regression can be caught, since
nothing here launches the IDE.

### Where The Gates Are Not

Recording these because "no test failed" is not the same as "this is covered".

- **`app`'s e2e has no CI job.** Eight specs covering live collaboration across two browser
  contexts, run by hand only. It is also the only thing that exercises the crypto round-trip and
  the service worker's cache routes end to end.
- **Seven of eight coverage thresholds never run.** Only r-html's `test:coverage` is in CI; the
  other seven `perFile: 80%` blocks are declarations.
- **Lint sees `**/src/**` and nothing else.** e2e specs, every config file, and
  `vscode-extension/test/**` are outside it.
- **`vuerd-vscode`'s type gate is `tsconfig.unit.json`**, which uses `module: esnext`. The CommonJS
  semantics its `out/` build actually emits under (TS1343 and friends) are not checked.
- **Nothing renders either webview.** The Extension Host suite asserts commands and editor
  resolution, but its harness blocks the webview document request, so a panel that fails to load
  its bundle still passes.

### Testing Requirements

- `pnpm test` runs `vp run -r test`. Eight packages define a Vitest `test` task — `shared`,
  `r-html`, `schema-sql-parser`, `erd-editor-schema`, `erd-editor`, `vscode-bridge`, `app`, and
  `vscode-extension`; the rest no-op. New tests belong next to the source as `*.test.ts`, and each
  package carries its own `vitest.config.ts` (`.mts` in `app` and `vscode-extension`, whose
  `package.json` files are CommonJS).
- The eight configs are deliberately uniform: `include: ['src/**/*.test.ts']`, the `@` → `src` alias
  repeated from `tsconfig.json`, and a v8 coverage block with `perFile: true` at **80% lines /
  functions / branches / statements**. A test placed outside `src/` will not be collected. The
  thresholds gate `pnpm --filter <pkg> test:coverage` only — plain `test` (and therefore CI) does not
  enforce them, so check coverage explicitly when adding a module. ⚠️ Only r-html's `test:coverage`
  actually runs in CI; the other seven thresholds are declarations nothing exercises.
- Each `test` task runs `tsc --noEmit` before Vitest, so the suite and the type gate go red
  together. ⚠️ `pnpm --filter <pkg> test:coverage` and `test:dev` call the built-in `vp test`, which
  does **not** take that gate or `dependsOn` — they are for iterating, not for proving a change.
- `environment` splits along what the code touches: `happy-dom` for `r-html`, `erd-editor` and `app`;
  `node` for the rest. Only `erd-editor` and `app` need a `vitest.setup.ts`.
- `vscode-extension` is the one package whose unit suite needs a module that does not exist outside
  its host: `vitest.config.mts` aliases the `vscode` specifier to the stub in
  `packages/vscode-extension/test/mocks/vscode.ts`. Types still come from `@types/vscode`.
- Four packages carry an out-of-process suite under `packages/<pkg>/e2e/` or `test/integration/`,
  none of which run in `pnpm test` — invoke them with `pnpm --filter <pkg> e2e`:
  - `erd-editor` — Playwright, the custom element against the Vite dev server
  - `app` — Playwright, live collaboration across two browser contexts
  - `r-html` — Playwright, the CSS pipeline against a real CSSOM and a real cascade. The one suite
    here that needs **no** prior build: its Vite dev server serves r-html's own `src/` through the
    `@` alias. It exists because happy-dom has no style engine, so the unit suite can assert what is
    in an array but never which rule wins — see `packages/r-html/e2e/README.md`
  - `vscode-extension` — `@vscode/test-cli`, Mocha specs inside a real Extension Host. The script
    builds the extension and compiles `tsconfig.integration.json` to `out/` first, because the host
    loads `dist/extension.js` and `public/index.html`. On Linux it needs a display: `xvfb-run -a`.
- CI (`.github/workflows/ci.yml`) runs five independent jobs on `push`, `pull_request` and
  `workflow_dispatch`, each on `ubuntu-latest` through the `setup-workspace` composite action —
  which takes pnpm from `packageManager` and Node from `.nvmrc`, and caches only the pnpm store.
  ⚠️ Vite Task's cache is deliberately not carried between runs: a cold cache is what makes the
  `input` declarations do real work, and a warm one lets a wrong declaration replay a green result
  it did not earn.

  - `check` — `pnpm check` (`vp check`, the root `tsc --noEmit`, and the task-input sync script),
    then the `app` and `vuerd-vscode` typechecks and the `app` e2e typecheck. Those three have no
    other home: `app`'s e2e specs and `playwright.config.ts` sit outside every package program.
  - `ci` — `pnpm test`, then `pnpm --filter @dineug/r-html test:coverage`, then `pnpm build`
  - `e2e` — installs Chromium, builds `@dineug/erd-editor` (the dev server and the e2e typecheck
    both resolve workspace deps through their `dist/`), then `e2e:typecheck` and the Playwright
    suite. The report upload needs `include-hidden-files: true` because the output lands in the
    dot-prefixed `e2e/.report`.
  - `r-html-e2e` — installs Chromium, then `e2e:typecheck` and the Playwright suite. No build step:
    nothing it touches resolves through `dist/`. Separate from `e2e` for the browser download, and
    so a build-free suite does not queue behind a build. The `app` e2e suite is still not in CI.
  - `vscode-extension-e2e` — builds `vuerd-vscode`, then the Extension Host suite under
    `xvfb-run -a`. `.vscode-test.mjs` declares a two-version matrix (stable plus the `engines.vscode`
    floor), so the job downloads two VSCode builds; `VSCODE_TEST_USER_DATA_DIR` keeps each profile's
    IPC socket under the unix path limit.

- **A change is not verified until `pnpm build` passes** — each `build` task runs `tsc --noEmit`
  before the bundler, so a green `pnpm test` alone proves nothing about the types of what ships.
- `pnpm check` is the style and type gate: `vp check` (oxfmt + oxlint in one pass), the root
  `tsc --noEmit` over the config files, and `scripts/check-task-inputs.mjs`. `pnpm format` writes.
  ⚠️ oxlint does **not** read `.gitignore`; its ignore list is spelled out in the root
  `vite.config.ts`, so ignoring a path in git no longer un-lints it.
- ⚠️ **Formatting covers `.{ts,mts,tsx}` and nothing else.** oxfmt handles seventeen languages, and
  the root `fmt.ignorePatterns` closes the rest — Markdown above all, since the fourteen AGENTS.md
  files are hand-maintained and one unscoped run rewrites hundreds of lines of them.
- **Commit messages are linted** by commitlint (Conventional Commits) via `.vite-hooks/commit-msg`.
  `subject-case` is deliberately disabled — this repo capitalizes subjects (`fix: LWW data processing`).
  The hook scripts are committed; only the generated `.vite-hooks/_/` dispatcher is ignored, so a
  fresh clone gets the gate as soon as `pnpm install` has run (`prepare` is `vp config`).
- For SQL-generation changes, `docker/<vendor>/docker-compose.yml` plus the dumps in `data/` are the
  intended manual verification loop.

### Common Patterns

- **Named exports only**, sorted by `simple-import-sort`. Run `pnpm format` before committing or the
  hook will rewrite the diff.
- **Barrel `index.ts` per feature directory**; the package root `src/index.ts` re-exports the public
  surface explicitly (no blanket `export *` at the package boundary except in `shared`).
- Library `package.json` files are ESM-only (`"type": "module"`, `exports` with `types` + `default`)
  and point `main`/`module`/`types` at `dist/`.
- Most `typescript/*` strictness rules are deliberately off in the root `vite.config.ts`
  (`no-explicit-any`, `no-unused-vars`, …). Don't reintroduce them as part of an unrelated change.
- Lint scope is `**/src/**/*.{ts,tsx}`, the same single block the old flat config had. e2e specs,
  config files and `vscode-extension/test/**` are outside it — widening that is its own decision,
  not a side effect.

## Dependencies

### External

- **Vite+ 0.2.9** — one toolchain for tasks, lint, format, test and commit hooks. It bundles
  Vite 8.2.1 / Rolldown 1.2.3 / Vitest 4.1.10 / oxlint 1.77 / oxfmt 0.62; `vp toolchain` is
  canonical for those numbers. ⚠️ Still beta, and the oxlint JS-plugin bridge it carries
  (`simple-import-sort`) is alpha and outside semver
- **pnpm 10** — workspace/package management. ⚠️ `vite` in the catalog is an alias for
  `@voidzero-dev/vite-plus-core`, so there is no `node_modules/.bin/vite`; anything invoking the
  `vite` CLI directly is broken
- **Vitest 4** — the unit suites in all eight testable packages, imported as `vite-plus/test`
- **Playwright** — the `erd-editor`, `r-html` and `app` e2e suites (all pinned to the same `^1.62.1`,
  so one browser download serves them all); **`@vscode/test-cli` + `@vscode/test-electron`**
  — the `vscode-extension` Extension Host suite
- **Storybook 10** (`@storybook/html-vite`) — component workbench in `packages/erd-editor`
- **rxjs** — the editor's store/action pipeline (`erd-editor/src/engine/rx-store.ts`,
  `engine/rx-operators/`) and its DOM interaction streams (`utils/rx-operators/`). It replaced the
  in-house `@dineug/go` package, which was deleted from the workspace — nothing should reference it
  any more
- **TypeScript 7.0.2** everywhere, plus **`@typescript/typescript6` 6.0.2** in the nine packages
  that emit declarations — `vite-plugin-dts` still needs the JavaScript compiler API that TS7
  removed. That bridge is what makes `.d.ts` output survive the version jump unchanged
- **React 19** — `app` only. `@radix-ui/themes` had to go to 3.x with it; 2.x refuses React 19
- **`eslint-plugin-simple-import-sort`** — the one ESLint package still installed. oxlint has no
  equivalent rule, so it is bridged through `lint.jsPlugins`. Intended survival, not a leftover
- **commitlint 20** (`@commitlint/cli` + `@commitlint/config-conventional`) — kept because Vite+ has
  no commit-message linting of its own. The v20 pin was a Node constraint (v21 needs Node >= 22.12);
  the `.nvmrc` bump to 22 lifts it, so v21 is now upgradable

### Deliberately Not Upgraded

`app` was brought current alongside the React 19 move, with two exceptions. They are held back on
purpose, so a later sweep that "just updates dependencies" is a regression, not a chore.

| Package | Held at | Why |
| --- | --- | --- |
| `dexie` | `^3.2.7` | **Do not upgrade.** It owns the IndexedDB store holding users' documents; a major there is a data-migration question, not a dependency bump |
| `react-router-dom` | `^6.22.3` | v7 reshapes the data-router APIs this app builds its routes on |

Two rows were retired rather than acted on, and one of them was retired because the reason written
down was false. Recorded here because a wrong "why" survives review by looking like a decision
someone already made.

- `immer` was held because "the LWW merge depends on its produce semantics." It does not. The
  Lamport-clock merge lives in `erd-editor-schema`, which has never depended on immer — `app` is the
  only package that declares it, and the atom whose name suggested otherwise is a session-credential
  registry, not the document. Now at `^11`.
- `@sentry/react` was held because "the init and integration surface changed." The surface did not —
  the same `init({ dsn, integrations, tracesSampleRate })` call compiles and runs unedited at v10.
  Three behaviours under it did change; see `packages/app/AGENTS.md`. Now at `^10`.

`jotai/utils`'s `loadable` also warns about removal in v3. `unwrap` is not a rename — `Viewer.tsx`
branches on the `hasError` state that `unwrap` does not surface — so that one needs a decision about
the error path, not a substitution.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
