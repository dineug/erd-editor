<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# primitives

## Purpose

`src/components/primitives/` holds the editor's shared controls: `button/`, `context-menu/`, `dialog/`, `icon/`, `select/`, `slider/`, `toast/`, `tree/` and others. This file holds the rules for the color picker in `color-picker/`, for removing a color, for the native list in `select/Select.tsx`, and for the virtualized tree in `tree/`. Other nested files touch the same features: `src/components/erd/AGENTS.md` (the table, memo and group menus that hold Color and Remove color) and `src/components/explorer/AGENTS.md` (the panel whose key handling the picker follows). The users of `Select.tsx` have their own files: `src/components/schema-sql/AGENTS.md`, `src/components/generator-code/AGENTS.md` and `src/components/map-columns/AGENTS.md`. A change here keeps the owner decisions of 2026-10-05 on the picker and the undo grouping of a color change.

## Making a Change

1. **Read the files on the other side.** A change to Color or Remove color in a menu reads `src/components/erd/AGENTS.md`. A change to the chords the picker passes or cancels reads `src/components/explorer/AGENTS.md`, since the picker handles keys as the Explorer does. A change to `Select.tsx` reads the files of its three users (Purpose). A change to `changeColorAllAction$`, `removeColorAllAction$` or the stream regroup reads `src/engine/AGENTS.md`.
2. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. The specs under Testing Requirements run in that test task, each `*.browser.test.{ts,tsx}` in real Chromium.
3. **Run the e2e suite for visible changes.** `e2e/specs/table-color.spec.ts` drives the picker from a table's color edge and Remove color from the table and memo menus. `pnpm --filter @dineug/erd-editor e2e` builds the package and runs every Playwright spec, this one included.
4. **Change a rule and its spec together.** The keys the picker passes or keeps are pinned in `ColorPicker.test.ts` and in `Erd.test.ts`'s `Erd - color picker`. The chevron's place and paint are pinned in `Select.browser.test.ts`, and Map Columns' 2 px ring in `MapColumnsDialog.browser.test.tsx`.

## Key Files

| File | Description |
| --- | --- |
| `color-picker/ColorPicker.tsx` | The picker: its panel, the No color row, the pipette (`EYEDROPPER_DEAD_MS`) and its key handling |
| `color-picker/ColorPicker.styles.ts` | The picker's styles, scoped `css` alone |
| `color-picker/colorModel.ts` | The picker's own state, with hue and saturation kept unrounded |
| `color-picker/presetColors.ts` | The sixteen presets, the light step 9 of `Palette` |
| `color-picker/resolveColor.ts` | `resolveColor`: `toOpaqueHex` first, then any color the browser reads through a canvas |
| `color-picker/ColorPicker.test.ts` | Mounts the real picker |
| `select/Select.tsx` | The box around a caller's native `<select>`, with lucide's `chevron-down` at its inline end |
| `select/Select.browser.test.ts` | The chevron's place, the ellipsis, the dimming, the focus ring and forced colours, in real Chromium |
| `dialog/Dialog.tsx` | The shared modal; its contract is in `src/components/export-image/AGENTS.md` |
| `tree/Tree.tsx` | The virtualized tree, written here with no library: fixed rows (`TREE_ROW_HEIGHT`, 22), `TREE_OVERSCAN` (8), the tree keys and the WAI-ARIA tree roles |
| `src/utils/virtualRange.ts` | `visibleRange`, `offsetToShow` and `VIRTUAL_OVERSCAN` (8), which the tree and the palette's list share |
| `tree/treeModel.ts` | `TreeNode` (children asked for only while expanded), `flattenTree`, `moveFocus` |
| `src/utils/keyboard-shortcut/index.ts` | `stopsAtPanel`, the filter a tree's host stops presses with |
| `src/engine/modules/editor/generator.actions.ts` | `changeColorAllAction$` and `removeColorAllAction$` |
| `src/engine/modules/editor/utils/color.ts` | `hasColoredSelection` and `getDocumentColors` |
| `src/engine/actions.ts` | `StreamRegroupColorActionTypes` |
| `src/utils/tableColor.ts` | `toOpaqueHex` |
| `src/themes/radix-ui-theme.ts` | `Palette`, whose light step 9 the presets take |
| `src/styles/reset.styles.ts` | Takes the outline off buttons and fields |
| `src/components/erd/Erd.tsx` | `openColorPicker`'s remount and `handleColorPickerShortcut` |
| `src/i18n/messages/en/colorPicker.ts` | The `colorPicker.*` text |

## Rules

### Removing a color

- **No color and Remove color dispatch one action.** The picker's No color row and Remove color in the table, memo and group menus both dispatch `removeColorAllAction$`. No color is the last row of the picker's panel (`color-picker/ColorPicker.tsx`), whichever bar or menu opened it.
- **It clears the selection in one stream group.** It clears every selected table, memo and table group that has a color, in one stream group, so it is one undo. It sends nothing for one without a color.
- **Remove color shows only for a colored selection.** It shows under Color only while the selection holds a color (`hasColoredSelection`, `src/engine/modules/editor/utils/color.ts`), an owner decision. It has no icon.
- The menu rows themselves: `src/components/erd/AGENTS.md`.
- **No color also closes the picker.** Otherwise the picker would show the color just cleared.
- **A color already there sends nothing.** `changeColorAllAction$` likewise sends nothing for a table, memo or table group whose color is already that string. So a color pressed again adds no undo entry, while one an undo took back is painted again.
- **The comparison ignores letter case.** So a `#3B82F6` the old picker wrote counts as the picker's `#3b82f6`. A `#3b82f680` or an `rgb()` is still painted.

### What the picker holds

- **The picker is the editor's own.** `color-picker/` uses no color library. These are owner decisions of 2026-10-05:
  - its layout, after uiwjs/react-color's Sketch;
  - no alpha;
  - Radix step 9 presets;
  - a row of the document's colors;
  - a pipette only where the browser has one.
- **Its panel holds six parts, from the top.**
  - A saturation and brightness area.
  - A row of the pipette, the hue slider and a preview.
  - Hex, R, G and B fields.
  - Sixteen presets in two rows of eight.
  - Up to eight colors the document's tables, memos and table groups carry, under a Document colors caption shown only when there is one.
  - No color.
- **The presets are light step 9 values.** `presetColors.ts` takes the light step 9 of `Palette` in `src/themes/radix-ui-theme.ts`, since a document's color is the same under either theme.
- **Document colors are read once, as it opens.** `getDocumentColors` (`src/engine/modules/editor/utils/color.ts`) orders them most used first. A tie goes in the order they first appear: tables, then memos, then groups.

### Reading a color

- **`resolveColor` reads what the picker opens on.** It also reads text committed in the Hex field (`resolveColor.ts`). It tries `toOpaqueHex` first (`src/utils/tableColor.ts`): a hex of 3, 4, 6 or 8 digits, `rgb()`, `rgba()`, `hsl()` or `hsla()`, any alpha dropped.
- **Then it reads any color the browser reads.** This is an owner decision (2026-10-05). It sets a canvas 2d `fillStyle` over two grounds, and a value the canvas cannot read leaves each ground as it was.
  - A name such as `red`, an `hwb()` or a system color is read by the hex or `rgba()` the canvas writes back.
  - A color the canvas writes back in its own syntax is read by the sRGB pixel it paints on a blank canvas. `oklch()`, `lab()`, `lch()`, `oklab()` and `color()` come back as they are, and `color-mix()` and a relative color as a `color()`.
  - A translucent one drifts by up to one in a channel, since that pixel is stored premultiplied.
- **Some colors show no value.** An empty color, one neither reads, and one the canvas writes back in its own syntax that paints fully transparent show no value and check no swatch. A hex, `rgb()` or `hsl()` with zero alpha, and `transparent`, show their opaque channels.
- **Opening writes nothing.** A name stays in the document until a change in the picker writes its hex.
- **Two readers take `toOpaqueHex`'s forms alone.** The document colors row and the DBML and AML exports read only those forms, so a name is left out of both.

### Handing a color on

- **`onChange` gets an opaque lower-case `#rrggbb`.** The picker keeps hue and saturation unrounded in its own state (`colorModel.ts`), since a gray's channels hold no hue and black's no saturation either.
- **Continuous input hands on only a changed hex.** A drag, a slider's key step or a hex typed whole hands a color on only when the hex changes. A hex typed whole is six or eight digits, applied as it is typed.
- **A discrete input always hands a color on.** A press, a swatch, a committed field or the pipette always does. `changeColorAllAction$` (Removing a color) turns that into nothing for a color already there.
- **A field commits only changed text.** A field shows what is typed until Enter, its change or its blur. Enter or its change commits the text only when it differs from what the field showed. So a field left alone sends nothing, and text that reads as no color gives way to the color again.
- **A color change is a stream action.** It is listed in `StreamRegroupColorActionTypes`, so a drag, a held key or a run of swatch steps undoes as one entry until 200 ms pass without a change.

### Opening and the document

- **It reads `color`, `x` and `y` once.** It reads them as it mounts. `openColorPicker` on a picker already up closes it and mounts it again on the next tick (`Erd.tsx`).
- **Nothing the document does meanwhile reaches it.** That covers an undo from the toolbar or from the key it passes on, a peer's edit and an agent's. So it can show a color the selection no longer has, which a press paints again.

### The pipette

- **The pipette shows where `EyeDropper` exists.** It goes for the rest of that opening once it fails with an `OperationError`. It also goes on an `AbortError` it did not ask for within `EYEDROPPER_DEAD_MS` (150 ms), which is how an embedder with no chooser behind the API answers.
- **The pipette hands its focus to the hue.** It does so as it goes, if it held the focus.
- **Closing the picker aborts the pipette.**

### Keys, focus and closing

- **The picker takes the keyboard and returns it.** It takes the keyboard as it opens. It hands it back with `focusEvent` on the tick after it unmounts, however it closes.
- **Escape inside the picker closes it.** `stop` (Escape) pressed inside it closes it, prevented and stopped, so the selection stays.
- **An Escape the editor root hears closes it.** It closes on an Escape `shortcut$` hears, unless another handler takes that press (`handleColorPickerShortcut`, `Erd.tsx`). Those handlers are the palette, a cell, memo or group name editor, and a relationship or table group draw.
- **Escape spent outside `Erd` first keeps it open.** An Escape that a panel outside `Erd` spends first leaves the picker open. The Explorer's own Escape, which hands the keyboard to the canvas, is one of them.
- **`removeSelection` or `removeTable` closes it.** Either may just have taken what the picker paints. Each press still does what it does (`handleColorPickerShortcut`, `Erd.tsx`).
- **A press elsewhere in `Erd` closes it.** `Erd.tsx` and `ErdViewer.tsx` tell a press inside it by its root class `color-picker`.
- **A chord stops at the panel.** A keydown inside stops at the panel when it is a `keyBindingMap` chord outside `PANEL_PASSING_BINDINGS`, or an arrow or Tab, as in the Explorer. So Space and Enter press a button rather than reach the hand tool and `edit` bindings.
- **Such a chord is also cancelled.** It is cancelled as the editor root cancels it, so a host page neither scrolls nor selects all. A field and a button's Space or Enter are the exceptions.
- **Some chords still reach the editor.** Undo, redo, search, Find and Replace and the zoom still reach the editor, and none of them closes the picker.
- **Tab goes round inside it.** Each swatch group is one stop whose arrows move and select as radio buttons do.
- **Other events stop at it.** A wheel is spent on it. A contextmenu, a touchstart, a copy or a paste stops there; a field keeps the browser's contextmenu.

### Look and language

- **Every control shows its focus in `--input-active`.** It is a `:focus-visible` ring or a field's `:focus` border, since `src/styles/reset.styles.ts` takes the outline off buttons and fields.
- **Its styles are scoped `css` alone.** They live in `ColorPicker.styles.ts`.
- **Its root is `dir="ltr"`.** So the area, the hue and the fields keep their places under a right-to-left language. Its screen reader text and preset names are translated (`colorPicker.*`).
- Dictionary keys and text direction: `src/i18n/AGENTS.md`.

### The native list

- **A native list goes in `select/Select.tsx`.** The Schema SQL and Code Generator panels and Map Columns use it. The browser's own arrow sat against the list's end, nearer it than the value stood to the start (the owner's report on 2026-10-10).
- **The caller writes the `<select>`.** The caller writes the `<select>`, its options, name and change as the children. It sets only the box's width.
- **The box draws a lucide chevron instead.** The box turns the browser's arrow off and lays lucide's `chevron-down` (14 px, coloured by `color`) over the list's inline end. Its ink stands 8.9 px past the border, where a value's first letter stands past its 8 px padding on the other side.
- **The value stops short of the chevron.** It is ellipsized 26 px short of the list's inline end.
- **A press on the chevron reaches the list.** The chevron lets the press pass through.
- **Right-to-left puts the chevron on the left.** That is the list's inline end under a right-to-left reader.
- **The chevron is dimmed with the value.** `dimmed` or a disabled list dims both. In forced colours the chevron is `FieldText` (`Select.browser.test.ts`).
- **The list's focus ring stands 1 px off.** That is how the panels ring their other controls.
- **Map Columns rings its lists 2 px off.** That is how it rings its buttons. A doubled class in `MapColumnsDialog.styles.ts` outweighs the box's rule (`MapColumnsDialog.browser.test.tsx`).

### The tree

- **The tree virtualizes its own rows.** Rows are one fixed height, so `visibleRange` works the rows in view out of the scroll offset and the tree's height, with `TREE_OVERSCAN` either side, and the active row is drawn wherever it stands, so `aria-activedescendant` names a node that is there. No virtual list library is used (an owner decision of 2026-10-13); the palette's list draws on the same range (`src/utils/virtualRange.ts`). A host builds `TreeNode`s and passes the rows `flattenTree` gives it; the Explorer and the diff viewer draw through the same component.
- **The tree holds no policy.** It answers Up, Down, Home, End and the inline arrows (`moveFocus`, mirrored under `dir="rtl"`), and Enter and Space, which ask the host to activate. It prevents those keys alone and passes every other press, Escape and every chord included. Its host decides what a row shows (`renderRow`), what activating it does, and which chords stop at it (`stopsAtPanel`).
- **The keyboard's row looks like the pointer's** (the owner's request of 2026-10-14). While the tree holds the keyboard, the active row takes the hover fill and `--active` text, as a hovered row and a context menu row do, and the current row keeps its own fill; in forced colours it is outlined in `Highlight`. A keyboard focus (`:focus-visible`) with no row active makes the current row active, or else the first row wholly in view; a press's focus makes none, since its click picks the row.
- **Only a new range renders the tree.** The scroll offset and the height are kept unobserved, and a scroll writes the observed range only when its first or last row changes, so a scroll inside the overscan changes no DOM. Rows are keyed by node id in `repeat`, so a row that stays in view keeps its element.
- **It scrolls with the `scrollbar` hook class** (`src/styles/scrollbar.styles.ts`), the thin bar the other scrolling panels draw (the owner's request of 2026-10-14).
- **The scroll position is read through a getter.** `getScrollTop` is read once in `onMounted`, and `onScroll` reports each new offset. A host keeps it in an unobserved place, so a scroll renders nothing outside the tree (`Tree.browser.test.tsx`).
- **A reveal scrolls once per id.** `revealId` scrolls its row into view (`offsetToShow`) each time a different id arrives, after the render that brought it.
- **The tree tokens are its own** (`treeBackground` gray-1, `treeRowHover` gray-3, the keyboard's row too, `treeRowCurrent` accent-4, `treeMuted` gray-11, `treeMatch` accent-5). `radix-ui-theme.test.ts` holds the muted text at 4.5:1 on the tree and each row fill in every theme, and the key glyphs the Explorer draws at 3:1.
- **Two hosts draw it**: the Explorer (`explorer-panel/ExplorerPanel.tsx`) and the diff tree (`erd/diff-viewer/diff-tree/DiffTree.tsx`), which `src/components/treeShared.test.ts` holds to the one component. The diff status letters keep 4.5:1 on the tree and under the pointer, but for the measured light hover green and blue at 4.1 (`radix-ui-theme.test.ts`).

### Other primitives

- The shared modal `dialog/Dialog.tsx`, which the Export image dialog and Map Columns are built on: `src/components/export-image/AGENTS.md` (Rules, The shared modal).
- The icons in `icon/icons.ts` and how an icon is coloured: `src/components/AGENTS.md` (Icons).
- The separator in `context-menu/context-menu-separator/`: `src/components/generator-code/AGENTS.md`.

## Testing Requirements

- `ColorPicker.test.ts` mounts the real picker.
- `Erd.test.ts`'s `Erd - color picker` presses the picker's keys through `useKeyBindingMap` mounted around `Erd`, the path a real key takes to `shortcut$`.
- `Select.browser.test.ts` holds the chevron and the value to their places in real Chromium, under both text directions and in forced colours.
- `MapColumnsDialog.browser.test.tsx` holds Map Columns' 2 px ring on its lists.
- `Tree.browser.test.tsx` lays the tree out in real Chromium, counts the DOM mutations a scroll makes; `src/utils/virtualRange.test.ts` holds `visibleRange` and `offsetToShow`; `treeModel.test.ts` covers the rows and the keys.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
