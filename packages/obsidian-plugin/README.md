# ERD Editor

> Entity-Relationship Diagram Editor for Obsidian

![ERD Editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-obsidian.png?raw=true)

Design a database schema visually, right inside your vault. Diagrams are plain JSON files in your
vault, next to your notes, so they sync, diff and back up like everything else in the vault.

The editor never connects to a database: it reads and writes your diagram files. You bring a schema
in from a `.sql` dump or a GraphQL SDL, DBML or AML file, and take one back out as DDL or generated
code.

Desktop only.

## Installation

In Obsidian, open **Settings → Community plugins**, turn on community plugins if asked, choose
**Browse**, search for **ERD Editor** ([listing](https://community.obsidian.md/plugins/erd-editor)),
then select **Install** and **Enable**.

To install by hand instead, download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/dineug/erd-editor-obsidian-plugin/releases/latest) into a folder
named `erd-editor` under your vault's `.obsidian/plugins`, then turn on **ERD Editor** in
**Settings → Community plugins**.

## Getting started

Run **ERD Editor: Create new diagram** from Obsidian's command palette, or right-click a folder in
the file explorer and choose **New ERD**. Either one creates an empty `.erd` file and opens it in
the diagram view.

An empty diagram you can edit opens on the welcome screen, a menu of New Table, New Memo, Import,
Command Palette and Shortcuts, which stays until its first table, shown memo or shown table group.
`Alt`+`N` adds a table and `Alt`+`Enter` adds a column to it; `Delete` or `Backspace` removes the
selection, and `Alt`+`K` toggles the primary key on the focused column.

To start from a schema you already have, right-click the canvas and choose **Import**, then **Schema
SQL** for a `.sql` dump, **GraphQL** for a `.graphql`, `.gql` or `.graphqls` file, **DBML** for a
`.dbml` file or **AML** for an `.aml` file; **json** opens an `.erd.json` file as it was saved, and
takes no `.erd` file. Each one replaces the diagram in one undoable step, a schema's tables laid out
by their relationships. **Import and Add** beside it takes the same five and adds the file to the
diagram instead, its tables placed as new ones below everything already there, in one undoable step.
The diagrams **Create new diagram** and **New ERD** make are `.erd` files, so to import or compare
one, use a copy renamed to `.erd.json`.

Obsidian saves a diagram the way it saves a note: about two seconds after you stop editing, and
when you close the tab or quit. Opening a file never rewrites it. Undo and redo are the diagram
editor's own history.

### Files

- `.erd` files show up in the file explorer and open in the diagram view.
- `.erd.json` files open in the diagram view from links. Obsidian reads their extension as `json`,
  so the file explorer and the quick switcher leave them out; turn on
  **Settings → Files and links → Detect all file extensions** and both list them and open them in
  the diagram view.
- A file the editor cannot read, such as one left with merge conflict markers or cut off by a
  sync, opens read-only and is left as it is rather than replaced by an empty diagram.

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
- **Imports land laid out** — a schema picked from the Import menu or the editor's command palette
  arrives with its tables placed by their relationships (in rows when it has none), and one undo
  puts the previous diagram back
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
  column name cases and, for Doctrine, JPA and SeaORM, the bracket type, and saves the code into the
  vault where your attachments go, with the language's extension
- **Export** — `.erd.json`, `.sql`, `.png` and `.svg`, written into the vault where your attachments
  go (the file explorer lists an `.erd.json` file only with Detect all file extensions on, see
  [Files](#files)); the images from a dialog with a preview: transparent background, light or dark,
  the PNG at 1x to 3x or copied to the clipboard instead

### Find and navigate

- **Quick search** — `Ctrl`/`Cmd`+`K` opens the editor's command palette to run editor commands (new
  table, import, export, Auto Layout, tabs, theme, language and more), or to jump to a table after
  `#`, a column after `@`, and a comment or memo after `:`; Korean also matches by its initial
  consonants (`ㅅㅇㅈ` finds 사용자)
- **Explorer** — the toolbar's Explorer button docks a tree of the tables, with their columns,
  indexes and foreign keys, the table groups and the memos beside the canvas, and a click goes to
  what a row stands for; `Ctrl`/`Cmd`+`F` searches it, table, column, index and group names,
  comments and memos, with match case, whole word, regular expressions and Preserve Case, and one
  undo takes back a Replace All
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
- **Diff viewer** — compare the diagram with another `.json` file from the canvas menu: a tree
  lists what was added, changed, removed or renamed, and both panes mark it on the canvas; an `.erd`
  diagram goes in as a copy renamed to `.erd.json`
- **Undo / redo** — every edit, from the toolbar or `Ctrl`/`Cmd`+`Z` and `Ctrl`/`Cmd`+`Shift`+`Z`,
  in the editor's own history

### Language and theme

- **Display language** — the editor's menus, panels, dialogs, command palette and messages in 25
  languages, Arabic, Hebrew and Persian laid out right to left while the diagram stays left to
  right. Pick one from the toolbar's language button or **Display Language** in the editor's command
  palette, or System, the default, which follows Obsidian's language (English where the editor has
  no translation), and the vault keeps the pick (see [Settings](#settings)); table and column names,
  SQL keywords, data types and generated code stay as they are, and the plugin's own settings and
  notices stay in English
- **Theme** — the toolbar's theme builder picks the appearance (System, Light or Dark), a gray color
  and an accent color, and **Theme** in the editor's command palette picks the appearance; System,
  the default, follows Obsidian's light or dark theme and switches with it, and a pick is kept per
  vault (see [Settings](#settings))
- **Welcome screen** — an empty diagram you can edit opens on a menu of New Table, New Memo, Import,
  Command Palette and Shortcuts, with arrows at the toolbar's search, theme and language buttons and
  at the floating toolbar where the canvas has room, until its first table, shown memo or shown
  table group

### Collaboration and coding agents

- **Coding agents** — Claude Code, Codex or any other MCP client edits your diagrams through the ERD
  Editor MCP server, live on the canvas as one more collaborator; [Coding agents](#coding-agents)
  below says how

### Keeping diffs clean

The canvas scroll position and zoom level, the open tab (**Canvas Type** in the Lock list), the code
generator's language and name cases, and the bracket type are locked in every diagram by default:
the file keeps the values they had when locked, so panning around or switching tabs never changes
it, and a git history of the vault stays limited to the schema. The editor's Settings tab lists
each under **Lock** with the value the file keeps. Unlock the viewport for a diagram that should
open where you left it, or unlock and lock it again to fix a new starting view. Files saved before
the locks open with all of them on, their scroll, zoom and tab at the start.

The file holds only what the diagram is: its tables, columns, relationships, indexes, memos, table
groups and settings, written in a fixed order, without the measured widths, connector anchors,
stacking order or deleted items the editor keeps while it is open. Opening a diagram and closing it
without an edit leaves the file as it was, and an edit made on any device, with any fonts, changes
only the parts it touches. A file an earlier release of ERD Editor saved is rewritten in this form
once, on its first edit.

### Split panes

The same diagram can be open in several panes at once, and they stay in sync as you edit in any of
them. Keep it in the main window: popout windows are not supported.

## Coding agents

A coding agent such as Claude Code or Codex can edit the diagrams in your vault through the
[`@dineug/erd-editor-mcp`](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme)
MCP server. The agent joins the editor like a collaborator: each change shows up on the canvas as it
happens, and the agent's undo reverts only its own edits.

### Install the MCP server

The server needs Node.js 22.12 or later. `npx` downloads it the first time the agent starts it, so
there is nothing else to install.

**Claude Code** — run in your vault folder:

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
vault folder: it resolves relative document paths against its working directory.

Keep ERD Editor and the MCP server up to date together. When one speaks an older hub protocol than
the other, the server refuses to connect and says which one to update.

### Edit with an agent

1. Open the vault in Obsidian with the plugin turned on.
2. Start the agent in the vault folder and ask in plain words, for example _"Add a reviews table to
   schema.erd, related to users and products"_. Name new diagrams with `.erd` so the file explorer
   lists them; the agent picks `.erd.json` when you give no extension.
3. Watch the change land on the canvas. Obsidian saves it about two seconds later, as it saves your
   own edits; asking the agent to save writes it at once.

A diagram that is not open yet opens in a background tab as soon as the agent opens or edits it,
without taking focus from what you are working on. With no VS Code window, Obsidian vault window or
JetBrains IDE running ERD Editor that has the document open, or has open the folder, vault or
project that holds it, the agent edits the file on disk instead. A vault window counts only while
the plugin is enabled; with **Coding agents** turned off, the agent's writes are refused instead
(see the next paragraph).

**Settings → ERD Editor → Coding agents**, on by default, turns the connection off for the vault.
The agent can still read the diagrams from disk, but it never writes one behind the editor, where
the next save would overwrite the change. The
[MCP server's README](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#tools)
lists the tools.

Obsidian installed from Flathub runs in a Flatpak sandbox, which the MCP server cannot reach, so its
windows never serve the agent, and the agent edits the files on disk unless an editor outside the
sandbox, such as a VS Code window, has the document or a folder that holds it open. Obsidian picks
the change up as it picks up any change made outside it, and an edit of yours it has not saved yet
gives way to the agent's. The plugin says so each time the vault opens, until you turn off
**Coding agents**.

### Files outside the vault

The plugin makes no network requests and sends no telemetry. The one connection it accepts is local
inter-process communication from an MCP server on this computer, through a socket file or named
pipe, never a network port. With **Coding agents** on, which is the default, each vault window lets
that server find it through two files in your home folder, outside the vault:

- `~/.erd-editor/ide/<pid>.json` — a lock file, readable by your user account only, naming the vault
  folder, the diagrams open in the window and a random token the MCP server must present. It is
  rewritten as diagrams open and close.
- `~/.erd-editor/ide/<pid>.sock` — the local socket the MCP server connects to (a named pipe on
  Windows; in the system temporary folder when the home folder path is too long for a socket).

Both are removed when the window closes or Obsidian quits, and when the plugin is turned off; a
reload of the window replaces them. A window that starts also removes the ones windows that have
exited left behind, as the ERD Editor extension for VS Code and the ERD Editor plugin for JetBrains
IDEs do in the same folder. With **Coding agents** off, the window keeps only the lock file, with no
socket, so an agent still knows not to write the vault's diagrams behind the editor. A window in a
Flatpak sandbox writes none of these files and removes none.

## Settings

**Settings → ERD Editor**, kept per vault:

| Setting | Default | Values |
| --- | --- | --- |
| **Appearance** | Auto | Auto, Light, Dark |
| **Gray color** | Slate | Gray, Mauve, Slate, Sage, Olive, Sand |
| **Accent color** | Indigo | 26 [Radix](https://www.radix-ui.com/colors) accents — Gray, Gold, Bronze, Brown, Yellow, Amber, Orange, Tomato, Red, Ruby, Crimson, Pink, Plum, Purple, Violet, Iris, Indigo, Blue, Cyan, Teal, Jade, Green, Grass, Lime, Mint, Sky |
| **Display language** | Auto | Auto, then the 25 languages by their own names, in the editor's picker order: Bahasa Indonesia, Deutsch, English, Español, Euskara, Français, Italiano, Nederlands, Polski, Português, Português Brasileiro, Română, Slovenčina, Slovenščina, Svenska, Türkçe, Русский, Українська, עברית, العربية, فارسی, 日本語, 简体中文, 繁體中文, 한국어 |
| **Coding agents** | on | on, off — on, coding agents edit this vault's diagrams live through the MCP server; off, they can still read the files but write none (see [Coding agents](#coding-agents)) |

Changing any of the three theme settings re-themes every open diagram immediately. Auto follows
Obsidian's light or dark theme and switches with it.

The theme builder in the editor's toolbar changes these same three values and saves them here, so a
theme you pick in the editor persists. Its System is Auto: picking a color there keeps the
appearance as it is, and Light, Dark or System sets it. **Theme** in the editor's command palette
(`Ctrl`/`Cmd`+`K`) picks System, Light or Dark the same way.

Changing **Display language** changes every open diagram immediately. Auto follows the language
Obsidian shows, and English stands in for one the editor does not offer. The language button in
the editor's toolbar and **Display Language** in that palette (`Ctrl`/`Cmd`+`K`) change this same
setting and save it here; their System is Auto. The plugin's own settings and notices stay in
English.

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
- [VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)
- [IntelliJ plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor)
- [`@dineug/erd-editor`](https://www.npmjs.com/package/@dineug/erd-editor) — the editor as a custom
  element for your own app
- [`@dineug/erd-editor-mcp`](https://www.npmjs.com/package/@dineug/erd-editor-mcp) — the MCP server
  coding agents edit diagrams through

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues). The
plugin's source lives in the [erd-editor](https://github.com/dineug/erd-editor) monorepo, in
`packages/obsidian-plugin`.

## License

[MIT](LICENSE) © SeungHwan-Lee
