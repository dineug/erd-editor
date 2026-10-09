import { Point } from '@/internal-types';
import { cubicPolyline } from '@/utils/draw-relationship/bezier';

/**
 * How far a loop's stubs run, as a multiple of how far its anchors sit from the
 * table corner: the first loop's 20px gives the 24px every other stub starts at.
 */
export const LOOP_STUB_RATIO = 1.2;

/**
 * How far a loop's control points reach past its stubs, as the same multiple.
 * With both scaled by the offset, a table's loops are one shape at nested sizes.
 */
export const LOOP_CURVATURE = 1.25;

/**
 * How many chords a loop is flattened into. Even a fourth loop's chords stray from
 * the curve by under a quarter of a pixel at the canvas's closest zoom.
 */
export const LOOP_SEGMENTS = 48;

/** How far a loop's anchors sit from the table corner, along either side. */
export function loopOffset(start: Point, end: Point): number {
  return Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
}

/** The stub both ends of a loop run out on. */
export function loopStub(start: Point, end: Point): number {
  return LOOP_STUB_RATIO * loopOffset(start, end);
}

/** How far past its anchors a loop is drawn at most, for the route box. */
export function loopReach(start: Point, end: Point): number {
  return (LOOP_STUB_RATIO + LOOP_CURVATURE) * loopOffset(start, end);
}

/**
 * A loop between its two turning points: a cubic leaving each straight out along
 * its stub, so it meets both without a corner and turns round the table's corner
 * clear of it.
 */
export function loopPolyline(
  from: Point,
  fromOutward: Point,
  to: Point,
  toOutward: Point,
  offset: number
): Point[] {
  const reach = LOOP_CURVATURE * offset;

  return cubicPolyline(
    from,
    { x: from.x + fromOutward.x * reach, y: from.y + fromOutward.y * reach },
    { x: to.x + toOutward.x * reach, y: to.y + toOutward.y * reach },
    to,
    LOOP_SEGMENTS
  );
}
