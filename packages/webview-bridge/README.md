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

## Commands, theme and display language

`src/commands.ts` is the shared catalogue, and the prefix encodes direction: `host*` is
handled by the host (initial, save value, save theme, save locale, save replication,
import/export file), `webview*` by the webview (initial value, import file, update theme,
update locale, update readonly, replication). Mint your own with
`createCommand<Payload>('someType')` — listeners are keyed by that string, not by token
identity. `ThemeOptions` is what `hostSaveThemeCommand` carries and
`webviewUpdateThemeCommand` a `Partial` of; `Appearance` (`appearance` also takes `'auto'`),
`GrayColor` and `AccentColor` are the maps of its allowed values. A host that knows outside
the page what `'auto'` shows adds it to `webviewUpdateThemeCommand` as `systemAppearance`.

`hostSaveLocaleCommand` and `webviewUpdateLocaleCommand` carry the display language as a
`LocaleSetting`: one of the 25 codes `LocaleLabel` maps to its native name, in the editor's
picker order, or `'auto'`, which follows the host's own UI language. A host names that
language as a BCP 47 tag in `webviewUpdateLocaleCommand`'s `systemLocale`; left out, the page
keeps the one it has. Neither command touches the document or its replica.

## Development

```sh
pnpm exec vp run --filter @dineug/erd-editor-webview-bridge --fail-if-no-match test
pnpm --filter @dineug/erd-editor-webview-bridge test:coverage
```
