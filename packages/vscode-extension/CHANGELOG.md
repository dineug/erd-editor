# Changelog

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
