<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-25 -->

# components

## Purpose

`src/components/` holds the editor's r-html function components: `erd/` with the scene and the DOM shell, `visualization/` with Graph and Flow, `table-view/`, `primitives/`, the panels, the two code tabs and the Dictionary tab. This file holds the rules that tell a scene component which geometry it draws, how an element class is built and defined, and the conventions every component follows for its files, its JSX spelling and its icons. Views also follow `src/engine/AGENTS.md` (the view seams, the `editor.view*` actions) and `src/konva/AGENTS.md` (what a view shows). The sort channel a source picks is in `src/utils/draw-relationship/AGENTS.md`, and the ELK coordinate hints are in `src/services/AGENTS.md`.

## Making a Change

1. **Read the nested file of each touched subdirectory.** Subdirectories lists them. A scene component also follows `src/konva/AGENTS.md`, which holds the Konva JSX pragma and its intrinsics.
2. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. The specs this file names run in that test task, each `*.browser.test.tsx` in real Chromium.

## Key Files

| File | Description |
| --- | --- |
| `customElementClass.ts` | `CustomElementClass`, the type an exported element class is annotated with: the shape of the class `createCustomElement` returns, written here so the declaration files name no `@dineug/r-html` type for it |
| `element-host/` | What an element takes from its page beside its document, outside `erd-editor/` so the read-only view's graph can reach it (`src/viewer/imports.test.ts`). `themeHost.ts`'s `useThemeHost` holds the preset its options build, from the options its element starts on (the editor's slate, indigo and dark, the viewer's `system`), the tokens `setTheme` lays over it and the light or dark `system` shows; `localeHost.ts`'s `useLocaleHost` holds the display language and the one `I18n` object (`src/i18n/AGENTS.md`). A component calls each at setup, and each hands back the setters its element installs and a `destroy`, which lets the OS color scheme go at once and on every later mount. `useLocaleHost` imports no dictionary: the element hands it the dictionary source, which may load a language, and the tags `system` reads. `value` stays each element's own. `elementHost.test.ts` pins both |
| `erd-viewer/` | The viewer element, `ErdViewer.tsx` (the package file's Key Files), over `ErdView`, and `documentSource.ts`, its `src`: one GET at a time, a later fetch aborting the one before, so a late answer never lands over a later document. `ErdViewer.test.ts` pins the element in happy-dom, `ErdViewer.upgrade.browser.test.ts` the properties a page set before the tag was defined; `ErdViewer.stories.tsx` draws it over a sample document, with and without its map and controls |
| `sceneSourceContext.ts` | `sceneSourceContext` / `useSceneSource`, through which a scene component reads its `GeometrySource`; default `'document'` |
| `sceneInteractionContext.ts` | `sceneInteractionContext` / `useSceneInteraction`, through which `erd/canvas/useMoveEntity.ts` and the scene's tables, memos and group bodies read how their scene takes a press; default `'edit'` (Scene sources and views) |
| `erd-view/ErdView.tsx` | The read-only scene root: a readonly store of its own, handed to its host through `appRef`, under `'document'` and `'read'`, with its canvas, scrollbars, map, view controls and a palette of the document's rows alone (`src/components/erd/AGENTS.md`, `src/components/quick-search/AGENTS.md`). It provides its app, source and mode on the element it is mounted in, so its host mounts it alone in a wrapper. Its root is focusable (`tabindex="0"`) and takes no wheel, pinch or touch until it holds the focus. Its host turns the map and the controls bar off (`minimap`, `controls`, on unless `false`) and tells it how a load stands (`status`), which a notice over the canvas shows in the root's direction: `loader-circle` turning while loading, `triangle-alert` once it failed |
| `erd-view/pressHandler.ts` | `createViewPress`, the view's press rule: a main press pans from anywhere on the stage, and a finger does once the view holds the focus, before which it is the page's and pans nothing; a still one, for a finger one it lifted and not one the browser cancelled for a scroll, gives the view the focus without scrolling the page, takes a jump's selection and lights a table's relationships or a relationship, or puts the light out, and the pointer resting on a table lights its relationships while it is there (`tableRelationshipIds`); `reset` puts out both lights for a document loaded in place of the one they stood on |
| `erd-view/viewportMeasure.ts` | `measureViewport`, which hands the store the size of the element the read-only view fills as its viewport on every resize. It never reaches the Explorer, whose room the editor's `erd-editor/viewportLayout.ts` makes, and its spec drives a `ResizeObserver` of its own, since the one `vitest.setup.ts` installs reports nothing |
| `visualization/flowLayout.tsx` | The one place a Flow placement is asked for: `ensureFlowPlaced`, `keepFlowPlaced`, `fitFlowView` |
| `visualization/VisualizationFlow.tsx` | `FlowScene`, the scene root of the Flow view |
| `flowCenters.ts` | Narrows the Flow view to the tables given and their one hop, widens it back, and steps it through the centers it stood on (`focusFlowView`, `showAllFlowView`, `stepFlowView`, `canStepFlowView`) |
| `erd/canvas/SceneIcon.template.tsx` | Draws the `getIcon` data in the scene |
| `erd/fieldIcon.tsx` | The icon an excerpt row of the Explorer's search carries for the kind of text it was found in (`table-2` for a table name, `list` for a column name, as the Explorer's column rows draw one, and for a logical name, which only the palette's `@` rows list, a column's, `sticky-note` for a memo, `message-square` for a table or column comment), which the palette's `#` rows share |
| `primitives/icon/icons.ts` | The registered icons and `getIcon`; `icons.test.ts` beside it |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `erd/` | `erd/AGENTS.md`: the name views, keys and alternate keys, Table Properties, the buttons beside a draw's target, coordinates and scrolling, table groups in the scene, the closed shadow root, overlays, the column drag handle, pointer and key handling (`YIELDS_TO_A_CARET`, Escape, Delete, Backspace), the welcome screen |
| `export-image/` | `export-image/AGENTS.md`: the one dialog every image export goes through, PNG and SVG, and the contract of the shared modal `primitives/dialog/Dialog.tsx` |
| `schema-sql/` | `schema-sql/AGENTS.md`: the Schema SQL tab, its options panel and its script editors |
| `generator-code/` | `generator-code/AGENTS.md`: the Code Generator tab, its options panel, the language menu, Save file and highlighting |
| `dictionary/` | `dictionary/AGENTS.md`: the Dictionary tab, its four sheets on `@dineug/grid`, how a grid commit resolves to row ids, where a sheet's version comes from, where a check leads and the marks on the cells it names, its keys, the grid's theme, a read-only document, and its CSV import and export |
| `map-columns/` | `map-columns/AGENTS.md`: Map Columns and `relationship.changeColumns` |
| `explorer/` | `explorer/AGENTS.md`: the Explorer docked left of the canvas, its tree, where a row goes, Find and Replace above it and the matcher in `src/utils/find-replace/` |
| `quick-search/` | `quick-search/AGENTS.md`: the palette with no prefix, its prefixes, and its Theme and Display Language entries |
| `primitives/` | `primitives/AGENTS.md`: the color picker, removing a color, and the native list in `select/Select.tsx` |

## Rules

### Scene sources and views

- **`GeometrySource` picks coordinates, shown set, sort channel.** One value picks all three at once: `GeometrySource = 'document' | 'flow'`, typed in `src/utils/draw-relationship/geometrySource.ts`. Pure functions take it as a trailing `source = 'document'` parameter. Scene components read it with `useSceneSource(ctx)`.
- **Provide the source inside a wrapper.** Each scene root provides it inside a wrapper, never on the root it returns: `Erd`, `DiffErdViewer`, `AutomaticTablePlacement`, `TimeTravel`, `FlowScene` in `VisualizationFlow.tsx`, and `ErdView`. `useProvider` attaches to the parent element, so a provider on the returned root would reach the root's siblings too.
- **`sceneInteractionContext` picks how a scene takes an entity press.** Under `'edit'`, the default, a press on a table, memo or group selects it and carries the selection. Under `'read'`, `erd/canvas/useMoveEntity.ts` returns before it selects, so the press draws no selection outline, lifts nothing and starts no Alt duplicate, and the scene root takes it; no cell focuses or edits either (`src/components/erd/AGENTS.md`, The canvas and its presses). A read-only scene root, `erd-view/ErdView.tsx`, provides `'read'` inside its wrapper, as a root provides its source; every other scene, the ERD tab and a readonly editor among them, keeps `'edit'`.
- **Outside any provider, read `getActiveView`.** Code that must follow the reader and runs outside any provider reads `getActiveView` (`src/engine/modules/editor/view*.ts`). That is the zoom generators, through `getActiveTransform`, and the view reducers.
- **A scene writes to the slot it reads.** Each write names its source: `sceneScrollToAction(source, …)`, `changeZoomLevelAction$(value, source)`, `moveAllAction$(dx, dy, source)`, and `kind` on a view payload. An unnamed scroll or zoom lands on the active view. An unnamed `moveAllAction$` goes to the document, and an open view drops it.
- What a view shows, `src/konva/scene/viewLayout.ts`: `src/konva/AGENTS.md`.
- **`flowLayout.tsx` alone asks for a Flow placement.** It asks with `TablePlacement.viewLayered`. It caches landings under `placedKey`: the centers, the show mode, the name view and the doc's id lists, never `positions`. A key holding `positions` would make the loop re-ask on its own answer. The centers and the show mode are the framing (`framingOf`): each resizes every card, so a change of either places the view again and fits it to the screen. The name view resizes them too and places the view again, but fits it only for the reader's own switch made with the view drawn (`isOwnNameViewSwitch`, the payload's `editorId`): a peer's shared switch, as any peer's edit, and a switch made on another tab keep the reader's screen.
- **Narrow or widen only through `flowCenters.ts` or `focusFlowTableAction$`.** Both dispatch state alone and run no layout. The placement loop in `flowLayout.tsx` reads the display set they name and asks for the layout, so a narrowing and the Flow mount never hold two answers to one question.
- **A Flow view keeps the centers it stood on** (the owner's request of 2026-10-22). `editor.viewSetCenters` keeps the centers it leaves in `previousCenterIds`, the latest 100, and empties `nextCenterIds`; the centers it already stands on, in the same order, keep nothing. `editor.viewStepCenters` moves one set between the two lists, as a browser's history does, and a view opened again starts with neither. A step lands on what the document still holds of a set and drops a set it passes over, one whose tables are all gone or that comes to the centers the view stands on (`toSteppedCenters` in `src/engine/modules/editor/view.ts`, which also dims the buttons through `canStepFlowView`). In the Flow alone the Visualization toolbar's Previous table and Next table (`arrow-left`, `arrow-right`, dimmed with nothing that way) and the undo and redo chords step it. The bar stands left to right in every language, so under a right-to-left one the two arrows keep their places and swap what they do: Previous table is the right-pointing one, as a browser's back and the top toolbar's undo point for that reader (`stepsOf`, the owner's choice of 2026-10-22). They name the undo and redo chords in their titles, and the document's own undo and redo stand still while a view does (`src/engine/AGENTS.md`, View seams).
- Coordinate hints for ELK, `toHints` in `src/services/elk-layout/elkGraph.ts`: `src/services/AGENTS.md`.

### Element classes

- **A module that exports an element class has no `export default`.** `vite-plugin-r-html` makes a module whose named exports are all capitalized and which has a default export an HMR boundary, and a hot swap evaluates a boundary again. The module would then build a second class while the tag still holds the first, and the next `defineErdEditor()` or `defineErdViewer()` would throw. So `erd-editor/ErdEditor.tsx` exports `ErdEditorElement` and `defineErdEditor` beside it and no default, `erd-viewer/ErdViewer.tsx` exports `ErdViewerElement` and `defineErdViewer` the same way, and an edit to either reloads the page.
- **Build the class with `createCustomElement` under `/* @__PURE__ */`, typed by `customElementClass.ts`.** Nothing at the top level of a module that builds a class defines its tag; each self-registering module (`src/erd-editor.ts`, `src/erd-viewer.ts`) calls its define function, which leaves a tag the class already holds as it is and throws an `Error` naming a tag another class holds.
- **The viewer takes up what a page set before its tag was defined.** Such a write leaves an own property that the class's accessors, and the `value` and `src` accessors its setup defines, would hide or drop. `erd-viewer/ErdViewer.tsx` takes `value`, `src`, `nameView`, `minimap` and `controls` off the element at setup and sets each again through its accessor, in the order the page first wrote each, which its own keys keep, so the later of `value` and `src` wins. An upgrade reports the attributes its markup gave the element after setup, and they are older than any property the page wrote, so the element sets those properties again only after: as it first connects, in a microtask for one upgraded out of a page, or first thing in the page's next read or write of `value` or `src`. A `value` that holds no document is thrown in a microtask, as the page's own error, and the viewer stays empty (`ErdViewer.upgrade.browser.test.ts`).

### Icons

- **Colour an icon with `color`, never `fill`.** An icon is stroked from `currentColor`, so a `fill` aimed at one renders it invisible and fails nothing else. `src/styles/emittedCss.iconPaint.test.ts` fails on a `fill` declared in any style module. The scene draws the same `getIcon` data through `erd/canvas/SceneIcon.template.tsx`.
- **Draw a table with lucide's `table-2`.** Use it wherever a table shows (an owner decision): the table headers on the canvas and in the Visualization tab, and New Table in the context menu, the palette and the welcome screen. It also marks the diff tree, the palette's table rows and a table name found (`erd/fieldIcon.tsx`, which the palette's `#` rows share). A table or column comment found draws `message-square`.
- **Draw a key with lucide's `key-round`.** It is drawn in the key tokens wherever a column's key shows: the scene's key cell, Graph mode's card, Table Properties and the Explorer's rows (the owner's request of 2026-10-14), whose foreign keys take their connector's colour. The diff tree draws its foreign keys with it too, muted like its other glyphs.
- **The Explorer draws `list-tree`.** The toolbar's Explorer button and the Toggle Explorer rows of the context menu and the palette draw it (the owner's request of 2026-10-15, replacing `text-search` and `panel-left`). An index draws `logs` instead, in the Explorer, the diff tree and an index name found (`erd/fieldIcon.tsx`), so the two never meet (the owner's request of 2026-10-15). The Explorer search's own Replace button keeps `replace`.
- **Flow's Show all draws lucide's `funnel-x`** (the owner's choice of 2026-10-22, replacing `maximize`), so it never reads as the bracketed `fullscreen` of Fit beside it; the Previous table and Next table steps draw `arrow-left` and `arrow-right`.
- **Remove a glyph from `icons.ts` when unused.** A glyph that goes out of use leaves `primitives/icon/icons.ts`, and the bundle, with it. `primitives/icon/icons.test.ts` fails on a registered icon no module names.

### Closing a dialog or panel

- **Each one closes on the editor's `x` tool.** Export image, Map Columns, Table Properties, the theme builder and the locale picker carry the 26 px `x` tool at the end of their title row, and so does the Explorer, which Escape does not close (an owner decision of 2026-10-11 for Map Columns, the theme builder and the locale picker). It is named `common.close` with the stop key in its title, closes as Escape does and hands the keyboard back with `focusEvent`. The Explorer's title names no key, since Escape hands its keyboard back and leaves it open (the owner's request of 2026-10-14).
- **A panel that stops no key keeps Space and Enter on its button.** The theme builder stops neither, so its button keeps both from the editor root, whose hand tool binding would cancel the press and whose `edit` binding would open a focused cell. Table Properties keeps Space the same way.

### Toasts

- **A toast's one line is its title.** `primitives/toast/Toast.tsx` takes a second line as its description, so every toast reads in one size whatever it reports.
- **Report how something ended through `openStatusToast`.** `toast-container/openStatusToast.tsx` opens it with a `tone`: `success` draws `check` in `--toast-success`, `error` draws `triangle-alert` in `--toast-error`, and no tone draws no mark. A copy's outcome goes through `reportCopy` beside it.
- **Key a status toast by its message and values.** The same key opened again replaces the toast still up (`ToastContainer.tsx`), so a press repeated shows one toast. A key also names the values the message shows (`feedback.importOnly:sql`), so two different reports both stay up.
- **Something still running shows lucide's turning `loader-circle`,** its text with no trailing ellipsis (`busy`). A `progress` fills a ring instead.

## Testing Requirements

- **A component spec mounts through `src/__test-utils__`.** It uses `mountAndFlush` and `flush`.
- **A scene component's spec is `Foo.browser.test.tsx`.** The `.browser.` infix puts it in the `browser` project, in real Chromium. Why a Konva spec fails without it: the package file § Testing Requirements.
- **Ask `iconNameOf` which glyph an element draws.** `src/__test-utils__/icon.ts` exports it for specs.

## Common Patterns

- **A scrolling panel takes the `scrollbar` hook class** (`src/styles/scrollbar.styles.ts`), whose thin bar every DOM box that scrolls draws: Table Properties and its section tabs, the Settings page, the code tabs' code and options, the palette, the locale picker, the tree, the memo field, the data type hint, every dialog and every context menu. A box under one inherits its `scrollbar-color` but not its `scrollbar-width`, so Chrome would draw it a full-width bar.
- **One directory per component.** It holds `Foo.tsx`, `Foo.styles.ts` and `Foo.test.ts`, and optionally `Foo.stories.tsx`.
- **A scene component has no `.styles.ts`.** It draws on the Konva canvas, which no stylesheet styles. Its colours come from `@/konva/theme`. Its geometry comes from `src/konva/scene/metrics.ts` and `erd/canvas/sceneTokens.ts`.
- The Konva JSX pragma and its intrinsics: `src/konva/AGENTS.md`.
- **Spell a second binding of one event `on:x__2`.** JSX cannot write one attribute twice on an element. `vite-plugin-r-html` drops the `__2` suffix when it writes the binding.
- **Keep an empty template tagged.** An empty template has no JSX spelling, so `global-styles/GlobalStyles.ts` and `primitives/icon/Icon.tsx` keep tagged ones. `src/__jsx-parity__/parity.test.tsx` compares the DOM of both spellings.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
