<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-27 -->

# export-image

## Purpose

`src/components/export-image/` holds the Export image dialog, the one place every image export the editor offers starts: `ExportImage.tsx`, and in `exportImageActions.ts` the actions behind its PNG, SVG and Copy to clipboard buttons. The files are drawn by the export worker in `src/services/export-png/`; the scene it draws and the language it draws in are ruled in `src/services/AGENTS.md`. The dialog is built on the shared modal in `src/components/primitives/dialog/`, which Map Columns (`src/components/map-columns/AGENTS.md`) also uses. A change here keeps the option set, the toast rule and the 100% drawing of every export, which are owner decisions.

## Making a Change

1. **Read the files on the other side.** A change to how a file is drawn reads `src/services/AGENTS.md`. A change to the modal's contract reads `src/components/map-columns/AGENTS.md` too, since Map Columns keeps the same contract (Rules, The shared modal).
2. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. `ExportImage.test.ts`, `exportImageActions.test.ts`, `Dialog.test.ts` and the svg specs under Testing Requirements run in that test task, each `*.browser.test.ts` in real Chromium.
3. **Run the e2e suites for visible changes.** `e2e/specs/export-image-dialog.spec.ts` drives the dialog, and `e2e/specs/export-png.spec.ts` the png the browser receives and the messages around it. `pnpm --filter @dineug/erd-editor e2e` builds the package and runs every Playwright spec, these two included.
4. **Change a pinned rule and its spec together.** The toast rule is pinned in `exportImageActions.test.ts`. A new attribute on a scene component is written into the svg or named in `SVG_SKIPPED_ATTRIBUTES`, or `sceneSvg.attributes.test.ts` fails.

## Key Files

| File | Description |
| --- | --- |
| `ExportImage.tsx` | The dialog: its options, the preview (`createDocumentPreview`, `PREVIEW_MAX_SIDE`, `PREVIEW_DEBOUNCE_MS`), the PNG size it states before a file exists, and `toExportJson`, the document an image is drawn from |
| `ExportImage.styles.ts` | The dialog's layout and its close button's `scroll-margin` |
| `exportImageActions.ts` | PNG, SVG and Copy to clipboard, their toasts, `describeAskedSize` and `describeReduction` |
| `exportImageActions.test.ts` | Pins which button answers in a toast, and when |
| `ExportImage.test.ts` | The dialog's opening, preview, buttons, language, name view and the dictionaries it leaves out |
| `src/components/primitives/dialog/Dialog.tsx` | The shared modal the dialog is built on; `DIALOG_STACK_BELOW` is the 640 px stacking width |
| `src/services/export-png/exportBox.ts` | `EXPORT_ZOOM_LEVEL`, `getExportSize`, `getStageSize` |
| `src/services/export-png/exportTheme.ts` | `createExportTheme`, the export's theme for the appearance picked |
| `src/services/export-png/sceneSvg.ts` | `toSceneSvg`, `toPaint`, `SVG_SKIPPED_ATTRIBUTES` |
| `src/services/export-png/renderSvg.ts` | Draws the svg's scene on a Stage held to 256 px |
| `src/utils/file/exportFile.ts` | `exportSVG`, which hands the host the svg blob |
| `src/utils/clipboard.ts` | `copyImageToClipboard` |

## Rules

### One dialog for the editor's image exports

- **Every image export the editor offers goes through one dialog.** `ExportImage.tsx` is that dialog (owner decisions of 2026-10-04). Export ▸ Image in the canvas menu and in the palette emit `openExportImage`. `ErdEditor` mounts it beside the theme builder under `Open.exportImage`, reader-only like every `openMap` key.
- Reader-only state and the `openMap` keys: `src/engine/AGENTS.md`.
- **`toImage` takes the dialog's options from outside.** The package root's `toImage` writes the same files with Background, Dark mode and Scale and no other option, so a control added here or taken away changes what it takes too (`src/services/AGENTS.md`, The Export from Outside).
- **The dialog holds a fixed set of controls.** It holds a preview, a close button, Background, Dark mode, Scale (1x, 2x, 3x), PNG, SVG and Copy to clipboard, and nothing else (owner decisions of 2026-10-04). `ExportImage.test.ts` checks that set.
- **No export embeds the diagram or writes PDF.** No export embeds the diagram in the image so it can be reopened, which the owner left for later work together with image import, and PDF export was declined (owner decisions of 2026-10-05).
- **The options last for the element's life.** They are never kept in storage. They open on Background on, Dark mode seeded once from `hasDarkMode()`, and 2x.
- **Buttons keep it open and answer in toasts.** The toasts stack over the dialog. Copy to clipboard always answers. PNG and SVG answer only while they run long or on a failure, and PNG also on a reduction. A file saved in full gets no toast. This is an owner decision, pinned in `exportImageActions.test.ts`.

### The close button

- **The close button is the editor's `x` tool.** It is the 26 px `x` tool that Table Properties and the Explorer have, an owner decision (2026-10-05). It is named `common.close`, translated, with the stop key in its title. It calls the handler Escape calls.
- **It shares a row with the title.** That grid row of its own heads the options while the preview stands beside them. Once the preview stacks above the options, the row heads the whole box. So the button keeps the top corner the title row ends at either way, and keeps its focus across the switch. Under a right-to-left language that corner is the left one.
- **First in Tab order, never the first focus.** The first focus goes to PNG, the `data-autofocus` control (The shared modal). Its `scroll-margin` brings its whole focus ring into a short box scrolled down when Tab turns round to it.

### The shared modal

- **The dialog is built on `Dialog.tsx`.** `src/components/primitives/dialog/Dialog.tsx` is the shared modal, and the bullets below are its contract.
- **A dim covers the whole editor.** It sits one z-index under the toasts, so the toasts stack over the dialog.
- **The box is centred in the editor.** It stands 16 px clear of the editor's edges at least, for Export image and Map Columns alike (an owner decision of 2026-10-11). A press begun on the dim closes the dialog. A press begun in the box and let go over the dim, a text selection say, clicks the dim too and closes nothing.
- **Escape is spent inside the dialog.** It is prevented and stopped, so the canvas keeps its selection.
- **Space is stopped inside the dialog.** That way a native button keeps its press from the hand tool's binding.
- **Focus enters and leaves at fixed points.** The `data-autofocus` control is focused on mount; here that is PNG. Tab turns round at either end of the box, which scrolls in a short editor. On unmount it dispatches `focusEvent`, whatever closed it.
- **Canvas shortcuts stop while it is open.** `erdShortcutPerformCheck` stops the canvas shortcuts, copy and paste.
- **The palette and Find and Replace close it.** They close it as they close Table Properties. It leaves the Explorer open as it opens, and Find and Replace's chord trades the dialog for the Explorer's search.
- **The preview stacks above the options when narrow.** It stacks under 640 px of editor width, read from `editor.viewport.width`, since the browser floor has no container query.
- **Map Columns keeps the same contract.** It is the dialog's second user. The canvas shortcuts, undo and redo stop while it is open, and it leaves the Explorer open as it opens. Find and Replace and the palette close it and drop what was picked, by their chords from inside it or any other way they open, an owner decision (2026-10-06).
- Map Columns' own rules: `src/components/map-columns/AGENTS.md`.

### What the image draws

- **The image is the document as opened.** At opening the dialog fixes the document (`toExportJson`), the palette (scene theme, preset options, appearance), the display language (`{ locale, messages }`) and the name view (`settings.nameViewMode`). The preview and every file use what it fixed. The preview, PNG and SVG requests all carry the language and the name view.
  - The name view is the one the reader sees, not the one `toJson` writes, which is the lock's while the view is locked. So the image draws the names the screen drew, a view switched on this screen alone included.
  - `toExportJson` is `toJson` without the words, the terms and their two `doc` lists. Only the checks read them, and an image marks no check. The domains stay, since the logical view's type cell draws a domain's name.
- The export worker's own scene, the language and the name view it draws in: `src/services/AGENTS.md`.
- **Every export is drawn at 100%.** This holds for the PNG, the SVG, Copy to clipboard and the preview alike, an owner decision (2026-10-06). It holds whatever zoom the editor shows or the document was saved with.
- **`ExportScene` draws every table in full.** It draws each with `Table`, never `HighLevelTable`. At 100% every referential action label View Option leaves shown is drawn too, since `RelationshipActionLabel` hides it at a zoom of 0.7 or below.
- **No export marks a check.** `ExportScene` hands each `Table` `checkMarks={false}`, so a name the dictionaries flag is drawn in the colour of any other name (an owner decision of 2026-10-20), whatever document an export is handed.
- How the export's own store is held at `EXPORT_ZOOM_LEVEL` (`src/services/export-png/exportBox.ts`), with no caller passing a zoom: `src/services/AGENTS.md`, The Export Worker.
- **The PNG's size is box times scale.** The scale is `pixelRatio` of `createDocumentPng`, and the canvas ceilings cut the size. The dialog states that size before any file exists, from `getExportSize` over the box the preview measured. It states it as the PNG's size (`PNG 1200 × 800 px`), since the svg ignores the scale and meets no canvas ceiling.
- **The reduction toast repeats the dialog's words.** It reports after the export, asked and written, in the same pixels and words as the dialog's statement. `describeAskedSize` and `describeReduction` return the templates `localized` builds from `exportImage.reducedFrom` and `exportImage.reducedFromTo`. The toast's pixels come from the `getExportSize` run by the realm that drew the file.
- Dictionary keys such as `common.close` and `exportImage.reducedFrom`: `src/i18n/AGENTS.md`.
- **Dark mode chooses between theme and preset.** Dark mode matching the screen draws the scene theme, overrides included. The other appearance is the preset of the same gray and accent (`createExportTheme`), since no override was ever written for it.
- **Background off makes `canvasBackground` transparent.** That also clears the box under a referential action label.

### The preview

- **The preview runs the export's own worker path.** It is `createDocumentPreview`, capped at `PREVIEW_MAX_SIDE`. The cap is `maxSide` in `renderDocumentScene`, which caps the scale and leaves the store at the export's 100%. So the preview draws every table and label the file does.
- **`getStageSize` keeps the Stage a pixel thick.** It keeps each side at one pixel at least. A canvas truncates a thinner side to none, and the preview's cap cuts a document far longer than it is thick below one pixel.
- **Only Background and Dark mode redraw it.** It is drawn again 200 ms after the last toggle (`PREVIEW_DEBOUNCE_MS`) and cached per combination. An answer that lands after a later toggle is kept but not shown; its request number tells which. A drawing has no time limit.
- **A failed drawing takes the last picture away.** Keeping it would contradict the switches.

### Copy to clipboard

- **Write to the clipboard inside the click.** Copy to clipboard writes `ClipboardItem({ 'image/png': promise })` inside the click (`copyImageToClipboard` in `src/utils/clipboard.ts`). Safari refuses a write made after an await has spent the click, as `clipboard.ts` says.
- **On a refusal, suggest saving a PNG.** A refused write tells the reader to save a PNG. Whether JetBrains' JCEF takes the write is unchecked.

### SVG

- **SVG writes the same scene as vectors.** `src/services/export-png/sceneSvg.ts` and `renderSvg.ts` write it (owner decisions of 2026-10-04). `ExportPngService.renderSvg` draws the scene the png draws, worker first, behind the same font probe. Its Stage is held to 256 px, since nothing rasterises it.
- **`toSceneSvg` writes one string without the DOM.** It walks the scene's seven node kinds into one string, with no dependency and no DOM, so the worker writes it too.
- **The svg's size is the export box.** The viewBox is the export box in scene units, and so are the width and height. The svg is drawn at 100% as every export is, so the scale is ignored and no canvas ceiling is met.
- **The svg leaves the shadows out.** The pixel specs compare the svg to the canvas with shadows aside (Testing Requirements).
- **Fonts are named by `font-family` alone.** The scene face and size are written once, on the root.
- **Text keeps the lines and baseline konva drew.** A text is written in the lines konva wrapped and cut (`textArr`), on the baseline its `sceneFunc` uses.
- **A colour with an alpha becomes two attributes.** `toPaint` writes the opaque colour plus a `fill-opacity` or `stroke-opacity`. The preset's alpha tokens are eight-digit hex, which SVG 1.1 cannot read.
- **Skip a fill or stroke that paints nothing.** It writes no element: the hit boxes, the hidden icons and any colour whose alpha is none.
- **The host receives an `image/svg+xml` blob.** `exportSVG` in `src/utils/file/exportFile.ts` hands it to the host named `.svg`. Every host saves it, whatever the extension.
- **A worker export spaces memo lines differently.** A memo body's line height is measured off the page, which the worker has none of (`getMemoLineHeightPx`'s fallback). So a worker export, the png's too, sets memo lines a little apart from the screen's.

## Testing Requirements

- `sceneSvg.attributes.test.ts` reads every attribute that a scene tag the export reaches can set. It fails on one the writer neither writes nor names in `SVG_SKIPPED_ATTRIBUTES`. So a new attribute on a scene component is written into the svg or skipped on purpose.
- `renderSvg.browser.test.ts` holds the attributes konva really keeps to the same lists.
- `renderSvg.browser.test.ts` and `sceneSvg.browser.test.ts` hold the svg's pixels, text included, to the canvas konva paints, shadows aside. They compare pixels because every text spec that reads attributes repeats the writer's baseline arithmetic.
- `exportImageActions.test.ts` pins the toast rule (Rules, One dialog for the editor's image exports).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
