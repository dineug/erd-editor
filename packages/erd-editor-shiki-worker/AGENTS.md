<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# erd-editor-shiki-worker (`@dineug/erd-editor-shiki-worker`)

## Purpose

Moves [Shiki](https://shiki.style) syntax highlighting off the main thread. Shiki loads WASM plus
grammar and theme JSON, which is far too heavy to run inline while the diagram canvas is animating —
so the editor lazily imports this package, which spins up a worker and exposes a Comlink-proxied
`ShikiService`.

Used to highlight generated output in the editor's **Schema SQL** and **Generator Code** panels.

This is one of only two publicly published packages (alongside `@dineug/erd-editor`); `files` is
`["dist"]`, which `npm pack` resolves to nine entries — the one bundle, five `.d.ts` files, plus
`LICENSE`, `README.md` and `package.json`.

## Key Files

| File                                  | Description                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/index.ts`                        | Public surface — `getShikiService` and the `ShikiService` type                                 |
| `src/services/index.ts`               | Spawns the shared worker and wraps its port with Comlink                                       |
| `src/services/shikiService.ts`        | The service implementation and its interface — the contract exposed across the worker boundary |
| `src/services/shiki.worker.ts`        | Dedicated `Worker` entry — a fallback, commented out in `services/index.ts`                    |
| `src/services/shiki.shared-worker.ts` | `SharedWorker` entry — one highlighter shared by several editor instances/tabs                 |
| `src/vite-env.d.ts`                   | Vite worker/asset ambient types                                                                |
| `vite.config.ts`                      | The `run.tasks` `build` task, the `es` lib build, `__APP_VERSION__`, `dts()`                   |
| `tsconfig.json`                       | Adds `WebWorker` to `lib` — the two worker entries need it to typecheck                        |

## For AI Agents

### Working In This Directory

- **The service is consumed through Comlink**, so everything crossing the boundary must be structured-
  cloneable or a Comlink proxy. Returning a class instance, a function, or a DOM node from
  `shikiService.ts` will fail at runtime, not at build time.
- **Two worker entries are maintained in parallel, but only the shared one is wired up.**
  `getShikiService` constructs `ShikiSharedWorker` and `Comlink.wrap`s its `port`; the dedicated-worker
  fallback in the `catch` block is commented out, so a host without `SharedWorker` currently logs the
  error and returns `null`. Keep the two entries exposing the same API — re-enabling the fallback should
  stay a two-line change.
- Consumers do not import the service directly — they register it:
  `setGetShikiServiceCallback(getShikiService)` from `@dineug/erd-editor`, always behind a dynamic
  `import()` so the Shiki payload stays out of the initial bundle. Preserve that lazy boundary.
- **Shiki is pinned to `0.14.7`.** Shiki 1.x renamed the API (`getHighlighter` → `createHighlighter`,
  different theme/lang loading). Upgrading is a real migration, not a version bump.
- Grammars and themes are the bundle-size driver — load only the languages the editor actually renders.
- **The `build` task carries the type gate.** `run.tasks.build` in `vite.config.ts` is
  `['tsc --noEmit', 'vp build']`; rolldown only transpiles, so without that first command a type error
  in `src/` ships. It replaces `@rollup/plugin-typescript`, which ran here with `noEmitOnError` +
  `noForceEmit` and so emitted nothing — it was a diagnostic wearing a bundler plugin's clothes.
  ⚠️ Invoking `vp build` yourself is the built-in command and ignores `run.tasks` altogether: no
  typecheck, no `dependsOn`, and a bundle that looks exactly like a good one.
- **The task's `input` list is written by hand, and `tsconfig.json` `include` is coupled to it.**
  TypeScript 7's `tsc` is a Go binary, so Vite Task cannot observe which files it read; the globs
  (`src/**`, `package.json`, `tsconfig.json`, and the workspace `tsconfig.app.json`) are the only
  reason a source edit invalidates the cached typecheck. ⚠️ Widen the tsconfig `include` without
  widening `input` and nothing fails — the gate replays a cache hit and reports green over source it
  never read. `scripts/check-task-inputs.mjs` only enforces the workspace-dependency half of that
  list, and this package is a leaf, so it has nothing to check here. `output: ['dist/**']` matters for
  the same reason in reverse: drop it and a cache hit replays the log without restoring `dist/`.
- **`build.target` is not a local decision.** It imports `BROWSER_TARGET` from the root
  `build-target.ts` (chrome87 / edge88 / firefox78 / safari14.1) — the single floor every published
  library in this repo builds against, so raising it here would raise it for everything downstream.

### Testing Requirements

- **No `test` task.** `run.tasks` declares `build` and nothing else, so `pnpm test` (`vp run -r test`)
  walks straight past this package. Verify with the build:
  `pnpm exec vp run --filter @dineug/erd-editor-shiki-worker --fail-if-no-match build`.
  ⚠️ `pnpm --filter @dineug/erd-editor-shiki-worker build` no longer exists — `scripts` is `{}`, because
  a task name can live in `vite.config.ts` or in `package.json`, not both. ⚠️ Keep `--fail-if-no-match`:
  a filter that matches no package exits 0 and builds nothing (measured), so a mistyped package name
  reads as a pass.
- `pnpm check` is the only thing that typechecks this package's `vite.config.ts` — the root
  `tsconfig.json` program covers every `packages/*/vite.config.ts`, and no package program does. A typo
  inside the `run.tasks` block (`from: ['devDependencie']`, `input: ['scr/**']`) is a TS2769 there and
  silently accepted everywhere else.
- Behavioural check: run the editor (`pnpm --filter @dineug/erd-editor dev`) and open the Schema SQL
  and Generator Code panels — highlighted output means the worker resolved. Do **not** expect a
  separate worker chunk: `?sharedworker&inline` embeds it, so a correct build is the single
  `dist/erd-editor-shiki-worker.js` (1,306 kB, gzip 326 kB) plus the `.d.ts` files.
- Worth verifying in more than one host: the web app, the VSCode webview, and the IntelliJ webview all
  consume this package under different worker/CSP constraints.

### Common Patterns

- Worker entries are referenced through Vite's import suffixes —
  `import ShikiSharedWorker from './shiki.shared-worker?sharedworker&inline'`. `&inline` is deliberate:
  the worker source ends up as a string in the bundle and is handed to `new SharedWorker()` as a
  `data:text/javascript` URI, so a consumer that re-bundles this package never has to resolve a second
  asset URL under a webview CSP. Both webviews used to re-bundle it with webpack and now do it with
  Vite; the constraint did not move. Shiki's Oniguruma WASM rides along the same way — lib mode inlines
  `shiki/dist/onig.wasm?url` as a `data:application/wasm;base64` literal, 622 kB of the 1,306 kB bundle.
- The shared worker is named `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}` (`__APP_VERSION__`
  is `define`d from `package.json` in `vite.config.ts`) — a `SharedWorker` is keyed by name, so the
  version stamp is what stops two editor versions from sharing one stale highlighter.
- ESM-only output; single `es` format.

## Dependencies

### Internal

None — leaf package. Its `run.tasks.build` still names `dependsOn` across all three manifest fields,
matching every other package: the workspace edges in this repo live in `devDependencies` only, and a
default `dependencies`-scoped graph comes out empty rather than failing.

### External

- `shiki@0.14.7` — highlighting engine (pinned)
- `comlink@4.4.1` — worker RPC. `erd-editor` pins the same `4.4.1`; `app` is on `^4.4.2`.
  `vscode-webview` and `intellij-webview` consume this package without depending on comlink at all,
  since it is inlined here
- `typescript@7.0.2` (workspace-wide, pinned by `pnpm-workspace.yaml` `overrides`) plus
  `@typescript/typescript6@6.0.2` — the `tsc --noEmit` gate runs on TS7, while `vite-plugin-dts@^5`
  still reaches for the JS Compiler API that TS7 removed, so both compilers are installed here

### Consumers

`@dineug/erd-editor-app`, `@dineug/erd-editor-vscode-webview`, `@dineug/erd-editor-intellij-webview` —
each registers it into `@dineug/erd-editor` via `setGetShikiServiceCallback`. `@dineug/erd-editor`
itself depends on it too, but only through `src/index.dev.ts`, which the dev page loads — nothing it
publishes reaches this package.

<!-- MANUAL: -->
