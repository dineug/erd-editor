<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-11 -->

# intellij-webview

## Purpose

The bundle the IntelliJ plugin (`packages/intellij-plugin`) embeds. `src/main.ts` is a host adapter over `mountWebview` from `webview-client`. Webview → host is `window.cefQuery` with a JSON string; host → webview arrives as `window.postMessage` from `WebviewScripts.kt`. It builds into `../intellij-plugin/src/main/resources/assets`, which the plugin serves from its classpath through a CEF scheme handler it registers for `https://erd-editor-jetbrains-plugin`. A change here keeps every emitted file servable by that handler and the commands in the order `cefQuery` sends them.

## Making a Change

1. Read `packages/intellij-plugin/AGENTS.md` with this file, since the plugin serves this bundle, answers its `cefQuery` requests and sends its host → webview messages. A change to the `WebviewHost` wiring or to a command also reads `packages/webview-client/AGENTS.md` and `packages/webview-bridge/AGENTS.md` (root step 1).
2. Skip root steps 3 and 4: this package has no `vitest.config.*`, so it has no `test` task and no coverage gate. Its `build` task, `tsc --noEmit` and then `vp build`, is the check; run it as Testing Requirements gives it.
3. Run root step 5; `pnpm build` runs this package's `build` too.
4. Open the change in a sandbox IDE with `./gradlew runIde` from `packages/intellij-plugin`, after the build, because `runIde` only checks that the bundle exists and a plain browser has no `cefQuery`. For a change to `dispatch` or to the order of commands, also run the IntelliJ plugin's smoke, whose step A11 checks that order (`packages/intellij-plugin/AGENTS.md` § Testing Requirements).
5. Before packaging the plugin, run `pnpm cache:clear` and rebuild (Rules § Build Output).
6. Report as root step 7 says. When `runIde` or the smoke did not run, name it as a check left out, with the reason: it needs a desktop IDE, and the smoke needs macOS.

## Key Files

| File | Description |
| --- | --- |
| `src/main.ts` | The adapter: a `cefQuery` `dispatch` and the replica worker's name; no `importFile`, no `resolveAppearance` |
| `src/env.d.ts` | Ambient `window.cefQuery` / `cefQueryCancel` types and `declare module '*.css'` |
| `src/webview.css` | Body sizing and the `prefers-color-scheme` background shown before the editor mounts |
| `index.html` | Build entry at the package root (`publicDir: false`) |
| `vite.config.ts` | `base: '/'`, the out-of-package `outDir`, `sourcemap: false`, `stripCrossorigin`, the `worker` block, `run.tasks.build` |

## Rules

### Build Output

- **`build` writes outside this package.** It writes into the plugin's gitignored `src/main/resources/assets` with `emptyOutDir: true`. Vite declines to clear an `outDir` outside the package root by default, and stale hashed bundles left there are packaged into the plugin jar.
- **`cache.output` is a literal glob.** The task's `cache.output` names that directory with a literal glob that is not derived from `outDir`, so a change to `outDir` must change that glob too. An explicit glob turns automatic write tracking off, so a cache hit restores only what it names.
- **Clear the cache before packaging.** A cache replay does not empty that directory (root § Working In This Directory). Run `pnpm cache:clear` and rebuild before packaging, so that no stale chunk ships in the jar.
- **`buildPlugin` and `runIde` do not build it.** They only check that the bundle exists (`verifyWebviewAssets`), so that pnpm does not run on every Gradle build. After a webview change, run the build in Testing Requirements or `./gradlew buildWebview`. On Windows run the pnpm build only, since `buildWebview` cannot start `pnpm.cmd` there.

### Serving

- **Emit only `.html`, `.js` and `.css`.** Keep `base` at `/` and `sourcemap: false`. The plugin's scheme handler serves the URL path from `/assets` on the classpath and sets a MIME type for those three extensions only.
- **Keep `stripCrossorigin`.** The scheme handler sends no CORS headers, so a `crossorigin` module script is refused and the panel stays blank.
- **Set no `build.target`.** JCEF's Chromium is the only browser this bundle runs in.

### Workers

- **Workers load from their URLs.** The page and every asset share one origin (`https://erd-editor-jetbrains-plugin`). So the editor's three SharedWorkers and the replica worker are emitted as `static/js/<name>.<hash>.js` and constructed from those URLs. There is no blob rebuild, unlike `vscode-webview`.
- **The `worker` block repeats the output naming.** Workers inherit no `build.rolldownOptions.output`, so the naming is written again there.
- **Workers build with `format: 'es'`.** They are module workers, and the iife default code-splits through `importScripts`, which a module worker cannot call.
- **Workers build with `codeSplitting: false`.** A worker's dynamic import fails with a network error in the IDE. ELK's split chunk would never arrive, and layout would never run.

### What This Host Leaves Unset

- **No `importFile`.** The editor's own file input imports, and `ErdEditor.kt` no-ops `hostImportFileCommand`.
- **No `resolveAppearance`.** The page cannot see the IDE's look and feel. The plugin sends its stored theme, Auto included, with the IDE's light or dark as `systemAppearance` in every `webviewUpdateThemeCommand`. `'auto'` without a `systemAppearance` would mean dark.
- **The display language comes from the plugin.** The plugin sends its stored language, Auto included, with the IDE's language as `systemLocale` in every `webviewUpdateLocaleCommand`. So the page's System follows the IDE, not JCEF's `navigator.languages`, which the page reads only until a `systemLocale` arrives.
- **Leave the language picker and welcome screen alone.** `mountWebview` turns both on for every host, so nothing here does.
- **`onSuccess` and `onFailure` stay no-ops by design.** The plugin answers every query it takes with an empty success, so the router keeps none pending. A command the plugin cannot parse or handle shows only as a `WARN` in `idea.log`.

### Command Order

- **The plugin keeps the order `cefQuery` sent.** It handles the commands over one channel per page, whichever of its message routers hears a query. At 2025.2 the router registered first hears every page's queries and hands each to the editor of the page that sent it. The order holds as long as CEF calls `onQuery` serially per browser. The plugin's live smoke sends 1,000 queries and checks the order (step A11).
- **Nothing here numbers the commands.** The order holds without it, as A11 checks. Should that order ever break, stamp each request here with a per-page sequence number (`{"seq": n, "command": action}`, from 0 at every load). Then have `WebviewBridge.kt`'s consumer, which parses each request, restore the order, with a case in `WebviewBridgeCommandTest`.

## Testing Requirements

- No `test` task: the build, `tsc --noEmit` first, is the gate.
- `cefQuery` is undefined in a plain browser, so under `pnpm --filter @dineug/erd-editor-intellij-webview dev` `mountWebview` throws on its first dispatch. Host round trips need the sandbox IDE.

```
pnpm exec vp run --filter @dineug/erd-editor-intellij-webview --fail-if-no-match build
pnpm --filter @dineug/erd-editor-intellij-webview typecheck
cd packages/intellij-plugin && ./gradlew runIde
```

## Dependencies

### Internal

`@dineug/erd-editor-webview-client` only. The editor, the bridge and the replica worker come through it.

### External

`core-js/stable`, imported for side effects.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
