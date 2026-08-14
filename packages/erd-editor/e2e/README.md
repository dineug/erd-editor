# erd-editor e2e

Playwright suite for the interaction surface that `vitest` + `happy-dom` cannot
check faithfully: real hit-testing, real layout, real event ordering, and the
keyboard/mouse gestures built on top of them.

```bash
pnpm --filter @dineug/erd-editor e2e            # headless run
pnpm --filter @dineug/erd-editor e2e:dev        # Playwright UI mode
pnpm --filter @dineug/erd-editor e2e:headed     # watch it drive a real browser
pnpm --filter @dineug/erd-editor e2e:typecheck  # tsc over e2e/ + playwright.config.ts
```

`pnpm test` stays vitest-only. E2E is its own Nx target and its own CI job, so a
missing browser binary can never turn the unit suite red.

## Layout

| Path                           | What it is                                                     |
| ------------------------------ | -------------------------------------------------------------- |
| `playwright.config.ts`         | Chromium project, pinned 1440x900 viewport, Vite `webServer`   |
| `e2e/fixture/`                 | The page under test — a deterministic `<erd-editor>` mount     |
| `e2e/support/schema.ts`        | Hand-authored v3 seed documents and the schema bit constants   |
| `e2e/support/shortcuts.ts`     | Key strings mirroring `createKeyBindingMap()`                  |
| `e2e/support/ErdEditorPage.ts` | Page object: locators, coordinate math, gesture helpers        |
| `e2e/support/fixtures.ts`      | The `test` object every spec imports; fails on uncaught errors |
| `e2e/specs/harness.spec.ts`    | Guards the assumptions below — fix this first if it goes red   |

## The five things that make this suite work

### 1. The shadow root is `closed`, and the fixture reopens it

`ErdEditor.ts` declares `shadow: 'closed'`, so Playwright locators,
`document.querySelector` and the accessibility tree all stop at the host
element. `e2e/fixture/index.html` patches `Element.prototype.attachShadow` to
force `mode: 'open'` **before** the editor module registers the custom element.

This is the fixture's one deliberate deviation from production. It changes
reachability only — no editor behaviour depends on the mode flag. Production
code and the published bundle are untouched.

### 2. The minimap re-renders the canvas, so every canvas locator is scoped

`Minimap.ts` renders its own `<Table>` for every table, reusing the same styles.
A bare `.table` locator therefore matches **twice per table**. `Canvas.ts`
carries `data-testid="erd-canvas"`, which the minimap does not, and
`ErdEditorPage` scopes all canvas locators through it. Reach for
`erd.host.locator(...)` only when you deliberately want both copies.

### 3. Deletes are LWW tombstones — assert through `doc`, never `collections`

Removing a table drops its id from `doc.tableIds` but leaves the entity in
`collections.tableEntities` so the change can replicate. Counting collection
keys will tell you nothing was deleted. `ErdEditorPage#tableIds()`,
`#relationshipIds()` and `#memoIds()` read `doc`; use them.

### 4. `el.value` is the authoritative, synchronous state

The element's `value` getter serialises the live store on read. That is what
assertions should compare against — the DOM is a projection of it. Pair a store
assertion with a user-visible one wherever the visible result is meaningful;
a spec that only reads `value` is a unit test wearing a costume.

`setInitialValue()` dispatches straight to the store, so a seeded document
starts with **empty undo history** and fires no `change` event. That is what
makes per-test isolation cheap.

### 5. Gestures must match the pipeline the editor actually listens to

`src/utils/globalEventObservable.ts` merges window-level
`mousedown`/`mousemove`/`mouseup`. Drags therefore need a stepped
`page.mouse.move` sequence (`ErdEditorPage#drag` does this) — a single jump
produces one delta and skips the intermediate states the UI reacts to.

Column reordering is the exception: it uses **native HTML5 drag-and-drop**
(`draggable=true` + `dragstart`/`dragover`), which `page.mouse` cannot drive.
Use `locator.dragTo()` there.

## Gesture cheat sheet

Verified against the running editor, not inferred:

| Gesture                       | What it does                                        |
| ----------------------------- | --------------------------------------------------- |
| plain drag on empty canvas    | **pans** the canvas                                 |
| `$mod` + drag on empty canvas | marquee-selects (`handleDragSelect` checks `isMod`) |
| hold `Space` + drag           | grab-pans, even when the drag starts over a table   |
| drag a table header           | moves it, and every other selected table with it    |
| plain wheel                   | scrolls; `Shift`+wheel scrolls horizontally         |
| `$mod` + wheel                | zooms in 0.03 steps                                 |
| `$mod+Equal` / `$mod+Minus`   | zooms in 0.04 steps                                 |
| double-click a cell           | opens an `<input>`; edits commit as you type        |
| `Escape` while editing        | ends edit mode — it does **not** revert the value   |

## Determinism rules

- **`zoomLevel` maxes out at 1.** The editor starts there, so `zoomIn` is a
  no-op on a fresh page; test zoom by going down first. Minimum is `0.1`.
- **Below `zoomLevel <= 0.7`** tables swap to the simplified high-level render
  and column shortcuts stop working (`isHighLevelTable`). Stay above it unless
  that is the behaviour under test.
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
  microtask hop. Never read state in the same tick as the interaction that
  changed it. (The public element methods — `setInitialValue`, `value =`,
  `clear` — use `dispatchSync` and _are_ synchronous.)
- The outward `change` event is `debounceTime(200)`. It is not an assertion
  target; `el.value` is.
- Relationship side effects land on later ticks: the FK `ui.keys` bit arrives on
  the next channel tick, `identification` / `startRelationshipType` on a 10ms
  trailing throttle, and the relationship's start/end geometry on a 5ms one.
  Poll for all four.
- Column drag-and-drop is `throttleTime(300)` then `debounceTime(50)`. A fast
  `dragTo` lands nowhere — dispatch several spaced moves and dwell over the
  target past ~350ms before releasing.
- Column reorder then plays a 0.3s FLIP transition. Assert the settled
  `columnIds` order or the settled DOM order, never a bounding box taken
  straight after the drop.

**Gestures**

- A drag whose total `|dx| + |dy|` is under **20px** (`MOVE_MIN`) records no
  history entry at all — undo will silently do nothing. Drag well past it.
- Use `keyboard.press('Alt+Space')`, not `keyboard.down`. The Space keydown also
  arms grab-pan, which only disarms on a window-level `keyup`; a stuck Space
  leaves every later drag panning instead of moving.
- A mousedown on the minimap or its viewport handle also clears the table
  selection. Do minimap work before selection assertions, not after.
- The `columnDataType` cell has an autocomplete that `stopPropagation`s Tab,
  Enter and arrows while a hint is highlighted. When traversing through it,
  leave the value empty or press `Escape` first — never type a real type name
  mid-traversal.

**Selectors**

- Every entity id is a `nanoid()`. Seed deterministic ids (`users`, `posts`) or
  read them back from the DOM; never hard-code a generated one.
- Context-menu item `data-id` is a fresh nanoid per render. Select menu items by
  their text.
- `HighLevelTable` reuses `.table[data-id]`, so that locator silently changes
  meaning below `zoomLevel <= 0.7`. Distinguish the modes by whether the table
  contains `.column-row`.
- `cache()` detaches a swapped-out subtree rather than destroying it. Assert
  `toHaveCount(0)`, not `toBeHidden()`.

**Platform**

- `hasAppleDevice()` is refined asynchronously after a `userAgentData` lookup
  resolves, and it decides `isMod` for _mouse_ paths. Keyboard paths are safe
  (`ControlOrMeta` matches tinykeys' synchronous check); for mouse modifiers use
  `MOD_KEY`, which branches on `process.platform`.
- `toJson()` — which backs the `value` getter — mutates settings when
  `ignoreSaveSettings` bits are set. Every seed keeps it at `0`; leave it there.
- Clipboard copy/paste is driven by native `ClipboardEvent`s on the shadow-root
  `.root` div, with bubble-phase listeners. Dispatching at `document` or at the
  host element will not reach them.
