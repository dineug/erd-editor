# ERD Editor

> Entity-Relationship Diagram Editor for Visual Studio Code

![ERD Editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

Design a database schema visually, right next to your code. Diagrams are plain JSON files in your
repository, so they diff and review like any other source file.

The editor never connects to a database: it reads and writes your diagram files. You bring a schema
in from a `.sql` dump or a GraphQL SDL, DBML or AML file, and take one back out as DDL or generated
code.

## Getting started

Create an empty file with a `.erd.json` extension and open it in VS Code. It opens in ERD Editor by
default.

An empty diagram you can edit opens on the welcome screen, a menu of New Table, New Memo, Import,
Command Palette and Shortcuts, which stays until its first table, memo or shown table group.
`Alt`+`N` adds a table and `Alt`+`Enter` adds a column to it; `Delete` or `Backspace` removes the
selection, and `Alt`+`K` toggles the primary key on the focused column.

To start from a schema you already have, right-click the canvas and choose **Import**, then **Schema
SQL** for a `.sql` dump, **GraphQL** for a `.graphql`, `.gql` or `.graphqls` file, **DBML** for a
`.dbml` file or **AML** for an `.aml` file; **json** opens an `.erd.json` file as it was saved. Each
one replaces the diagram in one undoable step, a schema's tables laid out by their relationships.
**Import and Add** beside it takes the same five and adds the file to the diagram instead, its
tables placed as new ones below everything already there, in one undoable step.

Editing marks the tab dirty like any other file, and the diagram is written to disk when you save.
Undo and redo are the diagram editor's own history, not VS Code's.

Use the icon in the editor title bar to switch between the diagram and its JSON source — hold `Alt`
while clicking to open the other view to the side instead. These are title-bar actions only; they do
not appear in VS Code's Command Palette.

## Features

### Design

- **Visual schema design** — tables, columns, memos, and four relationship cardinalities (Zero One,
  Zero N, One Only, One N)
- **Quick edits** — `Alt`+`N` adds a table and `Alt`+`Enter` a column, `Alt`+`K` toggles the primary
  key on the focused column, or on every selected column when it is one of them, and `Delete` or
  `Backspace` removes the selection, each in one undo step; the Shortcuts page of the editor's
  Settings tab lists every key
- **Link existing columns** — while you draw a relationship with a mouse or a pen, the buttons
  beside the table it ends on either map the parent's key onto columns that table already has or add
  new ones, named after the parent table when the key is one word (`user_id` for `user`'s `id`), and
  **Map Columns** in a relationship's right-click menu changes its columns later
- **Referential actions** — set **On Delete** and **On Update** (NO ACTION, CASCADE, SET NULL, SET
  DEFAULT, RESTRICT) from a relationship's right-click menu, which marks one the current database
  leaves out; the line shows them at its child end as `D:C U:R`, and View Option's Referential
  Actions hides the labels. SQL, DBML and AML import read them, and the DDL export and the code
  generators that have a place for them write the ones the target supports
- **Alternate keys** — View Option's Alternate Key marks the columns of each unique index over two
  or more columns as `AK1.1`, `AK1.2`, and SQL import reads a UNIQUE over several columns as one
  such index
- **Table groups** — draw a box behind related tables, which you name and can color, with
  **New Table Group** in the canvas menu or the editor's command palette, or group the selected
  tables from their right-click menu. A table joins a group when you drop it inside and leaves when
  you drop it outside, dragging a group by its title moves its tables with it, each member's header
  takes the group's color, View Option hides the groups, and DBML import and the Code Generator's
  DBML carry them as `TableGroup`s
- **Auto Layout** — place every table again by Force, Flow or a vertical or horizontal tree from the
  canvas menu or the editor's command palette, table groups kept together, in one undo step; Force
  shows a preview you apply or cancel, and the others land at once
- **Copy, paste and colors** — copy tables and memos and paste them as new ones, into another
  diagram too or into a spreadsheet as a grid, hold `Alt` while dragging to duplicate them, and
  color a table, memo or table group from its right-click menu
- **Clean diffs** — the scroll position and zoom, the open tab, the code generator's language and
  name cases and the bracket type are locked by default, so the file keeps the values they had when
  locked and looking around never changes it; the file, written in a fixed order, also leaves out
  measured widths, connector anchors and removed items (see
  [Keeping diffs clean](#keeping-diffs-clean))

### Import

- **SQL DDL import** — bring in a `.sql` dump from any of the eight vendors below. The parser reads
  `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE` constraints and table and column comments
  (`COMMENT ON`, SQL Server's `sp_addextendedproperty`), and skips what it does not recognize, so an
  awkward dump imports partially rather than failing outright
- **GraphQL SDL import** — bring in a schema from any tool that emits SDL. Object types become
  tables, scalars map to the diagram's own dialect, and the fields that point at another type become
  the relationships; the root types and the wrapper types Relay, Federation and Hasura generate are
  left out rather than drawn as tables
- **DBML import** — bring in a `.dbml` file written for dbdiagram.io or dbdocs.io, or emitted by
  `sql2dbml` or `prisma-dbml-generator`. Tables, columns, indexes, enums, header colors, every `Ref`
  spelling and each `TableGroup` arrive; a `Project` or a sticky `Note` is skipped rather than
  refused
- **AML import** — bring in an `.aml` file written for [Azimutt](https://azimutt.app), in either the
  v2 or the legacy v1 spelling. Entities, attributes, indexes, enums, colors and every relation
  arrow arrive; a check and a struct type are skipped rather than refused, and a view arrives as a
  table
- **Imports land laid out** — a schema picked from the Import menu, the editor's command palette or
  a host's file dialog arrives with its tables placed by their relationships (in rows when it has
  none), and one undo puts the previous diagram back
- **Import and Add** — the menu beside Import, and its five formats in the editor's command palette,
  add a `.sql`, GraphQL, DBML, AML or `.erd.json` file to the diagram instead of replacing it: its
  tables arrive below everything already there, laid out the same way (an `.erd.json` file keeps its
  own placement), selected, and one undo takes them away. A table whose name is already taken
  arrives as a second table rather than merging, and a foreign key to a table outside the file is
  dropped

### Export and code

- **SQL DDL export** — Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake and SQLite,
  from the Schema SQL tab, which saves the DDL as a `.sql` file or copies it
- **Schema SQL options** — a panel beside the DDL picks the database and the bracket type, CREATE
  TABLE IF NOT EXISTS or drop and re-create and a `USE` or `CREATE + USE` header, each where the
  database has it, and the tables by table group, and keeps SQL of your own to write before and
  after the tables. The statements, header and tables stay with this editor until you close it and
  never reach the file; the scripts are saved in the document
- **Code generation** — TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go, SQLAlchemy, TypeORM,
  Sequelize, Drizzle, DBML, AML, Mermaid, PHP, Doctrine, Rust, SeaORM, Swift, Zod and JSON Schema,
  from the Code Generator tab. Its options panel picks the language, the database, the table and
  column name cases and, for Doctrine, JPA and SeaORM, the bracket type, and saves the code as a
  file with the language's extension
- **Export** — `.erd.json`, `.sql`, and a `.png` or `.svg` from a dialog with a preview: transparent
  background, light or dark, the PNG at 1x to 3x or copied to the clipboard instead

### Find and navigate

- **Quick search** — `Ctrl`/`Cmd`+`K` opens the editor's command palette to run editor commands (new
  table, import, export, Auto Layout, tabs, theme, language and more), or to jump to a table after
  `#`, a column after `@`, and a comment or memo after `:`; Korean also matches by its initial
  consonants (`ㅅㅇㅈ` finds 사용자)
- **Find and replace** — `Ctrl`/`Cmd`+`F` searches table and column names, comments and memos, with
  match case, whole word and regular expressions, and one undo takes back a Replace All
- **Visualization** — Graph mode draws a force-directed view of how the tables relate. Flow mode
  lays them out by their relationships, lights a table you hover and the tables it relates to, and
  shows names only, keys only or all fields; **Focus on this table** in a table's right-click menu
  opens Flow on that table and its neighbours, or, when it is one of several selected tables, as
  **Focus on selected tables** on all of them and their neighbours, as `Alt`+`F` does for the
  selection, and neither view writes its layout into the file
- **Zoom and pan** — pinch a trackpad or two fingers to zoom, drag with the middle button to pan
  from anywhere, and click the zoom level on the floating toolbar to go back to 100%
- **Time travel** — replay this editing session's history on the canvas and jump to any point in it,
  from the toolbar
- **Diff viewer** — compare the diagram with another `.json` file from the canvas menu
- **Undo / redo** — every edit, from the toolbar or `Ctrl`/`Cmd`+`Z` and `Ctrl`/`Cmd`+`Shift`+`Z`,
  in the editor's own history, not VS Code's

### Language and theme

- **Display language** — the editor's menus, panels, dialogs, command palette and messages in 25
  languages, Arabic, Hebrew and Persian laid out right to left while the diagram stays left to
  right. Pick one from the toolbar's language button or **Display Language** in the editor's command
  palette, or System, the default, which follows VS Code's display language (English where the
  editor has no translation), and the `dineug.erd-editor.locale` setting keeps the pick (see
  [Settings](#settings)); table and column names, SQL keywords, data types and generated code stay
  as they are
- **Theme** — the toolbar's theme builder picks the appearance (System, Light or Dark), a gray color
  and an accent color, and **Theme** in the editor's command palette picks the appearance; System,
  the default, follows whether your VS Code color theme is light or dark (a high contrast theme
  shows dark), and a pick is saved in the three `dineug.erd-editor.theme.*` settings (see
  [Settings](#settings))
- **Welcome screen** — an empty diagram you can edit opens on a menu of New Table, New Memo, Import,
  Command Palette and Shortcuts, with arrows at the toolbar's search, theme and language buttons and
  at the floating toolbar where the canvas has room, until its first table, memo or shown table
  group

### Collaboration and coding agents

- **Coding agents** — Claude Code, Codex or any other MCP client edits your diagrams through the ERD
  Editor MCP server, live on the canvas as one more collaborator; [Coding agents](#coding-agents)
  below says how

### Keeping diffs clean

The canvas scroll position and zoom level, the open tab (**Canvas Type** in the Lock list), the code
generator's language and name cases, and the bracket type are locked in every diagram by default:
the file keeps the values they had when locked, so panning around or switching tabs never shows up
in a diff. The editor's Settings tab lists each under **Lock** with the value the file keeps. Unlock
the viewport for a diagram that should open where you left it, or unlock and lock it again to fix a
new starting view. Files saved before the locks open with all of them on, their scroll, zoom and tab
at the start.

The file holds only what the diagram is: its tables, columns, relationships, indexes, memos, table
groups and settings, written in a fixed order, without the measured widths, connector anchors,
stacking order or deleted items the editor keeps while it is open. Opening a diagram and closing it
without an edit leaves the file as it was, and an edit made on any machine, with any fonts, changes
only the parts it touches. A file an earlier release of ERD Editor saved is rewritten in this form
once, on its first edit.

Source Control shows a changed diagram as a text diff of its JSON, and opens a revision Git holds,
such as a deleted file or a file in an earlier commit, as JSON text. So do Local History, Compare
with Saved, the edit review of VS Code's chat, GitHub Copilot and Claude Code, and the revision
views of GitLens, GitHub Pull Requests, GitLab Workflow, GitHub Repositories and Git Graph.
**Reopen Editor With…** shows a Git revision as a read-only diagram; a file Git does not track yet
opens in the editor as any other does.

### Multiple editors per document

The same document can be open in several editors at once, and they stay in sync.

![multiple editors per document](https://github.com/dineug/erd-editor/blob/main/img/supports-multiple-editors-per-document.webp?raw=true)

## Coding agents

A coding agent such as Claude Code or Codex can edit the diagrams in this window's workspace
through the
[`@dineug/erd-editor-mcp`](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme)
MCP server. The agent joins the editor like a collaborator: each change shows up on the canvas as it
happens and stays unsaved until the agent or you save (or VS Code's Auto Save does), and the agent's
undo reverts only its own edits.

![coding agents](https://github.com/dineug/erd-editor/blob/main/img/coding-agents.webp?raw=true)

### Install the MCP server

The server needs Node.js 22.12 or later. `npx` downloads it the first time the agent starts it, so
there is nothing else to install.

**Claude Code** — run in your project folder:

```sh
claude mcp add --transport stdio erd-editor -- npx -y @dineug/erd-editor-mcp
```

**Codex** — add to `~/.codex/config.toml`, or to `.codex/config.toml` in a trusted project:

```toml
[mcp_servers.erd-editor]
command = "npx"
args = ["-y", "@dineug/erd-editor-mcp"]
```

**Any other MCP client** — run `npx -y @dineug/erd-editor-mcp` as a stdio server. Start it in your
project folder: it resolves relative document paths against its working directory.

Keep ERD Editor and the MCP server up to date together. When one speaks an older hub protocol than
the other, the server refuses to connect and says which one to update.

### Edit with an agent

1. Open the project folder in VS Code and trust the workspace.
2. Start the agent in the same folder and ask in plain words, for example _"Add a reviews table to
   schema.erd.json, related to users and products"_.
3. Watch the change land on the canvas, then save with `Ctrl`/`Cmd`+`S`, or ask the agent to save.

A diagram that is not open yet opens in ERD Editor, in a tab of its own and without taking the
keyboard focus, as soon as the agent opens or edits it. With no VS Code window, Obsidian vault
window or JetBrains IDE running ERD Editor that has the document open, or has open the folder, vault
or project that holds it, the agent edits the file on disk instead.

The extension starts once the folder you open holds an `.erd.json` file, or once you open a diagram.
In a folder with none yet, open or create a diagram in VS Code first; otherwise the agent writes its
new diagram on disk, and it does not open in the editor.

The agent connects only in a trusted workspace, and the `dineug.erd-editor.agentHub.enabled`
setting turns it off for the window. Either way the agent can still read the diagrams from disk,
but it never writes one behind the editor, where the next save would overwrite the change. The
[MCP server's README](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#tools)
lists the tools.

## Settings

| Setting | Default | Values |
| --- | --- | --- |
| `dineug.erd-editor.theme.appearance` | `auto` | `auto`, `light`, `dark` |
| `dineug.erd-editor.theme.grayColor` | `slate` | `gray`, `mauve`, `slate`, `sage`, `olive`, `sand` |
| `dineug.erd-editor.theme.accentColor` | `indigo` | 26 [Radix](https://www.radix-ui.com/colors) accents — `gray`, `gold`, `bronze`, `brown`, `yellow`, `amber`, `orange`, `tomato`, `red`, `ruby`, `crimson`, `pink`, `plum`, `purple`, `violet`, `iris`, `indigo`, `blue`, `cyan`, `teal`, `jade`, `green`, `grass`, `lime`, `mint`, `sky` |
| `dineug.erd-editor.locale` | `auto` | `auto`, or one of 25 languages. The Settings editor lists each by its own name (English, Deutsch, 한국어), and settings.json takes its code: `en`, `id-ID`, `de-DE`, `es-ES`, `eu-ES`, `fr-FR`, `it-IT`, `nl-NL`, `pl-PL`, `pt-PT`, `pt-BR`, `ro-RO`, `sk-SK`, `sl-SI`, `sv-SE`, `tr-TR`, `ru-RU`, `uk-UA`, `he-IL`, `ar-SA`, `fa-IR`, `ja-JP`, `zh-CN`, `zh-TW`, `ko-KR` |
| `dineug.erd-editor.agentHub.enabled` | `true` | `true`, `false` |

Changing any of the three theme settings re-themes every open diagram immediately. `auto` follows
whether your VS Code color theme is light or dark and switches with it; a high contrast theme shows
the dark appearance, Light High Contrast included.

The theme builder inside the editor changes these same three values and writes them back here, so a
theme you pick in the editor persists. Its System is `auto`, and picking a color there keeps the
appearance as it is. **Theme** in `Ctrl`/`Cmd`+`K` picks System, Light or Dark the same way.

`dineug.erd-editor.locale` sets the language of the editor itself; table and column names, SQL
keywords, data types and generated code stay as they are. `auto` follows VS Code's display language
(**Configure Display Language**), and shows English when the editor has no translation for it.
Changing the setting switches every open diagram immediately. The language button in the editor's
toolbar and **Display Language** in `Ctrl`/`Cmd`+`K` write the language you pick back here; their
System is `auto`.

## Documentation

- [Editing Guide](https://docs.erd-editor.io/docs/category/guides) — editing, import and export,
  relationships, quick search, visualization, code generation, settings
- [MCP](https://docs.erd-editor.io/docs/mcp/introduction) — installing the MCP server, live and
  headless editing, the tools
- [Documentation](https://docs.erd-editor.io)

## Also available

- [Web app](https://erd-editor.io) — installable PWA with real-time collaboration
- [Google Drive app](https://workspace.google.com/marketplace/app/erd_editor/428467403360) — open
  and save diagrams in Google Drive
- [IntelliJ plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor)
- [Obsidian plugin](https://community.obsidian.md/plugins/erd-editor)
- [`@dineug/erd-editor`](https://www.npmjs.com/package/@dineug/erd-editor) — the editor as a custom
  element for your own app
- [`@dineug/erd-editor-mcp`](https://www.npmjs.com/package/@dineug/erd-editor-mcp) — the MCP server
  coding agents edit diagrams through

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE) © SeungHwan-Lee
