# @dineug/erd-editor

> Entity-Relationship Diagram Editor as a custom element

![ERD Editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

`<erd-editor>` is a database-schema editor in one custom element. It has no framework dependency
and renders into a closed shadow root, so it drops into React, Vue, Svelte or plain HTML without
leaking styles either way. It is the same editor as [erd-editor.io](https://erd-editor.io), the
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode), the
[JetBrains plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor) and the
[Obsidian plugin](https://community.obsidian.md/plugins/erd-editor). Beside it,
[`<erd-viewer>`](#viewer) shows a diagram read-only, for a page that only displays one.

## Features

- **Design** — tables, columns, memos and table groups, four relationship cardinalities, ON DELETE
  and ON UPDATE, alternate keys, Auto Layout
- **Naming standards** — logical and physical names, physical names and data types derived from
  word, term and domain dictionaries, which have their own tab with CSV import and export and checks
- **Import** — SQL DDL, GraphQL SDL, DBML and AML from the menu or [`setSchema*`](#importing-a-schema),
  replacing the diagram or adding to it
- **Export** — DDL for eight databases, also from `getSchemaSQL()`, code in 22 languages and ORMs,
  PNG and SVG
- **Navigate** — command palette (`Ctrl`/`Cmd`+`K`), an Explorer tree with find and replace, Graph
  and Flow views
- **History** — undo and redo, time travel through the session, a diff viewer (`setDiffValue()`)
- **25 languages** and a System, Light or Dark theme, their pickers opt-in with an attribute
- **Collaboration** — [`getSharedStore()`](#collaboration) relays edits over your own transport,
  and the [headless entries](#headless-replica) run the same document with no DOM

**Databases:** Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake, SQLite

**Code:** TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go, SQLAlchemy, TypeORM, Sequelize,
Drizzle, DBML, AML, Mermaid, PHP, Doctrine, Rust, SeaORM, Swift, Zod, JSON Schema

## Install

```sh
npm install @dineug/erd-editor
```

The editor's PNG and SVG export, the Flow and tree layouts and the syntax highlighting run in shared
workers, which Vite, webpack and Rspack emit beside your chunks and esbuild does not. webpack's
experimental `experiments.outputModule` starts none of them, as each waits on a chunk split off it
that nothing loads: keep webpack's default output, or set `optimization.splitChunks: false`. A
strict CSP needs `worker-src 'self'`. `<erd-viewer>` starts no worker. Both elements style
themselves with constructed stylesheets, which `style-src 'self'` allows, but the editor's code
panels color their text with `style` attributes and its image export previews from a `blob:` url, so
they need `style-src 'unsafe-inline'` and `img-src blob:`. A browser without constructed
stylesheets, as Firefox before 101, gets `<style>` elements, which need `style-src 'unsafe-inline'`
too. Without a bundler, use the [script tag](#script-tag) builds.

## Usage

```js
import '@dineug/erd-editor/erd-editor.js';

const editor = document.createElement('erd-editor');
// a custom element is inline, and the editor fills its box
Object.assign(editor.style, { display: 'block', width: '100%', height: '100vh' });
document.body.appendChild(editor);

editor.setInitialValue(localStorage.getItem('my-diagram') ?? '');
editor.addEventListener('change', () => {
  localStorage.setItem('my-diagram', editor.value);
});
```

### Registering the elements

`@dineug/erd-editor/erd-editor.js` defines `<erd-editor>` when imported, and
`@dineug/erd-editor/erd-viewer.js` defines [`<erd-viewer>`](#viewer). Importing the package root
defines neither. It exports both element classes, `ErdEditorElement` and `ErdViewerElement`, and
`defineErdEditor()` and `defineErdViewer()`, which define their tag where you call them:

```js
import { defineErdEditor } from '@dineug/erd-editor';

defineErdEditor();
```

A second call does nothing, and a call throws an `Error` naming the tag when another class already
holds it.

A bundle that holds both elements makes Vite and Rolldown warn 24 times of an
`INEFFECTIVE_DYNAMIC_IMPORT`: the viewer loads each language but English with `import()`, and the
editor imports every dictionary at once, so they stay in the editor's chunk and load with it.

For a tag of your own, define the class yourself and add the tag to `HTMLElementTagNameMap`
yourself, in a window that loads neither that element's entry nor its [script tag](#script-tag)
build and calls no define function for it, since a class takes one name per window:

```ts
import { ErdEditorElement } from '@dineug/erd-editor';

customElements.define('my-erd-editor', ErdEditorElement);

declare global {
  interface HTMLElementTagNameMap {
    'my-erd-editor': ErdEditorElement;
  }
}
```

### Migrating from the bare import

Importing the package root used to define `<erd-editor>`. It now defines nothing, so an element
created after that import alone is a plain `HTMLElement` without the editor's methods. Import the
entry for its effect instead, or call `defineErdEditor()`:

```diff
-import '@dineug/erd-editor';
+import '@dineug/erd-editor/erd-editor.js';
 import { setExportFileCallback } from '@dineug/erd-editor';
```

### Server-side rendering

Every entry but [`engine.js` and `peer.js`](#headless-replica) needs a DOM, the package root too,
since evaluating it builds both element classes. So in Next.js, Nuxt, SvelteKit or Astro import
the element on the client:

```js
useEffect(() => {
  import('@dineug/erd-editor/erd-editor.js');
}, []);
```

### Vite

In development, include the ELK bundle the editor's layout worker imports in Vite's
pre-bundling, or the Flow and tree layouts fail. Vite 7 and older also need the editor kept out
of pre-bundling, since their pre-bundle points the workers' URLs at files it never writes. A
production build needs nothing.

```js
// vite.config.js
export default {
  optimizeDeps: {
    include: ['@dineug/erd-editor > elkjs/lib/elk.bundled.js'],
    // Vite 7 and older only:
    // exclude: ['@dineug/erd-editor'],
  },
};
```

### Script tag

Two builds bundle every dependency, so a page loads one with no bundler. Pin a version beyond a
demo.

- `dist/erd-editor.umd.js` bundles the workers too, defines `<erd-editor>` and puts
  `setExportFileCallback`, `setImportFileCallback`, `createKeyBindingMap`, `dictionaryRowChords`,
  `ErdEditorElement` and `defineErdEditor` on `window.ErdEditor`. Its workers are `data:` URLs, so
  a strict CSP needs `worker-src data:`.
- `dist/erd-viewer.umd.js` defines `<erd-viewer>` and puts `ErdViewerElement` and
  `defineErdViewer` on `window.ErdViewer`. It starts no worker and holds all 25 languages.

The package's `unpkg` and `jsdelivr` fields name the editor's file, so a CDN URL without a path
serves the editor.

```html
<erd-editor style="display: block; width: 100%; height: 100vh"></erd-editor>
<script src="https://cdn.jsdelivr.net/npm/@dineug/erd-editor/dist/erd-editor.umd.js"></script>
```

```html
<erd-viewer src="diagram.erd.json" style="display: block; height: 480px"></erd-viewer>
<script src="https://cdn.jsdelivr.net/npm/@dineug/erd-editor/dist/erd-viewer.umd.js"></script>
```

## API

`ErdEditorElement` is exported as both the element's type and its class, beside
`defineErdEditor()` ([Registering the elements](#registering-the-elements)). The
[Element API docs](https://docs.erd-editor.io/docs/api/erd-editor-element) cover each member in
full. The read-only element has a section of its own, [Viewer](#viewer).

### Attributes

| Attribute | Property | Description |
| --- | --- | --- |
| `readonly` | `readonly` | Blocks editing and `change`; only `setInitialValue()` still loads. Takes the edit UI away and keeps navigation, export, the diff viewer and Table Properties to read; a setting the reader changes stays on their own screen. |
| `system-dark-mode` | `systemDarkMode` | Sets the appearance to `system`. |
| `enable-theme-builder` | `enableThemeBuilder` | Shows the theme builder and the palette's Theme. |
| `enable-locale-picker` | `enableLocalePicker` | Shows the language button and the palette's Display Language, System by default. |
| `enable-welcome-screen` | `enableWelcomeScreen` | Shows the welcome screen over an empty, editable diagram. |

An attribute is on when present with no value or `"true"`.

### Properties

| Property | Description |
| --- | --- |
| `value: string` | The document as a file saves it ([schema](https://github.com/dineug/erd-editor/blob/main/json-schema/schema.json)). Assigning one, or `''` for a new one, is an undoable load. |
| `runtimeValue: string` | Read only. The document as this editor holds it, to seed a collaborator. |

### Methods

| Method | Description |
| --- | --- |
| `setInitialValue(value)` | Load a document with no undo entry; `''` starts a new one. |
| `getSchemaSQL(vendor?, options?)` | DDL for one of the eight databases, by default the one this editor shows (the document's, unless a readonly reader picked another), always in the bracket it shows. `options`: `statements` (`create`, `ifNotExists`, `recreate`), `header` (`none`, `use`, `createAndUse`), `logicalNameAsComment` (`true` writes a table's or column's logical name where its comment is empty). |
| `setSchemaSQL(value, options?)`, `setSchemaGraphQL`, `setSchemaDBML`, `setSchemaAML` | Replace the document with parsed DDL, GraphQL SDL, DBML or AML, or append it ([Importing a schema](#importing-a-schema)). |
| `setSchemaJSON(value, options?)` | Load an `.erd.json` document as `value` does, or append it. |
| `setDiffValue(value)` | Diff another document over the ERD tab. |
| `setPresetTheme(options)` | Set `appearance` (`light`, `dark`, `system`), `grayColor` and `accentColor`. |
| `setSystemAppearance(appearance)` | Name the light or dark `system` shows; `null` follows the OS. |
| `setLocale(locale)` | Set the display language, `'system'` or a [code](#display-language). |
| `setSystemLocale(tag)` | Name the BCP 47 language `system` shows; `null` reads `navigator.languages`. |
| `setTheme(theme)` | Override theme tokens; each call replaces the earlier overrides. |
| `setKeyBindingMap(map)` | Remap [shortcuts](#key-bindings) but `edit`, `stop`, `undo`, `redo` and the zoom keys. |
| `getSharedStore(config?)` | A [shared store](#collaboration) for collaboration. |
| `focus()` / `blur()` | Move focus in or out. |
| `clear()` | Empty the document and keep its settings, in one undo step. |
| `destroy()` | Release the editor's listeners, subscriptions and shared stores. |

### Events

| Event | Description |
| --- | --- |
| `change` | The document changed; read `editor.value`. |
| `changePresetTheme` | The theme changed in the editor; `event.detail` holds the options. |
| `changeLocale` | A language was picked in the editor; `event.detail.locale` holds it. |

### Loading and saving

- Save `value`. `runtimeValue` also keeps removed entities and only seeds a
  [collaborator](#collaboration).
- `change` fires 200 ms after the last change, never under `readonly`, and never for scroll, zoom,
  the open tab, the name view or the code settings while the document locks them, which a new
  document does.
- A file written by hand or by another release can differ from `value` once loaded, so detect edits
  with a [replica](#headless-replica)'s `changed`, not by comparing bytes.

### Importing a schema

- The four text `setSchema*` methods take `{ placement?: 'auto' | 'grid', mode?: 'replace' | 'append' }`,
  and `setSchemaJSON` only `mode`. Each lands in one undo step and ignores `''`.
- `'grid'`, the default, lands at once in rows. `'auto'` lays the tables out as the Import menu does
  and returns a `Promise` that resolves when they land; a later load supersedes it.
- `mode: 'append'` adds the tables below the diagram, as Import and Add does.
- A replace by the four text methods keeps the document's word, term and domain dictionaries, which
  the text cannot hold; a replacing `setSchemaJSON` takes the ones its document holds, as `value`
  does.

### Theme and language

The element starts dark and English and stores neither choice: `setPresetTheme` and `setLocale`
set them, and your host keeps what `changePresetTheme` and `changeLocale` report.

## Viewer

`<erd-viewer>` shows a document read-only: a reader pans, zooms, searches and lights relationships,
and nothing in it edits. It renders into a closed shadow root as the editor does, and several on one
page each keep their own document and view.

```js
import '@dineug/erd-editor/erd-viewer.js';
```

```html
<erd-viewer src="/diagrams/shop.erd.json" style="display: block; height: 480px"></erd-viewer>
```

### Viewer attributes and properties

| Attribute | Property | Description |
| --- | --- | --- |
| `src` | `src` | The URL of a document as an `.erd.json` file saves it, in no other format, fetched with `GET` under the browser's CORS rules. |
| `name-view` | `nameView` | `physical`, `logical` or `both`, shown over the name view the document saves, which `value` keeps. |
| `minimap` | `minimap` | The minimap, which shows while the document has content. |
| `controls` | `controls` | The controls bar: zoom out, the zoom level, which resets it, zoom in, Fit, the name view list, and an arrow to the nearest part of the diagram while none of it is on screen. |

`minimap` and `controls` are on unless their value is `"false"`.

| Property | Description |
| --- | --- |
| `value: string` | The document as an `.erd.json` file saves it, as the editor's `value` does: while the document locks its viewport, which a new document does, it keeps the zoom and scroll the file saved, and only with that lock off holds the reader's. Assigning one shows it and throws on text that does not parse; `''` shows an empty diagram. |

Whichever of `value` and `src` is set last wins, so assigning `value` cancels a fetch still
running. A `value`, `src`, `nameView`, `minimap` or `controls` set on the element before its tag is
defined is taken up once it is, over the attributes its markup gave it.

### Viewer methods

| Method | Description |
| --- | --- |
| `setPresetTheme(options)` | Set `appearance` (`light`, `dark`, `system`), `grayColor` and `accentColor`. |
| `setSystemAppearance(appearance)` | Name the light or dark `system` shows; `null` follows the OS. |
| `setTheme(theme)` | Override theme tokens; each call replaces the earlier overrides. |
| `setLocale(locale)` | Set the display language, `'system'` or a [code](#display-language). The `Promise` it returns resolves once that language's dictionary has loaded or failed to. |
| `setSystemLocale(tag)` | Name the BCP 47 language `system` shows; `null` goes back to the page's languages. It resolves as `setLocale` does. |
| `destroy()` | Take the view down, abort a fetch and stop watching the OS color scheme and the page's styles. A destroyed viewer draws nothing more, even when added to the page again. |

### Viewer events

| Event | Description |
| --- | --- |
| `load` | The document `src` names was fetched and shown. Assigning `value` fires none. |
| `error` | Fetching `src`, its response or its document failed; `event.detail` holds the cause. The viewer shows an empty diagram and a notice. |

### Loading, focus and language

- **Loading.** A notice over the canvas shows while `src` loads and once it failed. A new `src`
  aborts the fetch before it, removing the viewer from the page aborts the one running, and a
  viewer put back fetches a `src` it has not shown. Each document is fitted to the viewer's box
  as it lands, the zoom and scroll the file saved left aside.
- **Focus.** The viewer takes no focus as it mounts. Until a click, a tap or the Tab key focuses
  it, the wheel and a swipe from empty canvas scroll the page, a trackpad pinch passes to the
  page, a finger pans nothing, and it answers no key. Once focused, the wheel pans it (`Shift`
  across) and so does a finger, `Ctrl`/`Cmd` with the wheel or a pinch zooms, `Ctrl`/`Cmd`+`=`,
  `-` and `0` zoom in, out and back, and `Ctrl`/`Cmd`+`K` opens a palette that searches the
  document: `#` tables, `@` columns and `:` comments and memos. A mouse drag pans and a still click
  or tap lights relationships, focused or not: a table's, or the one clicked; the table the pointer
  rests on lights its own.
- **Theme and language.** Both start on `system`: the OS color scheme, and the page's
  `<html lang>`, then `navigator.languages`, read once as the viewer first connects. English is in
  the entry. Each other language is a chunk of its own, which your bundler emits and the viewer
  loads once a page asks for it, showing English until it lands and keeping English if it fails.
  The palette and the notices follow a right-to-left language; the canvas and the controls stay
  left to right.

### What it adds to a page

- `src` is the one `fetch` the package makes, so a strict CSP lists its origin in `connect-src`.
  Besides it, a viewer requests only the dictionary chunk of a language other than English, from
  your own bundle. Its styles are constructed stylesheets, which a strict CSP lets through, but for
  a browser without them, which gets `<style>` elements.
- It starts no worker and writes no storage. Importing it adds three listeners to `window` for
  the life of the page, for `mousedown`, `touchstart` and an event of the package's own,
  `@dineug/erd-editor/internal-forward-move-start`, and Konva, which draws the canvas, sets
  `window.Konva` and, with its first stage, adds mouse and touch listeners to `window` and a
  `visibilitychange` listener to `document`, which it never removes. The editor's entry adds the
  same.

## Collaboration

A joiner starts from the first editor's `runtimeValue`, then each relays its actions:

```js
joiner.setInitialValue(editor.runtimeValue);

const local = editor.getSharedStore();
const remote = joiner.getSharedStore();
local.subscribe(actions => remote.dispatch(actions));
remote.subscribe(actions => local.dispatch(actions));
```

An editor never forwards what it received, so with three or more, send each one's batches to every
other. Call `flushStreamBuffers()` before destroying a store, or the last drags and resizes never
reach the peers. `getSharedStore({ getNickname, mouseTracker, focusTracker })` also shares cursors
and focus.

## Key bindings

`createKeyBindingMap()` returns the default shortcuts, and `setKeyBindingMap` replaces each list it
names. A chord is modifiers (`Shift`, `Alt`, `Control`, `Meta`, or `$mod` for Cmd on macOS and Ctrl
elsewhere) joined by `+` with a `KeyboardEvent.code` or `key`; a space separates the chords of a
sequence, such as `KeyT KeyG`. Several defaults, search and find and replace among them, stop the
keydown, so to leave `$mod+KeyF` to the page, call `setKeyBindingMap({ findReplace: [] })`.
`dictionaryRowChords(map)` lists the chords the Dictionary tab's grid inserts and deletes rows by
under a map: the one-press chords of `addColumn` and `removeColumn`, and those of `addColumn` with
`Shift` held as well, for Insert above, which no binding names. A host that keeps its own hotkeys
off the editor's keys takes both lists.

## Display language

`en`, `ar-SA`, `de-DE`, `es-ES`, `eu-ES`, `fa-IR`, `fr-FR`, `he-IL`, `id-ID`, `it-IT`, `ja-JP`,
`ko-KR`, `nl-NL`, `pl-PL`, `pt-BR`, `pt-PT`, `ro-RO`, `ru-RU`, `sk-SK`, `sl-SI`, `sv-SE`, `tr-TR`,
`uk-UA`, `zh-CN` and `zh-TW`. Arabic, Hebrew and Persian lay the editor out right to left. The
`LocaleCode` and `LocaleOption` types are exported.

## Workers

[Shiki](https://shiki.style) highlights the code panels with a JavaScript regex engine, so a CSP
needs no `wasm-unsafe-eval`. Without `SharedWorker`, as in Chrome on Android before Chrome 148, the
code panels show plain text, the Flow view and the Flow and tree layouts place nothing, an `'auto'`
import lands in rows, and PNG and SVG exports draw on the main thread.

## File dialogs

Import and export go through page-wide callbacks, so a host without a browser file dialog, such as
an IDE webview, supplies its own:

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

Skip a `type` you do not handle: a replacing `setSchemaJSON()` empties the document on any other
payload. Unset or `null`, the browser's download and file picker work. The Dictionary tab's Import
CSV always opens the browser's file picker, since no `type` names CSV, and its Export CSV goes
through the export callback.

## Headless replica

`engine.js` applies the same actions with no DOM, so a worker can keep and serialize the document:

```js
import { createReplicationStore } from '@dineug/erd-editor/engine.js';

const store = createReplicationStore({ toWidth }); // a worker has no DOM to measure text
store.setInitialValue(savedJson);
store.on({ change: ({ value, changed }) => changed && persist(value) });
store.dispatch(actions);
```

`changed` is false when `value` matches what the store last reported or loaded.

`peer.js` runs a collaboration peer with no DOM: `createPeerStore({ nickname })` dispatches actions,
receives a peer's batches and undoes its own. The
[ERD Editor MCP server](https://github.com/dineug/erd-editor/tree/main/packages/mcp-server#readme)
is built on it.

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

- [Editing Guide](https://docs.erd-editor.io/docs/category/guides) — every editor feature
- [Element API](https://docs.erd-editor.io/docs/api/erd-editor-element) — the `<erd-editor>`
  element in full
- [Documentation](https://docs.erd-editor.io)

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE) © SeungHwan-Lee
