<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-26 | Updated: 2026-09-26 -->

# obsidian-plugin

## Purpose

The Obsidian plugin: a `TextFileView` that puts `<erd-editor>` in a tab for `.erd` / `.vuerd` files, and for `.erd.json` / `.vuerd.json` through a wrapped `WorkspaceLeaf.openFile`. `dist/` (`main.js`, `manifest.json`, `styles.css`) is the whole plugin folder. It is released from `dineug/erd-editor-obsidian-plugin`, which carries this repository as a submodule, keeps a copy of `manifest.json` at its root for Obsidian's version check, and attaches `dist/` to a GitHub release tagged with the manifest version.

## Key Files

| File | Description |
| --- | --- |
| `src/main.ts` | The plugin: view and extension registration, the `openFile` wrapper, the export callback, the create command |
| `src/ErdView.ts` | The tab: load, the replica worker that serializes every save, the live relay between tabs of one file, the read-only fallback, the light/dark sync |
| `src/loadErdEditor.ts` | Requires `@dineug/erd-editor` once per window |
| `vite.config.ts` | CommonJS library build into `dist/`, `inlineUrlWorkers` with the shared `base64InlineWorkers`, `pluginFiles`, `run.tasks.build` |
| `manifest.json` / `versions.json` | Obsidian's plugin metadata; the release repository copies both to its root |
| `styles.css` | The tab layout and the containment override |
| `e2e/smoke.mjs` | `pnpm --filter @dineug/erd-editor-obsidian-plugin smoke` |

## For AI Agents

### Working In This Directory

- **Every worker is inlined.** Obsidian loads `main.js` alone, with no file beside it to spawn a worker from. `inlineUrlWorkers` rewrites each `new SharedWorker(new URL(…, import.meta.url))` / `new Worker(…)` in `erd-editor`'s and `replication-store-worker`'s `dist/` (the spelling `tools/vite/worker-url.ts` writes) into Vite's `?sharedworker&inline` / `?worker&inline`, and fails the build when one survives. A shared worker becomes a data URL, which `base64InlineWorkers` (`tools/vite/inline-worker.ts`, as in `erd-editor`'s UMD build) re-encodes under Chromium's URL cap; the replica starts from a blob. `worker.format` is `es` with `codeSplitting: false`: every one is a module worker, and none can load a chunk from a data or blob URL.
- **`<erd-editor>` is defined once per window.** Importing the package defines it, and `customElements.define` cannot repeat, so `loadErdEditor` reaches it through `require()` (Rolldown then initializes it lazily) and keeps the module on a global symbol; a disabled-then-enabled plugin reuses it, and a new build takes effect after restarting Obsidian. The lazy form splits each inline worker's source from its declaration, which is why `readStringLiteral` also reads a bare assignment.
- **`.erd.json` / `.vuerd.json`**: Obsidian types a file by its last extension, and `registerExtensions(['erd.json'])` registers without effect. Registering `json` would claim every JSON file in the vault, so `main.ts` wraps `WorkspaceLeaf.prototype.openFile` with `monkey-around` and mirrors the core method (the `file` guard, `active` defaulting to the active leaf, `group`, `eState`). The file explorer and the quick switcher still leave these files out unless Detect all file extensions is on.
- **Saving goes through the replica worker**, as in the IDE hosts, so an edit never stringifies the document on the main thread: the shared store's `subscribe` relays every action (`webviewReplicationCommand`), the replica posts `hostSaveValueCommand` 200 ms after the last change, and that value is what `requestSave` writes. The core `save` writes only when `getViewData()` differs from the text it last loaded or saved, and `getViewData` hands back the loaded text until the replica sends a value, so opening a file never rewrites it (a `.vuerd` would migrate, any file would reformat). **Every load starts a new replica**: `setInitialValue` does not cancel the replica's debounce, so a replica kept across a file switch or an outside reload could post the previous document after the next one loaded, and that value would be saved over it. A replica error shows a Notice; the tab then saves only when it closes.
- **Closing or switching files cannot wait for the replica.** `onUnloadFile` first calls the shared store's `flushStreamBuffers()`, which sends a stream group (a color, a memo resize) still held for its quiet period to the replica and the other tabs — without it, a tab closed within 400 ms of such an edit dropped it, and a tab that does not write never passed it on. Then the writer serializes once with `editor.value` if any change action reached it since the load (`ChangeActionTypes` from `peer.js`); otherwise it hands back the loaded text and nothing is written. A timing rule (a replica value arriving 200 ms after the last change covers it) failed when serializing takes longer than that. Serializing on every close instead made two tabs of one file write it at once, and overlapping `vault.modify` calls leave the file's `saving` flag set (`modify` restores the flag it found), after which Obsidian reads its cache over any outside change. Keep `await super.onClose()` before `destroy()`: the core close saves through `getViewData`, and `destroy()` empties the document. Do not name a method `load` or `unload` — those are `Component`'s lifecycle.
- **Tabs of one file stay in step as edits happen**, the way `vscode-extension` broadcasts between webviews of one document. `tabsByFile` groups the tabs by `TFile`; a tab's shared-store actions go to its own replica and to every other tab's shared store and replica at once. The first tab alone writes the file: another hands back `lastSavedData` from `getViewData`, so two tabs never write together. The writer's save coming back as a modify event is recognised (`handedByFile`, or the tab's own replica value) and not reloaded, which keeps undo; an outside change reloads every tab. A tab opened beside another starts from that tab's current document, saved or not, after flushing its stream buffers, so a held drag is not applied to the new tab twice.
- **The shared store belongs to the file, not the tab.** It is created after the document loads and destroyed when the tab leaves the file: its first `subscribe` sends `getLWW`, and the other tabs answer with `mergeLWW`, so the new tab's clock and last-writer-wins state match theirs and its first edit is not taken for an older one. Subscribing before joining (in `onOpen`) sent that request to no one.
- **Unreadable files** (not JSON, or neither `doc` nor `canvas` at the top) open read-only and `getViewData` returns the file text, so a merge conflict or a cut-off sync is never replaced by an empty diagram. `readonly` still lets viewport actions through, which is why the text, not `editor.value`, is handed back.
- **`isPlaintext` is false**: with the default, an outside change during an unsaved edit is merged into the JSON as text. False takes the file's version and drops the unsaved edit.
- **The schema GC runs after a load**, so a document that is inconsistent (FK flags with no relationship, for one) can change without an edit. The smoke fixture is kept consistent for that reason.
- **`styles.css` overrides `contain: strict !important`** on diagram leaves only. Layout or paint containment makes the leaf the box `position: fixed` resolves against, and the editor places its menus with viewport coordinates, so they landed offset by the leaf's position.
- Export goes through `setExportFileCallback` into `fileManager.getAvailablePathForAttachment`, with the characters Obsidian refuses in a name replaced.
- `isDesktopOnly` is true: nothing has been checked on mobile, and Chrome on Android has no SharedWorker. Popout windows are unchecked too; `<erd-editor>` is defined in the main window's registry only.

### Testing Requirements

No `test` task: `main.ts` and `ErdView.ts` run only inside Obsidian (the `obsidian` package ships types and no runtime). The build, `tsc --noEmit` first, is the gate in CI; `smoke` is the check that the plugin works, run by hand on macOS with Obsidian installed.

```
pnpm exec vp run --filter @dineug/erd-editor-obsidian-plugin --fail-if-no-match build
pnpm --filter @dineug/erd-editor-obsidian-plugin smoke
SMOKE_KEEP=1 pnpm --filter @dineug/erd-editor-obsidian-plugin smoke   # leaves the app on CDP port 9333
```

`smoke` copies `dist/` into a throwaway vault, starts Obsidian with its own `--user-data-dir` (your vaults are untouched), enables the plugin over CDP and checks opening every extension, saving through `Alt+N`, two tabs of one file editing in step, closing without an edit, closing two tabs of one file, the unreadable-file fallback, an outside change during an edit, `openFile(null)`, the create command and the containment override. `OBSIDIAN_BIN` points it at another install. To try a build in a vault of your own, link `dist/` in as `<vault>/.obsidian/plugins/erd-editor`.

## Dependencies

### Internal

All devDependencies, bundled: `@dineug/erd-editor` (the element, and `ChangeActionTypes` from `peer.js`), `@dineug/erd-editor-replication-store-worker` (the replica), `@dineug/erd-editor-webview-bridge` (the replica's commands).

### External

`obsidian` (types only; external at runtime), `monkey-around` (bundled), `@playwright/test` for `smoke`'s `connectOverCDP`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
