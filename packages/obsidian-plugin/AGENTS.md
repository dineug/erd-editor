<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-26 | Updated: 2026-09-26 -->

# obsidian-plugin

## Purpose

The Obsidian plugin: a `TextFileView` that puts `<erd-editor>` in a tab for `.erd` / `.vuerd` files, and for `.erd.json` / `.vuerd.json` through a wrapped `WorkspaceLeaf.openFile`. `dist/` (`main.js`, `manifest.json`, `styles.css`) is the whole plugin folder. It is released from `dineug/erd-editor-obsidian-plugin`, which carries this repository as a submodule, keeps a copy of `manifest.json` at its root for Obsidian's version check, and attaches `dist/` to a GitHub release tagged with the manifest version.

## Key Files

| File | Description |
| --- | --- |
| `src/main.ts` | The plugin: view and extension registration, the `openFile` wrapper, the export callback, the create command |
| `src/ErdView.ts` | The tab: load, save, the read-only fallback, the light/dark sync |
| `src/loadErdEditor.ts` | Evaluates the editor bundle once per window |
| `vite.config.ts` | CommonJS library build into `dist/`, `erdEditorUmd`, `pluginFiles`, `run.tasks.build` |
| `manifest.json` / `versions.json` | Obsidian's plugin metadata; the release repository copies both to its root |
| `styles.css` | The tab layout and the containment override |
| `e2e/smoke.mjs` | `pnpm --filter @dineug/erd-editor-obsidian-plugin smoke` |

## For AI Agents

### Working In This Directory

- **The editor is the UMD build.** `erdEditorUmd` bundles `erd-editor/dist/erd-editor.umd.js`, whose workers travel as `data:` URLs; the ESM build spawns them from `import.meta.url`, which a CommonJS `main.js` does not have. `erd-editor` is `type: module`, so Rolldown would read the UMD as ESM and leave `exports` unbound (the plugin then loads with `setExportFileCallback` undefined); the plugin wraps it in a CommonJS scope. The task lists the UMD file as an input because no import reaches it.
- **`<erd-editor>` is defined once per window.** `customElements.define` cannot repeat, so `loadErdEditor` keeps the evaluated module on a global symbol and a disabled-then-enabled plugin reuses it; a new build takes effect after restarting Obsidian.
- **`.erd.json` / `.vuerd.json`**: Obsidian types a file by its last extension, and `registerExtensions(['erd.json'])` registers without effect. Registering `json` would claim every JSON file in the vault, so `main.ts` wraps `WorkspaceLeaf.prototype.openFile` with `monkey-around` and mirrors the core method (the `file` guard, `active` defaulting to the active leaf, `group`, `eState`). The file explorer and the quick switcher still leave these files out unless Detect all file extensions is on.
- **Saving** (`ErdView`): `change` calls `requestSave`, and the core `save` writes only when `getViewData()` differs from the text it last loaded or saved. `getViewData` hands back the loaded text while `editor.value` equals its value right after the load, so opening a file never rewrites it (a `.vuerd` would migrate, any file would reformat). Keep `await super.onClose()` before `destroy()`: the core close saves through `getViewData`, and `destroy()` empties the document. Do not name a method `load` or `unload` — those are `Component`'s lifecycle.
- **Unreadable files** (not JSON, or neither `doc` nor `canvas` at the top) open read-only and `getViewData` returns the file text, so a merge conflict or a cut-off sync is never replaced by an empty diagram. `readonly` still lets viewport actions through, which is why the text, not `editor.value`, is handed back.
- **`isPlaintext` is false**: with the default, an outside change during an unsaved edit is merged into the JSON as text. False takes the file's version and drops the unsaved edit.
- **The schema GC runs after a load** (a SharedWorker), so `editor.value` can change without an edit when a document is inconsistent — FK flags with no relationship, for one. The smoke fixture is kept consistent for that reason.
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

`smoke` copies `dist/` into a throwaway vault, starts Obsidian with its own `--user-data-dir` (your vaults are untouched), enables the plugin over CDP and checks opening every extension, saving through `Alt+N`, closing without an edit, the unreadable-file fallback, an outside change during an edit, `openFile(null)`, the create command and the containment override. `OBSIDIAN_BIN` points it at another install. To try a build in a vault of your own, link `dist/` in as `<vault>/.obsidian/plugins/erd-editor`.

## Dependencies

### Internal

`@dineug/erd-editor` (devDependency, bundled), for its UMD build and its types.

### External

`obsidian` (types only; external at runtime), `monkey-around` (bundled), `@playwright/test` for `smoke`'s `connectOverCDP`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
