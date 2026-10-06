# ERD Editor

> Entity-Relationship Diagram Editor for Visual Studio Code

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

Design a database schema visually, right next to your code. Diagrams are plain JSON files in
your repository, so they diff and review like any other source file.

The editor never connects to a database — it reads and writes files only. You bring a schema
in from a `.sql` dump or a GraphQL SDL file, and take one back out as DDL.

## Getting started

Create an empty file with a `.erd.json` extension and open it in VS Code. The
diagram opens in the ERD Editor by default.

Editing marks the tab dirty like any other file; the diagram is written to disk when you save.
Undo and redo are the diagram editor's own history, not VS Code's.

On the empty canvas, `Alt`+`N` adds a table and `Alt`+`Enter` adds a column to it. To start
from a schema you already have, right-click the canvas and choose **Import → Schema SQL**
for a `.sql` dump, or **Import → GraphQL** for a `.graphql`, `.gql` or `.graphqls` file.
Either one replaces the diagram in one undoable step, its tables laid out by their relationships.
**Import and Add** beside it takes the same formats and adds the file to the diagram instead,
its tables placed as new ones below the ones already there, in one undoable step.

Use the icon in the editor title bar to switch between the diagram and its JSON source — hold
`Alt` while clicking to open the other view to the side instead. These are title-bar actions
only; they do not appear in the Command Palette.

## Features

- **Visual schema design** — tables, columns, memos, and four relationship cardinalities
  (zero-one, zero-N, one-only, one-N)
- **Link existing columns** — while you draw a relationship, the buttons beside the table it
  ends on either map the parent's key onto columns that table already has or add new ones, and
  Map Columns in a relationship's right-click menu changes its columns later
- **SQL DDL import** — bring in a `.sql` dump from any of the seven vendors below. The parser
  reads `CREATE TABLE`, `CREATE INDEX` and `ALTER TABLE` constraints and skips what it does
  not recognize, so an awkward dump imports partially rather than failing outright
- **GraphQL SDL import** — bring in a schema from any tool that emits SDL. Object types
  become tables, scalars map to the diagram's own dialect, and the fields pointing at another
  type become the relationships; the generated types an API layer wraps its rows in are left
  out rather than drawn as tables
- **DBML import** — bring in a `.dbml` file written for dbdiagram.io or dbdocs.io, or emitted
  by `sql2dbml` or `prisma-dbml-generator`. Tables, columns, indexes, enums, header colors and
  every `Ref` spelling arrive; a `Project`, `TableGroup` or sticky `Note` is skipped rather than
  refused
- **AML import** — bring in an `.aml` file written for [Azimutt](https://azimutt.app), in either
  the v2 or the legacy v1 spelling. Entities, attributes, indexes, enums, colors and every
  relation arrow arrive; a check, a struct type and a view are skipped rather than refused
- **Import and Add** — add a `.sql`, GraphQL, DBML, AML or `.erd.json` file to the diagram
  rather than replacing it: its tables arrive below the ones already there, which stay where
  they are, and one undo takes them away. A foreign key to a table outside the file is dropped
- **SQL DDL export** — Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake, SQLite
- **Code generation** — TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go,
  SQLAlchemy, TypeORM, Sequelize, Drizzle, DBML, AML, Mermaid
- **Visualization** — a force-directed view of how the tables actually relate
- **Export** — `.erd.json`, `.sql`, and a `.png` or `.svg` from a dialog with a preview:
  transparent background, light or dark, the PNG at 1x to 3x or copied to the clipboard instead
- **Quick search** — `Ctrl`/`Cmd`+`K` to run any editor command, or to jump to a table after `#`,
  a column after `@`, and a comment or memo after `:`
- **Find and replace** — `Ctrl`/`Cmd`+`F` across table and column names, comments and memos,
  with match case, whole word and regular expressions; one undo takes back a Replace All
- **Time travel** — replay this editing session's history on the canvas and jump to any point in it
- **Display language** — the editor's menus, dialogs and panels in 25 languages, with Arabic,
  Hebrew and Persian laid out right to left while the diagram stays left to right. It follows VS
  Code's display language until you pick one from the language button in the toolbar or
  **Display Language** in `Ctrl`/`Cmd`+`K`
- **Welcome guide** — an empty diagram shows where to start: New Table, New Memo, Import, the
  command palette and the shortcuts, with hints pointing at the toolbar's search, theme and
  language buttons and at the floating toolbar. The first table or memo takes it away
- **Undo / redo** and a built-in theme builder

### Keeping diffs clean

The canvas scroll position and zoom level, the open tab and the code generator's language, name
cases and quotes are locked in every document: the file keeps the values they had when locked, so
panning around or switching tabs never shows up in `git diff`. The editor's settings list each
under **Lock** with the value the file keeps. Unlock the viewport for a document that should open
where you left it, or unlock and lock it again to fix a new starting view. Files saved before the
locks open with all of them on, their scroll, zoom and tab at the start.

### Multiple editors per document

The same document can be open in several editors at once, and they stay in sync.

![multiple editors per document](https://github.com/dineug/erd-editor/blob/main/img/supports-multiple-editors-per-document.webp?raw=true)

## Coding agents

A coding agent such as Claude Code or Codex can edit the diagrams open in this window through the
[`@dineug/erd-editor-mcp`](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme)
MCP server. The agent joins the editor like a collaborator: each change shows up on the canvas as
it happens and stays unsaved until the agent or you save, and the agent's undo reverts only its
own edits.

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

### Edit with an agent

1. Open the project folder in VS Code and trust the workspace.
2. Start the agent in the same folder and ask in plain words, for example _"Add a reviews table to
   schema.erd.json, related to users and products"_.
3. Watch the change land on the canvas, then save with `Ctrl`/`Cmd`+`S`, or ask the agent to save.

A diagram that is not open yet opens in the ERD Editor on the agent's first edit. With no editor
on the document's folder, a VS Code window, an Obsidian vault window or a JetBrains IDE with the
ERD Editor extension or plugin, the agent edits the file on disk instead.

The agent connects only in a trusted workspace, and the `dineug.erd-editor.agentHub.enabled`
setting turns it off for the window. Either way it can still read the diagrams from disk, but it
never writes one behind the editor, where your next save would overwrite the change. The
[MCP documentation](https://docs.erd-editor.io/docs/mcp/tools) lists every tool with its
arguments.

## Settings

| Setting | Default | Values |
| --- | --- | --- |
| `dineug.erd-editor.theme.appearance` | `auto` | `auto`, `light`, `dark` |
| `dineug.erd-editor.theme.grayColor` | `slate` | `gray`, `mauve`, `slate`, `sage`, `olive`, `sand` |
| `dineug.erd-editor.theme.accentColor` | `indigo` | 26 [Radix](https://www.radix-ui.com/colors) accents — `gray`, `gold`, `bronze`, `brown`, `yellow`, `amber`, `orange`, `tomato`, `red`, `ruby`, `crimson`, `pink`, `plum`, `purple`, `violet`, `iris`, `indigo`, `blue`, `cyan`, `teal`, `jade`, `green`, `grass`, `lime`, `mint`, `sky` |
| `dineug.erd-editor.locale` | `auto` | `auto`, or one of 25 languages, each listed by its own name — `en`, `id-ID`, `de-DE`, `es-ES`, `eu-ES`, `fr-FR`, `it-IT`, `nl-NL`, `pl-PL`, `pt-PT`, `pt-BR`, `ro-RO`, `sk-SK`, `sl-SI`, `sv-SE`, `tr-TR`, `ru-RU`, `uk-UA`, `he-IL`, `ar-SA`, `fa-IR`, `ja-JP`, `zh-CN`, `zh-TW`, `ko-KR` |
| `dineug.erd-editor.agentHub.enabled` | `true` | `true`, `false` |

Changing any of the three theme settings re-themes every open diagram immediately. `auto`
follows your VS Code color theme and switches with it.

The theme builder inside the editor changes these same three values and writes them back
here, so a theme you pick on the canvas persists. Its System is `auto`, and picking a color
there keeps the appearance as it is. **Theme** in `Ctrl`/`Cmd`+`K` picks System, Light or Dark
the same way.

`dineug.erd-editor.locale` sets the language of the editor itself; table and column names, SQL
keywords, data types and generated code stay as they are. `auto` follows VS Code's display
language (**Configure Display Language**), and shows English when the editor has no translation
for it. Changing the setting switches every open diagram immediately. The language button in the
editor's toolbar and **Display Language** in `Ctrl`/`Cmd`+`K` write the language you pick back
here; their System is `auto`.

## Documentation

- [Editing Guide](https://docs.erd-editor.io/docs/category/guides) — editing, import and
  export, relationships, quick search, visualization, code generation, settings
- [MCP](https://docs.erd-editor.io/docs/mcp/introduction) — installing the MCP server, live and
  headless editing, every tool
- [Documentation](https://docs.erd-editor.io)

## Also available

- [Web app](https://erd-editor.io) — installable PWA with real-time collaboration
- [Google Drive app](https://workspace.google.com/marketplace/app/erd_editor/428467403360) — open
  and save diagrams in Google Drive
- [IntelliJ plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor)
- [Obsidian plugin](https://community.obsidian.md/plugins/erd-editor)
- [`@dineug/erd-editor`](https://www.npmjs.com/package/@dineug/erd-editor) — the editor as a
  custom element for your own app

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE) © SeungHwan-Lee
