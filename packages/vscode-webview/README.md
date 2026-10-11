# vscode-webview

> The bundle inside the VS Code webview

The page that runs in the webview iframe of ERD Editor's VS Code extension, the client half of
[`vuerd-vscode`](../vscode-extension). It mounts the editor through
[`webview-client`](../webview-client)'s `mountWebview` and talks to the extension over
`postMessage`. The package is private and never published to npm, and no package imports it:
`vuerd-vscode` lists it in `devDependencies` as
`"@dineug/erd-editor-vscode-webview": "workspace:*"`, so the extension's `build` task builds it
first. What it writes to `packages/vscode-extension/public` ships in the VSIX that `vsce`
packages. Its own dependencies, `webview-client` and [`webview-bridge`](../webview-bridge), are
bundled into that output.

## Usage

The package has no `src/index.ts`; its entry and output:

- **`index.html`** — the entry, at the package root: a `<base href="{{extension-base-url}}">`,
  which the extension's `Editor#buildHtmlForWebview` (`packages/vscode-extension/src/editor.ts`)
  replaces with the `asWebviewUri` of `public/` each time a panel opens, and the `Loading...`
  placeholder (`#loading`). Vite builds with `base: './'`, so the tags it writes into
  `index.html` are relative and resolve against that base, and the worker script URLs inside the
  bundle resolve against the bundle's own URL.
- **`src/main.ts`** — imports `core-js/stable` and `src/webview.css` (body sizing and the
  `#loading` style), calls `acquireVsCodeApi()` once, waits for the worker scripts
  (`whenWorkerSourcesReady()`), then makes one `mountWebview` call:

  | `WebviewHost` field | Value |
  | --- | --- |
  | `dispatch` | `action => vscode.postMessage(action)` |
  | `workerName` | `'@dineug/erd-editor-vscode-webview/replication-store-worker'` |
  | `resolveAppearance` | `getSystemTheme`: light for `vscode-light`, dark otherwise |
  | `importFile` | `true`: the extension shows the import file dialog |
  | `onMounted` | removes `#loading` |

  `getSystemTheme` reads the body's `data-vscode-theme-kind`, or its `vscode-light` class without
  it, and a `MutationObserver` on both calls `client.refreshAppearance()`, so the editor's System
  appearance follows the VS Code theme.
- **`src/workerSources.ts`** — the document and the scripts `asWebviewUri` serves sit on different
  origins, and a worker cannot be built from a script URL across that line. So the build's
  `sameOriginDependencyWorkers` plugin (`tools/vite/same-origin-worker.ts`) rewrites every url
  worker in the `dist/` files of `erd-editor` and `replication-store-worker` to register its
  script here; the document fetches each one and the worker is built from a blob URL. That is four
  scripts: the editor's three SharedWorkers (PNG and SVG export, ELK layout, Shiki) and the
  replica worker.
- **`vite.config.ts`** — writes `index.html`, `static/js/bundle.<hash>.js`, one
  `static/js/<name>.<hash>.js` per worker and `static/css/bundle.<hash>.css` to
  `../vscode-extension/public`, which a real build empties (`emptyOutDir`) and a cache replay
  does not. Its local
  `stripCrossorigin` plugin removes `crossorigin` from the tags Vite injects, since the
  `asWebviewUri` origin sends no CORS headers, and module preload is off.

## How it talks to the host

`mountWebview` creates the `<erd-editor>` element and wires two `Bridge` instances from
`@dineug/erd-editor-webview-bridge`, the typed command protocol shared with the extension:

- **page ↔ extension**, over `vscode.postMessage` and the page's `message` events: the initial
  value, theme, display language, read-only state, file import and export, replication actions
  and the saved document. An export crosses as base64 (`hostExportFileCommand`), and the
  extension writes it where its save dialog says.
- **page ↔ replica worker**, which keeps a headless replica of the document: it gets the initial
  value and every batch, local or from the extension, and once the edits pause answers with
  `hostSaveValueCommand`, which the page relays to the extension unchanged. The extension keeps
  the save's `runtimeValue`, which seeds the next panel and joining agents, and updates the
  document from its storage-form `value` only when `changed` is true and the panel is not
  read-only.

The extension relays the page's edits to the document's other panels and to the coding agents
joined through the hub, never back to the panel they came from. The commands are listed in
[`webview-bridge`](../webview-bridge), and what `mountWebview` does in what order in
[`webview-client`](../webview-client).

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/vscode-webview --fail-if-no-match build
pnpm --filter ./packages/vscode-webview --fail-if-no-match typecheck
```

The package has no `test` task and no spec. `build` builds its workspace dependencies, then runs
`tsc --noEmit` and `vp build`; there is no local `dist/`. `typecheck` runs `tsc` alone against
the built `dist/**/*.d.ts` of `webview-client` and `webview-bridge`, and through them
`erd-editor`'s, and builds none of them: build them first, and again after a change to them,
with `build` or `pnpm build`. Before packaging with `vsce`, run `pnpm cache:clear` and build
again: a build replayed from the cache restores its files without emptying the directory, so
hashed files left there by another build can ship in the VSIX.

To see a build, open `packages/vscode-extension` in VS Code and press F5 (Launch Extension). It
builds this package with the extension's other workspace dependencies, then watches the extension
alone; after a change here, run `build` again and reopen the diagram's tab, which reads
`public/index.html` anew. There is no dev server, since the page needs `acquireVsCodeApi()`.
`pnpm --filter vuerd-vscode --fail-if-no-match e2e` (under `xvfb-run -a` on Linux) builds the
extension with this bundle and runs its Extension Host specs, which need the bundle to boot.

The rules for changing the package, and the checks a change runs, are in [AGENTS.md](./AGENTS.md).
