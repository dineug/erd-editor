<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-27 -->

# services

## Purpose

`src/services/` holds the editor's three SharedWorker services. `elk-layout/` runs ELK for automatic placement and the Flow view, `export-png/` draws the PNG, SVG and preview exports, and `shiki/` highlights the code tabs. This file holds the rules of automatic placement with table groups, the coordinate hints ELK reads, and the export worker's hot swap, scene, language and name view. The same features have rules in other nested files. The Export image dialog's are in `src/components/export-image/AGENTS.md`, and the Code Generator tab's highlighting in `src/components/generator-code/AGENTS.md`. An import's placement is in `src/utils/AGENTS.md`, and the scene modules the export draws in `src/konva/AGENTS.md`. A change here keeps table groups together in every placement but the views' preset. It keeps every export drawn at 100%, in the language and the name view it is handed.

## Making a Change

1. **Read the files on the other side.** A change to the export's scene reads `src/konva/AGENTS.md` and `src/components/export-image/AGENTS.md`. A change to what the export worker imports from `i18n/` reads `src/i18n/AGENTS.md`. A change to placement reads `src/components/AGENTS.md` (Flow's placement) and `src/utils/AGENTS.md` (an import's placement).
2. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run.
3. **Run the e2e suites for a change a user sees.** `pnpm --filter @dineug/erd-editor e2e` builds the package and runs every Playwright spec against the dev server. `e2e/specs/automatic-table-placement.spec.ts` places tables through the ELK worker, `export-png.spec.ts` checks the exported png, and `shared-workers.spec.ts` starts all three workers on the dev server.
4. **Change a guarded rule and its spec together.** The specs that guard a rule are named beside it (Rules) and listed under Testing Requirements.

## Key Files

| File | Description |
| --- | --- |
| `elk-layout/index.ts` | `createElkLayout`, over one worker connection kept for the session; a host with no shared worker is refused; `SLOW_LAYOUT_MS` |
| `elk-layout/elkGraph.ts` | `createElkLayoutRequest`, `toHints`, `toTablePoints`, `toViewPoints` |
| `elk-layout/elkLayoutService.ts` | `ElkLayoutService`, which runs in the worker; `toElkGraph`, `containerOf`, `portsByNode` |
| `elk-layout/elkLayoutOptions.ts` | The ELK options per placement, `keepsTableGroups`, `GROUP_NODE_OPTIONS`, the compound nodes' options |
| `elk-layout/elkWorkerRealm.ts` | The `document` stub ELK's bundle looks for in a realm with no document |
| `elk-layout/elkLayout.shared-worker.ts` | The ELK worker's entry |
| `export-png/index.ts` | `createDocumentPng`, `createDocumentSvg`, `createDocumentPreview`: worker first, the main thread when the worker is missing or hands the drawing back |
| `export-png/documentScene.tsx` | `renderDocumentScene`: the export's own store at `EXPORT_ZOOM_LEVEL` and in the name view asked for, the scale, `createI18n` |
| `export-png/ExportScene.tsx` | The scene an export draws: the whole document on one layer, the groups behind it, no culling, no check marked |
| `export-png/exportBox.ts` | `EXPORT_ZOOM_LEVEL`, `getExportRect`, `getExportScale`, `getExportSize`, `getStageSize` |
| `export-png/pixelRatio.ts` | The canvas ceilings `CANVAS_AREA_MAX` and `CANVAS_SIDE_MAX`, `fitPixelRatio` |
| `export-png/toImage.ts` | `toImage` and `ToImageOptions`, which the package root exports: a document's png or svg with the Export image dialog's options |
| `export-png/exportPngService.ts`, `exportPng.shared-worker.ts` | `ExportPngService`, which draws off the thread that asked, and the worker's entry |
| `export-png/renderPng.ts`, `renderSvg.ts`, `sceneSvg.ts` | The png and the svg; the svg's rules are in `src/components/export-image/AGENTS.md` |
| `export-png/textWidth.ts` | `createOffscreenToWidth` and the font probe strings both realms measure |
| `shiki/index.ts` | `getShikiService`: spawns the worker on the first code panel that asks, keeps it for the session, answers `null` on a host with none |
| `shiki/shikiService.ts`, `shiki.shared-worker.ts` | `ShikiService.codeToHtml` over the grammars `constants/language.ts` maps onto, and the worker's entry |
| `shiki/graphqlGrammar.ts` | `@shikijs/langs/graphql`'s grammar without its `embeddedLangs` (rules in `src/components/generator-code/AGENTS.md`) |
| `src/workers/<worker>.spawn.ts` | The one place each SharedWorker is constructed, a module per worker |
| `src/components/erd/automatic-table-placement/` | The force simulation (`forceGroupBoxes`, `GROUP_BOX_GAP`) and `toPlacementActions` |
| `src/utils/tableGroup.ts` | `getTableGroupWraps`, a group's padded bounds |

## Rules

### Automatic Placement Keeps Table Groups Together

- **Automatic placement keeps table groups together.** It is an owner decision, held in `elk-layout/`, `src/components/erd/automatic-table-placement/` and the grid `sortTable`. It holds whether the groups are shown or hidden, since membership is data and the Show bit only draws.
- **Each group's members go in a group node.** Every ELK placement does this but the views' preset, which `keepsTableGroups` leaves out because a view draws no group. The node has `kind: 'tableGroup'`, and its `elk.padding` is the box the editor draws.
- **Group nodes repeat the placement's own options.** Inside a compound node ELK falls back to its default spacing otherwise.
- **Groups joined across borders share a `component` node.** Each set of groups and tables that relationships join across a group border goes inside one. It carries `elk.hierarchyHandling: INCLUDE_CHILDREN`, which is what makes ELK read an edge between two groups.
- **Keep `elk.hierarchyHandling` off the root.** On the root it switches off `elk.separateConnectedComponents` and stacks every table nothing joins in the first layer (measured 2026-10-10 with elkjs 0.12.0). The packing case of `elkLayoutService.test.ts` guards this.
- **Each edge goes in its deepest common node.** `toElkGraph` hands it to the deepest node holding both ends (`containerOf`). So a document with no group gets the flat graph it always did.
- **The bounds count each group's padded box.** `toTablePoints` and `toViewPoints` count it, so a placed import's group starts at `TABLE_SORT_START`.

### Force Simulation and Grid

- **Force simulation moves a group as one box.** This holds for a group with members, which stay where they stand inside it. The preview draws the box where it goes.
- **A group box stays `GROUP_BOX_GAP` clear.** `forceGroupBoxes` holds it that far from every other group's box and table. It needs the gap because a circle sized for a table lets a group several members wide run into a neighbour. There a member's centre would join it to the other group on its next drag.
- **A group's `forceCollide` circle fits inside its box.** It is the circle inside the box, so it claims no room past it. A table keeps its circle, so a document with no group lands where it always did.
- **The preview's run lasts as long as the preview.** Apply, Cancel, the stop key and the simulation's own end close it, its toast with it. Anything else that takes the preview away, the editor turning readonly or going, ends the run as it unmounts (`src/components/erd/automatic-table-placement/AutomaticTablePlacement.tsx`): the toast closes and the simulation stops, so no placement nobody applied lands later. A tab switch takes nothing away, since the ERD tab stays mounted behind the other tab, so the preview and its run go on. `AutomaticTablePlacement.test.ts` beside it and `src/components/erd/Erd.browser.test.tsx` pin it.
- **`sortTable` gives a group's members their own rows.** The rows sit inside one cell, where the group's first member comes. They wrap so the box fits the sort width (`canvasSizeInRange(doc.tableIds.length * 100)`). The reducer writes the group's rect.

### Where a Group Lands

- **A group lands at its members' padded bounds.** This holds for each group with members, whatever placed them (`getTableGroupWraps`, DOM-free, in the peer graph). It lands in the dispatch that moves the tables:
  - `toPlacementActions` for Auto Layout and the preview's Apply, with the scroll, so it is one undo;
  - `toLandingJson` for a placed replace;
  - `toSchemaAppend` for an append;
  - the sort reducer itself for a grid, on a copy whose points travel as values (`sortTablesToMoveAction$`, `withGridPoints`).
- **No placement changes membership.** A group with no member keeps its rect.
- How an import is placed before it lands, as a placed replace or as an append (`toSchemaAppend`): `src/utils/AGENTS.md`.
- The peer graph, which `getTableGroupWraps` belongs to: `src/peer/AGENTS.md`.

### Coordinate Hints

- **Hand ELK normalized coordinate hints.** `toHints` (`elk-layout/elkGraph.ts`) normalizes them. Handed raw coordinates, ELK's `INTERACTIVE` layering reads one document row as one layer per table.
- Flow's placement loop, which asks ELK for the views' preset: `src/components/AGENTS.md`.

### The Export Worker

- **Keep HMR on `globalThis` for the worker.** The export-png SharedWorker hot-swaps scene modules on the dev server only because HMR meets on `globalThis`. Moved to `window`, the worker draws stale modules or throws at start, and every export falls back to the main thread.
- The HMR rule itself: `packages/vite-plugin-r-html/AGENTS.md` (Rules, HMR boundaries).
- **PNG and SVG exports draw their own scene.** They draw it from the document JSON, on a fresh app context and a detached Stage. They never read the editor's viewport or zoom.
- **No caller passes a zoom.** `createDocumentPng`, `createDocumentSvg` and `createDocumentPreview` take none. `renderDocumentScene` dispatches `changeZoomLevelAction` with `EXPORT_ZOOM_LEVEL` once the JSON is loaded. That replaces whatever zoom `toJson` wrote: the live one, or the one the lock holds while the viewport is locked.
- The owner decision that every export is drawn at 100%, which this zoom carries out: `src/components/export-image/AGENTS.md`, What the image draws.
- **The scale is cut to the canvas ceilings.** `getExportScale` and `pixelRatio.ts` cut it. `src/components/export-image/exportImageActions.ts` surfaces reductions and failures.
- The Export image dialog, its options, preview, toasts and the svg writer: `src/components/export-image/AGENTS.md`.
- Scene code counting twice in `pnpm size`, since this worker builds its own app context: the package file (Testing Requirements).

### The Export from Outside

- **`toImage` takes the dialog's options and no other.** It is the package root's export, a png `Blob` or an svg string drawn from a document's text, with `format`, `background`, `darkMode` and `scale`, the Export image dialog's three controls, an owner decision (2026-10-27). It opens as the dialog does, background on and 2x, but light, so a document draws alike on every machine. It names no palette, language or name view, so it draws the preset of the element's own slate and indigo, its own words in English and the name view the document holds.
- **It draws through `createDocumentPng` and `createDocumentSvg`.** So it takes the worker first, at 100%, as every export does, and measures text with `createText()`, as the editor does. An svg is handed no scale.
- **It refuses before it draws.** It rejects a realm with no `document`, since it runs in a browser alone (an owner decision of 2026-10-27), a value that is not text, a value of the four options the dialog does not offer, a `TypeError` naming the option, and text `parser` cannot read. It reads no other key, as the element's setters read none. Empty text draws an empty document, as `<erd-viewer>` loads one, and so does JSON with none of a document's fields, which `parser` fills with defaults.
- `export-png/toImage.test.ts` pins the options and the refusals, `toImage.browser.test.ts` the files Chromium draws, and `src/index.test.ts` the type its format picks.

### The Export's Language

- **Exports draw in the language they are handed.** That is the display language as `LocaleMessages`. A request without one draws English.
- The dialog's snapshot of `{ locale, messages }` (`LocaleMessages`), taken as it opens and handed with every preview, PNG and SVG request: `src/components/export-image/AGENTS.md`, What the image draws.
- **The scene reads it through `localeContext`.** `documentScene` builds `createI18n` from it, and `renderScene` (`src/konva/scene/renderScene.ts`) provides `localeContext`. So a file draws its placeholders in the language the dialog opened in. `realm.test.ts` and `renderSvg.browser.test.ts` check this.
- The `i18n/` modules the export worker may reach, since it is handed its dictionary: `src/i18n/AGENTS.md`.
- **Exports draw in the name view they are handed.** `nameViewMode` rides beside the language on every preview, PNG and SVG request, the reader's view the dialog fixed as it opened. `renderDocumentScene` sends `toNameViewModeAction(store.state, mode, true)` once the JSON is loaded, as it sends the zoom.
  - Readonly, the switch is `shared: false` with the scene store's own `editorId`, so it shows on that store alone and writes no register, whatever lock the document holds.
  - A request without one draws the view the document holds, which is the lock's for a locked file. `realm.test.ts` and `renderSvg.browser.test.ts` check this, the second in the worker too.

### The Highlighting Worker

- Which grammar colours each language, the GraphQL grammar copy and the inline worker's size limit: `src/components/generator-code/AGENTS.md` (Rules, Highlighting).
- Shiki and its grammars imported only from this worker, on the JavaScript regex engine: the package file (Dependencies, External).

## Testing Requirements

- `elk-layout/elkLayoutService.test.ts`: its packing case ("packs what nothing joins beside a component, as it packs it with no group") guards the root's options. `ElkLayoutService under the views preset` (AC-60) shows what `toHints` buys, with a case that reads raw coordinates back as one layer per table.
- `export-png/realm.test.ts`: the two realms an export falls through, worker then main thread, and the language and the name view every request carries.
- `export-png/renderSvg.browser.test.ts`: the svg in the language it is asked in, and English when asked in none; in the name view it is asked in, and the document's when asked in none; no check marked.
- `export-png/worker.browser.test.ts`: a document saved zoomed out exports at 100% in the worker and on the main thread.
- Each `*.browser.test.ts` here runs in real Chromium, in the package's `browser` project.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
