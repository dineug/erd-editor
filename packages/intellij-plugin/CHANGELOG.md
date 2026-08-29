<!-- Keep a Changelog guide -> https://keepachangelog.com -->

# erd-editor-intellij-plugin Changelog

## [Unreleased]

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
