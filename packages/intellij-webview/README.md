# intellij-webview

> The bundle inside the IntelliJ plugin's editor panel

`@dineug/erd-editor-intellij-webview` is the page the IntelliJ plugin's editor panel loads in
JCEF. Its code is one call: `src/main.ts` hands a `WebviewHost` to `mountWebview` from
[`webview-client`](../webview-client), which mounts the `<erd-editor>` element and wires the
[`webview-bridge`](../webview-bridge) commands and the replica worker. The page sends to the JVM
host through `window.cefQuery`, one JSON string per action, and the host's commands arrive as
`window.postMessage` calls the plugin runs in the page (`WebviewScripts.kt`). The package is
private and never published to npm, and no package imports it; its one workspace dependency is
`"@dineug/erd-editor-webview-client": "workspace:*"`.
[`intellij-plugin`](../intellij-plugin), a Gradle project that declares no pnpm dependency on this
package, packages its output into the plugin jar and serves it from the classpath at
`https://erd-editor-jetbrains-plugin`. The plugin and its Marketplace listing live there.

## Usage

The package has no `src/index.ts`; its entry and output:

- **`index.html`** — the build entry, at the package root; it loads `src/main.ts`.
- **`src/main.ts`** — imports `core-js/stable` and `src/webview.css`, then calls `mountWebview`
  with two fields: `dispatch`, which sends each action as
  `window.cefQuery({ request: JSON.stringify(action), persistent: false, … })`, and `workerName`,
  the replica worker's name. It sets no `importFile`, so the editor's own file input imports, and
  no `resolveAppearance`, since the plugin names the IDE's light or dark in every theme update.
- **`src/webview.css`** — body sizing and a `prefers-color-scheme` background shown until the
  editor mounts.
- **`src/env.d.ts`** — the `window.cefQuery` and `window.cefQueryCancel` types, and
  `declare module '*.css'` for the stylesheet import.
- **Output** — `../intellij-plugin/src/main/resources/assets`, gitignored there. It holds
  `index.html`, `static/js/bundle.<hash>.js`, `static/css/bundle.<hash>.css`, and each worker as
  `static/js/<name>.<hash>.js` (the editor's three SharedWorkers and the replica worker), which
  the page loads from their URLs on the plugin's origin.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/intellij-webview --fail-if-no-match build
pnpm --filter ./packages/intellij-webview --fail-if-no-match typecheck
pnpm --filter ./packages/intellij-webview --fail-if-no-match dev
```

The package has no `test` task and no spec. The `build` task builds the workspace dependencies,
then runs `tsc --noEmit` and `vp build` into the plugin's assets directory; `pnpm build` runs it
too. `typecheck` runs the same `tsc --noEmit` alone and builds nothing: it reads `webview-client`'s
built `dist/*.d.ts`, so on a fresh tree run the build first. `dev` builds the workspace
dependencies and serves the page from the Vite dev server in an ordinary browser, where
`window.cefQuery` is undefined: `mountWebview`'s first dispatch throws, and since the editor mounts
only once the host sends its value, the page stays blank.

Check a change in a sandbox IDE instead: run the build, then `./gradlew runIde` from
`packages/intellij-plugin`, and open a `.erd.json` file. `runIde` and `buildPlugin` never build the
bundle and only check that `assets/index.html` exists, so without a build they use the bundle
built last. Before packaging the plugin, run `pnpm cache:clear` from the repository root and build
again: a build replayed from the cache restores its files without emptying the directory, so
hashed files left there by another build can ship in the jar.

The rules for changing the package, and the checks a change runs, are in [AGENTS.md](./AGENTS.md).
