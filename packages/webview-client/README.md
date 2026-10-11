# webview-client

> The editor mounted into an IDE webview, with the host protocol wired

`mountWebview(host)` puts the `<erd-editor>` element into an IDE webview and wires the whole host
protocol: the `@dineug/erd-editor-webview-bridge` commands in both directions, the replica worker
that `createReplicationStoreWorker` from `@dineug/erd-editor-replication-store-worker` spawns, and
file export to the host as base64. The editor spawns its other workers itself (highlighting,
layout, image export). [`vscode-webview`](../vscode-webview) and
[`intellij-webview`](../intellij-webview), the webview bundles of the VS Code extension and the
IntelliJ plugin, are thin adapters over it: each passes a `WebviewHost`, and the VS Code one also
waits for its worker sources before mounting and calls `refreshAppearance()` when VS Code changes
the theme it writes on `<body>`. The Obsidian plugin mounts the editor in its own view without it.
The package is private and never published to npm: both bundles list it in `dependencies` as
`"@dineug/erd-editor-webview-client": "workspace:*"`.

## Usage

```ts
import { type AnyAction, Appearance } from '@dineug/erd-editor-webview-bridge';
import { mountWebview } from '@dineug/erd-editor-webview-client';

// What your host provides
declare function sendToHost(action: AnyAction): void;
declare function isHostThemeLight(): boolean;

const client = mountWebview({
  dispatch: sendToHost,
  workerName: 'my-host/replication-store-worker',
  // omit for dark
  resolveAppearance: () => (isHostThemeLight() ? Appearance.light : Appearance.dark),
  // omit to keep the editor's own file input
  importFile: true,
  onMounted: () => document.querySelector('#loading')?.remove(),
});

// when the host's theme changes
client.refreshAppearance();
```

`WebviewHost`, the argument:

- `dispatch` — sends one action to the host over its transport.
- `workerName` — the replica worker's name, one per host.
- `resolveAppearance` — optional: what `'auto'` shows on this host until a theme update names
  it; dark when omitted.
- `importFile` — optional: `true` hands the editor's import file picker to the host as
  `hostImportFileCommand`; otherwise the editor's own file input imports.
- `onMounted` — optional: runs once the editor is in the document, where a host clears its
  placeholder.

`WebviewClient`, the result: `editor` (the element), `refreshAppearance()` (hands the editor what
`'auto'` shows again, for a host whose theme moved) and `dispose()`.

`mountWebview` sends `hostInitialCommand` at once and adds the editor to `document.body` only when
the host answers with `webviewInitialValueCommand`, with the theme builder, the language picker
and the Welcome screen turned on. A host that never answers shows no editor. Every file the editor
exports (`.erd.json`, `.sql`, generated code, PNG, SVG) goes to the host as base64 in
`hostExportFileCommand`, whether or not `importFile` is set, and both hosts answer it with a save
dialog; a copy to the clipboard stays in the page.

The host speaks `'auto'` for the theme and the display language; the editor shows it as System in
the theme builder and the language picker, and a System pick comes back to the host as `'auto'`.
For the theme, System shows the last `systemAppearance` a theme update named (IntelliJ names the
IDE's light or dark), else `resolveAppearance()`. For the language, it shows the last
`systemLocale` a locale update named (both hosts name the IDE's UI language), else the browser's
languages.

`dispose()` removes the host and worker message listeners, the bridge commands and the editor's
theme and language listeners, and terminates the replica worker.

The two adapters, [`vscode-webview/src/main.ts`](../vscode-webview/src/main.ts) and
[`intellij-webview/src/main.ts`](../intellij-webview/src/main.ts), show what differs between
hosts. The commands themselves are listed in [`webview-bridge`](../webview-bridge).

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/webview-client --fail-if-no-match test
pnpm --filter ./packages/webview-client --fail-if-no-match test:coverage
pnpm --filter ./packages/webview-client --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/webview-client --fail-if-no-match build
```

The `test` task builds the workspace dependencies, then runs `tsc --noEmit` and the happy-dom spec
`src/mountWebview.test.ts`. `test:coverage` (the spec with coverage) and `test:dev` (watch mode)
run Vitest alone, so run them after the `test` task has built those dependencies. Neither webview
bundle has a spec of its own: `pnpm --filter vuerd-vscode --fail-if-no-match e2e` drives the built
VS Code bundle end to end, and the IntelliJ page is checked in the sandbox IDE with
`./gradlew runIde` in `packages/intellij-plugin`, after `pnpm build` or `./gradlew buildWebview`,
since `runIde` does not build the page. The rules for changing the package, and the checks a
change runs, are in [AGENTS.md](./AGENTS.md).
