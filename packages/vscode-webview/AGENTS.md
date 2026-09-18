<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# vscode-webview

## Purpose

The bundle inside the VSCode webview iframe — the client half of `vuerd-vscode`. `src/main.ts` is a host adapter over `mountWebview` from `webview-client`: `acquireVsCodeApi().postMessage` as the transport, VSCode's theme kind as `'auto'`, host-side file dialogs. It builds into `../vscode-extension/public`, not a local `dist/`.

## Key Files

| File | Description |
| --- | --- |
| `src/main.ts` | The adapter: `acquireVsCodeApi()`, `getSystemTheme` and its `MutationObserver`, `#loading` removal, `await whenWorkerSourcesReady()`, one `mountWebview` call |
| `src/workerSources.ts` | Runtime of the same-origin rewrite: `registerWorkerSource` fetches each worker script, `workerBlobUrl` returns its blob URL, `whenWorkerSourcesReady` settles once every read has |
| `index.html` | Entry at the package root: the `{{extension-base-url}}` `<base>` and the `#loading` placeholder |
| `vite.config.ts` | `base: './'`, the out-of-package `outDir` with `emptyOutDir`, `modulePreload: false`, the `worker` block, `sameOriginDependencyWorkers` and the local `stripCrossorigin` plugin, `run.tasks.build` |
| `src/env.d.ts` | `@types/vscode-webview` (`acquireVsCodeApi`) and `vite/client` (`*.css`) |

## For AI Agents

### Working In This Directory

- **Output lands in the gitignored `packages/vscode-extension/public`**, which `vsce` ships. `emptyOutDir: true` and the task's `output` are both load-bearing; drop either and stale or missing bundles ship. A cache replay does not empty the directory (root `AGENTS.md`), so `pnpm cache:clear` and rebuild before packaging.
- **`base: './'` and the literal `{{extension-base-url}}` token are a contract** with `Editor#buildHtmlForWebview` in `packages/vscode-extension/src/editor.ts`, which replaces it; absolute asset paths render a blank panel.
- **Workers cross an origin line.** The document is on `vscode-webview://`, `asWebviewUri` serves scripts from `vscode-resource.vscode-cdn.net`, and a worker constructor throws `SecurityError` on a cross-origin script URL before it fetches. Hence:
  - `sameOriginDependencyWorkers` (`tools/vite/same-origin-worker.ts`) rewrites every url worker in the `erd-editor` and `replication-store-worker` dist files into a `?sharedworker&url` / `?worker&url` import registered with `src/workerSources.ts`, which reads the script and builds a same-origin blob. Its `generateBundle` fails the build if a url worker survives.
  - The document does the read, never the worker: VSCode's service worker resolves a resource by the requesting client's webview id, a blob worker has none, and every request from inside one comes back 408.
  - `worker.rolldownOptions.output.codeSplitting: false`: a blob worker resolves relative imports against its blob URL, so a split chunk (ELK's) would 404.
  - `index.html` sets no CSP; one added later must allow `worker-src blob:` or no worker is built.
- **`main.ts` awaits `whenWorkerSourcesReady()` before `mountWebview`**, because every spawn is synchronous. A failed read makes `workerBlobUrl` throw: the editor's four services take that as no worker and fall back, but the replica worker has none, so `mountWebview` throws and the panel stays on `Loading...`.
- **`crossorigin` must not reach the emitted HTML**: the `asWebviewUri` origin sends no CORS headers, so such a module script never loads — hence `stripCrossorigin` and `modulePreload: false`.
- **`acquireVsCodeApi()` is called once, at module scope**; a second call throws.
- `'auto'` follows `document.body`'s `data-vscode-theme-kind` (or the `vscode-light` class) through a `MutationObserver` that calls `client.refreshAppearance()` — not `prefers-color-scheme`.

### Testing Requirements

- Build: `pnpm exec vp run --filter @dineug/erd-editor-vscode-webview --fail-if-no-match build`. Types alone: `pnpm --filter @dineug/erd-editor-vscode-webview typecheck`.
- No unit suite: the protocol is tested in `webview-client`, the rewrite in `tools/vite-config.test.ts` (run by `pnpm check`). Nothing in CI asserts that this bundle renders; the Extension Host specs check tabs and commands only. Verify by hand in an Extension Host: edit a `.erd`, switch themes, open one file in two groups, open one from git history (readonly).

## Dependencies

### Internal

`@dineug/erd-editor-webview-client` (the editor, the replica worker and the protocol, all bundled here) and `@dineug/erd-editor-webview-bridge` (for `Appearance`). The editor's four SharedWorkers and the replica worker are the five scripts the document reads at startup.

### External

`core-js/stable` imported at the top of `src/main.ts`; `@types/vscode-webview`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
