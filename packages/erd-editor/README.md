# @dineug/erd-editor

> Entity-Relationship Diagram Editor as a custom element

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

`<erd-editor>` is a full database-schema editor in a single custom element. It has no
framework dependency and renders into a closed shadow root, so it drops into any page —
React, Vue, Svelte, or plain HTML — without leaking styles either way.

This is the same editor that powers [erd-editor.io](https://erd-editor.io), the
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)
and the [IntelliJ plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor).

## Features

- Visual schema design — tables, columns, memos, and four relationship cardinalities
  (zero-one, zero-N, one-only, one-N)
- Import — a `.sql` dump, or a GraphQL SDL schema from any tool that emits one
- SQL DDL export — Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake and SQLite
- Code generation — TypeScript, GraphQL, C#, Java, JPA, Kotlin, Scala, Go,
  SQLAlchemy, TypeORM, Sequelize, Drizzle, DBML
- Export — `.erd.json`, `.sql`, `.png`
- Force-directed visualization of table relationships
- Quick search, undo / redo, remappable keyboard shortcuts, and a built-in theme builder
- Collaboration hooks — the editor emits and applies actions; you supply the transport

## Install

```sh
npm install @dineug/erd-editor
```

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

`setInitialValue('')` starts an empty document.

### Server-side rendering

Importing the package registers the custom element at module scope, so it needs a DOM and
throws in Node. In Next.js, Nuxt, SvelteKit or Astro, reach it from a client-only path:

```js
useEffect(() => {
  import('@dineug/erd-editor');
}, []);
```

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

### CDN

```html
<erd-editor style="display: block; width: 100%; height: 100vh"></erd-editor>
<script type="module">
  import 'https://esm.run/@dineug/erd-editor';
</script>
```

## API

### Attributes

| Attribute | Property | Description |
| --- | --- | --- |
| `readonly` | `readonly` | Blocks editing and suppresses the `change` event. Assigning `value`, `setSchemaSQL()`, `setSchemaGraphQL()` and `clear()` are ignored while it is set — load with `setInitialValue()` instead. Viewport actions and the SQL/code output settings still apply. |
| `system-dark-mode` | `systemDarkMode` | Follows the OS color scheme |
| `enable-theme-builder` | `enableThemeBuilder` | Shows the built-in theme builder |

### Properties

| Property | Description |
| --- | --- |
| `value: string` | The document as JSON — an `.erd.json` document ([schema](https://github.com/dineug/erd-editor/blob/main/json-schema/schema.json)). Assigning it loads the document as an edit, so it lands in the undo history; use `setInitialValue` to load without one. |

### Methods

| Method | Description |
| --- | --- |
| `setInitialValue(value: string)` | Load the initial document. Does not create a history entry. |
| `getSchemaSQL(vendor?)` | Export DDL. `vendor` is one of `Databricks`, `MariaDB`, `MSSQL`, `MySQL`, `Oracle`, `PostgreSQL`, `Snowflake`, `SQLite`; omit it to use the document's own setting. |
| `setSchemaSQL(value: string)` | Parse a DDL string and **replace** the current document with it. Lands in the undo history; an empty string is ignored. |
| `setSchemaGraphQL(value: string)` | Parse a GraphQL SDL string and **replace** the current document with it. Object types become tables, scalars map to the document's own dialect, and relationships are read from the fields that point at another type. Lands in the undo history; an empty string is ignored. |
| `setDiffValue(value: string)` | Open the diff viewer against another document. |
| `setPresetTheme(options)` | Set `appearance`, `grayColor` and `accentColor`. |
| `setTheme(theme)` | Override individual theme tokens. |
| `setKeyBindingMap(map)` | Remap shortcuts. `edit`, `stop`, `search`, `undo`, `redo`, `zoomIn` and `zoomOut` are reserved. |
| `getSharedStore(config?)` | Returns `{ subscribe, dispatch, dispatchSync, connection, disconnect, destroy }`. `subscribe` gives you this editor's actions to relay; `dispatch` applies a peer's. You supply the transport. `config` is `{ getNickname?, mouseTracker? }`. |
| `focus()` / `blur()` | Move focus in and out of the editor. |
| `clear()` | Empty the document. |
| `destroy()` | Tear the editor down and release its listeners, subscriptions and shared stores. |

### Events

| Event | Description |
| --- | --- |
| `change` | The document changed. Debounced, and never fired while `readonly`. Read `editor.value`. |
| `changePresetTheme` | The theme was changed from inside the editor. `event.detail` carries the new options. |

## Syntax highlighting

The SQL and code-generation panels render as plain text unless a highlighter is supplied.
[`@dineug/erd-editor-shiki-worker`](https://www.npmjs.com/package/@dineug/erd-editor-shiki-worker)
runs one in a shared worker. It is a separate install:

```sh
npm install @dineug/erd-editor-shiki-worker
```

```js
import { setGetShikiServiceCallback } from '@dineug/erd-editor';

// deferred, so the highlighter never lands in your main chunk
import('@dineug/erd-editor-shiki-worker').then(({ getShikiService }) => {
  setGetShikiServiceCallback(getShikiService);
});
```

## File dialogs

Import and export go through injectable callbacks, so a host without a browser file dialog —
an IDE webview, for example — can supply its own. The two are not symmetric: export hands you
the finished file, while import only asks for one, and you push the content back in yourself.

```js
import { setExportFileCallback, setImportFileCallback } from '@dineug/erd-editor';

setExportFileCallback((blob, { fileName }) => host.writeFile(fileName, blob));

setImportFileCallback(async ({ type, op, accept }) => {
  const text = await host.pickFile(accept);

  if (op === 'diff') {
    editor.setDiffValue(text);
  } else if (type === 'json') {
    editor.value = text;
  } else if (type === 'sql') {
    editor.setSchemaSQL(text);
  } else if (type === 'graphql') {
    editor.setSchemaGraphQL(text);
  }
});
```

Dispatch on every `type` you handle and ignore the rest. Assigning `value` clears the
document before it parses, so routing a payload there that is not an `.erd.json` document —
through a catch-all `else`, or because a `type` added later fell through — empties the
diagram instead of importing anything. `accept` carries the extensions for that type
(`.json`, `.sql`, or `.graphql,.gql,.graphqls`), ready to hand to a host file dialog.

Left unset, the editor uses the browser's own download and file-picker behavior.

## Headless replica

A second entry point runs the document store with no DOM, for hosts that need to apply an
action stream and serialize the result off the main thread:

```js
import { createReplicationStore } from '@dineug/erd-editor/engine.js';

// `toWidth` measures text for layout — a worker has no DOM, so you supply it
const store = createReplicationStore({ toWidth });

store.setInitialValue(savedJson);
store.on({ change: () => persist(store.value) });
store.dispatch(actions); // actions relayed from a live editor's shared store
```

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
