# ERD Editor

> Entity-Relationship Diagram Editor for Visual Studio Code

![ERD Editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

Design a database schema visually, right next to your code. Diagrams are plain `.erd.json` files in
your repository, and the editor never connects to a database.

## Getting started

1. Create an empty file with a `.erd.json` extension and open it. It opens in ERD Editor.
2. Add a table with `Alt`+`N` and a column with `Alt`+`Enter`, or right-click the canvas and choose
   **Import** to start from a `.sql`, GraphQL, DBML or AML file.
3. Save as you save any file. Undo and redo are the diagram's own history, not VS Code's.

The icon in the editor title bar switches between the diagram and its JSON source; hold `Alt` to
open the other view to the side. Source Control shows a changed diagram as a JSON text diff.

## Features

- **Design** — tables, columns, memos and table groups, four relationship cardinalities, ON DELETE
  and ON UPDATE, alternate keys, Auto Layout
- **Import** — SQL DDL, GraphQL SDL, DBML and AML, replacing the diagram or adding to it
- **Export** — DDL for eight databases, code in 22 languages and ORMs, PNG and SVG
- **Navigate** — command palette (`Ctrl`/`Cmd`+`K`), an Explorer tree with find and replace, Graph
  and Flow views
- **History** — undo and redo, time travel through the session, a diff viewer against another file
- **25 languages** and a System, Light or Dark theme, following VS Code by default
- **Coding agents** — Claude Code or Codex edits the diagram live on the canvas
  ([below](#coding-agents))

**Databases:** Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake, SQLite

**Code:** TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go, SQLAlchemy, TypeORM, Sequelize,
Drizzle, DBML, AML, Mermaid, PHP, Doctrine, Rust, SeaORM, Swift, Zod, JSON Schema

Every feature step by step: the [Editing Guide](https://docs.erd-editor.io/docs/category/guides).

## Coding agents

A coding agent such as Claude Code or Codex edits the diagrams in your workspace through the
[ERD Editor MCP server](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme).
Each change shows up on the canvas as it happens and stays unsaved until you, Auto Save or the agent
saves it, and the agent's undo reverts only its own edits.

![coding agents](https://github.com/dineug/erd-editor/blob/main/img/coding-agents.webp?raw=true)

For Claude Code, run in your project folder (Node.js 22.12 or later):

```sh
claude mcp add --transport stdio erd-editor -- npx -y @dineug/erd-editor-mcp
```

Then trust the workspace, start the agent in the same folder and ask, for example _"Add a reviews
table to schema.erd.json, related to users and products"_. In a folder with no `.erd.json` file
yet, create one in VS Code first, or the agent's new diagram stays on disk without opening.

The `dineug.erd-editor.agentHub.enabled` setting turns the connection off for the window; the agent
can then read the diagrams but never writes them. Codex, other clients and the tool list are in the
[MCP server's README](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme).

## Settings

| Setting | Default | Values |
| --- | --- | --- |
| `dineug.erd-editor.theme.appearance` | `auto` | `auto`, `light`, `dark` |
| `dineug.erd-editor.theme.grayColor` | `slate` | `gray`, `mauve`, `slate`, `sage`, `olive`, `sand` |
| `dineug.erd-editor.theme.accentColor` | `indigo` | 26 accents |
| `dineug.erd-editor.locale` | `auto` | `auto`, or one of 25 language codes, such as `ko-KR` |
| `dineug.erd-editor.agentHub.enabled` | `true` | `true`, `false` |

`auto` follows VS Code's color theme and display language. The editor's theme builder and language
button write their picks back to these settings.

## Documentation

- [Editing Guide](https://docs.erd-editor.io/docs/category/guides) — every editor feature
- [MCP](https://docs.erd-editor.io/docs/mcp/introduction) — the MCP server and its tools
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
