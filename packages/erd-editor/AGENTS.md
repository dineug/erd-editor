<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# erd-editor (`@dineug/erd-editor`)

## Purpose

**The editor core** — the largest and most important package in the workspace (~330 source files),
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

1. A component dispatches through `appContext.store`.
2. `rx-store.ts` stamps every action with `clock.getNextVersion()` and flattens composition/generator
   actions (`compositionActionsFlat`).
3. The action array fans into three RxJS pipelines:
   - **`history$`** — filtered to `HistoryActionTypes`, tag-filtered, regrouped for streaming actions
     (`@@move`, `@@scroll`, `@@color`) so a drag becomes one undo entry, then pushed onto `History`.
   - **`dispatch$` → `store.dispatchSync`** — the actual reducer application.
   - **`change$`** — filtered to `ChangeActionTypes` and debounced 200 ms, the "document changed" signal
     hosts subscribe to for autosave.
4. `shared-store.ts` mirrors `SharedActionTypes` out to peers (live collaboration, cross-tab), and
   merges incoming remote actions back in, tagged `Tag.shared` so they don't echo.
5. `replication-store.ts` runs the same reducers **headlessly** (no DOM) so a host process can keep an
   authoritative document copy — this is what the VSCode extension and IntelliJ plugin replicate into.

**`Tag`** (`engine/tag.ts`) is how an action's provenance is expressed: `Tag.shared` (came from a peer),
`Tag.changeOnly` (should not create history). Filters in `engine/rx-operators/` act on these.

## Key Files

| File                                           | Description                                                                                                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                                 | Public entry — imports `customElementRegistry`, exports `ErdEditorElement` and the three injection points (`setGetShikiServiceCallback`, `setExportFileCallback`, `setImportFileCallback`)                |
| `src/engine/index.ts`                          | The second published entry (`@dineug/erd-editor/engine.js`) — exports only `createReplicationStore`                                                                                                       |
| `src/index.dev.ts`                             | Dev-server entry (`vite serve --mode lib`)                                                                                                                                                                |
| `src/components/erd-editor/ErdEditor.ts`       | The custom element itself; defines the full `ErdEditorElement` public API (`value`, `setInitialValue`, `setTheme`, `setSchemaSQL`, `getSharedStore`, `setDiffValue`, …)                                   |
| `src/components/appContext.ts`                 | `createAppContext` — `EngineContext` extended with `store` (the RxStore), `actions`, `keyBindingMap`, `shortcut$`, `keydown$`, and `emitter`; provided to every descendant via `useProvider`/`useContext` |
| `src/components/customElementRegistry.ts`      | Registers every custom element tag; importing `src/index.ts` is what makes `<erd-editor>` exist                                                                                                           |
| `src/engine/store.ts`                          | `createStore` — combines the eight module reducers over `schemaV3Parser({})` state                                                                                                                        |
| `src/engine/rx-store.ts`                       | `createRxStore` — the pipeline described above, plus `undo`/`redo`/`history`/`change$`                                                                                                                    |
| `src/engine/shared-store.ts`                   | Collaboration boundary — outbound/inbound action mirroring                                                                                                                                                |
| `src/engine/replication-store.ts`              | Headless store for host processes                                                                                                                                                                         |
| `src/engine/actions.ts`                        | Merges all module actions and declares the action-type classifications (`ChangeActionTypes`, `HistoryActionTypes`, `SharedActionTypes`, `ReadonlyIgnoreActionTypes`, the `StreamRegroup*` groups)         |
| `src/engine/clock.ts`                          | Lamport-style version counter with `merge(remoteVersion)`                                                                                                                                                 |
| `src/engine/history.ts` / `history.actions.ts` | Undo/redo stack (`HISTORY_LIMIT = 2048`) and the per-action-type undo/redo recipes                                                                                                                        |
| `src/engine/context.ts`                        | `EngineContext` — what reducers and generator actions can reach (clock, toWidth, …)                                                                                                                       |
| `vite.config.ts`                               | Two lib entries (`erd-editor`, `engine`), banner injection, `__APP_VERSION__` define, r-html HMR on serve, dts + tsc on build                                                                             |

## Subdirectories

| Directory                                                                                                                 | Purpose                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/engine/modules/`                                                                                                     | Eight state modules, one per entity: `editor`, `table`, `table-column`, `memo`, `relationship`, `settings`, `index`, `index-column`                                                                                                                                      |
| `src/engine/rx-operators/`                                                                                                | Custom RxJS operators — `actionsFilter`, `ignoreTagFilter`, `readonlyIgnoreFilter`, `groupByStreamActions`, `sharedStreamActionsCompressor`, `bufferCircuitBreaker`, `notEmptyActions`                                                                                   |
| `src/components/erd/`                                                                                                     | The diagram surface — `canvas/` (tables, memos, relationship SVG, shared mouse tracker), `minimap/`, `drag-select/`, `erd-context-menu/`, `table-properties/`, `automatic-table-placement/`, `virtual-scroll/`, `time-travel/`, `diff-viewer/`, plus `useErdShortcut.ts` |
| `src/components/primitives/`                                                                                              | The design system — button, icon, kbd, sash, separator, slider, switch, text-input, edit-input, toast, color-picker, code-block, context-menu, highlighted-text                                                                                                          |
| `src/components/schema-sql/`                                                                                              | SQL DDL panel and its context menu                                                                                                                                                                                                                                       |
| `src/components/generator-code/`                                                                                          | Code-generation panel and its context menu                                                                                                                                                                                                                               |
| `src/components/visualization/`                                                                                           | Relationship-graph visualization view                                                                                                                                                                                                                                    |
| `src/components/quick-search/`, `settings/`, `toolbar/`, `theme/`, `theme-builder/`, `toast-container/`, `global-styles/` | Supporting UI surfaces                                                                                                                                                                                                                                                   |
| `src/utils/schema-sql/`                                                                                                   | DDL generators per vendor — `MySQL`, `MariaDB`, `PostgreSQL`, `MSSQL`, `Oracle`, `SQLite`                                                                                                                                                                                |
| `src/utils/generator-code/`                                                                                               | Code generators — `typescript`, `java`, `jpa`, `kotlin`, `csharp`, `scala`, `graphql`                                                                                                                                                                                    |
| `src/utils/schema-sql-parser/`                                                                                            | Maps `@dineug/schema-sql-parser` AST onto editor actions (SQL import)                                                                                                                                                                                                    |
| `src/utils/collection/`                                                                                                   | Typed entity accessors over the v3 collections, plus `sequence.ts`                                                                                                                                                                                                       |
| `src/utils/draw-relationship/`                                                                                            | Relationship line geometry — `calc`, `draw`, `pathFinding`, `sort`                                                                                                                                                                                                       |
| `src/utils/table-clipboard/`                                                                                              | Copy/paste of table selections                                                                                                                                                                                                                                           |
| `src/utils/file/`                                                                                                         | `exportFile.ts` / `importFile.ts` — the host-overridable file IO callbacks                                                                                                                                                                                               |
| `src/utils/rx-operators/`                                                                                                 | DOM-event observables — `fromDraggable`, `fromShadowDraggable`, `fromCopy`, `fromPaste`, `takeUnsubscribe`                                                                                                                                                               |
| `src/utils/keyboard-shortcut/`                                                                                            | `KeyBindingMap` / `KeyBindingName` and tinykeys wiring                                                                                                                                                                                                                   |
| `src/services/schema-gc/`                                                                                                 | Garbage collection of orphaned entities, in a dedicated + shared worker flavour                                                                                                                                                                                          |
| `src/services/shikiService.ts`                                                                                            | The `setGetShikiServiceCallback` injection point                                                                                                                                                                                                                         |
| `src/constants/`                                                                                                          | `schema`, `layout`, `open`, `language`, and `sql/` (database vendors and per-vendor data types)                                                                                                                                                                          |
| `src/themes/`                                                                                                             | Radix-UI-derived theme tokens, `radix-ui-theme.config.ts`, `textColor.ts`                                                                                                                                                                                                |
| `src/styles/`                                                                                                             | Global style fragments — reset, typography, fonts, scrollbar, color picker                                                                                                                                                                                               |
| `src/hooks/`                                                                                                              | `useDarkMode`, `useFlipAnimation`, `useKeyBindingMap`, `useUnmounted`                                                                                                                                                                                                    |
| `.storybook/`                                                                                                             | Storybook 10 (`@storybook/html-vite`) config; stories live beside components as `*.stories.ts`                                                                                                                                                                           |
| `environment/`                                                                                                            | `.env.lib` — sets `VITE_TARGET=lib`, which gates the lib build in `vite.config.ts`                                                                                                                                                                                       |

### Engine module layout

Every module under `src/engine/modules/<name>/` follows the same five-file shape:

| File                   | Role                                                                      |
| ---------------------- | ------------------------------------------------------------------------- |
| `actions.ts`           | `ActionMap` — the action-type → payload contract                          |
| `atom.actions.ts`      | Action creators + reducers (the synchronous, LWW-aware state writes)      |
| `generator.actions.ts` | `action$` generator actions for multi-step/async flows (r-html runtime)   |
| `history.ts`           | Undo/redo recipes for this module's actions                               |
| `hooks.ts`             | Optional — cross-module reactions as rxjs effects (e.g. `table/hooks.ts`) |

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
  listed in `ReadonlyIgnoreActionTypes`; view-only actions (zoom, scroll, language, name case) are
  deliberately allowed through. Don't add readonly guards in the UI layer.
- **Streaming actions must be regrouped.** A `table.move` per mousemove would create thousands of undo
  entries; `groupByStreamActions` collapses them into `@@move` / `@@scroll` / `@@color` groups.
- **Three host injection points** exist so the core stays environment-free:
  `setGetShikiServiceCallback`, `setImportFileCallback`, `setExportFileCallback`. Never call
  `document.createElement('input')` or `fetch` for file IO directly — VSCode and IntelliJ webviews
  cannot use browser file dialogs.
- **Two published entries.** `src/index.ts` (the element, side-effectful — it registers custom elements)
  and `src/engine/index.ts` (`createReplicationStore`, deliberately DOM-free). Never let the engine
  entry pull in a component.
- **Components are `r-html` FCs**, not React. Use `html`/`svg`/`css` tagged templates, `observable`,
  and the `onMounted`/`onUnmounted` hooks. Styles live in a sibling `*.styles.ts` using the `css` tag.
- **Everything is inside a shadow root.** Use `queryShadowSelector` / `closestElement` from `r-html`;
  plain `document.querySelector` will not find editor internals.
- Subscriptions must be collected and disposed — `useUnmounted().addUnsubscribe(...)` in components,
  the `subscriptionSet` pattern in the engine. Leaks here keep whole diagrams alive.
- Prefer `src/utils/collection/` accessors over reaching into `state.collections` directly.
- `src/utils/index.ts` and the many barrels mean import cycles are easy to create; keep `engine/` from
  importing `components/`.

### Testing Requirements

- Two suites, run separately and wired to separate CI jobs:
  1. `pnpm --filter @dineug/erd-editor test` — Vitest over `src/**/*.test.ts` in happy-dom, with an
     80% per-file coverage floor (`vitest.config.ts`). This is what `pnpm test` at the repo root runs.
  2. `pnpm --filter @dineug/erd-editor e2e` — Playwright over `e2e/specs/*.spec.ts` in Chromium,
     covering the keyboard/mouse interactions happy-dom cannot reproduce. **Read `e2e/README.md`
     before touching it** — the closed shadow root, the minimap's duplicate render and the LWW
     tombstones each have a trap that will waste an afternoon otherwise.
- The `e2e` Nx target is deliberately NOT part of `nx run-many -t test`, so a missing browser binary
  can never turn the unit suite red.
- Still worth doing by hand for anything visual:
  - `pnpm --filter @dineug/erd-editor build` — type-checks with `noEmitOnError: true`.
  - `pnpm --filter @dineug/erd-editor dev` — Vite dev server with r-html HMR.
  - `pnpm --filter @dineug/erd-editor dev:storybook` — component-level checks (Storybook 10, stories
    colocated as `*.stories.ts`).
- **Verify collaboration changes with two clients.** Open the diagram in two tabs (or run the web app's
  live mode) and confirm actions converge — LWW bugs only appear under concurrent edits.
- **Verify undo/redo for every new action**, including the drag/stream case (one drag = one undo).
- **Verify readonly mode** if you touched the action lists.
- For SQL generation changes, spin up the matching vendor from the repo root `docker/` directory and
  run the generated DDL against it; `data/*.sql` provides realistic schemas.
- Changes here ripple to four consumers — finish with a full `pnpm build` from the repo root.

### Common Patterns

- File naming: `Component.ts` + `Component.styles.ts` + `Component.stories.ts`, one directory per
  component, `index.ts` barrels for utility folders.
- Generator actions are named `somethingAction$` and live in `generator.actions.ts`; plain creators are
  `somethingAction` in `atom.actions.ts`.
- Constants are `as const` objects paired with a same-named type.
- Settings flags (`show`, `ignoreSaveSettings`) are bitmasks — use `src/utils/bit.ts`.
- `@/*` resolves to `src/*` (declared in both `tsconfig.json` and `vite.config.ts`).

## Dependencies

### Internal

- `@dineug/r-html` — rendering, components, store, context, observables
- `@dineug/erd-editor-schema` — state shape, `toJson`, LWW operators, `query`
- `@dineug/shared` — type guards, `arrayHas`, `asap`, nanoid
- `@dineug/schema-sql-parser` — SQL import
- `@dineug/erd-editor-shiki-worker` — highlighting (injected, lazily imported)
- `@dineug/vite-plugin-r-html` — dev-time HMR only

### External

- `rxjs` — the action pipelines and the engine hook effects
- `d3` — zoom/pan and layout math
- `lodash-es`, `luxon`, `deepmerge`, `fuse.js` (quick search), `tinykeys` (shortcuts)
- `@floating-ui/dom` (menus/popovers), `framer-motion`, `html-to-image` (export), `color`,
  `@easylogic/colorpicker`, `highlight-words-core`
- `@radix-ui/colors` — theme palette; `@mdi/js` + `@fortawesome/*` — icons
- `comlink` — worker RPC for schema GC
- Storybook 10 (`@storybook/html-vite`) — dev only

### Consumers

`@dineug/erd-editor-app`, `@dineug/erd-editor-vscode-webview`,
`@dineug/erd-editor-vscode-replication-store-worker`, `@dineug/erd-editor-intellij-webview`.

<!-- MANUAL: -->
