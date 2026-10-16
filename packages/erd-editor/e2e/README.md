# erd-editor e2e

Playwright suite for the interaction surface that `vitest` + `happy-dom` cannot
check faithfully: real hit-testing, real layout, real event ordering, and the
keyboard/mouse gestures built on top of them. Since the scene became a Konva
stage it is also where a real pointer drives that stage on the whole element in
the fixture page. This package's Vitest `browser` project
(`*.browser.test.{ts,tsx}`) runs in real Chromium too, mostly for a component
mounted alone.

```bash
pnpm --filter @dineug/erd-editor e2e            # headless run (builds first)
pnpm --filter @dineug/erd-editor e2e:dev        # Playwright UI mode
pnpm --filter @dineug/erd-editor e2e:headed     # watch it drive a real browser
pnpm --filter @dineug/erd-editor e2e:report     # open e2e/.report, which only a CI run writes
pnpm --filter @dineug/erd-editor e2e:typecheck  # tsc over e2e/ and both Playwright configs
pnpm --filter @dineug/erd-editor e2e:bench      # benchmarks — see e2e/bench/README.md
```

`e2e` and `e2e:bench` build first. `e2e:dev`, `e2e:headed` and `e2e:typecheck`
do not, and they read the workspace libraries' `dist/` (`r-html`,
`erd-editor-schema`, `schema-sql-parser`, `uuid`, `vite-plugin-r-html`): run
`pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match build`, or `e2e`
once, before them, and again after changing one of those libraries. A local run
reports to the terminal and writes no HTML report; `e2e:report` opens the one
the CI `e2e` job uploads as its `playwright-report` artifact, unzipped into
`e2e/.report`. `e2e:typecheck` is the only type check `e2e/` and the two
Playwright configs get; `pnpm check` and the `test` task leave them out.

`E2E_PORT` is the port the Vite `webServer` takes, with `--strictPort`, and the
`baseURL` follows it. The suite defaults to `5174` and the bench config to
`5175`, which is also `@dineug/erd-editor-app`'s e2e default (`5176` is
`@dineug/r-html`'s and the app suite's relay). Outside CI both configs set
`reuseExistingServer`: when something on that port already answers
`/e2e/fixture/index.html`, Playwright starts nothing and runs the specs against
that server's code, and `--strictPort` fails the run only when the port's holder
does not answer it. So anything that may run beside another checkout, another
agent or the bench has to name its own:

```bash
E2E_PORT=5199 pnpm --filter @dineug/erd-editor e2e
```

`pnpm test` runs no e2e: E2E is a `package.json` script and its own CI job
(`e2e` in `.github/workflows/ci.yml`), never a `run.tasks` task. `pnpm test`
still needs Chromium, because this package's `browser` Vitest project runs in
headless Chromium through the same Playwright;
`pnpm --filter @dineug/erd-editor exec playwright install chromium` installs it
for both.

## Layout

| Path                            | What it is                                                       |
| ------------------------------- | ---------------------------------------------------------------- |
| `playwright.config.ts`          | Chromium project, pinned 1440x900 viewport, `E2E_PORT` webServer  |
| `playwright.bench.config.ts`    | The bench project — own testDir, one worker; its few expects check that the page reached what it measures, never a measured number |
| `e2e/tsconfig.json`             | The `e2e:typecheck` program, with the `@/*` → `src/*` alias the support files use |
| `e2e/fixture/`                  | The page under test — a deterministic `<erd-editor>` mount, the theme builder, locale picker and welcome screen off until `erd.enable()` |
| `e2e/support/schema.ts`         | Hand-authored v3 seeds — tables, memos, relationships, indexes, table groups |
| `e2e/support/graph.ts`          | A relationship or index read back by the names it joins           |
| `e2e/support/connectorDrift.ts` | How far each scene draw puts a connector end off its own table    |
| `e2e/support/listDrag.ts`       | Drags a native drag-and-drop list from inside the page, one dragover a frame, and returns every painted frame |
| `e2e/support/sceneMirror.ts`    | Projects every live Konva stage into divs a css locator can name  |
| `e2e/support/shortcuts.ts`      | `Shortcut`, the key strings mirroring `createKeyBindingMap()`; `MOD_KEY`; the zoom steps `ZOOM_STEP` (a shortcut press) and `WHEEL_ZOOM_STEP` (a wheel notch) |
| `e2e/support/ErdEditorPage.ts`  | Page object: locators, scene coordinates, gesture helpers         |
| `e2e/support/fixtures.ts`       | The `test` object every spec imports; fails on uncaught errors    |
| `e2e/specs/`                    | The suite's `testDir`: a new `*.spec.ts` goes here and imports `test` from `../support/fixtures` |
| `e2e/specs/harness.spec.ts`     | Guards the assumptions below — fix this first if it goes red      |
| `e2e/bench/`                    | The benchmarks, run only by `e2e:bench` through their own config and never in CI: `routing.bench.ts` alone by default, every `*.bench.ts` with `E2E_BENCH_ALL=1`; carries own README |
| `e2e/.results/`                 | Gitignored: a failing test's screenshot, and its trace on a CI retry |
| `e2e/.report/`                  | Gitignored HTML report, written only when `CI` is set and uploaded as the `playwright-report` artifact |

## What is covered

48 spec files. Ten of the groups exist because the DOM scene got their subject
for free and the canvas has to draw and dispatch it itself:

| Spec                            | What it holds down                                                |
| ------------------------------- | ---------------------------------------------------------------- |
| `hover.spec.ts`                 | Enter and leave resolved by the stage, not fired at a node        |
| `cursor-motion.spec.ts`         | The cursor the container is pointed at, and a tween that lands    |
| `touch.spec.ts`                 | A press the stage reads off a `TouchEvent` rather than a mouse one |
| `high-level-table.spec.ts`      | The simplified table below the zoom swap, and what it drops       |
| `memo.spec.ts`                  | Memo drag, resize sashes and caret, all scene nodes now           |
| `table-color.spec.ts`           | A scene node handing a viewport point to a DOM colour picker      |
| `draw-preview.spec.ts`          | The dashed preview agreeing with the cursor every frame           |
| `context-menu-cardinality.spec.ts` | A right click that finds a connector by hit-testing the scene, the cardinality and ON DELETE / ON UPDATE its menu sets, and the `D:C U:R` label, its hover title and the View Option that hides it |
| `virtual-viewport.spec.ts`      | Culling: what never came near the screen has no node, a table that left stays built but hidden, and the minimap keeps all of it |
| `diff-viewer.spec.ts`           | A changed cell's text colour and an added or removed table's outline on both canvases, and the diff tree |

Twelve more are the canvas's own geometry, and the DOM the editing overlay
puts over it:

| Spec                            | What it holds down                                                |
| ------------------------------- | ---------------------------------------------------------------- |
| `zoom-round-trip.spec.ts`       | A zoom out and back in that returns the reader's own view         |
| `pinch-zoom.spec.ts`            | A trackpad and a two finger pinch, and the point each one holds   |
| `infinite-canvas.spec.ts`       | The travel, thumbs, map, compass and image the content now decide |
| `floating-toolbar.spec.ts`      | The two canvas tools, the notations and what zen mode takes away  |
| `scroll-origin.spec.ts`         | The origin the scene draws with, the legacy pair migrated once, and a new document's view left out of `value` |
| `export-png.spec.ts`            | The file the browser really receives, and the messages around it  |
| `memo-editor-drag.spec.ts`      | A press in the overlay textarea, which used to pan the canvas     |
| `memo-editor-alignment.spec.ts` | The drawn memo and its textarea, one device grid at a time        |
| `cell-editor-alignment.spec.ts` | The drawn cell and its input, on both device grids                |
| `cell-editor-underline.spec.ts` | The underline the two rasterisers have to agree on                |
| `data-type-hint.spec.ts`        | The autocomplete DOM the stage cannot hit test                    |
| `relationship-hover.spec.ts`    | Every part a connector draws, hovered one at a time               |

Two more are the placements a worker computes, one landed in the document and
one drawn over it in coordinates the document never keeps:

| Spec                            | What it holds down                                                |
| ------------------------------- | ---------------------------------------------------------------- |
| `automatic-table-placement.spec.ts` | The placement ELK lands in the document, through the worker, from Auto Layout and from an SQL import |
| `visualization-flow.spec.ts`    | The visualization tab's two modes, and what an entry narrows Flow to |

`shared-workers.spec.ts` holds down what those two and every export stand on:
that each of the three shared workers starts on the dev server, which serves a
worker the same component boundaries, Vite client included, that it serves the page.

`explorer.spec.ts` holds down the Explorer in the real element: docked left of
the canvas it narrows by its width without moving the origin, a click in its
tree jumping to the table and the keyboard staying in the tree until Escape, a
foreign key selecting the child table and its key column, its edge sizing it
up to 480 px, its place on the left in a right-to-left language, and
its standing aside on a window too narrow for it and coming back.

`import-and-add.spec.ts` holds down what an import lands beside the diagram
rather than in its place: Import and Add's SQL file placed by Flow below the
tables already there, which stay where they were, selected and taken back by one
undo, a json file's tables and memo standing apart as the file has them with
its settings left out, the ERD tab an append brings up from a Flow view, Graph
mode, Schema SQL and Code Generator with the added table selected and on screen,
and a read-only editor whose palette and menu offer no Import and Add.

`export-image-dialog.spec.ts` holds down the dialog every image export goes
through, from the canvas menu and the palette: it opens on its defaults with
the PNG button focused and hands the keyboard back on Escape, PNG, SVG and Copy
to clipboard each leave it open, the png is the box times the scale (two by
default) at 100% whatever the zoom, a canvas ceiling the 2x default runs into
is told in the toast in the pixels the dialog
warned of, the svg is the box in scene units, its width and height that box
whatever the zoom, with its text kept as text, a document zoomed out to the
simplified tables exports every table in full, the background switch leaves
the canvas transparent in the png and in the svg, the clipboard receives the
png (Chromium with clipboard permissions granted), Tab turns round inside the
box, the close button in its top right corner (over the preview once the
preview stacks above the options) closes it as Escape does and shows its whole
focus ring for the keyboard, a short box scrolled down included, a short editor
scrolls it to its buttons, it leaves the Explorer open beside it and Find and
Replace's chord trades it for the Explorer's search, a press on the dim closes
it while a text selection let go over the dim does not, and while it is open
the canvas shortcuts stay off and Space presses the focused button.
`export-png.spec.ts` drives the same dialog at 1x.

Two more hold down nothing but a frame, one on the canvas and one in a DOM panel
the port left on native drag and drop:

| Spec                            | What it holds down                                                |
| ------------------------------- | ---------------------------------------------------------------- |
| `connector-frames.spec.ts`      | No draw with a connector end off its table after an undo or redo  |
| `settings-column-order.spec.ts` | The column order list painted in the order it holds, every frame  |

`automatic-table-placement.spec.ts` (the frame a placement or its undo lands)
and `table-properties-indexes.spec.ts` (the index column list) each hold one
more check of the same kind, through `support/connectorDrift.ts` and
`support/listDrag.ts`.

`find-replace.spec.ts` holds down Find and Replace, the Explorer's search, and
the quick search rows for columns, comments and memos in the real element: its
chord, `$mod+F`, is prevented on the ERD tab from the canvas, from its own field,
which it selects, from the palette, which gives way, and from a cell editor,
which keeps it, so no page find opens, prevented on the Visualization, Schema
SQL, Code Generator and Settings tabs too, where it brings the ERD tab up with
the Explorer, shows the Explorer under zen mode with zen left on, and is left
unprevented to the page under time travel, until that closes; the Explorer's
toolbar button, where Find stood, opens it from another tab, closes it on the
ERD tab and stands greyed out in place under time travel; what is typed into
the search reaches no other canvas shortcut (Alt+N and Enter there add and edit
nothing), the current match lighting its row in the tree, while undo and zoom
in still reach the editor (two of `PANEL_PASSING_BINDINGS`) and a chord the
editor does not bind (`$mod+S`, `$mod+Shift+P`) still reaches the host's
window; Escape hands the keyboard back and leaves the panel open; a first
opening searches table and column names alone, so a replace all there leaves
the comments and the memo as they were, and a scope set stays on while the
element lives; a replace all is one change event and one undo, and reaches a
wired peer, whose copy the undo takes back too; a read-only editor offers
nothing to replace with; a jump to a table taller than the canvas lands on its
name, and a match at the end of a comment wider than the canvas lands where it
shows from its row in the tree, the canvas narrowed beside the panel. It holds
down the palette prefixes too, the only way to its tables,
columns, comments and memos: a `:` search lands on a column comment from another
tab, a `?` help row types its prefix in with the input still focused, a
`@table.col` search goes to that column, and `#us` lists users and not orders,
which the 0.4 threshold no longer fuzzes it to, and deleting its `#` leaves no
table or field. A word no command holds lists the three prefixes that search
the document last, whose row the arrows and Enter pick types its prefix before
the word (`#orders`), below the `No commands match` line when the word fuzzes to
no command: `orders`, and `users` typed one key at a time, pasted or left once
its `#` is deleted. Each keystroke searches every command afresh: `auto` typed
over `qqqq` lists Auto Layout, and Backspace from `users` to `u` lists what `u`
finds. Under Chromium's own IME composition (`Input.imeSetComposition` to
compose and `Input.insertText` to commit, over a CDP session) it holds down the
Hangul search: every step a Korean IME
hands over while typing `#사용` keeps the table 사용자 listed, a word composed with
no prefix lists `No commands match` and no table or comment until a prefix row
types `:` before it, `#ㅈㅁ` finds 주문 내역 by its initials, an arrow or Enter
pressed mid-syllable is left to the IME and picks nothing, and `@사` goes to a
column by an unfinished syllable.
`zoom-overlay.spec.ts` holds the quick search's list without a prefix to the
commands, `memo` to New Memo alone, the seeded tables showing only after `#`.

`locale-picker.spec.ts` holds down the display language: no language button
while the element leaves the picker off, English then even under a Korean
browser, which the picker once on follows; the picker opening from the toolbar
on System and the 25 languages with System checked, moved by the arrows, picked
with Enter, closed by Escape, by a press outside it and by the theme builder it
trades places with; a pick that tells the host and hands the keyboard back;
Arabic laying the editor out right to left while the canvas stays left to
right; System returning to the browser's language; and the palette's Display
Language and Theme rows, the theme row leaving its gray and accent alone.

`welcome-screen.spec.ts` holds down the screen over an empty document: off until
the host turns it on, gone in a read-only editor and in zen mode, gone with the
first table New Table adds and back on its undo; a drag over the heading that
pans and a modifier wheel over a row that zooms; the formats Import swaps in,
left on Escape or Back, a json import that steps it aside, and the keyboard
kept in the editor when the first table comes from a file or from a chord
pressed on a focused row; the command palette and the Shortcuts page it opens;
the menu kept and the hints dropped on a small screen; and the palette arrow
landing on Search and the preferences arrow midway between Theme and the
language button, the palette's label on the side the text starts, in English
and in Arabic.

`relationship-map-columns.spec.ts` holds down the two buttons a relationship
draw puts beside the table it would end on, and Map Columns behind them. The
buttons stand on the table's left at one screen size at any zoom, outline the
table a press there would link, the one drawn on top of two overlapping at one
z-index, flip right where the left edge has no room, keep clear of the minimap
and stay in view beside a table taller than the canvas, while the draw preview
keeps following the pointer over them; the strip between them and the table
spends a press that would reach a neighbour or the start table; for a self
reference the buttons show only once the pointer travels 24 px
(`SELF_REFERENCE_TRAVEL`) from the press that started the draw, and a press
before that draws a self reference to a new column.
Plus draws what a press on the table draws, which a press on the table still
does. Map links existing columns in one undo and renames nothing, row by row
for a composite key, prefilled where exactly one name matches, References
offering a unique column only where the parent has one, and a self reference
sharing its tenant column; the relationship menu changes a relationship's
columns in place, its id, type and ON DELETE kept, a column it no longer uses
kept without its FK mark, a removed column shown as `(removed)` until another
is picked; with data type sync on the child takes the parent's type in the same
undo. A read-only editor shows neither the buttons nor the relationship menu's
Map Columns item, the chords of Find and Replace and the palette close the
dialog for them, Escape closes it writing nothing, opening it from
the menu ends an armed draw, and under touch a tap on a table mints new columns
at once, as it always has, with no buttons ever shown: not after a tap on empty
canvas and a pan or a zoom from the keyboard that brings a table under it, and
not for a pinch whose first finger lands on a table, which draws to that table
as a tap there does and still zooms. `shared-presence.spec.ts` sends a mapping
made in the dialog and one edited from the menu to a wired peer, and closes the
dialog with a toast once the peer removes its relationship.

`schema-sql-options.spec.ts` holds down the Schema SQL tab's options panel: on
a wide editor it opens beside the code, on If not exists and CREATE + USE
(`CREATE DATABASE IF NOT EXISTS shop; USE shop;`); Drop & re-create names the
tables it drops and survives a trip to
another tab but not a reload; a database lacking If not exists dims it, a press
on it does nothing and the pick comes back with MySQL; a Before tables script
reaches the document as the field loses the focus and the ERD tab's Undo takes
it back; under 640 px the panel starts folded behind Show options and stays
open once shown; Export ▸ Schema SQL from the canvas menu saves nothing, opens
the tab with Save file focused and a press saves `shop-<time>.sql`; the code's
menu has six rows and the palette four; a readonly editor's scripts take no
typing while its Statements still change.

`generator-code-options.spec.ts` holds down the Code Generator tab's options
panel: on a wide editor it opens beside the code, folds behind Show options,
which takes the focus, stays folded across a trip to another tab and opens
again with Hide options focused; under 640 px it starts folded, and showing
it leaves the Schema SQL tab's panel folded; a new language or database writes the code again
(Zod's decimal a string on MySQL and a number on SQLite), Bracket is gone for
TypeScript and shows for Doctrine and JPA, and Mermaid shows its Not used by
Mermaid note under the Database and under the two name cases, the Database list
described by its note (`GeneratorCodeOptions.test.ts` holds the dimming); Save
file in the panel and the code's menu, whose
rows it lists, save `shop-<time>.swift` and `shop-<time>.json`.

`table-group.spec.ts` holds down table groups: New Table Group in the canvas
menu arms a draw, the box then dragged becomes the group, taking in the tables
whose centres it holds, and its name editor opens; from a selected table's
menu, Group selected tables wraps a marquee selection and Remove from group
takes one table out; a table dropped inside a group joins it, the group
outlined while the table is held over it, and wears the group's colour on its
header band, and one dropped outside leaves it; a drag on the title carries the
group and its tables, which one undo puts back; View Option hides the boxes
and the colour, a table dragged meanwhile keeping its group, and the box grows
round it once shown; and the Schema SQL tab's Tables leaves out the tables of an
unchecked group, writes nothing under its hint with no box checked, and All
checks every box again.

The other eleven: `harness`, `keyboard`, `mouse-drag`, `relationship`,
`clipboard`, `cascade`, `alt-drag-duplicate`, `shared-presence`,
`table-properties-indexes` and `zoom-overlay` predate the port and were made to
pass against the canvas; `context-menu` arrived with it.

`alt-drag-duplicate` and `clipboard` hold down one rule from their two ends: a
duplicate of whole tables carries a relationship only when **both** its end
tables are copied, carries every index of a copied table whole, and points every
one of them at the new ids. `relatedTables()` is the seed both use, and the
foreign key badge on a copied end column is the user-visible half — the payload
does carry `ui.keys`, but the duplicate never replays it (`toCreateEntityActions`
emits `addColumnAction` with `id` and `tableId` alone), so the badge is only
there if a real `relationship.add` reached `validationForeignKeyHook`, which
marks every column a relationship in the document ends on.

## The things that make this suite work

### 1. The shadow root is `closed`, and the fixture reopens it

`ErdEditor.tsx` declares `shadow: 'closed'`, so Playwright locators (`getByRole`
and ARIA snapshots included) and `document.querySelector` all stop at the host
element. `e2e/fixture/index.html` patches `Element.prototype.attachShadow` to
force `mode: 'open'` **before** the editor module registers the custom element.

The fixture deviates from production in two ways. One is this reopened root.
The other is the scene mirror of section 2, whose divs take real pointer events
inside `stage.content`: a real touch that starts on an entity loses its moves
when the press detaches the div it began on, which is why `touchDrag` dispatches
its travel on `window`, and why a `touchPinch` meant only to zoom has to start
clear of every entity. The
reopened root changes reachability, and one thing more: `composedPath()` read
at a **window** listener stops at the host for a closed root and walks into the
tree for an open one, so a reopened root hides every bug built on that
difference — the row display menu closed itself on its own item's mousedown for
exactly that reason, green suite and all. Production code and the published
bundle are untouched.

`erd.gotoClosedShadow()` loads the same fixture with `?closedShadow=1`, which
leaves the mode as production declares it. The fixture publishes the root on
`window.__erdShadowRoot` in both modes (`context-menu.spec.ts` reads it on the
open one too), and here it is the only way in. No locator resolves inside it:
reach elements through `erd.shadowBox(selector)` and drive them with
`erd.clickInShadow(...)` or `page.mouse` at the box it returns. That page has no
scene mirror, since its URL carries no `sceneMirror=1`, so `shadowBox` reaches
the DOM alone (toolbar, menus); read scene nodes off `window.__erdStages.canvas`,
as `visualization-flow.spec.ts` does. With no `__erdWhenDrawn` there,
`erd.whenDrawn()`, which `erd.seed()` ends on, waits two frames and no tween.
Use it whenever the subject is how an event reads from outside that boundary,
and the open fixture for everything else.

### 2. The scene is a canvas, so a css locator resolves against a projection

There are no scene elements to select. `e2e/support/sceneMirror.ts` walks every
live Konva stage and lays one absolutely-positioned `div` over the stage for
each **named**, visible node, inside a `.scene-mirror` root appended to
`stage.content`. A hidden node, or one on a hidden layer, has no element, so
assert `toHaveCount(0)` for it. That projection is what `.table`,
`.column-row`, `.memo` and the rest name.

It is installed only when the URL carries `?sceneMirror=1`. `ErdEditorPage#goto`
adds the flag; the bench loads the same page without it and pays nothing. A page
opened by hand at `/e2e/fixture/index.html` therefore has no `.scene-mirror` at
all — that is the flag missing, not a broken fixture.

The contract the projection keeps is in **Scene mirror contract** below. What it
cannot carry — a fill, a tween, a node that only culling decides — is read off
the stage directly, through the handles in **Reaching the stage directly**.

### 3. The minimap is a second stage, so every canvas locator is scoped

`Minimap.tsx` draws its own stage, registered as `minimap`, and its boxes are
named `minimap-table` / `minimap-memo`. The projection aliases those onto
`table` and `memo`, because the specs counted the minimap's copies by those
names before the port. So a bare `.table` still matches **twice per table**
(measured 2026-09-04: `host` 2, canvas 1, minimap 1 for a one-table seed;
`harness.spec.ts` holds the two-table count, `host` 4, canvas 2, minimap 2).

`Canvas.tsx` carries `data-testid="erd-canvas"`, which the minimap does not, and
`ErdEditorPage` scopes every canvas locator through
`[data-testid="erd-canvas"] .scene-mirror`. Reach for `erd.host.locator(...)`
only when you deliberately want both copies. A minimap node carries no `data-id`
— two stages spelling one id would make an id scan ambiguous — so ask for a
table by `data-table-id`, which is what `erd.minimapTable(id)` does. A minimap
memo or table group answers to `[data-type="<id>"]`, the second word of its name.

### 4. Deletes are LWW tombstones — assert through `doc`, never `collections`

Removing a table drops its id from `doc.tableIds` but leaves the entity in
`collections.tableEntities` so the change can replicate. Counting collection
keys will tell you nothing was deleted. `ErdEditorPage#tableIds()`,
`#relationshipIds()`, `#indexIds()` and `#memoIds()` read `doc`; use them.

### 5. `el.runtimeValue` is the authoritative, synchronous state

The element's `runtimeValue` getter serialises the live store on read, a locked
setting excepted (Known traps), with what the file form `value` leaves out:
removed entities, `zIndex`, the measured widths, the relationship anchors and
flags. `erd.value()` reads it. That is what assertions should compare against —
the scene is a projection of it. A view (Flow mode's placement, zoom and rows)
and the selection are never in it: read the first off the stage
(`window.__erdStages.canvas`), as `visualization-flow.spec.ts` does, and the
selection off the mirror's `data-selected`. Pair a store assertion with a
user-visible one wherever the visible result is meaningful; a spec that only
reads the store is a unit test wearing a costume.

`setInitialValue()` clears the undo history and records nothing, so a seeded
document starts with **empty undo history** and fires no `change` event. That is what
makes per-test isolation cheap. `erd.seed()` also waits for the scene to draw,
so a coordinate taken straight after it is one the stage will answer.

### 6. Gestures must match the pipeline the editor actually listens to

`src/utils/globalEventObservable.ts` turns window-level `mousemove` and
one-finger `touchmove` into `move$`, and `drag$` is `move$` until a `mouseup`,
`touchend`, `dragstart`, `pointercancel` or window blur. A `mousedown`, a
`touchstart` or the middle press a scene pan forwards (`moveStart$`) sets where
the deltas start, and the module listens
for it for the life of the page. Drags therefore need a stepped
`page.mouse.move` sequence (`ErdEditorPage#drag` does this) — a single jump
produces one delta and skips the intermediate states the UI reacts to. Every
other stream adds its own window listener when subscribed and drops it on
teardown, so a move with no press drives no drag.

Everything the scene resolves — a click, a hover, a right click, a touch — is
resolved from the **coordinates on the event**, by `stage.getIntersection`,
never from its target. A dispatched `mousedown`, `mouseup`, `mousemove` or
`contextmenu` on a mirror element still reaches the stage, at a point the
projection keeps inside the node (Scene mirror contract), but konva hears no
dispatched `click` or `dblclick`, which it builds from a press and a lift.
Prefer the real pointer: `page.mouse.*`, or the helpers `clickAt`, `hoverAt`,
`hoverScene`, `touchPinch`, and `touchDrag`, whose press is real and whose
travel is dispatched on `window`, where `drag$` listens.

## Scene mirror contract

The projection is interactive, not read-only. What it guarantees:

- **A real click lands on konva.** A trusted event — which is what both
  `page.mouse.click` and `locator.click()` produce — passes the projection
  untouched and reaches the stage by bubbling through `stage.content`, where
  konva reads its `clientX`/`clientY`. Measured 2026-09-04: a `locator.click()`
  on `.table-header-color` arrives as `isTrusted: true` and opens the colour
  picker. Since the colour became an edge drawn as a projected `Path`
  (178e5fd6, 2026-09-19), name the box with `div.`: the `Path`'s svg twin
  carries the same class, so a bare `.table-header-color` matches two elements
  and the click fails strict mode; `cascade.spec.ts` opens the picker with a
  click on `div.table-header-color`. Nothing in the projection declares `pointer-events`,
  so it is `auto` by default and turns `none` with the canvas the moment
  grab-pan does.
- **A dispatched event is re-aimed.** An untrusted `dispatchEvent` carries
  whatever coordinates it was given, which konva would hit-test literally. When
  the point falls outside the node's own screen box, the projection stops its
  propagation at the mirror root and dispatches a copy on `stage.content` at
  the visible centre of that node. Only `mousedown`, `mouseup`, `click`,
  `dblclick`, `contextmenu` and `mousemove` are re-aimed; a dispatched pointer,
  touch or wheel event reaches konva at the coordinates it carries. Measured
  2026-09-04: a synthetic `mousedown` at `(0, 0)` on the `posts` element reached
  the stage at the centre of the part of `posts` on screen (`aimAt` in
  `sceneMirror.ts`).
- **A retired element loses its identity at once and is detached one pass
  later.** Nothing counts a node the scene has dropped, and when a press
  re-renders the scene inside its own dispatch, the element it landed on stays
  attached for one more pass, so a listener above the stage that walks up from
  the event's target (`Erd.tsx`'s press routing and its `closest()` checks)
  still finds where it sat.
- **Names become classes**, split on whitespace, plus the aliases
  `CLASS_ALIASES` adds: `minimap-table` → `table`, `minimap-memo` → `memo`,
  `cell-text` → `edit-input` and `relationship-route` → `route`. An svg twin
  carries the same classes, which is how `path.route[stroke-dasharray="10"]`
  finds a connector's dashed route. `data-id` is the node id minus
  its `table-group-body-` / `table-group-` / `table-` / `column-` / `memo-` /
  `relationship-` prefix, the longest that matches,
  and `data-type` is the second name. So `relationship <id>` answers to
  `.relationship[data-type="<id>"]`, and a cell named `column-col columnName`
  answers to `[data-type="columnName"]`.
- **A paint token names a colour a class no longer can.** A column key badge is
  one shape whose only difference is its stroke, so the projection resolves that
  stroke back to the theme token it came from and stamps `data-paint-token`
  (`keyPK`, `keyFK`, `keyPFK`). `erd.columnKey(id, 'pk' | 'fk' | 'pfk')` is the
  locator built on it. A group with no stroke of its own inherits the token of
  the first descendant that has one, which is how an icon made of paths is
  labelled.
- **Other attrs project too:** `selected` → `data-selected`, `sharedFocus` /
  `sharedSelect` → `data-shared-focus` / `data-shared-select` and the matching
  `--shared-focus` / `--shared-select` custom properties, `tableId` →
  `data-table-id`, a `dash` → `stroke-dasharray` on the box and its svg twin
  (one number when every entry is equal, `[10, 10]` → `10`, else the entries
  joined by spaces), and a stroke onto the element's own `style.stroke`.
- **A `Text` node's string is the element's `textContent`**, so `getByText`
  works on drawn text.
- **`Line`, `Circle` and `Path` keep a namespaced twin** inside their box, so
  the tag-name counting the SVG connectors used to answer still resolves. The
  box stays a `div`, because an svg element outside an svg root lays out none.
  The marquee band gets a real `<svg><rect stroke-dasharray="3">` of its own
  inside `.drag-select`, which is the handle `mouse-drag.spec.ts` reaches it by.
- **A few markers keep the data attribute** the DOM scene spelled them with:
  `data-testid="duplicate-ghost"`, `data-testid="shared-drag-select"`, and
  `data-focus-border-bottom` on `cell-focus-border`, the focus ring
  `erd.focusRing(cell)` and `erd.focusRings()` read.
- **Order below the top level follows the scene.** A column reorder settles into
  the same order the store holds, which `mouse-drag.spec.ts` asserts directly.
- **Order at the top level follows nothing.** The projection never reorders the
  root's children, and a node the scene destroys and rebuilds comes back as a
  fresh element appended last. A press that lifts an entity does that: while
  the drag runs the entity is drawn in the `drag-entity` layer, and on release
  in `scene` again, each time as a new node. A press that carries the entity
  lifts it at once, except one on a table's header cell or a table group's
  title, which waits for 4px of travel (`CLICK_DRAG_MIN_MOVE`). Raising an
  entity's z-index on its own only moves its node, so its element keeps its
  place. Measured 2026-09-04, at a point the record does not give: clicking
  `users` moved it from first to last in the mirror. Read entity order
  from `doc.tableIds`, never from DOM order.

## Reaching the stage directly

The fixture publishes two globals for the stage, and the page object wraps
both; beside them it sets `window.erdEditor`, the element, for the browser
console, and `window.__erdShadowRoot` (section 1). `__erdStages` exists from
page load. `__erdWhenDrawn` comes with the scene mirror, so only with
`?sceneMirror=1`: `erd.goto()` adds it, while `erd.gotoClosedShadow()` and
`FIXTURE_URL` opened without the flag (by hand, or once in `diff-viewer.spec.ts`)
do not, and there `erd.whenDrawn()` waits two frames only.

| Handle                    | What it answers                                             |
| ------------------------- | ----------------------------------------------------------- |
| `window.__erdStages`      | `{ canvas, minimap, visualization }` — the live stages, newest claim wins. `canvas` is whatever mounted the erd canvas last: the ERD tab, Flow mode, time travel, a diff viewer pane or the placement preview, and every page-object scene helper reads it. `visualization` is Graph mode's, which `mouse-drag.spec.ts` reads its dots off |
| `window.__erdWhenDrawn()` | Returns a promise that resolves once tweens are done and the gate has flushed |

| Page object                       | Use it for                                          |
| --------------------------------- | ---------------------------------------------------- |
| `sceneBox(selector)`              | A node's screen box, zoom and scroll already applied |
| `pointAt(x, y)`                   | A canvas coordinate as a viewport coordinate         |
| `scenePointAt(point)`             | A viewport point as a canvas coordinate, `pointAt` reversed |
| `sceneAttr(selector, attr)`       | A paint the projection does not carry — a fill       |
| `hasSceneNode(selector)`          | Whether the scene holds the node at all, drawn or kept hidden |
| `sceneNodeDrawn(selector)`        | Whether the node is drawn now: a table that scrolled off stays built (`hasSceneNode` true) but hidden |
| `sceneHitPoint(name)`             | A point the stage really answers with the node named `name`: a bare konva name, such as a relationship id, not a selector |
| `emptyPoint()`                    | A visible canvas point at least 12px clear of every drawn table and memo (not a table group or a connector) |
| `whenDrawn()`                     | The frame after the commit, before a click at a box  |

A selector, which `sceneBox`, `sceneAttr`, `hasSceneNode`, `sceneNodeDrawn` and
`hoverScene` take, is one konva selector, or an array walked a step at a time
(`['#memo-m1', '.memo-sash-rb']`) — konva matches a single simple selector, so
there is no css-style descendant form.

## Gesture cheat sheet

Checked against the running editor or read from the code, not inferred:

| Gesture                       | What it does                                        |
| ----------------------------- | --------------------------------------------------- |
| plain drag on empty canvas    | **pans** the canvas                                 |
| `$mod` + drag on empty canvas | marquee-selects (`handleDragSelect` checks `isMod`) |
| press `Space` (or the floating toolbar's Hand), then drag | the hand tool grab-pans, even when the drag starts over a table; Space toggles it on keydown once the editor holds the keyboard (`erd.focusCanvas()`), outside a text field, where Space types a space, and it stays on until Space is pressed again or Select, a floating-toolbar notation or New Table Group puts it down |
| middle-button drag            | pans from anywhere on the scene, a table included, under the hand tool too; selects, moves and clicks nothing, its lift is prevented wherever it lands, and the editor takes the keyboard as on a main press (`drag(…, { button: 'middle' })`) |
| middle press over a takeover  | over the scene of the diff viewer, time travel or the placement preview: the press and its lift prevented, and the document's selection kept under all three; only a diff pane pans for it, keeping its own selection. The takeover's chrome (the diff tree, the time travel slider, a pane's compass, minimap and scrollbars) keeps the browser default and unselects as a main press does |
| drag a table header           | moves it, with the whole selection (tables, memos, and table groups with their members) when the press lands on a selected table or holds `$mod`; a plain press on an unselected table collapses the selection onto it |
| `Alt` + drag a table or memo  | drops a duplicate where the ghost lands (`[data-testid="duplicate-ghost"]`) |
| drag a table group's title bar | carries the group and its members; a main press on its body pans, or with `$mod` draws a marquee, as on empty canvas |
| right-button drag on a table or memo | selects it, keeping a selection it lands in, and moves nothing; from a memo's edge it resizes nothing |
| right click on a scene button | clicks nothing: a table's remove button, a colour edge and the Flow card's Related and Go to ERD answer the main button alone; on the ERD tab it opens the context menu of the table or memo the button belongs to, and the Visualization tab opens none |
| right click on a memo body    | opens the context menu and no memo editor, which the main button alone opens |
| right-button drag on a Graph mode dot | pins and moves nothing, where a main drag carries the dot under the pointer |
| drag a simplified table       | anywhere on its body — zoomed out there is no header |
| plain wheel                   | scrolls; `Shift`+wheel scrolls horizontally; over a memo body it scrolls the memo, not the canvas |
| `$mod` + wheel                | zooms in 0.03 steps, one a notch: off a Mac a Ctrl wheel of `deltaY` 25 or more either way, on a Mac any Cmd wheel; a smaller Ctrl wheel off a Mac, or any Ctrl wheel on a Mac, is a trackpad pinch that zooms about the pointer; over a memo body a notch does nothing |
| `$mod+Equal` / `$mod+Minus`   | zooms in 0.04 steps                                 |
| double-click a cell           | opens an `<input>`, with type hints on a data type cell; edits commit as you type. A not-null, unique or auto-increment cell toggles its flag instead, and a Flow card edits nothing |
| `Escape` while editing or drawing | ends only that edit or the armed relationship or table group draw, prevented, and the selection stays; a cell or memo does **not** revert, since edits commit as you type, while a table group's name editor writes nothing |
| `Escape` otherwise            | unselects, and reaches the page unprevented         |

Column reordering is **not** native HTML5 drag-and-drop any more. `konva/jsx.d.ts`
types `draggable` and every `on:drag*` as `never`, so the row runs on the same
`drag$` stream as everything else: `Column.tsx` arms on mousedown and reports a
start on the first move, and `Table.tsx` answers which row a drop landed on with
`findColumnDropTarget`, arithmetic over the rects the scene laid out. Where the
pointer is over no drop target, the rows it carries are drawn under it as
`.column-drag-ghost` on the presence layer, hidden over a target and gone on
release. The same drag moves columns into another table: onto one of its rows,
into the band under its last row, or anywhere on a table with no rows. There
each column is removed and added again under a new `uuid25()` id, so find it by
name. A `$mod` press carries every selected column of the focused table, only
the main button arms the drag, and a Flow card's rows never drag. Drive it with
`page.mouse`, never `locator.dragTo()`. Two preconditions:

- `dragstartColumnAction$` bails unless a column already holds focus. Click the
  cell first (`erd.focusCell`) — a drag from an unfocused row does nothing.
- The reorder is applied by the dragover, while the button is still down. Assert
  the settled order before releasing, then release.

Native drag-and-drop survives in the DOM panels only — the table-properties
index column list and the settings column order — through `fromShadowDraggable`,
which is `throttleTime(300)` then `debounceTime(50)`. `locator.dragTo()` drops
too fast for it, and a real mouse sends a dragover only when it moves, so
`support/listDrag.ts` drives such a list from inside the page, one dragover a
frame, and reads back every painted frame. The held row takes no part in the
list's flip: it snaps to its slot while the rows it pushes slide.

## Determinism rules

- **`zoomLevel` runs 0.1 to 1.5** (`SchemaV3Constants.CANVAS_ZOOM_MIN` /
  `CANVAS_ZOOM_MAX`; v2 capped at 1). A fresh page and every seed that names no
  `zoomLevel` start at **1.0**, so `zoomIn` is a real step, not a no-op — 13
  keyboard steps of 0.04 reach the ceiling. Seed before `erd.stepZoom()`, which
  reads the zoom from `erd.value()`, where an unseeded page keeps its locked 1.0
  (Known traps). Read the bounds from `CANVAS_ZOOM_MIN` / `CANVAS_ZOOM_MAX` in
  `e2e/support/schema.ts`, a hand copy of `SchemaV3Constants`'s values, as
  `zoom-overlay.spec.ts` and `erd.stepZoom()` do, never from a literal in a spec.
- **At `zoomLevel <= 0.7`** (`isHighLevelTable`) the ERD tab draws tables in the
  simplified high-level render, and the canvas stops answering the column
  shortcuts (Select All Columns, Remove Column, Primary Key), Enter to edit, the
  arrow and Tab focus moves, and copy and paste. The Flow view keeps full tables
  at any zoom. Stay above 0.7 unless that is the behaviour under test.
- **The scene builds only what is near the viewport.** The culling rect is the
  screen plus one screen of margin on every side. A table never inside it has
  no node. One that scrolled out of it stays built but hidden (up to the larger
  of 16 and 3 per drawn table, `sceneRetention.ts`), so `erd.hasSceneNode()` stays
  true of it while `erd.sceneNodeDrawn()` turns false; it has no mirror element
  and no hit target. A memo or connector that leaves is destroyed. `doc.tableIds`
  still holds every table, and the minimap still draws it. Seed inside the
  screen unless culling is the subject.
- **Wait for the draw, not for the dispatch.** A konva node exists as soon as
  the host creates it and answers a hit test only once its layer has painted.
  `erd.seed()` and `erd.whenDrawn()` close that gap; a coordinate taken before
  it can be a click into nothing.
- **No `waitForTimeout` as synchronisation.** Use locator auto-waiting or
  `expect.poll` against `erd.value()`. Timeouts hide races; they do not fix them.
  The fixed waits the suite keeps each prove that something did not happen,
  sample a blinking caret across frames, or outlast or undercut a window the
  code names (the 200 ms colour buffer, the 100 ms shared-stream window, the
  200 ms `change` debounce).
- **Never assert exact coordinates from `Auto Layout`.** Its Force placement is
  a d3-force preview that Apply takes as it stands, and Flow, Tree - vertical
  and Tree - horizontal come from ELK in a worker; each sizes tables by the
  runner's text measure. Assert that positions _changed_, or their relative
  order, as `automatic-table-placement.spec.ts` does.
- **Never assert exact `fuse.js` result ordering** in quick search. Assert
  membership.
- **Do not assert the measured widths as numbers** (`ui.widthName` /
  `widthComment` on a table or column, and a column's `widthDataType` /
  `widthDefault`) — they are derived from canvas `measureText` and vary with the
  font the runner has available. Comparing two widths measured in one run is
  fine, as `clipboard.spec.ts` does.

## Known traps

Each of these has bitten someone already. They are ordered by how much time they
cost when you hit them blind.

**Timing**

- `store.dispatch` defers through `queueMicrotask`, and the render flush is another
  microtask hop, and the scene paints on the frame after that. Never read state
  or a box in the same tick as the interaction that changed it. (The public
  element methods — `setInitialValue`, `value =`, `clear` — use `dispatchSync`
  and _are_ synchronous, but they still leave the paint to the next frame.)
- The outward `change` event is `debounceTime(200)`. It is not an assertion
  target; `el.runtimeValue` is.
- Relationship side effects land on later ticks: the FK `ui.keys` bit and
  `identification` in the microtask after the batch, `startRelationshipType`
  one microtask after that, and the relationship's start/end geometry on a
  5ms throttle after a dragged table or memo, or a microtask after anything else.
  Poll for all four.
- A column reorder plays a 0.3s FLIP tween on the scene (`FLIP_DURATION`).
  Assert the settled `columnIds` order or the settled projected order, never a
  box taken straight after the drop. A row the reorder adds to a table fades
  in over the same span, so its opacity is only worth reading once it settles.

**Gestures**

- A drag whose total `|dx| + |dy|` is under **20px** (`MOVE_MIN`) records no
  history entry at all — undo will silently do nothing. Drag well past it.
- A bare `Space` keydown toggles the hand tool (`Shortcut.handTool`), and no
  keyup turns it off: after a stray Space every later drag pans instead of
  moving until Space is pressed again, or Select, a notation or New Table Group
  puts the hand down. Open Table Properties with
  `erd.press(Shortcut.tableProperties)` (`Alt+Space`), whose Space carries the
  Alt bit and so matches that chord alone.
- A mousedown on the minimap or its viewport handle also clears the table
  selection: `.minimap` is excluded from starting a canvas drag but not from
  `canUnselectAll`. Do minimap work before selection assertions, not after.
- The `columnDataType` cell has an autocomplete that `stopPropagation`s Tab and
  Enter once an arrow key has highlighted a hint; typing opens the list but
  highlights nothing, and ArrowUp/ArrowDown are only prevented while it lists
  hints. When traversing through it, press no arrow key in that cell, or press
  `Escape` first.

**Selectors**

- Every entity id is a `uuid25()` (`@dineug/uuid`). Seed deterministic ids
  (`users`, `posts`) or read them back; never hard-code a generated one.
- Context-menu item `data-id` is a fresh id per render. Select menu items by
  their text.
- `HighLevelTable` is named `table high-level-table`, so `.table[data-id]`
  silently changes meaning at `zoomLevel <= 0.7`. Tell the modes apart by
  `.high-level-table`, or by whether the table holds a `.column-row`.
- The live editor is a DOM overlay over the stage, not a scene node. It is
  `.edit-overlay input.edit-input` (`erd.editInput()`) and
  `.edit-overlay textarea.memo-textarea` (`erd.memoEditor`). A bare
  `.edit-input` inside the canvas is the drawn cell text — the projection
  aliases `cell-text` onto that name — and never a live field.
- A preview copy of a table or memo is drawn with `preview` set, which blanks
  its id — so the ghost dragged by `Alt` has no `.table[data-id]` inside it at
  all. Address it through its wrapper, `[data-testid="duplicate-ghost"] > *`,
  and address a draw in flight through `.draw-relationship-preview`.
- `cache()` swaps a whole subtree out rather than destroying it, and the
  projection retires whatever it can no longer walk. Assert `toHaveCount(0)`,
  not `toBeHidden()`.

**Platform**

- `hasAppleDevice()` reads `navigator.platform` on every call and decides both
  `$mod` in the key bindings and `isMod` on _mouse_ paths, so the two agree, and
  `ControlOrMeta` follows the same host. For a mouse modifier read
  `erd.pointerModKey()`, which asks the page's own `navigator.platform`;
  `MOD_KEY` is the same answer taken from `process.platform`, for gestures that
  hold the key across several events.
- The chromium project clears the Windows `userAgent` that
  `devices['Desktop Chrome']` pins, so the page names the host it runs on, as
  its platform does. The modifier a spec holds has to be the one the page reads
  as `$mod`: a mod-click sent as `Ctrl` on a mac is a right click there, and the
  memo-over-focus states were once measured with a context menu open, while CI
  — where `Ctrl` opens nothing — tested a different state from a workstation.
  Sending the ctrl bit through CDP without a key press opens the menu too.
- `toJson()` — which backs the `runtimeValue` getter, as `toDocumentJson()`
  backs `value` — serialises a copy, so reading either never moves the live
  view. Both write each locked setting at its lock, not live: the origin and the
  zoom while the viewport lock of `lockSettings` is on, and likewise
  `canvasType`, `language`, `tableNameCase`, `columnNameCase` and `bracketType`.
  Every seed keeps `lockSettings` at `0`, all unlocked; the unseeded element is a
  new document, every lock on, so a spec that reads the view, the tab or a code
  setting from either seeds first. A seed without the field would open as a
  file saved before the locks: every lock on, and its view reset to the origin
  at zoom 1 on the ERD tab, so `runtimeValue` and `value` keep writing that view
  whatever the spec pans or zooms to.
- Clipboard copy/paste is driven by native `ClipboardEvent`s on the shadow-root
  `.root` div, with bubble-phase listeners. Dispatching at `document` or at the
  host element will not reach them.
