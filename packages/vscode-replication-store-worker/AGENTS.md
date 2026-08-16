<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# vscode-replication-store-worker (`@dineug/erd-editor-vscode-replication-store-worker`)

## Purpose

A tiny worker package that runs a **headless replica** of the editor document inside the VSCode
webview, off the main thread.

The problem it solves: the VSCode host must persist the `.erd` file, but serializing the whole
document on every keystroke in the UI thread stalls the canvas. So the webview forwards the raw action
stream to this worker; the worker feeds it into `createReplicationStore` from
`@dineug/erd-editor/engine.js` (the DOM-free engine entry), and emits the fully serialized document
back via `hostSaveValueCommand` only when the store reports a `change`.

`src/` is 88 lines total — a 3-line entry, the 40-line worker, and the 44-line `utils/text.ts` metrics
helper. Its value is the boundary, not the volume.

## Key Files

| File                                      | Description                                                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                            | Exports `ReplicationStoreWorker`, the worker constructor, via Vite's `?worker&inline` import suffix                                                                               |
| `src/services/replicationStore.worker.ts` | The worker body: creates the replication store, registers `webviewInitialValueCommand` / `webviewReplicationCommand`, and dispatches `hostSaveValueCommand` on change             |
| `src/utils/text.ts`                       | `toWidth` — text measurement supplied to the engine context (the headless store still needs column widths for layout math)                                                        |
| `src/vite-env.d.ts`                       | Ambient types for the `?worker&inline` import — one line, `/// <reference types="vite/client" />`, which still resolves because the catalog alias keeps the package *name* `vite` |
| `vite.config.ts`                          | The `build` task (`run.tasks`) plus the ESM lib build; `build.target` imports `BROWSER_TARGET` from the root `build-target.ts`                                                    |
| `tsconfig.json`                           | Extends the root `tsconfig.app.json`; `include: ["src"]` and `lib: ["ES2020", "WebWorker"]` — the lib list overrides rather than adds, so the DOM is gone from this program       |

## For AI Agents

### Working In This Directory

- **`?worker&inline` is load-bearing.** The worker is inlined into the bundle rather than emitted as a
  separate file because the VSCode webview's CSP and `vscode-resource:` URL scheme make loading an
  external worker script unreliable. Do not "optimize" this into a plain worker URL. What it produces
  is one `dist/index.js` (274 kB) whose only content is the worker source as a string, handed to a
  `Blob` URL with a `data:text/javascript` fallback. The body is an IIFE — Vite's default
  `worker.format`; this package declares no `worker` block, unlike `intellij-webview`.
- **Everything is bundled, nothing is external.** `vite.config.ts` sets no
  `rolldownOptions.external`, and all three workspace edges sit in `devDependencies`, so the engine,
  the bridge and `shared` are compiled *into* that string — which is the point: a Blob worker has no
  module resolution at runtime. That is where 274 kB out of a package whose own `src/` is 88 lines
  comes from.
- **Import the engine entry, never the element entry.** `@dineug/erd-editor/engine.js` is DOM-free;
  `@dineug/erd-editor` registers custom elements and will throw in a worker.
- **`toWidth` must stay DOM-free.** It runs in a worker with no `document`, so it measures with a lazily
  created `OffscreenCanvas` 2d context at `400 12px` and falls back to `text.length * 10` when
  `OffscreenCanvas` is unavailable — never `document.createElement('canvas')`. This one is compiler-
  enforced rather than convention: `tsconfig.json` replaces the inherited `lib` with
  `["ES2020", "WebWorker"]`, so `document` is a TS2584 (measured) while `OffscreenCanvas` still
  resolves. Both the font string and the `TEXT_PADDING` of 2 have to match the editor's own metrics or
  replicated column widths drift. `packages/intellij-webview/src/utils/text.ts` is currently a
  byte-identical copy — keep the two in sync or extract them.
- Only three commands cross this boundary: in `webviewInitialValueCommand` and
  `webviewReplicationCommand`, out `hostSaveValueCommand`. Adding a fourth means touching
  `vscode-bridge` and `vscode-webview` too.
- The worker communicates over raw `globalThis.postMessage` / `addEventListener('message')` and the
  `Bridge` — **not** Comlink (unlike the shiki and schema-GC workers). Don't mix the two idioms.
- **The `build` target lives in `vite.config.ts`, not in `package.json`.** `run.tasks.build` is a
  two-step command — `tsc --noEmit` then `vp build` — carrying
  `dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies', 'peerDependencies'] }]`.
  All three fields, because every workspace edge in this repo lives in `devDependencies`; left at the
  default (`dependencies`) this package's graph resolves to nothing, and an empty graph is not an
  error — it is a green build against a stale `dist/`. ⚠️ `package.json` has `"scripts": {}`,
  deliberately empty: a script sharing a task name makes the task graph fail to load, so there is
  nothing here to reach with `pnpm --filter`.
- **The `input` globs are written out by hand because TypeScript 7's `tsc` is a Go binary**, which
  Vite Task's automatic file tracking cannot see into. Hence the explicit `src/**`, `package.json`,
  `tsconfig.json`, the root `tsconfig.app.json` and one `packages/<dep>/dist/**/*.d.ts` glob per
  workspace dependency (`erd-editor`, `vscode-bridge`, `shared`). ⚠️ Change what `tsconfig.json`
  includes and the `input` list has to move with it — nothing catches that mismatch; the typecheck
  simply stops waking up. The dependency half _is_ enforced: `scripts/check-task-inputs.mjs` (part of
  `pnpm check`) fails if a workspace dependency has no matching `.d.ts` glob, and equally if a glob
  outlives its dependency. `output: ['dist/**']` is also mandatory — without it a cache hit replays
  the terminal output and restores no files.
- **The type gate did not appear with Vite+, it changed hands.** `@rollup/plugin-typescript` used to
  run as a pure diagnostic pass inside the build (it emitted nothing); that job is now the
  `tsc --noEmit` step of the `build` task, over the same `include: ["src"]` program. `vite.config.ts`
  sits outside it and is covered instead by the root `tsc --noEmit` in `pnpm check`, whose `include`
  lists `packages/*/vite.config.ts`.
- **`build.target` imports `BROWSER_TARGET` from the root `build-target.ts`** rather than naming a
  floor of its own. Read the constant for the current value; never restate it here.
- `private: true`.

### Testing Requirements

- No `test` task, and no `package.json` scripts at all. Verify with
  `pnpm exec vp run --fail-if-no-match --filter @dineug/erd-editor-vscode-replication-store-worker build`.
  ⚠️ `pnpm --filter @dineug/erd-editor-vscode-replication-store-worker build` no longer exists —
  `build` is a task name now, not a script. ⚠️ Bare `vp build` ignores `run.tasks`, so it skips both
  the `tsc --noEmit` gate and `dependsOn` and will happily bundle a stale `@dineug/erd-editor/dist`.
  ⚠️ Flags go _before_ the task name, and `--fail-if-no-match` matters: a filter that matches no
  package exits 0 and prints a line nobody reads.
- Real verification requires the VSCode extension host: launch it from
  `packages/vscode-extension/.vscode/`, open a `.erd` file, edit, and confirm the file on disk updates.
  Failure here is silent — edits simply never persist — so check the webview devtools console.
- After changing the engine's `createReplicationStore` signature, rebuild **all three** consumers of
  the `@dineug/erd-editor/engine.js` entry — this package, `intellij-webview`
  (`src/services/replicationStore.worker.ts`) and `app`
  (`src/services/indexeddb/modules/schema/service.ts`). Rebuilding only this one hides two breakages;
  `pnpm build` (`vp run -r build`) covers all three.

### Common Patterns

- `Bridge.mergeRegister(...)` collects command disposers.
- Actions are forwarded verbatim; the worker never interprets payloads.

## Dependencies

### Internal

- `@dineug/erd-editor` — the `engine.js` entry (`createReplicationStore`)
- `@dineug/erd-editor-vscode-bridge` — command protocol
- `@dineug/shared`

### External

Build-only: `vite` — which in this workspace is a pnpm-catalog alias for
`@voidzero-dev/vite-plus-core`, so there is no `node_modules/.bin/vite` and every command goes through
`vp` — plus `vite-plus`, `vite-plugin-dts`, `@typescript/typescript6` (the dts plugin still uses the
JS Compiler API that TypeScript 7 dropped), `typescript` 7.0.2 and `tslib`.

### Consumers

`@dineug/erd-editor-vscode-webview`. (The IntelliJ webview does the same job with its own inline copy
under `packages/intellij-webview/src/services/`.)

<!-- MANUAL: -->
