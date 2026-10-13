<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-13 | Updated: 2026-10-13 -->

# explorer

## Purpose

`src/components/explorer/` holds the Explorer: a read-only tree of the document docked left of the ERD canvas, which narrows the canvas rather than covering it, and jumps to what a row stands for. This file holds the rules for its panel, its state, its tree and where a row goes. The tree component is `src/components/primitives/tree/Tree.tsx` (`src/components/primitives/AGENTS.md`, The tree), the jump rule is `src/components/erd/goToErdTarget.ts` (`src/components/erd/AGENTS.md`, The jump rule), and the viewport the canvas is left with is `src/components/erd-editor/viewportLayout.ts`. The owner decisions of 2026-10-13 behind it are recorded here.

## Key Files

| File | Description |
| --- | --- |
| `explorerView.ts` | `explorerViewOf(store)`: the observable state per editor (`open`, `zenReveal`, `width`, `expanded`, `activeId`); `explorerScrollOf(store)`, the unobserved scroll position |
| `explorerCommands.ts` | `openExplorer`, `closeExplorer`, `toggleExplorer`, `setExplorerWidth`, `isExplorerPressed`, `isExplorerShown` |
| `explorerTree.ts` | `buildExplorerTree`: the document as `TreeNode<ExplorerNode>`s, its folders, order and counts |
| `explorerNavigation.ts` | `targetOf` and `activateNode`: where a row goes, and the light a foreign key leaves |
| `Explorer.tsx` | The shell: the panel at the width the layout reaches, or nothing, and the keyboard handed back when it goes |
| `explorer-panel/ExplorerPanel.tsx` | The panel: its header, the tree, each kind of row, the keys it keeps and its edge |

## Rules

### The panel

- **It narrows the canvas, never covers it.** `viewportLayout.ts` takes the reach, the panel's width, from the root before the viewport: none while it is closed, off the ERD tab, under a takeover or hidden by zen mode, and none where the canvas would keep less than 320 px (`EXPLORER_CANVAS_MIN_WIDTH`) beside the panel's least, 200 px. It stays open while it stands aside, and comes back as the root widens. Opening it moves no origin and writes no history.
- **It starts closed at 260 px**, sized from its edge between 200 and 480 px, 260 again on a double press. The edge reads the pointer against the panel's left, so a drag past either end and back does not drift.
- **Its state lives as long as the element** (`explorerViewOf`), never in the store, the file, the history, a peer or `localStorage`, so a tab change keeps it. The scroll position stays unobserved (`explorerScrollOf`), so a scroll renders nothing outside the tree.
- **The toolbar button stands where Find stood** (`panel-left`, `toggleExplorer`). It shows pressed while the panel is open on the ERD tab, a panel a narrow root stands aside included, and a press closes it. On another tab a press takes the ERD tab and opens it, never closes it (owner decisions of 2026-10-13). It is disabled under a takeover.
- **Zen mode hides it as it comes on.** An opening during zen mode shows it and leaves zen on (`zenReveal`), and zen mode coming on again hides it again (an owner decision of 2026-10-13).
- **It stands on the physical left in every language.** The ERD tab's row is `dir="ltr"` with the canvas's own scope taking the reader's direction back; the panel's root does too, and keeps its border and edge on the physical right.
- **Escape inside it hands the keyboard to the canvas** (`forceFocusEvent`) and leaves it open and the selection as it was. Its keydown stops the chords the canvas would read as an edit (`stopsAtPanel`); any other press goes on.
- **A panel that goes with the keyboard in it hands the keyboard back** with `focusEvent`. The shell reads a flag it keeps unobserved before it renders nothing, rather than wait for a focusout the browser may not send.
- **The theme builder and the locale picker stand past it** left to right (`insetPastExplorer`); right to left they keep their place at the other end.

### The tree

- **Folders: Tables, Table Groups and Memos; under a table, Columns, Indexes and Foreign Keys.** No root row and no database name. A folder holding nothing is not shown, nor are the groups or the memos while View Option hides them.
- **Order:** tables and groups by name, any case, ties as the document has them; a table's columns, indexes and foreign keys as the document has them (an owner decision of 2026-10-13); memos as the document has them.
- **Rows:** a folder by its glyph, name and a muted count; a column by a key glyph (`--explorer-primary-key`), a link (`--explorer-foreign-key`) or a list glyph, its name and its muted type with `PK` or `FK`; an index by `name UNIQUE (columns, DESC where so)`; a foreign key, shown under its child table alone, by `columns → parent(columns)`; a group by its colour dot and name, with its tables as rows that go to them and fold to nothing; a memo by its first line. A blank name reads `common.unnamed`. Every glyph is a literal in its own branch, which `icons.test.ts` reads.
- **The tree is built and laid out by two observers of its own** in the panel: one builds the roots from what the document holds, the other lays out the rows from the roots and the folding. A move, a selection, a hover, a zoom, an arrow key, a scroll or a drag of the edge does neither (`ExplorerPanel.browser.test.tsx`). A table's own folders are built only once it is expanded.
- **Folding is kept by node id**, and so is the row the keyboard is on, so an edit or a peer's batch moves neither. Node ids: `f:<folder>`, `t:<table>` and `t:<table>/f:<folder>`, `c:`, `i:`, `r:<relationship>`, `g:<group>` and `g:<group>/t:<table>`, `m:<memo>`.
- **Nothing in the tree edits the document.** No rename, drag, delete or show toggle.

### Where a row goes

- **A click or Enter jumps; the arrows only move in the tree.** A folder folds and unfolds. A table, an index and a group's table select the table alone; a column rings its name cell; a memo is selected; a group is selected alone. Table Properties closes first (an owner decision of 2026-10-13).
- **A foreign key shows its two tables and lights its relationship** (`relationshipHighlight.ts`), with the selection cleared, since nothing selects a relationship (owner decisions of 2026-10-13). The light goes out on the next jump from the tree and on a press that changes the selection.

## Testing Requirements

- `explorerTree.test.ts`, `explorerNavigation.test.ts`, `explorerCommands.test.ts` and `explorerView.test.ts` seed the document in `src/__test-utils__/explorerSeed.ts`.
- `explorer-panel/ExplorerPanel.browser.test.tsx` mounts the shell in a shadow root with the styles adopted, and counts the builds and layouts through `vi.mock` of `explorerTree` and `treeModel`.
- `e2e/specs/explorer.spec.ts` checks the panel in the element: the widths, a click and the keys, the edge, a right-to-left language and a narrow window.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
