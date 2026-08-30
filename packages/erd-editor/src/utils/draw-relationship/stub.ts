import { Direction } from '@/constants/schema';
import { Point, Relationship } from '@/internal-types';
import {
  getStubSlots,
  MIN_STUB,
  PATH_END_HEIGHT,
  PATH_LINE_HEIGHT,
  STUB_CYCLE,
  STUB_STEP,
} from '@/utils/draw-relationship';

/**
 * Slot zero keeps the historical PATH_END_HEIGHT, so a relationship that never
 * went through relationshipSort draws exactly as it did before.
 */
export function stubFor(slot: number) {
  return PATH_END_HEIGHT + (slot % STUB_CYCLE) * STUB_STEP;
}

/**
 * The axis-aligned distance between two anchors that point at each other, or
 * null when they do not. Only this arrangement can collapse: a gap of twice the
 * stub puts both turning points on one spot, and a smaller gap inverts the path.
 */
export function facingGap(
  start: Relationship['start'],
  end: Relationship['end']
): number | null {
  if (start.tableId === end.tableId) return null;

  if (start.direction === Direction.right && end.direction === Direction.left) {
    return end.x - start.x;
  }
  if (start.direction === Direction.left && end.direction === Direction.right) {
    return start.x - end.x;
  }
  if (start.direction === Direction.bottom && end.direction === Direction.top) {
    return end.y - start.y;
  }
  if (start.direction === Direction.top && end.direction === Direction.bottom) {
    return start.y - end.y;
  }
  return null;
}

/**
 * Below roughly 2 * MIN_STUB the two cardinality decorations already overlap
 * each other, which no stub length can fix; the clamp stops short of making it
 * worse by drawing the guide line backwards.
 */
export function clampStub(stub: number, gap: number | null) {
  if (gap === null || gap <= 0) return stub;
  return Math.max(MIN_STUB, Math.min(stub, gap / 2 - 1));
}

export type StubEnds = {
  /** Turning point on the start side. */
  m: Point;
  /** Turning point on the end side. */
  l: Point;
  startStub: number;
  endStub: number;
};

export function isHorizontal(direction: number) {
  return direction === Direction.left || direction === Direction.right;
}

/** +1 when the anchor's outward normal points right or down. */
export function outwardSign(direction: number) {
  return direction === Direction.right || direction === Direction.bottom
    ? 1
    : -1;
}

function offsetFrom(point: Point, direction: number, distance: number): Point {
  const sign = outwardSign(direction);
  return isHorizontal(direction)
    ? { x: point.x + sign * distance, y: point.y }
    : { x: point.x, y: point.y + sign * distance };
}

/** The two points a route has to join, given the anchors and their slots. */
export function stubEnds(relationship: Relationship): StubEnds {
  const { start, end } = relationship;
  const [startSlot, endSlot] = getStubSlots(relationship);
  const gap = facingGap(start, end);
  const startStub = clampStub(stubFor(startSlot), gap);
  const endStub = clampStub(stubFor(endSlot), gap);

  return {
    m: offsetFrom(start, start.direction, startStub),
    l: offsetFrom(end, end.direction, endStub),
    startStub,
    endStub,
  };
}

/**
 * Where the guide line begins — the short run between the cardinality
 * decorations and the routed polyline.
 */
export const GUIDE_START = PATH_LINE_HEIGHT;
