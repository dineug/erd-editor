<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-07 -->

# vscode-webview

## Purpose

The bundle running inside the VSCode webview iframe — the client half of `vuerd-vscode`. It creates the
`<erd-editor>` element, talks to the extension host over `acquireVsCodeApi()` `postMessage`, and spawns the
replication-store worker holding the host's copy. It builds *into* `../vscode-extension/public`, not a local `dist/`.

## Key Files

| File             | Description                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`    | The host adapter: `acquireVsCodeApi()` transport, theme-kind resolution with its `MutationObserver`, `#loading` removal, one `mountWebview` call |
| `index.html`     | Entry, at the package root; carries the `{{extension-base-url}}` base tag and the `#loading` placeholder                |
| `vite.config.ts` | `run.tasks.build`, `base: './'`, `publicDir: false`, the out-of-package `outDir`, `bundle.[hash:8]` names, `worker.rolldownOptions.output.codeSplitting: false`, and two plugins: `sameOriginDependencyWorkers` from `tools/vite/same-origin-worker.ts` (it turns the `new SharedWorker(new URL(…, import.meta.url))` the editor packages ship into a `?sharedworker&url` import read through `src/workerSources.ts`) and local `strip-crossorigin` |
| `src/workerSources.ts` | The document's read of each worker script and the same-origin blob URL it hands back, plus the wait the entry does before it mounts |
| `src/env.d.ts`   | `@types/vscode-webview` (for `acquireVsCodeApi`) and `vite/client` — the only thing declaring `*.css` imports           |
| `src/webview.css` | Webview loading and editor-host styles imported before the element is appended |

## For AI Agents

### Working In This Directory

- **Output lands in the gitignored `packages/vscode-extension/public`** that `vsce` ships in the VSIX.
  `emptyOutDir: true` and the matching task `output` are both explicit — drop either and stale bundles ship.
  A cache replay restores the bundle without emptying the directory first, so a tree that has seen
  several builds can hold two generations; `pnpm cache:clear` and a rebuild before packaging locally
  leaves one, and CI starts from a clean checkout.
- **`base: './'` and the literal `{{extension-base-url}}` token are a contract.** `Editor#buildHtmlForWebview`
  (`packages/vscode-extension/src/editor.ts`) regex-replaces it; absolute asset paths render a blank panel.
- **Dependency workers are read by the document here, and only here.** The document sits on `vscode-webview://` while `asWebviewUri` serves files from `vscode-resource.vscode-cdn.net`, and a worker constructor compares the script URL's origin against the document's before it fetches, so the URL workers `@dineug/erd-editor` and `@dineug/erd-editor-replication-store-worker` ship throw a `SecurityError`. `sameOriginDependencyWorkers` from `tools/vite/same-origin-worker.ts` rewrites their `dist/` at transform time so each URL becomes a `?sharedworker&url` import registered with `src/workerSources.ts`, which fetches the file and builds a same-origin blob the constructor accepts. The worker cannot do that read itself, whatever its type: VSCode's service worker resolves a resource by the requesting client's webview id, a blob worker client carries none, and every request from inside one comes back 408. `index.html` sets no CSP; one added later has to carry `worker-src blob:` or every worker here stops being built.
- **Worker code splitting is off** (`worker.rolldownOptions.output.codeSplitting: false`). A worker built from a blob URL resolves a relative import against that URL rather than against `static/js/`, so the ELK chunk the layout worker used to split would 404; each worker file is self-contained instead.
- **`src/main.ts` awaits `whenWorkerSourcesReady()` before `mountWebview`.** Every spawn inside the editor is synchronous, so the reads cannot happen at the spawn; a script that failed to read throws from `workerBlobUrl`, which is what each service already treats as this host building no worker.
- **`crossorigin` must not reach the emitted HTML** — assets come via `asWebviewUri` from an origin sending
  no CORS headers, so such a script never loads; hence `strip-crossorigin` and `modulePreload: false`.
- **`acquireVsCodeApi()` is called once, at module scope in `src/main.ts`**; a second call throws. Everything after it is `mountWebview` from `@dineug/erd-editor-webview-client`; the protocol wiring lives there and is tested there.
- `hostInitialCommand` is dispatched at module evaluation, before the editor is appended. The host's
  `webviewInitialValueCommand` is the gate that creates the element, starts worker replication, removes
  `#loading`, and appends the editor.
- Local editor actions go to both the replication worker and the extension host as
  `hostSaveReplicationCommand`; actions received from the host update the editor and worker without
  echoing a host save command.
- **File dialogs live on the host**: `setImportFileCallback` / `setExportFileCallback` dispatch host commands
  and base64-encode export blobs — everything crossing `postMessage` must be JSON-safe.
- **`appearance: 'auto'` resolves locally** from `document.body`'s `data-vscode-theme-kind` (or the
  `vscode-light` class), watched by a `MutationObserver` — not `prefers-color-scheme`.

### Testing Requirements

- Build (`tsc --noEmit`, then `vp build`): `pnpm exec vp run --filter @dineug/erd-editor-vscode-webview --fail-if-no-match build`.
  Types alone: `pnpm --filter @dineug/erd-editor-vscode-webview typecheck` — the only `package.json` script.
- No unit suite — no `test` task, no `vitest.config.ts`; that `tsc --noEmit` is the only automated check.
- Nothing renders this bundle in CI (the Extension Host harness blocks the webview document request): verify
  by hand — edit a `.erd` file, switch themes, open it in two editor groups, and one from git history.

### Common Patterns

- Two `Bridge` instances — `bridge` for host ↔ webview, `workerBridge` for webview ↔ replication worker.
  Handlers are registered up front and collected with `Bridge.mergeRegister`.
- `editor.getSharedStore({ mouseTracker: false, focusTracker: false })` — that store feeds host replication, not collaboration;
  nothing here receives cursor positions.
- `#loading` is removed and the editor appended to `document.body` only when `webviewInitialValueCommand`
  arrives.

## Dependencies

### Internal

`@dineug/erd-editor-webview-client` (the mounted editor and all of the protocol), `@dineug/erd-editor-webview-bridge` (for `Appearance`). The editor and the replica worker arrive through the client and are bundled here; the editor's four workers and the replica worker are the five files the document reads at startup.

### External

`core-js/stable` imported wholesale at the top of `src/main.ts`,
`@types/vscode-webview` for the `acquireVsCodeApi` typing.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
