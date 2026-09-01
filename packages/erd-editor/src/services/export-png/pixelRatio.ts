/**
 * The longest side a browser canvas will hold. The schema lets a canvas box run
 * to CANVAS_SIZE_MAX, which is 20000, so a document written near that ceiling
 * asks for a raster wider than any canvas and the export produces no file.
 */
export const CANVAS_SIDE_MAX = 16_384;

/**
 * The ratio that keeps a raster of that box inside what a canvas can hold.
 * Resolution is what gives: a smaller image of the whole document is worth
 * more than no file at all.
 *
 * @example
 * fitPixelRatio(1, 20000, 20000);
 */
export function fitPixelRatio(
  pixelRatio: number,
  width: number,
  height: number
): number {
  const side = Math.max(width, height);
  return side > 0 ? Math.min(pixelRatio, CANVAS_SIDE_MAX / side) : pixelRatio;
}
