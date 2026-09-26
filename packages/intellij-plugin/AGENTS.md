<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# intellij-plugin

## Purpose

The Kotlin/JVM half of the JetBrains plugin: a `FileEditor` for `.erd` / `.erd.json` running a JCEF browser bridged to the IDE. All editing logic is the bundle `intellij-webview` builds into `src/main/resources/assets`, served over a custom CEF scheme. pnpm sees only a `private` package.json; `pnpm build` and `pnpm test` skip it.

## Key Files

| File | Description |
| --- | --- |
| `build.gradle.kts` | Manifest from README and changelog, `buildWebview`, `verifyWebviewAssets`, Verifier range |
| `gradle.properties` | `pluginVersion`, `platformVersion` (2026.1.4), `pluginSinceBuild` (252), `javaVersion` (21), `gradleVersion` |
| `README.md` | Marketplace listing: the `<!-- Plugin description -->` markers are required, and the screenshot line is stripped by exact match — leave its URL alone |
| `CHANGELOG.md` | `versionPrefix` is `intellij-plugin-v`; bare `v*` tags belong to the editor |
| `.run/*.run.xml` | Run configs pinned to `IU-2026.1.4` — bump with `platformVersion` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/main/kotlin/…/editor/` | Provider, `ErdEditor`, JCEF panel, scheme handler, `WebviewBridge` / `WebviewScripts` |
| `src/main/kotlin/…/files/`, `…/settings/` | File recognition and icon; theme persistence over the message bus |
| `src/main/resources/icons/` | The file icon, the logo's two tables and their link in 1 px lines on the 16 px grid, with no page, as the New UI draws file types, in its purple, the color of its `sql` and `json` icons: `erd-editor-file-icon.svg` light (`#834DF0`), `_dark.svg` dark (`#B589EC`), which `IconLoader` picks under a dark theme. A filled page with the tables cut out blurred at 1.25x and 1.5x |

## For AI Agents

### Working In This Directory

- **Gradle only, from this directory**: `./gradlew buildWebview` (the pnpm webview build), `buildPlugin` (zip in `build/distributions/`), `runIde`, `verifyPlugin` (the 252 floor and the latest release), `check`. `buildPlugin` and `runIde` never build the webview (`verifyWebviewAssets` only checks it exists), so run `buildWebview` first on a fresh tree or after a webview change.
- **Publishing is manual**: bump `pluginVersion`, fill its `CHANGELOG.md` section, upload the zip.
- **Libraries come from the platform** (Jackson, coroutines, `org.cef.*`); adding one invites classloader conflicts. `apiVersion = KOTLIN_2_1` and no bundled stdlib keep to what the 2025.2 floor ships; use `intellijIdea(...)`, never `intellijIdeaCommunity(...)`.
- **Bridge `type` strings match `packages/webview-bridge` by hand.** A host command Jackson cannot map is dropped with only a WARN in `idea.log`; a `webview*` type the page does not register vanishes with no log at all. A new host command also needs its `@JsonSubTypes` entry.
- **Host → webview goes through `WebviewScripts.postMessageScript`**: JSON as a JS string literal, never a template literal, where a backtick in any name kills the script and `${…}` executes (`WebviewScriptsTest`).
- **Threading**: file writes inside `readAndEdtWriteAction { writeAction { … } }`, file dialogs on the EDT via `invokeLater`. **Disposable chain** `ErdEditor` → `WebviewPanel` → `Webview` → `JBCefBrowser`: register new resources into it and guard async callbacks with the `isDisposed` flags.
- **Saves**: `SaveValue` is debounced and `ErdEditor.dispose()` flushes the pending value before cancelling its scope — reversed, the last edit is lost. `SaveReplication` reaches other tabs on the same file only through `WebviewPanel.dispatchBroadcast` over `docToEditorsMap`.
- Pre-commit (`vp staged`) never sees Kotlin, and the root `.gitignore` has a bare `build`, so a Kotlin package named `build` would stay untracked.

### JCEF Gotchas

- `plugin.xml` depends on `com.intellij.modules.jcef` optionally (`jcef.xml`): mandatory stops loading on 2025.2/2025.3, absent kills the editor on 2026.2+ with `NoClassDefFoundError: JBCefApp`. The Verifier says `Compatible` either way; only a real install shows it.
- `SchemeHandlerFactory` extends `CefResourceHandlerAdapter`, never `CefResourceHandler` directly: the interface's abstract methods grew in 2026.2's JCEF, and a direct implementation compiled against the floor is binary-incompatible there.
- `WebviewPanel` init order is load-bearing: `JBCefApp.getInstance()` → register the scheme handler once per app → build `Webview` and `loadURL`. Registering after `loadURL` gives `DNS_PROBE_FINISHED_NXDOMAIN`; raw `CefApp.getInstance()` first gives "JCEF is not supported in this env". Never call the global `CefApp.clearSchemeHandlerFactories()`.
- macOS `⌥`+letter reaches the webview as a wrong `KeyboardEvent.code` (`KeyA`) and fires another shortcut; bind nothing to `Alt`+letter. The IDE keymap takes `⌘Z` / `⌘⇧Z` first.

### Testing Requirements

- `./gradlew check` runs the JVM tests (bridge serialization, script encoding, file matching) and Kover.
- JCEF cannot run headless, so the webview's only gate is the eye: `./gradlew runIde`, create an empty `foo.erd.json`, confirm the canvas renders — compilation and a `Compatible` verdict both pass on a blank panel. The since-build 252 and unresolved-optional-dependency warnings are expected.
- Sandbox log, with the webview's console: `.intellijPlatform/sandbox/erd-editor-intellij-plugin/IU-<version>/log/idea.log`. DevTools: Registry `ide.browser.jcef.contextMenu.devTools.enabled`, then reopen the tab.

## Dependencies

### Internal

`intellij-webview` (the assets); `webview-bridge` (the commands `WebviewBridge.kt` mirrors).

### External

The IntelliJ Platform and what it bundles; JUnit 4. Versions in `gradle/libs.versions.toml`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
