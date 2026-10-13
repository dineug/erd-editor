<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# find-replace

## Purpose

`src/components/find-replace/` holds the Find and Replace panel (`FindReplace.tsx`), where it stands on the canvas (`panelLayout.ts`) and the jump Replace makes to the next match (`matchTarget.ts`). The search the panel runs lives in `src/utils/find-replace/`: the matcher, the walk over the document's texts and the replace actions. That directory has no AGENTS.md of its own, so its rules are here. Four other nested files touch the feature: `src/components/quick-search/AGENTS.md` (the palette's hand-off), `src/components/primitives/AGENTS.md` (the color picker, which shares the panel's key filter), `src/components/erd/AGENTS.md` (`YIELDS_TO_A_CARET` and the editor's Escape branch) and `src/components/AGENTS.md` (the icons). A change here keeps the owner decisions this file records and the specs that pin them.

## Making a Change

1. **Read the files on the other side.** A change to how the chord is taken reads `src/components/erd/AGENTS.md`, which holds `YIELDS_TO_A_CARET` and the editor's Escape branch. A change to `PANEL_PASSING_BINDINGS` reads `src/components/primitives/AGENTS.md`, since the color picker shares that list. A change to a query handed over reads `src/components/quick-search/AGENTS.md`.
2. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. The specs beside these files and in `src/utils/find-replace/` run in that test task, `FindReplace.browser.test.tsx` in real Chromium.
3. **Run the e2e suite for a visible change.** `e2e/specs/find-replace.spec.ts` drives the panel, its chord and its toolbar button. `pnpm --filter @dineug/erd-editor e2e` builds the package and runs every Playwright spec, this one included.
4. **Change a pinned rule and its spec together.** Testing Requirements lists which spec pins which owner decision.

## Key Files

A path starting with `src/` or `e2e/` is relative to `packages/erd-editor`; a bare file name sits in this directory.

| File | Description |
| --- | --- |
| `FindReplace.tsx` | The panel: the chord handler, the keydown filter, Escape, Replace and Replace All, and when it searches (`REGEX_INPUT_DELAY`, `dispatchOwn`, `searchEdited`, `searchPending`, `searchTyped`, `goToRow`) |
| `FindReplace.styles.ts` | The panel's scoped styles and `PANEL_CHROME_HEIGHT` |
| `panelLayout.ts` | `isPanelShown`, and `coveredWidth` with `MIN_CLEAR_WIDTH`, which no jump reads any more |
| `src/utils/takeover.ts` | `isTakenOver` and its `TAKEOVERS`, which the toolbar, the canvas, the palette, the draw target, the key binder and the viewport layout share |
| `matchTarget.ts` | `toErdTarget`, `withReplacement`, `showNextMatchAction$` |
| `fieldIcon.tsx` | The icon of a match row, which the palette's `#` rows share |
| `src/components/erd/goToErdTarget.ts` | `goToErdTarget`, `showErdTargetAction$`, `planJump`, `scrollIntoView`, `scrollTableIntoView`, `selectTableAloneAction$`, `EDGE_MARGIN` |
| `src/utils/find-replace/findMatches.ts` | `FindField`, `DEFAULT_FIND_FIELDS`, `FindTextActionTypes`, `findMatches`, `rematchField`, `ReplaceRun`, `resumeRun`, `nextReplace` |
| `src/utils/find-replace/matcher.ts` | `createMatcher`, `toUnicodeSource`, `DEFAULT_FIND_OPTIONS`, the Whole Word wrapper |
| `src/utils/find-replace/replaceActions.ts` | `toFieldAction`, `toReplaceActions` and its `replaced` count |
| `src/utils/find-replace/present.ts` | What a match row says: `FindFieldLabel`, `locationOf`, `describeMatch`, `snippetOf` |
| `src/utils/keyboard-shortcut/index.ts` | `PANEL_PASSING_BINDINGS`, shared with the color picker |
| `src/hooks/useKeyBindingMap.ts` | `yields` and `YIELDS_TO_A_TAKEOVER` |
| `src/components/toolbar/Toolbar.tsx` | The toolbar button |

## Rules

### Where the panel stands

- **The panel stands over the ERD tab alone.** Find and Replace is `KeyBindingName.findReplace`, on `$mod+KeyF`. Opened on another tab, it takes the ERD tab, like every jump from outside the canvas (Jumps to a match).
- **Five dialogs close it as they open.** They are Table Properties, the theme builder, the locale picker, the export image dialog and Map Columns, which close one another the same way (an owner decision of 2026-10-11). So closing one leaves the panel closed. `isPanelShown` (`panelLayout.ts`) still draws it over none of them.
- **Opening the panel closes those dialogs.** It closes each, as `$mod+K` does for the palette. So the chord pressed while Table Properties is up trades that dialog for the panel. This is an owner decision, pinned in `FindReplace.test.ts` and, as a press the binding takes, in `src/hooks/useKeyBindingMap.test.ts`.
- **It ends 16 px above the floating toolbar.** The toolbar is drawn whenever the panel is, zen mode included. So on a short canvas the list gives up its height rather than cover the toolbar's tools.
- **Its height never drops below its controls.** That floor is `layout.floor`: the controls above the list, measured by a `ResizeObserver`, plus `PANEL_CHROME_HEIGHT`. On a canvas too short for both, the count and Previous and Next stay whole down to the 16 px margin, over the toolbar where the two meet. CSS alone cannot floor the box at its controls, since Chrome's block-axis min-content of the panel is its whole list.

### Scopes and options

- **Hidden memos are not searched.** While View Option hides the memos, the walk skips them (`walkFields`), so a match is never one the reader cannot see and Replace All never rewrites one (`src/components/erd/AGENTS.md`, `Show.hideMemo`).
- **The first opening searches names alone.** In each element it searches table and column names, with Table comments, Column comments and Memos off (`DEFAULT_FIND_FIELDS`, `src/utils/find-replace/findMatches.ts`). A comment or memo is prose a rename should not reach unasked. This is an owner decision, pinned in `FindReplace.test.ts`.
- **Later openings keep the last scopes and options.** The panel keeps them for the element's life. That includes an opening with no query: the chord, the toolbar button, the palette row and the context menu.
- **A query handed over resets options and scopes.** It sets the default options and the scopes it names. So the palette's `:` hand-off turns both comments and Memos on. `findMatches` given no fields still reads every kind.
- Palette prefixes and the hand-off row past the cap: `src/components/quick-search/AGENTS.md`.

### Jumps to a match

- **A jump to a match follows the one jump rule.** `src/components/erd/AGENTS.md` (The jump rule) holds it: each axis judged on its own, the focus of a rect too big, the range in a cell too wide, and a jump pressed again moving nothing. A jump no longer keeps clear of the panel; the panel's own Next and the palette land by the same rule.

### The chord

- **The default chord is every host's find.** This is an owner decision. The panel takes it on every tab, from the canvas and from any field in the element alike.
- **The chord is prevented and stopped.** It is prevented, so a browser opens no find bar over the editor. It is stopped, so a VS Code webview never hands it to the workbench. Such a webview hears a key only through a keydown bubbling to its window.
- **VS Code and Obsidian let the chord through.** The extension leaves VS Code's own find widget off (no `enableFindWidget`). Obsidian's view scope lets it past Search current file (Testing Requirements).
- **JetBrains is unchecked.** Whether a JetBrains keymap takes the chord before JCEF is unchecked. The toolbar button, the palette row and the context menu open the panel either way.
- **Pressed again, it refocuses the find field.** Pressed while the panel is shown, the chord brings the caret back to the find field with its query selected, as every host's find does. It never closes the panel.
- **The palette gives way to the chord.** With the palette open, the palette closes (`toggleSearchAction`), as it does when its own Find and Replace row is picked.
- **A text editor keeps the chord.** A cell, memo or group name editor keeps it, as it keeps `$mod+K`, the press still prevented (`isEditingText`).
- **Under a takeover, the host takes the chord.** Under a takeover (the diff viewer, time travel, the automatic placement preview), on whichever tab, the chord yields to the host's find, neither prevented nor stopped. The panel would open on nothing there. This is an owner decision.
- **`yields` reads `isTakenOver` for this.** `yields` in `src/hooks/useKeyBindingMap.ts` reads `isTakenOver` (`src/utils/takeover.ts`) for every `YIELDS_TO_A_TAKEOVER` binding. The dialogs that close the panel still take the chord: Table Properties, the theme builder, the locale picker, the export image dialog and Map Columns.
- `YIELDS_TO_A_CARET` and the editor's Escape branch: `src/components/erd/AGENTS.md`.
- **The chord works on every other tab.** On Visualization, Schema SQL, Code Generator and Settings it opens the panel and brings the ERD tab up. The toolbar button and the palette row do the same, and name the chord on every tab. A browser's find does not search the SQL, code and settings those tabs show as text. This is an owner decision of 2026-10-03.

### Keys inside the panel

- **It stops only what the canvas acts on.** Its keydown stops a `keyBindingMap` chord outside `PANEL_PASSING_BINDINGS`, and an arrow or Tab. With the matched cell ringed, Enter would open the cell editor and `Alt+Backspace` would remove the column.
- **`PANEL_PASSING_BINDINGS` still reach the editor.** The list is in `src/utils/keyboard-shortcut/index.ts`, shared with the color picker: `findReplace`, `search`, `undo`, `redo` and the zoom.
- **Every other press goes on to the host.** A VS Code webview hears save or the command palette only through a keydown bubbling to its window.
- **Escape closes the panel.** From inside the panel it closes it. From the canvas it closes it through `stop` unless a cell, memo or group name editor, a relationship or table group draw or the palette takes that press.
- The color picker's own keys: `src/components/primitives/AGENTS.md`.

### The toolbar button

- **The toolbar button shows on every tab.** It sits in `src/components/toolbar/Toolbar.tsx` right after Search, named Find in a read-only editor. Opening takes the ERD tab, so the button shows everywhere and the bar never shifts as the tab changes.
- **Under a takeover it is dimmed and inert.** It keeps its place, `disabled`, at the 0.4 opacity of the panel's own disabled buttons. It opens nothing, as `open` returns there. This is an owner decision.
- **A click never closes the panel.** It opens the panel or, when the panel is shown already, brings the caret back to its find field, as the chord does.
- **An opening with no query keeps the match.** While the panel is shown, every opening with no query only brings the caret back (the `openFindReplace` handler): the toolbar's, the palette row's and the context menu's. It keeps the current match and the Replace run.
- **The button stops its press first.** It stops the press before the bar's unselect, which would take the ring off the current match.
- The command's `text-search` icon and a match row's icon (`fieldIcon.tsx`): `src/components/AGENTS.md`, Icons.

### Replace All

- **Replace All is one `dispatchSync`.** It dispatches the atom actions `src/utils/find-replace/replaceActions.ts` builds. So it makes one history entry and one batch to every peer.
- **It reads a fresh search, never the screen.** The search runs again at the press, never from the list on screen. A peer or the canvas may have changed a text since the last search, and a value built on the old text would undo that change.
- **It counts only the matches it changed.** The count is `toReplaceActions`' `replaced`. A match written back as it was counts for none, and a press that changes nothing says `No changes`.
- **Find and Replace adds no action type.** Nothing new enters the action lists, so `mcp-server` has nothing to declare. Its `erd_list` search is its own, a word ranking for paging, not this substring match.

### Replace and its run

- **Replace carries the next jump in its dispatch.** The next match is found in the text the replacement leaves (`rematchField`). A scroll is an undo entry of its own. Dispatched apart, the first undo after a Replace whose next match is off screen would take back only the scroll.
- **The jump measures the table the replacement writes.** r-html flattens every generator of a batch against the state before it. So the jump (`showNextMatchAction$`, `matchTarget.ts`) measures a table the replacement writes in from `withReplacement`. That gives the field's new text at the width its reducer gives it, and a fresh table object. The fresh object is needed, since the table size cache is keyed on none of a table's column widths. Measured on the state before, a replacement that widened the table left the next match off screen, and unscrolled.
- **A Replace run keeps where it began.** The run is `nextReplace` and `ReplaceRun` in `src/utils/find-replace/findMatches.ts`. Once it has wrapped past the last match and comes back there, it stops with `No more matches`. There it would replace the text it wrote: `Customer` to `Big Customer` grew on every press.
- **That place moves with an earlier replacement.** A replacement written before it in its field moves it.
- **These start a new run.** A jump starts one, as do a change of query, options or scopes, an opening and a Replace All. An opening with no query while the panel is shown only brings the caret back, so it starts none.
- **A Replace past the stop holds there.** It says `No more matches` again and goes nowhere, rather than round to the text the run wrote. It holds until one of those starts a new run; Next, Previous and a row are jumps.
- **Editing the Replace field starts no run.** Which matches a run went over does not depend on what it writes.
- **The run finds its field again each press.** It knows its field by entity and by the text it left there, and finds its slot again at each press (`resumeRun`). A peer that adds or removes a table, column or memo before the run's field moves that field's slot. A run held by its slot never came back, and grew `Customer` again.
- **A changed field starts a new run.** A field gone, or holding a text the run did not leave, starts a new run at the press, as after an undo or a peer's edit. So a match an undo gives back is replaced on the way round, not left behind a `No more matches`.
- **Only the run's own field is checked.** A match given back in another field the run went over stays as it is.

### When the panel searches

- **Only `FindTextActionTypes` batches search again.** The panel's store subscription in `FindReplace.tsx` searches again 100 ms after the last batch, only on a batch holding one of `FindTextActionTypes` (an owner decision). That list is in `src/utils/find-replace/findMatches.ts`. It holds the adds and removes of tables, columns and memos, the name and comment changes of tables and columns, a memo's value, `table.sort`, `column.move`, `settings.changeShow` (hiding or showing the memos takes them out of the walk or brings them back) and the document loads.
- **Other batches never search.** No search runs on the rest of `ChangeActionTypes`, which holds the scrolls, zooms and moves, nor on a hover, a selection or a jump (an owner decision). None of them changes a text, and a slow pattern would stall the tab on every one.
- **The panel's own replaces never search.** No search runs on the batch of its own Replace or Replace All (`dispatchOwn`), an owner decision.
- **An edit while aside leaves the list `stale`.** That is an edit made while the panel stands aside, still open: on another tab or under a takeover. The batch that shows the panel again searches at once, so it never shows a list the document has left behind (an owner decision).
- **An opening searches once.** It searches once, whatever was edited while the panel was away (an owner decision).
- **A Replace searches once, at the press.** It lists what the text it left holds from `rematchField`, which equals a second search (an owner decision).
- **An edit's search replaces the press's line.** What a press said (`Replaced 5 matches`, `No changes`, `No more matches`) gives way to the count once an edit's search runs (`searchEdited`). So an undo of a Replace All shows the matches it gave back counted, not the press's line over them (an owner decision).
- **Regex mode searches once typing pauses.** It waits `REGEX_INPUT_DELAY` (150 ms). Plain text searches on each keystroke, as it is linear (an owner decision).
- **A press before the pause searches first.** An Enter, Next, Previous, Replace or Replace All pressed sooner searches what is typed first (`searchPending`), as a change of search. So a Replace pressed then shows what it would replace, as in plain text, rather than replace a match the last query kept current (an owner decision).
- **A row clicked before the pause searches too.** It searches what is typed (`goToRow`). It goes to the match the row named if what is typed still finds it, and to none otherwise. It never goes to a match of the last query that the pause would then let go.
- **A pause reached while hidden searches nothing.** That is a pause reached while the panel is closed or stands aside (`searchTyped`). It leaves what is typed to the opening or the batch that shows the panel again, as a change of search.
- **A slow regular expression has no time budget.** One that backtracks catastrophically holds the main thread until its search finishes. The panel has no time budget, an owner decision of 2026-10-02. A search in a worker is the separate fix left open.

### The matcher

- **Compile every pattern in unicode mode alone.** `src/utils/find-replace/matcher.ts` does so through `toUnicodeSource` and never falls back to compiling without `u`. Legacy mode reads `\p{L}` as text and matches half an emoji. A replacement then writes that half into the document as an unpaired surrogate.
- **`toUnicodeSource` rewrites what people type in names.** It keeps an escaped letter, digit or syntax character. It writes `\-` as `\x2d` and any other escaped character as its `\u{…}` code point. So the `\_` and `\-` people type in names parse.
- **A stray `]` or unowned brace is literal.** `toUnicodeSource` takes a stray `]` and a brace no quantifier owns as themselves (an owner decision).
- **Other refused forms are invalid patterns.** Every other form unicode mode refuses (`[\w-.]`, `\z`) reads as an invalid pattern.
- **A regular expression takes `m`, never `s`.** `^` and `$` read at each line of a memo, a CRLF one too. A dot stays on its line, and `[\s\S]` reaches across.

### Whole Word

- **Whole Word follows VS Code and JetBrains.** This is an owner decision. An edge of a match is a boundary where a non-word character stands beside it or at that edge of the match itself. So `user ` finds `user name`, `.id` finds `user.id` and `-` finds `a-b`, while `user` still never matches inside `username` or `superuser`.
- **The boundary is part of the pattern.** The matcher wraps the checked source as `(?:(?<!W)|(?!W))(?:…)(?:(?!W)|(?<!W))`, so the engine weighs the boundary while it matches. A filter after the match lost `users` to `user|users`.
- **Every wrapper group is non-capturing.** So `$1` and `$<name>` keep their numbers.
- **The source is compiled alone first.** So the wrapper never balances `user)|(id`.
- **A word character follows UTS 18's `\w`.** `W` is a letter, digit or mark of any script, a connector punctuation (the underscore among them) or a joiner (ZWNJ, ZWJ). This is an owner decision. A virama, a Thai vowel sign or a decomposed accent stays inside its word, and a Persian ZWNJ splits none.

## Testing Requirements

- **Specs pin the owner decisions here.** `FindReplace.test.ts` pins the chord trading Table Properties for the panel, and the names-only first opening. `src/hooks/useKeyBindingMap.test.ts` pins the same trade as a press the binding takes. `panelLayout.test.ts` pins `MIN_CLEAR_WIDTH`, which no jump reads any more and which goes with the panel.
- **`FindReplace.browser.test.tsx` presses real keys.** The `browser` project runs it in real Chromium.
- **The Obsidian smoke presses the chord.** It presses `Mod+F` past Obsidian's Search current file; its steps are in `packages/obsidian-plugin/AGENTS.md`, Testing Requirements.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
