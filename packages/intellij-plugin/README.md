# intellij-plugin

The [ERD Editor](https://plugins.jetbrains.com/plugin/23594-erd-editor) plugin for IntelliJ-based
IDEs. The Kotlin code here is the host layer — it registers the file editor, runs a JCEF webview
and bridges it to the IDE — and the hub coding agents join through the ERD Editor MCP server. The
diagram editor itself is `@dineug/erd-editor`, bundled for this panel by
[`packages/intellij-webview`](../intellij-webview).

<!-- Plugin description -->
Design a database schema visually, without leaving your IDE. Diagrams are plain JSON files in your
project, so they diff and review like any other source file.

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-intellij.png?raw=true)

The editor never connects to a database — it reads and writes files only. You bring a schema in from
a `.sql` dump or a GraphQL SDL file, and take one back out as DDL.

## Getting started

Create an empty file with a `.erd.json` extension and open it. The diagram opens in the ERD Editor
instead of the text editor, on a welcome guide with the ways to start.

To start from a schema you already have, right-click the canvas and choose **Import → Schema SQL**
for a `.sql` dump, or **Import → GraphQL** for a `.graphql`, `.gql` or `.graphqls` file. The editor
opens its own file chooser for both; the file does not have to be inside the project. Either one
replaces the diagram in one undoable step, its tables laid out by their relationships.
**Import and Add** beside it takes the same formats and adds the file to the diagram instead, its
tables placed as new ones below the ones already there, in one undoable step.

## Features

- **Visual schema design** — tables, columns, memos, and four relationship cardinalities (zero-one,
  zero-N, one-only, one-N)
- **Link existing columns** — while you draw a relationship with a mouse or a pen, the buttons
  beside the table it ends on either map the parent's key onto columns that table already has or add
  new ones, and Map Columns in a relationship's right-click menu changes its columns later
- **SQL DDL import** — bring in a `.sql` dump from any of the six vendors below. The parser reads
  `CREATE TABLE`, `CREATE INDEX` and `ALTER TABLE` constraints and skips what it does not recognize,
  so an awkward dump imports partially rather than failing outright
- **GraphQL SDL import** — bring in a schema from any tool that emits SDL. Object types become
  tables, scalars map to the diagram's own dialect, and the fields pointing at another type become
  the relationships; the generated types an API layer wraps its rows in are left out rather than
  drawn as tables
- **DBML import** — bring in a `.dbml` file written for dbdiagram.io or dbdocs.io, or emitted by
  `sql2dbml` or `prisma-dbml-generator`. Tables, columns, indexes, enums, header colors, every
  `Ref` spelling and each `TableGroup` arrive; a `Project` or sticky `Note` is skipped rather than
  refused
- **AML import** — bring in an `.aml` file written for [Azimutt](https://azimutt.app), in either the
  v2 or the legacy v1 spelling. Entities, attributes, indexes, enums, colors and every relation
  arrow arrive; a check, a struct type and a view are skipped rather than refused
- **Import and Add** — add a `.sql`, GraphQL, DBML, AML or `.erd.json` file to the diagram rather
  than replacing it: its tables arrive below the ones already there, which stay where they are, and
  one undo takes them away. A foreign key to a table outside the file is dropped
- **SQL DDL export** — MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, SQLite,
  with CREATE TABLE IF NOT EXISTS, drop and re-create, a USE or CREATE SCHEMA header and SQL of
  your own before and after the tables, from the Schema SQL tab's options panel
- **Code generation** — TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go, SQLAlchemy,
  TypeORM, Sequelize, Drizzle, DBML, AML, Mermaid, PHP, Doctrine, Rust, SeaORM, Swift, Zod,
  JSON Schema, picked with the database and the name cases from the Code Generator tab's options
  panel, which saves the code as a file
- **Visualization** — a force-directed view of how the tables actually relate
- **Export** — `.erd.json`, `.sql`, and a `.png` or `.svg` from a dialog with a preview:
  transparent background, light or dark, the PNG at 1x to 3x
- **Quick search** over commands, and over tables, columns, comments and memos after `#`, `@` or
  `:`, **find and replace** across names, comments and memos, **time travel** through this
  session's edit history, and **undo / redo**
- **Theming** — pick the appearance, gray color and accent color on the canvas or under
  **Settings | Tools | ERD Editor**, remembered across restarts; **Theme** in the command palette
  picks the appearance too. Auto, the default appearance and the theme builder's System, follows
  the IDE's light or dark theme and switches with it
- **Display language** — the editor's menus, panels and messages in English or 24 other languages,
  picked from the language button in the editor's toolbar, **Display Language** in the command
  palette or **Settings | Tools | ERD Editor**, remembered across restarts. Auto, the default and
  the language picker's System, follows the IDE's language, and English when the editor does not
  offer it. Arabic, Hebrew and Persian run the menus and panels right to left; the diagram is never
  mirrored
- **Welcome guide** — an empty diagram you can edit opens on a short menu to add the first table or
  memo, import a schema, open the command palette or look up the shortcuts, with hints at the
  toolbar's search, theme and language buttons and at the floating toolbar where the canvas has
  room; the first table or memo takes it away

Edits are written to the file a fraction of a second after you stop changing it; the tab never shows as modified.

## Coding agents

A coding agent such as Claude Code or Codex can edit the diagrams open in this IDE through the
[`@dineug/erd-editor-mcp`](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme)
MCP server. The agent joins the editor like a collaborator: each change shows up on the canvas as
it happens, and the agent's undo reverts only its own edits.

### Install the MCP server

The server needs Node.js 22.12 or later. `npx` downloads it the first time the agent starts it, so
there is nothing else to install.

- **Claude Code** — run `claude mcp add --transport stdio erd-editor -- npx -y @dineug/erd-editor-mcp`
  in your project folder
- **Codex** — add a `[mcp_servers.erd-editor]` table with `command = "npx"` and
  `args = ["-y", "@dineug/erd-editor-mcp"]` to `~/.codex/config.toml`, or to `.codex/config.toml`
  in a trusted project
- **Any other MCP client** — run `npx -y @dineug/erd-editor-mcp` as a stdio server. Start it in
  your project folder: it resolves relative document paths against its working directory

### Edit with an agent

1. Open the project in the IDE and trust it.
2. Start the agent in the project folder and ask in plain words, for example "Add a reviews table
   to schema.erd.json, related to users and products".
3. Watch the change land on the canvas. The IDE writes it to the file a fraction of a second after
   editing stops, as it writes your own edits; asking the agent to save writes it at once.

A diagram that is not open yet opens in the ERD Editor on the agent's first edit, without taking
the keyboard focus. One IDE serves the diagrams of every project open in it. With no IDE, VS Code
window or Obsidian vault window with ERD Editor serving the document's folder, the agent edits the
file on disk instead.

Unticking **Settings | Tools | ERD Editor → Coding agents**, which is on by default, turns the
connection off for the whole IDE. The agent can still read the diagrams of the open projects from
disk, but it never writes one behind the editor, where the next save would overwrite the change. A
project you have not trusted, opened in safe mode, is kept the same way: agents read its diagrams
but never change them. The [MCP documentation](https://docs.erd-editor.io/docs/mcp/tools) lists
every tool with its arguments.

The settings page says when coding agents are unavailable: in an IDE without JCEF, where the
editor cannot run either, and in an IDE installed as a Flatpak, whose sandbox the MCP server cannot
reach. There the agent edits the files on disk. The ERD Editor does not reload a diagram changed on
disk while it is open, and your next edit in it would overwrite the agent's, so close the diagram
first.

## Requirements

- An IntelliJ-based IDE, 2025.2 or later.
- The IDE must be running on the JetBrains Runtime. The editor is a JCEF webview, which is
  unavailable when the IDE is started on an alternative OpenJDK build.

## Documentation

- [Editing Guide](https://docs.erd-editor.io/docs/category/guides) — editing, import and export,
  relationships, quick search, visualization, code generation, settings
- [MCP](https://docs.erd-editor.io/docs/mcp/introduction) — installing the MCP server, live and
  headless editing, every tool
- [Documentation](https://docs.erd-editor.io)

## Also available

- [Web app](https://erd-editor.io) — installable PWA with real-time collaboration
- [Google Drive app](https://workspace.google.com/marketplace/app/erd_editor/428467403360) — open
  and save diagrams in Google Drive
- [VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)
- [Obsidian plugin](https://community.obsidian.md/plugins/erd-editor)
- [`@dineug/erd-editor`](https://www.npmjs.com/package/@dineug/erd-editor) — the editor as a
  custom element for your own app
<!-- Plugin description end -->

## Development

### Setup

The webview bundle (`src/main/resources/assets`) is **not** committed. A fresh clone has none
until you build it, and every Gradle task below is run from this directory.

```sh
pnpm install          # from the repository root
./gradlew buildWebview
```

Run `buildWebview` again whenever the editor source changes. It is deliberately not part of
`buildPlugin` — the bundle changes far less often than the Kotlin side, and pnpm has no business
running on every Gradle build. `buildPlugin` and `runIde` do check that the bundle is there, and
fail pointing back at this task rather than packaging an empty `assets/` that would ship as a
blank editor.

`buildWebview` is a convenience wrapper; the underlying command works from anywhere in the
workspace:

```sh
pnpm exec vp run --filter @dineug/erd-editor-intellij-webview --fail-if-no-match build
```

### Build and run

```sh
./gradlew buildWebview   # webview bundle → src/main/resources/assets
./gradlew buildPlugin    # distributable zip → build/distributions/
./gradlew runIde         # sandbox IDE with the plugin loaded
./gradlew check          # unit tests, and the coding-agent hub's coverage gate
./gradlew verifyPlugin   # Plugin Verifier compatibility check
```

The plugin compiles against JDK 21; Gradle's toolchain resolver fetches it if your machine has none.

The hub's tests read the conformance vectors of [`packages/agent-hub`](../agent-hub) and
[`packages/agent-hub-host`](../agent-hub-host), and `check` also runs the MCP server against the
hub when it is built (`ERD_MCP_CONFORMANCE=required` fails instead of skipping without the build):

```sh
pnpm exec vp run --filter @dineug/erd-editor-mcp --fail-if-no-match build   # from the repository root
```

`pnpm --filter @dineug/erd-editor-intellij-plugin smoke` runs the plugin in a sandbox IDE on macOS
and drives its hub with that server. [`AGENTS.md`](./AGENTS.md) says what the smoke checks, and how
to check the hub on Windows.

### Layout

| Path | What it is |
| --- | --- |
| `src/main/kotlin/.../editor/` | The file editor, JCEF webview, scheme handler and the webview ↔ IDE bridge |
| `src/main/kotlin/.../files/` | `.erd`, `.vuerd`, `.erd.json` and `.vuerd.json` recognition, in any letter case, and the file icon |
| `src/main/kotlin/.../settings/` | The theme, display language and Coding agents settings, and the settings page that edits them |
| `src/main/kotlin/.../hub/` | The coding-agent hub, free of IntelliJ API: the wire format, the lock file, the socket and named pipe, the document registry and the request handlers |
| `src/main/kotlin/.../agents/` | The hub's IDE side: its service, the folders and trust of the open projects, opening files, the platform events |
| `e2e/` | The live smoke and `mcp-probe.mjs`, which checks a running IDE's hub with the MCP server |
| `src/main/resources/META-INF/plugin.xml` | Plugin manifest |
| `src/main/resources/assets/` | The webview bundle, written here by `packages/intellij-webview` |

The bridge command names in `WebviewBridge.kt` must match the definitions in
[`packages/webview-bridge`](../webview-bridge) exactly — change one side only and messages are
silently dropped.

### Releasing

Publishing to the JetBrains Marketplace is manual: no signing key or publish token lives in this
repository. Bump `pluginVersion` in `gradle.properties`, fill in the matching section of
`CHANGELOG.md`, run `./gradlew buildPlugin`, and upload the zip from `build/distributions/`.
The build derives the plugin description from the marked section of this file and the release notes
from the changelog, so neither belongs in `plugin.xml`.

> The `<!-- Plugin description -->` markers above are load-bearing: `build.gradle.kts` extracts
> everything between them into the Marketplace listing. It strips the screenshot by exact string
> match, so keep that line as it is, and keep the section to headings, lists, links and inline code.

## License

[MIT](./LICENSE) © SeungHwan-Lee
