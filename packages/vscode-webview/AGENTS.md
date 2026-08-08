<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# vscode-webview (`@dineug/erd-editor-vscode-webview`)

## Purpose

The bundle that runs _inside_ the VSCode webview iframe. It is the client half of the extension: it
creates the `<erd-editor>` element, wires it to the extension host over `acquireVsCodeApi()`
`postMessage`, and spawns the replication-store worker that keeps the host's copy of the document up
to date.

Its build output is copied into the extension's `public/` directory and served as a webview asset.

### Wiring

```
extension host ──postMessage──▶ bridge ──▶ <erd-editor> (sharedStore)
               ◀──postMessage── bridge ◀── editor change / user command
                                   │
                                   └──▶ workerBridge ──▶ ReplicationStoreWorker ──▶ hostSaveValue
```

Three participants, two `Bridge` instances:

- `bridge` — host ↔ webview
- `workerBridge` — webview ↔ replication-store worker
- `sharedStore` — the editor's own action stream, obtained via
  `editor.getSharedStore({ mouseTracker: false })` (no cursor sharing in VSCode)

## Key Files

| File                | Description                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`      | The entire client — element creation, both bridges, worker spawn, theme/readonly/import-export handling, lazy shiki registration |
| `src/webview.css`   | Layout for the editor host element and the `#loading` placeholder                                                                |
| `src/env.d.ts`      | Ambient types, including `acquireVsCodeApi`                                                                                      |
| `public/`           | Static assets and the HTML shell used by `html-webpack-plugin`                                                                   |
| `webpack.config.js` | Production-only webpack build (swc-loader, MiniCssExtract, tsconfig paths)                                                       |
| `project.json`      | Nx project config for this package's targets                                                                                     |

## For AI Agents

### Working In This Directory

- **`acquireVsCodeApi()` may be called exactly once per webview.** It is called at module scope in
  `src/index.ts`; never call it again anywhere in the bundle.
- **Everything crossing to the host must be JSON-safe.** Binary payloads (file export) are encoded with
  `base64-arraybuffer` (`encode`) before dispatch and decoded on the host side.
- **File IO is delegated to the host**, because a webview has no file dialogs. `setExportFileCallback`
  and `setImportFileCallback` from `@dineug/erd-editor` are registered to emit
  `hostExportFileCommand` / `hostImportFileCommand` instead.
- **Shiki is imported lazily** (`import('@dineug/erd-editor-shiki-worker').then(...)` →
  `setGetShikiServiceCallback`). Keep it out of the initial chunk; webview startup latency is visible.
- **`mouseTracker: false`** — the shared store is used for host replication, not collaboration. Turning
  it on would broadcast cursor positions with nothing to receive them.
- **Theme comes from the host**, via `webviewUpdateThemeCommand`; `appearance` defaults to `'dark'` and
  may be `'auto'`, in which case the system preference decides. Don't read VSCode theme variables
  directly from CSS — the extension resolves them and pushes `ThemeOptions`.
- This package is **build-only** (`build`, `build:analyzer`) — there is no dev server. Iterate by
  running the extension host.
- `private: true`.

### Testing Requirements

- `pnpm --filter @dineug/erd-editor-vscode-webview build`, then build the extension.
- Real verification is the VSCode extension host (launch config in `packages/vscode-extension/.vscode/`):
  open a `.erd` file and check the round trip — edit → file saves; change VSCode theme → editor
  restyles; open the same file in two editor groups → both stay in sync (that path uses the host's
  broadcast, so test it with more than one webview).
- Also verify readonly (`webviewUpdateReadonlyCommand`) by opening a file from git history.
- `build:analyzer` runs webpack-bundle-analyzer — use it when adding a dependency; the webview bundle
  ships inside the extension VSIX.

### Common Patterns

- Command handlers are registered up front and collected with `Bridge.mergeRegister`.
- The `#loading` element in the HTML shell is removed once the initial value arrives.

## Dependencies

### Internal

- `@dineug/erd-editor` — the element
- `@dineug/erd-editor-vscode-bridge` — command protocol
- `@dineug/erd-editor-vscode-replication-store-worker` — host-side document replica
- `@dineug/erd-editor-shiki-worker` — highlighting (lazy)
- `@dineug/shared`

### External

- `base64-arraybuffer` — binary payload encoding
- webpack 5 + `swc-loader`, `core-js` (webview runtimes lag), `@types/vscode-webview`

### Consumers

`vuerd-vscode` — copies this bundle into its webview assets.

<!-- MANUAL: -->
