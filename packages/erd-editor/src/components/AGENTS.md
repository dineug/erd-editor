<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# components

## Purpose

`src/components/` holds the editor's r-html function components: `erd/` with the scene and the DOM shell, `visualization/` with Graph and Flow, `table-view/`, `primitives/`, the panels and the two code tabs. This file holds the rules that tell a scene component which geometry it draws, and the conventions every component follows for its files, its JSX spelling and its icons. Views also follow `src/engine/AGENTS.md` (the view seams, the `editor.view*` actions) and `src/konva/AGENTS.md` (what a view shows). The sort channel a source picks is in `src/utils/draw-relationship/AGENTS.md`, and the ELK coordinate hints are in `src/services/AGENTS.md`.

## Making a Change

1. **Read the nested file of each touched subdirectory.** Subdirectories lists them. A scene component also follows `src/konva/AGENTS.md`, which holds the Konva JSX pragma and its intrinsics.
2. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. The specs this file names run in that test task, each `*.browser.test.tsx` in real Chromium.

## Key Files

| File | Description |
| --- | --- |
| `sceneSourceContext.ts` | `sceneSourceContext` / `useSceneSource`, through which a scene component reads its `GeometrySource`; default `'document'` |
| `visualization/flowLayout.tsx` | The one place a Flow placement is asked for: `ensureFlowPlaced`, `keepFlowPlaced`, `fitFlowView` |
| `visualization/VisualizationFlow.tsx` | `FlowScene`, the scene root of the Flow view |
| `flowCenters.ts` | Narrows the Flow view to the tables given and their one hop, and widens it back (`focusFlowView`, `showAllFlowView`) |
| `erd/canvas/SceneIcon.template.tsx` | Draws the `getIcon` data in the scene |
| `explorer/fieldIcon.tsx` | The icon an excerpt row of the Explorer's search carries for the kind of text it was found in (`table-2` for a table name, `columns-2` for a column name, `sticky-note` for a memo, `message-square` for a table or column comment), which the palette's `#` rows share |
| `primitives/icon/icons.ts` | The registered icons and `getIcon`; `icons.test.ts` beside it |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `erd/` | `erd/AGENTS.md`: keys and alternate keys, Table Properties, the buttons beside a draw's target, coordinates and scrolling, table groups in the scene, the closed shadow root, overlays, pointer and key handling (`YIELDS_TO_A_CARET`, Escape, Delete, Backspace), the welcome screen |
| `export-image/` | `export-image/AGENTS.md`: the one dialog every image export goes through, PNG and SVG, and the contract of the shared modal `primitives/dialog/Dialog.tsx` |
| `schema-sql/` | `schema-sql/AGENTS.md`: the Schema SQL tab, its options panel and its script editors |
| `generator-code/` | `generator-code/AGENTS.md`: the Code Generator tab, its options panel, the language menu, Save file and highlighting |
| `map-columns/` | `map-columns/AGENTS.md`: Map Columns and `relationship.changeColumns` |
| `explorer/` | `explorer/AGENTS.md`: the Explorer docked left of the canvas, its tree, where a row goes, Find and Replace above it and the matcher in `src/utils/find-replace/` |
| `quick-search/` | `quick-search/AGENTS.md`: the palette with no prefix, its prefixes, and its Theme and Display Language entries |
| `primitives/` | `primitives/AGENTS.md`: the color picker, removing a color, and the native list in `select/Select.tsx` |

## Rules

### Scene sources and views

- **`GeometrySource` picks coordinates, shown set, sort channel.** One value picks all three at once: `GeometrySource = 'document' | 'flow'`, typed in `src/utils/draw-relationship/geometrySource.ts`. Pure functions take it as a trailing `source = 'document'` parameter. Scene components read it with `useSceneSource(ctx)`.
- **Provide the source inside a wrapper.** Each scene root provides it inside a wrapper, never on the root it returns: `Erd`, `ErdViewer`, `AutomaticTablePlacement`, `TimeTravel`, and `FlowScene` in `VisualizationFlow.tsx`. `useProvider` attaches to the parent element, so a provider on the returned root would reach the root's siblings too.
- **Outside any provider, read `getActiveView`.** Code that must follow the reader and runs outside any provider reads `getActiveView` (`src/engine/modules/editor/view*.ts`). That is the zoom generators, through `getActiveTransform`, and the view reducers.
- **A scene writes to the slot it reads.** Each write names its source: `sceneScrollToAction(source, …)`, `changeZoomLevelAction$(value, source)`, `moveAllAction$(dx, dy, source)`, and `kind` on a view payload. An unnamed scroll or zoom lands on the active view. An unnamed `moveAllAction$` goes to the document, and an open view drops it.
- What a view shows, `src/konva/scene/viewLayout.ts`: `src/konva/AGENTS.md`.
- **`flowLayout.tsx` alone asks for a Flow placement.** It asks with `TablePlacement.viewLayered`. It caches landings under `placedKey`: the centers, the show mode and the doc's id lists, never `positions`. A key holding `positions` would make the loop re-ask on its own answer.
- **Narrow or widen only through `flowCenters.ts` or `focusFlowTableAction$`.** Both dispatch state alone and run no layout. The placement loop in `flowLayout.tsx` reads the display set they name and asks for the layout, so a narrowing and the Flow mount never hold two answers to one question.
- Coordinate hints for ELK, `toHints` in `src/services/elk-layout/elkGraph.ts`: `src/services/AGENTS.md`.

### Icons

- **Colour an icon with `color`, never `fill`.** An icon is stroked from `currentColor`, so a `fill` aimed at one renders it invisible and fails nothing else. `src/styles/emittedCss.iconPaint.test.ts` fails on a `fill` declared in any style module. The scene draws the same `getIcon` data through `erd/canvas/SceneIcon.template.tsx`.
- **Draw a table with lucide's `table-2`.** Use it wherever a table shows (an owner decision): the table headers on the canvas and in the Visualization tab, and New Table in the context menu, the palette and the welcome screen. It also marks the diff tree, the palette's table rows and a table name found (`explorer/fieldIcon.tsx`, which the palette's `#` rows share). A table or column comment found draws `message-square`.
- **Find and Replace draws `text-search`.** The command draws it wherever it shows: the context menu and the palette row (an owner decision). The Explorer search's own Replace button keeps `replace`. The toolbar button where Find stood is the Explorer's, `panel-left`.
- **Remove a glyph from `icons.ts` when unused.** A glyph that goes out of use leaves `primitives/icon/icons.ts`, and the bundle, with it. `primitives/icon/icons.test.ts` fails on a registered icon no module names.

### Closing a dialog or panel

- **Each one closes on the editor's `x` tool.** Export image, Map Columns, Table Properties, the theme builder and the locale picker carry the 26 px `x` tool at the end of their title row, and so does the Explorer, which Escape does not close (an owner decision of 2026-10-11 for Map Columns, the theme builder and the locale picker). It is named `common.close` with the stop key in its title, closes as Escape does and hands the keyboard back with `focusEvent`.
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

- **One directory per component.** It holds `Foo.tsx`, `Foo.styles.ts` and `Foo.test.ts`, and optionally `Foo.stories.tsx`.
- **A scene component has no `.styles.ts`.** It draws on the Konva canvas, which no stylesheet styles. Its colours come from `@/konva/theme`. Its geometry comes from `src/konva/scene/metrics.ts` and `erd/canvas/sceneTokens.ts`.
- The Konva JSX pragma and its intrinsics: `src/konva/AGENTS.md`.
- **Spell a second binding of one event `on:x__2`.** JSX cannot write one attribute twice on an element. `vite-plugin-r-html` drops the `__2` suffix when it writes the binding.
- **Keep an empty template tagged.** An empty template has no JSX spelling, so `global-styles/GlobalStyles.ts` and `primitives/icon/Icon.tsx` keep tagged ones. `src/__jsx-parity__/parity.test.tsx` compares the DOM of both spellings.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
