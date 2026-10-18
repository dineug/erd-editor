<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-18 | Updated: 2026-10-18 -->

# r-html-konva

## Purpose

`@dineug/r-html-konva` (`private: true`) is the second `@dineug/r-html` host, the one that renders templates into a Konva `Stage` instead of the DOM. It holds the host adapter (`konvaAdapter`), the `konva` tag and `renderKonva` that compiled Konva JSX calls, the draw gate (`batchDraw.ts`), the only draw authority outside an animation, and the eight `k-*` intrinsics. `erd-editor` draws its ERD scene through it and lists it as a devDependency, so its build inlines it. A change keeps the ledger the one owner of membership and order (Rules § The ledger), the gate the one thing that draws (Rules § Drawing) and every `k-*` type reachable from a consumer's program (Rules § Konva JSX).

## Making a Change

1. **Read the files on both sides of the change** (root step 1). A change to what the adapter does with a `HostAdapter` call reads `packages/r-html/AGENTS.md` (Rules § Host adapter contract). A change a scene would see reads `packages/erd-editor/src/konva/AGENTS.md`, the scene's rules. A change to how the pragma compiles reads `packages/vite-plugin-r-html/AGENTS.md`.
2. **Name a new konva module in `src/imports.test.ts`.** A shipped file that constructs a new `konva/lib/*` class adds its module to `RUNTIME_MODULES` there; one that names a module by type alone adds it to `TYPE_ONLY_MODULES`. The spec fails on any konva module its lists do not name.
3. **Run the package's `test` task** (root step 3), which runs `tsc --noEmit`, then the `unit` and `browser` projects:

   ```
   pnpm exec vp run --filter @dineug/r-html-konva --fail-if-no-match test
   ```

   When the `browser` project fails to start, install Chromium with `pnpm --filter @dineug/r-html-konva exec playwright install chromium` and run the task again. A change to an export, a type or an intrinsic runs `pnpm test` instead, since `erd-editor` type-checks against this package's `dist/**/*.d.ts`.
4. **Run the coverage gate** (root step 4), both projects at 80% per file:

   ```
   pnpm --filter @dineug/r-html-konva --fail-if-no-match test:coverage
   ```

5. **Run root step 5**, `pnpm check` then `pnpm build`, and after it `pnpm peer-graph` and `pnpm size`, since `erd-editor` inlines this package into its scene and its export worker. Then run `pnpm --filter @dineug/erd-editor e2e` for a change a user would see on the canvas (root step 6).
6. **Report as root step 7 says.**

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | The package surface: the host's `konva`, `konvaAdapter`, `renderKonva`, `hostStats`, `resetHostStats`, `MINIMAP_STAGE_NAME` and `HostStats`; the gate's `currentEpoch`, `onBeforeFlush`, `requestFlush`, `markDirty`, `beginAnimation`, `endAnimation` and `whenDrawn`; and the type `KonvaIntrinsicElements`. Pinned by `src/index.test.ts` |
| `src/host.ts` | The Konva `HostAdapter`: the ledger of slots that holds membership, order and the markers a Konva tree cannot, reconciled once per parent per commit; the `konva` tag and `renderKonva` |
| `src/batchDraw.ts` | The draw gate: `Konva.autoDrawEnabled = false`, one `batchDraw` per dirty layer per commit at the microtask fixed point, the Tween windows, and the `Konva.DD` registration |
| `src/jsx.ts` | `KonvaIntrinsicElements`, the eight `k-*` tags and the attributes each takes, merged into r-html's `JSX.IntrinsicElements`; types only |
| `src/jsx-types.test-d.ts` | Type assertions on `src/jsx.ts`, run by the `tsc --noEmit` gate alone |
| `src/imports.test.ts` | The allowlist of `konva/lib/*` modules and the barrel ban |
| `src/zOrder.scan.test.ts`, `src/zOrder.adapter.test.ts` | z-order calls only in `host.ts` and `host.marker.test.ts`; the refused attributes and the id convention |
| `src/host.marker.test.ts` | The ledger against the DOM host's answers, and its cost counted in host operations |
| `src/host.browser.test.tsx`, `src/hostContext.browser.test.tsx` | A template on a live Stage: the placement rules, one draw per layer per commit, the id convention; DI through a DOM provider, a component's own event bus and a bridged fragment |
| `src/batchDraw.browser.test.ts` | The commit as the fixed point microtask flush, and the Tween window |
| `src/kShape.browser.test.tsx` | A `k-shape` painting through its `sceneFunc`: the pixels it fills, no redraw for the same function until `markDirty`, one for a new function, and its `hitFunc` box |
| `src/konvaUpstream.browser.test.ts`, `src/konvaId.browser.test.ts` | Konva behaviour the gate, the `zIndex` ban and the id convention rest on, pinned against the installed konva |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, jsx: { konvaImportSource: '@/host' }, minify: false, preserveModules: true })` (root § Working In This Directory, Library builds) |
| `vitest.config.ts` | `unit` (happy-dom) and `browser` (headless Chromium) projects, each with the JSX plugin against `@/host`; one root coverage block |

## Rules

### Importing konva

- **Import konva only through `konva/lib/*`.** `src/imports.test.ts` allowlists the modules shipped code may name and bans the `konva` barrel anywhere. The barrel pulls every shape, filter and DOM binding into each consumer's build, and nothing else would fail if it crept in.
- **Keep `Animation` and `Tween` out of shipped code.** Both are spec-only in `src/imports.test.ts`. `Animation` runs konva's own draw loop, and a consumer that tweens opens a window with `beginAnimation` / `endAnimation`, so the gate stays the only draw authority outside one.
- **Keep konva a peer.** `isKonva` and every `instanceof` check in `host.ts` assume one konva module, and `batchDraw.ts` patches its namespace, so a consumer supplies the one copy (`erd-editor`'s `dependencies` name it) and this package never bundles its own.

### Drawing

- **Keep `Reflect.set(Konva, 'DD', DD)` in `batchDraw.ts`.** Only konva's barrel sets `Konva.DD`, which `Konva.isDragging` reads, and nothing here imports the barrel. Without that line every stage pointer dispatch throws. `erd-editor`'s `src/konva/scene/renderScene.browser.test.tsx` pins it on a real scene.
- **`sideEffects: false` holds because every host export reaches `batchDraw.ts`.** `host.ts` imports the gate and registers its reconcile with `onBeforeFlush` at module level, so a bundler that keeps any export keeps the gate's top-level writes (`autoDrawEnabled` and `Konva.DD`). A new module that exports host behaviour without reaching `batchDraw.ts` would lose them in a consumer's build. No spec here can see that, because Vitest and the dev server do not tree-shake; a consumer's built `dist/` is where it shows.

### The ledger

- **z-order belongs to the ledger.** `setAttribute` refuses `class`, `style` and `zIndex`, and `src/zOrder.scan.test.ts` allows a z-order call (`setZIndex`, `moveTo*`, `moveUp` / `moveDown`) only in `host.ts` and in `host.marker.test.ts`, which breaks the order on purpose to prove the next commit repairs it. A consumer keeps its own scan (`erd-editor`'s `src/konva/zOrder.test.ts`, with nothing allowed).
- **An id belongs to the main canvas.** `setAttribute` refuses an `id` on any node under a Stage named `MINIMAP_STAGE_NAME`, read through the ledger root, so an id scan over the live stages never meets two spellings of one id. A minimap node is found by `name` plus a `tableId` attribute.
- **Some names are the editor's.** `MINIMAP_STAGE_NAME` and the attributes `src/jsx.ts` types for the scene (`selected`, `sharedFocus`, `sharedSelect`, `tableId`, `kind`) are `erd-editor`'s; they stayed here as they were when the host left that package, and a change to them is a change to its scene.

### Konva JSX

- **Ship the intrinsics as a type re-export.** `src/index.ts` writes `export type { KonvaIntrinsicElements } from '@/jsx'`, which keeps `export type … from './jsx'` in `dist/index.d.ts`, so a consumer's program reads `dist/jsx.d.ts` and its `declare module '@dineug/r-html/jsx-runtime'` merge. A bare `import '@/jsx'` is dropped from the emitted declarations, and a hand-written `.d.ts` is never copied to `dist/`. Keep `src/jsx.ts` a module; the root `vite.config.ts` turns `typescript/no-namespace` off for it, since the merge must name the `JSX` namespace.
- **Open a Konva spec with `/** @jsxHost konva */`.** It compiles against `konvaImportSource: '@/host'`, which `vite.config.ts` and `vitest.config.ts` set; a consumer sets `'@dineug/r-html-konva'`. One host per file and named attributes only: a DOM tag, a spread, a text child, `class`, `style` or `zIndex` fail the compile.
- **`bool:`, `prop:`, `draggable` and `on:drag*` are typed `never`.** The DOM sigils write through paths a Konva node does not have, and konva's own dragging moves a node behind the ledger. `src/jsx-types.test-d.ts` holds these types, and the tag set at eight.
- **Hand a `k-shape` one `sceneFunc` and redraw it with `markDirty`.** `setAttribute` skips a value the node already holds, so a fixed function that reads changed state draws again only once its layer is marked, and a function built per render marks its layer on every commit. `src/kShape.browser.test.tsx` holds both, and `src/jsx-types.test-d.ts` holds `sceneFunc` and `hitFunc` to konva's own signature.

## Testing Requirements

- **The `test` task runs both projects.** `tsc --noEmit` first, then `unit` in happy-dom and `browser` in headless Chromium. The `.browser.` infix alone picks the project. Neither retries a spec, so a failure is real.
- **`src/jsx-types.test-d.ts` runs under `tsc --noEmit` alone.** No Vitest typecheck project is configured, and `src/jsx.ts` is out of coverage, being types only.
- **Count the work, not the clock.** `host.marker.test.ts` judges the reconcile by `hostStats` and `setZIndex` calls; its one wall-clock bound is loose enough for any runner. The browser specs spy on each layer's `batchDraw` after `whenDrawn`, so none rides a frame.
- **The upstream pins run first on a konva bump.** `konvaUpstream.browser.test.ts` and `konvaId.browser.test.ts` test konva, not this package: what the gate and the id convention assume of it.

## Dependencies

### Internal

`@dineug/r-html` (`dependencies`, so `dist/` keeps the import bare and `erd-editor` inlines the one copy it resolves); `@dineug/vite-plugin-r-html` (devDependency, the JSX transform the specs and the build compile through).

### External

`konva` `^10.3.2` as a peer and a devDependency, through `konva/lib/*` only (Rules § Importing konva).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
