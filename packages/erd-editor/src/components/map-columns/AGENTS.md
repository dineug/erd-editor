<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# map-columns

## Purpose

`src/components/map-columns/` holds Map Columns, the dialog that maps a parent table's key onto a child table's columns. Its DOM-free half is `src/utils/map-columns/`: the keys a parent offers, the rows over a session, the checks and the batch a mapping writes. This file also holds `relationship.changeColumns`, the action Map Columns writes when it edits a relationship, and how that action merges between peers. Other nested files touch the same feature: `src/components/erd/AGENTS.md` (the buttons that open it during a draw), `src/components/export-image/AGENTS.md` (the shared modal it is built on), `src/engine/AGENTS.md` (foreign key names, the type of related existing columns, the foreign key bits), `src/i18n/AGENTS.md` (text direction), `src/components/find-replace/AGENTS.md` (the panel it closes as it opens) and `src/components/primitives/AGENTS.md` (the native list in `select/Select.tsx` and the 2 px ring on Map Columns' lists). A change here keeps the owner decisions of 2026-10-06 and a mapping that converges on every peer.

## Making a Change

1. **Read the files on the other side.** A change to the buttons that open the dialog during a draw reads `src/components/erd/AGENTS.md`. A change to the modal reads `src/components/export-image/AGENTS.md` (Rules, The shared modal). A change to the columns a New column row adds, or to the type sync, reads `src/engine/AGENTS.md`.
2. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. The Vitest specs under Testing Requirements run in that test task, each `*.browser.test.tsx` in real Chromium; the e2e spec runs in step 3.
3. **Run the e2e suite for visible changes.** `e2e/specs/relationship-map-columns.spec.ts` drives the buttons beside a draw's target and the dialog. `pnpm --filter @dineug/erd-editor e2e` builds the package and runs every Playwright spec, this one included.
4. **Change a merge rule with its convergence spec.** `src/engine/peer-store.converge.test.ts` holds every mapping race (`relationship.changeColumns converges`), so a change to the register, a tie-break or the column order shows there.

## Key Files

| File | Description |
| --- | --- |
| `MapColumnsDialog.tsx` | The dialog, built from the document on every render; its closing toasts and `TableRemovedText` |
| `MapColumnsBody.tsx` | The parent's key, a row per key column with its native `<select>`, the line saying what stands in the way, Cancel and the button that writes the mapping |
| `MapColumnsDialog.styles.ts` | The dialog's one column and its native lists drawn in the editor's appearance |
| `mapColumnsAction.ts` | `mapColumnsAction$`, the one batch Map or Save dispatches, judged on the state it lands on |
| `openMapColumns.ts` | `openMapColumns`, which opens the dialog on the session the opening names |
| `nameOf.ts` | `nameOf`, a table's or column's name as Map Columns and the draw-target buttons write it, unnamed where it has none |
| `src/utils/map-columns/candidateKeys.ts` | `getCandidateKeys`: the primary key in column order, then each unique column |
| `src/utils/map-columns/prefill.ts` | `toPrefillNames` and `prefillPicks`, the names a child column may hold and the rows they fill |
| `src/utils/map-columns/buildRows.ts` | `openCreateSession`, `openEditSession`, `buildMapColumns`, `changeMapColumnsKey`, `pickMapColumn` |
| `src/utils/map-columns/validate.ts` | `validateMapping` (the issues of each row and of the mapping) and `isSameResult` (whether the state already holds the result) |
| `src/utils/map-columns/alignTypes.ts` | `toAlignTypeActions`, the data type changes the sync makes |
| `src/utils/map-columns/toMapColumnsActions.ts` | `toMapColumnsActions`, the batch a confirmed mapping writes |
| `src/utils/map-columns/mapping.ts` | `MapColumnsDraft`, `MappingRow`, `ColumnPick` and the list helpers |
| `src/components/erd/erd-context-menu/ErdContextMenu.tsx` | The relationship menu's row (`handleOpenMapColumns`) |
| `src/components/erd/erd-context-menu/menus/relationshipMenus.ts` | `relationshipTypeName`, the notation names the dialog shares |
| `src/i18n/messages/en/mapColumns.ts` | The `mapColumns.*` text |
| `src/engine/modules/relationship/atom.actions.ts` | The `relationship.changeColumns` reducer, its `columns` register and `namesOtherTables` |
| `src/engine/modules/table-column/atom.actions.ts` | The `column.changeDataType` reducer and its tie-break |
| `packages/mcp-server/src/tools/reachability.ts` | Why `mcp-server` emits no `relationship.changeColumns` |

## Rules

### Opening Map Columns

- **Owner decisions of 2026-10-06 shape Map Columns.** Map Columns maps the parent's key onto the child's columns, a row per key column. The rules from here through Text and direction come from those decisions.
- **Two ways open it.** It opens for a new relationship from the buttons beside a draw's target. It opens for a held relationship from the relationship menu.
- The buttons beside a draw's target: `src/components/erd/AGENTS.md`.
- **The menu row respects readonly and a draw.** The relationship menu hides the row in readonly. It ends an armed draw before the dialog opens, since the draw's buttons would otherwise come back over the table once the dialog closed (`handleOpenMapColumns`).
- The modal contract Map Columns keeps (shortcuts, undo, Find and Replace and the palette): `src/components/export-image/AGENTS.md` (Rules, The shared modal).

### The key

- **The key is primary or unique.** The key is the primary key, read in table column order, or a unique column. References offers the choice only while it lists two or more (`showReferences` in `src/utils/map-columns/buildRows.ts`).
- **A unique primary key is one choice.** A unique column over the primary key's very columns counts as that key, not as a second choice.
- **A unique index is no key here.** The generators write a foreign key before the index it would need.

### Rows and picks

- **A native `<select>` picks each row's child.**
- The native list (`select/Select.tsx`) and Map Columns' 2 px ring on it: `src/components/primitives/AGENTS.md`.
- **Prefill only on exactly one name match.** A row is prefilled only where exactly one child column bears a name the parent column gives. One such name is the name a new foreign key column would take (`users_id`). Another is that name built from the table part of a schema-qualified name. A unique column's own name is the third. The parent column itself is never prefilled.
- **A broken stored mapping keeps Save off.** A stored mapping its lists cannot pair (two lengths, a repeated column) shows `(invalid)` rows. A column gone shows `(removed)`. Either keeps Save off until a key or a pick repairs it.

### The batch Map or Save writes

- **Map or Save is one dispatch.** It dispatches `mapColumnsAction$` once, so the mapping is one version and one undo. The batch holds, in this order:
  1. the New column rows' columns, made as the pointer draw makes them;
  2. the data type changes the sync makes;
  3. `relationship.add` with a new id, or `relationship.changeColumns` on the relationship edited.
- Foreign key names of a New column row, and the type sync for related existing columns: `src/engine/AGENTS.md`.
- **An edit keeps the relationship's other fields.** `relationship.changeColumns` keeps the relationship's id, its place, its constraint name, its type and its referential actions.
- **A column the mapping stops using stays.** It keeps NOT NULL and everything else, and loses its foreign key mark to the hook.
- The foreign key bits the hook keeps: `src/engine/AGENTS.md`.
- **Judged on the state the batch lands on.** A result the document already holds writes nothing and says nothing. A table or the relationship gone writes nothing behind a toast. So does anything the dialog would have shown as standing in the way (rows that no longer cover the key as it stands among them).

### The dialog follows the document

- **Built from the document on every render.** So the dialog follows a peer's edit and keeps what the reader picked. It says when the relationship it edits changed meanwhile.
- **It closes once what it maps is gone.** It closes with a toast once a table or the relationship it maps is gone.

### Text and direction

- **Its own text is `mapColumns.*`.** The keys are in `src/i18n/messages/en/mapColumns.ts`, the buttons' titles and the menu row included.
- **It shares `common.*` words.** These are Cancel, Primary Key, unnamed and the notation names. `relationshipTypeName` reads the notation names from the relationship menu's own table.
- **Text is read in each render.** The toasts read theirs where they render: `localized`, and `TableRemovedText` for a removed table's name or its unnamed.
- **Names and data types enter as placeholders.**
- **A right-to-left subtitle points its arrow left.** The parent stands on the right.
- The direction of Map Columns' data types (`ltr`) and column names (`dir="auto"`): `src/i18n/AGENTS.md`.

### `relationship.changeColumns`

- **Both lists share one register, `columns`.** So a mapping never mixes two writers. Of two writes at one Lamport version, the greater `JSON.stringify([start.columnIds, end.columnIds])` wins on every peer.
- **A payload naming other tables is ignored.** The reducer drops it before the register moves (`namesOtherTables`).
- **`column.changeDataType` breaks a tie the same way.** Of two types written at one version, the greater wins. Map Columns writes a child's type with no one typing it, and the undo of one mapping can meet another peer's at one version. So a batch that writes one column's type twice keeps the greater, not the last.
- **An edit landing after removal changes the tombstone.** An edit landing on a removed relationship changes its tombstone. So undoing the removal brings the relationship back with that mapping.
- **An undo writes the replaced lists back.** It writes them over a later edit, as the undo of any field does.
- **An editor built before the type drops it.** It keeps the old mapping until it opens the document again. Its removal of a column it still maps takes the remapped relationship from every peer.
- **A handshake peer can skip one edit.** A peer that joined through the register handshake (`getLWW` / `mergeLWW`) can skip an edit of the version it took. The handshake carries versions, not values. That peer can differ until it opens the document again.
- **`mcp-server` emits none.** Its reachability list (`packages/mcp-server/src/tools/reachability.ts`) says why. An agent re-maps a relationship with an `erd_batch` of `erd_remove_relationship` and `erd_link_columns`, which every editor applies.
- **Concurrent column adds keep arrival order.** So peers that each added one, a Map's New column among them, list them in different orders. `src/engine/peer-store.converge.test.ts` asserts that order as measured. A column order register would show there, beside every other mapping race it holds.

## Testing Requirements

- `mapColumnsAction.test.ts`, `MapColumnsDialog.test.tsx` and `MapColumnsDialog.browser.test.tsx` cover this directory; `src/utils/map-columns/` has a spec beside each module except `index.ts` and `toMapColumnsActions.ts`.
- `src/engine/peer-store.converge.test.ts` (`relationship.changeColumns converges`) holds the mapping races, among them `an editor that predates the mapping edit`, `a change racing a mapping made in Map Columns` and the column order of concurrent adds.
- The two tie-breaks are pinned in `src/engine/modules/relationship/atom.actions.test.ts` and `src/engine/modules/table-column/atom.actions.test.ts` (`changeColumnDataType at one version`).
- `e2e/specs/relationship-map-columns.spec.ts` drives the buttons beside a draw's target, the dialog and where the buttons stand.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
