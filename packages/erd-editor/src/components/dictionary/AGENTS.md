<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-20 | Updated: 2026-10-20 -->

# dictionary

## Purpose

`src/components/dictionary/` holds the Dictionary tab, the sixth, whose toolbar button draws lucide's `book-a` between Code Generator and Settings (owner decisions of 2026-10-20): a bar with the four sheets (the words, the terms, the domains and the checks over them), a search and the row buttons, a `@dineug/grid` grid of the sheet shown, and a status line under it. The rows, their writes, their refusals and the checks belong to the engine (`src/engine/modules/dictionary/`, whose rules are under Dictionaries and derived names in `src/engine/AGENTS.md`). This file holds how the tab puts them on the grid: the rows a version shows, how a commit resolves to row ids, where a version comes from, the keys the tab passes and stops, the grid's theme and a read-only document. What the grid keeps and what its host keeps, its handle and its commits are in `packages/grid/AGENTS.md`.

## Making a Change

1. **Read the files on the other side.** A change to how the tab drives the grid (`version`, the handle, `onCommit`, `isEditing`) reads `packages/grid/AGENTS.md`, and a change to a write reads `src/engine/AGENTS.md`. `stopsAtPanel` (`src/utils/keyboard-shortcut/index.ts`) is shared with the Explorer, the diff tree and the color picker, so a change there reaches this tab's keys; a change to the find chord reads `src/components/explorer/AGENTS.md`.
2. **Import the grid from `src/components/` alone.** `@dineug/grid` is a devDependency the build inlines, so its code ships in the element's `index.js` and the UMD build and counts in `pnpm size`. The peer graph must never reach it: `src/peer/imports.test.ts` fails on a graph that reaches `components/` or names a fifth inlined library, and `pnpm peer-graph` on a browser global in what `peer.js` reaches.
3. **Run the package's checks.** Making a Change in the package file (`packages/erd-editor/AGENTS.md`) gives the test task and the coverage run. `Dictionary.browser.test.tsx` runs in real Chromium in that task.

## Key Files

| File | Description |
| --- | --- |
| `Dictionary.tsx` | The tab: the bar, a grid mounted per sheet, the status line and the empty sheet's hint, and the session each grid mount holds |
| `sheets.ts` | `DictionarySheet`, the sheets in the bar's order; the three entry sheets' columns, cells and rows (`sheetColumns`, `sheetField`, `sheetCellText`, `sheetRowIds`); `bumpedSheets`, the sheets a batch raises |
| `checkSheet.ts` | The check sheet's columns, cells and rows (`checkSheetColumns`, `checkCellText`, `checkRows`) |
| `dictionaryCommit.ts` | `createSheetRows` (`SheetRows`: the rows of each version a grid is handed, and the active row's id), `commitDictionaryCells`, `selectedRowIds`, `removeSelectedRows` |
| `dictionaryView.ts` | `dictionaryViewOf`, the window's own place on each sheet; `changeSearch`, `rememberSelection`, `storedSelection`, `rememberScroll`, `restoreScroll`, `rememberWidth` |
| `dictionaryKeys.ts` | `handleDictionaryKeydown`, `DICTIONARY_PASSING_BINDINGS`, `keepClipboard` |
| `gridTheme.ts` | `toGridTheme`, the grid's fifteen colours from the resolved theme |

## Rules

### Mounts and the window's own place

- **The tab mounts again on every visit.** Only the ERD tab is cached (`ErdEditor.tsx`), so what a reader left on a sheet lives in `dictionaryViewOf(app)`, a `WeakMap` over the store as `schemaSQLViewOf` is: the sheet shown, and per sheet its search, selection, scroll and column widths. None of it is in the store, the file, a change event or a peer, and it lasts until the element goes, one per editor. Each value is frozen and replaced whole, so a watcher hears one change and the grid is handed no proxy.
- **Each sheet keeps its own search.** A sheet's kept selection and scroll count the rows its search shows, so a new search drops both and the active cell goes back to the first cell.
- **The tab keeps the widths.** The grid draws a resized width only while its host's columns hold it (`packages/grid/AGENTS.md`, The host keeps every width), so `onColumnResize` writes it into the view, and the sheet opens its columns at it on the next mount.
- **One grid per sheet.** `repeat([sheet])` mounts a new grid on a sheet switch, since a grid's selection, scroll and rows belong to one sheet. Each mount holds a session: its `SheetRows`, the check sheet's checks, the handle (a stand-in that does nothing until `onReady`) and the last selection, which the tab keeps since `GridHandle.select` does not echo the host's own change.
- **`onReady` puts the reader back.** It selects the kept selection held inside the rows shown now, notes its active row, scrolls back to the kept first cell and focuses the grid. `restoreScroll` goes to the last cell first, since `scrollTo` scrolls the least distance, so the way back up leaves the kept cell first in view. The focus lets typing before any gesture reach the first row.
- **The columns change only with what they are made of.** The tab hands the grid a new columns array only when the sheet, the read-only state, the widths object or the display language's `t` changes, since a new array lays the grid out again and redraws both of its layers.

### Rows and versions

- **Read a version's rows where it is raised, never in the render.** An entry sheet's rows are `doc.<kind>Ids` in their listed order with the search applied (`sheetRowIds`), and reading them walks every row through the store's proxies. The render hands the grid the version and calls `rows.receive(version)`, after which the rows of older versions are let go.
- **A search reads its sheet's own fields** (owner decisions of 2026-10-20): a word's name, abbreviation, English name and description; a term's name, physical name and description; a domain's name, data type and description. It matches a part of the text, composed and in lower case. A line break joins the fields, so a match never runs across two of them.
- **Every batch raises versions the same way.** `store.subscribe` hands the tab each batch, a local edit, a peer's batch, an undo and an import alike, and `bumpedSheets` names the sheets it raises: all four for any `dictionary.*` action or `editor.loadJson`, `initialLoadJson`, `clear` or `initialClear`, since a term shows its domain's name and the checks read every dictionary; the check sheet alone for a table's or a column's action; none for any other. The tab raises the sheet it shows, and a new search raises it too.
- **Select before raising.** A selection the tab hands the grid (on a new search, or once the batch Add Row or Delete Rows sent lands) is selected and noted as the active row before the version goes up, so the raise reads the active row's id from the new rows.
- **The check sheet lists again on each raise.** `checkRows` runs `listDictionaryChecks` over the whole document, so only a mounted check sheet asks for it, and its version goes up by one each time. Its three columns (the kind, the target, the detail) are read-only in every document, since a check is read off the other sheets and the tables.

### Commits

- **An edit commits to the row it opened on.** An edit opens only on the active cell, so `source: 'edit'` resolves to the active row's id, which a peer's removal above it cannot move. A paste and a clear resolve by the rows of the version the grid last received, row by row, since the grid reads its ranges over the rows it drew; a row past the end is a new row, added in order.
- **Read the active row's id at six moments.** As `onReady` selects; on each `onSelectionChange`; on a raise while none is noted, from the new rows at the active index, as when rows come to an empty sheet; on a raise with no edit open, the same way, while an open edit keeps the row it opened on; after an edit commits, from the rows the grid received; and in the capture phase of a `keydown`, `dblclick` or `compositionstart` on the sheet's container, before any of them opens an edit (`settle`). Without the last three, an idle active cell under a peer's removal above it, or an edit cancelled after rows moved under it, would send the next edit to the neighbouring row.
- **A row a peer removed drops the commit.** A commit naming a row the document no longer lists sends nothing and opens the `dictionary.toast.rowRemoved` toast.
- **A term's domain cell takes a domain's name.** It writes the id of the first listed domain of that name, and `''` for no text. Text that reads as the name the cell showed keeps the link the row holds, a removed domain's included, which shows as nothing, so pasting back what a cell showed never unlinks.
- **One refused row drops the whole commit** (an owner decision of 2026-10-20). A name another listed row of the sheet or another row of the commit holds, or a domain name no listed domain has, sends none of the commit, so one commit stays one dispatch and one undo. Each reason opens one error toast, `dictionary.toast.duplicateNames` or `dictionary.toast.unknownDomainNames`, with the count of rows it refused and the first three names. The names are listed by `Intl.ListFormat` as `unit`, with no "and", since the count says when there are more, and each is isolated under a right-to-left language. Its key names the count and the names (Toasts in `src/components/AGENTS.md`).
- **The rest is one dispatch.** `commitDictionaryCellsAction$` adds the rows past the end and writes the others, a term's composed physical name and the types of the columns linking a changed domain included, so one undo takes the commit back (`src/engine/AGENTS.md`).

### Row buttons and the status line

- **Add Row clears the search.** A new row has no name, which no search finds, so the search goes first. The tab sends `addDictionaryEntryAction$`, selects the new last row once its batch lands, scrolls to it once the grid has taken the new row count, a tick after the render (`onUpdated`, then `nextTick`), and focuses the grid.
- **Delete Rows is one dispatch.** It removes the rows the selection covers, among the rows the grid received, through one `removeDictionaryEntriesAction$`, which sends the removes from the end of the list back (`src/engine/AGENTS.md`, Rows leave a list from its end). The active cell then lands on the first removed row, held inside the rows left. One undo lists the rows again at the sheet's end, as a table's does (owner decisions of 2026-10-20), so a spec judges that undo by the rows and their values, not their places.
- **The row buttons hide on the check sheet and in a read-only document.** The check sheet only lists. The search shows on all four sheets.
- **The status line counts rows.** It shows the rows the search leaves and, while the selection covers any, the rows it covers, the active cell's included and a row two ranges share counted once: as many as Delete Rows would remove.
- **An empty sheet says how to fill it.** An entry sheet that lists no row shows `dictionary.empty` over the grid with `pointer-events: none`, so a paste still reaches the grid. A read-only document shows none, since it can take neither an import nor a new row.

### Keys

- **The tab's root reads every keydown** (owner decisions of 2026-10-20). The palette (`search`), undo, redo and find (`findReplace`, which works on every tab, `src/components/explorer/AGENTS.md`) pass on to the editor's root: `DICTIONARY_PASSING_BINDINGS`. Every other press `stopsAtPanel` names, a chord of `keyBindingMap`, an arrow, Tab, Enter, Space, Home, End or a press an IME holds, stops at the tab without `preventDefault`, so the grid takes it first and no canvas binding at the root sees it.
- **The tab runs undo and redo itself.** The root undoes by key on the ERD tab alone, so on this tab the keydown calls `store.undo()` or `store.redo()` and lets the press go on to the root. With a grid edit open (`GridHandle.isEditing`) or from the search field, the press stops at the tab instead, without `preventDefault`, so the open edit's or the field's own text undo takes it. The Explorer's fields hand undo to the document; this one keeps it, or an undo typed in the search would undo the document under it.
- **Copy, cut and paste stop at the tab's root,** after the grid has handled them, since the editor's root hands a copy or a paste to the diagram's clipboard (`ErdEditor.tsx`).

### The grid's theme

- **The grid takes the editor's resolved palette** (owner decisions of 2026-10-20). `toGridTheme(theme.value, previous)` builds the fifteen `GridTheme` colours from `themeContext`, so a light or dark switch, an accent or an override reaches the grid. The sheet's four surfaces come from the tab's own tokens: `dictionaryBackground` for the cells, `dictionaryHeaderBackground` for the header band, `dictionaryGridLine` for the lines between cells and `dictionaryHeaderSelect` for a header whose row or column meets the selection. They never come from a table's or a column's tokens (the package file, Give each part its own theme token). The rest come from the shared ones: `foreground` for the header labels, `active` for the cell text and a selected header's label, `focus` for the active cell's edge, `grayColor7` for the frozen border, `grayColor3` for a read-only cell, `accentColor9` for a range's edge and fill, `accentColor6` for a header whose whole row or column is selected, and the two scrollbar tokens.
- **A range is filled with the accent at 20% alpha** (`#rrggbb33`, a `#rgb` accent spelt out first), so the cells under it still read. An accent override spelt other than in hex gives `transparent`, and the range keeps its edge alone, since the fill would otherwise paint opaque over the cells.
- **The same theme comes back while every colour matches.** The grid redraws both layers on a new theme object, so the tab passes the one it handed before and gets it back until a colour changes.
- **The light steps keep the text at 4.5:1.** In light the cells are white (`override-#ffffff`), the lines `gray-8` and the band `gray-4`, since the header labels (`gray-11`) on a light `gray-5` measured 4.48:1 (2026-10-20). `dictionaryHeaderSelect` is `accent-3` under every accent: unlike `columnSelect`, it takes no `gray-6` under the gray, gold and bronze accents (`NeutralAccentThemeConfig`), since `gray-11` on a light `gray-6` measured 4.19:1 (2026-10-20).

### A read-only document

- **Every column is read-only.** `sheetColumns` marks each column read-only while the document is, so the grid opens no edit and commits no paste or clear, and the row buttons and the empty sheet's hint are hidden. The sheet switch, the search, the selection, the scroll, a resize and a copy still work, since none of them writes the document.

## Testing Requirements

- **`dictionaryCommit.test.ts`** holds the rows of each version and when they are let go, each moment the active row's id is read, an edit through a peer's removal above it, typing before any gesture, an edit cancelled after rows moved, a paste past the end and over rows the grid has not drawn, a removed row, the refusals and their toasts, the domain cell's links and Delete Rows' one dispatch.
- **`sheets.test.ts`** holds the sheets and their labels, a column per field with its width and read-only state, the cells, the fields a search reads, the same frozen rows until a sheet is written, and `bumpedSheets`.
- **`checkSheet.test.ts`** holds the check sheet's columns, rows and search. **`dictionaryView.test.ts`** holds one view per editor, a search dropping the selection and the scroll, the frozen copies, the clamp, `restoreScroll`'s two steps and the widths.
- **`gridTheme.test.ts`** pins the token each of the fifteen colours comes from, the four surfaces from the tab's tokens alone, the 20% fill and its non-hex fallback, hex in both appearances and the same object back. `src/themes/radix-ui-theme.test.ts` (the Dictionary tab sheet) holds the 4.5:1 of the cell text and the header labels on the tab's surfaces in every theme; `src/themes/tokens.test.ts` and `radix-ui-theme.config.test.ts` pin the four tokens' steps.
- **`Dictionary.browser.test.tsx`** drives the tab with real keys in Chromium: the four sheets, the search, Add Row and Delete Rows, a paste past the end, one undo per commit, a read-only document, the empty sheet's hint, the keys it stops and passes, the search field's undo and the clipboard, a peer's batch, an edit through a peer's removal, the view across mounts, typing before any gesture and a theme switch. In the real element it holds a domain's new type reaching its columns in the same batch, which the ERD tab's type cell shows.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
