<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# vite-plugin-r-html (`@dineug/vite-plugin-r-html`)

## Purpose

A Vite plugin that gives `@dineug/r-html` components hot module replacement. It parses each matched
module with Babel, decides whether the module is an HMR _boundary_ (i.e. its named exports are all
component-shaped), and if so appends an `import.meta.hot.accept` block that dispatches a
`hmr:r-html` `CustomEvent` carrying the original and replacement components. `r-html`'s
`src/render/hmr.ts` listens for that event and swaps the component in place.

Used only during development: `packages/erd-editor/vite.config.ts` enables it when
`command === 'serve'` and the lib mode target is active.

## Key Files

| File              | Description                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `src/index.ts`    | The entire plugin — `rHtml(options)` returning a Vite `Plugin` with a `transform` hook    |
| `vite.config.mts` | `run.tasks` `build` plus a CJS-only lib build (`formats: ['cjs']`) with `vite-plugin-dts` |
| `tsconfig.json`   | Extends the root app config; `include: ["src"]` mirrors the `build` task's `input`        |

### Options

| Option    | Default                | Meaning                                        |
| --------- | ---------------------- | ---------------------------------------------- |
| `include` | _(none)_               | Passed to `@rollup/pluginutils` `createFilter` |
| `exclude` | `'**/node_modules/**'` | Modules never transformed                      |

## For AI Agents

### Working In This Directory

- The plugin is named `vite:r-html-refresh` and runs in the `transform` hook. It parses with
  `@babel/core` (`ast: true, code: false`) purely to inspect the export shape — it never re-emits
  Babel's output, so it must not be relied on for syntax downleveling.
- Boundary detection walks `ExportNamedDeclaration` nodes; a module with a non-component named export
  is not a boundary and is left untouched. Loosening that check causes stale-component bugs rather
  than build errors, so change it deliberately.
- The injected snippet builds `import.meta.hot` from string fragments
  (`` `${'import'}.${'meta'}.${'hot'}` ``) on purpose — writing it literally would let Vite's own
  scanner rewrite it. Keep the indirection.
- This is the only _library_ package that is CommonJS-shaped (no `"type": "module"`), because it runs
  inside Vite's Node process — hence `formats: ['cjs']` and `main: "./dist/index.js"`. Its build
  config is still named `vite.config.mts`, but that extension no longer buys anything: the four
  app-shaped packages (`app`, `intellij-webview`, `vscode-extension`, `vscode-webview`) are
  CommonJS-shaped too and all load a plain `vite.config.ts`. ⚠️ Renaming it is not free — the root
  `tsconfig.json` `include` list names `packages/*/vite.config.mts` as its own line, and dropping out
  of that list removes this config from the type gate silently.
- `private: true`; `@babel/core` and `@rollup/pluginutils` are real runtime `dependencies` here, not
  dev deps. The `external` RegExp in the build config is derived from `dependencies` +
  `peerDependencies`, so a new runtime dep stays out of the bundle without further edits.
- `vite.config.mts` carries the `run.tasks` block that replaced `nx.json`'s `targetDefaults`. The one
  task is `build`: `command: ['tsc --noEmit', 'vp build']` (the array is sequential, and each element
  is its own cache unit), `dependsOn` a `build` from all three dependency fields, and
  `output: ['dist/**']`. ⚠️ Dropping `output` does not fail — a cache hit replays the terminal log
  without restoring `dist/`, and `packages/erd-editor/vite.config.ts` then cannot resolve
  `import rHtml from '@dineug/vite-plugin-r-html'` at all, because `main` points into `dist/`.
- The `dependsOn` edge resolves to **zero** packages here: none of this package's dependencies are
  workspace packages. It is spelled out anyway so every package's block reads the same — `from` has
  to list `devDependencies` because every workspace edge in this repo lives there, and leaving it at
  the default empties the graph into a green build against stale `dist/`.
- The `input` list is explicit — `{ auto: true }`, `src/**`, `package.json`, `tsconfig.json`, the
  workspace-based `tsconfig.app.json`, minus `**/*.tsbuildinfo` and `dist/**` — because TypeScript
  7's `tsc` is a Go native binary and Vite Task's automatic file tracking never sees what it reads.
  ⚠️ `tsconfig.json` is `include: ["src"]`; widen one and the other has to widen with it, or the
  typecheck quietly stops re-running on the files you just added. `scripts/check-task-inputs.mjs`
  (part of `pnpm check`) only enforces the workspace-dependency `.d.ts` globs, and this package has
  none — so nothing checks that pair for you.
- `tsc --noEmit` is the type gate. It replaced `@rollup/plugin-typescript`, which was configured here
  with `noEmitOnError: true, noForceEmit: true` — a pure diagnostic pass that emitted nothing.
- `build.target` is `BROWSER_TARGET` from the root `build-target.ts` — the same import every other
  Vite lib-mode package here makes, nine configs in all. This bundle only ever runs in Vite's Node
  process, but the floor lives in one file so no package drifts off it on its own.
- ⚠️ The root `tsconfig.json` — the program `pnpm check` typechecks — carries a `paths` entry
  resolving `@dineug/vite-plugin-r-html` to `./packages/vite-plugin-r-html/src/index.ts`. It is the
  only entry in that map, and it exists because `packages/erd-editor/vite.config.ts` imports this
  plugin while the `check` CI job never builds anything. Without it the job is red on a fresh runner
  and green on any machine that happens to have a `dist/` lying around.
- `dts` is wrapped in `lazyPlugins(() => [...])` (as in the seven other library configs). `vp run`,
  `vp lint` and `vp fmt` load this config purely to read a non-plugin block — `run.tasks`, `lint`,
  `fmt` — and the wrapper lets them skip the plugin factory while that resolution is in flight.

### Testing Requirements

- No `test` task, and `package.json` has an empty `"scripts": {}`. The only entry point is
  `vp run --filter @dineug/vite-plugin-r-html --fail-if-no-match build`; there is no
  `pnpm --filter @dineug/vite-plugin-r-html build`. ⚠️ Keep `--fail-if-no-match` — a filter that
  matches no package exits 0 by default, so a typo in the package name reads as a pass.
- Verify by running the editor dev server — `pnpm --filter @dineug/erd-editor dev` — editing a
  component under `packages/erd-editor/src/components/`, and confirming the DOM updates without a
  full reload.
- A silent failure mode is "HMR falls back to full reload"; check the browser console for the
  `hmr:r-html` event when debugging.
- `vite.config.mts` itself is typechecked by the root `pnpm check`, whose `tsc --noEmit` program
  includes `packages/*/vite.config.mts`. That is what catches a typo inside the `run.tasks` block —
  `from: ['devDependencie']`, `input: ['scr/**']` — which would otherwise narrow the graph or the
  cache key with nothing turning red.

### Common Patterns

- Single-file plugin. Keep it that way unless the AST logic grows past readability.
- `// @ts-ignore` on the Babel import and AST access is intentional — `@babel/core` types are not
  installed.

## Dependencies

### Internal

Pairs with `@dineug/r-html` (`src/render/hmr.ts`) but does not import it.

### External

- `@babel/core` — parsing modules to an AST (runtime dependency)
- `@rollup/pluginutils` — `createFilter` (runtime dependency)
- `vite` — dev dependency, used only for `import type { Plugin }`. ⚠️ The workspace catalog aliases
  the `vite` specifier to `npm:@voidzero-dev/vite-plus-core`, so there is no `node_modules/.bin/vite`
  and no raw `vite build` to run — the binary is `vp`
- `vite-plus` — `defineConfig` and `lazyPlugins` in the build config
- `vite-plugin-dts` + `@typescript/typescript6` — the `.d.ts` emit. The pinned TypeScript 6 is there
  because `vite-plugin-dts` still uses the JS Compiler API that TypeScript 7 removed
- `typescript` `7.0.2` — the `tsc --noEmit` gate; pinned workspace-wide by `pnpm-workspace.yaml`
  `overrides`

### Consumers

`@dineug/erd-editor` (dev/serve only). Its `build` and `test` tasks also track
`packages/vite-plugin-r-html/dist/**/*.d.ts` as an `input`, so a rebuild here re-runs that package's
typecheck; `scripts/check-task-inputs.mjs` is what keeps those two globs from rotting.

<!-- MANUAL: -->
