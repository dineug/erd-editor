# grid

> A spreadsheet grid on a Konva canvas, for `@dineug/r-html`

The grid draws a host's rows on a Konva `Stage` through [`r-html-konva`](../r-html-konva) and keeps
none of them: the host gives it a row count, the columns and a `getCell(row, col)` getter, and a
draw reads only the cells in view, so what a frame costs follows the cells on screen, not the rows
behind them. Each of six regions (the corner, the column header, the frozen column header, the
row-number header, the frozen cells and the scrolling cells) is one `k-shape` that paints its
cells. A cell holds one line of left-aligned text, cut by an ellipsis through
[`@chenglou/pretext`](https://github.com/chenglou/pretext); a column label, cut the same way, and a
row number sit centred. An overlay layer draws the selection, the header highlights and the
scrollbars. It is private, not on npm, and depended on as `"@dineug/grid": "workspace:*"`;
[`erd-editor`](../erd-editor) lists it in `devDependencies` and imports nothing from it yet.
`konva` is a peer: the consumer supplies the one copy.

## Usage

`src/index.ts` exports the two default themes, `lightTheme` and `darkTheme`, and the types a host
builds on: `GridTheme`, `CellRef`, `CellRange`, `GridSelection`, `GridBounds`, `CellStyle`,
`ColumnDef`, `CellGetter`, `CellStyleGetter`, `VisibleRange`, `FontMetrics`, and the scene's
`SceneInit`, `SceneState`, `SceneData`, `SceneLayout`, `SceneRect` and `ColumnResize`.

```ts
import { type CellGetter, type ColumnDef, type GridTheme, lightTheme } from '@dineug/grid';

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', width: 160 },
  { id: 'type', label: 'Type', readonly: true },
];
const getCell: CellGetter = (row, col) => rows[row][columns[col].id];
const theme: GridTheme = { ...lightTheme, selectionBorder: '#0090ff' };
```

A theme is fifteen CSS colours, and a host maps its own onto them: `selectionFill` keeps an alpha
channel so the cells show through, and the header highlights stay opaque. A column with no `width`
takes 120px, and none draws under 24px. A cell's style hook may set its `background`, its text
`color` and `readonly`. The `Grid` component, which mounts the canvas under a native scroller and
takes pointer, keyboard, clipboard and editing input, comes in a later change; until then only the
package's own specs and its demo page mount the scene.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/grid --fail-if-no-match test
pnpm --filter ./packages/grid --fail-if-no-match test:coverage
pnpm --filter ./packages/grid --fail-if-no-match test:dev
pnpm --filter ./packages/grid --fail-if-no-match dev
pnpm --filter ./packages/grid --fail-if-no-match bench
pnpm --filter ./packages/grid --fail-if-no-match bench:typecheck
pnpm exec vp run --filter ./packages/grid --fail-if-no-match build
```

Only `test` runs `tsc --noEmit` before Vitest; its `browser` project runs in headless Chromium.
`dev` builds the packages the grid depends on and serves `index.html`, the demo page. `bench`
scrolls that page in Playwright and prints what each frame's work took, outside `pnpm test` and CI,
with no baseline and no gate. The rules for changing the package, and the checks a change runs,
are in [AGENTS.md](./AGENTS.md).
