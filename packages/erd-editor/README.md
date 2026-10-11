# @dineug/erd-editor

> Entity-Relationship Diagram Editor as a custom element

![ERD Editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

`<erd-editor>` is a database-schema editor in a single custom element: design tables and
relationships visually, import SQL DDL, GraphQL SDL, DBML or AML, and export DDL or generated code.
It has no framework dependency and renders into a closed shadow root, so it drops into any page —
React, Vue, Svelte, or plain HTML — without leaking styles either way.

It is the same editor as [erd-editor.io](https://erd-editor.io), the
[Google Drive app](https://workspace.google.com/marketplace/app/erd_editor/428467403360), the
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode), the
[IntelliJ plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor) and the
[Obsidian plugin](https://community.obsidian.md/plugins/erd-editor).

## Features

### Design

- **Visual schema design** — tables, columns, memos, and four relationship cardinalities (Zero One,
  Zero N, One Only, One N)
- **Quick edits** — `Alt`+`N` adds a table and `Alt`+`Enter` a column, `Alt`+`K` toggles the primary
  key on the focused column, or on every selected column when it is one of them, and `Delete` or
  `Backspace` removes the selection, each in one undo step; the Shortcuts page of the editor's
  Settings tab lists every key, and `setKeyBindingMap` remaps them
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
  **New Table Group** in the canvas menu or the command palette, or group the selected tables from
  their right-click menu. A table joins a group when you drop it inside and leaves when you drop it
  outside, dragging a group by its title moves its tables with it, each member's header takes the
  group's color, View Option hides the groups, and DBML import and the Code Generator's DBML carry
  them as `TableGroup`s
- **Auto Layout** — place every table again by Force, Flow or a vertical or horizontal tree from the
  canvas menu or the command palette, table groups kept together, in one undo step; Force shows a
  preview you apply or cancel, and the others land at once
- **Copy, paste and colors** — copy tables and memos and paste them as new ones, into another
  diagram too or into a spreadsheet as a grid, hold `Alt` while dragging to duplicate them, and
  color a table, memo or table group from its right-click menu
- **Clean diffs** — the scroll position and zoom, the open tab, the code generator's language and
  name cases and the bracket type are locked in a new document
  ([Loading and saving](#loading-and-saving)), so the file keeps the values they had when locked
  and looking around never changes it; the file, written in a fixed order, also leaves out
  measured widths, connector anchors and removed items

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
- **Imports land laid out** — a schema picked from the Import menu, the command palette or a host's
  file dialog arrives with its tables placed by their relationships (in rows when it has none), and
  one undo puts the previous diagram back; a `setSchema*` call, as from your own file dialog, is
  laid out the same way when given `{ placement: 'auto' }`
- **Import and Add** — the menu beside Import, and its five formats in the command palette, add a
  `.sql`, GraphQL, DBML, AML or `.erd.json` file to the diagram instead of replacing it: its tables
  arrive below everything already there, laid out the same way (an `.erd.json` file keeps its own
  placement), selected, and one undo takes them away. A table whose name is already taken arrives as
  a second table rather than merging, and a foreign key to a table outside the file is dropped;
  `{ mode: 'append' }` does the same from `setSchemaJSON` and the four `setSchema*` methods, which
  lay the tables out only with `placement: 'auto'` and stand them in rows otherwise

### Export and code

- **SQL DDL export** — Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake and SQLite,
  from the Schema SQL tab, which saves the DDL as a `.sql` file or copies it, and from
  `getSchemaSQL(vendor?, options?)`
- **Schema SQL options** — a panel beside the DDL picks the database and the bracket type, CREATE
  TABLE IF NOT EXISTS or drop and re-create and a `USE` or `CREATE + USE` header, each where the
  database has it, and the tables by table group, and keeps SQL of your own to write before and
  after the tables. The statements, header and tables stay with this editor until the element goes
  and never reach the file; the scripts are saved in the document
- **Code generation** — TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go, SQLAlchemy, TypeORM,
  Sequelize, Drizzle, DBML, AML, Mermaid, PHP, Doctrine, Rust, SeaORM, Swift, Zod and JSON Schema,
  from the Code Generator tab. Its options panel picks the language, the database, the table and
  column name cases and, for Doctrine, JPA and SeaORM, the bracket type, and saves the code as a
  file with the language's extension
- **Export** — `.erd.json`, `.sql`, and a `.png` or `.svg` from a dialog with a preview: transparent
  background, light or dark, the PNG at 1x to 3x or copied to the clipboard instead

### Find and navigate

- **Quick search** — `Ctrl`/`Cmd`+`K` opens the command palette to run editor commands (new table,
  import, export, Auto Layout, tabs, theme, language and more), or to jump to a table after `#`, a
  column after `@`, and a comment or memo after `:`; Korean also matches by its initial consonants
  (`ㅅㅇㅈ` finds 사용자)
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
- **Diff viewer** — compare the diagram with another `.json` file from the canvas menu, or from
  `setDiffValue`
- **Undo / redo** — every edit, from the toolbar or `Ctrl`/`Cmd`+`Z` and `Ctrl`/`Cmd`+`Shift`+`Z`,
  in the editor's own history

### Language and theme

- **Display language** — the editor's menus, panels, dialogs, command palette and messages in 25
  languages, Arabic, Hebrew and Persian laid out right to left while the diagram stays left to
  right. The element shows English until the host turns on `enable-locale-picker`, which adds the
  toolbar's language button and **Display Language** and follows System, or calls `setLocale`
  ([Display language](#display-language)); table and column names, SQL keywords, data types and
  generated code stay as they are
- **Theme** — once the host sets `enable-theme-builder`, the toolbar's theme builder picks the
  appearance, a gray color and an accent color, and **Theme** in the command palette picks the
  appearance; System follows the OS color scheme or what `setSystemAppearance` names, and the
  element stores nothing (`changePresetTheme` tells the host)
- **Welcome screen** — opt-in with `enable-welcome-screen`: an empty diagram you can edit opens on a
  menu of New Table, New Memo, Import, Command Palette and Shortcuts, with arrows at the toolbar's
  search, theme and language buttons where the element shows them and at the floating toolbar where
  the canvas has room, until its first table, shown memo or shown table group

### Collaboration hooks

- **Collaboration hooks** — the editor emits the actions it makes and applies a peer's through
  `getSharedStore()`; you supply the transport, and seed a joining editor with its `runtimeValue`
  ([Collaboration](#collaboration))
- **Headless entries** — `engine.js` runs a replica with no DOM, so a worker can apply the same
  actions and serialize the document off the main thread, and `peer.js` runs a peer that edits by
  dispatching actions, which the
  [ERD Editor MCP server](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme)
  is built on

## Install

```sh
npm install @dineug/erd-editor
```

Your bundler resolves, dedupes and tree-shakes the package's ES modules and dependencies. The PNG
and SVG export, the Flow and tree layouts and the syntax highlighting run in shared workers spawned
as `new SharedWorker(new URL('./workers/…', import.meta.url), { type: 'module', name })`, which
Vite, webpack and Rspack emit beside your chunks and esbuild does not. A strict CSP needs
`worker-src 'self'`. Without a bundler, use the [Script tag](#script-tag) build.

## Usage

```js
import '@dineug/erd-editor';

const editor = document.createElement('erd-editor');
// a custom element is inline, and the editor fills its box
Object.assign(editor.style, { display: 'block', width: '100%', height: '100vh' });
document.body.appendChild(editor);

editor.setInitialValue(localStorage.getItem('my-diagram') ?? '');
editor.addEventListener('change', () => {
  localStorage.setItem('my-diagram', editor.value);
});
```

### Server-side rendering

Importing the package registers the element, which throws without a DOM, so in Next.js, Nuxt,
SvelteKit or Astro import it on the client:

```js
useEffect(() => {
  import('@dineug/erd-editor');
}, []);
```

### Vite

In development Vite would look the worker files up in its pre-bundle cache, so exclude the editor
and include the CommonJS ELK bundle its layout worker imports, or the Flow and tree layouts fail. A
production build needs nothing.

```js
// vite.config.js
export default {
  optimizeDeps: {
    exclude: ['@dineug/erd-editor'],
    include: ['@dineug/erd-editor > elkjs/lib/elk.bundled.js'],
  },
};
```

### Script tag

`dist/erd-editor.umd.js`, served by `unpkg` and `jsdelivr`, bundles every dependency and worker,
registers `<erd-editor>` and puts `setExportFileCallback`, `setImportFileCallback` and
`createKeyBindingMap` on `window.ErdEditor`. Its workers are `data:` URLs, so a strict CSP needs
`worker-src data:`. Pin a version in the URL beyond a demo.

```html
<erd-editor style="display: block; width: 100%; height: 100vh"></erd-editor>
<script src="https://cdn.jsdelivr.net/npm/@dineug/erd-editor/dist/erd-editor.umd.js"></script>
```

### HTML

In a page a bundler serves:

```html
<erd-editor system-dark-mode style="display: block; height: 100vh"></erd-editor>
<script type="module">
  import '@dineug/erd-editor';
</script>
```

## API

The package exports the element's type as `ErdEditorElement`.

### Attributes

| Attribute | Property | Description |
| --- | --- | --- |
| `readonly` | `readonly` | Blocks editing and `change`; `clear()` and every load you start but `setInitialValue()` are ignored. |
| `system-dark-mode` | `systemDarkMode` | On, sets the appearance to `system`; off, keeps the light or dark it shows. |
| `enable-theme-builder` | `enableThemeBuilder` | Shows the theme builder's toolbar button and the palette's Theme. |
| `enable-locale-picker` | `enableLocalePicker` | Shows the toolbar's language button and the palette's Display Language, and makes System the default. |
| `enable-welcome-screen` | `enableWelcomeScreen` | Shows the welcome screen over an empty, editable diagram, again after an undo back to empty. |

An attribute is on when present with no value or `"true"`, off for any other value (`"false"`,
`"readonly"`).

### Properties

| Property | Description |
| --- | --- |
| `value: string` | The document as a file saves it ([schema](https://github.com/dineug/erd-editor/blob/main/json-schema/schema.json)). Assigning one, or `''` for a new one, is an undoable load. |
| `runtimeValue: string` | Read only. The document as this editor holds it, to seed a collaborator. |

### Methods

| Method | Description |
| --- | --- |
| `setInitialValue(value)` | Load a document with no undo entry, clearing the history; `''` starts a new one. |
| `getSchemaSQL(vendor?, options?)` | DDL for one of the [eight vendors](#export-and-code), by default the document's, scripts included. `options` (`SchemaSQLOptions`): `statements` `create` (default), `ifNotExists` or `recreate`; `header` `none` (default), `use` or `createAndUse`, written only for a plain-identifier database name. |
| `setSchemaSQL(value, options?)`, `setSchemaGraphQL`, `setSchemaDBML`, `setSchemaAML` | Replace the document with parsed DDL, GraphQL SDL, DBML or AML, or append it ([Importing a schema](#importing-a-schema)). |
| `setSchemaJSON(value, options?)` | Load an `.erd.json` document as `value` does, or append it. |
| `setDiffValue(value)` | Diff another document over the ERD tab without switching to it; it opens nothing before that tab first shows. |
| `setPresetTheme(options)` | Set `appearance` (`light`, `dark`, `system`), `grayColor` and `accentColor`. |
| `setSystemAppearance(appearance)` | Name the light or dark `system` shows; `null` follows the OS. |
| `setLocale(locale)` | Set the display language, `'system'` or a [code](#display-language); emits nothing. |
| `setSystemLocale(tag)` | Name, as a BCP 47 tag, the language `system` shows, for a host with its own UI language; `null` reads `navigator.languages`. |
| `setTheme(theme)` | Override theme tokens with string values. Each call replaces the earlier overrides, which outlast `setPresetTheme`. |
| `setKeyBindingMap(map)` | Remap [shortcuts](#key-bindings) but `edit`, `stop`, `undo`, `redo` and the zoom keys. |
| `getSharedStore(config?)` | A [shared store](#collaboration): `subscribe`, `dispatch`, `dispatchSync`, `connection`, `disconnect`, `flushStreamBuffers`, `destroy`. |
| `focus()` / `blur()` | Move focus in or out. |
| `clear()` | Empty the document and keep its settings; one undo brings it back. |
| `destroy()` | Release the editor's listeners, subscriptions and shared stores. |

### Events

| Event | Description |
| --- | --- |
| `change` | The document changed; read `editor.value` ([Loading and saving](#loading-and-saving)). |
| `changePresetTheme` | The theme changed in the editor; `event.detail` holds the options (`appearance: 'system'` for System). |
| `changeLocale` | A language was picked in the editor; `event.detail.locale` holds it. |

### Loading and saving

Save `value`; `runtimeValue`, which also keeps removed entities, only seeds a
[collaborator](#collaboration).

A new document locks each setting the Settings tab lists under **Lock**, which then saves its value
at locking. A loaded document keeps its locks, or has all on if it predates them. A replacing load
(`value`, an import, a peer's load, or the undo of a load or of `clear()`) keeps on screen what the
incoming document locks (for an import, the current locks), scroll and zoom aside, and takes its
values for the rest.

`change` fires 200 ms after the last change, never under `readonly` or for a scroll, zoom, tab, code
setting or bracket type under its lock. A file another release wrote, or one edited by hand, can
differ from `value` once loaded: detect edits by a [replica](#headless-replica)'s `changed`, not by
bytes.

Under `readonly`, only the scroll, zoom, tab, database, code language, name cases and bracket type
change; a peer's actions relayed into `getSharedStore().dispatch` still apply.

### Importing a schema

The four text `setSchema*` methods take
`{ placement?: 'auto' | 'grid', mode?: 'replace' | 'append' }`, `setSchemaJSON` only `mode`; each
lands in one undo step and ignores `''`; a replace with unreadable text loads an empty document.

`'grid'`, the default, lands at once in rows. `'auto'` lays the tables out first, as the Import menu
does, and returns a `Promise` that resolves on landing, keeping settings changed meanwhile. A load
before then (a replacing import, `value`, `setInitialValue`, `clear()`, a peer's load or the undo of
a load or `clear()`) supersedes it, and it resolves with nothing loaded; a readonly editor resolves
at once.

`mode: 'append'` is [Import and Add](#import), table groups included: it lands below hidden groups
too, keeps every setting but the tab and scroll, and selects new groups while groups show. An
`'auto'` append supersedes nothing: it lands after earlier `'auto'` imports, below the diagram as it
stands then, and only a later load or replace drops it. From another tab it brings up the ERD tab
first; a readonly editor adds nothing.

### Theme and language

The element starts dark; `setPresetTheme({ appearance: 'system' })` follows the OS, or the light or
dark `setSystemAppearance` names. `setLocale` applies at once, so one set before appending paints
the first frame. `setSystemLocale` matters only under System and shows English for a tag the
editor lacks. Neither choice is stored; keep what `changePresetTheme` and `changeLocale` report.

## Collaboration

A joiner starts from the first editor's runtime value, so an undo there restores removed entities
whole in both; then each relays its actions:

```js
joiner.setInitialValue(editor.runtimeValue);

const local = editor.getSharedStore();
const remote = joiner.getSharedStore();
local.subscribe(actions => remote.dispatch(actions));
remote.subscribe(actions => local.dispatch(actions));
```

An editor never forwards what it received, so with three or more, send each one's batches to every
other.

`getSharedStore` takes `{ getNickname?, mouseTracker?, focusTracker? }`; `mouseTracker` broadcasts
the cursor and `focusTracker` the focused cell, selection and drag box, both on by default.
`disconnect()` holds outgoing actions while your transport is down; `connection()` releases them.
Call `flushStreamBuffers()` before destroying the store or editor, or drags, color changes and memo
resizes in their quiet period never reach the peers.

## Key bindings

`createKeyBindingMap()` returns a new map of the default shortcuts. A chord is its modifiers
(`Shift`, `Alt`, `Control`, `Meta`, or `$mod`: Cmd on macOS and iOS, Ctrl elsewhere) joined by `+`,
then a `KeyboardEvent.code` or a `key` in any case, matching only those exact modifiers.

Entries are `ShortcutOption`s, `{ shortcut, preventDefault?, stopPropagation? }`; a remapped one
without flags lets the browser default run and the keydown bubble. `setKeyBindingMap` replaces each
list it names. The defaults stop `search`, `findReplace`, `undo`, `redo`, `focusView`, zoom and
`zenMode`, so bubble-phase listeners miss them while the editor is focused, and a host that takes
keys first (global hotkeys, a capture listener) must let them through, or leave `$mod+KeyF` to the
page with `setKeyBindingMap({ findReplace: [] })`. The `KeyBindingMap`, `KeyBindingName` and
`ShortcutOption` types are exported.

## Display language

The codes are `en`, `ar-SA`, `de-DE`, `es-ES`, `eu-ES`, `fa-IR`, `fr-FR`, `he-IL`, `id-ID`, `it-IT`,
`ja-JP`, `ko-KR`, `nl-NL`, `pl-PL`, `pt-BR`, `pt-PT`, `ro-RO`, `ru-RU`, `sk-SK`, `sl-SI`, `sv-SE`,
`tr-TR`, `uk-UA`, `zh-CN` and `zh-TW`. `setLocale('system')` follows System even without
`enable-locale-picker`. The `LocaleCode` and `LocaleOption` types are exported; cast a stored
string `as LocaleOption`, since an unknown value is ignored.

## Syntax highlighting

[Shiki](https://shiki.style) highlights the panels' code, DBML and AML as SQL, with a JavaScript
regex engine, so a CSP needs no `wasm-unsafe-eval`, from a shared worker built when a code panel
first renders; with a bundler, a page that opens none never fetches the grammars (the UMD file
carries them).

Without `SharedWorker`, as in Chrome on Android before Chrome 148, the panels log the error and show
plain text, the Flow view places nothing, Auto Layout's Flow and tree placements say "Could not
place tables" (Force works), an `'auto'` import lands in rows, and PNG and SVG exports draw on the
main thread.

## File dialogs

Import and export go through page-wide callbacks, so a host without a browser file dialog (an IDE
webview) supplies its own:

```js
import { setExportFileCallback, setImportFileCallback } from '@dineug/erd-editor';

setExportFileCallback((blob, { fileName }) => host.writeFile(fileName, blob));

setImportFileCallback(async ({ type, op, accept, mode }) => {
  const text = await host.pickFile(accept);
  if (op === 'diff') return editor.setDiffValue(text);
  if (type === 'json') return editor.setSchemaJSON(text, { mode });
  const format = { sql: 'SQL', graphql: 'GraphQL', dbml: 'DBML', aml: 'AML' }[type];
  if (format) editor[`setSchema${format}`](text, { placement: 'auto', mode });
});
```

Export gets `.erd.json`, `.sql`, PNG, SVG and the Code Generator's file. An import's `op` is
`'diff'` for the Diff Viewer, whose file goes to `setDiffValue()`, so test it first; otherwise it is
`'set'`. Skip a `type` you do not handle: a replacing `setSchemaJSON()` empties the document on any
other payload. `accept` lists the type's extensions (`.json`, `.sql`,
`.graphql,.gql,.graphqls`, `.dbml`, `.aml`), and `mode` is `'append'` from Import and Add. Unset or
`null`, the browser's download and file picker work.

## Headless replica

The `engine.js` replica takes the same actions with no DOM:

```js
import { createReplicationStore } from '@dineug/erd-editor/engine.js';

const store = createReplicationStore({ toWidth }); // a worker has no DOM to measure text
store.setInitialValue(savedJson);
store.on({ change: ({ value, changed }) => changed && persist(value) });
store.dispatch(actions);
```

`value` and `runtimeValue` mirror the element's; `dispatch` applies on the next microtask,
`dispatchSync` at once, and `destroy` releases the store. `change` comes 200 ms after the last
document action, locked settings included, with `changed` false when `value` matches what the store
last reported or loaded, never your file. `ReplicationStore` and `ReplicationChange` are exported
types.

### Headless peer

`peer.js` runs a collaboration peer with no DOM, the base of the ERD Editor MCP server. Its
`createPeerStore({ nickname })` store dispatches actions, receives a peer's batches and undoes its
own dispatches; `PeerStoreError`, per-module action barrels (`tableActions`, `tableActions$`, …) and
`createSchemaSQL` come with it.

## Development

```sh
pnpm --filter @dineug/erd-editor dev            # dev server, workspace deps built first
pnpm --filter @dineug/erd-editor dev:storybook  # component playground
pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match test
pnpm --filter @dineug/erd-editor e2e            # Playwright
```

What a change runs and carries is in
[AGENTS.md](https://github.com/dineug/erd-editor/blob/main/packages/erd-editor/AGENTS.md).

## Documentation

- [Editing Guide](https://docs.erd-editor.io/docs/category/guides) — editing, import and export,
  relationships, quick search, visualization, code generation, settings
- [Element API](https://docs.erd-editor.io/docs/api/erd-editor-element) — the `<erd-editor>`
  element's API
- [Documentation](https://docs.erd-editor.io)

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE) © SeungHwan-Lee
