<!-- Keep a Changelog guide -> https://keepachangelog.com -->

# erd-editor-intellij-plugin Changelog

## [Unreleased]

## [0.8.0] - 2026-09-19

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

## [0.7.0] - 2026-09-14

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

### Fixed

- Auto Layout's Flow, Tree - vertical and Tree - horizontal did nothing in 0.6.0; they now run.

## [0.6.0] - 2026-09-07

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

## [0.5.0] - 2026-09-06

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

## [0.4.0] - 2026-09-05

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

## [0.3.0] - 2026-08-29

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

### Fixed

- Make SQL import robust across complex `CREATE` forms, three-part identifiers, multi-word types,
  quoted names, comments, identity columns, nested options and unmatched `]`, preventing hangs,
  phantom columns and lost schema detail.
- Generate valid GraphQL schemas and map vendor types and unique constraint names correctly in
  generated output.
- Stabilize relationship routing and large-diagram dragging, and correct index-column selection in
  the table properties panel.
- Make Time Travel restore diagrams correctly after moving forward from a rewind.
- Preserve angle-bracket code while highlighting, and deliver copy and paste keys to text fields
  rather than the canvas.

## [0.2.1] - 2026-08-08

### Changed

- Support for the latest IntelliJ IDEA (2026.x). The minimum supported IDE is now 2025.2.

## [0.2.0] - 2025-05-07

### Fixed

- Updated LWW data handling logic

## [0.1.6] - 2025-02-28

### Fixed

- Support for Postgres `ALTER TABLE ONLY` syntax
- Support for MSSQL bracket syntax

## [0.1.5] - 2024-11-09

### Fixed

- Optimize relationship to reduce unnecessary re-rendering.

## [0.1.4] - 2024-10-31

### Fixed

- Fixed a bug where schema GC was not triggered.

## [0.1.3] - 2024-10-27

### Added

- Shift for horizontal scroll
- Column Key hover on relationship

## [0.1.2] - 2024-09-28

### Fixed

- zoom step
- Add support for ALTER database.TABLE syntax in the parser

## [0.1.1] - 2024-04-13

### Fixed

- Improved Git status change

## [0.1.0] - 2024-03-22

### Added

- Time Travel
- Table count

## [0.0.3] - 2024-02-09

### Added

- Diff Viewer
