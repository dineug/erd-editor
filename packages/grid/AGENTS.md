<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-18 | Updated: 2026-10-18 -->

# grid

## Purpose

`@dineug/grid` (`private: true`) is a spreadsheet grid drawn on a Konva `Stage` through `@dineug/r-html-konva`. It holds no data: a host gives it a row count, the column definitions and a `getCell(row, col)` getter, and a draw reads only the cells in view, so a frame costs what the visible cells cost, whatever the row count. Each of the six regions (the corner, the column header, the frozen column header, the row-number header, the frozen cells and the scrolling cells) is one `k-shape` whose `sceneFunc` paints it, and an overlay layer draws the selection, the header highlights and the scrollbars. The package holds the pure models (columns, viewport and scroll mapping, selection, keys, editing, TSV, text fitting), the theme, the font metrics and that scene; the entry exports their types and the two default themes. The `Grid` component, which mounts the Stage under a DOM scroller and feeds the models pointer, keyboard, clipboard and editing input, comes in a later change, so nothing outside this package mounts a grid yet. `erd-editor` lists it as a devDependency and imports nothing from it. A change keeps the node count free of the cell count (Rules § The scene), the scene functions on the raw state (Rules § State and redraws) and every draw behind `r-html-konva`'s gate.

## Making a Change

1. **Read the files on both sides of the change** (root step 1). A change to how the scene marks, flushes or sizes the stage reads `packages/r-html-konva/AGENTS.md` (the gate, `k-shape` and `markDirty`). A change to how a Konva file compiles reads `packages/vite-plugin-r-html/AGENTS.md`.
2. **Name a new konva module in `src/imports.test.ts`.** A shipped file that constructs a new `konva/lib/*` class adds its module to `RUNTIME_MODULES`; one that names a module by type alone adds it to `TYPE_ONLY_MODULES`, and a spec-only one to `SPEC_ONLY_MODULES`. The spec fails on any konva module its lists do not name.
3. **Run the package's `test` task** (root step 3), which runs `tsc --noEmit`, then the `unit` and `browser` projects:

   ```
   pnpm exec vp run --filter @dineug/grid --fail-if-no-match test
   ```

   When the `browser` project fails to start, install Chromium with `pnpm --filter @dineug/grid exec playwright install chromium` and run the task again. A change to an export or a type runs `pnpm test` instead, since `erd-editor`'s `test` task takes this package's `dist/**/*.d.ts` as input.
4. **Run the coverage gate** (root step 4), both projects at 80% per file:

   ```
   pnpm --filter @dineug/grid --fail-if-no-match test:coverage
   ```

5. **Run root step 5**, `pnpm check` then `pnpm build`. `pnpm peer-graph` and `pnpm size` are not reached while `erd-editor` imports nothing from this package. Look at a change a person would see on the demo page (`pnpm --filter @dineug/grid dev`), and for one that moves what a frame costs, run `pnpm --filter @dineug/grid bench` and report what it prints (Testing Requirements).
6. **Report as root step 7 says.**

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | The package surface: the types `CellRef`, `CellRange`, `GridSelection`, `GridBounds`, `CellStyle`, `ColumnDef`, `VisibleRange`, `CellGetter`, `CellStyleGetter`, `SceneLayout`, `SceneRect`, `ColumnResize`, `SceneData`, `SceneInit`, `SceneState`, `FontMetrics` and `GridTheme`, and at runtime `lightTheme` and `darkTheme` alone. Pinned by `src/index.test.ts` |
| `src/theme.ts` | `GridTheme`, the fifteen colour tokens a host maps its theme onto, and the frozen `lightTheme` / `darkTheme`. `src/theme.test.ts` pins the tokens and their order, the hex spelling, the translucent selection fill, the opaque header highlights and a 4.5:1 contrast for each text token on the surface it is drawn on |
| `src/font.ts` | `DEFAULT_FONT` (erd-editor's canvas stack at 13px, written out since the grid cannot import its consumer), `measureFont` (ascent and descent from the font box of `M`, the widest advance of `ADVANCE_PROBES`, pretext's emoji calibration) and `maxAdvance`. `src/font.test.ts` runs a stand-in canvas, `src/font.browser.test.ts` Chromium's faces |
| `src/model/types.ts` | `CellRef`, `CellRange`, `GridSelection`, `GridBounds`, `CellStyle` and `ColumnDef`, the types every model and the scene share; types only, out of coverage |
| `src/model/columns.ts` | `columnOffsets` (each column's left edge, the total width last), `columnAt`, `resizeEdgeAt` and `clampColumnWidth`: a default width of 120, a minimum of 24, a resize grab of 4px either side of an edge |
| `src/model/viewport.ts` | `rowAt`, `frozenCount` / `frozenWidth`, `visibleRange` (two rows and one column of overscan past each edge), `scrollMapping` (the DOM scroll range, scaled by one ratio once the content outgrows `SCROLL_HEIGHT_CAP`) and `rowHeaderWidth` |
| `src/model/selection.ts` | The spreadsheet selection: `clickCell`, `dragTo`, `clickColumnHeader`, `clickRowHeader`, `clickCorner`, `selectAll`, `moveActive`, `isSelected`, and `selectedRows` / `selectedColumns` / `headerState`, which the header highlights paint from |
| `src/model/keys.ts` | `GRID_KEYS`, the frozen list of keys the grid may consume, `keyAction` (a keydown to a move, an edit, a clear, a commit or a cancel), `selectionModifiers` and `isApplePlatform` |
| `src/model/editing.ts` | The edit state machine: `startEdit`, `inputDraft`, `commitEdit`, `cancelEdit`, `closeEdit`, `isReadonly`, and `writableChanges`, which a paste or a clear filters through |
| `src/model/tsv.ts` | `serialize` and `parse` (tab-separated, no quoting), `copyableRanges`, `copyRows`, `fillTargets` and `pasteTargets` |
| `src/model/text.ts` | `normalizeCellText` and `createTextFitter`: the per-font measure cache, the bound under which a text draws unmeasured, `MISS_BUDGET`, and the ellipsis cut. `src/model/text.test.ts` stands pretext in, `src/model/text.browser.test.ts` runs it on real faces |
| `src/model/*.test.ts` | One unit spec per model file, run in happy-dom |
| `src/scene/GridScene.tsx` | `renderGridScene(stage, scene)` under `/** @jsxHost konva */`: the body layer's six region shapes, and the overlay's clip groups, ranges, active cell, header highlights and scrollbars; the `onBeforeFlush` listener that sizes the stage |
| `src/scene/state.ts` | `createSceneState`: the raw state, its shallow observable proxy, the setters and the layers each marks, `bindLayers` (each layer's `beforeDraw.grid` and `draw.grid` handlers) and `takePendingSize` |
| `src/scene/layout.ts` | `computeLayout`: the six regions around the row-number header and the frozen columns, the cell area short of each scrollbar strip (`SCROLLBAR_SIZE`) and the scroll range |
| `src/scene/paint.ts` | The nine scene functions, module constants, and `bindScene`, which lets a function find its scene through the Stage of the shape it paints |
| `src/scene/overlay.ts` | `regionView`, `rangeBox` (a range's edge on the grid lines around it, cut to the view plus the edge), `fillBoxes` (its fill around the active cell), `activeBox` and `HIDDEN_BOX` |
| `src/scene/draw/context.ts`, `cells.ts`, `headers.ts` | `drawCells` and `drawHeaders`, pure draw functions on a 2D context, with the padding, baseline, clip and text-state helpers they share |
| `src/scene/draw/scrollbar.ts` | `scrollbars`: where each track and thumb sits, which the overlay's four `k-rect` nodes take |
| `src/scene/*.test.ts`, `src/scene/draw/scrollbar.test.ts` | Unit specs: the layout, the overlay boxes, what each scene function hands its draw function, and each setter's writes and marks with the gate stood in |
| `src/scene/draw/cells.browser.test.ts`, `headers.browser.test.ts` | The draw functions on an `OffscreenCanvas` in Chromium: backgrounds, lines, text placement and colour, the column clip, the highlight over a drawn header |
| `src/scene/GridScene.browser.test.tsx` | A million-row scene on a live Stage: the fixed regions and the scrolling regions' clip after a scroll, getter calls per draw, the ellipsis, the style hook and read-only backgrounds, a new theme, font or version, the selection at the frozen boundary, a range's edge and the unfilled active cell, a grid with no rows or no columns, a new size, a pixel ratio of 2 (konva's `pixelRatio` set as the canvases are made), the scrollbars, an unmount |
| `src/imports.test.ts` | The `konva/lib/*` allowlists and the barrel ban; siblings reached by name and exported subpath alone |
| `src/__test-utils__/scene.ts` | `drawn()`, `nextFrame`, `pixelAt`, `rgba` and `near`, the waits and pixel reads every browser spec shares |
| `src/index.dev.ts`, `index.html` | The demo page `vp dev` serves: `index.html` loads `/src/index.dev.ts`, which the build skips (`tsconfig.build.json`) and coverage excludes. The bench drives this page |
| `bench/scroll.bench.ts`, `playwright.bench.config.ts`, `bench/tsconfig.json` | The scroll bench: Playwright against `vp dev` on port 5179 (`E2E_PORT` moves it), 1440×900 at a pixel ratio of 1, one worker, no retry, the `list` reporter, results in `bench/.results-bench` (gitignored); `bench/tsconfig.json` checks the bench and its config, which no other program covers |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, jsx: { konvaImportSource: '@dineug/r-html-konva' }, minify: false, preserveModules: true, server: { open: !process.env.E2E } })` (root § Working In This Directory, Library builds) |
| `vitest.config.ts` | `unit` (happy-dom) and `browser` (headless Chromium) projects, each with the JSX plugin against `@dineug/r-html-konva`; one root coverage block |
| `tsconfig.json`, `tsconfig.build.json` | The package program (`@/*`, JSX against `@dineug/r-html`, preserved for the plugin); the build program, without specs, `__test-utils__` and `src/index.dev.ts` |
| `package.json` | Scripts `dev` and `bench`, which build this package's workspace dependencies first, `test:dev`, `test:coverage` and `bench:typecheck` |

## Rules

### Importing

- **Import konva only through `konva/lib/*`.** `src/imports.test.ts` bans the barrel anywhere, since it pulls every shape, filter and DOM binding into each consumer's build. Shipped code may name `konva/lib/Stage`, and `Context`, `Layer` and `Shape` by `import type` alone, which the spec holds in every file; a spec may add `konva/lib/Global`. Every layer, group and shape comes from a `k-*` tag, which `r-html-konva` constructs.
- **Keep konva a peer.** The host's `instanceof` checks and its gate's patch of the konva namespace assume one module, so a consumer supplies the one copy.
- **Reach a sibling by its name and a subpath its exports map opens.** `src/imports.test.ts` refuses a relative path out of `src/` and a subpath, `src/` or `dist/` included, that the sibling's `exports` do not list.
- **Draw only through the gate.** Nothing here calls `batchDraw` or `draw`: a setter marks a layer with `markDirty`, `setSize` arms a commit with `requestFlush`, and the stage is sized from `onBeforeFlush` (State and redraws).

### State and redraws

- **Scene functions are module constants that read the raw state.** `paint.ts` holds the nine as fixed references and finds a shape's scene through a `WeakMap` keyed by its Stage (`bindScene`). The host's `setAttribute` skips a value a node already holds, so a fixed function draws again only once its layer is marked, while a function built per render would mark its layer on every commit. They read `scene.state` and `scene.frame`, never `scene.observed`, whose get trap runs on every read, and a draw makes thousands.
- **Write through the proxy, and replace a field whole.** `observed` is `observable(state, { shallow: true })`, so a template bound to a field updates when it is written, and a field changed in place updates nothing. A frozen value, such as a default theme, is held as a shallow copy (`trackable`), since r-html's proxy subscribes to no frozen object.
- **Each setter marks the layers its field draws on.** `src/scene/state.test.ts` pins this table; a new field adds a row there and here.

  | Setter | Marks |
  | --- | --- |
  | `setScroll` | the body; the overlay follows through its scroll groups' `x` / `y`, which the template writes |
  | `setSelection` | the overlay, every call, the same selection again included: trading one off-screen range for another writes nothing to a `k-rect` and still moves a header highlight |
  | `setGetters` | the body, the only layer that reads a getter |
  | `setTheme`, `setFont`, `setVersion`, `setColumns`, `setRowCount`, `setFrozenColumns`, `setRowHeight`, `setResize` | the body and the overlay |
  | `setSize` | neither; the stage draws every layer once as it resizes, and the templates it moves mark the layers they sit on |

  A setter handed what the state holds marks nothing, `setSelection` aside. A layer draw that ran out of measurements marks its own layer again from its `draw.grid` handler (Text).
- **The grid keeps no cell values.** Every draw asks the getters for every cell it paints, once each, and the measure cache keys on the text itself; a host shows a data change by raising `version` or handing new getters.
- **Size the stage after the templates, once.** `setSize` lays the regions out again, keeps the size pending and calls `requestFlush`; `GridScene`'s `onBeforeFlush` listener, which runs after r-html's drain in the same commit, resizes the stage. Konva's Stage draws every layer at once on each of its `widthChange` and `heightChange` events, so with both axes new the listener writes the width past its setter and lets the height's event alone resize. That draw reads the templates: sizing the stage before the drain would draw the overlay's clip groups and scrollbars at the old size for a frame, while the body, which reads the raw state `setSize` already laid out, draws the new range either way.
- **A layer draw settles its frame first.** Each layer's `beforeDraw.grid` handler sets the visible range, the header selections (overlay only), the fitter's font and budget and its capacity before the first shape paints. The unbinding `bindLayers` returns removes the `.grid` handlers, and `GridScene` runs it at unmount with `bindScene`'s and its `onBeforeFlush` listener's.

### The scene

- **No konva node per cell.** The body layer holds the six region shapes and nothing else. The overlay holds, per cell region, a clip group with a scroll group of five `k-rect` nodes per range (four fill boxes and the edge) and one for the active cell; a highlight `k-shape` for each of the column, frozen column and row-number headers; and four scrollbar `k-rect` nodes. The node count follows the ranges, never the rows or the cells: a cell, a label or a grid line is pixels a scene function paints.
- **Clip and scroll in two groups.** The outer `k-group` sits at the region's origin with `clipX` / `clipY` 0 and the region's size, bound to the layout alone; the inner one's `x` / `y` is minus the content point the region's corner shows, so it carries the scroll. Konva clips a group in its own space after its transform, so a clip on the scrolled group would move its window with the content, and offsetting `clipX` / `clipY` to undo that would push offsets of tens of millions of px through the canvas's float32 transform, where the edges drift. An empty region's clip is 0px wide or tall, which konva still clips to, so it draws nothing; `visible` only spares the draw a walk through its nodes.
- **Header highlights sit outside the scroll groups.** Each is a `k-shape` in its header region's clip group, in the region's own coordinates, so a half-scrolled selected column's highlight stays out of the frozen header and the corner. It repaints the cells the selection reaches opaque, in the selected tokens (`selectedHeaderBackground` with `headerText` where a range meets the row or column, `fullSelectionBackground` with `selectedHeaderText` where one spans it), since a translucent tint cannot change the label drawn under it. So a frame where only the selection changed redraws the overlay alone.
- **Cut a range's rect to the view.** `rangeBox` cuts each range to the region's view plus its 1px edge, and `fillBoxes` its fill to the view, since a canvas takes a rect's size as a float and a whole column is millions of px tall; the cut edges fall outside the clip. Every box out of view is `HIDDEN_BOX`, the same attributes whatever it stood for.
- **A range's edge runs on the grid lines around it.** A cell draws its own right and bottom lines, so a range's left and top edges take the line of the cell before, and its right and bottom edges its own last lines; where the line before is the region's edge, outside the clip, the edge takes the range's first pixels instead. The active cell's 2px edge takes each line and the pixel inside it.
- **The fill leaves the active cell out,** as a spreadsheet does: `fillBoxes` hands each range four boxes, above, below, left and right of the active cell, all but the first hidden for a range without it, so one cell selected draws only the active cell's edge. A range draws its fill and then its edge, so a later range tints an earlier one's edge as it tints its cells.
- **A stroked `k-rect` takes its translucency from its colour's alpha, never `opacity`, and sets `perfectDrawEnabled={false}`.** Konva draws a filled, stroked shape whose opacity is under 1 through `Stage.bufferCanvas`, which keeps the pixel ratio konva read at load. `selectionFill` is an `#rrggbbaa` token, which `src/theme.test.ts` holds translucent, so no box takes `opacity`.
- **Every node is `listening={false}`.** Konva then draws no hit canvas; a hit is the models' to find (`columnAt`, `rowAt`, `resizeEdgeAt`).
- **The draw functions take a 2D context and plain data.** `drawCells` and `drawHeaders` take a `CanvasRenderingContext2D` or `OffscreenCanvasRenderingContext2D`, the theme, the font and its metrics, the fitter and the getters, never a node or the scene state. `paint.ts` is the one glue, handing them the layer's native context, which lets `draw/*.browser.test.ts` paint them on an `OffscreenCanvas` and `src/scene/paint.test.ts` stand them in.
- **A cell paints in a fixed order.** Its background is the style hook's, else `readonlyBackground` where its column or its style is read-only, else the theme's; its text colour is the hook's, else `text`. The text sits left aligned, `CELL_PADDING` in, inside a clip of its column, so a text drawn whole or measured short stays in its column. The grid lines follow, and the frozen border runs down the frozen region's right edge.
- **`renderGridScene` exports in lower case**, as erd-editor's scene roots do: it is a call that mounts the scene on a Stage, not a component a template mounts. Its module has no default export and every config here compiles with `refresh: false`, so `vite-plugin-r-html` never makes it a refresh boundary (`packages/vite-plugin-r-html/AGENTS.md`).

### Text

- **pretext is the one engine.** It decides whether a text overflows (`measureNaturalWidth`) and where it is cut (`layoutNextLine` at the content width less the ellipsis's, the trailing spaces dropped), so no second measure can disagree at the edge. A word longer than its cell breaks between graphemes.
- **Measure the string that is drawn.** `normalizeCellText` turns each tab, line feed, form feed and carriage return into one space and keeps a run a run, as a canvas draws them, and the fitter prepares it with `whiteSpace: 'pre-wrap'`, since pretext's default collapses spaces the canvas draws.
- **Skip the measure under the bound.** A text whose length times `maxAdvance` fits the content width draws unmeasured. `maxAdvance` is the widest of `W`, `가`, `漢` and `😀` in the font, and a glyph wider than all four is left to the column clip; `src/model/text.browser.test.ts` holds the bound on real faces.
- **Measure a font outside any scene function.** `measureFont` runs when the scene is created and when `setFont` runs, since it has pretext calibrate its emoji widths against a DOM span, a layout read; `src/font.browser.test.ts` holds that a cell measured after reads no DOM.
- **Keep the miss budget.** A layer draw makes at most `MISS_BUDGET` (200) pretext measurements. Past it a text that may overflow is drawn whole under its column clip and the layer marks itself dirty, so the next frame measures and cuts it; `src/model/text.test.ts` and `src/scene/GridScene.browser.test.tsx` hold both halves.
- **The cache holds one font, keyed by the text.** Its LRU holds each text's width, or its prepared segments and last cut once it overflowed, so a cell builds no key. `reserve` grows it to four times the cells a frame draws and never shrinks it, and a new font empties it.

### The models

- **Selection follows a spreadsheet.** No modifier leaves one range, Ctrl (Cmd on an Apple platform) adds one, Shift extends the last from the active cell; a header, the corner and select-all make one range each, so a million rows cost one rectangle. A gesture that changes nothing hands back the same object, so a caller tells a change by identity and reports it once.
- **A key outside `GRID_KEYS` reaches the host,** but for the A key under Ctrl or Cmd: `keyAction` also reads it as `A` under Caps Lock and as the physical `KeyA` on a layout whose letters are not Latin, so select-all works on any layout. A caller tells a key the grid consumes by `keyAction` answering anything but `null`, never by the list. `keyAction` answers `null` for a composing key (`isComposing` or key code 229), for Alt and for the other platform's modifier. The list is frozen, so a caller cannot widen what the grid swallows.
- **An edit is measured against the value it started from.** Its fields are read at the start and only input moves the draft, and `commitEdit` names a change only when the value differs from that start, so a peer's write meanwhile is not undone. A cell read-only by its column or its style takes no edit, paste or clear; a column's own editor is handed the close reason and the edit waits for it to commit or cancel.
- **TSV has no quoting.** A copy turns a tab or line break inside a value into a space; `parse` drops the empty lines at the end. Several ranges copy only over the same rows or the same columns (`copyableRanges` answers `null` otherwise). A one-cell clipboard fills every range, any other is written once from the active cell; rows past the last are kept for the host to add, and columns past the last are dropped and reported (`writableChanges`'s `beyondColumns`).
- **The scroll range is scaled once the content outgrows the cap.** `scrollMapping` maps a DOM `scrollTop` to a content offset by one ratio past `SCROLL_HEIGHT_CAP`, and snaps the last DOM pixel to the content's end, so the last row always shows; the scene's `scrollTop` is always in content pixels.

### Browser floor

- **Ship nothing the floor lacks.** `build-target.ts` sets chrome91, firefox93 and safari16.4, so shipping code calls no `Array.prototype.at` or `Object.hasOwn` (read the last element by index) and relies on no CSS a floor browser lacks without a fallback. pretext segments text with `Intl.Segmenter`, which firefox93 lacks; erd-editor's memo text shares that gap.

## Testing Requirements

- **The `test` task runs both projects.** `tsc --noEmit` first, then `unit` in happy-dom and `browser` in headless Chromium, which the `browser` project needs installed (Making a Change). The `.browser.` infix alone picks the project. Neither retries a spec, so a failure is real.
- **Coverage is 80% per file on all four metrics**, over `src/**/*.{ts,tsx}` less the specs, `__test-utils__`, `src/index.dev.ts` and `src/model/types.ts`.
- **Wait with `drawn()`, never the clock.** `whenDrawn` resolves as konva books a frame, and `Layer.batchDraw` paints on the next `requestAnimationFrame`, so `drawn()` (`src/__test-utils__/scene.ts`) waits one frame after it. A draw out of measurements books another commit, so it repeats until `currentEpoch()` is the same twice in a row. Every pixel and every call count is read after it; no spec sleeps on a timer, retries, or carries `.skip` or `.only`.
- **Count the getters per draw.** `src/scene/GridScene.browser.test.tsx` resets its counters on the body layer's `beforeDraw` and holds each getter between the cells in view and (rows in view + 4) × (columns in view + 2), at any scroll and when long texts outrun the budget.
- **The unit specs stand pretext and the canvas in**, since happy-dom has neither; the `.browser.` specs run the real engine and faces, comparing against what Chromium's own canvas reports, so none is gated on a platform.
- **`bench` and `bench:typecheck` are outside `pnpm test` and CI, and report only.** `pnpm --filter @dineug/grid bench` builds this package's workspace dependencies, starts `vp dev` with `E2E=1` and prints, per scenario, what a frame's work took, with no baseline file and no gate. It times konva's layer draws themselves, since the flush only books them for the next frame and the gap between frames follows the display, not the work. `pnpm --filter @dineug/grid bench:typecheck` checks the bench and its config.

## Dependencies

### Internal

`@dineug/r-html` (the observable state, the component and its hooks and refs) and `@dineug/r-html-konva` (`renderKonva`, the gate's `markDirty`, `requestFlush` and `onBeforeFlush`, the `k-*` intrinsics; `whenDrawn` and `currentEpoch` in the specs), both in `dependencies`, so `dist/` keeps them bare; `@dineug/vite-plugin-r-html` (devDependency, the JSX transform the build and both test projects compile through).

### External

`@chenglou/pretext` `^0.0.8` in `dependencies`, the text measure and cut (Rules § Text); `konva` `^10.3.2` as a peer and a devDependency, through `konva/lib/*` only (Rules § Importing); `@playwright/test` for the bench.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
