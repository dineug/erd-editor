/**
 * The largest raster a browser canvas will hold, as area rather than as one
 * side. Chromium and WebKit both stop at exactly this many pixels however the
 * box is shaped, and Firefox stops well above it, so this is the shared floor.
 */
export const CANVAS_AREA_MAX = 16_384 * 16_384;

/**
 * The longest single side, kept at half of the 65535 every engine measured here
 * accepted. The margin is spent on the side rather than the area because no box
 * the schema allows reaches it at one image pixel per canvas unit.
 */
export const CANVAS_SIDE_MAX = 32_767;

/**
 * The side of the largest square that fits the area, which is what the ratio is
 * measured against. Dividing the two roots rather than rooting the quotient is
 * what makes a square box land on the pixel the side rule this replaced gave.
 */
const CANVAS_AREA_ROOT = Math.sqrt(CANVAS_AREA_MAX);

/**
 * The ratio that keeps a raster of that box inside what a canvas can hold. A
 * tall box is bounded by its area, so a document narrow enough to fit under the
 * ceiling keeps every pixel it was written with instead of being scaled down.
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
  const area = width * height;
  if (side <= 0 || area <= 0) return pixelRatio;

  return Math.min(
    pixelRatio,
    CANVAS_SIDE_MAX / side,
    CANVAS_AREA_ROOT / Math.sqrt(area)
  );
}
