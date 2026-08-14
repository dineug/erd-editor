# Changelog

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
