# ERD Editor

> Entity-Relationship Diagram Editor for Obsidian

![ERD Editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-obsidian.png?raw=true)

Design a database schema visually, right inside your vault. Diagrams are plain JSON files next to
your notes, so they sync and back up like everything else in the vault, and the editor never
connects to a database. Desktop only.

## Installation

In Obsidian, open **Settings → Community plugins**, choose **Browse**, search for **ERD Editor**
([listing](https://community.obsidian.md/plugins/erd-editor)), then select **Install** and
**Enable**.

To install by hand, download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/dineug/erd-editor-obsidian-plugin/releases/latest) into
`.obsidian/plugins/erd-editor` in your vault, then enable **ERD Editor** in
**Settings → Community plugins**.

## Getting started

1. Run **ERD Editor: Create new diagram** from the command palette, or right-click a folder and
   choose **New ERD**. Either one creates an `.erd` file and opens it.
2. Add a table with `Alt`+`N` and a column with `Alt`+`Enter`, or right-click the canvas and choose
   **Import** to start from a `.sql`, GraphQL, DBML or AML file.
3. Obsidian saves the diagram as it saves a note, about two seconds after you stop editing.

`.erd` files show up in the file explorer. `.erd.json` files open from links, and the file explorer
lists them once **Settings → Files and links → Detect all file extensions** is on. A file the editor
cannot read, such as one left with merge conflict markers, opens read-only and is never replaced.

## Features

- **Design** — tables, columns, memos and table groups, four relationship cardinalities, ON DELETE
  and ON UPDATE, alternate keys, Auto Layout
- **Naming standards** — logical and physical names, physical names and data types derived from
  word, term and domain dictionaries, which have their own tab with CSV import and export and checks
- **Import** — SQL DDL, GraphQL SDL, DBML and AML, replacing the diagram or adding to it
- **Export** — DDL for eight databases, code in 22 languages and ORMs, PNG and SVG
- **Navigate** — command palette (`Ctrl`/`Cmd`+`K`), an Explorer tree with find and replace, Graph
  and Flow views
- **History** — undo and redo, time travel through the session, a diff viewer against another file
- **25 languages** and a System, Light or Dark theme, following Obsidian by default
- **Coding agents** — Claude Code or Codex edits the diagram live on the canvas
  ([below](#coding-agents))
- **Split panes** — the same diagram open in several panes stays in sync; popout windows are not
  supported

**Databases:** Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake, SQLite

**Code:** TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go, SQLAlchemy, TypeORM, Sequelize,
Drizzle, DBML, AML, Mermaid, PHP, Doctrine, Rust, SeaORM, Swift, Zod, JSON Schema

Every feature step by step: the [Editing Guide](https://docs.erd-editor.io/docs/category/guides).

## Coding agents

A coding agent such as Claude Code or Codex edits the diagrams in your vault through the
[ERD Editor MCP server](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme).
Each change shows up on the canvas as it happens, and the agent's undo reverts only its own edits.

Add it with one command, in your vault folder (Node.js 22.12 or later):

```sh
# Claude Code
claude mcp add --transport stdio erd-editor -- npx -y @dineug/erd-editor-mcp
# Codex
codex mcp add erd-editor -- npx -y @dineug/erd-editor-mcp
```

Then start the agent in the vault folder and ask, for example _"Add a reviews table to schema.erd,
related to users and products"_. Name new diagrams with `.erd` so the file explorer lists them.
Other clients and the tool list are in the
[MCP server's README](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme).

**Settings → ERD Editor → Coding agents**, on by default, turns the connection off for the vault;
the agent can then read the diagrams but never writes them. Obsidian installed from Flathub runs in
a sandbox the MCP server cannot reach, so there the agent edits the files on disk, and an edit you
have not saved yet gives way to the agent's.

### Files outside the vault

The plugin makes no network requests and sends no telemetry. Its one connection is local, from an
MCP server on this computer, through a socket file or named pipe, never a network port. With
**Coding agents** on, each vault window writes two files in your home folder, outside the vault:

- `~/.erd-editor/ide/<pid>.json` — a lock file, readable by your user account only, naming the vault
  folder, the diagrams open in the window and a random token the MCP server must present,
  rewritten as diagrams open and close
- `~/.erd-editor/ide/<pid>.sock` — the socket the MCP server connects to (a named pipe on Windows,
  or in the system temporary folder when the home folder path is too long)

Both are removed when the window closes, Obsidian quits or the plugin is turned off, and a reload
replaces them. A starting window also removes those left by windows that have exited, as VS Code and
JetBrains IDEs do in the same folder.
With **Coding agents** off, the window keeps only the lock file, so an agent still knows not to write
behind the editor. A window in a Flatpak sandbox writes and removes none of these files.

## Settings

**Settings → ERD Editor**, kept per vault:

| Setting | Default | Values |
| --- | --- | --- |
| **Appearance** | Auto | Auto, Light, Dark |
| **Gray color** | Slate | Gray, Mauve, Slate, Sage, Olive, Sand |
| **Accent color** | Indigo | 26 accents |
| **Display language** | Auto | Auto, or one of 25 languages by its own name |
| **Coding agents** | on | on, off |

Auto follows Obsidian's theme and language. The editor's theme builder and language button change
these same settings. The plugin's own settings and notices stay in English.

## Documentation

- [Editing Guide](https://docs.erd-editor.io/docs/category/guides) — every editor feature
- [MCP](https://docs.erd-editor.io/docs/mcp/introduction) — the MCP server and its tools
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
