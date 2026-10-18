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

`src/index.ts` exports `Grid`, the r-html component, with its `GridProps`, `GridColumn`,
`GridHandle`, `CommitEvent` and `EditorContext`; the two default themes, `lightTheme` and
`darkTheme`; and the types a host builds on: `GridTheme`, `CellRef`, `CellRange`, `GridSelection`,
`GridBounds`, `CellStyle`, `ColumnDef`, `CellGetter`, `CellStyleGetter`, `VisibleRange`,
`FontMetrics`, and the scene's `SceneInit`, `SceneState`, `SceneData`, `SceneLayout`, `SceneRect`
and `ColumnResize`.

```tsx
import { type FC, observable, render } from '@dineug/r-html';
import { Grid, type GridColumn, type GridHandle, type GridTheme, lightTheme } from '@dineug/grid';

const columns: GridColumn[] = [
  { id: 'name', label: 'Name', width: 160 },
  { id: 'type', label: 'Type', readonly: true },
];
const theme: GridTheme = { ...lightTheme, selectionBorder: '#0090ff' };
const getCell = (row: number, col: number) => rows[row][columns[col].id];

const Words: FC = () => {
  const state = observable({ columns, version: 0 }, { shallow: true });
  let grid: GridHandle | null = null;

  return () => (
    <Grid
      rowCount={rows.length}
      columns={state.columns}
      getCell={getCell}
      version={state.version}
      theme={theme}
      frozenColumns={1}
      ariaLabel="Words"
      onCommit={({ changes }) => {
        applyChanges(changes);
        state.version++;
      }}
      onColumnResize={(col, width) => {
        state.columns = state.columns.map((column, index) =>
          index === col ? { ...column, width } : column
        );
      }}
      onSelectionChange={selection => console.log(selection.active, selection.ranges)}
      onCellContextMenu={({ row, col, clientX, clientY }) => openMenu(row, col, clientX, clientY)}
      onReady={handle => {
        grid = handle;
        grid.focus();
      }}
    />
  );
};

render(host, <Words />);
```

`host` is any sized element, and `rows`, `applyChanges` and `openMenu` are the host's own. The
handle's `grid.scrollTo(row, col)` scrolls the least distance that shows a cell, and
`grid.select({ active, ranges })` moves the selection without `onSelectionChange` echoing it back.

The grid fills the element it is mounted in and follows its size. It draws the cells in view
under a transparent native scroller, which takes the wheel, the trackpad and touch scrolling, and
draws its own scrollbars. A press, a drag, Shift and Ctrl (Cmd on a Mac) select as a spreadsheet
does, from the cells, the headers and the corner; the arrows, Home, End, PageUp, PageDown, Tab,
Shift+Enter and Ctrl+A move the selection from a hidden textarea that holds the focus. A header
edge drags to resize its column, and a double click fits it to the rows in view; the grid reports
the width through `onColumnResize` and the host keeps it in `columns`, or the column goes back.
Raise `version` once the data has changed, and the cells in view are read again.
`onViewportChange` reports the rows and columns in view once a frame. With `onCellContextMenu`, a
right click on a cell opens no browser menu and hands the host its cell and point, and a menu the
keyboard opens does the same for the active cell; without it, the browser's menu opens as usual.

The grid changes no cell itself: every edit, paste or clear reaches the host as one
`onCommit({ changes, source })`, each change naming its row, column, column id and value, and the
host applies it and raises `version`. Enter, F2 and a double click turn the hidden textarea into the
editor over the cell, holding its value on one line as the cell draws it; typing on the active
cell replaces the value, an IME composition included. Enter and Tab commit and move down or right
(Shift goes back), a press anywhere else or the focus leaving commits, and Escape cancels.
Delete and Backspace clear every
selected range. Copy writes the selection as tab-separated `text/plain`, several ranges only when
they share their rows or their columns (else `onReject({ reason: 'multi-range-copy' })`); paste
reads `text/plain` into the cells from the active one, fills every range from a one-cell clipboard,
keeps the rows past the last for the host to add, and drops the columns past the last with
`onReject({ reason: 'paste-beyond-columns' })`. A read-only cell takes no edit, paste or clear. A
column's `editor(ctx)` opens in place of the textarea: the host renders into `ctx.container`, placed
over the cell, with the cell's `rect`, the `mode` and the `initialValue` to start from, and answers
with `ctx.commit(value)` or `ctx.cancel()`. `ctx.onClose` hands it `'escape'` or `'outside'` when
Escape or a press outside asks it to close, and the grid waits for that answer; the host removes
what it rendered. Every other key, Ctrl+Z among them, reaches the host.

A theme is fifteen CSS colours, and a host maps its own onto them: `selectionFill` keeps an alpha
channel so the cells show through, and the header highlights stay opaque. A column with no `width`
takes 120px, and none draws under 24px. A cell's style hook may set its `background`, its text
`color` and `readonly`, and the grid's own editor opened on the cell takes its colours.

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
