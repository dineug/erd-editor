# @dineug/erd-editor

> Entity-Relationship Diagram Editor as a custom element

![ERD Editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

`<erd-editor>` is a database-schema editor in one custom element. It has no framework dependency
and renders into a closed shadow root, so it drops into React, Vue, Svelte or plain HTML without
leaking styles either way. It is the same editor as [erd-editor.io](https://erd-editor.io), the
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode), the
[JetBrains plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor) and the
[Obsidian plugin](https://community.obsidian.md/plugins/erd-editor).

## Features

- **Design** — tables, columns, memos and table groups, four relationship cardinalities, ON DELETE
  and ON UPDATE, alternate keys, Auto Layout
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

The PNG and SVG export, the Flow and tree layouts and the syntax highlighting run in shared
workers, which Vite, webpack and Rspack emit beside your chunks and esbuild does not. A strict CSP
needs `worker-src 'self'`. Without a bundler, use the [script tag](#script-tag) build.

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

Importing the package registers the element, which needs a DOM, so in Next.js, Nuxt, SvelteKit or
Astro import it on the client:

```js
useEffect(() => {
  import('@dineug/erd-editor');
}, []);
```

### Vite

In development, keep the editor out of Vite's pre-bundling and include the ELK bundle its layout
worker imports, or the Flow and tree layouts fail. A production build needs nothing.

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

`dist/erd-editor.umd.js` bundles every dependency and worker, registers `<erd-editor>` and puts
`setExportFileCallback`, `setImportFileCallback` and `createKeyBindingMap` on `window.ErdEditor`.
Its workers are `data:` URLs, so a strict CSP needs `worker-src data:`. Pin a version beyond a demo.

```html
<erd-editor style="display: block; width: 100%; height: 100vh"></erd-editor>
<script src="https://cdn.jsdelivr.net/npm/@dineug/erd-editor/dist/erd-editor.umd.js"></script>
```

## API

The element's type is exported as `ErdEditorElement`. The
[Element API docs](https://docs.erd-editor.io/docs/api/erd-editor-element) cover each member in
full.

### Attributes

| Attribute | Property | Description |
| --- | --- | --- |
| `readonly` | `readonly` | Blocks editing and `change`; only `setInitialValue()` still loads. |
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
| `getSchemaSQL(vendor?, options?)` | DDL for one of the eight databases, by default the document's. `options`: `statements` (`create`, `ifNotExists`, `recreate`), `header` (`none`, `use`, `createAndUse`), `logicalNameAsComment` (`true` writes a table's or column's logical name where its comment is empty). |
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
  the open tab or the code settings while the document locks them, which a new document does.
- A file written by hand or by another release can differ from `value` once loaded, so detect edits
  with a [replica](#headless-replica)'s `changed`, not by comparing bytes.

### Importing a schema

- The four text `setSchema*` methods take `{ placement?: 'auto' | 'grid', mode?: 'replace' | 'append' }`,
  and `setSchemaJSON` only `mode`. Each lands in one undo step and ignores `''`.
- `'grid'`, the default, lands at once in rows. `'auto'` lays the tables out as the Import menu does
  and returns a `Promise` that resolves when they land; a later load supersedes it.
- `mode: 'append'` adds the tables below the diagram, as Import and Add does.

### Theme and language

The element starts dark and English and stores neither choice: `setPresetTheme` and `setLocale`
set them, and your host keeps what `changePresetTheme` and `changeLocale` report.

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
