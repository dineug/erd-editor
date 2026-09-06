/** How far the origin may travel on one axis, measured in screen pixels. */
export type ScrollRange = {
  min: number;
  max: number;
};

/** A zoom of exactly 1 negates a zero edge, and the store compares with Object.is. */
const unsigned = (value: number) => value + 0;

/**
 * One axis of travel over content spanning near to far in scene units: at the
 * minimum the content's far edge meets the screen's near edge, at the maximum
 * its near edge meets the screen's far edge. A leaf, so the bench can import it.
 */
export function contentScrollRange(
  near: number,
  far: number,
  viewportLength: number,
  zoomLevel: number
): ScrollRange {
  const farEdgeAtStart = -far * zoomLevel;
  const nearEdgeAtEnd = viewportLength - near * zoomLevel;

  return {
    min: unsigned(Math.min(farEdgeAtStart, nearEdgeAtEnd)),
    max: unsigned(Math.max(farEdgeAtStart, nearEdgeAtEnd)),
  };
}

/**
 * Where a loaded origin settles on one axis: kept while it draws any of the
 * content, which is strictly inside the pure range, else pulled to the nearest
 * origin drawing all of it, or a screen's worth of it when it does not fit.
 */
export function openingOrigin(
  origin: number,
  near: number,
  far: number,
  viewportLength: number,
  zoomLevel: number
): number {
  const { min, max } = contentScrollRange(near, far, viewportLength, zoomLevel);

  if (min < origin && origin < max) return origin;

  const drawn = Math.min(viewportLength, (far - near) * zoomLevel);

  return unsigned(Math.min(Math.max(origin, min + drawn), max - drawn));
}
