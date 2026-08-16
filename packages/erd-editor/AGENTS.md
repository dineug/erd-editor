<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# erd-editor (`@dineug/erd-editor`)

## Purpose

**The editor core** — the largest and most important package in the workspace (642 `.ts` files under
`src/`: 313 source modules plus `vite-env.d.ts`, 313 colocated `*.test.ts`, 15 `*.stories.ts`),
published to npm as `@dineug/erd-editor` (v3.3.1). It defines the `<erd-editor>` custom element that
every surface (web app, VSCode webview, IntelliJ webview) embeds.

It is a framework-free Web Component: rendering goes through `@dineug/r-html`, state through a
Redux-like store whose action stream is processed with RxJS, and persistence through
`@dineug/erd-editor-schema`. There is no React here.

### The three-layer architecture

```
components/   Web Components (r-html FC) — canvas, tables, panels, primitives
    ↕ appContext (r-html context: store, actions, keyBindingMap, shortcut$, keydown$, emitter)
engine/       store → rx-store → shared-store / replication-store
    ↕ actions carry a `version` from Clock and an optional Tag
schema        @dineug/erd-editor-schema — state shape, LWW merge, serialization
```

### How state actually flows

1. A component dispatches through `appContext.store`. `dispatch` defers through `asap()`;
   `dispatchSync` does not.
2. `rx-store.ts` stamps every action with `clock.getNextVersion()` and flattens composition/generator
   actions (`compositionActionsFlat`), then pushes the array onto the `dispatch$` subject.
3. `dispatch$` feeds two pipelines, and a third observes the store directly:
   - **`history$`** — `actionsFilter(HistoryActionTypes)` → `ignoreTagFilter([changeOnly, shared])` →
     `readonlyIgnoreFilter` → `groupByStreamActions`, which regroups streaming actions into `@@move`,
     `@@scroll` and `@@color` so a drag becomes one undo entry. Subscribed by `pushHistory`.
   - **`dispatch$.pipe(readonlyIgnoreFilter(...))` → `store.dispatchSync`** — the actual reducer
     application.
   - **`change$`** — built from `store.subscribe`, filtered to `ChangeActionTypes` and debounced
     200 ms; the "document changed" signal hosts subscribe to for autosave.
4. A second `store.subscribe` (`mergeClock`) — `rx-store.ts` has exactly two — folds every observed
   `action.version` back into `Clock`, which is what keeps the Lamport counter ahead of every peer it
   has heard from.
5. `shared-store.ts` mirrors `SharedActionTypes` out to peers (live collaboration, cross-tab) through
   `sharedStreamActionsCompressor` + `bufferCircuitBreaker`, stamps outbound actions with
   `Tag.shared` plus `meta.editorId`/`meta.nickname`, and merges incoming remote actions back in. On
   first subscribe it emits `editor.getLWW`, and answers a peer's `getLWW` with `editor.mergeLWW`.
6. `replication-store.ts` runs the same reducers **headlessly** (`createStore(ctx, false)` — no
   observable state, no DOM) so a host process can keep an authoritative document copy — this is what
   the VSCode extension and IntelliJ plugin replicate into.

**`Tag`** (`engine/tag.ts`) is how an action's provenance is expressed — a bitmask of `Tag.shared`
(came from / is going to a peer), `Tag.changeOnly` (should not create history) and `Tag.following`
(a viewport action a follower should mirror; see `SharedFollowingActionTypes`). Filters in
`engine/rx-operators/` act on these.

## Key Files

| File                                           | Description                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`                                 | Public entry — side-effect-imports `customElementRegistry`, re-exports `ErdEditorElement` as a **type-only** export, and the three injection points (`setGetShikiServiceCallback`, `setExportFileCallback`, `setImportFileCallback`). Six lines total; that is the entire public surface                                                         |
| `src/engine/index.ts`                          | The second published entry (`@dineug/erd-editor/engine.js`) — exports only `createReplicationStore` + its `ReplicationStore` type                                                                                                                                                                                                                |
| `src/index.dev.ts`                             | Dev-server entry (`vp dev --mode lib`) — wires the shiki service, `hmr()` and a `stats.js` FPS meter                                                                                                                                                                                                                                             |
| `src/components/erd-editor/ErdEditor.ts`       | The custom element itself (`shadow: 'closed'`); defines the full `ErdEditorElement` API (`value`, `focus`, `blur`, `clear`, `destroy`, `setInitialValue`, `setPresetTheme`, `setTheme`, `setKeyBindingMap`, `setSchemaSQL`, `getSchemaSQL`, `getSharedStore`, `setDiffValue`) and the `readonly` / `systemDarkMode` / `enableThemeBuilder` props |
| `src/components/appContext.ts`                 | `createAppContext` — `EngineContext` extended with `store` (the RxStore), `actions`, `keyBindingMap`, `shortcut$`, `keydown$`, and `emitter`; provided via `useProvider`/`useAppContext`. `appDestroy` is the matching teardown                                                                                                                  |
| `src/components/customElementRegistry.ts`      | A single side-effect `import '@/components/erd-editor/ErdEditor'`. The one and only `defineCustomElement` call lives in `ErdEditor.ts`; this file is just the hook that makes importing `src/index.ts` register `<erd-editor>`                                                                                                                   |
| `src/engine/store.ts`                          | `createStore` — combines the eight module reducers over `{ ...schemaV3Parser({}), editor: createEditor(), lww: {} }`                                                                                                                                                                                                                             |
| `src/engine/rx-store.ts`                       | `createRxStore` — the pipeline described above, plus `undo`/`redo`/`history`/`change$` and `HISTORY_LIMIT = 2048`                                                                                                                                                                                                                                |
| `src/engine/shared-store.ts`                   | Collaboration boundary — outbound/inbound action mirroring, LWW handshake                                                                                                                                                                                                                                                                        |
| `src/engine/replication-store.ts`              | Headless store for host processes                                                                                                                                                                                                                                                                                                                |
| `src/engine/actions.ts`                        | Merges all module actions and declares the action-type classifications (`ChangeActionTypes`, `HistoryActionTypes`, `StreamActionTypes`, `SharedActionTypes`, `SharedStreamActionTypes`, `SharedFollowingActionTypes`, `ReadonlyIgnoreActionTypes`, the `StreamRegroup*` groups)                                                                  |
| `src/engine/clock.ts`                          | Lamport-style version counter with `merge(remoteVersion)`                                                                                                                                                                                                                                                                                        |
| `src/engine/history.ts` / `history.actions.ts` | Undo/redo stack (`createHistory`) and the per-action-type undo/redo recipes (`pushUndoHistoryMap`, `pushStreamHistoryMap`)                                                                                                                                                                                                                       |
| `src/engine/hooks.ts` / `store-hooks.ts`       | The `Hook` / `HookEffect` contract, and `createHooks` which routes matching actions into a per-hook rxjs `Subject`                                                                                                                                                                                                                               |
| `src/engine/context.ts`                        | `EngineContext` — what reducers and generator actions can reach (`clock`, `toWidth`)                                                                                                                                                                                                                                                             |
| `src/internal-types/index.ts`                  | The package-internal type vocabulary (`Table`, `Column`, `Doc`, `Point`, `Unsubscribe`, `Ctx`, `DeepPartial`, …) derived from `ERDEditorSchemaV3`                                                                                                                                                                                                |
| `vite.config.ts`                               | The `run.tasks` `build`/`test` definitions (both lead with `tsc --noEmit`), two lib entries (`erd-editor`, `engine`), `build.target` from the root `build-target.ts`, banner injection, `__APP_VERSION__` define, r-html HMR on serve, dts on build, `server.open` disabled under `E2E`                                                          |
| `tsconfig.json`                                | `include: ["src"]` — the program `tsc --noEmit` gates. That is **all** of `src/`, `*.test.ts` and `src/__test-utils__/` included; widening it means widening the tasks' `input` globs too                                                                                                                                                        |
| `tsconfig.build.json`                          | What `vite-plugin-dts` reads — `tsconfig.json` minus `src/**/*.test.ts` and `src/__test-utils__/**`, so test helpers never reach `dist/`. It is no longer a type gate; `tsc --noEmit` is                                                                                                                                                         |
| `vitest.config.ts`                             | `defineConfig` from `vite-plus` — `src/**/*.test.ts` in happy-dom, `@` alias, `__APP_VERSION__` define, v8 coverage with **per-file** 80% thresholds                                                                                                                                                                                             |
| `vitest.setup.ts`                              | Polyfills the browser globals happy-dom lacks — `ResizeObserver`, `IntersectionObserver`, `matchMedia`, `requestIdleCallback`                                                                                                                                                                                                                    |
| `playwright.config.ts`                         | Chromium-only, pinned 1440x900 dark viewport, `webServer` = `pnpm exec vp dev --mode lib` on `E2E_PORT` (5174)                                                                                                                                                                                                                                   |
| `e2e/README.md`                                | The traps, gesture cheat sheet and determinism rules for the e2e suite — read before touching `e2e/`                                                                                                                                                                                                                                             |
| `environment/.env.lib`                         | `VITE_TARGET='lib'` — what `--mode lib` loads to gate the lib build/serve path in `vite.config.ts`                                                                                                                                                                                                                                               |

## Subdirectories

| Directory                                                                                                                 | Purpose                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/modules/`                                                                                                     | Eight state modules, one per entity: `editor`, `table`, `table-column`, `memo`, `relationship`, `settings`, `index`, `index-column`                                                                                                                                                |
| `src/engine/rx-operators/`                                                                                                | Custom RxJS operators — `actionsFilter`, `ignoreTagFilter`, `readonlyIgnoreFilter`, `groupByStreamActions`, `sharedStreamActionsCompressor`, `bufferCircuitBreaker`, `notEmptyActions`                                                                                             |
| `src/components/erd/`                                                                                                     | The diagram surface — `canvas/`, `minimap/`, `drag-select/`, `erd-context-menu/`, `table-properties/`, `automatic-table-placement/`, `virtual-scroll/`, `time-travel/`, `diff-viewer/`, `hide-sign/`, plus `useErdShortcut.ts` and `erdShortcutPerformCheck.ts`                    |
| `src/components/erd/canvas/`                                                                                              | `table/` (with `column/` and its cell components), `memo/`, `canvas-svg/` (relationship rendering), `draw-relationship/` (the in-progress relationship line), `high-level-table/` (the simplified render below `zoomLevel <= 0.7`), `shared-mouse-tracker/` (peer cursors)         |
| `src/components/primitives/`                                                                                              | The design system — button, icon, kbd, sash, separator, slider, switch, text-input, edit-input, toast, color-picker, code-block, context-menu, highlighted-text                                                                                                                    |
| `src/components/schema-sql/`                                                                                              | SQL DDL panel and its context menu                                                                                                                                                                                                                                                 |
| `src/components/generator-code/`                                                                                          | Code-generation panel and its context menu                                                                                                                                                                                                                                         |
| `src/components/visualization/`                                                                                           | Relationship-graph visualization view (`createVisualization.ts` drives the d3 layout)                                                                                                                                                                                              |
| `src/components/quick-search/`, `settings/`, `toolbar/`, `theme/`, `theme-builder/`, `toast-container/`, `global-styles/` | Supporting UI surfaces                                                                                                                                                                                                                                                             |
| `src/utils/schema-sql/`                                                                                                   | DDL generators per vendor — `MySQL`, `MariaDB`, `PostgreSQL`, `MSSQL`, `Oracle`, `SQLite`                                                                                                                                                                                          |
| `src/utils/generator-code/`                                                                                               | Code generators — `typescript`, `java`, `jpa`, `kotlin`, `csharp`, `scala`, `graphql`                                                                                                                                                                                              |
| `src/utils/schema-sql-parser/`                                                                                            | Maps `@dineug/schema-sql-parser` AST onto editor actions (SQL import)                                                                                                                                                                                                              |
| `src/utils/collection/`                                                                                                   | Typed entity accessors over the v3 collections, plus `sequence.ts`                                                                                                                                                                                                                 |
| `src/utils/draw-relationship/`                                                                                            | Relationship line geometry — `calc`, `draw`, `pathFinding`, `sort`                                                                                                                                                                                                                 |
| `src/utils/table-clipboard/`                                                                                              | Copy/paste of table selections                                                                                                                                                                                                                                                     |
| `src/utils/file/`                                                                                                         | `exportFile.ts` / `importFile.ts` — the host-overridable file IO callbacks                                                                                                                                                                                                         |
| `src/utils/rx-operators/`                                                                                                 | DOM-event observables — `fromDraggable`, `fromShadowDraggable`, `fromCopy`, `fromPaste`, `takeUnsubscribe`                                                                                                                                                                         |
| `src/utils/keyboard-shortcut/`                                                                                            | `KeyBindingMap` / `KeyBindingName` and a hand-written `parseKeybinding`. The `tinykeys` call itself is in `src/hooks/useKeyBindingMap.ts`, not here                                                                                                                                |
| `src/utils/device-detect/`                                                                                                | `@egjs/agent` wrappers — `hasAppleDevice()`, `hasMacintosh()`, `hasChrome()`, … Values start from the sync agent and are **refined asynchronously** by `getAccurateAgent`                                                                                                          |
| `src/services/schema-gc/`                                                                                                 | Garbage collection of orphaned entities (`procGC.ts`), in a dedicated (`schemaGC.worker.ts`) and shared-worker (`schemaGC.shared-worker.ts`) flavour, fronted by `schemaGCService.ts`                                                                                              |
| `src/services/shikiService.ts`                                                                                            | The `setGetShikiServiceCallback` injection point                                                                                                                                                                                                                                   |
| `src/constants/`                                                                                                          | `schema`, `layout`, `open`, `language`, and `sql/` (database vendors and per-vendor data types)                                                                                                                                                                                    |
| `src/themes/`                                                                                                             | `tokens.ts` (the `Theme` shape, `ThemeTokens` list and `themeToTokensString`), `radix-ui-theme.ts` (`createTheme`, `Appearance`/`GrayColor`/`AccentColor`), `radix-ui-theme.config.ts`, `textColor.ts`                                                                             |
| `src/styles/`                                                                                                             | Global style fragments — reset, typography, fonts, scrollbar, color picker                                                                                                                                                                                                         |
| `src/hooks/`                                                                                                              | `useDarkMode`, `useFlipAnimation`, `useKeyBindingMap`, `useUnmounted`                                                                                                                                                                                                              |
| `src/internal-types/`                                                                                                     | Package-internal types only; nothing here is published                                                                                                                                                                                                                             |
| `src/__test-utils__/`                                                                                                     | Vitest-only helpers — `createTestAppContext`, `mount` / `mountAndFlush` (renders a template under a real `appContext` provider), `flush(ticks)`. Excluded from the build and from coverage                                                                                         |
| `e2e/`                                                                                                                    | Playwright suite — `fixture/` (the deterministic mount page), `support/` (`ErdEditorPage` page object, `fixtures.ts`, `schema.ts` seeds, `shortcuts.ts`), `specs/` (`harness`, `keyboard`, `mouse-drag`, `relationship`, `zoom-overlay`), `README.md`, and its own `tsconfig.json` |
| `.storybook/`                                                                                                             | Storybook 10 (`@storybook/html-vite`) config; `preview.ts` mounts each story inside an open shadow root wrapped by `ThemeProvider`, with gray/accent/appearance toolbar globals. Stories live beside components as `*.stories.ts`                                                  |
| `environment/`                                                                                                            | `.env.lib` — sets `VITE_TARGET=lib`, which gates the lib build in `vite.config.ts`                                                                                                                                                                                                 |

### Engine module layout

Every module under `src/engine/modules/<name>/` follows the same four-file shape, plus an optional
fifth (`hooks.ts`) — five of the eight modules have only the four:

| File                   | Role                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `actions.ts`           | `ActionMap` — the action-type → payload contract                                                 |
| `atom.actions.ts`      | Action creators + reducers (the synchronous, LWW-aware state writes)                             |
| `generator.actions.ts` | `action$` generator actions for multi-step/async flows (r-html runtime)                          |
| `history.ts`           | Undo/redo recipes for this module's actions                                                      |
| `hooks.ts`             | Optional — cross-module reactions as rxjs effects (`table`, `table-column`, `relationship` only) |

`editor/` additionally owns `state.ts` (`createEditor`, the non-persisted UI slice) and `utils/`;
`table-column/` owns `utils/dataType.ts`.

## For AI Agents

### Working In This Directory

- **Adding an action is a multi-file change.** Declare it in the module's `actions.ts`, implement the
  creator + reducer in `atom.actions.ts`, add an undo/redo recipe in `history.ts` **and** register the
  type in the right lists in `src/engine/actions.ts` (`ChangeActionTypes` if it mutates the document,
  `SharedActionTypes` if peers must see it, a `StreamRegroup*` group if it fires continuously during a
  drag). Omitting the `engine/actions.ts` registration compiles fine and then silently breaks undo,
  autosave, or collaboration.
- **Reducers must go through the LWW operators** (`addOperator` / `removeOperator` / `replaceOperator`
  from `@dineug/erd-editor-schema`) using `action.version`. A reducer that writes state directly wins
  every merge regardless of ordering and will corrupt collaborative sessions.
- **Three stores, one reducer set.** `store` (plain), `rx-store` (UI, with history and RxJS), and
  `replication-store` (headless, host-side). Anything a reducer touches must work without a DOM —
  `replication-store` runs in a worker.
- **`readonly` is enforced in the pipeline, not in components.** `readonlyIgnoreFilter` drops actions
  listed in `ReadonlyIgnoreActionTypes` (derived from `ChangeActionTypes` minus the explicitly exempt
  ones). The exempt list is `hasReadonlyIgnore` in `src/engine/actions.ts` — ten `settings.*` types:
  `changeZoomLevel`, `streamZoomLevel`, `scrollTo`, `streamScrollTo`, `changeDatabase`,
  `changeCanvasType`, `changeLanguage`, `changeTableNameCase`, `changeColumnNameCase`,
  `changeBracketType`. Note `changeDatabase` is in there despite not being view-only. Don't add
  readonly guards in the UI layer.
- **Streaming actions must be regrouped.** A `table.move` per mousemove would create thousands of undo
  entries; `groupByStreamActions` collapses them into `@@move` / `@@scroll` / `@@color` groups.
- **Three host injection points** exist so the core stays environment-free:
  `setGetShikiServiceCallback`, `setImportFileCallback`, `setExportFileCallback`. Never call
  `document.createElement('input')` or `fetch` for file IO directly — VSCode and IntelliJ webviews
  cannot use browser file dialogs.
- **Two published entries.** `src/index.ts` (the element, side-effectful — it registers custom elements)
  and `src/engine/index.ts` (`createReplicationStore`, deliberately DOM-free). Never let the engine
  entry pull in a component.
- **Every dependency is a `devDependency`.** The lib build declares no `external`, so everything —
  rxjs, d3, es-toolkit, the icon packs — is bundled into `dist/erd-editor.js`. Adding a dependency adds
  to the shipped bundle for all four consumers; there is no peer-dependency escape hatch here.
- **Both `run.tasks` entries lead with `tsc --noEmit`.** `vite.config.ts` defines `build`
  (`tsc --noEmit` → `vp build --mode lib`) and `test` (`tsc --noEmit` → `vp test run`), each with
  `dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies', 'peerDependencies'] }]` —
  all three fields, because every workspace edge here is a `devDependency` and the default
  (`dependencies`) would leave the graph empty. That failure is not a red run; it is a green one
  against a stale `dist/`. ⚠️ The built-in `vp build` / `vp test` **ignore `run.tasks`** — no type
  gate, no dependency builds. Go through `vp run` unless you specifically want the raw one.
- **The tasks' `input` globs are hand-maintained.** TypeScript 7's `tsc` is a Go binary, so Vite
  Task's automatic file tracking never sees what it reads; each task therefore spells out `src/**`,
  the tsconfigs, and every workspace dependency's `dist/**/*.d.ts`. Change `tsconfig.json`'s
  `include` and the `input` lists have to move with it, or the cache key stops covering the files the
  gate reads. Only the dependency half is enforced, by `scripts/check-task-inputs.mjs` (run by
  `pnpm check`). `output: ['dist/**']` on `build` is the matching trap: drop it and a cache hit
  replays the terminal output without restoring `dist/`. Neither config file is in this package's own
  program — the root `tsconfig.json` includes `packages/*/vite.config.ts` and
  `packages/*/vitest.config.ts`, so a typo inside a `run.tasks` block is a type error at `pnpm check`
  and nowhere else.
- **`build.target` is imported from the root `build-target.ts`**, not written here. This package is
  consumed by all four surfaces and by third parties on npm, so its floor is theirs; a local `target`
  would silently split the one answer the repo commits to.
- **Components are `r-html` FCs**, not React. Use `html`/`svg`/`css` tagged templates, `observable`,
  and the `onMounted`/`onUnmounted` hooks. Styles live in a sibling `*.styles.ts` using the `css` tag.
- **Everything is inside a closed shadow root** (`shadow: 'closed'` in `ErdEditor.ts`). Use
  `queryShadowSelector` / `closestElement` from `r-html`; plain `document.querySelector` will not find
  editor internals, and neither will a Playwright locator unless the fixture reopens it.
- Subscriptions must be collected and disposed — `useUnmounted().addUnsubscribe(...)` in components,
  the `subscriptionSet` pattern in the engine. Leaks here keep whole diagrams alive.
- Prefer `src/utils/collection/` accessors over reaching into `state.collections` directly.
- `src/utils/index.ts` and the many barrels mean import cycles are easy to create; keep `engine/` from
  importing `components/`.

### Testing Requirements

- Two suites, run separately and wired to separate CI jobs:
  1. `pnpm exec vp run --fail-if-no-match --filter @dineug/erd-editor test` — the `test` task:
     `tsc --noEmit`, then `vp test run` over `src/**/*.test.ts` in happy-dom. This is what
     `pnpm test` (`vp run -r test`) at the repo root runs for this package.
     ⚠️ `pnpm --filter @dineug/erd-editor test` no longer works, and neither does the `build`
     equivalent. The tasks own those two names now, and a `package.json` script of the same name
     makes the task graph fail to load — so both scripts were deleted. `test:dev` (`vp test dev`)
     still watches and `test:coverage` (`vp test run --coverage`) still adds the v8 report with the
     80% **per-file** floor on lines/functions/branches/statements (`vitest.config.ts`), but both
     are the built-in `vp test`, which ignores `run.tasks`: no `tsc --noEmit`, no dependency builds,
     so they run against whatever is already sitting in the workspace deps' `dist/`.
  2. `pnpm --filter @dineug/erd-editor e2e` — Playwright over `e2e/specs/*.spec.ts` in Chromium,
     covering the keyboard/mouse interactions happy-dom cannot reproduce (`e2e:dev` for UI mode,
     `e2e:headed`, `e2e:report`, `e2e:typecheck`). **Read `e2e/README.md` before touching it** — the
     closed shadow root, the minimap's duplicate render and the LWW tombstones each have a trap that
     will waste an afternoon otherwise.
- **Specs import from `vite-plus/test`, never `vitest`** — all 313 of them. `vitest` stays in
  `devDependencies` because `vite-plus/test` is that engine, but a direct `from 'vitest'` import is
  not the convention here and no file uses one.
- **Test files are inside the type gate now.** `tsconfig.json` includes all of `src/`, and both tasks
  lead with `tsc --noEmit`, so a type error in a `*.test.ts` or under `src/__test-utils__/` turns the
  run red. It used to be invisible: the only build-time type check ran over `tsconfig.build.json`,
  which excludes exactly those files. That config now feeds `vite-plugin-dts` alone.
- Tests are colocated (`Foo.ts` → `Foo.test.ts`, including `*.styles.test.ts`) and mount through
  `src/__test-utils__` — `mountAndFlush(...)` plus `flush()` rather than a raw `render` call.
  `tsconfig.build.json` excludes both `*.test.ts` and `__test-utils__`, so test-only helpers never
  reach `dist/`.
- `e2e` is a plain `package.json` script, not a `run.tasks` task, so `vp run -r test` never reaches
  it and a missing browser binary can never turn the unit suite red. The script builds this package
  first (`vp run --filter @dineug/erd-editor build`) because the dev server resolves workspace deps
  to their `dist/`; Vite Task replays that from cache when it is already built. CI's `e2e` job
  installs Chromium, runs the same build, then `e2e:typecheck` and `e2e`.
  ⚠️ CI adds `--fail-if-no-match` for a reason: a `--filter` that matches no package exits **0**, so
  renaming or moving this package would leave the job green while building nothing.
- Still worth doing by hand for anything visual:
  - `pnpm exec vp run --fail-if-no-match --filter @dineug/erd-editor build` — `tsc --noEmit` then
    `vp build --mode lib`, with the dependency builds ahead of both.
  - `pnpm --filter @dineug/erd-editor dev` — builds the workspace deps, then `vp dev --mode lib`
    (Vite dev server with r-html HMR). ⚠️ There is no `node_modules/.bin/vite` in this workspace —
    `vite` is a catalog alias for `@voidzero-dev/vite-plus-core`, and the CLI is `vp`.
  - `pnpm --filter @dineug/erd-editor dev:storybook` — component-level checks (Storybook 10, stories
    colocated as `*.stories.ts`); `build:storybook` for the static build.
- **Verify collaboration changes with two clients.** Open the diagram in two tabs (or run the web app's
  live mode) and confirm actions converge — LWW bugs only appear under concurrent edits.
- **Verify undo/redo for every new action**, including the drag/stream case (one drag = one undo).
- **Verify readonly mode** if you touched the action lists.
- For SQL generation changes, spin up the matching vendor from the repo root `docker/` directory and
  run the generated DDL against it; `data/*.sql` provides realistic schemas.
- Changes here ripple to four consumers — finish with a full `pnpm build` (`vp run -r build`) from
  the repo root.

### Common Patterns

- File naming: `Component.ts` + `Component.styles.ts` + `Component.stories.ts` + `Component.test.ts`,
  one directory per component, `index.ts` barrels for utility folders.
- Generator actions are named `somethingAction$` and live in `generator.actions.ts`; plain creators are
  `somethingAction` in `atom.actions.ts`.
- Constants are `as const` objects paired with a same-named type (`ValuesType<typeof X>`).
- Settings flags (`show`, `ignoreSaveSettings`) are bitmasks — use `src/utils/bit.ts`. `Tag` is a
  bitmask too.
- Theme tokens are camelCase keys on `Theme` (`src/themes/tokens.ts`), kebab-cased into CSS custom
  properties as `--erd-editor-<token>` by `themeToTokensString`. Adding one means touching `Theme`,
  `ThemeTokens` and `radix-ui-theme.config.ts` together.
- `@/*` resolves to `src/*`, declared in `tsconfig.json`, `vite.config.ts` and `vitest.config.ts` —
  all three need the alias, plus `e2e/tsconfig.json` for the e2e entry.

## Dependencies

### Internal

- `@dineug/r-html` — rendering, components, store, context, observables
- `@dineug/erd-editor-schema` — state shape, `toJson`, LWW operators, `query`
- `@dineug/shared` — type guards, `arrayHas`, `asap`, nanoid
- `@dineug/schema-sql-parser` — SQL import
- `@dineug/erd-editor-shiki-worker` — highlighting (injected, lazily imported)
- `@dineug/vite-plugin-r-html` — dev-time HMR only

### External

All of these are `devDependencies`; the lib build bundles the runtime ones.

- `rxjs` — the action pipelines, the engine hook effects and the shared-store transport
- `d3` — force simulations only, in exactly two files: `components/visualization/createVisualization.ts`
  and `components/erd/automatic-table-placement/createAutomaticTablePlacement.ts`. Canvas zoom/pan is
  **not** d3 — it runs through `settings.changeZoomLevel` / `settings.scrollTo` and
  `utils/rx-operators/fromDraggable.ts`
- `es-toolkit` (replaced `lodash-es`), `luxon`, `deepmerge`, `fuse.js` (quick search), `tinykeys`
  (shortcuts). ⚠️ **Four names come from `es-toolkit/compat`, not the main entry, and the split is
  deliberate.** `isEmpty`, `get` and `set` simply do not exist in the main entry. `round` does, but
  it breaks exact `.xx5` ties the other way from lodash — `round(1.005, 2)` is `1` there and `1.01`
  in both lodash and compat — and every caller here writes into persisted, LWW-replicated document
  state (`settings.zoomLevel`, `settings.scroll*`, `table.ui.x/y`, `memo.ui.x/y`), where two clients
  disagreeing about the same input is worth more than the bytes compat costs. The other fourteen —
  `camelCase`, `snakeCase`, `kebabCase`, `upperFirst`, `cloneDeep`, `groupBy`, `head`, `last`,
  `omit`, `pick`, `range`, `uniq`, `noop`, `identity` — were diffed against lodash on this repo's own
  argument patterns and match, so they come from the main entry. Two call shapes did have to change:
  lodash's `first` is `head`, and `omit` takes an array (`omit(action, ['tags'])`, never a bare
  string). `camelCase` also takes a required `string` now, which is why `pascalCase` in
  `utils/index.ts` spells out the `?? ''` lodash used to do silently
- `html-to-image` (export), `color`, `@easylogic/colorpicker`, `highlight-words-core`
- `@floating-ui/dom` and `framer-motion` are declared but **imported nowhere in `src/`** — dead
  entries, not the menu/animation implementation. Menus and popovers are hand-rolled in
  `components/primitives/context-menu/`. Don't reach for either on the assumption it is already wired
- `@radix-ui/colors` — theme palette; `@mdi/js` + `@fortawesome/free-{solid,regular}-svg-icons` — icons
- `@egjs/agent` — platform detection (`src/utils/device-detect/`)
- `comlink` — worker RPC for schema GC
- `stats.js` — the dev-entry FPS meter only
- Build: Vite+ (`vite` is a pnpm-catalog alias for `@voidzero-dev/vite-plus-core`, Rolldown
  underneath) + `vite-plugin-dts`, TypeScript **7.0.2**. `@typescript/typescript6` (6.0.2) rides
  along because `vite-plugin-dts` still calls the JS Compiler API that TS7 dropped; nothing in
  `src/` imports it
- Test: `vite-plus/test` (the Vitest 4 engine) + `@vitest/coverage-v8` + `happy-dom`,
  `@playwright/test`
- Storybook 10 (`storybook`, `@storybook/html-vite`, `@storybook/addon-docs`,
  `@storybook/addon-links`) — dev only

### Consumers

`@dineug/erd-editor-app`, `@dineug/erd-editor-vscode-webview`,
`@dineug/erd-editor-vscode-replication-store-worker`, `@dineug/erd-editor-intellij-webview`.

<!-- MANUAL: -->
