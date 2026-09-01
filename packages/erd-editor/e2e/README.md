# erd-editor e2e

Playwright suite for the interaction surface that `vitest` + `happy-dom` cannot
check faithfully: real hit-testing, real layout, real event ordering, and the
keyboard/mouse gestures built on top of them. Since the scene became a Konva
stage it is also the only place a real pointer is driven through that stage.

```bash
pnpm --filter @dineug/erd-editor e2e            # headless run (builds first)
pnpm --filter @dineug/erd-editor e2e:dev        # Playwright UI mode
pnpm --filter @dineug/erd-editor e2e:headed     # watch it drive a real browser
pnpm --filter @dineug/erd-editor e2e:report     # open the last HTML report
pnpm --filter @dineug/erd-editor e2e:typecheck  # tsc over e2e/ + playwright.config.ts
pnpm --filter @dineug/erd-editor e2e:bench      # benchmarks — see e2e/bench/README.md
```

`E2E_PORT` is the port the Vite `webServer` takes, with `--strictPort`, and the
`baseURL` follows it. The suite defaults to `5174` and the bench config to
`5175`, so anything that may run beside another checkout, another agent or the
bench has to name its own:

```bash
E2E_PORT=5199 pnpm --filter @dineug/erd-editor e2e
```

`pnpm test` stays vitest-only. E2E is a `package.json` script and its own CI job,
never a `run.tasks` task, so a missing browser binary can never turn the unit
suite red.

## Layout

| Path                            | What it is                                                       |
| ------------------------------- | ---------------------------------------------------------------- |
| `playwright.config.ts`          | Chromium project, pinned 1440x900 viewport, `E2E_PORT` webServer  |
| `playwright.bench.config.ts`    | The bench project — own testDir, one worker, asserts nothing      |
| `e2e/fixture/`                  | The page under test — a deterministic `<erd-editor>` mount        |
| `e2e/support/schema.ts`         | Hand-authored v3 seed documents and the schema bit constants      |
| `e2e/support/sceneMirror.ts`    | Projects every live Konva stage into divs a css locator can name  |
| `e2e/support/shortcuts.ts`      | Key strings mirroring `createKeyBindingMap()`, `MOD_KEY`, steps   |
| `e2e/support/ErdEditorPage.ts`  | Page object: locators, scene coordinates, gesture helpers         |
| `e2e/support/fixtures.ts`       | The `test` object every spec imports; fails on uncaught errors    |
| `e2e/specs/harness.spec.ts`     | Guards the assumptions below — fix this first if it goes red      |
| `e2e/bench/`                    | The benchmarks, gated behind `E2E_BENCH_ALL`; carries own README  |

## What is covered

21 spec files. Ten of the groups exist because the DOM scene got their subject
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
| `hide-sign.spec.ts`             | Off-canvas markers for entities culling has dropped               |
| `context-menu-cardinality.spec.ts` | A right click that finds a connector by hit-testing the scene  |
| `virtual-viewport.spec.ts`      | Culling: what is off screen has no node, and the minimap keeps it |

The other eleven: `harness`, `keyboard`, `mouse-drag`, `relationship`,
`clipboard`, `cascade`, `alt-drag-duplicate`, `shared-presence`,
`table-properties-indexes` and `zoom-overlay` predate the port and were made to
pass against the canvas; `context-menu` arrived with it.

## The things that make this suite work

### 1. The shadow root is `closed`, and the fixture reopens it

`ErdEditor.tsx` declares `shadow: 'closed'`, so Playwright locators,
`document.querySelector` and the accessibility tree all stop at the host
element. `e2e/fixture/index.html` patches `Element.prototype.attachShadow` to
force `mode: 'open'` **before** the editor module registers the custom element.

This is the fixture's one deliberate deviation from production. It changes
reachability only — no editor behaviour depends on the mode flag. Production
code and the published bundle are untouched.

### 2. The scene is a canvas, so a css locator resolves against a projection

There are no scene elements to select. `e2e/support/sceneMirror.ts` walks every
live Konva stage and lays one absolutely-positioned `div` over the stage for
each **named** node, inside a `.scene-mirror` root appended to `stage.content`.
That projection is what `.table`, `.column-row`, `.memo` and the rest name.

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
(measured: `host` 2, canvas 1, minimap 1 for a one-table seed).

`Canvas.tsx` carries `data-testid="erd-canvas"`, which the minimap does not, and
`ErdEditorPage` scopes every canvas locator through
`[data-testid="erd-canvas"] .scene-mirror`. Reach for `erd.host.locator(...)`
only when you deliberately want both copies. A minimap node carries no `data-id`
— two stages spelling one id would make an id scan ambiguous — so ask for it by
`data-table-id`, which is what `erd.minimapTable(id)` does.

### 4. Deletes are LWW tombstones — assert through `doc`, never `collections`

Removing a table drops its id from `doc.tableIds` but leaves the entity in
`collections.tableEntities` so the change can replicate. Counting collection
keys will tell you nothing was deleted. `ErdEditorPage#tableIds()`,
`#relationshipIds()` and `#memoIds()` read `doc`; use them.

### 5. `el.value` is the authoritative, synchronous state

The element's `value` getter serialises the live store on read. That is what
assertions should compare against — the scene is a projection of it. Pair a
store assertion with a user-visible one wherever the visible result is
meaningful; a spec that only reads `value` is a unit test wearing a costume.

`setInitialValue()` dispatches straight to the store, so a seeded document
starts with **empty undo history** and fires no `change` event. That is what
makes per-test isolation cheap. `erd.seed()` also waits for the scene to draw,
so a coordinate taken straight after it is one the stage will answer.

### 6. Gestures must match the pipeline the editor actually listens to

`src/utils/globalEventObservable.ts` merges window-level
`mousedown`/`mousemove`/`mouseup` (and their touch twins) into `move$` and
`drag$`. Drags therefore need a stepped `page.mouse.move` sequence
(`ErdEditorPage#drag` does this) — a single jump produces one delta and skips
the intermediate states the UI reacts to. The streams are cold and open their
listeners on first subscribe, so nothing is armed until a gesture starts one.

Everything the scene resolves — a click, a hover, a right click, a touch — is
resolved from the **coordinates on the event**, by `stage.getIntersection`.
Firing an event at a node never reaches it. Drive the real pointer:
`page.mouse.*`, or the helpers `clickAt`, `hoverAt`, `hoverScene`, `touchDrag`.

## Scene mirror contract

The projection is interactive, not read-only. What it guarantees:

- **A real click lands on konva.** A trusted event — which is what both
  `page.mouse.click` and `locator.click()` produce — passes the projection
  untouched and reaches the stage by bubbling through `stage.content`, where
  konva reads its `clientX`/`clientY`. Measured: a `locator.click()` on
  `.table-header-color` arrives as `isTrusted: true` and opens the colour
  picker. Nothing in the projection declares `pointer-events`, so it is `auto`
  by default and turns `none` with the canvas the moment grab-pan does.
- **A dispatched event is re-aimed.** An untrusted `dispatchEvent` carries
  whatever coordinates it was given, which konva would hit-test literally. When
  the point falls outside the node's own screen box, the projection cancels it
  and re-dispatches on `stage.content` at the visible centre of that node.
  Measured: a synthetic `mousedown` at `(0, 0)` on the `posts` element arrived
  at the stage as `(882, 470)`, the node's centre.
- **A retired element loses its identity at once and is detached one pass
  later.** Nothing counts a node the scene has dropped, and a press that
  re-renders the scene inside its own dispatch still finds the element it landed
  on when the routing above asks what it was.
- **Names become classes**, split on whitespace; `data-id` is the node id minus
  its `table-` / `column-` / `memo-` / `relationship-` prefix, and `data-type`
  is the second name. So `relationship <id>` answers to
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
  `data-table-id`, a uniform `dash` → `stroke-dasharray`, and a stroke onto the
  element's own `style.stroke`.
- **A `Text` node's string is the element's `textContent`**, so `getByText`
  works on drawn text.
- **`Line`, `Circle` and `Path` keep a namespaced twin** inside their box, so
  the tag-name counting the SVG connectors used to answer still resolves. The
  box stays a `div`, because an svg element outside an svg root lays out none.
  The marquee band gets a real `<svg><rect stroke-dasharray="3">` of its own
  inside `.drag-select`, which is the handle `mouse-drag.spec.ts` reaches it by.
- **A few markers keep a `data-testid`** where the DOM scene spelled them that
  way: `duplicate-ghost` and `shared-drag-select`.
- **Order below the top level follows the scene.** A column reorder settles into
  the same order the store holds, which `mouse-drag.spec.ts` asserts directly.
- **Order at the top level follows nothing.** The projection never reorders the
  root's children, and a node the scene destroys and rebuilds — which is what
  raising an entity's z-index does — comes back as a fresh element appended
  last. Measured: clicking `users` moved it from first to last in the mirror.
  Read entity order from `doc.tableIds`, never from DOM order.

## Reaching the stage directly

The fixture publishes two globals, and the page object wraps both.

| Handle                    | What it answers                                             |
| ------------------------- | ----------------------------------------------------------- |
| `window.__erdStages`      | `{ canvas, minimap }` — the live stages, newest claim wins   |
| `window.__erdWhenDrawn`   | Resolves once tweens are done and the gate has flushed       |

| Page object                       | Use it for                                          |
| --------------------------------- | ---------------------------------------------------- |
| `sceneBox(selector)`              | A node's screen box, zoom and scroll already applied |
| `pointAt(x, y)`                   | A canvas coordinate as a viewport coordinate         |
| `sceneAttr(selector, attr)`       | A paint the projection does not carry — a fill       |
| `hasSceneNode(selector)`          | Whether culling has kept the node at all             |
| `sceneHitPoint(name)`             | A point the stage really answers with that node      |
| `emptyPoint()`                    | Visible bare canvas, swept clear of every drawn box  |
| `whenDrawn()`                     | The frame after the commit, before a click at a box  |

A selector is one konva selector, or an array walked a step at a time
(`['#memo-m1', '.memo-sash-rb']`) — konva matches a single simple selector, so
there is no css-style descendant form.

## Gesture cheat sheet

Verified against the running editor, not inferred:

| Gesture                       | What it does                                        |
| ----------------------------- | --------------------------------------------------- |
| plain drag on empty canvas    | **pans** the canvas                                 |
| `$mod` + drag on empty canvas | marquee-selects (`handleDragSelect` checks `isMod`) |
| hold `Space` + drag           | grab-pans, even when the drag starts over a table   |
| drag a table header           | moves it, and every other selected table with it    |
| drag a simplified table       | anywhere on its body — zoomed out there is no header |
| plain wheel                   | scrolls; `Shift`+wheel scrolls horizontally         |
| `$mod` + wheel                | zooms in 0.03 steps                                 |
| `$mod+Equal` / `$mod+Minus`   | zooms in 0.04 steps                                 |
| double-click a cell           | opens an `<input>`; edits commit as you type        |
| `Escape` while editing        | ends edit mode — it does **not** revert the value   |

Column reordering is **not** native HTML5 drag-and-drop any more. `konva/jsx.d.ts`
types `draggable` and every `on:drag*` as `never`, so the row runs on the same
`drag$` stream as everything else: `Column.tsx` arms on mousedown and reports a
start on the first move, and `Table.tsx` answers which row a drop landed on with
`findColumnDropTarget`, arithmetic over the rects the scene laid out. Drive it
with `page.mouse`, never `locator.dragTo()`. Two preconditions:

- `dragstartColumnAction$` bails unless a column already holds focus. Click the
  cell first (`erd.focusCell`) — a drag from an unfocused row does nothing.
- The reorder is applied by the dragover, while the button is still down. Assert
  the settled order before releasing, then release.

Native drag-and-drop survives in the DOM panels only — the table-properties
index column list and the settings column order — through `fromShadowDraggable`,
which is `throttleTime(300)` then `debounceTime(50)`. `locator.dragTo()` drops
too fast for it.

## Determinism rules

- **`zoomLevel` runs 0.1 to 1.5** (`SchemaV3Constants.CANVAS_ZOOM_MIN` /
  `CANVAS_ZOOM_MAX`; v2 capped at 1). A fresh page and every seed start at
  **1.0**, so `zoomIn` is a real step, not a no-op — 13 keyboard steps of 0.04
  reach the ceiling. Read the bounds from the constants, never from a literal.
- **Below `zoomLevel <= 0.7`** tables swap to the simplified high-level render
  and column shortcuts stop working (`isHighLevelTable`). Stay above it unless
  that is the behaviour under test.
- **The scene draws only what is near the viewport.** The culling rect is the
  screen plus one screen of margin on every side. A table scrolled well past
  that has no node, no mirror element and no hit target, while
  `doc.tableIds` still holds it and the minimap still draws it. Seed inside the
  screen unless culling is the subject.
- **Wait for the draw, not for the dispatch.** A konva node exists as soon as
  the host creates it and answers a hit test only once its layer has painted.
  `erd.seed()` and `erd.whenDrawn()` close that gap; a coordinate taken before
  it can be a click into nothing.
- **No `waitForTimeout` as synchronisation.** Use locator auto-waiting or
  `expect.poll` against `erd.value()`. Timeouts hide races; they do not fix them.
- **Never assert exact coordinates from `Automatic Table Placement`** — it is a
  d3 force simulation with random jitter. Assert that positions _changed_.
- **Never assert exact `fuse.js` result ordering** in quick search. Assert
  membership.
- **Do not assert `ui.widthName` / `widthComment`** — they are derived from
  canvas `measureText` and vary with the font the runner has available.

## Known traps

Each of these has bitten someone already. They are ordered by how much time they
cost when you hit them blind.

**Timing**

- `store.dispatch` defers through `asap()`, and the render flush is another
  microtask hop, and the scene paints on the frame after that. Never read state
  or a box in the same tick as the interaction that changed it. (The public
  element methods — `setInitialValue`, `value =`, `clear` — use `dispatchSync`
  and _are_ synchronous, but they still leave the paint to the next frame.)
- The outward `change` event is `debounceTime(200)`. It is not an assertion
  target; `el.value` is.
- Relationship side effects land on later ticks: the FK `ui.keys` bit arrives on
  the next channel tick, `identification` / `startRelationshipType` on a 10ms
  trailing throttle, and the relationship's start/end geometry on a 5ms one.
  Poll for all four.
- A column reorder plays a 0.3s FLIP tween on the scene (`FLIP_DURATION`).
  Assert the settled `columnIds` order or the settled projected order, never a
  box taken straight after the drop.

**Gestures**

- A drag whose total `|dx| + |dy|` is under **20px** (`MOVE_MIN`) records no
  history entry at all — undo will silently do nothing. Drag well past it.
- Use `keyboard.press('Alt+Space')`, not `keyboard.down`. The Space keydown also
  arms grab-pan, which only disarms on a window-level `keyup`; a stuck Space
  leaves every later drag panning instead of moving.
- A mousedown on the minimap or its viewport handle also clears the table
  selection: `.minimap` is excluded from starting a canvas drag but not from
  `canUnselectAll`. Do minimap work before selection assertions, not after.
- The `columnDataType` cell has an autocomplete that `stopPropagation`s Tab,
  Enter and arrows while a hint is highlighted. When traversing through it,
  leave the value empty or press `Escape` first — never type a real type name
  mid-traversal.

**Selectors**

- Every entity id is a `nanoid()`. Seed deterministic ids (`users`, `posts`) or
  read them back; never hard-code a generated one.
- Context-menu item `data-id` is a fresh nanoid per render. Select menu items by
  their text.
- `HighLevelTable` is named `table high-level-table`, so `.table[data-id]`
  silently changes meaning below `zoomLevel <= 0.7`. Tell the modes apart by
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

- `hasAppleDevice()` is refined asynchronously once `getAccurateAgent` resolves,
  and it decides `isMod` for _mouse_ paths. Keyboard paths are safe
  (`ControlOrMeta` matches tinykeys' synchronous check). For a mouse modifier
  read `erd.pointerModKey()`, which asks the page's own user agent; `MOD_KEY` is
  the flat `'Control'` the pinned Desktop Chrome device implies, for gestures
  that hold the key across several events.
- `toJson()` — which backs the `value` getter — mutates settings when
  `ignoreSaveSettings` bits are set. Every seed keeps it at `0`; leave it there.
- Clipboard copy/paste is driven by native `ClipboardEvent`s on the shadow-root
  `.root` div, with bubble-phase listeners. Dispatching at `document` or at the
  host element will not reach them.
