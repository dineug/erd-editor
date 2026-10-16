# ERD Editor

> Entity-Relationship Diagram Editor for IntelliJ-based IDEs

<!-- Plugin description -->
Design a database schema visually, without leaving your IDE. Diagrams are plain `.erd.json` files in
your project, and the editor never connects to a database.

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-intellij.png?raw=true)

## Getting started

1. Create an empty file with a `.erd.json` extension and open it. It opens in ERD Editor.
2. Right-click the canvas for every action: add a table, or choose **Import** to start from a
   `.sql`, GraphQL, DBML or AML file.
3. Edits are written to the file a fraction of a second after you stop. Undo and redo, on the
   editor's toolbar, are its own history.

## Features

- **Design** — tables, columns, memos and table groups, four relationship cardinalities, ON DELETE
  and ON UPDATE, alternate keys, Auto Layout
- **Import** — SQL DDL, GraphQL SDL, DBML and AML, replacing the diagram or adding to it
- **Export** — DDL for eight databases, code in 22 languages and ORMs, PNG and SVG
- **Navigate** — a command palette, an Explorer tree with find and replace, Graph and Flow views
- **History** — undo and redo, time travel through the session, a diff viewer against another file
- **25 languages** and a System, Light or Dark theme, following the IDE by default
- **Coding agents** — Claude Code or Codex edits the diagram live on the canvas (Coding agents,
  below)
- **Multiple editors** — the same diagram open in several editors, such as a split, stays in sync

**Databases:** Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake, SQLite

**Code:** TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go, SQLAlchemy, TypeORM, Sequelize,
Drizzle, DBML, AML, Mermaid, PHP, Doctrine, Rust, SeaORM, Swift, Zod, JSON Schema

Every feature step by step: the [Editing Guide](https://docs.erd-editor.io/docs/category/guides).

## Coding agents

A coding agent such as Claude Code or Codex edits the diagrams of the projects open in this IDE
through the
[ERD Editor MCP server](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme).
Each change shows up on the canvas as it happens, and the agent's undo reverts only its own edits.

Add it with one command, in your project folder (Node.js 22.12 or later):

```sh
# Claude Code
claude mcp add --transport stdio erd-editor -- npx -y @dineug/erd-editor-mcp
# Codex
codex mcp add erd-editor -- npx -y @dineug/erd-editor-mcp
```

Then trust the project, start the agent in the same folder and ask, for example "Add a reviews
table to schema.erd.json, related to users and products". Other clients and the tool list
are in the
[MCP server's README](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme).

Unticking **Settings | Tools | ERD Editor → Coding agents** turns the connection off for the whole
IDE, as an untrusted project does for itself: the agent can then read the diagrams but never writes
them. In an IDE installed as a Flatpak, which the MCP server cannot reach, the agent edits the files
on disk, so close the diagram first: ERD Editor does not reload a file changed on disk.

## Settings

**Settings | Tools | ERD Editor** holds, for the whole IDE, the appearance, gray color and accent
color, the display language and **Coding agents**. Auto, the default, follows the IDE's theme and
language, and the editor's theme builder and language button change these same settings.

## Requirements

- An IntelliJ-based IDE, 2025.2 or later, running on the JetBrains Runtime, since the editor is a
  JCEF webview.

## Documentation

- [Editing Guide](https://docs.erd-editor.io/docs/category/guides) — every editor feature
- [MCP](https://docs.erd-editor.io/docs/mcp/introduction) — the MCP server and its tools
- [Documentation](https://docs.erd-editor.io)

## Also available

- [Web app](https://erd-editor.io) — installable PWA with real-time collaboration
- [Google Drive app](https://workspace.google.com/marketplace/app/erd_editor/428467403360) — open
  and save diagrams in Google Drive
- [VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)
- [Obsidian plugin](https://community.obsidian.md/plugins/erd-editor)
- [`@dineug/erd-editor`](https://www.npmjs.com/package/@dineug/erd-editor) — the editor as a custom
  element for your own app
- [`@dineug/erd-editor-mcp`](https://www.npmjs.com/package/@dineug/erd-editor-mcp) — the MCP server
  coding agents edit diagrams through
<!-- Plugin description end -->

## Development

This folder is the Kotlin side of the plugin: the file editor, its JCEF webview, the bridge to the
IDE and the hub coding agents join. The diagram editor is `@dineug/erd-editor`, bundled for this
panel by
[`packages/intellij-webview`](https://github.com/dineug/erd-editor/tree/main/packages/intellij-webview).
[`AGENTS.md`](https://github.com/dineug/erd-editor/blob/main/packages/intellij-plugin/AGENTS.md)
holds the rules for changing it and what each check covers.

Run Gradle from this directory with a JDK 17 or later; the toolchain resolver downloads the JDK 21
the plugin compiles against. The webview bundle is not committed, so build it first and again
whenever the editor source changes:

```sh
pnpm install             # at the repository root
./gradlew buildWebview   # webview bundle → src/main/resources/assets
./gradlew runIde         # sandbox IDE with the plugin loaded
./gradlew check          # JUnit specs, the MCP conformance run and the hub's coverage gate
./gradlew verifyPlugin   # Plugin Verifier on the 2025.2 floor and the latest release
./gradlew buildPlugin    # distributable zip → build/distributions/
```

On Windows, where Gradle cannot start corepack's `pnpm.cmd`, build the webview at the repository
root with `pnpm exec vp run --filter @dineug/erd-editor-intellij-webview --fail-if-no-match build`.

The conformance run starts the built MCP server against the hub and skips without it, or fails
under `ERD_MCP_CONFORMANCE=required`; build it at the repository root with
`pnpm exec vp run --filter @dineug/erd-editor-mcp --fail-if-no-match build`.
`pnpm --filter @dineug/erd-editor-intellij-plugin smoke` drives a sandbox IDE's hub on macOS.

### Layout

`…` stands for `src/main/kotlin/com/github/dineug/erdeditorintellijplugin`.

| Path | What it is |
| --- | --- |
| `…/editor/` | The file editor, its JCEF webview and scheme handler, and `WebviewBridge.kt`, mirroring `packages/webview-bridge`'s commands |
| `…/files/` | Which files open in the editor, and their icon |
| `…/settings/` | The theme, display language and Coding agents settings, and the settings page |
| `…/hub/` | The coding-agent hub, free of IntelliJ API |
| `…/agents/` | The hub's IDE side: its service, the projects' folders and trust, opening files |
| `src/main/resources/META-INF/plugin.xml` | The plugin manifest |
| `src/test/kotlin/` | The JUnit 4 specs |
| `e2e/` | The macOS smoke, and `mcp-probe.mjs`, which checks a running IDE's hub through the built MCP server |

### Releasing

The maintainer publishes to the JetBrains Marketplace by hand. A release bumps `pluginVersion` in
`gradle.properties`, fills in its `CHANGELOG.md` section, runs `pnpm cache:clear` at the repository
root, then `./gradlew buildWebview buildPlugin` here, and uploads the zip from
`build/distributions/`. `buildPlugin` takes the plugin description from the part of this file
between the `Plugin description` markers, without the screenshot line, and the change notes from
`CHANGELOG.md`.

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/packages/intellij-plugin/LICENSE)
© SeungHwan-Lee
