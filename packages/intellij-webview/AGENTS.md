<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# intellij-webview

## Purpose

The bundle the IntelliJ plugin (`packages/intellij-plugin`) embeds. `src/main.ts` is a host adapter over `mountWebview` from `webview-client`: webview → host is `window.cefQuery` with a JSON string, host → webview arrives as `window.postMessage` from `WebviewScripts.kt`. It builds into `../intellij-plugin/src/main/resources/assets`, which the plugin serves from its classpath over a custom CEF scheme.

## Key Files

| File | Description |
| --- | --- |
| `src/main.ts` | The adapter: a `cefQuery` `dispatch` and the replica worker's name — no `importFile`, no `resolveAppearance` |
| `src/env.d.ts` | Ambient `window.cefQuery` / `cefQueryCancel` types and `declare module '*.css'` |
| `src/webview.css` | Body sizing and the `prefers-color-scheme` background shown before the editor mounts |
| `index.html` | Build entry at the package root (`publicDir: false`) |
| `vite.config.ts` | `base: '/'`, the out-of-package `outDir`, `sourcemap: false`, `stripCrossorigin`, the `worker` block, `run.tasks.build` |

## For AI Agents

### Working In This Directory

- **`build` writes outside this package** (`emptyOutDir: true`) into the plugin's gitignored `src/main/resources/assets`. The task's `output` names that directory — drop it and a cache hit replays the log without restoring the bundle, which ships a blank editor. A replay also does not empty it (root `AGENTS.md`): `pnpm cache:clear` and rebuild before packaging.
- Gradle does not run this build: `buildPlugin` and `runIde` only check the bundle exists. After a webview change run the build below or `./gradlew buildWebview`.
- **`base` stays `/`, only `.html` / `.js` / `.css` may be emitted, `sourcemap: false`** — the plugin's scheme handler serves the URL path from `/assets` on the classpath and sets a MIME type for those three extensions only.
- **Keep `stripCrossorigin`**: the scheme handler sends no CORS headers, so a `crossorigin` module script is refused and the panel stays blank.
- **Workers load from their URLs.** The page and every asset share one origin (`https://erd-editor-jetbrains-plugin`), so the editor's four SharedWorkers and the replica worker are emitted as `static/js/<name>.<hash>.js` and constructed from those URLs — no blob rebuild, unlike `vscode-webview`.
- **The `worker` block**: workers inherit no `build.rolldownOptions.output`, so the naming is repeated; `format: 'es'` because they are module workers and the iife default code-splits through `importScripts`; `codeSplitting: false` because a worker's dynamic import fails with a network error in the IDE, so ELK's split chunk never arrives and layout never runs.
- **What this host leaves unset**: no `importFile`, so the editor's own file input imports (`ErdEditor.kt` no-ops `hostImportFileCommand`); no `resolveAppearance`, so `'auto'` means dark. `cefQuery`'s `onFailure` is a no-op — a command the plugin rejects vanishes here and shows only in `idea.log`.
- No `build.target`: JCEF's Chromium is the only browser.

### Testing Requirements

No `test` task; the build, `tsc --noEmit` first, is the gate. `cefQuery` is undefined in a plain browser, so under `pnpm --filter @dineug/erd-editor-intellij-webview dev` `mountWebview` throws on its first dispatch; host round trips need the sandbox IDE.

```
pnpm exec vp run --filter @dineug/erd-editor-intellij-webview --fail-if-no-match build
pnpm --filter @dineug/erd-editor-intellij-webview typecheck
cd packages/intellij-plugin && ./gradlew runIde
```

## Dependencies

### Internal

`@dineug/erd-editor-webview-client` only — the editor, the bridge and the replica worker come through it.

### External

`core-js/stable`, imported for side effects.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
