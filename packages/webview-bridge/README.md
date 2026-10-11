# webview-bridge

> Typed command protocol between an editor host, its webview and its replica worker

`@dineug/erd-editor-webview-bridge` builds plain `{ type, payload }` actions and dispatches
received ones, but carries no transport: each side moves the action itself. It is private, not on
npm, and depended on as `"@dineug/erd-editor-webview-bridge": "workspace:*"`:
[`webview-client`](../webview-client) and [`replication-store-worker`](../replication-store-worker)
name it in `dependencies`, so their `dist/` keeps the import bare;
[`vscode-webview`](../vscode-webview) (`dependencies`), [`vuerd-vscode`](../vscode-extension) and
[`obsidian-plugin`](../obsidian-plugin) (`devDependencies`) inline it into their bundles.
IntelliJ's Kotlin host, in `intellij-plugin`, mirrors the commands by hand in
[`WebviewBridge.kt`](../intellij-plugin/src/main/kotlin/com/github/dineug/erdeditorintellijplugin/editor/WebviewBridge.kt)
and handles them in `ErdEditor.kt` beside it.

## Usage

`src/index.ts` exports `Bridge`, `createCommand` and their types (`AnyAction`, `Command`,
`CommandListener`, `CommandPayload`, `Dispose`), the thirteen commands of
[`src/commands.ts`](./src/commands.ts) with `ImportMode`, and the theme and locale lists below.

- **`createCommand<Payload>(type)`** — a `{ type }` token whose type parameter types the payload.
- **`Bridge.executeCommand(command, payload)`** — the `{ type, payload }` action to send.
- **`bridge.registerCommand(command, listener)`** — subscribes and returns a `Dispose`;
  `Bridge.mergeRegister(...disposes)` returns one `Dispose` that runs them all.
- **`bridge.executeAction(action)`** — runs the listeners of `action.type`. It drops anything but a
  plain object with a string `type`, never checks the payload, and logs a throwing listener with
  `console.error` while the rest run.

```ts
import {
  Bridge,
  hostInitialCommand,
  hostSaveValueCommand,
  webviewInitialValueCommand,
} from '@dineug/erd-editor-webview-bridge';

// A MessageChannel stands in for the transport.
const { port1: hostPort, port2: pagePort } = new MessageChannel();
let fileText = '';

// Host: send the document on hello; keep changed saves.
const host = new Bridge();
const disposeHost = Bridge.mergeRegister(
  host.registerCommand(hostInitialCommand, () => {
    hostPort.postMessage(
      Bridge.executeCommand(webviewInitialValueCommand, { value: fileText })
    );
  }),
  host.registerCommand(hostSaveValueCommand, ({ value, changed }) => {
    if (changed) fileText = value;
  })
);
hostPort.onmessage = event => host.executeAction(event.data);

// Page: listen first, then say hello.
const page = new Bridge();
const disposePage = page.registerCommand(webviewInitialValueCommand, ({ value }) => {
  console.log('load', value);
});
pagePort.onmessage = event => page.executeAction(event.data);
pagePort.postMessage(Bridge.executeCommand(hostInitialCommand, undefined));
```

`webview-client`'s `mountWebview(host)` wires the page side of both IDE bundles: it registers
the six `webview*` commands, relays the replica worker's `hostSaveValueCommand` and sends
`hostInitialCommand`. Each bundle passes its transport as `dispatch` (`vscode.postMessage`, or a
JSON string through `window.cefQuery`); VS Code's also passes `importFile: true`, which hands file
dialogs to the host. Host actions arrive as `window` `message` events. The replica worker takes
`webviewInitialValueCommand` and `webviewReplicationCommand` and posts `hostSaveValueCommand`;
Obsidian's `ErdView`, with no webview, drives it directly.

## Commands

The prefix names the receiver: `host*` commands go to the host, `webview*` commands to the page
or a replica worker. Each command's `type` string is its export name; listeners are keyed by
it, not by the token.

| Command | Payload | What it carries |
| --- | --- | --- |
| `hostInitialCommand` | none | The page is listening; the host sends theme, language, read-only, value |
| `hostSaveValueCommand` | `{ value, changed, runtimeValue }` | The replica's document once edits pause |
| `hostSaveReplicationCommand` | `{ actions }` | The page's edits, for the host to relay to other views and joined agents |
| `hostSaveThemeCommand` | `ThemeOptions` | A theme pick from the theme builder or the palette |
| `hostSaveLocaleCommand` | `{ locale }` | A display language pick |
| `hostImportFileCommand` | `{ type, op, accept, mode? }` | A request for a file dialog (with `importFile: true`) |
| `hostExportFileCommand` | `{ value, fileName }` | An exported file to save, base64 in `value` |
| `webviewInitialValueCommand` | `{ value }` | The document: the file's text, or an open view's `runtimeValue` |
| `webviewReplicationCommand` | `{ actions }` | Another view's or an agent's edits, or a view's own sent to its replica |
| `webviewImportFileCommand` | `{ type, op, value, mode? }` | The text the host's file dialog read |
| `webviewUpdateThemeCommand` | `Partial<ThemeOptions>`, `systemAppearance?` | The host's theme settings |
| `webviewUpdateLocaleCommand` | `{ locale, systemLocale? }` | The host's language setting |
| `webviewUpdateReadonlyCommand` | `boolean` | Whether the view is read-only |

In `hostSaveValueCommand` a host writes and compares `value`, the storage form, and hands
`runtimeValue` to a second view or a joining agent, never writing it. With `changed` false (a
scroll the file does not keep) it writes nothing and marks nothing modified; a hub still
counts the save it waits for. Both import commands name the file `type` (`json`, `sql`,
`graphql`, `dbml` or `aml`) and may carry `mode`, an `ImportMode` (`'replace' | 'append'`) the
editor names only for Import and Add; an absent `mode` replaces.

### Theme and display language

`ThemeOptions` is `{ appearance, grayColor, accentColor }`. `Appearance` (`dark`, `light`),
`GrayColor` (six) and `AccentColor` (26) are `as const` maps of the allowed values, and
`appearance` also takes `'auto'`. IntelliJ's host names what `'auto'` shows in
`webviewUpdateThemeCommand`'s `systemAppearance`. Left out, the page keeps the one named before, or
asks its `resolveAppearance`, or shows dark.

Both locale commands carry a `locale` field, a `LocaleSetting`: one of the 25 `Locale` codes
`LocaleLabel` maps to its native name, in the editor's picker order, or `'auto'`, the editor's
System, which follows the host's UI language. `webviewUpdateLocaleCommand` names that language as
a BCP 47 tag in `systemLocale`; left out, the page keeps the one it has.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/webview-bridge --fail-if-no-match test
pnpm --filter ./packages/webview-bridge --fail-if-no-match test:coverage
pnpm --filter ./packages/webview-bridge --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/webview-bridge --fail-if-no-match build
```

Only `test` runs `tsc --noEmit` before Vitest. The rules for changing the package, and the checks
a change runs, are in [AGENTS.md](./AGENTS.md).
