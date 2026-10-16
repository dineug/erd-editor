<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# schema-sql

## Purpose

`src/components/schema-sql/` holds the Schema SQL tab: the DDL it draws, its options panel with the two script editors, its context menu, and the window's own choices in `schemaSQLView.ts`. The tab hands those choices to `createSchemaSQL`. What the DDL writes for each database lives in `src/utils/schema-sql/`, with its rules in `src/utils/schema-sql/AGENTS.md`. The scripts are document content (`settings.ddlScripts`), whose action and register are in `src/engine/AGENTS.md`. The code's direction and the width the panel's labels must fit are in `src/i18n/AGENTS.md`. The Code Generator tab borrows this panel's shell, as `src/components/generator-code/AGENTS.md` says.

## Making a Change

1. **Read the nested files the change reaches.** Purpose names them. A change to `SchemaSQL.styles.ts`, `SchemaSQLOptions.styles.ts`, `keepSpace`, `resolvePanel` or `togglePanel` reaches the Code Generator tab too. Its `GeneratorCode.test.ts` and `generatorCodeView.test.ts` import them.
2. **Update the spec holding the changed rule.** Testing Requirements maps each rule to its spec.
3. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. The `*.browser.test.tsx` specs here run in real Chromium in that task.

## Key Files

| File | Description |
| --- | --- |
| `SchemaSQL.tsx` | The tab: the code, the panel or Show options, the Tables `observer`, Save file and Copy; given a `tableId`, the one table's plain Create that Table Properties shows (`createSchemaSQLTable`) |
| `schemaSQLView.ts` | `schemaSQLViewOf`, the window's own choices; `resolvePanel`, `togglePanel`, `showSchemaSQLExport`; the table choice (`syncTableChoice`, `chosenTableIds`, `isNoTableChosen`) |
| `schema-sql-options/SchemaSQLOptions.tsx` | The options panel; `keepSpace` |
| `schema-sql-options/ScriptEditor.tsx` | The before and after script editors; `SCRIPT_PASSING_BINDINGS` |
| `schema-sql-options/dropWarning.ts` | `formatDropWarning`, the warning Drop & re-create shows |
| `schema-sql-context-menu/` | The tab's menu: Database and Bracket, plus the statements, the header, the panel and Save file in the whole document's tab (`full`); the palette reuses the menus in `menus/`. Statements and Header draw no icon, and Save file reads without an ellipsis, as it saves at once (the owner's request of 2026-10-15) |

## Rules

### The options panel and the window's own choices

The rules in this section are owner decisions of 2026-10-07.

- **The DDL sits beside a 300 px panel.** The tab draws the DDL of the whole document, or of the tables chosen under Tables. The code sits on the left in every language, beside a 300 px panel (`SCHEMA_SQL_PANEL_WIDTH`).
- **The panel holds the DDL's controls.** From the top: the Database and Bracket selects, then Statements (Create, If not exists, Drop & re-create) and Header (None, `USE`, `CREATE + USE`). Tables follows while the document lists a table group. Last come the before and after script editors, with Save file and Copy at the panel's foot.
- **Table Properties' Schema SQL tab stays plain code.** It is always Create, with no header or script.
- **Keep the window's choices in `schemaSQLViewOf(app)`.** Statements, Header, Tables and whether the panel shows live there (`schemaSQLView.ts`), a `WeakMap` over the store. They are never in the store, the file, a change event or storage. They are kept across tab switches until the element goes, one set per editor. They are no setting, so no action, file or peer carries them.
- **Hold what the reader asked for.** The view starts at `ifNotExists` and `createAndUse`. `resolveSchemaSQLOptions` turns a request into what each database has. A segment the database lacks is `aria-disabled`, titled Not in {database} (`schemaSql.notInDatabase`). So a choice outlives a change of database.
- What each statement and header writes per database, `createSchemaSQL`'s order, `formatScript` and Drop & re-create per vendor: `src/utils/schema-sql/AGENTS.md`.
- **The panel opens from 640 px of editor.** It opens unless the editor is under 640 px wide (`SCHEMA_SQL_PANEL_COLLAPSE_BELOW`). That is decided when the tab, or its own menu, first reads a measured `editor.viewport.width`. Table Properties' Schema SQL menu leaves it unsettled. Then the panel keeps what it was set to, folded behind a Show options button over the code.
- **Export ▸ Schema SQL saves nothing at once.** In the canvas menu and the palette's Export, `showSchemaSQLExport` opens the tab with the panel and focuses Save file. The palette has no top-level Export: Schema SQL row, since its Tab row reaches the tab (the owner's request of 2026-10-15). Save file names the file by `createName` in `src/utils/file/exportFile.ts`.

### Tables by table group

- **Tables chooses the DDL's tables by group.** `view.tables` is unsaved, as an owner decision. It shows a box for All, mixed while some are checked, and one for each group in `doc.tableGroupIds` order. Last comes No group, the tables in none.
- **A group's box shows its name and color.** It shows the group's name, or `common.unnamed` in the placeholder's colour, and a dot where `toOpaqueHex` reads its color.
- **Every box checked writes the whole document.** The output is the tab's output with no group at all, `createSchemaSQL` given no table filter.
- **A subset hands `createSchemaSQL` the checked boxes' tables.** They go in document order (`chosenTableIds`), a table's group read as `getTableGroupId` reads it. They go with `scripts: true`, so the scripts stay.
- **Foreign keys to tables left out stay.** A foreign key to a table outside the subset is still written. Drop & re-create, its warning and the Oracle long names cover the chosen tables alone.
- How `createSchemaSQL` writes some tables and judges a parent left out: `src/utils/schema-sql/AGENTS.md`.
- **No box checked writes `''`.** A hint shows over the code (`schemaSql.noTablesChosen`). Save file and Copy write what the code shows.
- **Replace the choice whole.** It keys on group ids and is replaced whole, so a watcher hears one change.
- **An `observer` matches the choice to the groups.** The full tab holds it while mounted. It matches the choice to the groups the document lists (`syncTableChoice`). At mount it matches the choice to those that changed since it last met them. A group not met starts checked only while every box was. A removed group's choice is dropped, and with no group left every box is checked again.
- **Readonly chooses alike.** It can, since nothing of the choice enters the document.
- **The text follows the choice and groups.** It follows the choice and the group list. A membership change alone, like any table edit, shows when the tab mounts again.

### Script editors

- **A script editor commits once per edit.** `schema-sql-options/ScriptEditor.tsx` is a textarea under a shiki overlay that keeps a draft. It commits on blur, or on unmount while it holds the focus (a tab switch by its shortcut). The panel dispatches `changeDDLScriptAction` with what it commits. So one undo on the ERD tab takes back one edit.
- **Commit only a draft that changed.** It commits only when the draft differs both from what it held as it took the focus and from the document's. So a field only read never writes back over a peer's or an agent's script.
- **Take the document's value while unfocused.** It takes a peer's or an agent's value while it is not focused. It also takes it on a blur with nothing typed, and in a readonly editor, where it is a readonly textarea.
- **The field grows with its text.** Its box holds its height while the field is measured, so the scrolled panel keeps its place and the caret stays in sight.
- **Stop the editor's chords at the field.** Its keydown stops every chord of `keyBindingMap` but find, the palette, Escape and the zoom keys (`SCRIPT_PASSING_BINDINGS`), and a composition. It stops them without `preventDefault`. The root's `useKeyBindingMap` cancels a chord on every tab, and no store on this tab undoes. Without the stop, `$mod+Z`, a line or word delete and a macOS Option character would do nothing in the field.
- **Copy, cut and paste stop there too.** That keeps them away from the diagram's clipboard.
- **The panel and Show options stop Space.** `keepSpace` stops it there. Space is the hand tool's key, whose binding cancels a native button's press.

## Testing Requirements

- **`schemaSQLView.test.ts`** holds the view's first values, one view per editor, the 640 px rule, `showSchemaSQLExport`, the table choice and `chosenTableIds`.
- **`SchemaSQL.test.ts`** holds what the tab writes for the window's choices, Save file and Copy, the one table Table Properties shows, and the `SchemaSQL tables by group` cases.
- **`schema-sql-options/SchemaSQLOptions.test.ts` and `SchemaSQLOptions.browser.test.tsx`** hold the segments, the drop warning, the scripts' commits through the panel and `keepSpace`. The browser spec also holds the 300 px width, the 640 px fold, the Tables boxes and Space on a real keyboard.
- **`schema-sql-options/dropWarning.test.ts`** holds `formatDropWarning`: no warning with no table, up to five names in full, the first four of more and a count of the rest, Snowflake's replace in place, and each name isolated in a right-to-left language.
- **`SchemaSQL.styles.test.ts`** holds the tab's layout: the code and the options panel side by side, the code taking what the panel leaves, and Show options painted in the colour of the code block it sits on.
- **`schema-sql-options/ScriptEditor.test.ts` and `ScriptEditor.browser.test.tsx`** hold the commit once per edit, the draft, the growth, the keyboard and the paste.
- **`schema-sql-context-menu/`** has a spec beside the menu and beside each of its three menu modules.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
