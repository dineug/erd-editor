<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# intellij-plugin

## Purpose

The Kotlin/JVM half of the JetBrains plugin: a thin host layer that registers a `FileEditor` for `.erd` / `.erd.json`, runs a JCEF webview, and bridges it to the IDE. All editing logic lives in the bundle `packages/intellij-webview` builds into `src/main/resources/assets`, which this package puts on the classpath and serves over a custom CEF scheme. It is the one Gradle project in the workspace; pnpm sees a `private` package.json with no `vite.config.ts`, so `pnpm build` and `pnpm test` walk past it.

## Key Files

| File | Description |
| --- | --- |
| `build.gradle.kts` | IntelliJ Platform Gradle Plugin 2.x. Injects the README's `<!-- Plugin description -->` section and the changelog into the manifest; `buildWebview` shells out to `vp run … build`, `verifyWebviewAssets` fails the build when the bundle is absent |
| `gradle.properties` | Single source for `pluginVersion`, `platformVersion`, `pluginSinceBuild` (252), `javaVersion` (21); `plugin.xml` carries neither a version nor a repository URL |
| `README.md` | The Marketplace listing. Removing the `<!-- Plugin description -->` markers is a `GradleException`; the screenshot line is stripped by exact string match, so leave its absolute URL alone |
| `CHANGELOG.md` | Keep a Changelog. `versionPrefix` is `intellij-plugin-v` — the monorepo's own `v*` tags belong to the editor |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/main/kotlin/…/editor/` | `FileEditor`, JCEF webview, scheme handler, host↔webview bridge |
| `src/main/kotlin/…/files\|settings/` | `.erd` / `.erd.json` recognition and icon; theme persistence over the message bus |
| `src/main/resources/` | The manifest, icons and message bundle, plus the generated `assets/` bundle |

## For AI Agents

### Working In This Directory

- **Gradle only, and always from this directory** — `cd packages/intellij-plugin && ./gradlew <task>`. There is no `run.tasks` block and no package.json script, by the workspace's one-command-surface rule.

  | Task | What it does |
  | --- | --- |
  | `buildWebview` | `vp run --filter @dineug/erd-editor-intellij-webview build` from the workspace root |
  | `buildPlugin` | Distributable zip → `build/distributions/` |
  | `runIde` | Sandbox IDE with the plugin loaded |
  | `verifyPlugin` | Plugin Verifier against the `pluginSinceBuild` floor and the newest release |

- `buildWebview` is intentionally separate from `buildPlugin`: the Gradle packaging task only runs `verifyWebviewAssets`. CI and a fresh local build must run `./gradlew buildWebview` or the equivalent pnpm task first.

- **Publishing is manual.** No token or signing key lives in this repository: build the zip and upload it. Bump `pluginVersion` and fill the matching `CHANGELOG.md` section first.
- **Dependencies come from the platform** — Jackson, `kotlinx.coroutines` and `org.cef.*` are all bundled, and adding a library here invites classloader conflicts. The build uses Kotlin 2.3.21, but `apiVersion = KOTLIN_2_1` limits compiled code to the Kotlin 2.1 API surface bundled by the 2025.2 floor, and `kotlin.stdlib.default.dependency = false` prevents shipping another stdlib copy. That floor is also why it resolves `intellijIdea(...)` and never `intellijIdeaCommunity(...)`: the separate IC distribution ended after 2025.2.
- **Bridge command `type` strings must match `packages/webview-bridge` exactly.** Change one side only and messages are dropped in silence.
- **Threading:** file writes go inside `readAndEdtWriteAction { writeAction { … } }` (the older `readAndWriteAction` is deprecated), file dialogs open on the EDT through `invokeLater`.
- `vp staged` globs `**/*.{ts,mts,tsx}`, so a Kotlin-only commit passes pre-commit unchecked. The root `.gitignore` also carries a bare `build` pattern — a Kotlin package named `build` would be untracked while compiling fine locally.

### Testing Requirements

`./gradlew check` runs 14 plain JVM tests: five bridge-serialization, six script-encoding and three extension-matching tests. JCEF cannot run headless, so **the eye is the only gate on the webview**: `./gradlew runIde`, open any project, create an empty `foo.erd.json`, and confirm the canvas renders. Compilation and a `Compatible` Verifier verdict both pass on a blank panel. `verifyPluginProjectConfiguration` warns that since-build 252 sits below the 261 target; that is the intended range. Sandbox logs are at `.intellijPlatform/sandbox/erd-editor-intellij-plugin/IU-<version>/log/idea.log` — a path the `.run/*.run.xml` configs pin to `IU-2026.1.4`, so bump those with `platformVersion`. The default appender drops DEBUG, so a missing `thisLogger().debug` line is not evidence; webview `console.*` is raised to INFO by `WebviewPanel`. For DevTools, enable `ide.browser.jcef.contextMenu.devTools.enabled` in the Registry and reopen the tab — `Webview.kt` disables the menu item, but the platform ORs it with that key.

### Common Patterns

- **Disposable chain** — `ErdEditor` → `WebviewPanel` → `Webview` → `JBCefBrowser`. Register new resources into it so they die with the tab, and guard async callbacks with the existing `isDisposed` flags.
- One `CoroutineScope(SupervisorJob() + CoroutineName(…))` per editor; saves debounce through `MutableStateFlow` + `debounce(100.milliseconds)` + `collectLatest`; `dispatchBroadcast` replicates to the other tabs on the same file via `docToEditorsMap`.
- Bridge commands are a sealed hierarchy with `JsonTypeInfo.As.EXISTING_PROPERTY`; register a new one in `@JsonSubTypes` as well.

### Gotchas

- **JCEF left the core in 2026.2.** `plugin.xml` declares `<depends optional="true" config-file="jcef.xml">com.intellij.modules.jcef</depends>`: mandatory breaks loading on 2025.2/2025.3, where that plugin does not exist, and declaring nothing kills the editor on 2026.2+ with `NoClassDefFoundError: JBCefApp`. The Verifier reports `Compatible` either way — it does not model per-module classloader isolation, and the sandbox runs the build target. Only a real install shows it. The unresolved-optional-dependency warning on 252–261 is expected.
- **`SchemeHandlerFactory` extends `CefResourceHandlerAdapter` rather than implementing `CefResourceHandler`.** The interface widened in the JCEF that 2026.2 bundles (4 abstract methods → 7); an anonymous class compiled against the floor would be binary-incompatible there. The adapter exists on every supported build and fills in the compatibility sentinels. For the same reason `ErdEditorProvider` stays on `FileEditorProvider` — `AsyncFileEditorProvider` inherits an `@Experimental` `createFileEditor` even when unwritten, and the Verifier counts it.
- **The JCEF init order in `WebviewPanel` is load-bearing:** `JBCefApp.getInstance()` → register the scheme handler once per app → build `Webview` and `loadURL`. Registering after `loadURL` makes out-of-process Chromium resolve the scheme host through DNS (`DNS_PROBE_FINISHED_NXDOMAIN`); touching raw `CefApp.getInstance()` first throws `JCEF is not supported in this env`. `CefApp.clearSchemeHandlerFactories()` is global — never call it.
- **macOS `⌥`+letter shortcuts reach the webview corrupted.** JCEF derives the native keycode from the *character*, and the Option layer of a Latin layout produces non-ASCII, which falls back to `0` = `kVK_ANSI_A` — so `KeyboardEvent.code` arrives as a plausible-but-wrong `"KeyA"` and a different shortcut fires. Korean input sources keep roman characters on that layer, which is why it reads as an IME bug. No registry flag or webview-side fallback exists; rebind away from `Alt`+letter. Unaffected: no modifier, `Shift`, `⌘`, `⇧⌘`, and the ~40 VK special keys. Separately, `⌘Z`/`⌘⇧Z` are eaten by the IDE keymap before the webview sees them.

## Dependencies

### Internal

`@dineug/erd-editor-intellij-webview` produces `src/main/resources/assets`; the `@dineug/erd-editor-webview-bridge` command definitions are the contract `WebviewBridge.kt` mirrors.

### External

IntelliJ Platform 2026.1.4 (`FileEditor`, JCEF, VFS, message bus, `PersistentStateComponent`), Kotlin 2.3.21 + coroutines and Jackson — all from the platform. Build side: IntelliJ Platform Gradle Plugin 2.18.1 with the wrapper pinned to Gradle 9.1.0, gradle-changelog-plugin 2.5.0, Kover 0.9.9, Qodana 2026.2.0 (configured, not wired into CI).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
