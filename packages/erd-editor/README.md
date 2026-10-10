# @dineug/erd-editor

> Entity-Relationship Diagram Editor as a custom element

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

`<erd-editor>` is a full database-schema editor in a single custom element. It has no
framework dependency and renders into a closed shadow root, so it drops into any page —
React, Vue, Svelte, or plain HTML — without leaking styles either way.

This is the same editor that powers [erd-editor.io](https://erd-editor.io), the
[Google Drive app](https://workspace.google.com/marketplace/app/erd_editor/428467403360), the
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode),
the [IntelliJ plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor) and the
[Obsidian plugin](https://community.obsidian.md/plugins/erd-editor).

## Features

- Visual schema design — tables, columns, memos, and four relationship cardinalities
  (zero-one, zero-N, one-only, one-N)
- Link existing columns — while you draw a relationship with a mouse or a pen, the buttons
  beside the table it ends on either map the parent's key onto columns that table already has or
  add new ones, and Map Columns in a relationship's right-click menu changes its columns later
- Import — a `.sql` dump, a GraphQL SDL schema from any tool that emits one, a `.dbml` file, or
  an `.aml` file; one picked from the editor's own Import menu lands with its tables laid out by
  their relationships, and Import and Add adds one, or an `.erd.json` file, below the diagram
  instead of replacing it
- SQL DDL export — Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake and SQLite
- Schema SQL options — a panel beside the DDL picks CREATE TABLE IF NOT EXISTS or drop and
  re-create and a USE or CREATE SCHEMA header for the window, and keeps SQL of your own in the
  document to write before and after the tables
- Code generation — TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go,
  SQLAlchemy, TypeORM, Sequelize, Drizzle, DBML, AML, Mermaid, PHP, Doctrine, Rust, SeaORM,
  Swift, Zod, JSON Schema
- Code Generator options — a panel beside the code picks the language, the database and the name
  cases, and saves the code as a file named by the language
- Export — `.erd.json`, `.sql`, and a `.png` or `.svg` from a dialog with a preview:
  transparent background, light or dark, the PNG at 1x to 3x or copied to the clipboard instead
- Force-directed visualization of table relationships
- Quick search over commands, and over tables, columns, comments and memos after `#`, `@` or `:`,
  find and replace, undo / redo, remappable keyboard shortcuts, and a built-in theme builder
- Display language — the editor's menus, panels, command palette and messages in 25 languages,
  Arabic, Hebrew and Persian laid out right to left while the diagram stays left to right;
  English until you [turn the picker on or call `setLocale`](#display-language)
- Welcome screen — opt-in: an empty diagram shows a start menu (New Table, New Memo, Import, the
  command palette, the shortcuts) and arrows at the tools, until its first table or memo
- Collaboration hooks — the editor emits and applies actions; you supply the transport

## Install

```sh
npm install @dineug/erd-editor
```

The package ships ES modules with its dependencies left as bare imports, so any bundler
(Vite, webpack, Rspack, esbuild, …) resolves, dedupes and tree-shakes them like the rest of
your app. Four features run in shared workers — schema garbage collection, the PNG and SVG
export, the automatic table placement and the syntax highlighting — constructed as
`new SharedWorker(new URL('./workers/…', import.meta.url))`, which those bundlers emit as worker
files beside your chunks; a strict CSP needs `worker-src 'self'`. Without a bundler, use the UMD
file described under [Script tag](#script-tag) instead.

## Usage

```js
import '@dineug/erd-editor';

const editor = document.createElement('erd-editor');
// the editor fills its container, and a custom element is inline by default
Object.assign(editor.style, { display: 'block', width: '100%', height: '100vh' });
document.body.appendChild(editor);

// load a document without adding an undo entry, then keep it in sync
editor.setInitialValue(localStorage.getItem('my-diagram') ?? '');
editor.addEventListener('change', () => {
  localStorage.setItem('my-diagram', editor.value);
});
```

`setInitialValue('')` starts a new document, as an element given no value shows: every setting the
Settings tab lists under **Lock** (the scroll and zoom together, the tab, the code generator's
language and name cases, and the SQL bracket type) is locked at its default, so looking around
leaves `value` as it was. A locked setting is saved as it stood when it was locked, whatever the
screen does after. A document loaded from text keeps the locks it names; one saved before the
locks opens with all of them on, its scroll, zoom and tab at the start. Replacing the document
while it is open (setting `value`, an import, an undo) keeps the tab and the code generator
settings the reader had under their locks; the scroll and zoom land where the new document
puts them.

### Server-side rendering

Importing the package registers the custom element at module scope, so it needs a DOM and
throws in Node. In Next.js, Nuxt, SvelteKit or Astro, reach it from a client-only path:

```js
useEffect(() => {
  import('@dineug/erd-editor');
}, []);
```

### Vite

In development Vite pre-bundles dependencies into its cache directory, and the worker files
would then be looked up there rather than beside the package. Exclude the editor packages from
that step; a production build needs nothing.

```js
// vite.config.js
export default {
  optimizeDeps: {
    exclude: ['@dineug/erd-editor'],
  },
};
```

### Script tag

`dist/erd-editor.umd.js` is a self-contained build for a plain `<script>` tag: every
dependency and all four workers are inside it, and it registers `<erd-editor>` and exposes the
two file callbacks as `window.ErdEditor`. It is what `unpkg` and `jsdelivr` serve.

```html
<erd-editor style="display: block; width: 100%; height: 100vh"></erd-editor>
<script src="https://cdn.jsdelivr.net/npm/@dineug/erd-editor/dist/erd-editor.umd.js"></script>
```

The workers travel inside the file as `data:` URLs, so a strict CSP needs `worker-src data:`
for this build. Pin a version in the URL for anything beyond a demo.

### HTML

```html
<erd-editor system-dark-mode enable-theme-builder></erd-editor>
<script type="module">
  import '@dineug/erd-editor';

  const editor = document.querySelector('erd-editor');
</script>
```

```css
erd-editor {
  display: block;
  width: 100%;
  height: 100vh;
}
```

## API

### Attributes

| Attribute | Property | Description |
| --- | --- | --- |
| `readonly` | `readonly` | Blocks editing and suppresses the `change` event. Assigning `value`, `setSchemaSQL()`, `setSchemaGraphQL()`, `setSchemaDBML()`, `setSchemaAML()`, `setSchemaJSON()` and `clear()` are ignored while it is set — load with `setInitialValue()` instead. Viewport actions and the SQL/code output settings still apply. |
| `system-dark-mode` | `systemDarkMode` | Sets the appearance to `system` when it turns on; turned off, the appearance stays the light or dark `system` shows. |
| `enable-theme-builder` | `enableThemeBuilder` | Shows the built-in theme builder, and the command palette's Theme command (System, Light, Dark) |
| `enable-locale-picker` | `enableLocalePicker` | Shows the toolbar's language button, whose picker lists System and the 25 languages, and the command palette's Display Language command. Until `setLocale` is called or the reader picks a language, the editor follows System while it is on and shows English while it is off; see [Display language](#display-language). |
| `enable-welcome-screen` | `enableWelcomeScreen` | Shows a welcome screen over an empty diagram on the ERD tab: a line pointing to the canvas's right-click menu, a menu of New Table, New Memo, Import, Command Palette and Shortcuts, and, where the canvas has room, arrows at the toolbar's Search, theme and language buttons and at the floating toolbar. The first table or memo takes it away, and an undo back to an empty diagram brings it again. It never shows while `readonly` is set. |

### Properties

| Property | Description |
| --- | --- |
| `value: string` | The document as JSON — an `.erd.json` document ([schema](https://github.com/dineug/erd-editor/blob/main/json-schema/schema.json)). Assigning it loads the document as an edit, so it lands in the undo history; use `setInitialValue` to load without one. Assigning an empty string loads a new document, as `setInitialValue('')` does. |

### Methods

| Method | Description |
| --- | --- |
| `setInitialValue(value: string)` | Load the initial document. Does not create a history entry, and clears the undo history, so nothing done before the load can be undone or redone onto it. |
| `getSchemaSQL(vendor?, options?)` | Export DDL. `vendor` is one of `Databricks`, `MariaDB`, `MSSQL`, `MySQL`, `Oracle`, `PostgreSQL`, `Snowflake`, `SQLite`; omit it to use the document's own setting. `options` takes `statements` (`create` by default, `ifNotExists`, `recreate`) and `header` (`none` by default, `use`, `createAndUse`); a value the vendor lacks falls back as the Schema SQL tab does, and a header is written only while the database name is a plain identifier (ASCII letters, digits and `_`, not starting with a digit). The document's before and after scripts are always included. The `SchemaSQLOptions` type comes with the package. |
| `setSchemaSQL(value: string, options?)` | Parse a DDL string and **replace** the current document with it, or add it with `mode: 'append'`. Lands in the undo history; an empty string is ignored. `options` takes `placement` and `mode`, below. |
| `setSchemaGraphQL(value: string, options?)` | Parse a GraphQL SDL string and **replace** the current document with it, or add it with `mode: 'append'`. Object types become tables, scalars map to the document's own dialect, and relationships are read from the fields that point at another type. Lands in the undo history; an empty string is ignored. `options` takes `placement` and `mode`, below. |
| `setSchemaDBML(value: string, options?)` | Parse a DBML string and **replace** the current document with it, or add it with `mode: 'append'`. Tables, columns, indexes, header colors and every `Ref` spelling are read; a `Project`, `TableGroup` or sticky `Note` is skipped, and text it cannot read loads an empty document rather than being refused. Lands in the undo history; an empty string is ignored. `options` takes `placement` and `mode`, below. |
| `setSchemaAML(value: string, options?)` | Parse an [AML](https://azimutt.app) string and **replace** the current document with it, or add it with `mode: 'append'`. Entities, attributes, indexes, colors and every relation arrow are read, in the v2 and the legacy v1 spelling; a check, a struct type and a view are skipped, and text it cannot read loads an empty document rather than being refused. Lands in the undo history; an empty string is ignored. `options` takes `placement` and `mode`, below. |
| `setSchemaJSON(value: string, options?)` | Load an `.erd.json` document in place of the current one, as assigning `value` does, or add its tables, relationships, indexes and memos to it with `{ mode: 'append' }`, which keeps the current settings, but for the tab and the scroll position (as below), and the placement the file gives them. Lands in the undo history; an empty string is ignored, and so is text the parser cannot read for an append. |
| `setDiffValue(value: string)` | Open the diff viewer against another document. |
| `setPresetTheme(options)` | Set `appearance` (`light`, `dark` or `system`), `grayColor` and `accentColor`. `system` follows the OS color scheme, or what `setSystemAppearance` names. |
| `setSystemAppearance(appearance)` | Name the light or dark `system` shows, for a host with its own theme (an IDE's light or dark); `null` hands it back to the OS color scheme. It changes nothing on screen unless the appearance is `system`. |
| `setLocale(locale)` | Set the display language: `'system'`, or one of the codes under [Display language](#display-language). Emits nothing, and any other value is ignored. Until it is called, or the reader picks a language, the editor shows English, or follows `system` while `enableLocalePicker` is on. |
| `setSystemLocale(tag)` | Name the language `system` shows, as a BCP 47 tag, for a host with its own UI language (an IDE's); `null` hands it back to the browser's `navigator.languages`. A tag the editor has no language for shows English. It changes the language shown only while the option in force is `system`. |
| `setTheme(theme)` | Override individual theme tokens. |
| `setKeyBindingMap(map)` | Remap shortcuts, `search` and `findReplace` among them. `edit`, `stop`, `undo`, `redo`, `zoomIn`, `zoomOut` and `zoomReset` are reserved. |
| `getSharedStore(config?)` | Returns `{ subscribe, dispatch, dispatchSync, connection, disconnect, destroy }`. `subscribe` gives you this editor's actions to relay; `dispatch` applies a peer's. You supply the transport. `config` is `{ getNickname?, mouseTracker?, focusTracker? }`; both trackers default to `true` and broadcast this editor's cursor and table focus to peers. |
| `focus()` / `blur()` | Move focus in and out of the editor. |
| `clear()` | Empty the document. Its settings stay, the locks included, so a cleared file keeps saving what it saved. |
| `destroy()` | Tear the editor down and release its listeners, subscriptions and shared stores. |

The four `setSchema*` methods take `{ placement?: 'auto' | 'grid' }` as their second argument.
`'grid'`, the default, replaces the document at once with the tables in rows, as these methods
always did. `'auto'` lays the tables out first, as an import from the editor's own menu does: by
their relationships (the Flow layout) when at least two tables and one relationship arrive, and in
rows otherwise, or when the layout fails, the page runs no `SharedWorker`, or the reader presses
Cancel on the toast a slow layout shows. It returns a `Promise` that resolves once the document is
replaced, still in one undo step, keeping any setting changed meanwhile. A load before then —
another import that replaces, `value`, `setInitialValue`, `clear()`, a peer's load or an undo of
one — supersedes it, so the replace started last is the one that lands, and its `Promise` resolves
with nothing loaded. A readonly editor places nothing and resolves at once.

They take `mode?: 'replace' | 'append'` beside it. `'replace'`, the default, is everything above.
`'append'` does what Import and Add does: the tables, relationships and indexes the text declares
are added to the document as new ones, below every table and memo it already holds and in line with
their left edge, with new ids, so a table of a name the document already has is added beside it, and
a foreign key to a table outside the text is dropped. The tables already there and every setting but
the tab and the scroll position (below) stay as they are, the new tables end selected and on screen,
and one undo takes them away.
With `placement: 'auto'` they are laid out as above before they are added, and the diagram is read
as they land; with `'grid'` they stand in rows. An append placed with `'auto'` supersedes nothing:
it lands after every `'auto'` import started before it, on the document a replace among them brings,
and only a load or a replace started after it drops it. An append lands on the ERD tab: from any
other — the Visualization tab in Graph or Flow mode, Schema SQL, Code Generator or Settings — it
brings the ERD tab up first, then selects the new tables and scrolls to them, clear of an open Find
and Replace panel. A readonly editor adds nothing, and its menu and command palette offer no Import
and Add.

### Events

| Event | Description |
| --- | --- |
| `change` | The document changed. Debounced, and never fired while `readonly`, nor for a change to a locked setting alone: a scroll, a zoom, a tab switch or a code generator setting under its lock leaves `value` as it was. Read `editor.value`. With the viewport unlocked a scroll or a zoom fires it, and `value` holds both. `value` differs from a file another release or machine wrote from the load on, so a host that writes files tells an edit from such a change by a [headless replica](#headless-replica)'s `changed`, not by comparing bytes with the file. |
| `changePresetTheme` | The theme was changed from inside the editor. `event.detail` carries the new options, whose `appearance` is `system` when the theme builder's System is picked. |
| `changeLocale` | A display language was picked from inside the editor, in the toolbar's picker or the command palette, the one already in force included. `event.detail.locale` is the option picked, `system` or a language code. `setLocale` fires none. |

## Key bindings

`createKeyBindingMap()` returns the shortcuts an editor listens for until `setKeyBindingMap`
changes them, as a new map on every call. Each is a chord: its modifiers (`Shift`, `Alt`,
`Control`, `Meta`, or `$mod`, which is Cmd on macOS and Ctrl elsewhere) joined by `+`, then the
key, named by its `KeyboardEvent.code` (`KeyK`, `Digit1`) or its `KeyboardEvent.key` in any case.
A chord matches only while exactly its modifiers are held. Presses separated by a space form a
sequence, each pressed within a second of the keydown before it.

```js
import { createKeyBindingMap } from '@dineug/erd-editor';

const shortcuts = Object.values(createKeyBindingMap())
  .flat()
  .map(({ shortcut }) => shortcut); // '$mod+KeyK', 'Alt+Enter', ...
```

The editor listens on its own element, so a host that takes keys before the page does, with
global hotkeys or a capture-phase `keydown` listener, has to let these through while the editor
is focused. The `KeyBindingMap`, `KeyBindingName` and `ShortcutOption` types come with it.

The page's own find is among them: while the editor is focused, on any of its tabs, `$mod+KeyF`
opens its Find and Replace, bringing the ERD tab up, and is prevented, so the browser opens no find
bar; while the diff viewer, time travel or the automatic placement preview covers the ERD tab, the
press goes on to the page. `setKeyBindingMap({ findReplace: [] })` leaves it to the page on every
tab, and the toolbar button, the quick search and the context menu still open Find and Replace.

## Display language

The editor's own text, from its menus, panels, dialogs, command palette and messages to the
placeholders the canvas draws in an empty name, type, default or comment, comes in 25 languages:
`en`, `ar-SA`, `de-DE`, `es-ES`, `eu-ES`, `fa-IR`, `fr-FR`, `he-IL`, `id-ID`, `it-IT`, `ja-JP`,
`ko-KR`, `nl-NL`, `pl-PL`, `pt-BR`, `pt-PT`, `ro-RO`, `ru-RU`, `sk-SK`, `sl-SI`, `sv-SE`, `tr-TR`,
`uk-UA`, `zh-CN` and `zh-TW`. Arabic, Hebrew and Persian lay the editor out right to left, while the
diagram, the minimap and the SQL and code panels stay left to right. What the document holds is
never translated, nor is generated SQL or code, a database, code language or file format name, an
SQL keyword or a data type.

An element that neither turns `enable-locale-picker` on nor calls `setLocale` shows English,
whatever the browser's language. With the picker on and nothing set, it follows **System**. A
`setLocale` call wins either way, and `setLocale('system')` follows System with the picker off
too. Toggling the picker with nothing set switches between System and English. Both setters take
effect before they return, so an element given its language before it is appended paints its
first frame in it.

System reads `navigator.languages` in the browser's order of preference and takes the first
language the editor has, matching a tag by its language (`de-AT` shows Deutsch). Chinese goes by
its script, then by its region: `zh-Hant`, `zh-TW`, `zh-HK` and `zh-MO` show 繁體中文, any other
`zh` 简体中文. Portuguese is Português Brasileiro unless a region other than Brazil is named. With
no match it shows English. The editor follows the browser's `languagechange`. A host with its own
UI language, such as an IDE, names it with `setSystemLocale(tag)` instead.

The editor stores nothing: keep the option the reader picks, as you keep the theme.

```js
editor.enableLocalePicker = true;
editor.setLocale(localStorage.getItem('locale') ?? 'system');
editor.addEventListener('changeLocale', event => {
  localStorage.setItem('locale', event.detail.locale);
});
```

## Syntax highlighting

The SQL and code-generation panels are highlighted by [Shiki](https://shiki.style), in a shared
worker of its own. There is nothing to install or register: the worker is built the first time a
code panel renders, so a page that opens none never fetches the grammars.

| | |
| --- | --- |
| Languages | SQL, TypeScript, GraphQL, C#, Java, Kotlin, Scala, Go, Python, Mermaid, PHP, Rust, Swift, JSON |
| Themes | `github-dark`, `github-light`, picked from the editor's light / dark appearance |

Those are exactly the languages the panels emit — the JPA generator emits Java, the SQLAlchemy
generator emits Python, the TypeORM, Sequelize, Drizzle and Zod generators emit TypeScript, the
Doctrine generator emits PHP, the SeaORM generator emits Rust, the JSON Schema generator emits
JSON, and the DBML and AML generators are highlighted as SQL, the closest grammar shiki ships.

Where `SharedWorker` is missing — Chrome on Android, Safari before 16.4 — the underlying error is
logged and the panels render as plain text; nothing else is affected. The regex engine is plain
JavaScript, so no host CSP needs `wasm-unsafe-eval`.

## File dialogs

Import and export go through injectable callbacks, so a host without a browser file dialog —
an IDE webview, for example — can supply its own. The two are not symmetric: export hands you
the finished file, while import only asks for one, and you push the content back in yourself.

```js
import { setExportFileCallback, setImportFileCallback } from '@dineug/erd-editor';

setExportFileCallback((blob, { fileName }) => host.writeFile(fileName, blob));

setImportFileCallback(async ({ type, op, accept, mode }) => {
  const text = await host.pickFile(accept);
  const options = { placement: 'auto', mode };

  if (op === 'diff') {
    editor.setDiffValue(text);
  } else if (type === 'json') {
    editor.setSchemaJSON(text, { mode });
  } else if (type === 'sql') {
    editor.setSchemaSQL(text, options);
  } else if (type === 'graphql') {
    editor.setSchemaGraphQL(text, options);
  } else if (type === 'dbml') {
    editor.setSchemaDBML(text, options);
  } else if (type === 'aml') {
    editor.setSchemaAML(text, options);
  }
});
```

Dispatch on every `type` you handle and ignore the rest. `setSchemaJSON()` replacing, like
assigning `value`, clears the document before it parses, so routing a payload there that is not
an `.erd.json` document —
through a catch-all `else`, or because a `type` added later fell through — empties the
diagram instead of importing anything. `accept` carries the extensions for that type
(`.json`, `.sql`, or `.graphql,.gql,.graphqls`), ready to hand to a host file dialog.
`placement: 'auto'` lays the schema out as the editor's own file picker would. `mode` is
`'append'` when the request comes from Import and Add and absent from Import, so handing it on
adds the file where the reader asked for that and replaces the document otherwise.

Left unset, the editor uses the browser's own download and file-picker behavior.

## Headless replica

A second entry point runs the document store with no DOM, for hosts that need to apply an
action stream and serialize the result off the main thread:

```js
import { createReplicationStore } from '@dineug/erd-editor/engine.js';

// `toWidth` measures text for layout — a worker has no DOM, so you supply it
const store = createReplicationStore({ toWidth });

store.setInitialValue(savedJson);
store.on({ change: ({ value, changed }) => changed && persist(value) });
store.dispatch(actions); // actions relayed from a live editor's shared store
```

`change` comes 200 ms after the last action that can change the document, a locked setting's
change included. `changed` is false when those actions left `value` as it was, such as a scroll,
a zoom or a tab switch while its lock is on. It compares with the value the store last reported,
or loaded, never with your file: a file another release or machine wrote serializes differently
from the start.

## Development

This package is the editor core of the [erd-editor monorepo](https://github.com/dineug/erd-editor);
work on it from a workspace checkout.

```sh
pnpm --filter @dineug/erd-editor dev            # builds workspace deps, then a dev server
pnpm --filter @dineug/erd-editor dev:storybook  # component playground
pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match test
pnpm --filter @dineug/erd-editor e2e            # Playwright
```

## Documentation

- [Documentation](https://docs.erd-editor.io)
- [Editing Guide](https://docs.erd-editor.io/docs/category/guides)
- [Element API](https://docs.erd-editor.io/docs/api/erd-editor-element)

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE) © SeungHwan-Lee
