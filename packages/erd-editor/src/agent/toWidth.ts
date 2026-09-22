const TEXT_PADDING = 2;

const CHARACTER_WIDTH = 10;

/**
 * The text width a peer measures with no canvas, the same estimate the
 * replica worker falls back to. A reload recalculates every width, so an
 * estimate written by a headless edit never outlives the next open.
 */
export const defaultToWidth = (text: string): number =>
  Math.round(text.length * CHARACTER_WIDTH) + TEXT_PADDING;
