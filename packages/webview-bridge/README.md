# webview-bridge

> Typed command protocol between an editor host and its webview

Internal to the erd-editor monorepo. It is not published to npm; other packages depend on
it as `"@dineug/erd-editor-webview-bridge": "workspace:*"`.

## No transport

`Bridge` never sends anything. `Bridge.executeCommand(command, payload)` returns a plain
`{ type, payload }` action, and `bridge.executeAction(action)` fans a received one out to
the listeners registered for its `type`. Moving that object across is the caller's job —
which is why the IntelliJ webview imports this same "vscode" bridge even though it talks
over `window.cefQuery`. Payloads must survive `JSON.stringify`; binary data is
base64-encoded by the caller.

## Usage

The webview side, over `postMessage`:

```ts
import {
  type AnyAction,
  Bridge,
  hostInitialCommand,
  webviewInitialValueCommand,
} from '@dineug/erd-editor-webview-bridge';

const bridge = new Bridge();
const vscode = acquireVsCodeApi();

// host → webview: subscribe, and feed the transport into the bridge
const dispose = bridge.registerCommand(webviewInitialValueCommand, ({ value }) => {
  editor.setInitialValue(value); // the <erd-editor> element
});
window.addEventListener('message', (event: MessageEvent<AnyAction>) => {
  bridge.executeAction(event.data);
});

// webview → host: build an action and hand it to the transport
vscode.postMessage(Bridge.executeCommand(hostInitialCommand, undefined));
```

The host is the mirror image: its own `Bridge`, `registerCommand(hostInitialCommand, ...)`,
and `webview.postMessage(Bridge.executeCommand(webviewInitialValueCommand, { value }))`.
`registerCommand` returns a `Dispose`; `Bridge.mergeRegister(...disposes)` collapses many.

## Commands and theme

`src/commands.ts` is the shared catalogue, and the prefix encodes direction: `host*` is
handled by the host (initial, save value, save theme, save replication, import/export file),
`webview*` by the webview (initial value, import file, update theme, update readonly,
replication). Mint your own with `createCommand<Payload>('someType')` — listeners are keyed
by that string, not by token identity. `ThemeOptions` is what `hostSaveThemeCommand` carries
and `webviewUpdateThemeCommand` a `Partial` of; `Appearance` (`appearance` also takes
`'auto'`), `GrayColor` and `AccentColor` are the maps of its allowed values.

## Development

```sh
pnpm exec vp run --filter @dineug/erd-editor-webview-bridge --fail-if-no-match test
pnpm --filter @dineug/erd-editor-webview-bridge test:coverage
```
