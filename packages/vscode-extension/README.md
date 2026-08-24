# ERD Editor

> Entity-Relationship Diagram Editor for Visual Studio Code

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

Design a database schema visually, right next to your code. Diagrams are plain JSON files in
your repository, so they diff and review like any other source file.

The editor never connects to a database — it reads and writes files only. You bring a schema
in from a `.sql` dump, and take one back out as DDL.

## Getting started

Create an empty file with a `.erd.json` extension and open it in VS Code. The
diagram opens in the ERD Editor by default.

Editing marks the tab dirty like any other file; the diagram is written to disk when you save.
Undo and redo are the diagram editor's own history, not VS Code's.

On the empty canvas, `Alt`+`N` adds a table and `Alt`+`Enter` adds a column to it. To start
from a schema you already have, right-click the canvas and choose **Import → Schema SQL**,
then pick a `.sql` dump.

Use the icon in the editor title bar to switch between the diagram and its JSON source — hold
`Alt` while clicking to open the other view to the side instead. These are title-bar actions
only; they do not appear in the Command Palette.

## Features

- **Visual schema design** — tables, columns, memos, and four relationship cardinalities
  (zero-one, zero-N, one-only, one-N)
- **SQL DDL import** — bring in a `.sql` dump from any of the seven vendors below. The parser
  reads `CREATE TABLE`, `CREATE INDEX` and `ALTER TABLE` constraints and skips what it does
  not recognize, so an awkward dump imports partially rather than failing outright
- **SQL DDL export** — Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, SQLite
- **Code generation** — TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go,
  SQLAlchemy, TypeORM, Sequelize, Drizzle
- **Visualization** — a force-directed view of how the tables actually relate
- **Export** — `.erd.json`, `.sql`, `.png`
- **Quick search** — `Ctrl`/`Cmd`+`K` to jump to any table, or run any editor command
- **Time travel** — replay this editing session's history on the canvas and jump to any point in it
- **Undo / redo** and a built-in theme builder

### Keeping diffs clean

By default the document also stores the canvas scroll position and zoom level, so panning
around shows up in `git diff`. Turn off **Save Scroll Information** and **Save Zoom
Information** in the editor's settings to keep diffs limited to schema changes.

### Multiple editors per document

The same document can be open in several editors at once, and they stay in sync.

![multiple editors per document](https://github.com/dineug/erd-editor/blob/main/img/supports-multiple-editors-per-document.webp?raw=true)

## Settings

| Setting | Default | Values |
| --- | --- | --- |
| `dineug.erd-editor.theme.appearance` | `dark` | `auto`, `light`, `dark` |
| `dineug.erd-editor.theme.grayColor` | `slate` | `gray`, `mauve`, `slate`, `sage`, `olive`, `sand` |
| `dineug.erd-editor.theme.accentColor` | `indigo` | 26 [Radix](https://www.radix-ui.com/colors) accents — `gray`, `gold`, `bronze`, `brown`, `yellow`, `amber`, `orange`, `tomato`, `red`, `ruby`, `crimson`, `pink`, `plum`, `purple`, `violet`, `iris`, `indigo`, `blue`, `cyan`, `teal`, `jade`, `green`, `grass`, `lime`, `mint`, `sky` |

Changing any of these re-themes every open diagram immediately. `auto` follows your VS Code
color theme and switches with it; note that the default is `dark` whichever theme you use.

The theme builder inside the editor changes these same three values and writes them back
here, so a theme you pick on the canvas persists.

## Documentation

- [Editing Guide](https://docs.erd-editor.io/docs/category/guides) — editing, import and
  export, relationships, quick search, visualization, code generation, settings
- [Documentation](https://docs.erd-editor.io)

## Also available

- [Web app](https://erd-editor.io) — installable PWA with real-time collaboration
- [IntelliJ plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor)
- [`@dineug/erd-editor`](https://www.npmjs.com/package/@dineug/erd-editor) — the editor as a
  custom element for your own app

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE) © SeungHwan-Lee
