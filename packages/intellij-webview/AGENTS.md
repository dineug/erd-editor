<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# intellij-webview

## Purpose

The HTML/JS bundle embedded by the IntelliJ ERD Editor plugin, whose Kotlin/JVM side is `packages/intellij-plugin`.
Same `<erd-editor>` element and same `@dineug/erd-editor-vscode-bridge` protocol as `vscode-webview`, but webview→host is
`window.cefQuery` with a JSON string, so payloads must survive `JSON.stringify`/`parse` and binary data is base64-encoded first.

## Key Files

| File | Description |
| --- | --- |
| `src/main.ts` | The whole client — element creation, `bridge` (host) + `workerBridge` (worker), worker spawn, theme/readonly commands, lazy shiki registration |
| `src/services/replicationStore.worker.ts` | Local headless replica over `createReplicationStore` from `@dineug/erd-editor/engine.js` |
| `src/utils/text.ts` | `toWidth` metrics for the worker; byte-identical to `packages/vscode-replication-store-worker/src/utils/text.ts` — fix both |
| `src/env.d.ts` | Ambient `window.cefQuery` / `cefQueryCancel` types and `declare module '*.css'` |
| `index.html` | Build entry at the package root; `publicDir: false`, so no static asset dir sits beside it |
| `vite.config.ts` | The one output path, the `stripCrossorigin` plugin, the `worker` block, `run.tasks` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/services/` | The replication store web worker |
| `src/utils/` | `toWidth` canvas text measurement |

## For AI Agents

### Working In This Directory

- **`build` writes outside this package**, `emptyOutDir: true` into `../intellij-plugin/src/main/resources/assets`. There is no configured production `dist/` and nothing here imports this package; a local dev command may still leave a generated `dist/`, but it is not the shipped output. The task declares the plugin asset directory as its `output`; drop that and a cache hit replays the log without restoring the bundle, which ships as a blank editor.
- Gradle `buildPlugin` and `runIde` verify that the asset bundle exists but do not invoke `buildWebview`; the IntelliJ workflow runs the pnpm webview build before Gradle. Run `./gradlew buildWebview` explicitly after webview changes when working locally.
- **`base` stays `/`, only `.html`/`.js`/`.css` may be emitted, `sourcemap: false`** — the plugin's CEF
  `SchemeHandlerFactory` maps the URL path onto the classpath and types those three extensions, nothing else.
- **Do not restore `crossorigin` on injected tags.** `stripCrossorigin` removes it: the scheme handler sends no CORS headers, so the module script is refused and the panel stays blank.
- **The `worker` block repeats the output naming** because workers do not inherit `build.rolldownOptions.output`, and `worker.format: 'es'`
  matches `main.ts` building its worker as `{ type: 'module' }`. No `build.target` is set — JCEF's Chromium is the only browser here.

### Testing Requirements

No `test` task and no test files, so `pnpm test` walks past this package; the build is the gate, and it runs
`tsc --noEmit` first. `cefQuery` is undefined in a plain browser — host round trips need a sandbox IDE.

```
pnpm exec vp run --filter @dineug/erd-editor-intellij-webview --fail-if-no-match build
pnpm --filter @dineug/erd-editor-intellij-webview typecheck
pnpm --filter @dineug/erd-editor-intellij-webview dev
cd ../intellij-plugin && ./gradlew runIde
```

### Common Patterns

- Mirror of `packages/vscode-webview/src/index.ts` — diff both when either moves. The same two gaps: no `setImportFileCallback`, so the element's own file input is what imports here and the mirrored `webviewImportFileCommand` handler goes unreached while `ErdEditor.kt` no-ops `ImportFile`; and `auto` appearance resolves to dark instead of following the host.
- Register commands up front, collecting disposers with `Bridge.mergeRegister`; a new command belongs in the bridge package, not a fork.
- The shared store is created with `mouseTracker: false, focusTracker: false` — it exists for host replication only.

## Dependencies

### Internal

`@dineug/erd-editor` (element + `engine.js`), `@dineug/erd-editor-vscode-bridge` (protocol, reused despite the name), `@dineug/erd-editor-shiki-worker` (lazy), `@dineug/shared` (declared, unimported).

### External

`base64-arraybuffer` encodes export blobs for the string channel; `core-js@^3.36.1` is imported for side effects.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
