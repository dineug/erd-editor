# intellij-webview

> Entity-Relationship Diagram Editor [IntelliJ Plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor)

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-intellij.png?raw=true)

The web bundle rendered inside the IntelliJ plugin's editor panel. It hosts the
`<erd-editor>` element and talks to the JVM host through `window.cefQuery`, using the
command protocol from `@dineug/erd-editor-vscode-bridge`.

This package is internal to the erd-editor monorepo and is never published to npm. It is
a build artifact: no package in this repository imports it, and its only consumer is
[`packages/intellij-plugin`](../intellij-plugin), which packages the bundle onto the plugin's
classpath.

## For users

There is nothing here to install. Install the
[ERD Editor plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor) from the
JetBrains Marketplace, then create an empty file with a `.erd.json` extension and open it
in your IDE.

## Build

There is one output and it is the plugin's resources directory —
`../intellij-plugin/src/main/resources/assets` — which the build empties first, because
stale hashed bundles left there are packaged into the plugin jar.

```sh
pnpm exec vp run --filter @dineug/erd-editor-intellij-webview --fail-if-no-match build

pnpm --filter @dineug/erd-editor-intellij-webview dev
pnpm --filter @dineug/erd-editor-intellij-webview typecheck
```

`dev` serves the bundle in an ordinary browser, where `window.cefQuery` is undefined —
host round trips have to be exercised from a sandbox IDE
(`cd ../intellij-plugin && ./gradlew runIde`).

## Guides

Editor usage is documented in the [guides](https://docs.erd-editor.io/docs/category/guides).
