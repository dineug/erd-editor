<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-27 -->

# erd-editor

## Purpose

The editor core, published on npm: the framework-free `<erd-editor>` custom element on `@dineug/r-html`, with a Redux-like store whose actions carry a Lamport clock version and merge through the LWW registers in `@dineug/erd-editor-schema`. `app`, `webview-client` and `replication-store-worker` depend on it; `app` and `replication-store-worker` also import the DOM-free `engine.js` entry, and `mcp-server` inlines the DOM-free `peer.js` entry, a headless collaboration peer that edits by dispatching actions instead of by a pointer.

The ERD scene is a Konva `<canvas>` rendered through a second r-html host (`src/konva/`); toolbar, panels, menus and the editing overlay stay DOM. The same scene components also draw the one **view**, the Visualization tab's Flow mode — the reader's own placement, zoom and rows, never in the file, the history or a peer — told which through a `GeometrySource`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public entry: registers `<erd-editor>` as a side effect; exports `ErdEditorElement` (type), `setExportFileCallback`, `setImportFileCallback`, and `createKeyBindingMap` with `KeyBindingMap` / `KeyBindingName` / `ShortcutOption` (types), the default shortcuts, which `obsidian-plugin` keeps Obsidian's hotkeys off; pinned by `src/index.test.ts` |
| `src/engine/index.ts` | `@dineug/erd-editor/engine.js` — `createReplicationStore` only, pinned by `src/engine/index.test.ts` |
| `src/peer/index.ts` | `@dineug/erd-editor/peer.js` — `createPeerStore` / `PeerStoreError`, the per-module `actions$` / `actions` barrels, the action type lists, the `constants/schema` and `constants/layout` values, `createSchemaSQL` and the vendor list, `measureTableSize` (the box a table takes once a text measure has sized its text, on copies, which `mcp-server`'s `erd_list` reports); pinned by `src/peer/index.test.ts` (44 keys, no flat `actions`) |
| `src/engine/peer-store.ts` | `createPeerStore`: an `RxStore` (`manualStreamFlush`, `observable: false`) and a `SharedStore` like an element's; `dispatch` returns the batches, history entries and created ids it measured, `undo` / `redo` revert its own dispatches only and name the label they reverted, `setInitialValue` is the one reseed |
| `src/engine/presence.ts`, `stream-flush.ts`, `to-width.ts` | The peer's plumbing: the focus heartbeat and `clearSharedTrackers`, the history-then-outbound flush order, and the replica's text estimate `defaultToWidth` |
| `src/components/erd-editor/ErdEditor.tsx` | The element: `shadow: 'closed'`, the `ErdEditorElement` API, `readonly` / `systemDarkMode` / `enableThemeBuilder` |
| `src/engine/rx-store.ts` | UI store: version stamping, history and reducer pipelines, the two view seams, `change$` (200 ms), `HISTORY_LIMIT = 2048`, `flushStreamBuffers` and the internal `manualStreamFlush` / `observable` options |
| `src/engine/actions.ts` | The action classification lists (`ChangeActionTypes`, `ReadonlyIgnoreActionTypes`, `ViewIgnoreActionTypes`, `Shared*`, `Stream*`, `HistoryActionTypes`) |
| `src/engine/replication-store.ts` | Headless replica: forwards only `ChangeActionTypes`, tags stripped; schema GC on `setInitialValue` |
| `src/engine/modules/editor/view*.ts` | `getActiveView`, `getSourceView`, `isViewShown`; the ten `editor.view*` actions, `editor.changeVisualizationMode`, `clearViews`; `focusFlowTableAction$` |
| `src/utils/draw-relationship/geometrySource.ts` | `GeometrySource = 'document' \| 'flow'`, `ViewSource` |
| `src/components/sceneSourceContext.ts` | `sceneSourceContext` / `useSceneSource`, default `'document'` |
| `src/konva/scene/viewLayout.ts` | What a view shows: `getVisibleIds`, `getVisibleColumnIds`, `getTablePoint`, `getReachedTableIds`, `getHighlightIds` |
| `src/components/visualization/flowLayout.tsx` | The one Flow placement authority: `ensureFlowPlaced`, `keepFlowPlaced`, `fitFlowView` |
| `src/konva/host.ts`, `src/konva/batchDraw.ts` | The Konva `HostAdapter`; the only draw authority (`Konva.autoDrawEnabled = false`, one `batchDraw` per dirty layer per commit) |
| `src/konva/scene/viewport.ts` | The coordinate canon and the culling rect |
| `src/workers/spawn.ts`, `spawn.inline.ts` | The only place the four SharedWorkers are constructed; the umd build aliases in the inline twin |
| `package.json` | `exports` `.`, `./engine.js` and `./peer.js`; `unpkg` / `jsdelivr` → `dist/erd-editor.umd.js`; `files` is `dist` minus maps; deliberately no `sideEffects` |
| `vite.config.ts` | Lib entries `index`, `engine/index` and `peer/index`, which split into three shared chunks: `store-hooks` (the store, the modules and the importers) under all three entries, `schemaGCService` under `index` and `engine`, and `shared-store` (rx-store, shared store, peer store, presence, stream flush, `toWidth`, `schema-sql`) under `index` and `peer`; `createExternal(manifest)`, `createWorkerOptions(external)` plus the worker's own `rHtml`, `libraryWorkerUrls()`, dts via `tsconfig.build.json`; the umd build is appended to `build` |
| `vite.umd.config.ts` | Script-tag build: `formats: ['umd']`, `name: 'ErdEditor'`, nothing external, `emptyOutDir: false`, `spawn.inline.ts` alias, `base64InlineWorkers()` |
| `vitest.config.ts`, `vitest.setup.ts` | `unit` and `browser` projects, each repeating the JSX plugin, `@` alias and `__APP_VERSION__`; one root coverage block; unit-only stubs |
| `.storybook/` | Storybook 10; `main.ts` drops the dts plugin and bundles worker dependencies |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/engine/` | Stores (`store`, `rx-store`, `shared-store`, `replication-store`, `peer-store`), `clock`, `history`, `tag`, `rx-operators/`, and `modules/` (eight, each `actions.ts` / `atom.actions.ts` / `generator.actions.ts` / `history.ts`); the peer store's `presence.ts` (the focused cell only, on a heartbeat, timer `unref`'d), `stream-flush.ts`, `to-width.ts` (the replica's text estimate) |
| `src/peer/` | The `peer.js` entry, `index.ts`; `imports.test.ts` holds its sources to the peer graph's rules |
| `src/components/` | r-html FCs: `erd/` (scene in `canvas/` and `minimap/`, DOM shell, menus, diff viewer, time travel, automatic placement), `visualization/` (Graph, Flow, `particles/`), `table-view/`, `primitives/`, the panels |
| `src/konva/` | Render host (`host.ts`, `batchDraw.ts`, `theme.ts`, `testHandle.ts`, `jsx.d.ts`) and `scene/` geometry |
| `src/services/` | SharedWorker services: `schema-gc/` and `export-png/` fall back in-process; `elk-layout/` refuses a host with no worker; `shiki/` answers null (plain text) |
| `src/utils/` | `schema-sql/` (DDL per vendor), `generator-code/`, importers `schema-{sql,graphql,dbml,aml}-parser/` (in the last three `parser.ts` / `tokenizer.ts` own the grammar or `graphql` AST, `convert.ts` never sees it), `draw-relationship/`, `table-clipboard/`, `keyboard-shortcut/` |
| `src/themes/`, `src/styles/` | Tokens and radix palette (`LightThemeConfig`); global style fragments and `elevation.styles.ts`'s `floatingShadow` |
| `src/__test-utils__/`, `src/__jsx-parity__/` | Vitest mount helpers and the peer fixtures, `peerSeed.ts` (seed document and `SEED` ids, `createUserStore`, `createSession` wiring a peer store to a user store, `comparable`) and `peerScenarios.ts` (action arrays with their focus and label, no tool names; `SEED_SCENARIOS` holds one edit per shape of change on the seed, 53: every entity module's, every setting, every import) — out of dts and coverage; the JSX parity gates |
| `e2e/` | Playwright: `fixture/`, `support/` (page object, seeds, `sceneMirror.ts`), `specs/`, `bench/` (never in CI), `README.md` |

## For AI Agents

### Working In This Directory

**Engine**

- **Adding an action** touches the module's `actions.ts`, `atom.actions.ts` and `history.ts` (whose undo entry puts it in `HistoryActionTypes`) **and** the hand-kept lists in `src/engine/actions.ts`. Missing `ChangeActionTypes` compiles, then silently breaks the host `change` (autosave), collaboration and readonly. Readonly is enforced only there (`readonlyIgnoreFilter`, `hasReadonlyIgnore`), never in components. A new change type also needs a tool or an exclusion reason in `mcp-server`'s reachability spec.
- Reducers write through the LWW operators from `@dineug/erd-editor-schema` with `action.version`; a direct write wins every merge and corrupts collaborative sessions.
- Reader-only state (`editor.views`, `visualizationMode`, `handTool`, `zenMode`, `openMap`) is in no list, so it is never saved, undone or sent to a peer; `engine/actions.test.ts` pins the ten `editor.view*` types and `editor.changeVisualizationMode` out of all of them.
- **View seams** (`rx-store.ts`): while `getActiveView` finds one, `viewActionRedirect` rewrites `settings.scrollTo` / `streamScrollTo` / `changeZoomLevel` / `streamZoomLevel` into their `editor.view*` twin (not `Tag.shared` / `Tag.following`), and `viewIgnoreFilter` drops `ViewIgnoreActionTypes` (readonly's list minus `editor.loadJson` / `editor.clear`), letting `Tag.shared` reach the store. `undo` / `redo` no-op while a view is active.
- **Both seams classify a batch by the state it enters with**, so leaving a view and moving the document are two dispatches — `goToErdTable` (`erd/canvas/table/goToErd.ts`) is the model; `e2e/specs/visualization-flow.spec.ts` asserts what the host hears.
- Keep host integrations on `ErdEditorElement`. `webview-client`'s `mountWebview` sets the import callback only when a host passes `importFile` (VSCode does, IntelliJ does not), so the built-in `<input type=file>` is IntelliJ's only import path.

**Scene sources and views**

- **`GeometrySource` picks coordinates, shown set and sort channel at once.** Pure functions take a trailing `source = 'document'`; scene components read `useSceneSource(ctx)`. Each scene root (`Erd`, `ErdViewer`, `AutomaticTablePlacement`, `TimeTravel`, and `FlowScene` in `VisualizationFlow.tsx`) provides it **inside a wrapper, never on the root it returns**: `useProvider` attaches to the parent element, so siblings would inherit it.
- Outside any provider, code that must follow the reader (zoom generators via `getActiveTransform`, the view reducers) reads `getActiveView`.
- **A scene writes to the slot it reads**: `sceneScrollToAction(source, …)`, `changeZoomLevelAction$(value, source)`, `moveAllAction$(dx, dy, source)`, `kind` on a view payload. An unnamed scroll or zoom lands on the active view; an unnamed `moveAllAction$` goes to the document, and an open view drops it.
- **`viewLayout.ts` decides what a view shows**: only the tables in `positions` (nothing until a layout lands), **no memos**, relationships with both ends shown, rows per `showMode`; `settings.show` and `columnOrder` do not apply. Hover and pin are module observables keyed on `editor.id`, never actions.
- **`flowLayout.tsx` is the one place a Flow placement is asked for** (`TablePlacement.viewLayered`). Landings are cached under `placedKey` — centers, show mode, the doc's id lists, **never `positions`**, or the loop re-asks on its own answer. Narrow or widen only through `components/flowCenters.ts` or `focusFlowTableAction$`.
- `toHints` (`services/elk-layout/elkGraph.ts`) normalizes coordinate hints; handed raw coordinates, ELK's INTERACTIVE layering reads one document row as one layer per table.

**Relationship geometry**

- `draw-relationship/sort.ts` is the whole geometry pass, routing (`route.ts`, `nudge.ts`) included because it needs every table and route; `pathFinding.ts` only draws.
- **A rendering-only value goes in the `WeakMap` sort channels of `draw-relationship/index.ts`, never a new schema field** — anchors are schema fields and serialize. One channel per source; a view keeps its anchors there, so `setAnchors` writes the entity only for the document. `clearSortChannel` clears per connector, since channels are module-wide.
- View channel setters bump `viewVersions` **only on an actual change**; an unconditional bump redraws every static connector on each drag sort.
- The sort hooks (`engine/modules/relationship/hooks.ts`) open a 5 ms window for a `Tag.drag` action and sort in a microtask otherwise; a timer loses to the next frame, which draws moved tables with stale connectors.

**Coordinates and scrolling**

- **One coordinate canon**: `getSceneOrigin`, `toScreenPoint`, `toScenePoint`, `getOriginToPlace` over `settings.originX` / `originY`. `konva/scene/coordinateAuthority.test.ts` fails on origin-with-zoom arithmetic outside its `AUTHORITY` files.
- **Pans are unclamped**: `scrollTo` / `streamScrollTo` write the origin as given and `changeViewport` moves nothing. The scroll ranges (`settings/atom.actions.ts`) serve the scrollbars and minimap alone, whose drags gate themselves via `clampScrollMovement`.
- Only a load pulls onto content: `openingOrigin` via `pullScrollIntoRange`, deferred by `editor.scrollPullPending` until a measured viewport. A store that loads before measurement first dispatches `changeViewportAction({ width: 0, height: 0 })` (`createReplicationStore`, `ErdEditor.tsx`), or the load pulls against the default viewport for good.
- **Pinch**: `hooks/usePinchZoom.ts` is the pinch of every store scene (`Erd`, `ErdViewer`, Flow via `useViewGestures`); Graph mode drives `createPinch` (`utils/pinch.ts`) on its own view. A trackpad pinch is a ctrl wheel (`isPinchWheel`: every one on Apple, one short of a notch elsewhere, so a `$mod` notch keeps its step), a touch pinch two fingers, Safari's gesture events; each holds its centre through `pinchZoomAction$`, streamed so one pinch is one undo entry. The roots carry `touch-action: none`, or the page zooms instead. `getZoomTransform` hands back the store's own object: snapshot what a gesture holds.
- **Drags freeze their geometry**: entity drags (`canvas/entityDrag.ts`), scrollbar drags (`useVirtualScroll.ts`) and the minimap drag (`useMinimapScroll.ts`) freeze content rect and origin via `konva/scene/viewFreeze.ts`, thawing in the finalizer and on unmount. Unfrozen, a drag resizes its own thumb or map.
- **A module-level per-scene record keys on `sceneKeyOf(root, source)`** (`${editor.id}:${source}`, `konva/scene/viewFreeze.ts`), as the freeze, `entityDrag.ts` and `columnDragPointer.ts` do; keyed on the source alone, the diff viewer's two stores or two elements on a page share a slot. Only a `WeakMap` over entities (`draw-relationship/calc.ts`, the sort channels) may key on the source alone.
- **Compatibility fields**: `settings.width` / `height` are written only by the four importers and read only by `sortTableAction`. `scrollLeft` / `scrollTop` are the frozen legacy pair, migrated once into the origin by `erd-editor-schema`'s `migrateScrollToOrigin`; the importer `omit` lists in `editor/generator.actions.ts` name both pairs.

**Konva scene**

- **konva only through `konva/lib/*`**: `src/konva/imports.test.ts` allowlists the shipped modules, bans the barrel, keeps `Animation` out and `Tween` in `konva/scene/konvaFlip.ts` alone. Without the barrel nothing sets `Konva.DD`, so `Reflect.set(Konva, 'DD', DD)` in `batchDraw.ts` is load-bearing: without it every stage pointer dispatch throws. `konva/scene/renderScene.browser.test.tsx` pins it; no unit spec can.
- **Scene roots export in lower case on purpose**: `renderCanvasScene` / `renderMinimapScene` render imperatively and `Canvas.tsx` / `Minimap.tsx` hand-roll `import.meta.hot.accept`. Capitalize or drop either and `vite-plugin-r-html` makes the module a component boundary; the parent's accept silently stops running.
- The export-png SharedWorker hot-swaps scene modules on the dev server only because HMR meets on `globalThis` (rule in `packages/vite-plugin-r-html`); moved to `window`, the worker draws stale modules or throws at start, and every export falls back to the main thread.
- **The PNG export draws its own scene** from the document JSON (fresh app context, detached Stage, viewport never read). The caller passes `zoomLevel` to `createDocumentPng`, because `toJson` writes `zoomLevel: 1` when the zoom is not saved. `getExportScale` and `pixelRatio.ts` cut to the canvas ceilings; `erd-context-menu/menus/exportMenus.ts` surfaces reductions and failures.
- **`ParticleLayer.tsx`'s template stays one childless `k-layer`**: `createParticleLoop` adds particles behind the host's ledger, and a template child makes the next reconcile remove them all. It is a rAF loop on `layer.draw()` that asks no frame while nothing is lit.
- **Closed shadow root** (r-html's `queryShadowSelector` / `closestElement` cross it) over one `<canvas>`: route presses through `components/erd/hitTest.ts`, which records what konva resolved at dispatch, since the press re-renders the scene before `Erd.tsx` asks. Hit boxes come from hit functions (`canvas/sceneHit.ts`), not invisible shapes.
- An overlay over the canvas joins the `canDrag` `closest()` list in `Erd.tsx` (`.content-compass`, `.floating-toolbar`, …; `ErdViewer.tsx` has its own) or a press on it starts a pan.
- A header press lifts the table only past `CLICK_DRAG_MIN_MOVE` (`clickKinds`, `canvas/useMoveEntity.ts`); the drag layer is off the hit canvas, so lifting at once keeps a double click from opening the cell editor.
- `YIELDS_TO_A_CARET` (`hooks/useKeyBindingMap.ts`) stands `selectAllTable` and `handTool` down in a text field, per binding, because `Enter` / `Escape` must still reach `handleShortcut` from the cell editor.

**Peer store (`peer.js`)**

- **The peer graph runs in Node with no DOM and no bundler of its own**: `mcp-server` inlines what `src/peer/index.ts` reaches into one file. That graph may read no `document.`, `window.` or `navigator.`, construct no `SharedWorker`, touch no `customElements`, and import only `deepmerge`, `es-toolkit` (and `/compat`), `graphql`, `luxon`, `nanoid` and `rxjs` besides the workspace libraries it inlines. `src/peer/imports.test.ts` walks the sources in `pnpm test`; `pnpm peer-graph` walks `dist/` after `pnpm build`, and both keep the same allowlist. A shared helper that starts reaching konva, shiki, elkjs, comlink or a worker spawn is how that breaks.
- **The entry carries values, never tools.** `src/peer/index.test.ts` pins 44 keys and the absence of the flat `actions` map, whose `changeZIndexAction` would come from whichever module spread last. Tool names, the registry, argument validation, reading and the reachability lists belong to `mcp-server`; `engine/no-agent-concepts.test.ts` fails on any of them reappearing in `src/`.
- **Six of the 44 keys are there for specs alone** — `createEngineContext`, `ChangeActionTypes`, `StreamActionTypes`, `SharedFollowingActionTypes`, `SelectType` and `settingsActions$`; `defaultToWidth` started that way and now also sizes tables for `erd_list`. `mcp-server` holds each tool declaration to what the engine measurably does, so its specs need the real context, the real text measure, the real type lists and the real generator barrel; a `./peer/testing.js` subpath would make a fourth entry and split the chunks again. `mcp-server`'s `src/peerSurface.test.ts` is what proves none of the 44 is dead.
- **The labelled undo unit is the peer's own bookkeeping**, not the engine's: `dispatch(actions, { label })` records one unit, `group(label, run)` gathers the dispatches `run` makes into one unit under its own label (a group inside a group joins the outer one, a group that dispatched nothing leaves none, and `undo`, `redo` and `setInitialValue` throw inside one, since the unit would no longer match the history), `undo` pops the newest that made an entry and names the labels it passed over, and `setInitialValue` forgets all of them. The engine's history knows only entries.
- **Stream buffer option.** `createRxStore(context, { manualStreamFlush })` and `createSharedStore(store, config, { manualStreamFlush })` close a stream group (colors, memo resizes) on `flushStreamBuffers()` instead of `groupByStreamActions`' 200 ms quiet period, through `flushOnNotifier` over a `Subject` the store owns. Each store owns its tick count too: one in the rx-store's single history stage; `FLUSH_TICKS = 2` in the shared store, whose compressor stands on each side of the circuit breaker and whose second stage arms too late for the first tick. So `stream-flush.ts` flushes history first, then the outbound pipe, and knows neither the count nor an rxjs type. Without the flag the rx-store's `flushStreamBuffers` is a no-op and the editor keeps its timing: a stream edit reaches peers after the two stages' 200 ms each, 400 ms. The shared store's still works there (`quietPeriodOrNotifier`, the quiet period or the flush, whichever comes first), so a host can send a drag still held back before it lets the store go; `obsidian-plugin` does when a tab closes, so the other tabs of its file keep what it held. The shared store takes it as an internal third argument, so `SharedStoreConfig` and `getSharedStore` stay as they were.
- `flushOnNotifier` and `createSharedStreamActionsCompressor` are deep-imported and stay out of the `rx-operators` barrel: `rx-operators/index.test.ts` pins the barrel's export set, as it keeps `readonlyIgnoreFilter` out.
- **`createRxStore`'s internal `observable` option** (default true) keeps the state a plain object. r-html's reactive proxy reads `value instanceof Node`, a `ReferenceError` in plain Node; the replica store never hit it because it already ran with observation off. The peer passes false and first dispatches `changeViewportAction({ width: 0, height: 0 })`, so a load never reaches the pull's view lookup. `RxStoreOptions` is not public surface.
- **A replicated sort sends `table.moveTo`, never `table.sort`.** `sortTable` places by each replica's own `toWidth`, so replaying it lands tables apart; `sortTablesToMoveAction$` runs the reducer on copies of the live tables and sends the absolute points in one undoable batch. An import's `table.sort` is safe because the widths travel inside its `loadJson` payload.

**Clipboard, packaging, dependencies**

- **Duplicates** (`utils/table-clipboard/copy.ts`, `engine/modules/editor/utils/duplicate.ts`): a relationship rides only when both ends are copied, an index whole or not at all, `index.add` before its `indexColumn.add`s — one batch of atom actions, never `attachChangeOnlyTag$` or a second dispatch, so one undo reverts it. `CLIPBOARD_VERSION` stays 1 (a bump makes shipped editors refuse new copies); `PayloadKind.columns` carries neither array.
- **No `sideEffects` field, no `preserveModules`.** Vite reads the package's own field against `src/`, so a `./dist/…` list marks `customElementRegistry.ts` pure and drops element registration. A future list needs `**/` globs covering the entry, `customElementRegistry`, `ErdEditor`, `GlobalStyles`, `konva/batchDraw`, `konva/host` and `konva/workerDomStubs`.
- A third-party import in shipped `src/` goes in `dependencies`: the lib and worker builds externalize exactly that list, so a `devDependencies` entry inlines and its types stop resolving for consumers. The private `@dineug/*` libraries inline, though the public `.d.ts` still name `@dineug/r-html` and `@dineug/erd-editor-schema`.
- `@/*` → `src/*` is declared in `tsconfig.json`, `e2e/tsconfig.json`, `vite.config.ts`, `vitest.config.ts` and `vite.umd.config.ts` (after the `@/workers/spawn` entry; aliases match in order). A new alias needs all five.

### Testing Requirements

- `vp run --filter @dineug/erd-editor --fail-if-no-match test` — `tsc --noEmit`, then `unit` (happy-dom; `vitest.setup.ts` stubs observers, `matchMedia`, `requestIdleCallback` and a 2D context that draws nothing) and `browser` (headless Chromium). **The `.browser.` infix alone picks the project**; a Konva spec without it runs on the stub context and fails for unrelated reasons.
- `pnpm --filter @dineug/erd-editor test:coverage` / `test:dev` — built-in `vp test`, no type gate. CI runs `test:coverage` over both projects at `perFile` 80%. The three `if (import.meta.hot)` blocks (`Canvas.tsx`, `Minimap.tsx`, `VisualizationGraph.tsx`) carry `/* v8 ignore next -- @preserve */`, since no test runner defines `import.meta.hot`; `@preserve` keeps the hint through the TypeScript transform. Any other gap takes a test. For one file, pass `--project unit` or `--project browser` with `--coverage.include`: without a project the filter matches nothing.
- `pnpm --filter @dineug/erd-editor dev` builds the workspace dependencies, then serves `vp dev` (`index.html` → `src/index.dev.ts`, r-html HMR); `dev:storybook` / `build:storybook` run Storybook 10.
- `pnpm --filter @dineug/erd-editor e2e` (builds first); also `e2e:dev`, `e2e:headed`, `e2e:report`, `e2e:typecheck`, `e2e:bench`. Read `e2e/README.md` first: the fixture reopens the closed shadow root, and `E2E_PORT` picks the port.
- A DOM spec stays `.ts` with tagged templates (proving JSX changed nothing); a scene spec is `.tsx` under the konva pragma. `.vitest-attachments/` and `__screenshots__/` are gitignored and never review evidence.
- A view spec provides the source on its container **before** rendering: `useContext` subscribes at setup and `onBeforeMount` only.
- Everything mounting `canvas/Canvas.tsx` registers as `canvas`; `konva/testHandle.ts` publishes the newest live claim, so `__erdStages.canvas` is the surface on top.
- The export-png worker builds its own app context, so scene code counts twice in `pnpm size`; only removing a live reference moves bytes. Report a number rather than re-pinning the budget.
- `src/peer/` specs, and in `src/engine/` those of `peer-store.*`, `presence`, `stream-flush` and `to-width`, open with `// @vitest-environment node`, since the peer's real realm has no DOM; `engine/peer-store.node.test.ts` runs one with `window`, `document` and `Node` undefined. `engine/peer-store.converge.test.ts` wires a peer store and a user store the way `e2e/specs/shared-presence.spec.ts` wires two elements, runs every `SEED_SCENARIOS` edit through them, and is one of the three completion gates of the peer work with `mcp-server`'s `scenarios.test.ts` and `vuerd-vscode`'s `agent-hub.test.ts`.
- `engine/peer-store.undoable.test.ts` and `peer-store.dispatch-count.test.ts` are the two measurements only this package can make: the first replays each `SEED_SCENARIOS` edit through a bare `createRxStore` and compares the cursor it moves with the entries `dispatch` reported, and the second mocks `@/engine/rx-store` to count the calls into `dispatchSync`. Run against `mcp-server`'s own peer they would check a report against itself.
- `dist/peer/index.js` (about 3 kB gzip) and the `shared-store` chunk it shares with the element count in `pnpm size` though no editor loads the entry; the budget note says what the measurement was when it was re-pinned.

### Common Patterns

- One directory per component: `Foo.tsx` + `Foo.styles.ts` + `Foo.test.ts` (+ `Foo.stories.tsx`), mounted via `src/__test-utils__` (`mountAndFlush`, `flush`). A scene component has no `.styles.ts` (colours from `@/konva/theme`, geometry from `konva/scene/metrics.ts`, `canvas/sceneTokens.ts`) and its spec is `Foo.browser.test.tsx`.
- **JSX → tagged templates** (`@dineug/vite-plugin-r-html`): `class` / `style` keep array and object values; `?x` → `bool:x`, `@x` → `on:x`, `.x` → `prop:x` on a DOM element; `${ref(r)}` → `use:ref={ref(r)}`; `...${o}` → `{...o}`. Component props take no dot — the transform adds it, so `onFoo` is never an event. `<C>{t}</C>` compiles to `` .children=${html`${t}`} ``.
- A second binding of one event is `on:x__2`; an empty template has no JSX spelling, so `GlobalStyles.ts` and `Icon.tsx` keep tagged ones. `src/__jsx-parity__/parity.test.tsx` compares both spellings' DOM.
- **Konva files** open with `/** @jsxHost konva */` and compile against `konvaImportSource: '@/konva/host'` (all three Vite configs). Intrinsics: `k-circle`, `k-group`, `k-layer`, `k-line`, `k-path`, `k-rect`, `k-text` (`src/konva/jsx.d.ts`). Mixing hosts, `class` / `style` / `zIndex`, a spread or a text child fail the compile; `bool:`, `prop:`, `draggable`, `on:drag*` are typed `never`. `parity.konva.browser.test.tsx` gates it.
- Colour an icon with `color`, never `fill` (`emittedCss.iconPaint.test.ts`); the scene draws the same `getIcon` data via `canvas/SceneIcon.template.tsx`.
- `somethingAction$` generators live in `generator.actions.ts`, `somethingAction` creators in `atom.actions.ts`; bitmask flags go through `src/utils/bit.ts`. `VisualizationToolbar` reuses `FloatingToolbar.styles.ts`, so restyle both bars there.
- **Code generators — deliberate, not bugs:**
  - `sqlalchemy.ts` (`class Base(DeclarativeBase)`) and `drizzle.ts` emit an import header, per table too; `typeorm.ts`, `jpa.ts`, `sequelize.ts` leave names unimported.
  - sqlalchemy, typeorm, sequelize, drizzle render faithfully: references by class name, duplicate table names kept (class names dedupe), an unnamed column as `""`, a keyless table as is.
  - `typeorm.ts` types single-entity relations `Relation<T>`. `sequelize.ts` runs associations after every `init`, gives a composite foreign key none, and renames a property shadowing a `Model` member, keeping `field`.
  - `drizzle.ts` maps PostgreSQL, MySQL/MariaDB, SQLite to their cores and falls back to `pg-core`; `relationName` only where one table pair has several relationships.
  - `dbml.ts` repairs, since DBML rejects what others render oddly: duplicate tables renamed, typeless or repeated columns dropped (and the tables they empty), a `Ref` kept only when both ends resolve, identifiers double-quoted, comments as `Note`. `dbml.test.ts` parses with `@dbml/parse`.
  - `aml.ts` repairs likewise but keeps typeless attributes, writes `nullable`, always quotes types. DBML and AML highlight as `sql` (`LanguageToLangMap`).
  - `schema-sql/Snowflake.ts`: `bracketType` decides whether to quote, since a quoted name is case sensitive.

## Dependencies

### Internal

`@dineug/r-html`, `@dineug/erd-editor-schema`, `@dineug/schema-sql-parser` (inlined into `dist/`); `@dineug/vite-plugin-r-html` (the JSX transform every build and test config runs, plus HMR).

### External

- `konva` `^10.3.2` via `konva/lib/*` only; a caret so a consumer dedupes to one copy, since `batchDraw.ts` patches the namespace. `@chenglou/pretext` lays out memo text. `imports.test.ts` keeps `html-to-image` out.
- `elkjs` only from the elk-layout worker, `shiki` + `@shikijs/langs` / `themes` only from the shiki worker (`createHighlighterCore`, JavaScript regex engine, so no `wasm-unsafe-eval`); `comlink` on all four worker boundaries; `d3-force` for Graph mode and automatic placement.
- `rxjs`, `nanoid`, `graphql` (only in `schema-graphql-parser/parser.ts`, which sits in the `store-hooks` chunk all three entries share, so `peer.js` carries it too), `tinykeys`, `fuse.js`, `luxon`, `lucide`, `@radix-ui/colors`, `@egjs/agent`, `deepmerge`, `highlight-words-core`, `@easylogic/colorpicker`; `stylis` for the inlined r-html.
- `es-toolkit`: `get`, `set`, `isEmpty`, `round` come from `es-toolkit/compat` on purpose — the main entry lacks the first three and rounds exact `.xx5` ties down into persisted LWW state. Neither entry has an integer guard, so `clock.ts` and `tag.ts` spell `isNumber(x) && Number.isInteger(x)`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
