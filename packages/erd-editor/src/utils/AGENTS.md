<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# utils

## Purpose

`src/utils/` holds the helpers the editor's components, engine and services share: file import and export (`file/`), the clipboard (`table-clipboard/`), relationship geometry, the code and SQL writers, the parsers of the import formats, and single-purpose modules such as `tableKeys.ts` and `pinch.ts`. This file holds the rules for importing a file, as a placed replace or as Import and Add (`file/importSchema.ts`), and for duplicating entities through the clipboard (`table-clipboard/`). Three subdirectories have files of their own, listed under Subdirectories. The settings an import keeps and the table groups an append or a paste carries are in `src/engine/AGENTS.md`. The ELK placement that keeps table groups together is in `src/services/AGENTS.md`. The palette's Import and Import and Add commands point here from `src/components/quick-search/AGENTS.md`.

## Key Files

| File | Description |
| --- | --- |
| `file/importSchema.ts` | `importSchemaPlaced` (a placed replace), `appendSchemaPlaced` (Import and Add), `placeAndLand`, `landAppend` |
| `table-clipboard/copy.ts` | What a copy writes: the payload and the HTML table beside `text/plain` (`tableCopyToHtml`, `entitiesToHtmlTable`, `rowsToHtmlTable`) |
| `table-clipboard/payload.ts` | `CLIPBOARD_VERSION`, `PayloadKind` and the payload types |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `draw-relationship/` | `draw-relationship/AGENTS.md`. Relationship geometry: `sort.ts`, the `WeakMap` sort channels, `viewVersions`, referential actions at a connector's child end (`src/utils/referentialAction.ts`), compact ends and round corners, the window of the sort hooks |
| `generator-code/` | `generator-code/AGENTS.md`: the Code Generator's writers, the rules they share and one section per generator |
| `schema-sql/` | `schema-sql/AGENTS.md`: the SQL writers: Snowflake's `bracketType`, SQL Server comments and `MS_Description`, defaults as stored, dotted names, foreign key pairs, `createSchemaSQL`'s order, Oracle triggers, referential actions |

## Rules

### Placed imports

- **An import is placed before it lands** (owner decisions of 2026-10-04, `file/importSchema.ts`). One picked from the menu, the palette or a host's file dialog is placed; `webview-client` passes `placement: 'auto'` for a host's. A `setSchema*` call is placed only when given `{ placement: 'auto' }`. `app`'s `convertSource` passes it on a detached element and waits for the Promise before it reads `value`.
- **A placed replace runs in four steps.**
  1. It parses once (`toSchemaImportJson`).
  2. It measures that document on a store of its own (`src/components/erd/automatic-table-placement/flowPlacement.ts`), as the PNG export draws on its own.
  3. It lays the document out by Flow on the ELK worker through `layoutByElk` (`elkPlacement.tsx`, in the same directory).
  4. It replaces the document with one `loadJsonAction$` carrying the points, which start from `TABLE_SORT_START`. So one undo puts the previous document back, and no grid shows in between.
- **`layoutByElk` is the core `runElkPlacement` shares.** It takes the app context and nothing of `Erd`. Its Cancel and its stop key take the toast down at once, Auto Layout's toast included.
- **Some cases land the grid without a word.** These are: fewer than two tables or no relationship, a failure, no `SharedWorker`, and Cancel on the toast a slow layout raises (`SLOW_LAYOUT_MS`). The stop key cancels only while that toast is up.
- **The replace started last lands.** A load meanwhile, from anyone, supersedes a placed import. A placed replace started after it supersedes it too. An append supersedes nothing (Import and Add, below).
- **The carried settings are read again on landing.** So a tab or setting changed while the import placed stays as changed.
- **A readonly editor places nothing by any path.** The menu's and the palette's paths are included. `importSchemaPlaced` reads `store.getReadonly()` before it parses, because the readonly filter drops the load only after the layout, and the toast a slow one raises, have run.
- **`placeByFlow` answers points from the block's corner.** The points start at the corner of the block the tables make, so a caller placing the block elsewhere moves it.
- **`mcp-server`'s imports keep the grid.** elkjs is outside the peer graph's allowlist and its bundle budget.

### Import and Add

- **Import and Add appends instead of replacing** (owner decisions of 2026-10-04). These append: the menu beside Import, its five palette commands, a host's import carrying `mode: 'append'`, and a `setSchema*` or `setSchemaJSON` call given `{ mode: 'append' }`. The editor names a mode only for an append, so a host that knows none replaces. `webview-client` hands the mode to the setter.
- **An append adds the file as new entities.** It makes them the way a paste does. `toSchemaAppend` (`src/engine/modules/editor/generator.actions.ts`) reads the document through `toDuplicateInput` and `toCreateEntityActions` with `valuesOnly`, which sends no field left at what a new entity starts with. As a result:
  - every table gets a new id, and a table whose name is already there stays beside it;
  - relationships and indexes ride only between the tables the file brings, since the converters link nothing outside it, so a foreign key to an existing table is dropped;
  - no setting changes.
- **The block lands below the diagram.** It stands `APPEND_GAP` below `getContentRect` of the document at dispatch time, united with the boxes of its table groups while they are hidden, since a hidden group still holds its tables (an owner decision of 2026-10-10), and with its memos while they are hidden, which still stand there. It starts in line with that box's left edge, or at `TABLE_SORT_START` in an empty document. The block is stacked over the document: its tables and memos take z-indexes above the document's (`nextZIndex`), and its groups above the document's groups (`nextTableGroupZIndex`, `toAppendTableGroups`).
- **The block's layout depends on the file.**
  - A json file keeps its own placement.
  - SQL, GraphQL, DBML and AML take Flow from `placeByFlow`, behind the same rules as a placed replace (`appendSchemaPlaced`, `file/importSchema.ts`).
  - Where those rules give no Flow, the block takes the grid `sortTable` lays a replace out in, run on the document's own copy.
- **An append supersedes nothing.** Placed imports land in the order they started (`placeAndLand`). An append waits for those started before it and lands on the document a replace among them brings. Only a load or a placed replace started after it drops it.
- **Land the append selected and in view.** The editor lands it in one dispatch with the new tables, memos and table groups alone selected, the memos only while memos are shown and the groups only while groups are shown. A group is selected beside its members, so a drag of the block carries it and its drop judges none of them. An unselected group would lose them all once the block left its stored rect. A hidden group or memo is never selected, and a drag then judges no group.
- **The same dispatch scrolls the block into view.** It runs `scrollIntoView` on their box, by the one jump rule every go-to shares (`src/components/erd/AGENTS.md`). So one undo takes back the adds, the selection and the scroll.
- **Show the ERD tab in an earlier dispatch.** `showErdTab` takes the ERD tab from any other before the landing dispatch, because a batch is classified by the state before it. The owner decision of 2026-10-04 names Graph mode, Schema SQL and Code Generator. Settings follows it as another tab off the canvas. A Flow view must give way too, since `viewIgnoreFilter` would drop every add.
- **Unreadable or empty input changes nothing.** Text the parser cannot read, or a document with nothing in it, adds nothing and switches no tab.
- **The engine generators append on the grid.** `appendSchemaAction$` and `appendSchemaJsonAction$` are in the editor barrel. `mcp-server`'s imports run them for `mode: 'append'`: the grid, no selection, no scroll.
- **A readonly editor adds nothing by any path.** It offers no Import and Add in the menu or the palette (an owner decision of 2026-10-04). `landAppend` reads `store.getReadonly()` first, because the readonly filter drops the adds but not the selection, the scroll or the tab.

### Duplicates and the clipboard

- **A duplicate is one batch of atom actions** (`table-clipboard/copy.ts`, `src/engine/modules/editor/utils/duplicate.ts`). It takes no `attachChangeOnlyTag$` and no second dispatch, so one undo reverts it.
- **A relationship rides only with both ends.** It rides only when both of its ends are copied.
- **An index rides whole or not at all.** An index column has no identity outside its index (`ClipboardIndex`, `table-clipboard/payload.ts`). `index.add` goes before its `indexColumn.add`s.
- **`CLIPBOARD_VERSION` stays 1.** A bump makes shipped editors refuse new copies.
- **`PayloadKind.columns` carries no relationships or indexes.** Its payload carries neither the `relationships` nor the `indexes` array.
- **Every HTML cell goes through `escapeHtml`.** Every cell of the HTML table a copy writes beside `text/plain` goes through `escapeHtml` (`rowsToHtmlTable`, `copy.ts`), the escape the hidden JSON attribute uses. A spreadsheet, a document editor or a paste that reads only the HTML takes each cell's text content, and an unescaped `<b>` or `&amp;` would come back changed.

### Rules on files here kept elsewhere

- `tableKeys.ts` (keys the columns declare, alternate keys and their marks): `src/components/erd/AGENTS.md`.
- `pinch.ts` (`createPinch`, which Graph mode drives on its own view, and `isPinchWheel`): `src/components/erd/AGENTS.md`.
- `validation.ts` (`canvasSizeInRange`, where `sortTableAction` wraps its rows): `src/components/erd/AGENTS.md`.
- `stageCursor.ts`, `domEvent.ts` and `globalEventObservable.ts` in the middle-button pan (`holdStageCursor`, `preventMiddleLift`, `middlePanPress$`): `src/components/erd/AGENTS.md`.
- `contrastText.ts` (black or white text on a member table's header band, which takes its group's color): `src/components/erd/AGENTS.md`.
- `tableColor.ts` (`toOpaqueHex`, the first reading the color picker's `resolveColor` tries): `src/components/primitives/AGENTS.md`.
- `tableGroup.ts` (the DOM-free table-group helpers, inside the peer graph): `src/engine/AGENTS.md`.
- `file/exportFile.ts` (how Save file and every export name the file): `src/components/generator-code/AGENTS.md`.
- `find-replace/`, which has no file of its own (the matcher, `findMatches.ts`, `replaceActions.ts`): `src/components/explorer/AGENTS.md`.
- `map-columns/` (the pure half of Map Columns): `src/components/map-columns/AGENTS.md`.
- `referentialAction.ts` (the referential action codes a connector's child end shows): `draw-relationship/AGENTS.md`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
