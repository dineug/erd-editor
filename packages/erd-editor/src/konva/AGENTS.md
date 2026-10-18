<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-18 -->

# konva

## Purpose

`src/konva/` holds the scene geometry over `@dineug/r-html-konva`, the second r-html host, which draws the ERD scene on a Konva `<canvas>` and holds the host adapter, the draw gate and the `k-*` intrinsics (`packages/r-html-konva/AGENTS.md`). This directory holds the scene theme, the stage test handle and the worker DOM stubs. `scene/` holds the scene geometry: the viewport, what a view shows, the drag freeze, fitting and content bounds. This file holds how konva is imported, how a Konva file compiles and what a view shows. It also holds two rules for files outside this directory: the lower-case scene roots and `ParticleLayer.tsx`. Other nested files touch the same scene: `src/components/erd/AGENTS.md` (the coordinate canon, frozen drags, `sceneKeyOf`), `src/components/AGENTS.md` (the `GeometrySource` a scene reads), `src/engine/AGENTS.md` (the view seams) and `src/services/AGENTS.md` (the scene the image exports draw). A bare file name or a path that starts with `scene/` is relative to this directory; a path that starts with `src/` is relative to `packages/erd-editor`.

## Making a Change

1. **Read the nested files the change reaches.** A change to `scene/viewport.ts`, `scene/viewFreeze.ts` or `scene/coordinateAuthority.test.ts` reads `src/components/erd/AGENTS.md`. A change to a scene module the export worker draws reads `src/services/AGENTS.md`. A change to the host, the draw gate or an intrinsic is a change to `@dineug/r-html-konva` and reads `packages/r-html-konva/AGENTS.md`. A change to how the pragma compiles reads `packages/vite-plugin-r-html/AGENTS.md`.
2. **Name a new konva module in `imports.test.ts`.** A shipped file that constructs a new `konva/lib/*` class adds its module to `RUNTIME_MODULES` there; one that names a module by type alone adds it to `TYPE_ONLY_MODULES`. The spec fails on any konva module its lists do not name.
3. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. The specs this file names run in that test task, each `*.browser.test.ts` or `*.browser.test.tsx` in real Chromium.

## Key Files

| File | Description |
| --- | --- |
| `packages/r-html-konva/` | `@dineug/r-html-konva`, which every scene file imports by package name: the Konva `HostAdapter`, the `konva` tag that `konvaImportSource: '@dineug/r-html-konva'` points compiled Konva JSX at, the draw gate (`whenDrawn`, `markDirty`, `beginAnimation` / `endAnimation`, `onBeforeFlush`) and the seven `k-*` intrinsics |
| `intrinsics.test-d.ts` | A `k-*` tag as this package's program sees it, run by the `tsc --noEmit` gate |
| `imports.test.ts` | The allowlist of `konva/lib/*` modules, the barrel ban, the owner of `Tween` |
| `zOrder.test.ts` | No z-order call in this package's sources, since the order is the host's ledger |
| `theme.ts` | The palette a scene paints from, resolved from theme custom properties |
| `testHandle.ts` | Live stages keyed by the role their owner registers them under, so a spec can reach the main canvas and the minimap independently |
| `workerDomStubs.ts` | What konva and r-html construct that a worker realm has no constructor for |
| `scene/viewLayout.ts` | What a view shows: `getVisibleIds`, `getVisibleColumnIds`, `getTablePoint`, `getReachedTableIds`, `getHighlightIds`, and the view hover and pin |
| `scene/viewport.ts` | The coordinate canon and the culling rect (rule in `src/components/erd/AGENTS.md`) |
| `scene/viewFreeze.ts` | `sceneKeyOf` and the freeze a drag holds (rules in `src/components/erd/AGENTS.md`) |
| `scene/konvaFlip.ts` | The column flip, the one shipped module that names `konva/lib/Tween` |
| `scene/stacking.ts` | `stackTablesAndMemos`, the one order tables and memos paint in (rule in `src/components/erd/AGENTS.md`, The canvas and its presses) |
| `scene/renderScene.browser.test.tsx` | Pins the `Konva.DD` registration the host package's draw gate makes, on a real scene |

## Rules

### Importing konva

- **Import konva only through `konva/lib/*`.** `imports.test.ts` allowlists the modules shipped code may name and bans the `konva` barrel anywhere. The barrel pulls every shape, filter and DOM binding into the build, and nothing else would fail if it crept in.
- **Keep `Animation` out, `Tween` in `scene/konvaFlip.ts`.** The same spec keeps `konva/lib/Animation` out of shipped code and lets `scene/konvaFlip.ts` alone name `konva/lib/Tween`. `Animation` runs konva's own draw loop, and the host package's draw gate is the only draw authority outside an animation; the flip opens its window with `beginAnimation` / `endAnimation`.
- **Name `Global` and `Node` in specs or by type alone.** The host package configures konva's namespace, so no shipped file here names `konva/lib/Global`; a spec reads or sets the namespace through it (`Konva.isDragging`, `Konva.pixelRatio`). Every shipped `konva/lib/Node` import is a type (`KonvaEventObject`, `Node`), which `imports.test.ts` holds.
- The `konva` version range and why it is a caret: the package file § Dependencies.

### Scene roots

- **Scene roots export in lower case on purpose.** `renderCanvasScene` (`src/components/erd/canvas/CanvasScene.tsx`) and `renderMinimapScene` (`src/components/erd/minimap/MinimapScene.tsx`) render imperatively. `src/components/erd/canvas/Canvas.tsx` and `src/components/erd/minimap/Minimap.tsx` hand-roll `import.meta.hot.accept`. A capitalized or dropped export would make `vite-plugin-r-html` treat the module as a component boundary, and the parent's accept would silently stop running.

### Konva JSX

- **Open a Konva file with `/** @jsxHost konva */`.** It compiles against `konvaImportSource: '@dineug/r-html-konva'`, which all three Vite configs set: `vite.config.ts`, `vite.umd.config.ts` and `vitest.config.ts`. `vite-plugin-r-html` refuses the pragma without that option, since nothing else tells it where the `konva` tag lives.
- **Use the seven intrinsics the host package declares.** They are `k-circle`, `k-group`, `k-layer`, `k-line`, `k-path`, `k-rect` and `k-text`, in `packages/r-html-konva/src/jsx.ts`, which merges them into r-html's `JSX.IntrinsicElements`; this program reads them from the package's `dist/jsx.d.ts`.
- **One host per file and named attributes only.** Mixing hosts in a file, `class` / `style` / `zIndex`, a spread or a text child fail the compile. `class` and `style` commit through an `HTMLElement` check a Konva node never passes, and z-order belongs to the host's ledger. A spread would reach the node through `Reflect.set`, which the Konva host does not read.
- **`bool:`, `prop:`, `draggable`, `on:drag*` are typed `never`.** The DOM sigils write through paths a Konva node does not have. Konva's own dragging moves a node behind the ledger and reorders its siblings, so a column drag is `drag$` over the scene's mouse stream instead.
- **Three specs gate the Konva JSX.** `src/__jsx-parity__/parity.konva.browser.test.tsx` gates the rules above. The host package's `src/jsx-types.test-d.ts` holds the `never` types against its source, and `intrinsics.test-d.ts` holds one of them as this program sees it, so a build of the package that stops shipping the merge fails here.

### What a view shows

- **`scene/viewLayout.ts` decides what a view shows.** A view shows only the tables in its `positions`, and nothing until a layout lands. It shows no memos and no table groups, only the relationships with both ends shown, and rows per `showMode`. `settings.show` and `columnOrder` do not apply.
- **The document shows every list, memos aside while hidden.** `getVisibleIds` gives the document its own lists, the memos left out while `Show.hideMemo` is set (`src/components/erd/AGENTS.md`).
- **Keep view hover and pin out of actions.** They are module observables keyed on `editor.id`, never actions. So a view hover or pin never reaches the document, the history or a peer.

### Particle layer

- **Keep `ParticleLayer.tsx` one childless `k-layer`.** The file is `src/components/visualization/particles/ParticleLayer.tsx`. `createParticleLoop` adds particles behind the host's ledger, so a child in the template makes the next reconcile remove them all.
- **The particle loop asks no frame while idle.** It is one `requestAnimationFrame` loop on `layer.draw()`, and it asks no frame while nothing is lit.

### Rules kept in other files

- The coordinate canon over `settings.originX` / `originY` and `scene/coordinateAuthority.test.ts`: `src/components/erd/AGENTS.md` § Coordinates and scrolling.
- Frozen drags through `scene/viewFreeze.ts` and per-scene records keyed on `sceneKeyOf(root, source)`: `src/components/erd/AGENTS.md` § Coordinates and scrolling.
- The host's ledger, the draw gate, the `Konva.DD` registration and why the package can be `sideEffects: false`: `packages/r-html-konva/AGENTS.md`.
- The export-png SharedWorker's hot swap of scene modules, and the scene the PNG and SVG exports draw from the document JSON: `src/services/AGENTS.md`.

## Testing Requirements

- **`intrinsics.test-d.ts` runs under `tsc --noEmit` alone.** The package configures no Vitest typecheck project, so the `tsc --noEmit` gate in front of the build and the test task enforces its assertions. `tsconfig.build.json` leaves every `*.test-d.ts` out of `dist/`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
