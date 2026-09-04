<!-- Keep a Changelog guide -> https://keepachangelog.com -->

# erd-editor-intellij-plugin Changelog

## [Unreleased]

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
