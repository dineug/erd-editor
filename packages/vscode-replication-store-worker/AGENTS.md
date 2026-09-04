<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# vscode-replication-store-worker

## Purpose

Runs a headless replica of the editor document off the main thread, so the VSCode host can persist
`.erd` files without serializing on the UI thread. The webview forwards the raw action stream in; the
worker feeds it to `createReplicationStore` from `@dineug/erd-editor/engine.js` and emits the
serialized document back only when the store reports a `change`. Consumed by
`@dineug/erd-editor-vscode-webview`; `intellij-webview` keeps its own copy, spawned from a URL
instead of inlined. `private: true`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Exports `ReplicationStoreWorker`, the worker constructor, via Vite's `?worker&inline` suffix |
| `src/services/replicationStore.worker.ts` | Worker body — builds the store, registers the two inbound commands, and dispatches `hostSaveValueCommand` after a replica change |
| `vite.config.ts` | Library worker build; `?worker&inline` is part of the emitted API and the shared library config supplies task inputs |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/services/` | The worker entry itself |
| `src/utils/` | `toWidth`, the text-metrics function handed to the engine context |

## For AI Agents

### Working In This Directory

- **`?worker&inline` is load-bearing.** It compiles the whole worker — engine, bridge and all — into
  a bundled string in `dist/index.js`, run from a Blob URL with no module resolution; a plain worker URL would fail to load its imports.
- Import `@dineug/erd-editor/engine.js` (DOM-free), never the package root, which registers custom
  elements and throws in a worker. `tsconfig.json` replaces the inherited `lib` with
  `["ES2022", "WebWorker"]`, so `document` does not typecheck here.
- `toWidth` measures with a lazy `OffscreenCanvas(0, 0)` 2d context at `400 12px`, falling back to
  `text.length * 10`. It is byte-identical to `packages/intellij-webview/src/utils/text.ts` — a
  divergent font or `TEXT_PADDING` drifts replicated column widths.
- Three commands cross this boundary: in `webviewInitialValueCommand` and
  `webviewReplicationCommand`, out `hostSaveValueCommand`. A fourth means editing `vscode-bridge`
  and `vscode-webview` too.
- The webview sends both the initial value and raw editor actions into this worker. The worker's
  `change` callback serializes the current value and sends it back to the host; it does not own the
  VSCode document or perform transport-level replication.

### Testing Requirements

- No test task and no scripts. Verify with
  `pnpm exec vp run --filter @dineug/erd-editor-vscode-replication-store-worker --fail-if-no-match build` (`tsc --noEmit`, then `vp build`).
- Nothing automated exercises the worker at runtime. Real verification is the VSCode Extension Host:
  open a `.erd` file, edit, confirm the file on disk changes — failure is silent, edits never persist.
- Changing `createReplicationStore`'s signature also breaks `intellij-webview` and `app` — `pnpm build`.

### Common Patterns

- Messaging is raw `globalThis.postMessage` / `addEventListener('message')` plus `Bridge`, not Comlink.
- Both listeners destructure their payload straight into `store.setInitialValue` / `store.dispatch`;
  the disposer `Bridge.mergeRegister` returns is dropped — the worker lives as long as the page.

## Dependencies

### Internal

`@dineug/erd-editor` (the `engine.js` entry), `@dineug/erd-editor-vscode-bridge` and `@dineug/shared`
— all `devDependencies`, bundled into the inlined worker; `shared` is declared but unused by `src/`.

### External

Build-only: `vite-plugin-dts` with `@typescript/typescript6`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
