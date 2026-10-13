# ERD Editor

> Entity-Relationship Diagram Editor for IntelliJ-based IDEs

<!-- Plugin description -->
Design a database schema visually, without leaving your IDE. Diagrams are plain JSON files in your
project, so they diff and review like any other source file.

The editor never connects to a database: it reads and writes your diagram files. You bring a schema
in from a `.sql` dump or a GraphQL SDL, DBML or AML file, and take one back out as DDL or generated
code.

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-intellij.png?raw=true)

## Getting started

Create an empty file with a `.erd.json` extension and open it. Files ending in `.erd.json`, in any
letter case, open in ERD Editor instead of the text editor.

An empty diagram you can edit opens on the welcome screen, a menu of New Table, New Memo, Import,
Command Palette and Shortcuts, which stays until its first table, shown memo or shown table group.
Right-click the canvas for every action, as the welcome screen says.

To start from a schema you already have, right-click the canvas and choose **Import**, then **Schema
SQL** for a `.sql` dump, **GraphQL** for a `.graphql`, `.gql` or `.graphqls` file, **DBML** for a
`.dbml` file or **AML** for an `.aml` file; **json** opens an `.erd.json` file as it was saved. The
editor opens its own file chooser, and the file does not have to be inside the project. Each one
replaces the diagram in one undoable step, a schema's tables laid out by their relationships.
**Import and Add** beside it takes the same five and adds the file to the diagram instead, its
tables placed as new ones below everything already there, in one undoable step.

Edits are written to the file a fraction of a second after you stop changing it, and the tab never
shows as modified. Undo and redo, on the editor's toolbar, are its own history.

## Features

### Design

- **Visual schema design** — tables, columns, memos, and four relationship cardinalities (Zero One,
  Zero N, One Only, One N)
- **Selections** — **Primary Key** in a table's right-click menu toggles the key on the column you
  right-clicked, or, reading **Primary Key on selected columns**, on every selected column when you
  right-click one of several selected; in the right-click menu of a table, memo or table group that
  is one of several selected, **Delete selected** removes every selected table, memo and table group
- **Link existing columns** — while you draw a relationship with a mouse or a pen, the buttons
  beside the table it ends on either map the parent's key onto columns that table already has or add
  new ones, named after the parent table when the key is one word (`user_id` for `user`'s `id`), and
  **Map Columns** in a relationship's right-click menu changes its columns later
- **Referential actions** — set **On Delete** and **On Update** (NO ACTION, CASCADE, SET NULL,
  SET DEFAULT, RESTRICT) from a relationship's right-click menu, which marks one the current
  database leaves out; the line shows them at its child end as `D:C U:R`, and View Option's
  Referential Actions hides the labels. SQL, DBML and AML import read them, and the DDL export and
  the code generators that have a place for them write the ones the target supports
- **Alternate keys** — View Option's Alternate Key marks the columns of each unique index over two
  or more columns as `AK1.1`, `AK1.2`, and SQL import reads a UNIQUE over several columns as one
  such index
- **Table groups** — draw a box behind related tables, which you name and can color, with
  **New Table Group** in the canvas menu or the command palette, or group the selected tables from
  their right-click menu. A table joins a group when you drop it inside and leaves when you drop it
  outside, dragging a group by its title moves its tables with it, each member's header takes the
  group's color, View Option hides the groups, and DBML import and the Code Generator's DBML carry
  them as `TableGroup`s
- **Auto Layout** — place every table again by Force, Flow or a vertical or horizontal tree from the
  canvas menu or the command palette, table groups kept together, in one undo step; Force shows a
  preview you apply or cancel, and the others land at once
- **Colors** — color a table, memo or table group from its right-click menu
- **Clean diffs** — the scroll position and zoom, the open tab, the code generator's language and
  name cases and the bracket type are locked by default, so the file keeps the values they had when
  locked and looking around never changes it; the file, written in a fixed order, also leaves out
  measured widths, connector anchors and removed items (see Keeping diffs clean, below)

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
- **Imports land laid out** — a schema picked from the Import menu or the command palette arrives
  with its tables placed by their relationships (in rows when it has none), and one undo puts the
  previous diagram back
- **Import and Add** — the menu beside Import, and its five formats in the command palette, add a
  `.sql`, GraphQL, DBML, AML or `.erd.json` file to the diagram instead of replacing it: its tables
  arrive below everything already there, laid out the same way (an `.erd.json` file keeps its own
  placement), selected, and one undo takes them away. A table whose name is already taken arrives as
  a second table rather than merging, and a foreign key to a table outside the file is dropped

### Export and code

- **SQL DDL export** — Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake and SQLite,
  from the Schema SQL tab, which saves the DDL as a `.sql` file
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
  background, light or dark, the PNG at 1x to 3x

### Find and navigate

- **Quick search** — the command palette, from the toolbar's search button, runs editor commands
  (new table, import, export, Auto Layout, tabs, theme, language and more), or jumps to a table
  after `#`, a column after `@`, and a comment or memo after `:`; Korean also matches by its initial
  consonants (`ㅅㅇㅈ` finds 사용자)
- **Explorer** — the toolbar's Explorer button docks a tree of the tables, with their columns,
  indexes and foreign keys, the table groups and the memos beside the canvas, and a click goes to
  what a row stands for; its search finds table, column, index and group names, comments and memos,
  with match case, whole word, regular expressions and Preserve Case, and one undo takes back a
  Replace All
- **Visualization** — Graph mode draws a force-directed view of how the tables relate. Flow mode
  lays them out by their relationships, lights a table you hover and the tables it relates to, and
  shows names only, keys only or all fields; **Focus on this table** in a table's right-click menu
  opens Flow on that table and its neighbours, or, when it is one of several selected tables, as
  **Focus on selected tables** on all of them and their neighbours, and neither view writes its
  layout into the file
- **Zoom and pan** — pinch a trackpad or two fingers to zoom, drag with the middle button to pan
  from anywhere, and click the zoom level on the floating toolbar to go back to 100%
- **Time travel** — replay this editing session's history on the canvas and jump to any point in it,
  from the toolbar
- **Diff viewer** — compare the diagram with another `.json` file from the canvas menu: a tree
  lists what was added, changed, removed or renamed, and both panes mark it on the canvas
- **Undo / redo** — every edit, from the editor's toolbar, in the editor's own history

### Language and theme

- **Display language** — the editor's menus, panels, dialogs, command palette and messages in 25
  languages, Arabic, Hebrew and Persian laid out right to left while the diagram stays left to
  right. Pick one from the toolbar's language button or **Display Language** in the command palette,
  or System, the default, which follows the IDE's language (English where the editor has no
  translation), and **Settings | Tools | ERD Editor** keeps the pick across restarts; table and
  column names, SQL keywords, data types and generated code stay as they are
- **Theme** — the toolbar's theme builder picks the appearance (System, Light or Dark), a gray color
  and an accent color, and **Theme** in the command palette picks the appearance; System, the
  default, follows the IDE's light or dark theme and switches with it, and a pick is kept under
  **Settings | Tools | ERD Editor**, remembered across restarts
- **Welcome screen** — an empty diagram you can edit opens on a menu of New Table, New Memo, Import,
  Command Palette and Shortcuts, with arrows at the toolbar's search, theme and language buttons and
  at the floating toolbar where the canvas has room, until its first table, shown memo or shown
  table group

### Collaboration and coding agents

- **Coding agents** — Claude Code, Codex or any other MCP client edits your diagrams through the ERD
  Editor MCP server, live on the canvas as one more collaborator; Coding agents, below, says how

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

### Multiple editors per document

The same diagram can be open in several editors at once, such as a split, and they stay in sync as
you edit in any of them.

## Coding agents

A coding agent such as Claude Code or Codex can edit the diagrams of the projects open in this IDE
through the
[`@dineug/erd-editor-mcp`](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme)
MCP server. The agent joins the editor like a collaborator: each change shows up on the canvas as it
happens, and the agent's undo reverts only its own edits.

### Install the MCP server

The server needs Node.js 22.12 or later. `npx` downloads it the first time the agent starts it, so
there is nothing else to install.

- **Claude Code** — run
  `claude mcp add --transport stdio erd-editor -- npx -y @dineug/erd-editor-mcp` in your project
  folder
- **Codex** — add a `[mcp_servers.erd-editor]` table with `command = "npx"` and
  `args = ["-y", "@dineug/erd-editor-mcp"]` to `~/.codex/config.toml`, or to `.codex/config.toml`
  in a trusted project
- **Any other MCP client** — run `npx -y @dineug/erd-editor-mcp` as a stdio server. Start it in
  your project folder: it resolves relative document paths against its working directory

Keep ERD Editor and the MCP server up to date together. When one speaks an older hub protocol than
the other, the server refuses to connect and says which one to update.

### Edit with an agent

1. Open the project in the IDE and trust it.
2. Start the agent in the project folder and ask in plain words, for example "Add a reviews table
   to schema.erd.json, related to users and products".
3. Watch the change land on the canvas. The IDE writes it to the file a fraction of a second after
   editing stops, as it writes your own edits; asking the agent to save writes it at once.

A diagram that is not open yet opens in ERD Editor, without taking the keyboard focus, as soon as
the agent opens or edits it. One IDE serves the diagrams of every project open in it. With no VS
Code window, Obsidian vault window or JetBrains IDE running ERD Editor that has the document open,
or has open the folder, vault or project that holds it, the agent edits the file on disk instead.

Unticking **Settings | Tools | ERD Editor → Coding agents**, which is on by default, turns the
connection off for the whole IDE. A project you have not trusted, opened in safe mode, is kept the
same way: agents read its diagrams but never change them. Either way the agent can still read the
diagrams from disk, but it never writes one behind the editor, where the next save would overwrite
the change. The
[MCP server's README](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#tools)
lists the tools.

The settings page says when coding agents are unavailable: in an IDE without JCEF, where the editor
cannot run either, and in an IDE installed as a Flatpak, whose sandbox the MCP server cannot reach.
There the agent edits the files on disk, unless an editor the MCP server can reach, such as a VS
Code window, has the document or a folder that holds it open. ERD Editor does not reload a diagram
changed on disk while it is open, and your next edit in it would overwrite the agent's, so close the
diagram first.

## Settings

**Settings | Tools | ERD Editor** holds, for the whole IDE:

- **Appearance**, **Gray color** and **Accent color** — Auto, the default appearance and the theme
  builder's System, follows the IDE's light or dark theme and switches with it. The theme builder on
  the editor's toolbar changes these same settings, and **Theme** in the command palette changes the
  appearance.
- **Display language** — Auto, the default and the language picker's System, follows the IDE's
  language, and shows English when the editor does not offer it. The language button on the
  editor's toolbar and **Display Language** in the command palette change it too.
- **Coding agents** — on by default; see Coding agents above.

## Requirements

- An IntelliJ-based IDE, 2025.2 or later.
- The IDE must be running on the JetBrains Runtime. The editor is a JCEF webview, which is
  unavailable when the IDE is started on an alternative OpenJDK build.

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
- [Obsidian plugin](https://community.obsidian.md/plugins/erd-editor)
- [`@dineug/erd-editor`](https://www.npmjs.com/package/@dineug/erd-editor) — the editor as a custom
  element for your own app
- [`@dineug/erd-editor-mcp`](https://www.npmjs.com/package/@dineug/erd-editor-mcp) — the MCP server
  coding agents edit diagrams through
<!-- Plugin description end -->

## Development

This folder is the Kotlin side of the
[ERD Editor plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor): the file editor, its
JCEF webview and the bridge to the IDE, and the hub coding agents join through the MCP server. The
diagram editor itself is `@dineug/erd-editor`, bundled for this panel by
[`packages/intellij-webview`](https://github.com/dineug/erd-editor/tree/main/packages/intellij-webview).
[`AGENTS.md`](https://github.com/dineug/erd-editor/blob/main/packages/intellij-plugin/AGENTS.md)
holds the rules for changing it, the full source map and what each check covers.

### Setup

Run every Gradle task from this directory. Gradle needs a JDK 17 or later on `PATH` or `JAVA_HOME`
to start; the plugin compiles against JDK 21, which Gradle's toolchain resolver downloads if it is
not installed. The webview bundle (`src/main/resources/assets`) is not committed, so build it first:

```sh
pnpm install          # at the repository root
./gradlew buildWebview
```

Run `buildWebview` again whenever the editor source changes. `buildPlugin` does not run it, since
the bundle changes far less often than the Kotlin side, but `buildPlugin` and `runIde` fail with a
pointer to it when the bundle is missing, rather than ship a blank editor. On Windows, where Gradle
cannot start corepack's `pnpm.cmd`, run the command it wraps at the repository root instead:

```sh
pnpm exec vp run --filter @dineug/erd-editor-intellij-webview --fail-if-no-match build
```

### Build and run

```sh
./gradlew buildWebview   # webview bundle → src/main/resources/assets
./gradlew buildPlugin    # distributable zip → build/distributions/
./gradlew runIde         # sandbox IDE with the plugin loaded
./gradlew check          # JUnit specs, the MCP conformance run and the hub's coverage gate
./gradlew verifyPlugin   # Plugin Verifier on the 2025.2 floor and the latest release
```

The hub's tests read the conformance vectors of
[`packages/agent-hub`](https://github.com/dineug/erd-editor/tree/main/packages/agent-hub) and
[`packages/agent-hub-host`](https://github.com/dineug/erd-editor/tree/main/packages/agent-hub-host).
The conformance run starts the built MCP server against the hub with `node`, or the binary
`ERD_MCP_NODE` names, and skips without node or the build; `ERD_MCP_CONFORMANCE=required` turns the
skip into a failure. Build the server at the repository root:

```sh
pnpm exec vp run --filter @dineug/erd-editor-mcp --fail-if-no-match build
```

`pnpm --filter @dineug/erd-editor-intellij-plugin smoke` runs the plugin in a sandbox IDE on macOS
and drives its hub with that server. `AGENTS.md` says what the smoke checks, and how to check the
hub on Windows.

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

Releases are the maintainer's, published to the JetBrains Marketplace by hand: no signing key or
publish token lives in this repository. A release bumps `pluginVersion` in `gradle.properties`,
fills in its section of `CHANGELOG.md`, runs `pnpm cache:clear` at the repository root, then
`./gradlew buildWebview` and `./gradlew buildPlugin` here, and uploads the zip from
`build/distributions/`.

`buildPlugin` writes the plugin description from the part of this file between the
`<!-- Plugin description -->` and `<!-- Plugin description end -->` lines, converted to HTML with
the screenshot line removed by its exact text, and the change notes from the `CHANGELOG.md` section
of `pluginVersion`, or `## [Unreleased]` when it has none. Neither is written in
`src/main/resources/META-INF/plugin.xml`.

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/packages/intellij-plugin/LICENSE)
© SeungHwan-Lee
