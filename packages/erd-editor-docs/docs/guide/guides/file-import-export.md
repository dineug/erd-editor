---
sidebar_position: 2
---

# Importing or Exporting Files

## Importing External Files

### JSON

You can import files in the schema format defined in the editor.

<img src="/img/import-json.png" width="400" />

### Schema SQL

You can also import schema files defined in SQL.  
Although parsers have been made as flexible as possible regardless of the database vendor, there might be some unsupported syntax.  
[Supported syntax can be checked here.](https://github.com/dineug/erd-editor/blob/main/packages/schema-sql-parser/src/schema_sql_test_case.md)

<img src="/img/import-sql.png" width="400" />

## Exporting

Three formats are supported for exporting:

- JSON: Schema file defined in the editor.
- Schema SQL: Schema file generated based on the syntax of the database vendor.
- PNG: Generates the diagram as an image.

<img src="/img/export-menu.png" width="400" />
