/** The height of one palette row, which the list lays out every row at. */
export const PALETTE_ROW_HEIGHT = 45;

/** The tallest the list stands before it scrolls. */
export const PALETTE_LIST_MAX_HEIGHT = 400;

/** How tall the list stands for so many rows: all of them, up to its tallest. */
export const paletteListHeight = (count: number) =>
  Math.min(PALETTE_LIST_MAX_HEIGHT, count * PALETTE_ROW_HEIGHT);
