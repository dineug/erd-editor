# intellij-plugin

The [ERD Editor](https://plugins.jetbrains.com/plugin/23594-erd-editor) plugin for IntelliJ-based
IDEs. The Kotlin code here is a thin host layer — it registers the file editor, runs a JCEF webview
and bridges it to the IDE. The diagram editor itself is `@dineug/erd-editor`, bundled for this
panel by [`packages/intellij-webview`](../intellij-webview).

<!-- Plugin description -->
Design a database schema visually, without leaving your IDE. Diagrams are plain JSON files in your
project, so they diff and review like any other source file.

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-intellij.png?raw=true)

The editor never connects to a database — it reads and writes files only. You bring a schema in from
a `.sql` dump or a GraphQL SDL file, and take one back out as DDL.

## Getting started

Create an empty file with a `.erd.json` extension and open it. The diagram opens in the ERD Editor
instead of the text editor.

To start from a schema you already have, right-click the canvas and choose **Import → Schema SQL**
for a `.sql` dump, or **Import → GraphQL** for a `.graphql`, `.gql` or `.graphqls` file. The editor
opens its own file chooser for both; the file does not have to be inside the project.

## Features

- **Visual schema design** — tables, columns, memos, and four relationship cardinalities (zero-one,
  zero-N, one-only, one-N)
- **SQL DDL import** — bring in a `.sql` dump from any of the six vendors below. The parser reads
  `CREATE TABLE`, `CREATE INDEX` and `ALTER TABLE` constraints and skips what it does not recognize,
  so an awkward dump imports partially rather than failing outright
- **GraphQL SDL import** — bring in a schema from any tool that emits SDL. Object types become
  tables, scalars map to the diagram's own dialect, and the fields pointing at another type become
  the relationships; the generated types an API layer wraps its rows in are left out rather than
  drawn as tables
- **SQL DDL export** — MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, SQLite
- **Code generation** — TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go, SQLAlchemy,
  TypeORM, Sequelize, Drizzle, DBML
- **Visualization** — a force-directed view of how the tables actually relate
- **Export** — `.erd.json`, `.sql`, `.png`
- **Quick search** to jump to any table, **time travel** through this session's edit history, and
  **undo / redo**
- **Theming** — the theme you pick on the canvas is remembered across restarts

Editing marks the tab dirty like any other file; the diagram is written to disk when you save.

## Requirements

- An IntelliJ-based IDE, 2025.2 or later.
- The IDE must be running on the JetBrains Runtime. The editor is a JCEF webview, which is
  unavailable when the IDE is started on an alternative OpenJDK build.

## Links

- [Editing guide](https://docs.erd-editor.io/docs/category/guides) — editing, import and export,
  relationships, quick search, visualization, code generation, settings
- [Documentation](https://docs.erd-editor.io)
- [Web app](https://erd-editor.io)
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
./gradlew check          # unit tests
./gradlew verifyPlugin   # Plugin Verifier compatibility check
```

The plugin compiles against JDK 21; Gradle's toolchain resolver fetches it if your machine has none.

### Layout

| Path | What it is |
| --- | --- |
| `src/main/kotlin/.../editor/` | The file editor, JCEF webview, scheme handler and the webview ↔ IDE bridge |
| `src/main/kotlin/.../files/` | `.erd.json` recognition and the file icon |
| `src/main/kotlin/.../settings/` | Theme persistence |
| `src/main/resources/META-INF/plugin.xml` | Plugin manifest |
| `src/main/resources/assets/` | The webview bundle, written here by `packages/intellij-webview` |

The bridge command names in `WebviewBridge.kt` must match the definitions in
[`packages/vscode-bridge`](../vscode-bridge) exactly — change one side only and messages are
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
