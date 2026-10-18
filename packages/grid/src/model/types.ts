/** One cell, by its row index and its column index, both from zero. */
export interface CellRef {
  row: number;
  col: number;
}

/** A rectangle of cells, inclusive on both ends, with start <= end on both axes. */
export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** Every selected range, in the order they were made; active is the anchor of the last one. */
export interface GridSelection {
  active: CellRef;
  ranges: CellRange[];
}

/** How many rows and columns the grid has. */
export interface GridBounds {
  rowCount: number;
  colCount: number;
}

/** What a host's style hook may set on one cell, over the theme. */
export interface CellStyle {
  background?: string;
  color?: string;
  readonly?: boolean;
}

/** One column the host defines: its id, its header label and its width in CSS pixels. */
export interface ColumnDef {
  id: string;
  label: string;
  width?: number;
  readonly?: boolean;
}
