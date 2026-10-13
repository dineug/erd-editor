<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-26 | Updated: 2026-10-11 -->

# obsidian-plugin

## Purpose

ERD Editor's Obsidian plugin: a `TextFileView` showing `<erd-editor>` in a tab for `.erd`, `.vuerd`, `.erd.json` and `.vuerd.json` files. Each vault window also serves the document hub `agent-hub` specifies, over `agent-hub-host`, so a coding agent running `@dineug/erd-editor-mcp` edits that window's open diagrams live, as in VS Code. `dist/` (`main.js`, `manifest.json`, `styles.css`) is the whole plugin folder, released from `dineug/erd-editor-obsidian-plugin` (root § Contracts Outside This Repo). A change keeps two things intact: only a file's first tab writes it, from the replica's value, and every tab writes before the hub drops its lock.

## Making a Change

Deltas from root § Making a Change.

1. **Read the sibling files the change reaches**: `packages/agent-hub-host/AGENTS.md` and `packages/vscode-extension/AGENTS.md` for the hub, `packages/mcp-server/AGENTS.md` for agent saves, `packages/erd-editor/AGENTS.md` for the element's API and `createKeyBindingMap`, its `src/components/erd/AGENTS.md` for the editor's keys and the welcome screen, and its `src/i18n/AGENTS.md` for the display language.
2. **Put each pure decision in a measured module** with its spec, since only the smoke reaches the rest (Testing Requirements).
3. **Run root steps 3 to 5** with the commands in Testing Requirements.
4. **Run `smoke` for a change seen in Obsidian** (root step 6), by a user or an agent, on macOS or Windows after building `@dineug/erd-editor-mcp`.
5. **Update the READMEs the change makes false**: this package's for a user-visible change (root § Common Patterns), and the release repository's for what the hub writes outside the vault or a network request (root § Contracts Outside This Repo).
6. **Report the smoke** (root step 7): the platform and the Obsidian version it printed, or why it did not run.

## Key Files

| File | Description |
| --- | --- |
| `src/main.ts` | The plugin: registration, the `openFile` wrapper, export, the create command, the registry, theme and language (`setTheme`, `applyTheme`, `setLocale`, `applyLocale`), the `quit` and `pagehide` handlers, `startHub`, the hub's vault adapter, the settings tab |
| `src/ErdView.ts` | The tab, a `HubTab`: load, replica, relay, seeding, `saveBeforeExit`, read-only fallback, theme and language events, welcome screen, shortcut `scope` |
| `src/settings.ts` | `PluginSettings` (`data.json`), `DEFAULT_SETTINGS`, `readSettings` / `readTheme`, `editorTheme`, `themeFromBuilder`, `ThemeHost`, `LOCALES` / `LOCALE_NAMES`, `editorLocale`, `localeFromPicker`, `obsidianLanguage`, `LocaleHost` |
| `src/tabSave.ts` | `viewData`, `currentValue`, `hasUnsavedValue`, `exitSave`, `seedValue`, pure functions of `TabSaveState` |
| `src/keys.ts` | `scopeKeysOf` / `toScopeKey`: the editor's chords as `Scope.register` modifiers and key, each press once |
| `src/icon.ts` | `ERD_ICON` / `ERD_ICON_SVG`, for the tab and the New ERD menu item |
| `src/loadErdEditor.ts` | Requires `@dineug/erd-editor` once per window (§ Build) |
| `src/hub/registry.ts` | `DocumentRegistry` (§ Coding-agent hub), with `seedWhenQuiet`, `setActive` / `keepActive`, `shutdown` |
| `src/hub/handlers.ts` | `createDocumentHandler`: `listDocuments`, `openDocument`, `join`, `applyActions`, `leave`, `save`, `disconnect` |
| `src/hub/host.ts` | `HubSwitch` (the Coding agents setting, with listeners), `createObsidianHost`, `pidSandbox` |
| `src/hub/runtime.ts` | `createHubRuntime`: a `ManagedRuntime` of the registry's layers and `documentHubLayer`; `start`, `dispose`, `releaseSync` |
| `src/hub/lifecycle.ts` | `HubLifecycle`: start, ordered stop, `releaseSync` |
| `src/hub/types.ts` | `HubTab`, `HubVault`, `VaultFile`, `CreateOutcome` |
| `src/hub/imports.test.ts` | No runtime `obsidian`, `@/ErdView`, `@/main` or `@/loadErdEditor` in `src/hub/`; effect's named entries only in `src/` |
| `src/__test-utils__/hub.ts` | `createHubHarness` (registry and handler on a memory disk and vault double), `FakeTab`, connection doubles, `servePeer` (shipping `serveConnection` on a real socket) |
| `src/__test-utils__/diagram.ts` | `createDiagram` (a headless `PeerStore` from `erd-editor`'s `peer.js`: a tab's editor and replica, or an agent), `usersDiagram`, `removeTable`, `receiveAll`, `shownTable` |
| `vite.config.ts` / `vitest.config.ts` | CommonJS library build: `inlineUrlWorkers`, `base64InlineWorkers`, `pluginFiles`, `noBrowserExternal`, `run.tasks.build` / `.test`; Vitest in Node, coverage (Testing Requirements) |
| `manifest.json` / `versions.json` | Plugin metadata; the release repository copies both to its root |
| `styles.css` | Tab layout, containment override |
| `e2e/smoke.mjs`, `e2e/mcp.mjs` | The smoke; its MCP client (JSON-RPC lines over the server's stdio) |

## Rules

### Build

- **Every worker is inlined**: Obsidian loads `main.js` alone, with no file beside it to spawn one from. `inlineUrlWorkers` rewrites each `new SharedWorker(new URL(…, import.meta.url))` / `new Worker(…)` in `erd-editor`'s and `replication-store-worker`'s `dist/` (as `tools/vite/worker-url.ts` spells it) to `?sharedworker&inline` / `?worker&inline`, failing the build if one survives. `base64InlineWorkers` (`tools/vite/inline-worker.ts`, as in `erd-editor`'s UMD build) re-encodes a shared worker's data URL under Chromium's URL cap; the replica starts from a blob. `worker.format` is `es` with `codeSplitting: false`, as module workers cannot load a chunk from a data or blob URL.
- **Node builtins stay external, prefixed or bare.** The renderer runs Node (`nodeIntegration`); the hub and `@effect/platform-node` import `node:net`, `node:fs`, `node:fs/promises`, `node:os`, `node:crypto`, `node:path`. `builtinModules` lists almost no `node:` names, and a missed builtin becomes Vite's empty browser stub with only a warning: a `net` without `createServer`. `noBrowserExternal` fails the build when a chunk's `moduleIds` name `__vite-browser-external`, since minified code keeps no trace of the stub.
- **`<erd-editor>` is defined once per window**, as importing defines it and `customElements.define` cannot repeat. So `loadErdEditor` requires it once (`require()`, which Rolldown initializes lazily) and keeps the module on a global symbol: a re-enabled plugin reuses it and a new build needs an Obsidian restart. The lazy form splits each inline worker's source from its declaration, so `readStringLiteral` also reads a bare assignment.
- **Desktop only.** `isDesktopOnly` is true: mobile is unchecked, Chrome on Android has no SharedWorker, and the hub needs Node.
- **Main window only.** Popouts are unsupported, as `<erd-editor>` is defined in the main window's registry only. On 1.12.7 a popout tab's element, with the editor's API, threw `Sharing constructed stylesheets in multiple documents is not allowed` rendering; nothing further was checked. `applyTheme` and `applyLocale` still reach such a tab.

### Opening files

- **`.erd.json` / `.vuerd.json` go through a wrapped `openFile`.** Obsidian types a file by its last extension, `registerExtensions(['erd.json'])` does nothing, and registering `json` would claim every JSON file. So `main.ts` wraps `WorkspaceLeaf.prototype.openFile` with `monkey-around`, mirroring the core (the `file` guard, `active` defaulting to the active leaf, `group`, `eState`), and matches the suffix in any case (`a.ERD.json`), like the hub and the MCP server. The file explorer and quick switcher show these files only with Detect all file extensions on.
- **Unreadable files open read-only** (not JSON, or no `doc` or `canvas` at the top), and `getViewData` returns their text, so a merge conflict or a cut-off sync never becomes an empty diagram. It returns the text, not `editor.value`, since `readonly` still lets viewport actions through.
- **`isPlaintext` is false**: an outside change during an unsaved edit wins and drops the edit; the default merges both into the JSON as text.
- **A load settles what the editor derives** (key marks, widths, anchors, relationship flags) before its reducer returns, and the file form keeps none of it, so an inconsistent document (FK flags with no relationship) changes only with an edit.
- **The welcome screen waits for a document.** `onOpen` creates the editor, often before the tab has its file, with no document and `enableWelcomeScreen` off; `loadDocument` turns it on right after `setInitialValue`. The editor then shows it while the diagram has no table, memo or shown table group and is not read-only. So it never shows before a tab's first file is in, over a tab waiting to seed (read-only, after a file switch too) or over an unreadable file. An empty file loads as an empty diagram and opens on it. The first table, memo or shown table group takes it away.
- **`styles.css` overrides `contain: strict !important`** on diagram leaves only: layout or paint containment makes the leaf the box `position: fixed` resolves against, which offset the editor's menus, placed in viewport coordinates.
- **Export** goes through `setExportFileCallback` to `fileManager.getAvailablePathForAttachment`, replacing the characters Obsidian refuses in a name.

### Saving

- **Save through the replica worker only**, as the IDE hosts do, so the tab never stringifies the document on the main thread, even on close; never serialize with `editor.value`. `subscribe` relays every shared-store action (`webviewReplicationCommand`), the replica posts `hostSaveValueCommand` 200 ms after the last change, and `requestSave` writes it. A replica error shows a Notice.
- **A value with `changed` false is not kept** (a scroll, a zoom, anything the file form keeps nothing of): not as `replicaValue`, not saved. `registry.valueSaved` counts it for the quiet wait and takes its `runtimeValue`, not its content. Kept, `getViewData` would return it and the close save would rewrite a file an older release or a hand edit wrote, whose bytes the replica's value need not have.
- **Opening never rewrites a file**: the core `save` writes only when `getViewData()` differs from the text last loaded or saved, and `getViewData` returns the loaded text until the replica sends a value. Otherwise a `.vuerd` would migrate and any file reformat.
- **Every load starts a new replica**, as `setInitialValue` does not cancel its debounce: a replica kept across a file switch or an outside reload could post the previous document after the next one loaded, to be saved over it.

### Exit writes

- **Leaving a file saves the replica's last value**, whether by closing, switching, reloading or quitting. The core close saves through `getViewData` (`save(true)` from `onUnloadFile`). An edit in the replica's last 200 ms is lost, as when an IDE webview closes.
- **The window going writes synchronously.** A quit or reload skips the 2 s `requestSave`, a quit-task write never lands on Windows (§ Obsidian versions), and a 1.13 reload fires no `quit`. So `main.ts`'s one `workspace.on('quit')` and one `pagehide` handler call `saveBeforeExit` on every ERD tab, and the writer writes its unsaved value with `writeFileSync` to `adapter.getFullPath(file.path)` before the handler returns.
- **`exitSave` (`tabSave.ts`) decides:**
  - no unsaved value, no write, so a file's tabs never both write (`hasUnsavedValue`: the writer only, never a waiting or unreadable tab or before the file loaded);
  - the tab's own write under way (`saving`) leaves the value to a quit task, `saveDocument`, which waits it out and saves again: a sync write over an async one left the file mixed in 80 of 80 scratch runs;
  - otherwise it writes only if the file holds exactly `lastSavedData`, set by the core save before writing, so a half-written file differs too; anything else is an undelivered outside change, which wins, as with `isPlaintext` false;
  - it reads the file without one leading byte order mark, as `Vault.read` drops it from `lastSavedData`; with it, such a file looked changed, and a quit before the timed save lost the edit;
  - an unreadable file, a failed write (`console.error`) or no disk path falls back to the quit task.
- **Then the tab sets `data`, `lastSavedData` and `dirty`** like `TextFileView.save`, so the pending `requestSave`, the core `quit` handler and a `pagehide` after `quit` find nothing to write. It writes in place like the adapter (through a symlink, keeping identity and permissions) and cannot tear, the page's thread being blocked. The vault hears nothing (`TFile.stat` and metadata lag); should the page stay, the watcher's `modify` finds `lastSavedData` equal.
- **Tabs write, then the hub releases.** The same handler then calls `releaseSync`, deleting the lock and socket before it returns, since `onunload` never runs as a window closes, reloads or quits. So no agent goes headless on a file a tab is about to write in place. A quit task left for a write under way runs after that and may not land on Windows. A tab closed a few ms before the quit is not covered: its closing `save(true)` cleared `lastSavedData` and is async.
- **A `quit` task is only a fallback.** It turns 1.12's Reload app into a window close, as Obsidian core does for its unsaved views. So the plugin queues one only while a write is under way or the sync write falls back, and none for the hub.
- **`onUnloadFile` first calls `flushStreamBuffers()`**, so the other tabs keep a stream group held for its quiet period (a color, a memo resize).
- **Keep `await super.onClose()` before `destroy()`**, as the core close saves through `getViewData` and `destroy()` would empty the document first.
- **Name no `ErdView` method `load` or `unload`**, since those are `Component`'s lifecycle methods.

### Tabs of one file

- **A file's tabs stay in step**, as `vscode-extension` broadcasts between a document's webviews: the registry groups tabs by `TFile`, and a tab's shared-store actions go at once to its replica and to every other tab's shared store and replica.
- **The first tab alone writes the file**; another returns `lastSavedData` (`viewData`), so two never write at once. The writer's save returning as a modify event is recognised (`handedByFile`, or the tab's replica value) and not reloaded, keeping undo. An outside change reloads every tab.
- **Shared stores belong to files, not tabs**: created after the document loads, destroyed when the tab leaves the file. A store's first `subscribe` sends `getLWW` and the other tabs answer `mergeLWW`, so the new tab's clock and last-writer-wins state match and its first edit is not taken for an older one. Subscribing before joining (in `onOpen`) asked no one.

### Seeding a tab opened beside another

- **Load the runtime value, keep the file form.** `seed` gets the `runtimeValue` of the file's last replica save, removed entities included, for the editor and new replica. So an entity the other tab removed comes back whole here when that tab undoes it. The tab keeps the file form as `loadedData`, which `getViewData` returns; as writer it would otherwise write the removed entities. `seedValue` holds this; `tabSave.test.ts` pins both.
- **Seed once the other tabs are quiet**, since a value read right after an edit lags it by the replica's 200 ms and the new tab, as writer, would write the file without that edit. `seed` waits on `registry.seedWhenQuiet` for the replicas' saves while the quiet state is pending, `JOIN_QUIET_CAP_MS` (500 ms) at most, as a join does, checks again on resuming, then loads the runtime value and keeps the peer's.
- **With no peer, keep what the writer handed.** With no other tab holding the document (the first closed during the wait, or all others show an unreadable file), the tab keeps `handedByFile`, else Obsidian's last text for it. That writer's close-write modify event can arrive after the wait, to be skipped as the writer's own. Its editor still loads the runtime value while the registry holds one, else that text.
- **An outside change drops `handedByFile`**, which the file no longer holds. Kept, it let a tab opened beside one an outside change made unreadable (a merge conflict) load the writer's earlier value editable and, as writer, write it over the conflict; the smoke's step fails on a build that keeps it.
- **A waiting tab is read-only and not live**: it has no replica, so neither the hub nor another tab injects into it and nothing would relay its edits. It shows `onOpen`'s empty canvas, or the previous file's diagram after a file switch; `loadDocument` restores the file's read-only state.
- **A waiting tab returns `lastSavedData`**, which Obsidian moves on every write, never its open-time text, which would overwrite the close write's edits. So one that became writer when the first tab closed during the wait writes nothing over that close write, adds no quit task, and `erd_save` finds nothing to write.
- **A tab leaving its file is no peer**: `hasDocument` is false during its `onUnloadFile`. Obsidian's closing `save(true)` calls `clear()` before writing, which empties the tab's loaded and replica values. The tab stays first tab, store open, until the write returns. A tab seeding then loaded the empty text and, as writer, wrote it over the file. So a seeding tab keeps `handedByFile`, what the closing save writes, and loads the registry's runtime value, as the smoke's slow-close step (write held back 3 s) checks.
- **What the wait misses.** Leaving the file cancels it, and an outside change loads the file's version at once. Edits in the other tab past the cap with no replica save between can be missed, as by a join. A stream group the other tab still holds reaches the new one once it subscribes.

### Theme

- **The theme is a per-vault setting**, saved as `vscode-extension` saves its own: `data.json` has `appearance` (`auto`, `light` or `dark`, default `auto`), `grayColor` (default `slate`) and `accentColor` (default `indigo`) beside `agentHub` and `locale`. `readSettings` takes only the three appearances and webview-bridge's `GrayColor` / `AccentColor` values, else the default.
- **A pick anywhere re-themes every tab.** Each tab sets `enableThemeBuilder` and listens for `changePresetTheme`; `ThemeHost.picked` saves the pick and `applyTheme` re-themes every ERD leaf of the vault (`getLeavesOfType`, popouts included), as the settings tab's three dropdowns do. `onExternalSettingsChange` (a sync changing `data.json`) re-reads the settings, re-themes, re-applies the display language and sets the hub switch; `onload` applies the theme again for tabs the layout restored before they loaded.
- **`auto` is the editor's `system`**, the builder's System: `setPresetTheme` gets `system`, and `setSystemAppearance` the light or dark of Obsidian's `theme-dark` body class, resent on `css-change` whatever the setting, as the builder can pick System any time.
- **`themeFromBuilder` saves the pick as it comes**, `system` as `auto`: a color picked under System keeps `auto`, and Light or Dark replaces it, even the one Obsidian shows. `vscode-extension` and the IntelliJ plugin do the same.

### Display language

- **The display language is a per-vault setting too**, handled like the theme: `locale` is `auto` (the default) or one of the 25 codes of webview-bridge's `LocaleLabel`, anything else read as `auto`. The Display language dropdown, after Accent color, offers Auto, then each language by its own name (`LOCALE_NAMES`, in the editor's picker order).
- **The plugin's own strings (settings, Notices) stay English**: the owner decisions of 2026-10-06 translate the editor and leave each host's own UI as it is.
- **The first paint is in that language**: each tab sets `enableLocalePicker` and listens for `changeLocale` in `onOpen`, in the task that creates the editor, and `applyLocale` sends `setSystemLocale`, then `setLocale`.
- **A pick re-applies every tab.** `localeFromPicker` takes the picker's or the palette's pick as it comes, `system` as `auto`; `LocaleHost.picked` hands it to `main.ts`'s `setLocale`, which saves it, re-applies every ERD leaf (`getLeavesOfType`, popouts included) and refreshes the settings tab. `onload` applies it again for restored tabs.
- **`auto` follows Obsidian's language**: the editor's `system`, from the tag `obsidianLanguage` gives `setSystemLocale`. That is `getLanguage()` (added in Obsidian 1.8.7; `main.ts` checks it with `typeof`, as `minAppVersion` predates it), else `localStorage`'s `language` key, which `getLanguage` reads. Else it is `null`, leaving the editor to `navigator.languages`, where Obsidian with no stored language takes its own too. 1.13.7's `getLanguage` reads that key, else `navigator.language` or its language part where Obsidian has a translation, else `en`.
- **Obsidian's `pt` goes over as `pt-PT`**: it is European Portuguese, and the editor reads a bare `pt` as Brazilian. A tag the editor lacks shows English. Obsidian reads its language as its window loads; the plugin listens for no change.
- **`EditorLocale.locale` is typed as the element's `setLocale` parameter**, so a code the bridge lists and the editor lacks fails the type check.

### Shortcuts

- **Obsidian's hotkeys take keys before the page**: its keymap listens for `keydown` on the window in the capture phase, sending a key matching a hotkey to its command, prevented and stopped, even where the command does not apply. `Alt+Enter` (add column) is Follow link under cursor, `$mod+K` (search) Insert Markdown link, `$mod+F` (Find and Replace, the Explorer's search) Search current file, and a user's hotkey can take any shortcut.
- **The view's `scope` hands the editor its keys.** The workspace asks the active leaf's `view.scope` first, as for Obsidian's canvas view; `Scope.handleKey` returns the first matching registration's result, and the keymap prevents the key only on `false`. So `ErdView` sets `this.scope = new Scope(this.app.scope)` and registers every press of the loaded module's `createKeyBindingMap()` (the element's defaults, never a copy) with a handler returning `true`: no command runs, and the key reaches the editor.
- **`scopeKeysOf` spells keys as the keymap matches them**, reading the key code as a letter, digit or name: `$mod` → `Mod`, `Control` → `Ctrl`, `KeyK` → `K`, `Digit1` → `1`, `Space` → `' '`, `Equal` → `=`, `Minus` → `-`.
- **Other hotkeys fall through to `app.scope`** (the command palette, the quick switcher, closing a tab, settings). The scope holds only while the ERD leaf is active, wherever focus is in it; a modal or a menu pushes its own scope, which the view's never reaches.
- **`Mod+S` stays Obsidian's Save current file** (`editor:save-file`, unregistered by the plugin), saving the active `TextFileView`: the writer writes its replica's last value at once, another tab nothing, its `getViewData` being the file's text. A save within 200 ms of an edit writes the value before it; the autosave writes the edit 2 s later.
- **A module from an earlier plugin version**, which `loadErdEditor` keeps until a restart, has no `createKeyBindingMap`: its tabs register nothing and Obsidian's hotkeys win.

### Icon

- **The icon is the logo, in lines** (`icon.ts`): its two tables and their link, the IntelliJ plugin's file icon on Lucide's 24 grid, added with `addIcon` on load, removed on unload. `addIcon` only wraps it in `<svg viewBox="0 0 100 100">`, so the content sets `fill`, `stroke` (`currentColor`), joins and scale itself, and names no `stroke-width`, inheriting Obsidian's `--icon-stroke` in the grid's units like the Lucide icons beside it.

### Coding-agent hub

- **One hub per vault window**, in its plugin instance: windows have their own renderers, so the lock and socket are `~/.erd-editor/ide/<renderer pid>.json` / `.sock`, and a popout shares its window's pid and instance. `createObsidianHost` names the ide `obsidian` and one folder, the native real path of `FileSystemAdapter.getBasePath()`, with no folder event (one vault per window). The lock's `version` is `this.manifest.version`, never a constant.
- **Messages match `vscode-extension`'s** where the situation does, from the same constructors in `agent-hub-host`'s `documentRules.ts`; the host-naming one says `Obsidian could not open <path> in the ERD editor: …`. Read-only view refusals name no editor and differ from VS Code's with the case: an unreadable file here, a git or merge view there.
- **`src/hub/` imports only types from `obsidian`**, which has no runtime, and reaches Obsidian through `HubTab` (`ErdView`) and `HubVault` (built in `main.ts`), so its specs run in Node; `imports.test.ts` counts `require` and dynamic `import` too.
- **The registry lives from plugin load**, hub listening or not, so `observedVersion` covers every emission. A document is one `TFile` and its tabs, keyed by native real path once `realpath` resolved; a rename bumps a generation, so a late step of the old path lands nowhere.
- **Only ready tabs count** for `openDocument`, `applyActions` and waiters: loaded, shared store open on a readable document, path resolved. An unreadable file is a read-only view: `join` answers its text with `readonly`, edits and `save` answer `readonly`, `openDocument` answers at once, not after 5 s.
- **Each document has two mirrors**: `content`, compared for `dirty`, the file form of the first load and of each replica save that changed it; and `runtimeValue`, the document as any tab's last replica save held it, `changed` or not. `join` hands a peer the runtime value (the content until a replica saved), so undoing a removal made before the join restores the entity whole for the agent. Nothing writes it; an outside change drops it, a rename keeps it, the last tab closing takes it along.
- **Joins and saves wait for quiet.** A change notes the live tabs it reached. A join waits for their saves (500 ms cap), then captures the runtime value (else the content) and `observedVersion` in one step, its window ending on a timer after the response. `save` waits 2 s at most and answers `saved: false`, writing nothing, if no replica saved the edit.
- **Outside changes that reload start a new document**: peers hear `documentClosed`, the quiet state restarts, `observedVersion` stays monotonic. A rename sends `documentClosed` for the old path and lists the new one.
- **`listDocuments`** lists open documents, then the vault's ERD files (`erdFileProblem` filters `vault.getFiles()`), each once by real path; `dirty` is the writer's content against what the file last took, or a pending quiet wait; `active` is the last-focused ERD tab's file.
- **`openDocument` keeps the user's focus.** A ready tab answers at once. Otherwise it registers its waiter before any IO, then creates through `vault.create` if asked (an existing file is kept, a missing folder answers `notFound`), loads a deferred leaf showing the file, or opens a background tab (`getLeaf('tab').openFile(file, { active: false })`). Always focus new tabs, Obsidian's default, still focuses it and its load claims the active document, so `main.ts` restores both (`registry.keepActive`); from a note, unseen by ERD tabs, the background tab would stay `active`. A real path maps to a `TFile` relative to the vault folder's real path, else by scanning the ERD files' real paths.
- **Agent edits autosave like the user's**, about 2 s after each replica value: one document cannot tell them apart. `erd_save` writes at once through the writer's `TextFileView.save` and answers whether the file then holds the tab's value; the MCP server's wording states the difference from VS Code, which keeps agent edits unsaved until `erd_save`.
- **Coding agents is the settings tab's last row**, one toggle after the theme dropdowns and Display language, in `PluginSettingTab.display()`, as `minAppVersion` predates 1.13's `getSettingDefinitions`; on by default like the extension's, kept per vault in `data.json` (`loadData` / `saveData`). Off, the hub writes a `hub: false` lock with no pipe, refusing agent writes by the setting's name; on, it listens again.
- **`onunload` (disable, update) stops the hub in order**: `HubLifecycle.stop` sends each peer `documentClosed` for every path it joined or read, drains those frames (1 s at most), then disposes the runtime within `DISPOSE_TIMEOUT` (5 s), so a stalled hub task never blocks the next instance. `runtime.test.ts` pins it on a listen that never returns.
- **Keep the hub layer off merges** (`Layer.merge`, `Layer.mergeAll`, array provides), or the timeout never gives up (`agent-hub-host`'s AGENTS.md § Shutdown, which names this runtime's `Layer.tap` and `Layer.provide`); the `Layer.mergeAll`s of the documents and of `main.ts`'s machine build beside the hub, not around it.
- **A new instance waits for the last close.** `onunload` is not awaited, and the next `onload` can run in the same millisecond on the same pid. So the closing promise sits under a `Symbol.for` key, and the next hub starts once it settled. Closes chain, else a third instance, after one stopped while still waiting (no hub, closes at once), would bind the pipe and write the lock the first close deletes. Past the timeout the old close can still delete the next instance's lock and, on POSIX, its socket file (`agent-hub-host`'s AGENTS.md § Same-pid restarts). On Windows the next instance cannot listen while the old one holds the pipe, and serves no agent until Coding agents is turned off and on.
- **Outside the vault** the hub writes its lock and socket under `~/.erd-editor/ide`, deleting dead windows' ones, and listens on a local socket only, with no network request; the release repository's README discloses this (root § Contracts Outside This Repo).
- **No hub in a Flatpak.** Flathub's Obsidian has its own pid namespace, sharing the home folder, where no outside pid lives and its own pid means nothing outside. Its startup sweep would delete every live window's lock and socket, and an outside MCP server would take its lock for dead and write its open files behind it. `pidSandbox` (Linux, `FLATPAK_ID` or `/.flatpak-info`) stops `startHub` before any runtime, so no lock, sweep or socket, and agents edit files on disk as with the plugin off. With Coding agents on, a Notice says so on load and the setting's description says why; turning it off stops the Notice. Not checked in a real Flatpak.

### Obsidian versions

Measured on macOS unless Windows is named.

- **Two versions on one machine.** Over the 1.12.7 `/Applications` bundle Obsidian loads a newer `obsidian-<version>.asar` from its user data folder (1.13.7 here); a fresh `--user-data-dir` starts on the bundle and fetches the update for its next launch.
- **1.12.7 fires `quit` on close, reload and quit** of the window or app. The sync exit write has not been run on 1.12.7. Its `quit` is taken to fire inside `beforeunload` like 1.13.7's, which the smoke on the macOS bundle checks.
- **1.13.7 fires `quit` only for a closing window** (`sendSync('is-closing')`), synchronously inside `window.onbeforeunload`. A reload fires none, so `pagehide` also writes the tabs and releases.
- **On Windows no async quit task lands** (1.13.7 installer, 2026-09-27), Obsidian's own for notes included. The page unloads 2 to 24 ms after `beforeunload` though Obsidian prevented it, and a quit ends the process. Everywhere, the main process destroys a closing window 3 s after `close`, quit tasks finished or not.
- **1.13.7 can undo a second `app.changeTheme`** made within about a second, before the first reached `.obsidian/appearance.json`, so the smoke waits for the file to hold each switch.
- **In both, a quit task ends in `window.close()`**, leaving the macOS app up windowless; the smoke stops its spawned pid. `TFile.saving` is a flag in 1.12, which overlapping writes can leave set, and a count of writes under way in 1.13.
- **1.13.7's Settings popout can stall a hub restart.** A hub restarted from that popout can leave uncaught `illegal access` errors: the Coding agents toggle, or enabling or updating the plugin in Community plugins. In some tries the next agent call then waits for its `hello` until the MCP server's 30 s timeout. The call after recovers, nothing is lost, and the cause is unknown. Through `setAgentHub` with no popout open, the hub answered every hello in ten tries. So the smoke toggles it that way and looks at the settings tab only before any restart. It picks theme dropdowns, which restart nothing, in the popout.
- **Stray `illegal access` errors are a known limitation**: one 1.13.7 run in about ten caught three with no hub restarted from the popout, later runs none, source unknown. So rerun a failed no page errors step before taking it for a regression, and read the `(after: …)` step each error names.

## Testing Requirements

- **The specs measure the pure modules.** The `test` task (`tsc --noEmit`, then Vitest in Node) and `test:coverage` cover `src/hub/`, `src/keys.ts`, `src/settings.ts` and `src/tabSave.ts`. `main.ts`, `ErdView.ts` and `loadErdEditor.ts` run only inside Obsidian (`obsidian` ships types, no runtime; the editor needs a window), so the smoke covers them (Making a Change step 2).
- **What the specs pin.**
  - `settings.test.ts`: the defaults, the fallback of unknown values, and every function and constant the `src/settings.ts` row names.
  - `tabSave.test.ts`: what a tab hands Obsidian to save, a tab waiting to load among them, what `exitSave` does as the window goes, and what `seedValue` gives a tab opened beside others.
  - `keys.test.ts`: how each spelling the editor's shortcuts use becomes a scope key.
  - The hub specs: `registry.test.ts` (tabs, relays, quiet waits, seeding, content, the runtime value, the lock's documents, shutdown), `join.test.ts` (the join window, an agent joining after a removal the tab then undoes, and over a real socket, a named pipe on Windows, the response ahead of queued actions), `handlers.test.ts` and `runtime.test.ts` run the registry and the handler over `createHubHarness`, beside `host.test.ts`, `lifecycle.test.ts` and `imports.test.ts`.
  - `runtime.test.ts` uses its own memory doubles of `agent-hub-host`'s `HubEnvironment`, `HubListener` and `LockFile` services, never the node layers, which would write a lock under the real home.
- **`smoke` runs by hand**, on macOS or Windows with Obsidian installed: it is the check that the plugin works, and CI does not run it.

```
pnpm exec vp run --filter @dineug/erd-editor-obsidian-plugin --fail-if-no-match build
pnpm exec vp run --filter @dineug/erd-editor-obsidian-plugin --fail-if-no-match test
pnpm --filter @dineug/erd-editor-obsidian-plugin test:coverage
pnpm exec vp run --filter @dineug/erd-editor-mcp --fail-if-no-match build   # the smoke's agent
pnpm --filter @dineug/erd-editor-obsidian-plugin smoke
OBSIDIAN_ASAR="$HOME/Library/Application Support/obsidian/obsidian-1.13.7.asar" pnpm --filter @dineug/erd-editor-obsidian-plugin smoke
```

### The smoke

- **Setup.** It copies `dist/` into a throwaway vault, starts Obsidian with its own `--user-data-dir` (your vaults untouched), attaches over CDP only once that instance's `DevToolsActivePort` and vault folder are its own, and prints the Obsidian version. It gives Obsidian a language the system's list lacks (`pt`, or `ja` when the system lists a `pt` tag) through `localStorage`'s `language` key and reloads once, so only the plugin's `getLanguage` lookup can bring it to the editor. The editor shows that language all run, so controls are found by class or place, never by label.
- **Each step is a `step(…)` call** in `e2e/smoke.mjs`, named for what it checks, from opening every extension to the quit. The names leave out how:
  - the waiting tab that became the writer is judged only once its saved text is the first tab's close write, or a build handing back open-time text passes too;
  - keys go through Playwright's keyboard, whose events pass Obsidian's window listener;
  - the Mod+F step widens the window over the protocol (`Browser.setWindowBounds`) when the editor is under 520 px, where the Explorer would stand aside, and reads the shadow root's `activeElement` for the search's field;
  - the shadow root is closed, so theme steps compare the element's `:host` properties (`--gray-color-1`, `--accent-color-9`, through `getComputedStyle`) with `@radix-ui/colors`, the editor's theme palette. They click the builder over the DevTools protocol (`DOM.getDocument` with `pierce`, then a function on the shadow root): its button by `.toolbar-theme`, System, Light and Dark by place;
  - language steps read each editor root's `lang`, and Obsidian's `i18next.language` before the plugin is enabled;
  - hub steps spawn the real `packages/mcp-server/dist/erd-editor-mcp.js` over stdio in the vault folder with your `HOME`, check `0600` in `0700`, and detach Playwright around `app:reload`, 400 ms after an edit;
  - a file written as releases before the origin and the locks wrote it opens locked. Two zoom-in clicks (the button after the zoom readout) and three wheel scrolls left of the welcome screen's menu, which takes the pointer, must leave its bytes as they were through the 2 s autosave and the close. Without the replica's `changed` flag, both would write the replica's value over them;
  - the quit comes 400 ms after an edit in each of two new tabs, and a `quit` listener added after the plugin's reads both files inside the event, since on macOS, where Obsidian awaits quit tasks, the end state alone would pass.
- **A failed step** prints the MCP server's stderr at the end of the run.
- **Options**: `OBSIDIAN_BIN` (an install other than `/Applications/Obsidian.app` on macOS); `OBSIDIAN_ASAR` (an `obsidian-<version>.asar` copied into the run's user data to load over the bundled version; only the file you name is read); `SMOKE_PORT` (the CDP port, 9333, where `SMOKE_KEEP=1` leaves the app); `SMOKE_OUT` (another folder for `smoke.png`); `SMOKE_KEEP=1` (skips the quit).
- **It removes only its own**: its `mkdtemp` folder at the end unless kept, and at start earlier runs' `erd-obsidian-smoke-*` temp folders but one a running Obsidian uses. It checks that its instance's real lock and socket under `~/.erd-editor/ide` go, deletes only its renderer pid's files, and stops only the Obsidian it spawned, through its CDP or pid. Keep your own `HOME` (root § Testing Requirements).
- **To try a build in your own vault**, link `dist/` in as `<vault>/.obsidian/plugins/erd-editor`.

### The smoke on Windows

- **Paths**: `OBSIDIAN_BIN` defaults to `%LOCALAPPDATA%\Programs\Obsidian\Obsidian.exe`, where the installer puts it; an `OBSIDIAN_ASAR` comes from `%APPDATA%\obsidian\`.
- **The pipe is listed, never stat'ed**: the lock names `\\.\pipe\erd-editor-ide-<renderer pid>`, found in the `\\.\pipe\` listing, as a stat connects as a peer. The lock step checks no modes, which Windows does not keep.
- **Processes**: a quit ends the process and its debugging port; the work folder is deleted with retries, as Electron's helpers release its files after the main pid exits.
- **Measured on Windows 11 (2026-09-27)** with the Obsidian 1.13.7 installer: 55 steps pass; no page errors fails on a product finding, reported rather than gated (`illegal access` page errors after the theme step, in each run measured). A build without the exit write fails the reload and quit steps.

## Dependencies

### Internal

All devDependencies, bundled, whose `dist/**/*.d.ts` the build and test tasks read: `@dineug/erd-editor` (the element; specs load its `peer.js`), `@dineug/erd-editor-replication-store-worker` (the replica), `@dineug/erd-editor-webview-bridge` (replica commands, `GrayColor` / `AccentColor`, `LocaleLabel` codes and names), `@dineug/erd-editor-agent-hub-host` and `@dineug/erd-editor-agent-hub` (the hub). The smoke also runs `@dineug/erd-editor-mcp`'s build, which it does not build, and reads `@radix-ui/colors` through `erd-editor`'s package, undeclared here.

### External

`obsidian` (types only; external at runtime), `monkey-around`, `effect` and `@effect/platform-node` (bundled; node builtins stay external), `@types/node` (`types: ["node"]`), `@playwright/test` for `smoke`'s `connectOverCDP`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
