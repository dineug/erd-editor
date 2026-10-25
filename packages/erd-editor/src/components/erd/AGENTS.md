<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-25 -->

# erd

## Purpose

`src/components/erd/` holds the ERD tab: `Erd.tsx`, its Konva scene under `canvas/`, the minimap, the scrollbars, Table Properties, the draw target, the table group commands, the diff viewer's pane, time travel and the welcome screen. This file holds their rules, with the presses and keys the canvas handles. Other nested files touch the same features: `src/components/map-columns/AGENTS.md`, `src/konva/AGENTS.md`, `src/engine/AGENTS.md` (the table-group model), `src/components/primitives/AGENTS.md`, `src/components/explorer/AGENTS.md`, `src/components/quick-search/AGENTS.md`, `src/services/AGENTS.md` and `src/i18n/AGENTS.md`; each pointer below says what it holds. Paths are relative to this directory, and a bare file name sits in the directory its bullet, its section's first bullet or the Key Files table names. A path that starts with `src/` or `e2e/` is relative to `packages/erd-editor`.

## Making a Change

1. **Read the nested files the change reaches.** Purpose names them; a change to the draw target's Map button reads `src/components/map-columns/AGENTS.md`, one to a scene root reads `src/konva/AGENTS.md`.
2. **Run the package's test task and coverage run.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives both. The `*.browser.test.{ts,tsx}` specs this file names run in that task, in real Chromium.
3. **Run the e2e suite for visible changes** (root step 6): `pnpm --filter @dineug/erd-editor e2e`. `e2e/specs/table-properties-indexes.spec.ts` finds Table Properties' rows by their titles (Rules, Table Properties).

## Key Files

| File | Description |
| --- | --- |
| `Erd.tsx` | The ERD tab's root: `handleDragSelect`, the `canDrag` `closest()` list, `TAKEOVER_CHROME`, `handleContextmenu`, and while readonly `handleReadPress` on `canvas/readPress.ts`; mounts the welcome screen |
| `hitTest.ts` | Records what konva resolved at dispatch; `ownsPress`, `SceneHit.columnId`, and `listenSceneHover`, the entity a pointer comes onto, which the read-only view and a readonly ERD tab light by |
| `goToErdTarget.ts` | The one jump rule: `planJump`, `scrollIntoView`, `showErdTargetAction$` over tables, column cells, memos, relationships and table groups, `goToErdTarget` |
| `erdTarget.ts` | `toErdTarget`, the `ErdTarget` a match of Find and Replace or of the palette's `@` and `:` rows jumps to (The jump rule) |
| `fieldIcon.tsx` | The icon a row found in a field draws for the kind of text it was found in, which the Explorer's search and the palette share (`src/components/AGENTS.md`, Icons) |
| `relationshipHighlight.ts` | The relationships a host lights, per `editor.id`, out of the store: a jump's one, or what the read-only press rule's pointer and still press light (`setRelationshipHighlights`) |
| `canvas/highlightTransition.ts` | The highlight ticker, its keys led by `editor.id`: `transitionTo`, `progressOf`, `stopTransitions(editorId)`, which drops one editor's keys, and `countTransitions(editorId)`, the test probe of how many it still holds |
| `useErdShortcut.ts` | The `stop` branch (Escape) and the `removeSelection` branch (Delete and Backspace) |
| `canvas/Canvas.tsx` | The stage container, on which `listenMiddleButtonPan` binds in the capture phase, and the `dir="ltr"` controller it stands in, which draws the `overlay` its host hands in after it |
| `canvas/CanvasScene.tsx` | `renderCanvasScene`, the paint order, the drag layer's `dragIds`, and `CanvasLayers`, what a host hands in at each layer: a layer under the scene, a relationship draw's preview, a drop target, the marquee's layer and the presence layer's parts |
| `canvas/editingLayers.ts` | What `Erd.tsx` hands its canvas as `CanvasLayers`: the relationship draw's preview, where a drag would drop tables into groups, the marquee, and the collaborators' pointers and marquees and the drag ghosts in the presence layer. The Flow hands in its particles and the marquee, and the diff panes, time travel and the placement preview, which edit nothing, hand in none |
| `canvas/sceneHit.ts` | The hit functions every hit box comes from |
| `canvas/useMoveEntity.ts` | Entity drags: `clickKinds`, `isMainButtonPress`, the drop into groups in its finalizer, no press at all in a scene under `'read'` (`src/components/sceneInteractionContext.ts`), and a drag that ends at its first step once its scene reads, dropping nothing |
| `canvas/middleButtonPan.ts` | `listenMiddleButtonPan`, the middle button's pan |
| `canvas/sceneTokens.ts` | `mainButtonClick`, `TABLE_GROUP_FILL_OPACITY` |
| `canvas/EditOverlay.tsx` | The cell editor, which opens the term list over a logical name and the domain picker over a domain, and `TableGroupNameEditor`; `Erd.tsx` hands it to its canvas as the `overlay` while not readonly, so it stands left to right in every language and no other scene mounts it |
| `canvas/table/dictionaryMarks.ts` | The colour a name cell's text takes for what the dictionaries' checks find: `tableMarkFill`, `columnMarkFill`, `dictionaryMarkFill` |
| `canvas/table-group/` | Table groups in the scene: `TableGroups.tsx`, `TableGroupBody.tsx`, `TableGroup.tsx`, `TableGroupSash.tsx`, `TableGroupDropTarget.tsx`, `tableGroupBox.ts`, `titleLayout.ts`, and `tableGroupNameEditor.ts`, which opens a group's name editor for the title bar and the commands alike |
| `table-group/` | Table group commands: `useTableGroupDraw.ts`, `TableGroupDraft.tsx`, `tableGroupName.ts` (`addTableGroupAndRename`) |
| `draw-target/` | The buttons beside a draw's target: `DrawTargetButtons.tsx`, `findDrawTarget.ts`, `drawTargetState.ts` |
| `table-properties/` | Table Properties and its three tabs |
| `minimap/table-group/TableGroup.tsx` | The minimap's group box, `FILL_OPACITY` |
| `diff-viewer/diff-erd-viewer/DiffErdViewer.tsx` | A diff pane's scene, with its own `canDrag` list |
| `diff-viewer/DiffViewer.tsx` | The diff: the two panes, the tree's width and the teardown that puts out both panes' lights |
| `readerNameView.ts` | `readerNameViewAction`, the switch that opens the diff panes, time travel, the placement preview and the store a placed import measures on in the reader's name view |
| `nameViewOptions.ts` | The three name views and the label each is picked by, which the canvas menu's Name View (`erd-context-menu/menus/nameViewMenus.ts`), the palette, the floating toolbar's list and the Settings tab's lock row read |
| `view-controls/` | The controls a bar over a scene holds for the reader's view: the zoom out, readout and zoom in (`zoomControls.tsx`), the compass (`ToolbarCompass.template.tsx`) and the Name View list (`nameViewDropdown.tsx`), drawn in `viewControls.styles.ts`. They are templates the bar renders in its own row, so the zoom, the compass and the Name View trigger stand in its `dir="ltr"`, and the bar draws the Name View menu beside itself. `floating-toolbar/FloatingToolbar.tsx` and the read-only view's controls bar (`src/components/erd-view/ErdView.tsx`, beside its Fit) compose all three, and the Visualization toolbar the last two; nothing here imports the floating toolbar, which the read-only view must not reach (`src/viewer/imports.test.ts`) |
| `src/utils/diff/diff.ts`, `src/components/diffContext.ts` | What the scene reads of a diff: `Diff` (insert, delete, modify, rename), `DiffMap`, `diffTextColor`, `diffOutline` and the paths, which import no engine, and `diffContext`, the marks a diff pane provides; outside `diff-viewer/`, since every scene reads them |
| `diff-viewer/diff-tree/DiffTree.tsx`, `diffTreeModel.ts` | The diff tree on the shared `Tree`: its rows, filter, tooltips (`describeEntry`) and where a row takes each pane (`diffTargets`) |
| `src/utils/diff/` | The diff engine: `diffDocuments`, `pairEntities`, `compareEntities` |
| `welcome-screen/` | The welcome screen, `welcomeTiers`, the hint arrows in `welcome-screen/welcome-hints/` |

## Rules

### Table rows

- **Only a Flow card rules its rows.** A view's row draws `.column-row-divider` under every row but the last (`divider={view && …}`, `canvas/table/Table.tsx`). The ERD scene's table draws no line between rows, and neither does Graph mode's hover card (`src/components/table-view/Table.styles.ts`). That is because the hover card matches the table the scene draws. `Table.showMode.browser.test.tsx` and `Table.styles.test.ts` pin both.

### Name views

- **Three views, one rule per cell** (`settings.nameViewMode`, owner decisions of 2026-10-19; the lock and the switch: `src/engine/AGENTS.md`, Locks). `src/engine/modules/editor/utils/nameView.ts` says what each view lays out, and the focus maps, `canvas/table/cellLayout.ts` and `src/utils/calcTable.ts` all read it.
  - Physical draws what it always did. The logical view puts the logical name in the place of each name, header and row, and its type cell stands for the domain (`isDomainInTypeCell`) while the domain has no cell of its own. The view of both sets the logical name before the name in the header and gives each row a logical name cell (`ColumnType.columnLogicalName`), which `settings.columnOrder` places.
  - The domain cell (`ColumnType.columnDomain`) shows under `Show.columnDomain` in every view. While it shows, the logical view's type cell keeps the type, so no row draws the domain twice (an owner decision of 2026-10-21).
- **Each cell has its focus.** `FocusType.tableLogicalName`, `columnLogicalName` and `columnDomain` name the new cells, and the logical view's name and type cells take them in place of `tableName`, `columnName` and `columnDataType` (`toNameViewFocusType`). `getTableFocusTypes` and `getColumnFocusTypes` list a header's and a row's cells in order; `getHeaderCellSlots` and `getColumnCellSlots` lay out exactly those (`cellLayout.test.ts` holds the two to each other).
  - A new column takes the first cell its row lays out (`getFirstColumnType`), as a new table takes its header's: the logical name in the view of both under the default order, whatever `settings.columnOrder` puts first otherwise. That covers Alt+Enter, the header's add button and Tab past the last cell (`addColumnAction$`), and the primary key a relationship draw adds to a table with none (`drawStartAddRelationshipAction$`).
  - A focus asked for by a cell the view leaves out lands on the cell drawn in its place, the name and the logical name standing in for each other, as the type and the domain do (`toShownFocusType`, in the `focusTable` and `focusColumn` reducers and the jump rule's `visibleFocusType`). A switch moves the focus the same way and closes an editor it moves off (`keepFocusShown`), and so does `Show.columnDomain` turned on or off, which decides whether the logical view's type cell stands for the domain (`changeShow`), and a load that lands another view or Domain bit (`editor.loadJson`, `editor.initialLoadJson`); the arrows walk on from such a cell too. A peer's focus, which names the cell of the peer's own view, is underlined on the cell this reader draws in its place the same way (`canvas/table/useSharedFocusTable.ts`), and in a view on the cell its row draws in that place (`getViewColumnFocusTypes`).
- **Each cell draws what its view names** (`canvas/table/Table.tsx`, `canvas/table/column/Column.tsx`). A logical name cell draws the logical name. While it is blank, a logical name of blanks included, the logical view draws the name in its place in the placeholder colour, or the name's own placeholder while that is blank too, and the view of both draws `common.placeholder.logicalName` (`canvas/table/blankLogicalName.ts`, `drawsNameForLogicalName`). The logical view's type cell draws the domain's name while the column links a listed domain by a name, else the type; the domain cell draws that name, or `common.placeholder.domain` in the placeholder colour (the owner's request of 2026-10-21). A dragged row's ghost writes its name and type cells the same way (`canvas/column-drag-ghost/ColumnDragGhost.tsx`).
  - A diff pane marks a change to the type on the type cell in every view. In the logical view a rename, and a hidden comment's change after it, go on the logical name drawn in the name's place.
- **A Flow card follows the view too** (`canvas/table/cellLayout.ts`, an owner decision of 2026-10-21). A view reads no show bit, so it lays its cells out by the name view alone (`sceneNameSettings`, `getViewColumnTypes`), and nothing else differs from the canvas.
  - The physical view draws the header name and each row's name and type.
  - The logical view draws the logical names in their place, a blank one as above, and a type cell standing for the domain whatever `Show.columnDomain` says (`drawsDomainInTypeCell` with the view's source).
  - The view of both draws the logical name and then the name in the header, the name muted in the placeholder colour, and four cells a row: the logical name, the name, the domain, or `common.placeholder.domain` in the placeholder colour while the row links none, and the type.
  - Every card draws its type and domain cells, lit or not (an owner decision of 2026-10-21); a hover lights the border, the glow, a related row's tint and the connectors alone. A domain's name keeps the text face it is measured in where a view writes a type in the code face.
  - `calcViewTableWidths` sums the same cells, so the card, its hit boxes, its dividers, the anchors and the box ELK places stand at the width it draws. `Table.nameView.browser.test.tsx` pins each view.
- **A name cell is written in the colour of what the checks find** (`canvas/table/dictionaryMarks.ts`, owner decisions of 2026-10-20). A logical name cell, the header's or a row's, takes `dictionaryErrorForeground` while its logical name uses a forbidden word, else `dictionaryWarningForeground` while it uses a synonym or a word the word sheet lacks. A name cell takes the warning colour while the term its logical name matches gives another physical name (`checkTable`, `checkColumn`, `markOf`; the checks: `src/engine/AGENTS.md`, Dictionaries and derived names).
  - Each cell marks only the field it draws, so the logical view marks no physical name and the physical view no logical name. Empty sheets mark nothing, and a blank cell keeps its placeholder colour. On a coloured group's header a mark keeps its colour only while it reads there at 4.5:1, and otherwise gives way to the header's black or white (`readableMarkFill`, an owner decision of 2026-10-20), since the group's colour is the reader's pick and a mark of a near hue would hide the name.
  - A scene of the document draws them: the ERD tab's, time travel's and the placement preview's. A view, a diff pane, whose changes take the colours a mark would share, and an export (`checkMarks={false}`, `src/components/export-image/AGENTS.md`) draw none.
  - A cell reads its mark off the cached indexes as it draws. A row edited in place keeps its sheet's list and length, all a cached index reads, so a count per store that every `dictionary.*` batch raises wakes each marked cell, one subscription per store rather than one per cell.
  - `radix-ui-theme.test.ts` holds both colours at 4.5:1 in every theme on each fill a marked cell is written on: the table body, the header band, and a hovered or selected row. Light takes a darker red and amber of its own for that (`LightThemeConfig`). A coloured group's header holds the same floor at draw time instead, since its colour is the reader's pick (above). `Table.dictionaryMarks.browser.test.tsx` checks the marks with empty and filled sheets.
- **A cell edits what it draws** (`canvas/EditOverlay.tsx`). A logical name cell writes `logicalName` on every key, `table.changeLogicalName` or `column.changeLogicalName` (the logical name branch of `changeColumnValueAction$`), and a key derives no name. A name cell writes the name and turns its derived flag off (`src/engine/AGENTS.md`, Dictionaries and derived names). The editor over a blank logical name shows what the cell drew as its placeholder.
  - A logical name cell, the header's or a row's, completes term names (`src/components/table-view/column/column-logical-name/ColumnLogicalName.tsx`). Each key lists under it the terms whose names start with the text, at most eight (`completeTerms`), and nothing while none does or the term sheet is empty. The arrows walk the list round, and Enter or a press on a row writes the term with its derivation in one dispatch (`setColumnLogicalNameAction$`, `setTableLogicalNameAction$`), Enter ending the edit too. A key the IME holds moves and picks nothing, as in the palette.
  - The name is derived once as the editor closes (an owner decision). Enter, Tab, Escape, a blur or an unmount on a logical name other than the one it opened with sends `deriveColumnNameAction$` or `deriveTableNameAction$`, its own dispatch and undo entry after the keys'. A term picked has derived already, so its close sends nothing; neither does the close of a cell whose table or column the document no longer lists, nor one the element's teardown makes.
  - A domain cell picks a domain, and so does the logical view's type cell while it draws one (`drawsDomainInTypeCell`; `src/components/table-view/column/column-domain/ColumnDomain.tsx`). It opens on no text, with what the cell drew as its placeholder, the domain's name or `common.placeholder.domain`, over None and then every named domain in sheet order, on the row of the domain linked; a search lists the domains whose names hold the text in any case, on the first. Enter or a press links the row picked with its type in one dispatch (`setColumnDomainAction$`) and ends the edit, None unlinks, and nothing typed is written. While the sheet lists no named domain there is no row, and Enter ends the edit writing nothing.
  - The logical view's type cell of a row that links no listed domain by a name draws the type, so it keeps its focus (`FocusType.columnDomain`) and edits the type with the data type list (`toEditedFocusType` in `canvas/EditOverlay.tsx`), its placeholder the one the cell drew. Such a row takes a domain in the domain cell, which View Option's Domain shows.
- **Widths follow the view.** `ColumnWidth.name` and `dataType` are the cells in those places: in the logical view a row's logical name width, or its name's while it has none, and its domain's width while the type cell draws a listed domain by a name (`drawsDomainInTypeCell`), else its type's. `logicalName` is the view of both's own cell and `domain` the domain cell's, 0 while not laid out. The header adds up its cells the same way (`headerCellWidth`), the logical view's name cell at the name's width while the table has no logical name. The widths live in the runtime `ui` alone.
- **A switch lays the connectors out again.** The sort hook's `layoutActions` hold the switch, a lock change, both logical names, a domain link and the three dictionary writes; `reachesLayout` lets through only a switch the store shows, shared or its own, a domain added, renamed or removed and an unlock of the name view. So a word or term commit, and another reader's own switch, which the store drops, sort nothing. The size key holds `nameViewMode` and the header's `ui.widthLogicalName`.
  - A view sorts for a switch and an unlock as the document does. A logical name, a domain link and a domain renamed sort it only outside the physical view, which draws none of them (`isNameViewOnly`), and a logical name or a link only on a table it shows. Its size key holds the same two, and a switch places the Flow again, fitting the screen to it for the reader's own switch alone (`placedKey`, `src/components/AGENTS.md`). A domain's type reaches a view through `column.changeDataType`.
  - `measureTableSize` measures in the view the store shows, so a peer measures at the value it loaded, the lock's for a locked file.
  - A locked view is each reader's own, so two readers' connector anchors can differ; the runtime value carries the anchors, which a load derives again (`peer-store.converge.test.ts` compares the rest).
- **Three places switch the view** (`nameViewOptions.ts`). The canvas menu's Name View, beside View Option, the palette's, after Tab and on the ERD tab alone, and the Name View list of the floating toolbar, before zen mode, which the Flow's bar carries beside its row display (`view-controls/nameViewDropdown.tsx`, the owner's request of 2026-10-21), list Physical Names, Logical Names and Both Names with the view in force checked, and send `toNameViewModeAction(store.state, value, store.getReadonly())`. The list opens over the bar, as the row display's does, and its trigger holds the width of the longest name, so a pick never slides the centred bar. The top toolbar has no button for it. View Option's Domain row turns `Show.columnDomain` on and off. The Settings tab's lock row names each view by the same labels.
- **Derive Physical Names Again puts names back under the dictionaries** (`rederiveNamesAction$`, one dispatch and one undo). It turns the derived flag of each name it reaches on and derives the name again from its logical name; Derive Physical Name Again, in the singular, reaches one column.
  - The table menu's row reads the press as its last row does (Keys on the canvas): the selected tables while the table is one of two or more selected tables the document lists, a row pressed included, else the column whose row the press landed on while the table still holds it, else the table, its name and every column (`erd-context-menu/ErdContextMenu.tsx`).
  - The canvas menu's row, after Name View, reaches every table of the document, and shows while the document lists one.
  - The palette's four rows, after its Name View and on the ERD tab alone, reach the focused column, the focused table, the selected tables while two or more are listed, and the whole document (`createRederiveActions`, `src/components/quick-search/actions.tsx`). Each shows only while it has something to reach, and its keywords tell it from the others.
  - A readonly store shows none of them.
- **A copy holds the cells its rows draw**, and a paste reads them back the same way: `src/utils/AGENTS.md`, Name views on the clipboard.
- **Every other place that names a table or a column follows the view** (`toNameLabel` in `nameView.ts`): the zoomed out table (`canvas/high-level-table/HighLevelTable.tsx`), Graph mode's labels and its hover card (`src/components/visualization/`), the Flow's cards, which lay out the canvas's cells (above), Table Properties' chips and rows, the rows of an index's order among them, the diff tree, Map Columns, the draw target's title and the Dictionary tab's check targets (`nameOf`), the Explorer's table, group table and column rows, and the palette's table rows. The Explorer's index and foreign key rows list their columns and parent table by name (`src/components/explorer/AGENTS.md`, The tree). Each place that follows the view shows the logical name in the logical view, or the name, dimmed where the place can dim it, while the logical name is blank. In the view of both it shows the logical name with the name after it: muted in a row of text, on a second line on the canvas, in brackets where one text has to hold both. Each list keeps its order by the name. A search reads both names whatever the view draws: Find and Replace (`src/components/explorer/AGENTS.md`, Scopes and options) and the palette's `#` and `@` (`src/components/quick-search/AGENTS.md`, Prefixes).
  - A row drawn in the DOM, the hover card's and Table Properties', lays out the cells the canvas row does, its type cell drawing the domain where the canvas does and its domain cell dimming `common.placeholder.domain` while the row links none, at the widths `calcTableWidths` gives (`src/components/table-view/column/columnViewText.ts`).
  - The diff panes, time travel and the placement preview open from the file, which holds the view the lock keeps, so each switches its own screen to the reader's view as it loads (`readerNameView.ts`). The placement preview then lays tables out at the widths the reader sees, and so does a schema import or append, placed or not, whose Flow measures on a store opened the same way (`automatic-table-placement/flowPlacement.ts`) and whose grid on a copy in the view the store shows (`src/utils/AGENTS.md`, Placed imports).

### Keys and alternate keys

- **Column-declared keys are never index entities.** `src/utils/tableKeys.ts` derives them at render time.
  - `getColumnKeys` gives the primary key and each unique column. They are the read-only rows the Indexes tab lists above a separator, each with a lock where an index has its remove button.
  - `getAlternateKeys` gives the alternate keys: every unique index over two or more of the table's columns. Their member columns carry `AK<n>.<m>` by their place in `indexColumnIds` (`getAlternateKeyMarks`).
  - A single-column unique index and a UQ flag carry no number. They are the same constraint in two spellings, which a Snowflake round trip swaps.
  - Nothing is stored but the `Show.columnAlternateKey` bit. It is off in every existing document, so no diagram widens until a reader shows the marks.
- **Number AKs by column order, never `doc.indexIds`.** Keys compare by the positions of their columns in key order, a prefix first, the index id last. An undo re-adds an index at the end of `doc.indexIds`, and peers append concurrent adds in arrival order. So numbering by that list swapped numbers on undo and differed between collaborators (`src/utils/tableKeys.test.ts` pins both). Reordering the columns may renumber instead.
- **A mark always stands last in its row.** It belongs to no column order. It is derived and never edited, so it is no `ColumnType`, no `FocusType` and no entry of `settings.columnOrder`.
  - `getAlternateKeyMarkX` puts it one margin past the last cell `getColumnCellSlots` lays out, whatever the order.
  - The cells keep `getColumnCellsX`, so the column names stay in line with the header name. The edit overlay and the drag ghost never move for the mark.
  - Its `k-text` does not listen, so a press on it is a press on the row, as between two cells.
  - Keyboard focus, the cell editor, copy and paste walk the order and never reach it.
  - Graph mode's DOM card (`src/components/visualization/table/`) draws it last too.
- **Marks widen only the tables that carry one.** `calcAlternateKeyWidth` sizes the room after the last cell from the longest mark, at `COLUMN_ALTERNATE_KEY_CHAR_WIDTH` per character. That is the code face at the cell size with no text measure, so the peer sizes it too. The width is kept in `ColumnWidth.alternateKey` and added to the row sum like any other cell.
- **Key actions remeasure only while marks show.** They are the seven actions that add, drop, reshape or renumber a key: the five index ones, `moveIndexColumnAction`, and `moveColumnAction`, which renumbers. They are in the sort hook's `layoutActions`, which bumps the width generation the size cache keys on. The hook lets them through only while the bit is set. They are in `isDocumentOnly` too, since a view's geometry sees none of them.
- **A table reads only its own indexes.** `getTableIndexIds` groups `doc.indexIds` by table once per add or drop and caches the grouping on the list. So a sort measures every table in one pass over the indexes, not one per table.
- **Invalidate the grouping on an in-place write.** The two index reducers that push and splice the list call `invalidateTableIndexes`. Call it from any other in-place write to the list too. A replaced list or entity map is caught by identity.
- **An observer reads the length and its indexes.** It reads `doc.indexIds.length` and its own indexes' fields. So with the bit set, an index add or drop redraws every table, and any other index change redraws only its own. `src/utils/tableKeys.test.ts` pins both.
- **Primary Key and Alt+K reach selected columns.** They reach the whole column selection once the focused column is one of two or more selected columns still in its table (`getFocusedColumnIds`, `src/engine/modules/editor/utils/focus.ts`). The menu item then reads Primary Key on selected columns.
  - A column the bare `column.remove` leaves out of its table keeps its entity and stays in `selectColumnIds`. An undo of an add, a peer or an agent can do that. So both the helper and `changeColumnsPrimaryKeyAction$` read only ids still in `table.columnIds`, as `pasteTableAction$` does.
  - That generator makes every one a key while any is not, and clears them all once all are. It sends nothing for a column already there, since the undo of `column.changePrimaryKey` records the negation of what was sent.
  - One column toggles as before; `changeColumnPrimaryKeyAction$` is that rule over one column.
  - It sends no relationship action, as the owner decided. A parent whose key columns change keeps every relationship and foreign key column its children have, still on the columns they named.
  - `identificationHook` still recomputes the identification of each relationship whose end columns change, as it did for one column.
- **A row's right press keeps a selection.** It keeps a selection it lands in. A right press is button 2 alone (`isSecondaryButtonPress` in `src/utils/domEvent.ts`); a macOS Ctrl+click is a left press.
  - Inside the selection it moves only the focus there (`$mod` on `focusColumnAction`). Anywhere else it selects the row alone.
  - It focuses the row from anywhere in it outside a cell, as from a cell: its key, between two cells, its alternate key mark, its remove button (`canvas/table/column/Column.tsx`). So the menu it opens never acts on a column focused before.
  - Off the rows a right press focuses as a left one does. So one on the table outside its rows and header cells keeps the column focus it had.

### Table Properties

- **One fixed box for all three tabs** (`table-properties/TableProperties.styles.ts`). It is 1040 by 600 at most, centred in the canvas 16px clear of its edges (an owner decision of 2026-10-11). `max-height: 100%` shortens it on a low host. So switching tabs never moves the frame.
- **The close button is the one keyboard stop.** The header holds the title, a chip per table opened lately and the close button, the one control the keyboard reaches.
  - The button hands focus back with `focusEvent` on `nextTick`; otherwise the keyboard falls to the page and the shortcuts stop.
  - It keeps a Space keydown from the editor root, whose hand tool binding cancels it and with it the button's press.
  - Escape and a press on the backdrop close the dialog.
- **Readonly reaches it through `Erd`'s prop.** The editor's `readonly` reaches it as it reaches `Toolbar`. It shows a badge after the title, no add row or remove button, names that take no typing, every box disabled and the order fixed. That is display only; the store's readonly filter stays the guard.
- **Keys and Columns heading stick to the top.** They stick to the body's top edge (`table-properties/table-properties-indexes/TablePropertiesIndexes.styles.ts`). One body scrolls the whole tab.
  - The left pane sticks inside `leftTrack`. `align-self: stretch` makes that track as tall as the columns beside it, and only as tall as its own rows once the panes stack.
  - So the keys stay beside a long list and scroll away above one, with no container query, which the browser floor lacks.
  - A key list taller than the body shows its last rows at the end of the scroll.
  - `columnsHead` reaches over the body padding as the order does.
- **Each checkbox carries a sticky-band `scroll-margin`.** The browser counts a box under a sticky band as shown. So each checkbox carries a `scroll-margin` of the stuck heading and the tallest order (`INDEX_ORDER_MAX_ROWS` rows), and Tab never stops on a box the order hides. A mouse focus scrolls nothing.
- **The Index order sticks to the bottom.** It sticks to the body's bottom edge (`order` in `TablePropertiesIndexes.styles.ts`). It sticks 12px past the body's padding edge and pads its rows back by as much. A negative margin takes that padding out of the flow. So a stuck order hides the rows under it, and one in place adds no scroll height.
  - Both it and `scrollbarArea` in `TableProperties.styles.ts` read that padding from `TABLE_PROPERTIES_BODY_PADDING` (`src/constants/layout.ts`).
  - Its rows carry the canvas's `AK<n>.<m>` marks, numbered as `getAlternateKeyMarks` numbers them.
- **Keep a row's `class` one constant value.** The drag adds `dragging` and `none-hover` by hand, and r-html strips a class it did not set whenever the bound value changes. So the read-only state is the `data-readonly` attribute instead.
- **The index column checkboxes are drawn, not native** (`table-properties/table-properties-indexes/indexes-checkbox-column/IndexesCheckboxColumn.styles.ts`).
  - They take `appearance: none`, a gray-10 ring, and an accent fill with a white check from a data URI. A picked key's columns take gray-9 at full opacity.
  - Forced colours hand them back to the system.
  - A row whose box is checked carries `data-selected`, so `Column.styles`' tint and a bar tie it to the picked row on the left.
  - The editor's other `type=checkbox`, the Schema SQL tab's Tables list, draws its boxes the same way in `src/components/schema-sql/schema-sql-options/SchemaSQLOptions.styles.ts`. It shows a dash while All is mixed and has no disabled state.
- **Its titles are an e2e contract.** `e2e/specs/table-properties-indexes.spec.ts` finds rows by `[title="Add Index"]`, `[title="Unique"]`, `[title="Alternate Key n"]`, `[title="Remove"]` and `div:has(> [title="Read Only"])`. The last is the lock, a direct child of a key row. Give a new element none of those titles, or a strict locator matches two.

### The buttons beside a draw's target

- **A draw's target gets two buttons** (`draw-target/`, owner decisions of 2026-10-06). While a relationship is drawn, the table it would end on is outlined in the preview's colour. It gets two buttons on its left in every language.
  - They flip right where the left edge has no room, and move off the minimap and the floating toolbar.
  - They are the same size on screen at any zoom.
  - Map to existing columns opens Map Columns. The + button does what a press on the table does, as a press on the table still does.
- **The buttons are DOM over the canvas** (`DrawTargetButtons.tsx`). Konva raises no hover over a table drawn by its name or under a DOM element. A scene node would hand its press to the table under it.
- **The target is reckoned, never hovered** (`findDrawTarget.ts`). The tables read from the top of the order `CanvasScene` paints them in, so of two at one z-index the later in `doc.tableIds` is the target.
  - None under a memo drawn over it is a target, since the memo takes the press. Tables and memos share one stack (The canvas and its presses).
  - The start table counts only once the pointer has travelled 24 px from the press that started the draw.
  - A column drop is reckoned the same way. `findColumnDropTarget` (`src/konva/scene/columnDropTarget.ts`) reads the tables from the top of the painted order, so of two at one z-index the later in `doc.tableIds`, the one shown, takes the column. A file whose tables all carry the default z-index relies on it.
- **A clear strip spends a main press** (`.draw-target-gutter`). It runs from the buttons to the table, so the outlined table is the only one a press beside the buttons reaches.
- **Their state is a module record.** It is never an action. It is keyed on `sceneKeyOf` (`drawTargetState.ts`), so nothing of it is saved, undone or sent to a peer.
- **The buttons answer mouse and pen alone.** Touch has no hover, so a tap on a table still ends the draw at once with new columns. That is an owner decision of 2026-10-06, taken with no real device to try a touch flow on.
  - The overlay reads no pointer while the last pointer event it heard was a finger's. A browser sends a pointer event ahead of each mouse or pen move, and never ahead of the mouse events it makes up after a tap.
  - A finger's `pointerdown` lets go of the pointer a mouse left. So a pan or a pinch after a tap brings no table under a stale point.
  - Tell a finger by its `pointerType`, never by `touchstart`, which a pen on iPadOS or Android sends too. A pen's press keeps its buttons.
- **Some states show no buttons.** Readonly, the hand tool, a takeover, Table Properties, an active view and Map Columns itself show none.
- Map Columns and `relationship.changeColumns`: `src/components/map-columns/AGENTS.md`.

### Coordinates and scrolling

- **Use the one coordinate canon.** `getSceneOrigin`, `toScreenPoint`, `toScenePoint` and `getOriginToPlace` work over `settings.originX` / `originY`. `src/konva/scene/coordinateAuthority.test.ts` fails on origin-with-zoom arithmetic outside its `AUTHORITY` files.
- **Pans are unclamped.** `scrollTo` / `streamScrollTo` write the origin as given, and `changeViewport` moves nothing. The scroll ranges (`src/engine/modules/settings/atom.actions.ts`) serve the scrollbars and the minimap alone. Their drags gate themselves via `clampScrollMovement`.
- **Only a load pulls onto content.** It applies `openingOrigin` via `pullScrollIntoRange`, deferred by `editor.scrollPullPending` until a viewport is measured. A store that loads before measurement first dispatches `changeViewportAction({ width: 0, height: 0 })` (`createReplicationStore`, `createPeerStore`, `src/components/erd-editor/ErdEditor.tsx`, `src/components/erd-view/ErdView.tsx`). Otherwise the load pulls against the default viewport for good.
- **One pinch hook serves every store scene.** `src/hooks/usePinchZoom.ts` is the pinch of `Erd`, `DiffErdViewer`, `ErdView` and Flow (via `useViewGestures`). Graph mode drives `createPinch` (`src/utils/pinch.ts`) on its own view.
  - A trackpad pinch is a ctrl wheel (`isPinchWheel`): every one on Apple, one short of a notch elsewhere, so a `$mod` notch keeps its step.
  - A touch pinch is two fingers, and Safari sends gesture events.
  - Each holds its centre through `pinchZoomAction$`, streamed so one pinch is one undo entry.
  - The roots carry `touch-action: none`; otherwise the page zooms instead. `ErdView`'s carries it only while it holds the focus (`:focus-within`), so before that a finger over bare canvas scrolls the page, and so does one on its map (`minimap/Minimap.tsx`, `minimap/useMinimapScroll.ts`, through `sceneActiveContext`).
  - `interactive` (an `Erd` prop, an option of `usePinchZoom` and `createPinch`) is true unless given. While it is false, no wheel, pinch wheel, gesture or two-finger press is prevented or spent, so the page keeps each. `ErdView` hands its pinch and its own wheel the focus inside its root, so its plain and mod wheels follow the ERD tab's once it holds the focus. Its palette lies inside that root, so while it is open the view prevents no plain or mod wheel, which the palette's list scrolls by, and holds a pinch off the page but zooms by none (`enabled`), as the ERD tab does under an overlay.
  - `getZoomTransform` hands back the store's own object, so snapshot what a gesture holds.
- **Drags freeze their geometry.** Entity drags (`canvas/entityDrag.ts`), scrollbar drags (`virtual-scroll/useVirtualScroll.ts`) and the minimap drag (`minimap/useMinimapScroll.ts`) freeze the content rect and origin via `src/konva/scene/viewFreeze.ts`.
  - They thaw in the finalizer and on unmount.
  - Unfrozen, a drag resizes its own thumb or map.
  - An entity drag in the document also holds each table group's box as it began (Table groups in the scene, below).
- **Key a module-level per-scene record on `sceneKeyOf(root, source)`.** The key is `${editor.id}:${source}` (`src/konva/scene/viewFreeze.ts`). The freeze, `canvas/entityDrag.ts`, `canvas/columnDragPointer.ts` and the draw target's `draw-target/drawTargetState.ts` key on it. Keyed on the source alone, the diff viewer's two stores, or two elements on a page, share a slot. Only a `WeakMap` over entities (`src/utils/draw-relationship/calc.ts`, the sort channels) may key on the source alone.
- **Legacy view fields stay out of `settings`.** `erd-editor-schema` owns their rules, in its `AGENTS.md`. `settings` holds no `width`, `height`, `scrollLeft` or `scrollTop`. `erd-editor-schema`'s parser reads them off a file that has no origin and migrates them into it once.
  - `sortTableAction` wraps its rows at `canvasSizeInRange(doc.tableIds.length * 100)` (`src/utils/validation.ts`), the canvas size the importers once wrote (owner decisions of 2026-10-10).
  - The importer `omit` list (`IMPORT_OMIT_SETTINGS` in `src/engine/modules/editor/generator.actions.ts`) names the view.

### The jump rule

- **Every go-to goes through `showErdTargetAction$`** (`goToErdTarget.ts`): the palette's `#`, `@` and `:` rows, Go to ERD, the diff tree, Find and Replace and Import and Add's landing (`scrollIntoView`). `goToErdTarget` brings the ERD tab up in a dispatch of its own first, since a batch is classified by the state before it. No corner parking is left.
- **Each axis is judged on its own, and the one that is fine stays** (an owner decision of 2026-10-13, `planJump`). On an axis of length L, a rect of length len:
  - len up to L/2 stays while its middle is in the middle half, from L/4 to 3L/4, and otherwise goes to the middle.
  - len up to L less both 40 px margins (`EDGE_MARGIN`) stays while it shows whole, and otherwise starts 40 px down the screen and stands in the middle across.
  - Longer, it stays while it shows whole, or while its focus does when it is longer than L, and otherwise `placeOnAxis` stands its focus a margin inside.
- **A jump pressed again moves nothing.** No scroll is sent where both starts come within half a pixel of where the rect stands, which a focus longer than the screen needs; the reducer stores the origin rounded, so an exact comparison would scroll again.
- **The focus is what has to show of a rect too big.** A table goes by the header cell a jump rings (its name, or the comment asked for), a column row by its ringed cell (`getColumnFocusRect`), a cell too wide by the range found in it, a memo by itself. A relationship goes by the box of its two tables, focused on the child table, and selects the child alone with its foreign key columns in the child's order, the first ringed, since there is no relationship selection (the owner's request of 2026-10-14). A table group goes by its box, focused on its title bar, and is selected alone; while groups are hidden it goes nowhere.
- **The zoom never changes**, and a jump is one scroll, one undo entry.
- **A jump lights a relationship through `relationshipHighlight.ts`**, kept per `editor.id` out of the store, so no file, history or peer holds it. The connector and its referential action label read it as they read a hover, in the document scene alone, never in a view. The generator never sets it; the host that jumps does. A press that changes the selection puts it out (`Erd.tsx`, `DiffErdViewer.tsx`); a pan, by the middle button or the hand tool, leaves it on. The element drops it as it goes.
- **The read-only view and a readonly ERD tab light by one press rule** (`canvas/readPress.ts`, through `relationshipHighlight.ts`). The pointer resting on a table lights the table's relationships while it is there (`listenSceneHover`). A press that stays within `CLICK_DRAG_MIN_MOVE`, a finger's only once lifted, takes the selection a palette jump left and keeps lit what it landed on, a table's relationships or a relationship, and one anywhere else puts the light out. A drag changes neither: a main press pans, and so does a finger once the view holds the focus, while a finger before the focus is the page's and pans nothing, and one the browser cancels for a scroll lights and focuses nothing however little it moved. A readonly ERD tab's root holds every touch (`touch-action: none`), so there a finger pans before the focus too (`pansBeforeFocus`), as it does in an editor. A still press also gives the view the focus, with `focus({ preventScroll: true })`, which a touch Konva prevented over a shape would never give. A document loaded in place of the one lit (`editor.initialLoadJson`) puts out both lights. `ErdView` drops its light and stops its transitions (`stopTransitions`) as it goes.
- **A jump with a draw armed adds nothing.** Its selection, `selectTableAloneAction$`, leaves out `selectTableAction$`'s relationship-draw branch, and so does every go-to's.
- **`toErdTarget` fills `ErdTarget.range` from a match** (`erdTarget.ts`). The range is measured with the store's `toWidth` from the cell's left edge, where the scene starts its text, less the padding that measure adds, and cut at the cell's right edge. A range in a cell the view does not draw is dropped, and the cell drawn in its place is ringed: the name for a hidden comment, the logical name for a name in the logical view (Name views).

### Table groups in the scene

- The export worker's scene, which draws `TableGroups` first too, and its language: `src/services/AGENTS.md`.
- **Table groups draw first in the scene layer** (`canvas/table-group/TableGroups.tsx`). They stand behind the connectors, by zIndex among themselves. They draw from the document source alone (`getVisibleIds` gives a view none) and are never culled. The export scene draws them first too, and the minimap draws its own.
- **`TableGroups` reads the list and members itself.** It reads the list and every group's members (`createTableGroupMemberLists`). So a scene render re-renders no group.
  - `createTableGroupMemberLists` hands a group the list it had while no member came or went.
  - A group with no members gets one shared list, left unfrozen. r-html tracks no read of a frozen value, so a frozen one would keep a group from redrawing over its first member.
- **Groups draw in two passes: bodies, then frames.** Every body (`TableGroupBody.tsx`, its own node `table-group-body-<id>`) draws before every frame. A frame (`canvas/table-group/TableGroup.tsx`) is the bar, the line, the peer ring and the sashes.
  - So no group's body stands over another's bar, as a large group drawn over a smaller one it holds would.
  - The two share the sash draft, the double-click guard and the hover (`createTableGroupLinks`).
- **The box is `getDrawnTableGroupRect`** (`tableGroupBox.ts`). It is `getTableGroupRect`'s while no drag holds the scene.
  - Its top `TABLE_GROUP_TITLE_HEIGHT` is the title bar, holding lucide's `group` icon, the name and the remove button. The padding above a member clears the name.
  - The icon has the table header icon's size and gap (`getTableGroupIconBox`, `canvas/table-group/titleLayout.ts`). Its holder does not listen, so a press on it is the bar's.
  - Under the bar, the body takes the group color at `TABLE_GROUP_FILL_OPACITY`.
  - One line frames both, `memoSelect` while selected, as a memo's does.
- **An uncolored group takes the theme's tokens.** That is a group with no color `toOpaqueHex` reads.
  - Its bar is `tableGroupHeaderBackground`: gray-7, gray-8 in light. That is two steps off a table header, so it reads as neither.
  - Its body is `tableGroupBackground`: grayA-4 at full opacity, the alpha its own.
  - Its line is `tableGroupBorder`, the bar's step, as a colored group's line is its color.
  - The icon and a name take `active`, and an unnamed one shows `common.unnamed`.
  - `src/themes/radix-ui-theme.test.ts` holds bar, body and canvas apart (CIE76 above 5) and the name at 7:1 in every theme.
- **Every box redraws when table widths may change.** It asks through `trackTableWidths`, the observable twin of the width generation `invalidateTableWidths` bumps. A member widened by a column edit or a remeasure changes no field the size cache keys on.
- **Title bar and body are separate nodes.** They are the parts a press is told apart by (Table group pointer, below).
- **A drag holds the box it began with** (`getHeldTableGroupBoxes`, which `beginEntityDrag` takes with the flag). While a drag runs and leaves the group standing, the box is the one it showed as the drag began. It is united with the members the drag leaves standing.
  - So it neither shrinks under a member lifted out nor stretches after one carried off, on the canvas and the minimap alike.
  - A group dragged itself keeps every member.
- **A member's header band takes its group's color** (`getTableHeaderTint`).
  - The scene names each table's group off one read of the list (`tableGroupId`, for `getTableGroupTint`). So a group coming or going re-renders no other table.
  - Its name, comment, placeholders, header icons and the cell editor over them turn white, unless black's WCAG 2 contrast ratio beats white's by more than 4 (`src/utils/contrastText.ts`, an owner decision of 2026-10-11). So white goes down to 3:1, under the 4.5:1 WCAG AA asks of body text, and black never under 7:1. A name a dictionary check marks keeps the mark's colour over the tint while it reads there at 4.5:1 (Name views).
  - The table's own color stays on the left edge.
  - A view, the zoomed-out table and a drawn copy wear no tint. A drawn copy is `preview`, the Alt drag's ghost, whose duplicate lands in no group.
- **`Show.hideTableGroup` takes groups away everywhere.** It hides the boxes, the tints and their room in the content bounds. It is masked out of the table size key and the sort hook (`isPaintOnlyToggle`), so the View Option toggle measures nothing.
- **`Show.hideMemo` takes memos away everywhere** (View Option's Memos, an owner request of 2026-10-11). `isMemoShown` (`src/utils/memo.ts`) reads it.
  - `getVisibleIds` gives the document no memo while it is set. So the canvas, a drag and the marquee meet none, and `findDrawTarget` lets a table under one take the draw.
  - The minimap and the image export draw none. The content bounds leave them no room, so neither do the scroll ranges, a fit or the export box.
  - Select all takes none. A paste, a duplicate or an Import and Add adds its memos unselected, as hidden memos never stay selected. An append still lands below them, as below hidden groups, since they still stand there.
  - Find and Replace and the palette's `:` walk no memo (`walkFields`), and a show change runs the search again (`FindTextActionTypes`).
  - Nothing makes a memo while it is set: the canvas menu, the palette, the floating toolbar and the welcome screen offer no New Memo, and its chord adds none. An agent's `erd_add_memo` still adds one, hidden.
  - It is a paint-only toggle beside the other two hide bits, so it measures nothing either.
- **Hiding memos drops their selection and editor.** `settings.changeShow` setting `Show.hideMemo`, here, by an undo or by a peer, lets go of every selected memo and closes the memo editor. So does a load (`loadJson`, `initialLoadJson`) that lands the bit, and a load landing `Show.hideTableGroup` lets go of the groups alike (`releaseHidden`, `src/engine/modules/editor/utils/releaseHidden.ts`).
  - A memo sash drag ends at the step that finds the memo hidden or removed, writing nothing more (`MemoSash.tsx`).
  - A go-to on a memo (`showErdTargetAction$`) goes nowhere while memos are hidden, so a palette or Find and Replace row found before selects nothing a Delete could then take.
- **The minimap fills group boxes behind marks.** It uses the group's color, or, for a group with no color `toOpaqueHex` reads, the bar's `tableGroupHeaderBackground`. It fills at 0.4 alpha (`FILL_OPACITY` in `minimap/table-group/TableGroup.tsx`), above the body's `TABLE_GROUP_FILL_OPACITY`, since a box a few pixels across shows its color there or not at all. Each table mark takes `table.ui.color` (an owner decision), never its group's.

### Table group pointer

- **`sceneHit` tells the parts of a group apart.** It answers `{ kind: 'tableGroup', part }`, the part `title`, `body` or `sash`, read off the kind its node carries.
  - The bar's and the body's fills are their hit areas. The name, line and ring listen to nothing.
  - A table, memo or connector over a group answers for itself.
- **The title bar selects and carries the group.** A press selects (`selectTableGroupAction$`): the modifier adds, and a press inside the selection keeps it. It also raises the group's tables over every other table and memo (`src/engine/AGENTS.md`), so a drop leaves them where the drag drew them.
  - Past `CLICK_DRAG_MIN_MOVE` it carries the group through `useMoveEntity` (`TITLE_KINDS` as its `clickKinds`). `moveAllAction$` moves it and its members once.
  - It is never Alt duplicated.
  - A readonly editor's ERD tab reads `'read'`, so its press neither selects nor carries the group; a readonly store under `'edit'`, as a diff pane's is, makes it a selection alone (`canMove`).
- **The bar's `x` removes the group** (`table-group-remove`, an owner decision of 2026-10-11). It stands `TABLE_GROUP_TITLE_PADDING` short of the bar's end at a table header's button size (`getTableGroupRemoveBox`, `canvas/table-group/titleLayout.ts`), and the name ends a header icon gap before it.
  - It shows while the pointer is over the frame or the body, as a table's buttons show over its card. The frame and the body are two nodes, so each writes its own hover into the links and the button reads either.
  - A main click runs `removeTableGroupAction$` on that group alone and keeps its tables, as the menu's Delete does, in one undo entry.
  - It is `kind="icon"`, which `useMoveEntity`'s `blockedKinds` names, so a press on it selects the group and carries nothing.
  - A scene under `'read'` draws no `x`, and one that turns read under the pointer hands back the cursor the `x` took, since konva sends a node it takes away no leave. A readonly store under `'edit'` keeps it listening, painting nothing, asking for no cursor and removing nothing on a click, so konva still sends it the leave that hands back a cursor it took before readonly turned on.
- **The body is canvas to the main button.** `ownsPress` (`hitTest.ts`) gives a group its bar and sashes, and its body only for another button. `handleDragSelect` in `Erd.tsx` and `DiffErdViewer.tsx` read it.
  - So a main press on the body pans, takes a marquee under the modifier, and unselects.
  - A right press selects the group, kept if the selection holds it, for the group menu it raises (Table group commands, below).
  - A menu a main press raises selects the group as it opens (`Erd.tsx`'s `handleContextmenu`), since that press unselected. A Mac Ctrl+click and a long touch raise such a menu. A readonly editor raises none and selects nothing for it.
- **A group's drag lowers every group.** Every group goes into the bottom layer, by zIndex as they stood, under the static scene. Its members go in the drag layer (`canvas/CanvasScene.tsx`'s `dragIds` take a selected group's members). A drag of tables alone leaves the groups where they stand.
- **`TableGroupSash.tsx` resizes any group.** It stands on every group's four edges and four corners, selected or not, as a memo's sashes do (an owner decision of 2026-10-11), for the main button, and not under a readonly store. A press on one leaves the selection as it was.
  - Its drag draws a draft box in the group's body and frame. It writes one `tableGroup.resize` with `dispatchSync` as it ends.
  - The edge stops at the members' padded box (`getTablesGroupRect`) and at `TABLE_GROUP_MIN_WIDTH` / `TABLE_GROUP_MIN_HEIGHT`.
  - So peers hear one write, and one undo puts back the rect it began from.
  - A drag whose sash unmounts mid way, its groups hidden, its group removed or the editor turned readonly, ends writing nothing, as no reader saw where it would land.
- **A document drag ends by judging group drops.** A drag that travelled `CLICK_DRAG_MIN_MOVE` from its press dispatches `dropTablesIntoGroupsAction$` with the boxes it held (`useMoveEntity`'s finalizer). A click, or a tremor short of that, sends nothing (`markEntityDragTravelled`).
  - `getTableGroupDrops` judges each selected table no selected group carries. It puts the table in the topmost box that holds its centre without them, or in none.
  - The boxes judged include the box a group the drag leaves standing showed as it began. So a member grown past the stored rect stays through a nudge, and leaves once its centre is out of the box the reader saw.
  - It judges nothing while groups are hidden.
  - The moves and the membership undo as one entry while the release comes inside the 200 ms quiet period that closes the drag's `@@move` group.
  - A pointer resting longer before the release leaves the membership an entry of its own, as a paused drag already splits its moves.
- **`TableGroupDropTarget.tsx` outlines where a drop lands.** It outlines each group a drop would land a table in. It draws the box the table is judged in, in `theme.focus`, in the drag layer. It draws nothing short of the click distance and nothing under a readonly store.

### Table group commands

- The color picker and Remove color, which the group, table and memo menus share: `src/components/primitives/AGENTS.md`.
- **A right press raises the group menu** (`table-group/`, `erd-context-menu/ErdContextMenu.tsx`, `src/components/quick-search/actions.tsx`). It works on the bar, the body or a sash.
  - Its rows are Select tables (`selectTableGroupTablesAction$`, its member tables alone), Rename, Color, Remove color while the selection holds a color, and Delete.
  - Delete removes that group alone and keeps its tables (`removeTableGroupAction$`). It reads Delete selected while the group is one of two or more selected, as the memo's does.
  - A readonly editor raises no group menu, as it raises none for a relationship or a memo (`Erd.tsx`'s `handleContextmenu`), and the menu itself lists a readonly store no row, Select tables among them, since a reader selects by a jump alone (A readonly editor's context menu, under The canvas and its presses).
- **The table menu adds two group rows.** They stand above its Delete. Group selected tables (`addTableGroupFromTablesAction$`) shows while the selection holds a table the document lists, with its chord. Remove from group (`setTableGroupAction$(ids, '')`) shows while a selected table is in a group.
- **The canvas menu, the palette and the floating toolbar create groups.** The canvas menu adds New Table Group after New Memo. The palette adds New Table Group and Group Selected Tables (with a table selected), on the ERD tab alone, each keeping its English as an alias. The floating toolbar adds New Table Group after New Table and New Memo, marked while the draw is armed.
- **Two chords create groups** (`useErdShortcut.ts`). `addTableGroup` (`Alt+G`) arms the draw, and a second press disarms it, as the toolbar button does and a notation's chord and button do. `groupSelectedTables` (`T` then `G`, a sequence) runs Group selected tables. The menu and palette rows and the Shortcuts page show both.
- **No creation under readonly or hidden groups.** None of these rows or buttons shows under a readonly store, and none, nor either chord, creates a group while groups are hidden.
- **The draw mode is unrecorded editor state.** It is `editor.drawTableGroup`, written by `editor.changeDrawTableGroup`, which no action list holds. So it is never saved, sent or undone, as the hand tool's state is not.
- **New Table Group arms the draw mode.** Arming puts the hand down and ends a relationship draw, and either of those ends the mode in turn. It takes the stage off the pointer as the hand tool does (`grabMove`). So `handleDragSelect` in `Erd.tsx` hears every press under a crosshair.
- **A main press draws** (`table-group/useTableGroupDraw.ts`).
  - The box the travel spans shows in the erd root's pixels (`table-group/TableGroupDraft.tsx`), never under `TABLE_GROUP_MIN_WIDTH` / `TABLE_GROUP_MIN_HEIGHT` at the zoom.
  - The release adds `addTableGroupAction$` over it in scene units, rounded, taking in the ungrouped tables whose centre it holds, and ends the mode.
  - A release within `CLICK_DRAG_MIN_MOVE` adds `TABLE_GROUP_DEFAULT_WIDTH` by `TABLE_GROUP_DEFAULT_HEIGHT` with its corner at the press.
  - A readonly store never draws.
- **Other presses while armed.** The middle button still pans. Any other press ends the mode, and the contextmenu it raises opens no menu. Neither does one a Mac Ctrl+click raises while armed.
- **Escape ends the mode alone** (Escape, under Keys on the canvas). So do these:
  - The floating toolbar's Select, which marks neither tool while the mode is armed.
  - A tab switch (`settings.changeCanvasType` off the ERD tab).
  - Groups being hidden, and the element turning readonly; a drag then running adds nothing.
- **Hiding groups drops their selection and editor.** It lets go of every selected group and closes a name editor. Hiding is `settings.changeShow` setting `Show.hideTableGroup`, here, by an undo or by a peer. `openTableGroupNameEditor` opens none while groups are hidden, since no reader could see or end either.
- **A group's name editor is `TableGroupNameEditor`** (`canvas/EditOverlay.tsx`). It is open while `editor.editTableGroupId` names a group the document lists and groups are shown. `isEditingText` reads it, so the canvas shortcuts stand down as for a cell.
- **`openTableGroupNameEditor` opens it** (`canvas/table-group/tableGroupNameEditor.ts`), letting the table focus go. It never opens under a readonly store. It opens:
  - For a main double click on the title bar whose first press was there too (`createDoubleClickGuard`).
  - For Rename.
  - On the group a draw or Group selected tables just added (`addTableGroupAndRename`, the id the batch added to `doc.tableGroupIds`).
- **The editor stands over the hidden name.** The bar's name hides while it is open.
  - It runs from `TABLE_GROUP_NAME_X` (past the icon) to a header icon gap short of the remove button, the box the bar's name takes.
  - It takes the bar's font and weight, in the box konva centres the name in. That box is `getTableGroupNameBox` (`canvas/table-group/titleLayout.ts`), a cell's text height on a whole pixel. So the baselines meet.
  - `common.unnamed` is its placeholder.
  - A colored bar's text color goes to `--cell-text-color` on its cell, which its input reads before `--active`. A tinted header's goes there too, and `EditOverlay.styles.ts`'s `tinted` hands it to the cell's input alone as `--active` and `--placeholder`, so the term list a header's logical name opens keeps the theme's text on its own background.
- **The name editor writes once.** Enter or a blur commits a changed name as one `tableGroup.changeName`, one undo entry. A name left as it was writes nothing. Escape raises a flag before the stop branch's focus change blurs the input, so that press closes it writing nothing.
- **The name is set once, not bound.** It goes in as the editor opens, not as a binding. So a peer's rename leaves what is being typed.

### The canvas and its presses

- Why `renderCanvasScene` (`canvas/CanvasScene.tsx`) and `renderMinimapScene` (`minimap/MinimapScene.tsx`) export in lower case, the `konva/lib/*` imports and `ParticleLayer.tsx`: `src/konva/AGENTS.md`.
- **Route presses through `hitTest.ts`.** The canvas is one `<canvas>` under a closed shadow root, which r-html's `queryShadowSelector` / `closestElement` cross. `hitTest.ts` records what konva resolved at dispatch, since the press re-renders the scene before `Erd.tsx` asks.
- **Take hit boxes from hit functions** (`canvas/sceneHit.ts`), not invisible shapes.
- **Tables and memos paint in one stack.** `stackTablesAndMemos` (`src/konva/scene/stacking.ts`) orders them by the one z-index `nextZIndex` counts for both, a memo over a table at a tie. The scene and drag layers of `canvas/CanvasScene.tsx`, the Alt drag's ghost, the minimap, the export scene and `findDrawTarget` read it, so what a press raised stays on top wherever it is drawn. A paste or duplicate breaks a tie the same way (`resolvePlacement`), and a file reopened stacks its memos over its tables (`erd-editor-schema`'s parser). Drawing every memo after every table put a memo over a table raised past it (an owner report of 2026-10-11).
  - Each table keeps its own `cache` of its two spellings, the zoom choosing one, and a memo stays out of any cache. So a zoom across the high level threshold takes no memo from under the pointer.
- **A node that leaves under the pointer hands its cursor back.** Konva sends no leave to a node unmounted from under the pointer: one removed, hidden or swapped out. So a component that asks the stage for a cursor through `createSceneCursorScope` (`canvas/sceneTokens.ts`) writes the inherited one back on unmount, unless its last request already was. The memo, its sashes, the group sashes, the group's `x` and the column drag handle do. The handle also gives its hover back when the focus leaves its row, which takes it away with no unmount, and fires the leave konva drops on the row and the table it stands outside. The table's header buttons and colour edge, the zoomed-out table's colour edge and a column's remove button do not yet.
- **Add each canvas overlay to `canDrag`.** That is the `closest()` list in `Erd.tsx` (`.content-compass`, `.floating-toolbar`, `.draw-target`, …); `DiffErdViewer.tsx` has its own. Otherwise a press on the overlay starts a pan. `ErdView` pans only for a press inside its stage container, so its controls, map, scrollbars and palette need no list, and neither does a readonly ERD tab, which pans by the same rule.
- **Add takeover overlays to `TAKEOVER_CHROME` too.** An overlay a takeover lays over its scene joins it in `Erd.tsx`, or a middle press on it is prevented.
- **A scene under `'read'` takes no entity press** (`src/components/sceneInteractionContext.ts`). `useMoveEntity` returns before it selects, so a table, memo or group pressed there is neither selected nor carried nor duplicated, and the scene root's own handler takes the press; a drag begun before its scene turned read ends at its next step, and so does a marquee, which selects nothing more and puts its rect away (`canvas/drag-select/DragSelect.tsx`). The read-only view and a readonly editor's ERD tab read; the takeovers inside the ERD tab provide `'edit'` again, so a diff pane's press still selects in a readonly editor (`canMove`, Table group pointer), and the Flow keeps `'edit'`.
  - Its cells take none either. A header or column cell focuses and edits nothing for any button (`canvas/table/Table.tsx`, and `canvas/table/column/Column.tsx` through the `read` its table hands its rows), a memo's body opens no editor and leaves the wheel to the page until the root holds the focus (`sceneActiveContext`), then scrolls under it as in the editor, and a group's body selects for no button.
  - It draws no button that edits, the table's add and remove, a column's remove, a memo's remove and a group's `x`, and no memo sash, and its colour edges and a memo's colour bar listen to nothing. Its store is readonly as well, which keeps a group's sash, its name editor and a column's drag handle off.
- **A readonly ERD tab is a read scene** (`Erd.tsx`). Its canvas gets no `overlay` and no `grabMove`, keeping its layers, which draw nothing with no edit state. Its root hands every press to `createViewPress`, except under a takeover or Table Properties (`getShowOverLayout`), so no marquee, selection or carry starts there. It passes the editor root, which a still press focuses, and `pansBeforeFocus`, since the tab's root holds every touch, so a finger pans at once as in an editor. The press still pinches, closes the colour picker and holds a takeover's middle press with its lift, and no colour picker opens while readonly. `listenSceneHover` stands only while readonly, both following the prop, and a turn either way and an `editor.initialLoadJson` put out the lights. Its selection is what a jump leaves, which a still press takes and the select all chord adds nothing to.
- **A readonly editor's floating toolbar keeps the reader's view controls alone** (`floating-toolbar/FloatingToolbar.tsx`): the zoom out, readout and zoom in, the Name View list, zen mode and the compass. It draws no Hand or Select, no New Table, New Memo or New Table Group and no notation, rather than drawing them disabled. It reads `store.getReadonly()` as it renders, so a turn of the element's readonly either way draws the other set on the bar it mounted, and a writable editor's bar keeps every control.
- **A readonly editor's context menu keeps the rows that change nothing in the document** (`erd-context-menu/ErdContextMenu.tsx`): the canvas menu's View Option, Name View, Export and Diff Viewer, and the table menu's Table Properties, which opens read only. The canvas menu shows no New Table, New Memo, New Table Group, Toggle Explorer, Relationship, Derive, Database, Import, Import and Add or Auto Layout, and the table menu no key, Focus on this table, colour, group row, Derive or Delete, rather than drawing them disabled. A memo, relationship or group menu keeps no row. `READING_MENU_TYPES`, beside the menu, names the two menus that keep rows, and the menu's rows and `Erd.tsx` read it, so the tab raises no other menu for a readonly press and takes one already open away as it turns readonly. The menu reads `store.getReadonly()` as it renders, so a turn either way redraws an open canvas or table menu's rows, and a writable editor's menus keep every row.
- **The element ends the edit state as it turns readonly** (`src/components/erd-editor/useErdEditorAttachElement.ts`, and once as it mounts readonly). One batch ends the cell, memo and group name editors, a relationship draw, the selection and the focus, puts the hand tool down and closes Map Columns, the placement preview and Time Travel, whose Apply steps the history past the store's readonly guard, each a close the readonly filter passes; it closes the colour picker through the emitter, and `Erd.tsx` ends a table group draw itself. Table Properties, now read only, the diff viewer and the image export stay open, and the stage is never built again. Turned writable, the element sends `restoreScreenSettingsAction$` in one batch, and the scroll, the zoom, the tab and the name view stay where the reader left them (`src/engine/AGENTS.md`, Screen-only settings), with no edit state to come back to.
- **A header or column row press lifts past `CLICK_DRAG_MIN_MOVE` only.** It lifts the table only once the press travels that far (`clickKinds`, `canvas/useMoveEntity.ts`; `CLICK_KINDS` in `canvas/table/useMoveTable.ts`). The drag layer is off the hit canvas, so lifting at once would keep a double click from opening the cell editor.

### The column drag handle

- **A column row is the table's own body** (owner decisions of 2026-10-22). Its press focuses and selects as it did, and once it travels it carries the selected tables as the header does, Alt duplicating them; only `column-drag-handle`, the colour edge and the icons are `BLOCKED_KINDS` (`canvas/table/useMoveTable.ts`). A column moves by its handle alone.
- **The handle stands beside the focused row alone** (`dragHandle`, `canvas/table/column/Column.tsx`). `Table.tsx` gives it to the row the focus stands on, whichever cell (`hasFocusColumn`), in the document, unlocked and never in a copy; a hover shows no handle (an owner decision). It is drawn `COLUMN_DRAG_HANDLE_GAP` outside the table's left edge on the row's middle, at `COLUMN_DRAG_HANDLE_REST_OPACITY` until the pointer is on it, which shows it whole in the `columnHandleHover*` tokens and asks for `grab`.
  - It is a node of the row, so it follows the zoom. At 70% and under the zoomed-out table draws no rows and so no handle. It may stand over a table beside it (an owner decision).
  - Its hit box runs from a little left of the button back to the table's edge (`columnDragHandleHit`, `canvas/sceneHit.ts`).
- **The handle's press is the column drag.** A main press or one finger arms it, and the first move reports it to the table (`handleDragstart`, `onDragstart`), which holds `grabbing` until the drop. Alt duplicates nothing there. The drag carries the selection while the focused column is one of two or more selected, as a press carries selected tables, with no modifier (`getFocusedColumnIds` in `dragstartColumnAction$`).
- **The handle's lane counts as the rows.** `findColumnDropTarget` judges a point up to `COLUMN_DRAG_HANDLE_LANE` left of a card as over its rows, after the cards themselves, so a drag straight down along the handle reorders. The ghost hangs right of the pointer, across from the handle it was taken by (`canvas/column-drag-ghost/`).

### Mouse buttons

- **Middle button pans; main button carries.** Only the main button carries a table, memo or Graph mode dot (an owner decision of 2026-10-04; the dot of 2026-10-05).
- **The middle button pans from anywhere** (`listenMiddleButtonPan`, `canvas/middleButtonPan.ts`). `canvas/Canvas.tsx` binds it on the stage container in the capture phase.
  - It prevents and stops the press before konva or the scene root hears it.
  - It prevents the lift wherever it lands (`preventMiddleLift`, `src/utils/domEvent.ts`). An unprevented lift is where Chromium on Linux pastes the selection, into a cell editor the prevented press left focused.
  - It stops that lift over the scene, so no table, memo, sash, cell, icon or connector selects, drags or clicks for it, and the selection stays. Konva makes a click of any button's press and lift, and opens its double click window on any lift.
  - It hands the press to `drag$` with `forwardMoveStartEvent`, since the window never hears it and the first step would jump. It ends the pan itself on the lift it stops.
  - It pans through `sceneStreamScrollToAction`. It holds the grabbing cursor (`holdStageCursor`, `src/utils/stageCursor.ts`, the hold `holdSceneCursor` and Graph mode share).
  - It closes the context menu of the root it stands in and, in the document scene, the colour picker.
  - The edit overlay, the scrollbars, the minimap and the toolbars sit beside that container and keep their own presses.
- **Outside menus hear the forwarded press.** The theme builder and the locale picker (`handlePress` in `src/components/erd-editor/ErdEditor.tsx`) close on a press that bubbles up to them. So does the Flow's Row display menu (`src/components/visualization/visualization-toolbar/VisualizationToolbar.tsx`). They hear a middle press as the forward (`middlePanPress$`), as they hear a main press there. The forward lives in `src/utils/globalEventObservable.ts`, since `canvas/sceneOwnership.test.ts` lists every reference into the canvas root from outside it.
- **Under the hand tool every button pans.** The controller takes no pointer and the root pans for any button; a middle press follows the same rule (`handleDragSelect` in `Erd.tsx`). A readonly editor never holds it: the element puts it down as it turns readonly, the chord (`useErdShortcut.ts`) does not take it up there, and the floating toolbar draws no Hand there, so the press rule stands, the main button panning by `canvas/readPress.ts`, the middle one by `listenMiddleButtonPan`, and the right one panning nothing.
  - It keeps the selection and draws no marquee, whatever modifier is held.
  - It is prevented with its lift (`preventMiddleLift`).
  - So the middle button reads alike in every mode (an owner decision of 2026-10-04).
- **A takeover's middle press reads the same.** A middle press over a takeover's scene reads the same way (an owner decision of 2026-10-04). The takeovers are the diff viewer, time travel and the automatic placement preview (`isTakenOver`, `src/utils/takeover.ts`).
  - The press leaves the document's selection under it and is prevented with its lift. That is `handleDragSelect` in `Erd.tsx`, which every takeover stands in.
  - Time travel and the preview pan for no button.
  - A diff pane, whose pan the press still drives, keeps its own selection for it too (`diff-viewer/diff-erd-viewer/DiffErdViewer.tsx`).
- **Takeover chrome keeps its own presses.** The chrome over a takeover's scene keeps them as this canvas's does (`TAKEOVER_CHROME` in `Erd.tsx`). That chrome is the diff tree (`.diff-viewer-tree`), the time travel slider (`.time-travel-slider`), and a pane's compass, minimap and scrollbars.
  - A middle press there goes unprevented and takes the selection off as a main press does. So the diff tree, which scrolls, keeps the browser's middle autoscroll.
  - A main press anywhere over a takeover takes the document's selection off.
  - Neither takes it off in a readonly editor, whose press over a takeover leaves the selection as it was; its middle press over the takeover's scene is still prevented with its lift.
- **Graph mode reads the button through `captureGraphPan`.** `GraphNode` and `VisualizationScene` call it, and it prevents a middle press and its lift the same way.
  - A dot is pinned and moved for the main button alone (`isMainButtonPress` in `GraphNode`). So a right press and its drag on a dot do nothing.
  - The background still pans for any button.
- **A middle press focuses the root itself.** Each middle-button handler above prevents the default that focuses the editor root on any other press. So `handlePress` in `ErdEditor.tsx` focuses the root through `checkAndFocus`, hearing the canvas's press as the forward. `checkAndFocus` leaves a caret already inside the element where it is.
- **Only the main button moves entities.** Only it carries a table or memo (`isMainButtonPress` in `useMoveEntity`).
  - A right press keeps a selection it lands in, and otherwise selects what it lands on alone, whatever modifier is held. So the context menu acts on what it shows.
  - A right press moves nothing, and a memo's edge does not resize for it (`canvas/memo/memo-sash/MemoSash.tsx`).
- **Only the main button clicks a scene button.** That covers the header +/x, a remove icon, a colour edge, and the Flow's Related and Go to ERD (an owner decision of 2026-10-04).
  - It also covers opening a memo's body editor, where a right click opens the context menu alone (an owner decision of 2026-10-05).
  - Konva makes a click of any button's press and lift. So `sceneIcon`, every colour edge (`Table`, `HighLevelTable`, `Memo`) and the memo body (`Memo`) wrap their click in `mainButtonClick` (`canvas/sceneTokens.ts`).
- **A Mac Ctrl+click is a main press.** It is button 0 with control held, a main press to both helpers (an owner decision of 2026-10-04).
  - Each helper asks for button 0 alone, so every other button, the right one included, is no main press.
  - On a Mac, a Ctrl+click on a memo's body opens its editor beside the context menu Chromium raises for that click.

### Keys on the canvas

- Find and Replace and its chord: `src/components/explorer/AGENTS.md`. The palette and its prefixes: `src/components/quick-search/AGENTS.md`.
- **`YIELDS_TO_A_CARET` stands bindings down in fields.** It lives in `src/hooks/useKeyBindingMap.ts`. It stands `selectAllTable`, `handTool`, `removeSelection` and `groupSelectedTables` down in a text field, per binding. That is because `Enter` / `Escape` still have to reach `handleShortcut` from the cell editor.
  - `groupSelectedTables` is two bare letters, so a word typed in any field, the Explorer's find included, would run it there (`outgoing`). The cell, memo and group name editors stand it down through `isEditingText` too.
  - A panel that stops the map's chords (the Explorer, the diff tree, the color and locale pickers, a script editor) stops its G. `matchesShortcut` reads a sequence by its last press, the one that would complete it at the root, so T then G on a tree row groups nothing.
  - `findReplace` stays out of it: in a field, `$mod+F` means only the page's find, which the editor's replaces.
  - `search` stays out of it too: the palette's `$mod+K` opens from any text field but the cell editor's, the Explorer's find field and the database name included, as a command palette does (an owner decision of 2026-10-11).
  - `YIELDS_TO_A_TAKEOVER` beside it, which leaves `findReplace` to the host's find under a takeover: `src/components/explorer/AGENTS.md`, The search.
- **A read-only view binds five chords** (`src/hooks/useViewShortcut.ts`). The hook narrows its app's map to `VIEW_KEY_BINDINGS`, the three zoom chords, `search` and `stop`, through `pickKeyBindingMap`, which empties every other binding, so `useKeyBindingMap` binds those alone and Delete, Backspace, Space, `$mod+A`, `$mod+F` and every edit chord go on to the page unprevented. The zoom chords zoom as the canvas's do while the palette is closed, and the palette answers `search` and `stop` itself.
- **Escape is two presses.** The `stop` branch of `useErdShortcut.ts` decides from the state the press arrives in.
  - An open cell, memo or group name editor, a relationship being drawn, or an armed table group draw takes the press alone. Focus, selection and typed text stay.
  - While a logical name cell's term list shows, Escape closes the list alone, prevented and stopped at the input, so the stop branch and the page hear only the next press (an owner decision). The domain picker's list goes with its editor on the first press.
  - The actions are `editTableEndAction` / `editMemoEndAction` / `editTableGroupEndAction` / `drawEndRelationshipAction` / `changeDrawTableGroupAction`. The relationship draw takes the buttons beside its target with it.
  - That branch calls `preventDefault`, so a host that skips a prevented Escape leaves it be: Obsidian's workspace, a page's own dialog.
  - Any other Escape unselects and goes on unprevented.
  - A composing Escape never reaches `shortcut$` (`useKeyBindingMap`).
- **The memo textarea handles no Escape itself.** It has no Escape handler of its own. A trusted press drains microtasks between listeners, so its blur would end the edit before the branch looked. Only a real key shows that (`useErdShortcut.browser.test.tsx`).
- **Delete and Backspace remove the selection** (`KeyBindingName.removeSelection`, in the `useErdShortcut.ts` branch beside `removeTable`).
  - They remove the focused table's selected columns while that table is the whole selection and the zoom draws its rows (`getRemovableColumns`, `src/engine/modules/editor/utils/focus.ts`).
  - Otherwise they remove every selected table, memo and table group.
  - Either is one dispatch and so one undo, with no confirmation, and never takes a relationship as its target (owner decisions).
  - The relationships of a removed table or column go with it, as under `$mod+Delete` and `Alt+Delete`, which keep their own targets.
- **Ids removed elsewhere stay selected, counting nothing.** A table, memo, table group or column that an undo, a peer or an agent removed stays selected.
  - `getRemovableColumns` reads only the columns still in the table, and the tables, memos and table groups still in the document.
  - `removeTableAction$`, `removeMemoAction$` and `removeTableGroupAction$` leave such ids out of the selection they remove. A removal recorded for one makes an undo that brings it back.
- **A held key removes once** (`event.repeat` is dropped). A column removal hands the focus to the column above, or to the table name once the first column goes. So a repeat would run on up the columns and then take the table.
- **The table menu's last row follows the press.** It follows the press that raised the menu (an owner decision).
  - Delete column, or Delete columns for two or more, is the key's removal. It shows only when the press landed on the row of one of those columns (`SceneHit.columnId`, `hitTest.ts`), since a right press off the rows keeps the column focus.
  - Delete selected shows while the table is one of two or more selected.
  - Otherwise Delete removes the table alone.
- **The memo menu: Color, Remove color, Delete.** It lists Color, Remove color while it shows, then Delete (owner decisions). Delete reads Delete selected while the memo is one of two or more selected, and then removes every selected table, memo and table group. Otherwise it deletes that memo alone.
- **A Delete row shows the key's first chord.** It has no icon. The key closes an open menu, whose entity it may just have taken.
- **A memo's right click acts only by menu.** That holds on its body, colour bar or remove button, since only the main button clicks there (`mainButtonClick`, Mouse buttons above).

### The diff viewer

- **One diff, two readers** (`diffDocuments`, `src/utils/diff/`): the entries the tree lists and the marks each pane draws say the same thing, an added entity in the current pane alone, a removed one in the saved pane alone, a change both hold in both (`diffDocuments.test.ts` checks it one to one). An index draws nothing to mark. It is a snapshot of the moment the diff opens.
- **Pairing is by id first, then one to one by a name it keeps** (owner decisions of 2026-10-13): a table by its name, a column by its paired table and name, an index by its paired table and name or, unnamed, its paired key columns and UNIQUE, a foreign key by its paired tables and column pairs, a memo by what it says then where it stands, a group by its name or, unnamed, the tables it shares most. An unnamed entity never pairs by its name, and renamed is told only of an id pair. Index columns pair by the column they key, since a v2 file's load gives them new ids each time. Only live entities count, never the tombstones a runtime value keeps.
- **What a change is.** A table: name, comment, group, position, colour. A column: name, comment, type, default, AI, PK, UQ, NN, and a move, for a column outside the longest run both orders share. An index: name, UNIQUE, key columns with their direction. A foreign key: column pairs, kind, ON DELETE and ON UPDATE. A memo: text, position, size, colour. A group: name, members, colour, box. Never a z-index, a width the text gives, or a line's anchors. A rename outranks any other change (R over M), and a table added or removed lists nothing inside it.
- **The canvas marks text and outlines, never fills** (owner decisions of 2026-10-13): a changed cell's text in amber (`--diff-modify-foreground`; a change to a cell the row does not draw, such as UQ or AI under the default Show, or a key change on a row with no key icon, takes the column name's text instead, and a table comment change with the comment cell hidden takes the table name's, a rename's colour first), a renamed name in blue (`--diff-rename-foreground`), in both panes; a table, memo or group added or removed in a 2 px outline of its colour, with its name alone in it; a column added to or removed from a table both hold in its colour across the row; a foreign key's line in its colour, which a hover or a jump's light covers; an entity only moved, resized, recoloured or regrouped in an amber outline. A zoomed out table is marked as the full card, a comment change on its name, since it draws no comment. With no map provided, nothing draws.
- **The tree is the Explorer's** (`DiffTree.tsx` on `primitives/tree/Tree.tsx`): its folders, every row open at first, each name in the colour of what happened to it, a removed one struck through, ending on A, M, D or R, a tilde on a row listed for what it holds (the letter is aria-hidden and a visually hidden status word is read in its place). A table or a column is named as the name view the panes opened in shows it, the name after the logical name muted in the view of both (Name views), and no change to a logical name or a domain link is listed (an owner decision). A row's tooltip lists each change as before → after. The name filter reads the current and the saved name and logical name in any view, and replaces nothing. It opens at 260 px, sized from its edge between 200 and 480, and the next diff opens at 260 again; the panes take what is left.
- **A row takes each pane to its entity** by the one jump rule: an addition the current pane alone, a removal the saved pane alone, the rest both; a column or index its table, a foreign key its relationship, lit in the pane. The diff drops both panes' lights as it closes, since they are kept by editor ids no element teardown reaches.
- **Keys in the tree** stop at it as at the Explorer (`stopsAtPanel`), but Escape passes on, which closes the diff.

### Welcome screen

- **It stands over an empty diagram** (`welcome-screen/`, owner decisions of 2026-10-06). `Erd` mounts it between the minimap and the floating toolbar. `Erd` itself is the ERD tab's alone. It shows while all of these hold:
  - `enableWelcomeScreen` is on, and the editor is not readonly, not in zen mode, not taken over and not showing Table Properties.
  - The element is not yet destroyed (`AppContext.lifecycle.destroyed`, which `appDestroy` sets first). So the clear that `destroy()` dispatches raises no screen over the providers it removed.
  - The document holds no table, no shown memo and no shown group (`isEmptyDocument`, the content bounds' own `hasContent`). So the map and the scrollbars come as it leaves, the first table, shown memo or shown group takes it away, and an undo back to none brings it again.
- **It shows a heading and a menu.** The heading has no logo and no product name.
  - The menu rows are New Table, New Memo, Import, Command Palette and Shortcuts (`requestSettingsPage`), with no New Memo while memos are hidden. Back hands the keyboard to Import wherever it stands.
  - Import swaps in its formats (`createImportMenus`) behind a Back row, which Escape presses too.
  - Where the canvas has room, hand-drawn arrows point at the toolbar's Search button, at its theme and language buttons, and at the floating toolbar.
- `requestSettingsPage` and the Settings page it opens (`src/components/settings/settingsPage.ts`): `src/i18n/AGENTS.md`.
- **`welcomeTiers` fits the screen to the canvas.** It reads the whole canvas, centred there, the canvas the Explorer leaves while docked; an arrow whose button stands over the Explorer is left out (`measureAnchors`), and a label whose side holds less than a whole label beside it hangs under its arrow's tail instead (`hintPlacement`, the owner's request of 2026-10-14). The theme builder and the locale picker stand over it and move nothing (an owner decision of 2026-10-11).
  - Nothing shows under 320 px wide or 294 px tall.
  - The menu shows alone under 342 px tall.
  - The arrows show from 720 by 562 px, and a row's chord from 480 px wide.
  - The arrows also leave while the theme builder or the locale picker is up.
- **The three heights are what the block needs**, measured by `WelcomeScreen.browser.test.ts`.
  - At 294, Import's six rows alone fill the room over the floating toolbar on every platform, since a row keeps its height in any font.
  - At 342, in every language on a Mac, a heading of two lines over them at 320 px wide fills it.
  - At 562, the arrows clear that block with nothing to spare in the language whose labels wrap the most, and so does a label hung under its arrow beside a 260 px Explorer (4 px in the tightest language, measured 2026-10-14).
- **Only its menu takes the pointer.** The layer is `pointer-events: none` and the menu `auto`, so a drag over the heading pans. `.welcome-screen-menu` joins the `canDrag` list in `Erd.tsx`, so a press on a row starts no pan.
- **Arrows find their buttons by anchor classes.** They use the toolbar's anchor classes, `.toolbar-search`, `.toolbar-theme` and `.toolbar-locale` (`measureAnchors`); the theme and language buttons share the point between them.
  - They are measured again as the viewport, the tab, the props or the direction changes.
  - They mirror with the toolbar under a right-to-left language.
- **Its paint never comes from a stylesheet `fill`** (`src/styles/emittedCss.iconPaint.test.ts`). The arrows (`welcome-screen/welcome-hints/hintArrows.tsx`) take `fill="none"` and `stroke="currentColor"` attributes.
- **Its rows keep the editor's keys.** ArrowUp and ArrowDown, Home and End walk the rows round. Enter and Space press the row. Every other chord reaches the editor, so `Alt+N` still adds a table.
- **Hand the keyboard back with `focusEvent`.** A row that takes the menu away (New Table, New Memo, Shortcuts) does so. So does the screen when it leaves while a row holds focus, as when an import or a chord pressed on a row brings the first table. Without it the keyboard would fall to the page.

## Testing Requirements

- **Read the data URI from the template text.** A unit spec reads the checkbox's data URI there: happy-dom's CSSOM drops that data URI, while Chromium keeps it (Table Properties, the index column checkboxes).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
