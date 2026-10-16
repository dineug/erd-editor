<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# quick-search

## Purpose

`src/components/quick-search/` holds the command palette: `QuickSearch.tsx`, the commands and table rows in `actions.tsx`, the prefix grammar in `paletteQuery.ts`, the document scopes in `scopedActions.tsx`, the list's row height in `paletteList.ts` and the Hangul letter matching in `hangul.ts`. A scoped list holds every row it finds and draws only those in view; Find and Replace, the Explorer's search its own row opens, has its rules in `src/components/explorer/AGENTS.md`. Its Display Language entry offers the languages the locale picker lists, and the picker's rules are in `src/i18n/AGENTS.md`. A change here keeps the owner decisions below: commands alone with no prefix, Fuse over the level's whole list on each keystroke, the Fuse threshold, `:` for comments and memos, and the Theme and Display Language entries.

## Making a Change

1. **Read the files on the other side.** A change to the Find and Replace row or to what the search opens on reads `src/components/explorer/AGENTS.md`. A change to the list's range reads `src/components/primitives/AGENTS.md` (The tree), which shares `src/utils/virtualRange.ts`. A change to Display Language or to a translated row's name reads `src/i18n/AGENTS.md`.
2. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. The specs here run in that test task, `QuickSearch.browser.test.ts` in real Chromium.
3. **Change a pinned rule and its spec together.** `QuickSearch.test.ts` pins the search over the level's whole list on each keystroke. `actions.test.ts` pins what `SEARCH_THRESHOLD` takes and lets go. `scopedActions.test.ts` bounds the Hangul spellings a keystroke makes.
4. **Run the e2e for a visible change.** `e2e/specs/find-replace.spec.ts` drives the palette's field rows in the real element and types through Chromium's own IME (Testing Requirements). `pnpm --filter @dineug/erd-editor e2e` builds the package and runs every Playwright spec, this one included.

## Key Files

| File | Description |
| --- | --- |
| `QuickSearch.tsx` | The palette: `rebuild`, the virtual list, the `.quick-search-empty` line, the `isComposing` guard, and the `clearHangulForms` calls on open, close and unmount |
| `paletteList.ts` | `PALETTE_ROW_HEIGHT` (45, which the row style matches), `PALETTE_LIST_MAX_HEIGHT` (400) and `paletteListHeight` |
| `actions.tsx` | `createScopeActions` (the top level), `searchActions` and `heldPastFuse`, `SEARCH_THRESHOLD`, `keywordHolder`, `named`, `createPreferenceActions`, and the table rows, which jump through `goToErdTarget` |
| `scopedActions.tsx` | `scopeBase`, `createPrefixActions`, `createFieldActions` and the rows it builds as they are drawn (`lazyMatchAction`), `rankTableActions` |
| `paletteQuery.ts` | The prefix grammar and `WIDE_PREFIXES` |
| `hangul.ts` | The Hangul letter matching and ranking, `clearHangulForms`, `hitRange` |
| `QuickSearch.test.ts` | Pins the search over the level's whole list on each keystroke |
| `actions.test.ts` | Pins what `SEARCH_THRESHOLD` takes (`tabel`, `imprt`) and lets go (`talbe`, `mmeo`) |
| `scopedActions.test.ts` | Bounds the spellings of the document's texts over 200 Korean tables |
| `QuickSearch.browser.test.ts` | Types through Chromium's own IME over CDP |
| `e2e/specs/find-replace.spec.ts` | The Playwright spec of Find and Replace and the palette's field rows; it also types through Chromium's own IME over CDP |

## Rules

### The palette with no prefix

- **With no prefix, list commands alone.** The empty input and every keyword list only what the tab offers (`scopeBase`). They never list a table, column, comment or memo row. The document is searched only under a prefix. This is an owner decision.
- **The top level still ends with table jumps.** `createScopeActions` still ends with a jump per table, which only `#` hands to Fuse. A table row's `Table` keyword stays out of Fuse's keys (`tableId`), since it fuzzes to most words.
- **Search the level's whole list each keystroke.** Every keystroke runs Fuse over the level's whole list (`scopeBase`), as VS Code's palette does, never inside its last hits. This holds with no prefix, under a prefix and in a submenu alike. It is an owner decision, pinned in `QuickSearch.test.ts`.
  - What a word lists owes nothing to what was typed before it. So `auto` typed over `qqqq` finds Auto Layout.
  - A Backspace from `users` to `u` lists what `u` pasted lists.
- **Without a holder, end with the prefix rows.** When no command listed holds the keyword, as typed or by its Hangul letters (`keywordHolder`), the list ends with `createPrefixActions`. That is one row per scope that searches the document (`#`, `@`, `:`). A row's `insert` types its prefix before the keyword (`users` becomes `#users`), so the arrows and Enter reach it like any row.
- **A Fuse hit alone does not count.** A command Fuse lists does not by that alone hold the keyword, so it does not keep the prefix rows away. Fuse fuzzes some words to commands that do not hold them (`tables` to New Table, Database and New Table Group).
- **`No commands match` shows when Fuse finds none.** The line (`.quick-search-empty`) shows above the prefix rows when Fuse finds no command at all. The list then holds the prefixes alone (`orders`, `users`, typed or pasted). A word Fuse fuzzes only to commands that do not hold it lists them above the prefixes with no line (`tables`). The empty input keeps its hint line instead.

### Fuse

- **Fuse runs at `SEARCH_THRESHOLD` 0.4.** It is set in `actions.tsx`, an owner decision, and `actions.test.ts` pins it.
  - fuse.js's default 0.6 fuzzed most words to some command: `memo` to Import and the relationships, `#us` to orders, `users` to Zero One and Zero N.
  - 0.4 still takes a near typo: `tabel` to New Table, `imprt` to Import.
  - 0.4 lets go of a typo no closer than an unrelated command: `talbe`, `mmeo`.
- **Add back held rows Fuse let go.** Fuse also scores where a hit starts (location 0, distance 100, fuse.js's defaults). So at 0.4 a word starting past index 40 of a long table name fell out of `#`. `searchActions` therefore adds after Fuse's hits every row that holds a keyword without Hangul as typed and that Fuse let go (`heldPastFuse`). The Hangul ranking adds what its letters spell in the same way.
- **Data type hints keep their own Fuse.** The data type hints in `src/components/table-view/column/useColumnCell.ts` keep their own Fuse at the default threshold.

### Prefixes

- **Prefixes follow VS Code's Cmd+P grammar.** `paletteQuery.ts` reads them, and `scopedActions.tsx` builds the rows each one lists.
- **Read a prefix at the top level only.** A submenu filters its own rows.
- **A prefix is the first character past spaces.** A space typed before it does not hide it, because read as a keyword, ` #users` would reach the prefix rows, which type a second prefix before it. An optional space may follow the prefix.
- **Four prefixes, each with its scope.**
  - `#` searches tables.
  - `@` searches column names.
  - `:` searches table comments, column comments and memos, an owner decision (2026-10-03). It walks no memo while View Option hides them (`walkFields`), and a row found before they were hidden goes nowhere (`showErdTargetAction$`). A double quote reads as plain text, and a quote is searched as typed.
  - `?` lists the prefixes as rows whose `insert` types one in and keeps the palette open.
- **`@` splits on the first dot.** In `@users.em` the table part (`users`) matches as a substring of the table name. `@users.` lists every column of those tables.
- **With no keyword, a scope lists all rows.** `:` lists only the non-empty texts.
- **Read full-width prefixes as the ASCII ones.** A Japanese IME, or a Chinese one in its punctuation mode, types full-width forms. They count as what they stand for (`WIDE_PREFIXES`: `＃` `＠` `：` `？`), as the first character only, like the ASCII ones. `．` and `。` count as the dot.
- **The empty input hints the prefixes.** It shows them as a clickable hint line.
- **Show the scope as a label.** The label follows the input. It sits on the input's right, or on its left under a right-to-left language. This leaves the caret where it was.

### Field rows and the list

- **`@` and `:` rows are a substring search.** The field rows (`createFieldActions`) search the column names, or the comments and memos, as substrings. They are rebuilt from the document on each keystroke.
- **A scoped list lists every row it finds** (the owner's request of 2026-10-14). `#`, `@` and `:` have no cap and no row handing the rest to Find and Replace, and `openFindReplace` carries no query.
- **A field row is built as it is drawn.** `lazyMatchAction` builds its snippet, location and jump the first time the list draws or picks it, so a list of thousands builds a few dozen a keystroke.
- **A row keeps its icon slot without an icon,** so every name starts in one line, as a context menu's does. The Table and Column Name Case rows and Schema SQL's Statements and Header draw none, as the code tabs' context menus do (the owner's request of 2026-10-15).
- **The list draws only the rows in view** (the owner's request of 2026-10-14). Rows stand at `PALETTE_ROW_HEIGHT`, the list stands as tall as they are up to `PALETTE_LIST_MAX_HEIGHT`, and `visibleRange` (`src/utils/virtualRange.ts`, which the tree shares) takes the rows in view with `VIRTUAL_OVERSCAN` either side. An arrow scrolls the keyboard's row into view (`offsetToShow`) once the list holds it, and a new list, a keystroke's or a submenu's, starts at its top.
  - `repeat` builds each row outside the render, so the render reads the selection and the range itself; a row reading them would miss a change.
  - The row style keeps `box-sizing: border-box`, since the offsets assume a row exactly `PALETTE_ROW_HEIGHT` tall.

### Hangul matching

- **A Hangul keyword also matches by letters.** This holds in the commands and in every scope (`hangul.ts`). A text holds the keyword when its jamo hold the keyword's. So each step a Korean IME hands over (`ㅅ` `사` `상` `사요` `사용`) still finds 사용자.
- **Initial consonants alone match syllable initials.** A keyword of initial consonants alone (`ㅅㅇㅈ`, spaces ignored) matches a text when the initials of the text's syllables hold it.
- **Read a cluster as its two consonants.** A cluster reads as the two consonants it joins, on both sides (`ㅄ` as `ㅂㅅ`); `ㄲ` stays whole. A Windows IME composes `ㅂ` then `ㅅ` into `ㅄ`, which no syllable has as its initial. So the literal `getChoseong(text).includes(query)` of the owner's rule would drop 부서 at that step.
- **Compose a decomposed text first.** A text stored decomposed (NFD, as macOS names files) is composed before matching. Its highlight covers each syllable's every jamo.
- **Rank Hangul hits in three tiers.** Fuse's rows rank whole, then from the start, then inside, then Fuse's own looser hits.
  - The field rows list first those holding the keyword as typed, in document order, as a keyword without Hangul lists them.
  - Then come those only its letters spell, by the same three tiers.
- **Widen a highlight to whole syllables.** A highlight covers the whole syllables a jamo reaches.
- **A keyword without Hangul skips all this.** It takes none of the letter matching or ranking.
- **Spell each text once per open.** The forms are spelled once per text and kept for one open of the palette, since the palette reads every field again on each keystroke.
  - `clearHangulForms` drops them as the palette opens, closes and unmounts.
  - So however large the document, no text's forms are spelled twice in one open, and none is kept once the palette is gone.
- **Call `hitRange` only for the rows drawn.** `hitRange` finds where a field row's Hangul hit lies, which centres the row's snippet and the jump's range. It spells the text again, so a row reads it only as the list draws or picks it (`lazyMatchAction`). `scopedActions.test.ts` holds the spellings over 200 Korean tables to one per text, then one per row drawn. It counts rather than timing the search, which a loaded machine stretches.

### Keys and composition

- **A key the IME holds does nothing.** While `isComposing` is set, a key moves and picks nothing; Find and Replace and the canvas read it the same way. An arrow or Enter pressed mid-syllable belongs to the IME. Chrome on a Mac sends that Enter again once the syllable is done.

### Table and field rows

- **Table and field rows show on every tab.** Picking one takes the ERD tab.
- **A table row lands by the one jump rule.** It jumps through `goToErdTarget`, as the `@` and `:` rows do (`src/components/erd/AGENTS.md`, The jump rule); the corner it once parked a table at is gone.
- **No Focus row exists** (AC-52).
- **Hand-offs leave the list under a takeover.** The Find and Replace row and the Toggle Explorer row leave the list under a takeover (`isTakenOver`), where the Explorer opens on nothing.

### Theme and Display Language

- **Preference entries show on every tab.** `createPreferenceActions` in `actions.tsx` adds Theme and Display Language (owner decisions of 2026-10-06). Theme shows only while `enableThemeBuilder` is on, Display Language only while `enableLocalePicker` is on.
- **Theme changes the appearance alone.** It lists System, Light and Dark. It sends `setThemeOptionsAction` with the appearance alone, so the gray and accent stay.
- **Display Language names each language in itself.** It lists System, then each language in its own name.
- **Check the option in force.** Each entry checks the option in force.
- **Keep a translated row's English in `Action.alias`.** `named` puts the English of a row's name and keywords there. A search reads the alias, Fuse included, and the list never shows it. So a command is found by its English words too.
  - A language row's alias is its English name and its code.
  - A table row ignores the field.
- **Open a submenu on its option in force.** The keyboard lands on that option (`Action.checked`), scrolled to it, as the locale picker opens.
- **Rebuild an open palette on a change.** An open palette builds its level again when the language or an option in force changes (`rebuild` in `QuickSearch.tsx`). So no row keeps the language it opened in.
  - It keeps what is typed and the submenu shown.
  - It finds the submenu again by its row's message key (`Action.id`), or shows the top level once the host took that row away.

### Rules held elsewhere

- The locale picker and the Settings page (`src/components/settings/settingsPage.ts`): `src/i18n/AGENTS.md`.
- Find and Replace, the Explorer's search its row opens, and its matcher: `src/components/explorer/AGENTS.md`.
- The palette's New Table Group and Group Selected Tables commands: `src/components/erd/AGENTS.md`.
- The palette's Import and Import and Add commands: `src/utils/AGENTS.md`.

## Testing Requirements

- `QuickSearch.browser.test.ts` and `e2e/specs/find-replace.spec.ts` type through Chromium's own IME over CDP (`Input.imeSetComposition`, `Input.insertText`). That is the one way a spec sees the steps a real composition hands over.
- A key pressed during such a composition reaches the input with `isComposing` set, as a real one does.
- **The e2e finds a row by `.quick-search-row`**, the one class a row keeps whatever the list draws. The list draws only the rows in view, so a spec, like a reader, types or scrolls to reach a row past them; `QuickSearch.browser.test.ts` lays the list out in real Chromium.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
