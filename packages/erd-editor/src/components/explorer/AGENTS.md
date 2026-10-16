# explorer

## Purpose

`src/components/explorer/` holds the Explorer: a read-only tree of the document docked left of the ERD canvas, which narrows the canvas rather than covering it, jumps to what a row stands for, and holds Find and Replace above its tree. This file holds the rules for its panel, its state, its tree, where a row goes, its search and the search core in `src/utils/find-replace/`, which has no AGENTS.md of its own. The tree component is `src/components/primitives/tree/Tree.tsx` (`src/components/primitives/AGENTS.md`, The tree), the jump rule is `src/components/erd/goToErdTarget.ts` (`src/components/erd/AGENTS.md`, The jump rule), and the viewport the canvas is left with is `src/components/erd-editor/viewportLayout.ts`. The owner decisions behind it are recorded here, the 2026-10-13 ones from the Explorer's interview.

## Making a Change

1. **Read the files on the other side.** A change to how the chord is taken reads `src/components/erd/AGENTS.md`, which holds `YIELDS_TO_A_CARET` and the editor's Escape branch. A change to `PANEL_PASSING_BINDINGS` reads `src/components/primitives/AGENTS.md`, since the color picker shares that list. A change to what the palette's Find and Replace row opens reads `src/components/quick-search/AGENTS.md`.
2. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run.
3. **Run the e2e suite for a visible change.** `e2e/specs/explorer.spec.ts` drives the panel and `e2e/specs/find-replace.spec.ts` its search, the chord and the palette's rows.
4. **Change a pinned rule and its spec together.** Testing Requirements lists which spec pins which owner decision.

## Key Files

A path starting with `src/` or `e2e/` is relative to `packages/erd-editor`; a bare file name sits in this directory.

| File | Description |
| --- | --- |
| `explorerView.ts` | `explorerViewOf(store)`: the observable state per editor, the panel's (`open`, `zenReveal`, `width`, `expanded`, `activeId`) and the search's (the query and options, `fields`, `replaceOpen`, `scopesOpen`, `matches`, `current`, `status`, `order`, `searchCollapsed`, `focusRequest`); `explorerScrollOf(store)`, the unobserved scroll position |
| `explorerCommands.ts` | `openExplorer`, `closeExplorer`, `toggleExplorer`, `setExplorerWidth`, `isExplorerPressed`, `isExplorerShown` |
| `explorerTree.ts` | `buildExplorerTree`: the document as `TreeNode<ExplorerNode>`s, its folders, order and counts; `buildSearchTree`, `searchExpanded`, `matchRowId` and `matchAncestorIds`, the tree a search shows and the rows above a match in it |
| `explorerNavigation.ts` | `targetOf`, `jumpTo` and `activateNode`: where a row or a match goes, and the light a foreign key leaves |
| `explorerSearch.ts` | The search's state machine over `(store, view)`: `openSearch`, `focusSearch`, `setQuery`, `toggleOption`, `toggleField`, `goToNext`, `goToPrevious`, `goToMatch`, `replaceOne`, `replaceAll`, `noteBatch`, `searchIfStale`, `countText`, `REGEX_INPUT_DELAY`, and the runtime no render reads (`searchRuntimeOf`) |
| `matchTarget.ts` | `toErdTarget`, `withReplacement`, `showNextMatchAction$` |
| `fieldIcon.tsx` | The icon of an excerpt row, which the palette's `#` rows share |
| `Explorer.tsx` | The shell: the panel at the width the layout reaches, or nothing, and the keyboard handed back when it goes |
| `explorer-panel/ExplorerPanel.tsx` | The panel: its header, the search, the tree, each kind of row, the keys it keeps and its edge |
| `explorer-search/ExplorerSearch.tsx` | The search above the tree: the fields, the options, the count with its steps, the scopes |
| `explorer-controller/ExplorerController.tsx` | Mounted at the editor's root, drawing nothing: the chord, `openFindReplace`, the search an edit asks for (`EDIT_SEARCH_DELAY`) and the one the panel's return asks for |
| `src/utils/takeover.ts` | `isTakenOver` and its `TAKEOVERS`, which the toolbar, the canvas, the palette, the draw target, the key binder and the viewport layout share |
| `src/utils/find-replace/findMatches.ts` | `FindField`, `DEFAULT_FIND_FIELDS`, `FindTextActionTypes`, `FieldOrder`, `treeOrderOf`, `walkFields`, `findMatches`, `rematchField`, `ReplaceRun`, `resumeRun`, `nextReplace` |
| `src/utils/find-replace/matcher.ts` | `createMatcher`, `toUnicodeSource`, `DEFAULT_FIND_OPTIONS`, the Whole Word wrapper |
| `src/utils/find-replace/preserveCase.ts` | `preserveCase`, the Preserve Case (AB) rule |
| `src/utils/find-replace/replaceActions.ts` | `toFieldAction`, `toReplaceActions` and its `replaced` count |
| `src/utils/find-replace/present.ts` | What a match says: `FindFieldLabel`, `locationOf`, `describeMatch`, `snippetOf` |
| `src/utils/keyboard-shortcut/index.ts` | `PANEL_PASSING_BINDINGS` and `stopsAtPanel`, shared with the color picker |
| `src/hooks/useKeyBindingMap.ts` | `yields` and `YIELDS_TO_A_TAKEOVER` |

## Rules

### The panel

- **It narrows the canvas, never covers it.** `viewportLayout.ts` takes the reach, the panel's width, from the root before the viewport: none while it is closed, off the ERD tab, under a takeover or hidden by zen mode, and none where the canvas would keep less than 320 px (`EXPLORER_CANVAS_MIN_WIDTH`) beside the panel's least, 200 px. It stays open while it stands aside, and comes back as the root widens. Opening it moves no origin and writes no history.
- **It starts closed at 260 px**, sized from its edge between 200 and 480 px, 260 again on a double press. The edge reads the pointer against the panel's left, so a drag past either end and back does not drift.
- **Its state lives as long as the element** (`explorerViewOf`), never in the store, the file, the history, a peer or `localStorage`, so a tab change keeps it. The scroll position stays unobserved (`explorerScrollOf`), so a scroll renders nothing outside the tree.
- **The toolbar button stands where Find stood** (`list-tree`, `toggleExplorer`), its title naming the find chord, which toggles the panel as the button does (The search). It shows pressed while the panel is open on the ERD tab, a panel a narrow root stands aside included, and a press closes it. On another tab a press takes the ERD tab and opens it, never closes it (owner decisions of 2026-10-13). It is disabled under a takeover, and its press does nothing there. The palette's Toggle Explorer row does the same and leaves the list under a takeover.
- **The toolbar counts no tables.** The Explorer's Tables folder counts them, so the bar's `Table: n` and its `toolbar.tableCount` key are gone (the owner's request of 2026-10-14).
- **Zen mode hides it as it comes on.** An opening during zen mode, the chord's included, shows it and leaves zen on (`zenReveal`), and zen mode coming on again hides it again (an owner decision of 2026-10-13).
- **It stands on the physical left in every language.** The ERD tab's row is `dir="ltr"` with the canvas's own scope taking the reader's direction back; the panel's root does too, and keeps its border and edge on the physical right.
- **Escape inside it hands the keyboard to the canvas** (`forceFocusEvent`) and leaves it open and the selection as it was, from the tree and the search's fields alike, but an Escape that ends an IME composition stays with the field. Its keydown stops what the canvas would read as an edit (`stopsAtPanel`: a `keyBindingMap` chord outside `PANEL_PASSING_BINDINGS`, an arrow, Tab, Enter, Space, Delete or Backspace, and every key mid-composition); any other press goes on to the host, so its save or command palette works there.
- **A panel that goes with the keyboard in it hands the keyboard back** with `focusEvent`. The shell reads a flag it keeps unobserved before it renders nothing, rather than wait for a focusout the browser may not send.
- **The dialogs open beside it.** Table Properties, the theme builder, the locale picker, the export image dialog and Map Columns leave it open as they open; the theme builder and the locale picker stand past it left to right (`insetPastExplorer`), and right to left keep their place at the other end.

### The tree

- **Folders: Tables, Table Groups and Memos; under a table, Columns, Indexes and Foreign Keys.** No root row and no database name. A folder holding nothing is not shown, nor are the groups or the memos while View Option hides them.
- **Order:** tables and groups by name, any case, ties as the document has them; a table's columns, indexes and foreign keys as the document has them (an owner decision of 2026-10-13); memos as the document has them.
- **Rows:** a folder by its glyph, name and a muted count; a column by its name and its muted type with `PK` or `FK`, after a key glyph or, keying nothing, a list glyph; an index by `name`, then `UNIQUE (columns, DESC where so)` muted; a foreign key, shown under its child table alone, by its columns, then `→ parent(columns)` muted; a group by its colour dot and name, with its tables as rows that go to them and fold to nothing; a memo by its first line. A blank name reads `common.unnamed`. What follows a name is cut before the name is, its whole text in its tooltip. Every glyph is a literal in its own branch, which `icons.test.ts` reads.
- **A key draws as the table draws it** (the owner's request of 2026-10-14): lucide's `key-round` in the key tokens a table's key cell takes (`table-view/column/column-key/ColumnKey.tsx`), `--key-pk`, `--key-fk` or `--key-pfk` for both. A foreign key's glyph takes its connector's colour: `--key-pfk` while it identifies the child, `--key-fk` otherwise. The Explorer has no key token of its own.
- **The tree is built and laid out by two observers of its own** in the panel: one builds the roots from what the document holds, or from the matches while a query stands, the other lays out the rows from the roots and the folding. A move, a selection, a hover, a zoom, an arrow key, a scroll or a drag of the edge does neither (`ExplorerPanel.browser.test.tsx`). A table's own folders are built only once it is expanded.
- **Collapse All folds one level a press** (the owner's request of 2026-10-14): the deepest level of the open rows shown, so presses fold from the bottom up, and the press that folds the top level folds every row, those hidden under a folded one too. In a search it folds into `searchCollapsed` the same way.
- **Folding is kept by node id**, and so is the row the keyboard is on, so an edit or a peer's batch moves neither. Node ids: `f:<folder>`, `t:<table>` and `t:<table>/f:<folder>`, `c:`, `i:`, `r:<relationship>`, `g:<group>` and `g:<group>/t:<table>`, `m:<memo>`, and a search's excerpt rows `<parent>/x:<field>:<start>`.
- **Nothing in the tree edits the document.** No rename, drag, delete or show toggle; the search's Replace is the one edit the panel makes.

### Where a row goes

- **A click or Enter jumps; the arrows only move in the tree.** A folder folds and unfolds. A table, an index and a group's table select the table alone; a column rings its name cell; a memo is selected; a group is selected alone. Table Properties closes first, before a match's jump too (an owner decision of 2026-10-13).
- **A foreign key shows its two tables, lights its relationship** (`relationshipHighlight.ts`) **and selects its child table alone with its foreign key columns**, the first focused, since nothing selects a relationship (the owner's request of 2026-10-14, replacing the cleared selection of 2026-10-13). Where the two cannot show together, the child does. The light goes out on the next jump from the tree and on a press that changes the selection.

### The search

- **The search sits between the header and the tree** (owner decisions of 2026-10-13): the arrow that unfolds the Replace row, folded at first, absent in a read-only editor and as tall as the rows it unfolds, as an editor's find draws it (the owner's request of 2026-10-14); the find field with Match Case, Whole Word and Regex inside it; the Replace field with Preserve Case inside it, then Replace and Replace All; the place in the matches with Previous and Next; three dots that unfold the seven scopes. The Replace row and the scopes stay as they were left for the element's life.
- **Find and Replace opens it**: `KeyBindingName.findReplace` on `$mod+KeyF`, and the palette's row and the context menu's (`openFindReplace`, which carries no query). An opening takes the ERD tab, opens the Explorer and asks the find field for the keyboard, its query selected.
- **An opening closes five dialogs**: Table Properties, the theme builder, the locale picker, the export image dialog and Map Columns, as they close one another (an owner decision of 2026-10-11). So the chord pressed while Table Properties is up trades that dialog for the search. `useKeyBindingMap.test.ts` pins it as a press the binding takes.
- **A window too narrow for the panel says so** with the `explorer.tooNarrow` toast and leaves the panel open, searched, for the root that widens; the keyboard stays where it was (an owner decision of 2026-10-13). A request for the keyboard that no drawn panel took by the renders it scheduled is let go (`requestSearchFocus`), so a panel drawn later takes nothing.
- **Pressed again, the chord closes the panel** the toolbar button shows pressed, as the button does, and the next press opens it with its query selected (the owner's request of 2026-10-14, replacing the rule that it only brought the keyboard back). With the palette or one of the five dialogs up it gives way to the search instead (`hasSearchDialog`). An opening with no query while shown, the palette row's and the context menu's, brings the keyboard back, its query selected, keeping the current match and the run (`focusSearch`).
- **The palette gives way to the chord.** With the palette open, the palette closes (`toggleSearchAction`), as it does when its own row is picked.
- **A text editor keeps the chord.** A cell, memo or group name editor keeps it, as it keeps `$mod+K`, the press still prevented (`isEditingText`).
- **Under a takeover, the host takes the chord.** Under the diff viewer, time travel or the automatic placement preview, on whichever tab, the chord yields to the host's find, neither prevented nor stopped, and nothing opens (an owner decision). `yields` in `src/hooks/useKeyBindingMap.ts` reads `isTakenOver` for every `YIELDS_TO_A_TAKEOVER` binding.
- **The chord works on every tab.** On Visualization, Schema SQL, Code Generator and Settings it brings the ERD tab up and opens the search; the palette row names it on every tab (an owner decision of 2026-10-03). A browser's find does not search the SQL, code and settings those tabs show as text.
- **The chord is every host's find, prevented and stopped.** Prevented, a browser opens no find bar over the editor; stopped, a VS Code webview never hands it to the workbench, which hears a key only through a keydown bubbling to its window. VS Code's own find widget stays off (no `enableFindWidget`) and Obsidian's view scope lets the chord past Search current file. Whether a JetBrains keymap takes it before JCEF is unchecked; the palette row and the context menu open the search either way.
- `YIELDS_TO_A_CARET` and the editor's Escape branch: `src/components/erd/AGENTS.md`.

### Scopes and options

- **Seven kinds of text are searched.** Table names and comments, column names and comments, index names, table group names and memos. A walk takes each table's name, comment, columns and index names, the index names in document order, then the group names, then the memos. Hidden memos and groups are not searched (`walkFields`), so a match is never one the reader cannot see.
- **The first opening searches names alone.** In each element it searches table, column, index and table group names, with Table comments, Column comments and Memos off (`DEFAULT_FIND_FIELDS`, frozen, so the view takes a copy). A comment or memo is prose a rename should not reach unasked (an owner decision, pinned in `explorerSearch.test.ts`).
- **Later openings keep the last scopes and options** for the element's life.
- **A walk in an order keeps it.** Given a `FieldOrder` (`treeOrderOf`: tables and groups by name, ties in document order), a walk takes the live ids in that order and any it never met after them, by name. With no order the walk is in document order, as the palette's is.
- Palette prefixes: `src/components/quick-search/AGENTS.md`.

### The search's tree

- **A query turns the tree into the search's** (`buildSearchTree`, owner decisions of 2026-10-13): the rows holding a match and the rows above them, in the order the search walked. A name's matches are marked on its own row; each match in a comment or memo is a row of its own, its excerpt (`snippetOf`) under the table, column or memo it is in, which Previous, Next and Enter step through like any match.
- **A group's tables are left out of it**: a table found shows under Tables alone, and a group found stands alone.
- **A folder counts the rows it shows** in the search, not what the document holds.
- **Every row with children shows open**, and a fold lasts until the next search (`searchCollapsed`). Clearing the query gives back the tree with the folding it had (`expanded`), which a search never touches.
- **The current match is the current row** (`aria-current`, `--tree-row-current`), scrolled into view as it changes, and the keyboard's row follows a jump, a Replace's included, which also unfolds the rows above the match. A row holding a match goes to it on a click or Enter, a name's row to its first; a row above the matches goes where it stands for.
- **The tree keeps the order a run began with** (an owner decision of 2026-10-13): a rename a run of Replace makes moves no table until the run ends. The step that ends it puts the order back by name in the same step, the matches with it, without a search (`newRun`), so the next render shows the rename in its place.

### Jumps to a match

- **A jump to a match follows the one jump rule.** `src/components/erd/AGENTS.md` (The jump rule) holds it: each axis judged on its own, the focus of a rect too big, the range in a cell too wide, and a jump pressed again moving nothing.

### Replace All

- **Replace All is one `dispatchSync`.** It dispatches the atom actions `src/utils/find-replace/replaceActions.ts` builds, so it makes one history entry and one batch to every peer.
- **It reads a fresh search, never the screen.** A peer or the canvas may have changed a text since the last search, and a value built on the old text would undo that change.
- **It counts only the matches it changed.** The count is `toReplaceActions`' `replaced`. A match written back as it was counts for none, and a press that changes nothing says `No changes`.
- **Find and Replace adds no action type.** Nothing new enters the action lists, so `mcp-server` has nothing to declare. Its `erd_list` search is its own, a word ranking for paging, not this substring match.

### Replace and its run

- **Replace carries the next jump in its dispatch.** The next match is found in the text the replacement leaves (`rematchField`). A scroll is an undo entry of its own, so dispatched apart, the first undo after a Replace whose next match is off screen would take back only the scroll.
- **The jump measures the table the replacement writes.** r-html flattens every generator of a batch against the state before it, so the jump (`showNextMatchAction$`) measures a table the replacement writes in from `withReplacement`: the field's new text at the width its reducer gives it, and a fresh table object, since the table size cache is keyed on none of a table's column widths.
- **A Replace run keeps where it began.** Once it has wrapped past the last match and comes back there, it stops with `No more matches` (`nextReplace`, `ReplaceRun`). There it would replace the text it wrote: `Customer` to `Big Customer` grew on every press. A replacement written before that place in its field moves it.
- **These start a new run.** A jump, a change of query, options or scopes, an opening and a Replace All. An opening with no query while shown only brings the keyboard back, so it starts none, and neither does Preserve Case, which only shapes what is written.
- **A Replace past the stop holds there.** It says `No more matches` again and goes nowhere, until something starts a new run; Next, Previous and a row are jumps.
- **Editing the Replace field starts no run.** Which matches a run went over does not depend on what it writes.
- **The run finds its field again each press.** It knows its field by entity and by the text it left there, and finds its slot again at each press (`resumeRun`), so a peer that adds or removes a table before it moves nothing. A field gone, or holding a text the run did not leave, starts a new run at the press, as after an undo or a peer's edit. Only the run's own field is checked.

### When the search searches

- **Only `FindTextActionTypes` batches search again.** The controller searches again 100 ms after the last batch, only on a batch holding one of them (an owner decision). That list is in `src/utils/find-replace/findMatches.ts`: the adds and removes of tables, columns, memos, indexes and table groups, the name and comment changes of tables and columns, the name changes of indexes and table groups, a memo's value, `table.sort`, `column.move`, `settings.changeShow` and the document loads.
- **Other batches never search**, the scrolls, zooms, moves, hovers, selections and jumps among them (an owner decision): none changes a text, and a slow pattern would stall the tab on every one. Nor does the batch of its own Replace or Replace All (`dispatchOwn`).
- **An edit while the panel stands aside leaves the matches stale**: on another tab, under a takeover, hidden by zen mode or on a root too narrow. The return of the panel searches at once (the controller's watch on the reach), so it never shows a list the document has left behind (an owner decision).
- **An opening searches once,** whatever was edited while the panel was away, and a Replace searches once, at the press, listing what its text left from `rematchField` (owner decisions).
- **An edit's search replaces the press's line.** What a press said gives way to the count once an edit's search runs (`searchEdited`), so an undo of a Replace All shows the matches it gave back counted (an owner decision).
- **Regex mode searches once typing pauses**, `REGEX_INPUT_DELAY` (150 ms); plain text searches on each keystroke, as it is linear (an owner decision). A press before the pause, Enter, Next, Previous, Replace, Replace All or a row, searches what is typed first (`searchPending`), and a row then goes to its match among those of what is typed, if any. A pause reached while the panel stands aside searches nothing and leaves what is typed to its return.
- **A slow regular expression has no time budget.** One that backtracks catastrophically holds the main thread until its search finishes (an owner decision of 2026-10-02). A search in a worker is the separate fix left open.

### The matcher

- **Compile every pattern in unicode mode alone.** `matcher.ts` does so through `toUnicodeSource` and never falls back to compiling without `u`. Legacy mode reads `\p{L}` as text and matches half an emoji, which a replacement then writes into the document as an unpaired surrogate.
- **`toUnicodeSource` rewrites what people type in names.** It keeps an escaped letter, digit or syntax character, writes `\-` as `\x2d` and any other escaped character as its `\u{…}` code point, so the `\_` and `\-` people type in names parse. A stray `]` or a brace no quantifier owns is literal (an owner decision); every other form unicode mode refuses (`[\w-.]`, `\z`) reads as an invalid pattern.
- **A regular expression takes `m`, never `s`.** `^` and `$` read at each line of a memo, a CRLF one too. A dot stays on its line, and `[\s\S]` reaches across.

### Preserve Case

- **Preserve Case cases a replacement the way the text it replaces is**, as VS Code's does (`preserveCase.ts`): all upper, all lower, or by the first letter, and piece by piece across the hyphens or the underscores both texts split into as many pieces by. It applies after a regular expression's `$1` and the rest are in, and a match it writes back as it was counts as no replacement.

### Whole Word

- **Whole Word follows VS Code and JetBrains** (an owner decision). An edge of a match is a boundary where a non-word character stands beside it or at that edge of the match itself. So `user ` finds `user name`, `.id` finds `user.id` and `-` finds `a-b`, while `user` never matches inside `username`.
- **The boundary is part of the pattern.** The matcher wraps the checked source as `(?:(?<!W)|(?!W))(?:…)(?:(?!W)|(?<!W))`, so the engine weighs the boundary while it matches; a filter after the match lost `users` to `user|users`. Every wrapper group is non-capturing, so `$1` and `$<name>` keep their numbers, and the source is compiled alone first, so the wrapper never balances `user)|(id`.
- **A word character follows UTS 18's `\w`** (an owner decision): a letter, digit or mark of any script, a connector punctuation or a joiner (ZWNJ, ZWJ). A virama, a Thai vowel sign or a decomposed accent stays inside its word, and a Persian ZWNJ splits none.

## Testing Requirements

- `explorerTree.test.ts`, `explorerNavigation.test.ts` and `explorer-panel/ExplorerPanel.browser.test.tsx` seed the document in `src/__test-utils__/explorerSeed.ts`; the search's specs seed `src/__test-utils__/findSeed.ts`.
- `explorerSearch.test.ts` pins the search's owner decisions: the names-only first opening, the run and its stop, the order a run keeps, the searches an edit asks for and the ones it never does, Replace All's one dispatch. It counts the searches through `vi.mock` of `findMatches`. `explorer-controller/ExplorerController.test.ts` pins the chord and the openings.
- `explorer-panel/ExplorerPanel.browser.test.tsx` and `explorer-search/ExplorerSearch.browser.test.tsx` mount the shell in a shadow root with the styles adopted and press real keys in Chromium; the first counts the builds and layouts through `vi.mock` of `explorerTree` and `treeModel`.
- `src/components/findPanelGone.test.ts` holds the floating panel's names out of `src`.
- `e2e/specs/explorer.spec.ts` checks the panel in the element: the widths, a click and the keys, the edge, a right-to-left language and a narrow window. `e2e/specs/find-replace.spec.ts` checks its search, the chord and the palette's rows.
- **The Obsidian smoke presses the chord** past Obsidian's Search current file and finds the search's field holding the keyboard; its steps are in `packages/obsidian-plugin/AGENTS.md`, Testing Requirements.
