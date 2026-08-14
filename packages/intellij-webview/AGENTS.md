<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-15 -->

# intellij-webview (`@dineug/erd-editor-intellij-webview`)

## Purpose

The webview bundle for the [IntelliJ ERD Editor plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor).
It is the JCEF-hosted twin of `vscode-webview`: same `<erd-editor>` element, same
`@dineug/erd-editor-vscode-bridge` command protocol — only the transport differs.

The IntelliJ plugin itself (Kotlin/JVM) lives in a **separate repository**; this package only produces
the HTML/JS bundle it embeds. `build:webview` is the target that emits the plugin-shaped output.

### Transport difference

|                    | VSCode webview                                                          | IntelliJ webview                                                                                                 |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| webview → host     | `vscode.postMessage(action)`                                            | `window.cefQuery({ request: JSON.stringify(action), persistent: false, onSuccess, onFailure })`                  |
| host → webview     | `globalThis.addEventListener('message')`                                | **Identical** — `src/main.ts:115` matches `vscode-webview/src/index.ts:148`. Only the outbound direction differs |
| Replication worker | `@dineug/erd-editor-vscode-replication-store-worker` (inline `?worker`) | local `src/services/replicationStore.worker.ts` via `new Worker(new URL(...))`                                   |

Because `cefQuery` takes a **string**, every payload must survive `JSON.stringify`/`parse`.

## Key Files

| File                                      | Description                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main.ts`                             | The whole client — element creation, `bridge` (host) + `workerBridge` (worker), replication worker spawn, theme/readonly handling, lazy shiki registration   |
| `src/services/replicationStore.worker.ts` | Local headless replica built on `createReplicationStore` from `@dineug/erd-editor/engine.js`                                                                 |
| `src/utils/text.ts`                       | `toWidth` text metrics for the worker — a **byte-identical** copy of `vscode-replication-store-worker/src/utils/text.ts`; fix one and you must fix the other |
| `src/webview.css`                         | Layout for the editor host element                                                                                                                           |
| `src/env.d.ts`                            | Ambient types, including `window.cefQuery`                                                                                                                   |
| `public/`                                 | HTML shell and static assets                                                                                                                                 |
| `webpack.config.js`                       | Builds `dev` / production / `webview` targets                                                                                                                |
| `project.json`                            | Nx targets, including `build:webview`                                                                                                                        |

## For AI Agents

### Working In This Directory

- **This bundle is consumed by a different repository.** Changing the command protocol or the HTML
  shell's element ids can break the Kotlin plugin with no signal in this repo. Coordinate protocol
  changes with the plugin repo and keep them additive where possible.
- **`build:webview` writes outside this repo.** With `--env target=webview`, webpack's `output.path` is
  `resolvePath('../../../src/main/resources/assets')` — three levels up from this package, i.e. the
  parent directory of the whole monorepo — and `clean: true` applies there. It only lands somewhere
  useful if the plugin checkout is laid out around this repo as that config expects; run it deliberately,
  and use plain `build` (→ `dist/`) for anything else.
- **`window.cefQuery` is fire-and-forget over a JSON string.** No structured clone, no transferables,
  no `undefined` survival. Binary data is base64-encoded (`base64-arraybuffer`) by the caller.
- **It reuses the _vscode_ bridge package** — that is intentional, not a mistake. Do not fork the
  protocol; if IntelliJ needs a new command, add it to `@dineug/erd-editor-vscode-bridge`.
- **No file _import_ dialog here.** Unlike the VSCode webview, `main.ts` registers only
  `setExportFileCallback` (plus `setGetShikiServiceCallback`); import is driven from the host via
  `webviewImportFileCommand`. Don't add `setImportFileCallback` without host support.
- **The replication worker is a local copy**, not the shared package — JCEF's module-worker support
  differs from VSCode's, so it uses a plain `new Worker(new URL('./services/replicationStore.worker.ts', import.meta.url), { type: 'module' })`.
  When fixing a bug in `packages/vscode-replication-store-worker`, check whether this copy needs the
  same fix.
- **`mouseTracker: false`** — the shared store is for host replication only.
- Build-only package (`dev` runs webpack-dev-server for isolated UI work, but the real target is
  `build:webview`). `private: true`.

### Testing Requirements

- `pnpm --filter @dineug/erd-editor-intellij-webview build` and
  `pnpm nx build:webview @dineug/erd-editor-intellij-webview` for the plugin-shaped output.
- `pnpm --filter @dineug/erd-editor-intellij-webview dev` gives a browser dev server, but `cefQuery` is
  undefined there — host round trips cannot be verified this way. Full verification requires running
  the IntelliJ plugin from its own repository against this bundle.
- Because a protocol mismatch fails silently (the host simply ignores an unknown action), log or
  breakpoint both directions when changing commands.
- `build:analyzer` for bundle size.

### Common Patterns

- Mirrors `packages/vscode-webview/src/index.ts` closely — when changing one, diff against the other
  and decide deliberately whether the change applies to both.
- Command handlers registered up front, collected with `Bridge.mergeRegister`.

## Dependencies

### Internal

- `@dineug/erd-editor` — the element and the `engine.js` entry
- `@dineug/erd-editor-vscode-bridge` — command protocol (reused, despite the name)
- `@dineug/erd-editor-shiki-worker` — highlighting (lazy)
- `@dineug/shared`

### External

- `base64-arraybuffer`
- webpack 5 + `swc-loader`, `core-js`

<!-- MANUAL: -->
