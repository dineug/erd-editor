<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# replication-store-worker

## Purpose

Runs a headless replica of the editor document off the main thread, so the VSCode host can persist
`.erd` files without serializing on the UI thread. The webview forwards the raw action stream in; the
worker feeds it to `createReplicationStore` from `@dineug/erd-editor/engine.js` and emits the
serialized document back only when the store reports a `change`. Consumed by both IDE webviews,
`vscode-webview` and `intellij-webview`, through `mountWebview` in `webview-client`, which calls `createReplicationStoreWorker`;
the VSCode one inlines the worker file in its own build, the IntelliJ one loads it from its URL.
`private: true`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Exports `createReplicationStoreWorker(options)`, which is `new Worker(new URL('./services/replicationStore.worker.ts', import.meta.url), { type: 'module', name })` |
| `src/services/replicationStore.worker.ts` | Worker body — builds the store, registers the two inbound commands, and dispatches `hostSaveValueCommand` after a replica change |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, workers: true })` — the standard factory plus its worker half, so `dist/` is `index.js` and `workers/replicationStore.worker.js`, and the URL in `index.js` is the relative spelling `tools/vite/worker-url.ts` writes |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/services/` | The worker entry itself |
| `src/utils/` | `toWidth`, the text-metrics function handed to the engine context |

## For AI Agents

### Working In This Directory

- **The worker is a file; the VSCode webview inlines it, IntelliJ loads it.** `dist/workers/replicationStore.worker.js`
  imports `@dineug/erd-editor/engine.js` and the bridge bare, because both are `dependencies` and the
  worker build keeps the page's external list; a consumer's bundler treats it as an entry of its own,
  and `vscode-webview`, which cannot load a worker across its two origins, turns the URL back into an
  inline worker through `tools/vite/inline-worker.ts`.
- Import `@dineug/erd-editor/engine.js` (DOM-free), never the package root, which registers custom
  elements and throws in a worker. `tsconfig.json` replaces the inherited `lib` with
  `["ES2022", "WebWorker"]`, so `document` does not typecheck here.
- `toWidth` measures with a lazy `OffscreenCanvas(0, 0)` 2d context at `400 12px`, falling back to
  `text.length * 10`. It is the one copy both IDE webviews replicate with — a divergent font or
  `TEXT_PADDING` drifts replicated column widths in both.
- Three commands cross this boundary: in `webviewInitialValueCommand` and
  `webviewReplicationCommand`, out `hostSaveValueCommand`. A fourth means editing `webview-bridge`
  and `vscode-webview` too.
- The webview sends both the initial value and raw editor actions into this worker. The worker's
  `change` callback serializes the current value and sends it back to the host; it does not own the
  VSCode document or perform transport-level replication.

### Testing Requirements

- No test task and no scripts. Verify with
  `pnpm exec vp run --filter @dineug/erd-editor-replication-store-worker --fail-if-no-match build` (`tsc --noEmit`, then `vp build`).
- Nothing automated exercises the worker at runtime. Real verification is the VSCode Extension Host:
  open a `.erd` file, edit, confirm the file on disk changes — failure is silent, edits never persist.
- Changing `createReplicationStore`'s signature also breaks `app` — `pnpm build`; `intellij-webview` reaches it through this package.

### Common Patterns

- Messaging is raw `globalThis.postMessage` / `addEventListener('message')` plus `Bridge`, not Comlink.
- Both listeners destructure their payload straight into `store.setInitialValue` / `store.dispatch`;
  the disposer `Bridge.mergeRegister` returns is dropped — the worker lives as long as the page.

## Dependencies

### Internal

`@dineug/erd-editor` (the `engine.js` entry) and `@dineug/erd-editor-webview-bridge` are `dependencies`,
so the worker file imports them bare and the consuming webview resolves them once for page and worker
alike.

### External

Build-only: `vite-plugin-dts` with `@typescript/typescript6`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
