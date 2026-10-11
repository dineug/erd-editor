<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-11 -->

# vscode-webview

## Purpose

The bundle inside the VS Code webview iframe, the client half of `vuerd-vscode`. `src/main.ts` is a host adapter over `mountWebview` from `webview-client`: `acquireVsCodeApi().postMessage` as the transport, VS Code's theme kind as `'auto'`, and host-side file dialogs. It builds into `../vscode-extension/public`, not a local `dist/`. A change here keeps three things intact: the `{{extension-base-url}}` contract, the same-origin worker rewrite and the `crossorigin` strip. Losing any one stops the panel loading or its workers starting (Rules).

## Making a Change

1. **Read `packages/vscode-extension/AGENTS.md` with this file**, since the extension fills this page's `<base>`, ships its output and runs the Extension Host specs that boot it. A change to the `mountWebview` wiring or to a command also reads `packages/webview-client/AGENTS.md` and `packages/webview-bridge/AGENTS.md` (root step 1). A change to how workers are built also reads `packages/replication-store-worker/AGENTS.md`, since the rewrite matches the constructor spelling its `dist/` and `erd-editor`'s emit.
2. **Skip root steps 3 and 4.** This package has no `vitest.config.*`, so it has no `test` task and no coverage gate. Its `build` task, `tsc --noEmit` and then `vp build`, is the check; run it as Testing Requirements gives it.
3. **Run root step 5.** `pnpm build` runs this package's `build` too, and `pnpm check` runs `tools/vite-config.test.ts`, the spec of the worker rewrite.
4. **Run `pnpm --filter vuerd-vscode e2e`** (root step 6), because `vuerd-vscode`'s Extension Host specs need this bundle to boot (Testing Requirements). Its `build` task builds this package first, since `vuerd-vscode` lists it as a devDependency.
5. **Check the panel by hand in an Extension Host**, with the steps in Testing Requirements, because nothing in CI asserts that this bundle renders.
6. **Before packaging with `vsce`, run `pnpm cache:clear` and rebuild** (Rules § Build Output).
7. **Report as root step 7 says.** Name the e2e or the hand check when it did not run, with the reason: both need VS Code, the e2e under `xvfb-run -a` on Linux.

## Key Files

| File | Description |
| --- | --- |
| `src/main.ts` | The adapter: `acquireVsCodeApi()`, `getSystemTheme` and its `MutationObserver`, `#loading` removal, `await whenWorkerSourcesReady()`, one `mountWebview` call |
| `src/workerSources.ts` | Runtime of the same-origin rewrite: `registerWorkerSource` fetches each worker script where its URL is imported, so every read is in flight once the editor's module is evaluated; `workerBlobUrl` returns its blob URL; `whenWorkerSourcesReady` settles once every read has |
| `index.html` | Entry at the package root: the `{{extension-base-url}}` `<base>` and the `#loading` placeholder |
| `vite.config.ts` | `base: './'`, the out-of-package `outDir` with `emptyOutDir`, `modulePreload: false`, the `worker` block, `sameOriginDependencyWorkers` and the local `stripCrossorigin` plugin, `run.tasks.build` |
| `src/env.d.ts` | `@types/vscode-webview` (`acquireVsCodeApi`) and `vite/client` (`*.css`) |

## Rules

### Build Output

- **`build` writes outside this package.** It writes into the gitignored `packages/vscode-extension/public`, which `vsce` ships. There is no local `dist/`.
- **Keep `emptyOutDir: true`.** Vite only warns and declines to clear an `outDir` outside the package root by default. Stale hashed bundles left there would be shipped.
- **`cache.output` moves with `outDir`.** The task's `cache.output` names `packages/vscode-extension/public/**` as a literal glob, so a change to `outDir` changes that glob too. An explicit glob turns automatic write tracking off, so a cache hit restores only what it names.
- **Clear the cache before packaging.** A cache replay does not empty the output directory (root § Working In This Directory). Run `pnpm cache:clear` and rebuild before packaging, so that no stale bundle ships.

### Asset URLs

- **Keep `base: './'` and the literal `{{extension-base-url}}` token.** They are a contract with `Editor#buildHtmlForWebview` in `packages/vscode-extension/src/editor.ts`, which replaces the token in `index.html`'s `<base>`. Absolute asset paths render a blank panel.
- **Keep `stripCrossorigin` and `modulePreload: false`.** The `asWebviewUri` origin sends no CORS headers, so a module script with `crossorigin` never loads. `stripCrossorigin` removes the attribute from the tags Vite injects. Preload links would carry it too, and with one entry there is nothing to preload.

### Workers

- **The document and its scripts differ in origin.** The document is on `vscode-webview://`, and `asWebviewUri` serves scripts from `vscode-resource.vscode-cdn.net`. A worker constructor throws `SecurityError` on a cross-origin script URL before it fetches. The bullets below follow from that.
- **Every worker is built from a same-origin blob.** `sameOriginDependencyWorkers` (`tools/vite/same-origin-worker.ts`) rewrites every url worker in the `erd-editor` and `replication-store-worker` dist files into a `?sharedworker&url` or `?worker&url` import. Each is registered with `src/workerSources.ts`, which reads the script and builds the blob. The plugin's `generateBundle` fails the build if a url worker survives.
- **The document does the read, never the worker.** VS Code's service worker resolves a resource by the requesting client's webview id. A blob worker has none, so every request from inside one comes back 408.
- **Workers build with `codeSplitting: false`** (`worker.rolldownOptions.output`). A blob worker resolves relative imports against its blob URL, so a split chunk (ELK's) would 404.
- **A CSP added to `index.html` allows `worker-src blob:`.** `index.html` sets no CSP today. One without that source builds no worker.
- **`main.ts` awaits `whenWorkerSourcesReady()` before `mountWebview`.** Every spawn inside the editor is synchronous and cannot wait for a read, so the reads are awaited once, before the mount.
- **A failed read means a missing worker.** `workerBlobUrl` then throws for the script. Each of the editor's three services meets it as a host with no worker, as the `src/services/` row of `erd-editor`'s Subdirectories table says:
  - the PNG and SVG export run in-process;
  - Shiki shows plain text;
  - ELK refuses, so automatic table placement and Flow mode's layout end on a `Could not place tables` toast, while a SQL, GraphQL, DBML or AML import from the host's file dialog, a replace or an append, lands in the grid without a word.
- **The replica worker has no fallback.** When its read fails, `mountWebview` throws and the panel stays on `Loading...`.

### Host Wiring

- **Call `acquireVsCodeApi()` once, at module scope.** A second call throws.
- **`'auto'` follows VS Code's theme kind, not `prefers-color-scheme`.** VS Code writes its theme kind onto the body, so `getSystemTheme` reads `document.body`'s `data-vscode-theme-kind`, or the `vscode-light` class without it. A `MutationObserver` on those attributes calls `client.refreshAppearance()`.

## Testing Requirements

- **The build is the gate.** There is no `test` task and no unit suite. The `build` task builds the workspace dependencies, then runs `tsc --noEmit` and `vp build`; the `typecheck` script checks types alone.

  ```
  pnpm exec vp run --filter @dineug/erd-editor-vscode-webview --fail-if-no-match build
  pnpm --filter @dineug/erd-editor-vscode-webview typecheck
  ```

- **Other packages test what this one wires.** The protocol is tested in `webview-client`, and the worker rewrite in `tools/vite-config.test.ts`, which `pnpm check` runs.
- **`vuerd-vscode`'s Extension Host specs need this bundle to boot.** Nothing in CI asserts that the bundle renders. But an agent's `openDocument` (`test/integration/agent-hub.test.ts`, `test/integration/linked/linked-folder.test.ts`) and `applyActions` count only webviews whose `hostInitialCommand` arrived. In `agent-hub.test.ts`, a peer's batch has to come back through the replica worker as a `hostSaveValueCommand` that dirties the tab, while a view change must leave the tab clean. Run them with `pnpm --filter vuerd-vscode e2e`.
- **Verify by hand in an Extension Host.** Edit a `.erd`, switch themes, open one file in two groups, and show a Git revision as a read-only diagram with Reopen Editor With (Source Control opens it as JSON text).

## Dependencies

### Internal

`@dineug/erd-editor-webview-client` (the editor, the replica worker and the protocol, all bundled here) and `@dineug/erd-editor-webview-bridge` (for `Appearance`). The editor's three SharedWorkers and the replica worker are the four scripts the document reads at startup.

### External

`core-js/stable`, imported at the top of `src/main.ts`; `@types/vscode-webview`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
