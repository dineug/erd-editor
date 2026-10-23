# Changelog

## [4.2.0] - 2026-10-23

### Added

- Logical names for tables and columns, and a Name View of Physical, Logical or Both, picked from
  the floating toolbar, the Visualization bar, the canvas menu or the command palette. Flow, Graph,
  Table Properties, the Explorer, the Diff Viewer and image export draw names in the view picked.
- The Dictionary tab holds the diagram's words, terms and domains on sheets you search, sort and
  edit like a spreadsheet. It imports each from CSV, in its own layout or that of Korea's public
  data standard, UTF-8 or EUC-KR, and exports it in its own layout. `Alt`+`Enter` inserts rows
  below the selection, `Alt`+`Shift`+`Enter` above, and `Alt`+`Delete` deletes them. Undo and Redo
  there walk the sheet's own edits, and an SQL, GraphQL, DBML or AML import keeps the dictionaries.
- A logical name gives the physical name from the matching term, or from the abbreviations of the
  words it splits into, until you write the name yourself. The logical name cell completes term
  names, and Derive Physical Names Again, in the table and canvas menus and the command palette,
  derives the names again after a word or term changed.
- A column linked to a domain takes the domain's data type and follows it when it changes; typing
  another type unlinks the column. View Option → Domain shows each column's domain, and a foreign
  key column copies its key's domain and logical name.
- The Checks sheet lists forbidden, unregistered and synonym words, duplicate names, unknown
  domains, physical names other than a term gives, and columns off their domain's type. A double
  click goes to the row or column, and the canvas colors the names it flags.
- Find and Replace and the command palette's `#` search logical names too.
- The Schema SQL tab can write logical names into empty comments.
- The Settings tab gains a Name View lock, on by default like the others, so switching the view
  leaves the file alone, and Logical Name and Domain join its column order.
- Flow gains Previous table and Next table, which step back and forward through the tables it
  focused, as do `Ctrl`/`Cmd`+`Z` and `Ctrl`/`Cmd`+`Shift`+`Z` there.
- A coding agent can set logical names and domains, edit the dictionaries, derive physical names
  again and list the checks, with `@dineug/erd-editor-mcp` updated to this release.

### Changed

- An earlier release, or an earlier `@dineug/erd-editor-mcp` editing a file on its own, saves a
  diagram without its logical names, domains and dictionaries, so update both wherever you share
  diagrams.
- A file leaves out empty text, lists and collections, so a file an earlier release saved changes
  once, on its next save.
- A column moves by the handle beside the focused row, just outside the table's left edge, and
  carries the other selected columns with it. Dragging a column row now moves the selected
  tables, as the header does, and `Alt` duplicates them.
- Flow cards show each row's type at rest too, not only when lit.

### Fixed

- SQL Server comments keep text outside the database's code page, such as Korean, written as
  `N'…'`.
- An Oracle comment with a blank line no longer loses its `COMMENT` in SQL*Plus, and a SQLite
  comment on several lines no longer breaks the DDL.
- Notices such as "Couldn't copy to the clipboard" close on their own again instead of staying on
  screen.

## [4.1.0] - 2026-10-16

### Added

- The Explorer, docked left of the canvas, lists the diagram's tables, table groups and memos, and
  each table's columns, indexes and foreign keys. Open it from the toolbar; a click on a row goes
  to it, and a foreign key lights its relationship.
- Find and Replace also searches index and table group names, and Preserve Case gives the
  replacement the case of the text it replaces.
- `Alt`+`G` starts drawing a table group (press again to cancel), and `T` then `G` groups the
  selected tables.
- The bottom toolbar gains New Table, New Memo and New Table Group.

### Changed

- Find and Replace moves from its floating panel to the top of the Explorer, where the matches
  show in the tree. `Ctrl`/`Cmd`+`F` opens and closes it.
- The Diff Viewer lists what changed in the Explorer's tree, marked A, M, D or R. Against an
  earlier version of the same file, a rename shows as one rename instead of a removal and an
  addition. The canvas colors changed text and outlines added, removed or moved items instead of
  filling them.
- A jump from the command palette, the Explorer or the Diff Viewer leaves the view alone when the
  target already shows well, and the same jump again does not move it.
- The command palette's `#`, `@` and `:` lists show every match.
- The toolbar's table count moves to the Explorer's Tables folder.

## [4.0.0] - 2026-10-12

### Added

- Table groups: draw a named, colored box behind related tables from the canvas menu or the command
  palette, or group the selected tables. Drop a table in or out to join or leave, and drag the title
  to move the group with its tables. Auto Layout keeps groups together, the Schema SQL tab can write
  chosen groups alone, and DBML carries them as `TableGroup`.
- The editor in 25 languages, Arabic, Hebrew and Persian right to left. Pick one from the toolbar,
  the command palette or the new `dineug.erd-editor.locale` setting; Auto follows VS Code.
- An empty diagram opens on a welcome screen of first steps.
- Export ▸ Image opens a dialog with a preview: background on or off, light or dark, PNG at 1x to
  3x, SVG, or a copy to the clipboard.
- The Schema SQL tab gains options: CREATE TABLE IF NOT EXISTS, drop and re-create, a `USE` header,
  and SQL of your own before and after the tables, saved in the diagram.
- Code Generator languages Mermaid, PHP, Doctrine, Rust, SeaORM, Swift, Zod and JSON Schema, and an
  options panel that saves the code as a file.
- Import and Add adds a file's tables below the diagram instead of replacing it.
- Map Columns ends a relationship on columns a table already has, while you draw it or later from
  its right-click menu.
- `Delete` or `Backspace` removes the selection, and the table and memo menus gain Delete. Primary
  Key and `Alt`+`K` apply to every selected column.
- No color in the color picker and Remove color in the menus take a color off. The picker is new,
  with presets and the colors the diagram already uses.
- DBML and AML import and export keep table colors.
- View Option → Memos hides the memos.
- Drag with the middle button to pan from anywhere, over a table too.
- System in the theme builder, and Theme and Display Language in the command palette.
- Source Control, Local History, chat edit reviews and the revision views of GitLens, GitHub Pull
  Requests, GitLab Workflow and Git Graph open an ERD file as JSON text.

### Changed

- A file keeps only what the diagram is, in a fixed order: no measured widths, connector anchors,
  stacking order, timestamps or deleted items. Opening a diagram without an edit leaves the file as
  it was, and a file an earlier release saved is rewritten once on its first edit; until then a JSON
  editor checking its `$schema` flags it. An earlier release shows a file this one saved without its
  primary and foreign key icons, so update ERD Editor wherever you share diagrams.
- Save Scroll Information and Save Zoom Information become the viewport lock in the Settings tab,
  beside new locks for the open tab, the code generator language, the name cases and the bracket
  type. Every lock is on by default and the file keeps the locked value. A file saved earlier opens
  at the start position, at 100% and on the ERD tab.
- Update `@dineug/erd-editor-mcp` with this release: an older server and this editor refuse each
  other and say which to update. Agents leave view and code generator settings to you and can still
  set the database.
- The theme follows VS Code's color theme by default instead of dark; an appearance you set is kept.
- Imports arrive laid out by their relationships instead of in rows.
- Export ▸ Schema SQL opens the Schema SQL tab instead of saving at once.
- Image export draws at 100% whatever the zoom, and the PNG starts at 2x.
- Relationship lines have smaller ends, rounded corners and curved self loops, and cross fewer
  tables.
- A right drag no longer moves tables or memos; the right button only picks what the menu acts on.
- Tables and memos stack together, the one pressed last on top.
- A foreign key drawn from a `serial` key gets the integer type it stores (`integer` in PostgreSQL,
  `bigint unsigned` in MySQL and MariaDB) instead of `serial`.

### Fixed

- SQL import keeps whole `DEFAULT` expressions (`now()`, `0.5`, `((0))`), `UNSIGNED` and
  `ZEROFILL`, SSMS's `ADD DEFAULT … FOR` and `MS_Description` comments, pg_dump's serial and
  identity columns as auto increment, and an `ALTER TABLE` primary key marked `CLUSTERED`.
- SQL export writes valid key names and SQL Server comments for a table named with its schema
  (`sales.users`), puts a default in the parentheses MySQL, MariaDB, SQLite and PostgreSQL need,
  ends Oracle triggers with `/`, and types a SQLite auto increment key `INTEGER`.
- The code generators type columns more exactly (unsigned, decimals, bytes, UUIDs, JSON, time
  zones), and GraphQL keeps every relationship between two tables.
- Copied tables and columns keep `<` and `&` when pasted into a spreadsheet.
- Generated code no longer turns `I` into `ı` under a Turkish or Azerbaijani system language.
- Copy in the Schema SQL and Code Generator tabs says when the clipboard refused it.

## [3.1.0] - 2026-10-03

### Added

- Find and replace across table and column names, comments and memos, with match case, whole word
  and regular expressions. Open it with `Ctrl`/`Cmd`+`F` on any tab, or with the new button beside
  Search on the toolbar. It starts on names alone, and one undo takes back a Replace All.
- Quick search (`Ctrl`/`Cmd`+`K`) lists the editor's commands, and jumps to a table after `#`, a
  column after `@`, and a comment or memo after `:`. Korean matches while you are still typing a
  syllable, and by initial consonants alone: ㅅㅇㅈ finds 사용자.
- Set ON DELETE and ON UPDATE on a relationship from the On Delete and On Update menus of its
  line. SQL export writes them, SQL, DBML and AML import keep them, and the TypeORM, Sequelize,
  Drizzle, SQLAlchemy, DBML and AML code carries them. The menu notes an action the selected
  database's DDL leaves out, such as SET DEFAULT on MySQL.
- A relationship line shows those actions at its child end, `D:` for ON DELETE and `U:` for
  ON UPDATE (C, R, SN, SD or NA), and hovering it spells them out. View Option → Referential
  Actions hides the labels.
- View Option → Alternate Key marks the columns of each unique index on the diagram as `AK1.1`,
  `AK1.2` and so on, as ERwin and IDEF1X write them.
- The Indexes tab of Table Properties lists the primary key and the unique columns above the
  indexes. Table Properties has a title and a close button, and says when the document is read
  only.
- A coding agent can set ON DELETE and ON UPDATE and the two new view options too.

### Changed

- A new diagram saves neither the scroll position nor the zoom level (Save Scroll Information and
  Save Zoom Information start off), so looking around never changes the file. An existing file
  keeps the settings it was saved with.
- Drawing a relationship names each new foreign key column after the parent table: key `id` of
  table `user` gives `user_id`, not one more `id`. A key named in several words (`member_id`,
  `userId`) keeps its name, and a name the table already holds is numbered `_2`, `_3`.
- SQL import reads a UNIQUE over several columns as one unique index under its name, instead of a
  unique flag on each column.

### Fixed

- With Save Scroll Information and Save Zoom Information off, scrolling or zooming no longer marks
  a diagram modified, even one another release or machine wrote. A git revision or merge preview
  is never marked modified.
- SQL import keeps user-defined and extension types (an enum made with CREATE TYPE, a domain,
  `hstore`, `citext`, `"MyType"`, `public.mood`), the brackets of `integer[]` and the quoted values
  of `ENUM('a','b')`, which came in empty or broken. A doubled quote such as `'it''s'` reads as one
  quote, a column's inline `REFERENCES` makes a relationship, and every unique key an ALTER TABLE
  or a dump's CREATE UNIQUE INDEX adds is kept.
- Exported DDL escapes a quote inside a comment, and the Schema SQL tab of Table Properties writes
  the table's unique columns.

## [3.0.1] - 2026-09-28

### Fixed

- Escape while editing a cell or a memo, or while drawing a relationship, now ends only that edit;
  the next Escape clears the selection.
- Right-clicking a table that lies over a relationship line opens the table's menu.
- In a folder opened through a symlink, a junction or a mapped drive, a coding agent now edits the
  diagram in the tab you already have open, instead of opening a second one whose save could undo
  its edits.
- On Windows, a VS Code window running as administrator is no longer taken for closed, so an agent
  no longer edits its diagrams on disk behind the open editor.
- On Windows, a diagram you just opened no longer stays hidden from agents now and then.
- On Windows, an agent asks you to rename a diagram whose name Windows cannot store as written,
  such as `orders:v2.erd` or `NUL.erd`, instead of writing a file other programs read differently.

## [3.0.0] - 2026-09-24

### Added

- Let a coding agent edit your diagrams. Claude Code, Codex or any other MCP client joins the
  editor through the `@dineug/erd-editor-mcp` MCP server like a collaborator: each change shows up
  on the canvas as it happens and stays unsaved until the agent or you save, and the agent's undo
  reverts only its own edits. See Coding agents in the README to set it up.
- An agent connects only in a trusted workspace, and the new `dineug.erd-editor.agentHub.enabled`
  setting turns it off for the window. An agent can then still read the diagrams from disk, but
  never writes one behind the editor.
- Reset the zoom to 100% by clicking the percentage on the bottom toolbar, on the ERD canvas and
  the Visualization tab.

### Changed

- Minimum supported VSCode is now `1.101.0` (was `1.90.0`), the first release running on Node 22.
- The extension also starts in a workspace whose diagrams are `.erd.json` or `.vuerd.json` files,
  not only `.erd` or `.vuerd`, so an agent can reach them before one is opened.

### Fixed

- After a table is dragged in one editor, the other editors of the same document show where it
  ended up at once, instead of stopping short of it until the next change.

## [2.8.0] - 2026-09-19

### Added

- Zoom with a trackpad pinch, or with two fingers on a touch screen, on the ERD canvas, the Diff
  Viewer and the Visualization tab. The zoom follows the point you pinch at.
- Drop a column below a table's last row to move it to the end, or into a table with no columns.

### Changed

- Tables have a new look: a header band with a table icon, and the table colour down the left
  edge. A long table name no longer runs under the header buttons.
- The light theme is easier to read: tables and memos are white with a darker border and a soft
  shadow, and keys, relationship lines, the Visualization graph and switches that are off stand out
  from the background.
- Context menus, table properties, quick search and the other floating panels cast a shadow.
- A selected column row, tab or toolbar tool now stands out from the one under the pointer.
- Apply is the primary button on the Time Travel and automatic placement bars.
- Dragging columns shows the dragged rows under the pointer, and reordering animates smoothly.

### Fixed

- Context menus and their submenus stay inside the window, scroll when taller than it, and open
  above the bottom toolbar.
- Data type hints show at most ten rows and scroll, close once a full type is typed (such as
  VARCHAR(255)), and keep the spaces in names such as DOUBLE PRECISION.
- Drawing a relationship: the preview line starts at the table you pressed, and ending it on a
  table's button no longer also presses that button.
- Relationship lines no longer flash out of place for a frame after an undo, a redo, an Auto
  Layout or a new relationship.
- The Diff Viewer highlights added and removed items again, and lists a table whose only change is
  added columns.
- SQL import: index and constraint clauses (ON DELETE, USING BTREE, index names and the like) no
  longer turn into extra columns, quoted DEFAULT values keep their quotes, and a COMMENT or NOT NULL
  written after UNIQUE is kept.
- Pasting tab-separated text without formatting no longer adds an empty column.
- Flow: Related and Go to ERD leave your table selection alone, and narrowing the view no longer
  shows the cards in the wrong place first.
- Graph mode: a dragged dot stays under the pointer, and a document saved on the Visualization tab
  opens with the graph centred.
- A memo keeps its resize cursor for the whole resize.

## [2.7.0] - 2026-09-14

### Added

- Explore relationships in a new Flow mode on the Visualization tab. Tables are laid out as cards;
  hover or click one to light it and its related tables, with particles running along the lines.
  Pick Name only, Keys only or All fields, and use Tidy Up to lay it out again. Flow is a view only
  and never changes the diagram; the existing graph stays as Graph mode.
- Focus on tables with Alt+F or Focus on this table in the table context menu: Flow opens narrowed
  to the selected tables and the tables related to them. Show all returns to the whole diagram.

### Changed

- The canvas tools, zoom, relationship notations and zen mode now share one toolbar at the bottom
  of the canvas, instead of the top-left corner and the top menu bar.
- Reset the zoom to 100% with Ctrl/Cmd+0 instead of Ctrl/Cmd+O.

## [2.6.0] - 2026-09-07

### Added

- Lay the whole diagram out from an Auto Layout menu, on the canvas context menu and in the quick
  search. Force is the simulation you watch settle, with Apply and Cancel as before; Flow, Tree -
  vertical and Tree - horizontal read the relationships and arrive in one go, and a single undo puts
  every table back. Flow also decides where each line meets a table, which pulls the crossings out.

### Fixed

- End a canvas pan the pointer was taken from: dragging out of the window used to leave the canvas
  following a mouse that was no longer held.
- Keep a pan from selecting text as it travels, the top toolbar included.
- Keep Alt+Z inside the editor, so toggling zen mode no longer also reaches whatever that chord is
  bound to outside it.

## [2.5.0] - 2026-09-06

### Added

- Pan the canvas anywhere: it has no edges any more. The scrollbars and the minimap now describe
  where the diagram is rather than a fixed page, and both hide themselves on an empty document.
- Point an empty screen back at the diagram: when no table or memo is on screen, a pill on the
  bottom edge gives the direction and distance to the nearest one, and pressing it centres it.
- Select every table and memo with Ctrl/Cmd+A as well as the older Ctrl/Cmd+Alt+A, and drag a
  whole selection by any entity in it without holding a modifier.
- Carry relationships and indexes through a copy of whole tables, by Alt+drag or by copy and
  paste. A relationship comes along when both of its tables are in the copied set, and an index
  comes along whole.
- Reset the zoom to 100% with Ctrl/Cmd+O.
- Reach the canvas tools from a floating toolbar in its top-left corner: the hand and pointer
  tools, the four relationship notations, and zen mode (Alt+Z), which leaves the canvas and that
  toolbar alone on screen. Space toggles the hand tool, and every button names its shortcut.

### Changed

- Export a PNG cropped to the diagram's own bounds plus a margin, drawn at the zoom the editor is
  showing.
- Drop the canvas size setting from the toolbar, and the edge markers that pointed at every
  off-screen table and memo — an unbounded canvas has no size to set, and the compass above
  replaces the markers.
- Store the view position as an origin pair in the document. An older version keeps reading the
  scroll fields it always did, which this version no longer writes, so it opens a file saved here
  where it last left it rather than where this version saved it.

## [2.4.0] - 2026-09-05

### Added

- Zoom the canvas in to 150%; 100% used to be the ceiling. A document saved past 100% opens at 100%
  in an older version.
- Show progress while tables are being placed automatically and while a PNG is being exported, with
  Apply and Cancel on the placement toast.
- Light a hovered table's neighbourhood in the visualization: its columns, the tables it relates to
  and the links between them stay whole while everything else fades.

### Changed

- Draw the diagram, the minimap and the visualization on canvas instead of the DOM. Large diagrams
  load and pan much faster, and moving a table re-routes only its own relationships.
- Zoom the visualization with the wheel, pan it by dragging the background and pin a node by
  dragging it. Table names appear on the graph as you zoom in, and a hovered table's preview lists
  its columns.
- Drop relationship lines from the minimap, and grow its viewport rectangle as the canvas zooms out
  instead of shrinking the map.
- Export a PNG in a background worker, so the editor stays responsive while a large document is
  being drawn.

### Fixed

- Export a document too large for the browser to raster as a smaller PNG, and say so, instead of
  producing no file.

## [2.3.2] - 2026-08-30

### Added

- Import GraphQL SDL, DBML and Azimutt AML files, including legacy AML v1, as diagrams.
- Generate Go structs, code for SQLAlchemy, TypeORM, Sequelize and Drizzle, and DBML or AML
  schemas.
- Add Databricks and Snowflake support, including DDL generation, SQL import and data-type
  suggestions.
- Copy and paste selected tables or memos, duplicate them with Alt+drag, and use their tab-separated
  or HTML clipboard representations outside the editor.
- Expand data-type suggestions for every supported database vendor.

### Changed

- Route relationship lines around tables with more compact connectors and easier hit targets.
- Replace editor icons with Lucide outlines while preserving crow's-foot relationship notation.
- Make Schema SQL and Code Generator output selectable, and group the generator's language menu by
  kind.
- Filter Import and Diff file pickers by the selected format.

### Fixed

- Make SQL import robust across complex `CREATE` forms, three-part identifiers, multi-word types,
  quoted names, comments, identity columns, nested options and unmatched `]`, preventing hangs,
  phantom columns and lost schema detail.
- Generate valid GraphQL schemas and map vendor types and unique constraint names correctly in
  generated output.
- Stabilize relationship routing and large-diagram dragging, and correct index-column selection in
  the table properties panel.
- Preserve angle-bracket code while highlighting, and deliver copy and paste keys to text fields
  rather than the canvas.

## [2.2.0] - 2026-08-15

### Changed

- Minimum supported VSCode is now `1.90.0` (was `1.85.0`), which is the first release running on
  Node 20.

### Fixed

- Import no longer accepts a file whose extension merely ends with the expected one — `sample.xjson`
  was being read as JSON.
- Closing an ERD tab while it was still opening left the editor's resources behind.
- Running an ERD command from the editor title bar could open the file in an unintended editor group.
- Saving a theme could pick the wrong settings scope when the existing value was empty.
- A single theme change no longer pushes the same update to the webview several times.

## [2.1.0] - 2025-05-07

### Fixed

- Updated LWW data handling logic

## [2.0.5] - 2025-02-28

### Fixed

- Support for Postgres `ALTER TABLE ONLY` syntax
- Support for MSSQL bracket syntax

## [2.0.4] - 2024-11-09

### Fixed

- Optimize relationship to reduce unnecessary re-rendering.

## [2.0.3] - 2024-10-30

### Fixed

- Fixed a bug where schema GC was not triggered.

## [2.0.2] - 2024-10-27

### Added

- Shift for horizontal scroll
- Column Key hover on relationship

## [2.0.1] - 2024-09-28

### Fixed

- zoom step
- Add support for ALTER database.TABLE syntax in the parser

## [2.0.0] - 2024-08-03

### Fixed

- Legacy support for `.vuerd` and `.vuerd.json` has ended. They now operate with the new version.

## [1.0.20] - 2024-04-13

### Fixed

- Improved Git status change

## [1.0.19] - 2024-03-22

### Fixed

- TimeTravel viewport

## [1.0.18] - 2024-03-20

### Added

- Table count

## [1.0.17] - 2024-03-20

### Added

- Time Travel

## [1.0.15] - 2024-02-08

### Added

- Diff Viewer

## [1.0.14] - 2024-01-28

### Fixed

- Validation foreignKey

## [1.0.11] - 2024-01-27

### Added

- Legacy back porting

## [1.0.9] - 2024-01-12

### Added

- Improvement in Scroll Usability

## [1.0.5] - 2024-01-06

### Added

- Multiple editors supported per document.

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/supports-multiple-editors-per-document.webp?raw=true)
