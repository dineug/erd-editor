---
sidebar_position: 3
---

# Table Editing

It fundamentally offers a user editing experience similar to Excel.  
Editing mode starts with `Enter`.

![demo-table-edit](/img/demo-table-edit.webp)

## Adding Columns

Created using the shortcut `Alt + Enter`.

## Tab Key

Allows direct entry into the next cell's editing mode using `Tab`.  
Creates a new column in the last cell.  
Use `Shift + Tab` to navigate to the previous cell's editing mode.

![demo-table-tab](/img/demo-table-tab.webp)

## Selecting Multiple Columns

Supports four methods:

- `Shift + Arrow Up/Down`
- `Ctrl + Click`
- `Shift + Click`
- `Alt + A`: Select All

![demo-column-select](/img/demo-column-select.webp)

## Rearranging and Moving Columns

Functions when `dragging`, enabling movement to other tables.

![demo-column-move](/img/demo-column-move.webp)

Supports moving multiple columns with `Ctrl + drag`.

![demo-column-multi-move](/img/demo-column-multi-move.webp)

## Column Deletion

Deletes the currently selected column.  
Shortcut: `Alt + Backspace` or `Alt + Delete`

![demo-column-remove](/img/demo-column-remove.webp)

## Copying/Pasting Columns

Operates like a table-based clipboard.  
Shortcuts: `Ctrl + C`, `Ctrl + V`

Can paste from the editor to Excel or vice versa.  
However, for specific columns, true/false are supported as follows (case insensitive):

- AutoIncrement: `TRUE`, `1`, `YES`, `Y`
- Unique: `TRUE`, `1`, `YES`, `Y`
- Not Null: `TRUE`, `1`, `YES`, `Y`, `NOT NULL`

![demo-copy-column-to-sheet](/img/demo-copy-column-to-sheet.webp)
![demo-copy-sheet-column](/img/demo-copy-sheet-column.webp)

Supports actions when selecting multiple tables.

![demo-copy-column-multi](/img/demo-copy-column-multi.webp)

## Column Primary Key

Possible through the table context menu or shortcut `Alt + K`.

![demo-column-pk](/img/demo-column-pk.webp)
