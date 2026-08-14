<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# erd-editor (monorepo root)

## Purpose

`@dineug/erd-editor-monorepo` is a pnpm + Nx workspace that builds an Entity-Relationship Diagram editor
and ships it through four surfaces: a web app ([erd-editor.io](https://erd-editor.io)), a VSCode
extension, an IntelliJ plugin webview, and a standalone `<erd-editor>` custom element published to npm.

The editor core is a framework-free web component built on the in-house `@dineug/r-html` tagged-template
framework. State lives in a Redux-like store whose actions are versioned by a Lamport-style clock and
merged with an LWW (last-write-wins) register set, which is what makes real-time collaboration,
cross-tab sync, and undo/redo share one mechanism.

## Key Files

| File                        | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| `package.json`              | Workspace root; scripts delegate to `nx run-many`                         |
| `pnpm-workspace.yaml`       | Declares `packages/*` as the only workspace glob                          |
| `nx.json`                   | Target defaults — `build`/`test` are cached and `dependsOn: ["^build"]`   |
| `tsconfig.app.json`         | Base TS config every package extends (ES2020, strict, bundler resolution) |
| `eslint.config.js`          | Flat ESLint config; only lints `**/src/**/*.{ts,tsx}`                     |
| `.prettierrc.json`          | Prettier: single quotes, es5 trailing comma, avoid arrow parens, 2 spaces |
| `commitlint.config.js`      | Conventional Commits rules (ESM — the root is `"type": "module"`)         |
| `.nvmrc`                    | Node 22.23.2 (package.json `engines` requires >=22.12.0, per Vite 8)      |
| `erd-editor.code-workspace` | Multi-root VSCode workspace mapping each package                          |
| `json-schema/schema.json`   | Public JSON Schema for `.erd` / `.vuerd` document files                   |

## Subdirectories

| Directory      | Purpose                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/`    | All 13 workspace packages (see `packages/*/AGENTS.md`)                                                                      |
| `data/`        | Sample SQL dumps (`sakila.sql`, `OKKY.sql`, …) and `test.json` used to exercise the SQL importer                            |
| `docker/`      | Per-vendor `docker-compose.yml` files (MySQL, MariaDB, MSSQL, Oracle, PostgreSQL, SQLite) for validating generated DDL      |
| `json-schema/` | JSON Schema definition for the persisted document format                                                                    |
| `img/`         | Screenshots and marketing assets referenced by READMEs                                                                      |
| `.github/`     | CI workflow (`pnpm install` → `pnpm test` → `pnpm build`) and issue templates                                               |
| `.husky/`      | Git hooks — `pre-commit` runs `lint-staged` (eslint --fix + prettier --write on `*.{ts,tsx}`), `commit-msg` runs commitlint |

## Package Map

Build order is derived by Nx from workspace dependencies. Leaves first:

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
| `packages/erd-editor-shiki-worker`         | `@dineug/erd-editor-shiki-worker`                    | Worker — syntax highlighting off the main thread                        |
| `packages/erd-editor`                      | `@dineug/erd-editor`                                 | **Editor core** — the `<erd-editor>` custom element (published, v3.3.1) |
| `packages/vscode-bridge`                   | `@dineug/erd-editor-vscode-bridge`                   | Library — command protocol between host and webview                     |
| `packages/vscode-replication-store-worker` | `@dineug/erd-editor-vscode-replication-store-worker` | Worker — headless store replica for the VSCode host                     |
| `packages/vscode-webview`                  | `@dineug/erd-editor-vscode-webview`                  | App — webview bundle loaded by the VSCode extension                     |
| `packages/vscode-extension`                | `vuerd-vscode`                                       | App — the published VSCode extension (v2.1.1)                           |
| `packages/intellij-webview`                | `@dineug/erd-editor-intellij-webview`                | App — webview bundle for the IntelliJ plugin                            |
| `packages/app`                             | `@dineug/erd-editor-app`                             | App — the React PWA at erd-editor.io                                    |

## For AI Agents

### Working In This Directory

- **Package manager is pnpm.** Never run `npm install` or `yarn`; cross-package deps use `workspace:*`.
- **Always go through Nx for builds.** `pnpm build` = `nx run-many -t build`, which respects
  `dependsOn: ["^build"]`. Building a single package with `pnpm --filter <pkg> build` skips its
  dependencies' builds and will resolve stale `dist/` output.
- **Two toolchains coexist.** Libraries build with Vite (`vite build` + `vite-plugin-dts` +
  `@rollup/plugin-typescript`); app-shaped packages (`app`, `vscode-*`, `intellij-webview`) build
  with webpack + swc/ts-loader. Match the neighbouring package when adding config.
- **Two TypeScript versions coexist.** Library packages pin `5.8.2` (also the root `resolutions`
  value); the webpack-based packages pin `5.4.5`. Don't unify them casually.
- **Path alias `@/*` → `<package>/src/*`** in every package. It is declared three times per package —
  `tsconfig.json` `paths`, the bundler alias (`vite.config.ts` `resolve.alias` or
  `tsconfig-paths-webpack-plugin`), and nothing else. Adding a new alias means touching both.
- Cross-package imports must use the published package name (`@dineug/shared`), never a relative
  path into a sibling package's `src/`.

### Testing Requirements

- `pnpm test` runs `nx run-many -t test`. Eight packages define a Vitest `test` target — `shared`,
  `r-html`, `schema-sql-parser`, `erd-editor-schema`, `erd-editor`, `vscode-bridge`, `app`, and
  `vscode-extension`; the rest no-op. New tests belong next to the source as `*.test.ts`, and each
  package carries its own `vitest.config.ts` (`.mts` in `app` and `vscode-extension`, whose
  `package.json` files are CommonJS).
- `vscode-extension` is the one package whose unit suite needs a module that does not exist outside
  its host: `vitest.config.mts` aliases the `vscode` specifier to the stub in
  `packages/vscode-extension/test/mocks/vscode.ts`. Types still come from `@types/vscode`.
- Three packages carry an out-of-process suite under `packages/<pkg>/e2e/` or `test/integration/`,
  none of which run in `pnpm test` — invoke them with `pnpm --filter <pkg> e2e`:
  - `erd-editor` — Playwright, the custom element against the Vite dev server
  - `app` — Playwright, live collaboration across two browser contexts
  - `vscode-extension` — `@vscode/test-cli`, Mocha specs inside a real Extension Host. The script
    compiles `tsconfig.integration.json` to `out/` first, and the extension must already be built
    (`nx build vuerd-vscode`) because the host loads `dist/extension.js` and `public/index.html`.
    On Linux it needs a display: `xvfb-run -a`.
- CI (`.github/workflows/ci.yml`) has three jobs: `ci` (`pnpm install && pnpm test && pnpm build` on
  Node 22 / pnpm 10), `e2e` (the `erd-editor` Playwright suite), and `vscode-extension-e2e` (the
  Extension Host suite under `xvfb-run`).
  A change is not verified until `pnpm build` passes — type errors surface at build time because
  `@rollup/plugin-typescript` runs with `noEmitOnError: true`.
- `pnpm lint` (`eslint .`) and `pnpm format` are the style gates; `.gitignore` is fed into ESLint via
  `includeIgnoreFile`, so ignoring a path in git also un-lints it.
- **Commit messages are linted** by commitlint (Conventional Commits) via the `commit-msg` hook.
  `subject-case` is deliberately disabled — this repo capitalizes subjects (`fix: LWW data processing`).
  The hooks live in gitignored `.husky/_/`, so they only exist after `pnpm install` has run in that
  working tree; in a fresh clone or a new worktree the checks silently do nothing until then.
- For SQL-generation changes, `docker/<vendor>/docker-compose.yml` plus the dumps in `data/` are the
  intended manual verification loop.

### Common Patterns

- **Named exports only**, sorted by `simple-import-sort`. Run `pnpm format` before committing or the
  hook will rewrite the diff.
- **Barrel `index.ts` per feature directory**; the package root `src/index.ts` re-exports the public
  surface explicitly (no blanket `export *` at the package boundary except in `shared`/`go`).
- Library `package.json` files are ESM-only (`"type": "module"`, `exports` with `types` + `default`)
  and point `main`/`module`/`types` at `dist/`.
- Most `@typescript-eslint` strictness rules are deliberately disabled in `eslint.config.js`
  (`no-explicit-any`, `no-unused-vars`, …). Don't reintroduce them as part of an unrelated change.

## Dependencies

### External

- **Nx 20.5** — task graph and caching
- **pnpm 10** — workspace/package management
- **Vite 8** (Rolldown-based) — library builds; **webpack 5** — application builds
- **Vitest 4** — the `schema-sql-parser` suite
- **Storybook 10** (`@storybook/html-vite`) — component workbench in `packages/erd-editor`
- **TypeScript 5.8.2** (libraries) / **5.4.5** (webpack packages)
- **ESLint 9 flat config**, **Prettier 3**, **husky + lint-staged**
- **commitlint 20** (`@commitlint/cli` + `@commitlint/config-conventional`) — the v20 pin was a Node
  constraint (v21 needs Node >= 22.12); the `.nvmrc` bump to 22 lifts it, so v21 is now upgradable

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
