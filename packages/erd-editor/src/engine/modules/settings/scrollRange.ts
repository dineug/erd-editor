/** How far the origin may travel on one axis, measured in screen pixels. */
export type ScrollRange = {
  min: number;
  max: number;
};

/** A zoom of exactly 1 negates a zero offset, and the store compares with Object.is. */
const unsigned = (value: number) => value + 0;

/**
 * One axis of travel, written on the origin: the half screen a zoom of 1 shows
 * between the middle of the screen and each edge of the drawn box, shrunk by
 * magnifying to the half it really shows. A leaf, so the bench can import it.
 */
export function toScrollRange(
  drawn: number,
  viewportLength: number,
  zoomLevel: number
): ScrollRange {
  const reach = Math.min(1, zoomLevel);
  const near = (viewportLength * (1 - reach)) / 2;
  const far = (viewportLength * (1 + reach)) / 2 - drawn;

  return {
    min: unsigned(Math.min(near, far)),
    max: unsigned(Math.max(near, far)),
  };
}
